/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: conduitAStarRouter.ts
 * Motor de Ruteo Ortogonal de Canalizaciones (A* Pathfinding en Grafo 2.5D).
 * 
 * Responsabilidad Única:
 * Calcular la trayectoria ortogonal óptima (en escuadra) entre dos nodos
 * eléctricos considerando obstáculos constructivos (columnas, aberturas),
 * minimizando curvas innecesarias (penalización de giro) y sugiriendo
 * cajas de paso según normativa AEA 90364-771.12.3.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ConduitRoutingPlane, ConduitWaypoint } from './ElectricalModel';
import type { StructuralColumn, StructuralBeam } from '../architecture/StructuralElement';
import { isPointInsideColumn } from '../architecture/StructuralElement';
import type { Wall, WallVertex } from '../architecture/Wall';
import type { Opening } from '../architecture/Opening';
import { getOpeningPhysicalJambs } from '../architecture/Opening';
import { CONDUIT_ROUTING_CONSTANTS, AEA_CALCULATION_CONSTANTS } from './electricalStandards';

export interface RoutingPoint2D {
  x: number;
  y: number;
}

export interface RouteOptimizationOptions {
  routingPlane?: ConduitRoutingPlane;
  gridStepM?: number;
  obstacleClearanceM?: number;
  turnPenaltyM?: number;
  wallPreferenceFactor?: number;
  maxTurnsWithoutBox?: number;
  maxStraightRunM?: number;
  boundingMarginM?: number;
}

export interface JunctionBoxSuggestion {
  x: number;
  y: number;
  reason: 'excess_turns' | 'excess_length';
  distanceAlongRouteM: number;
  recommendedBoxType: string;
}

export interface AssistedRouteResult {
  waypoints: ConduitWaypoint[];
  fullPath: RoutingPoint2D[];
  totalLengthM: number;
  turnsCount: number;
  junctionBoxSuggestions: JunctionBoxSuggestion[];
  hasObstacleConflict: boolean;
  status: 'optimal' | 'fallback_detour' | 'direct';
}

export interface RouteConduitAStarParams {
  start: RoutingPoint2D;
  goal: RoutingPoint2D;
  routingPlane?: ConduitRoutingPlane;
  walls?: Wall[];
  vertices?: WallVertex[] | Map<string, WallVertex>;
  columns?: StructuralColumn[];
  beams?: StructuralBeam[];
  openings?: Opening[];
  options?: RouteOptimizationOptions;
}

/** Cola de prioridad binaria (Min-Heap) de alto rendimiento para búsqueda A* */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  push(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0].item;
    const bottom = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.items[idx].priority >= this.items[parentIdx].priority) break;
      const tmp = this.items[idx];
      this.items[idx] = this.items[parentIdx];
      this.items[parentIdx] = tmp;
      idx = parentIdx;
    }
  }

  private sinkDown(idx: number): void {
    const len = this.items.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < len && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }
      if (right < len && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }
      if (smallest === idx) break;
      const tmp = this.items[idx];
      this.items[idx] = this.items[smallest];
      this.items[smallest] = tmp;
      idx = smallest;
    }
  }
}

type Direction = 0 | 1 | 2 | 3 | 4; // 0: None/Start, 1: +Y (Norte), 2: -Y (Sur), 3: +X (Este), 4: -X (Oeste)

const DIR_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  0: { dx: 0, dy: 0 },
  1: { dx: 0, dy: 1 },
  2: { dx: 0, dy: -1 },
  3: { dx: 1, dy: 0 },
  4: { dx: -1, dy: 0 }
};

const MOVE_DIRECTIONS: readonly Direction[] = [1, 2, 3, 4];

interface GridNodeState {
  gx: number;
  gy: number;
  dir: Direction;
}

/**
 * Determina si un punto 2D está a una distancia menor o igual al espesor de un muro.
 */
function isPointNearWall(
  pt: RoutingPoint2D,
  wall: Wall,
  verticesMap: Map<string, WallVertex>
): boolean {
  const vStart = verticesMap.get(wall.startVertexId);
  const vEnd = verticesMap.get(wall.endVertexId);
  if (!vStart || !vEnd) return false;

  const wx = vEnd.x - vStart.x;
  const wy = vEnd.y - vStart.y;
  const lenSq = wx * wx + wy * wy;
  if (lenSq === 0) {
    return Math.hypot(pt.x - vStart.x, pt.y - vStart.y) <= wall.thickness / 2 + 0.05;
  }

  const t = Math.max(0, Math.min(1, ((pt.x - vStart.x) * wx + (pt.y - vStart.y) * wy) / lenSq));
  const projX = vStart.x + t * wx;
  const projY = vStart.y + t * wy;
  const dist = Math.hypot(pt.x - projX, pt.y - projY);

  return dist <= wall.thickness / 2 + 0.05;
}

/**
 * Determina si un punto cae dentro de un vano de abertura (ej: puerta) en modo pared.
 */
function isPointInsideOpeningEnvelope(
  pt: RoutingPoint2D,
  opening: Opening,
  wall: Wall,
  verticesMap: Map<string, WallVertex>,
  clearanceM: number
): boolean {
  if (opening.type !== 'door' && opening.type !== 'passage') return false;
  const physicalJambs = getOpeningPhysicalJambs(opening, wall, verticesMap);
  if (!physicalJambs) return false;

  const xs = [
    physicalJambs.leftJamb1.x,
    physicalJambs.leftJamb2.x,
    physicalJambs.rightJamb1.x,
    physicalJambs.rightJamb2.x
  ];
  const ys = [
    physicalJambs.leftJamb1.y,
    physicalJambs.leftJamb2.y,
    physicalJambs.rightJamb1.y,
    physicalJambs.rightJamb2.y
  ];

  const minX = Math.min(...xs) - clearanceM;
  const maxX = Math.max(...xs) + clearanceM;
  const minY = Math.min(...ys) - clearanceM;
  const maxY = Math.max(...ys) + clearanceM;

  return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
}

/**
 * Simplifica una polilínea ortogonal eliminando puntos intermedios colineales.
 */
export function simplifyCollinearPolyline(points: RoutingPoint2D[]): RoutingPoint2D[] {
  if (points.length <= 2) return [...points];

  const simplified: RoutingPoint2D[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // Si ambos segmentos avanzan en la misma dirección ortogonal, omitimos curr
    const isSameDirX = Math.abs(dy1) < 0.001 && Math.abs(dy2) < 0.001 && Math.sign(dx1) === Math.sign(dx2);
    const isSameDirY = Math.abs(dx1) < 0.001 && Math.abs(dx2) < 0.001 && Math.sign(dy1) === Math.sign(dy2);

    if (!isSameDirX && !isSameDirY) {
      simplified.push(curr);
    }
  }

  simplified.push(points[points.length - 1]);
  return simplified;
}

/**
 * Analiza una ruta ortogonal y genera sugerencias técnicas de cajas de paso
 * según las prescripciones de la norma AEA 90364-771.12.3:
 * - Máximo 3 curvas a 90° continuas.
 * - Longitud máxima de tramo recto sin caja: 12 m.
 */
export function detectJunctionBoxes(
  simplifiedPolyline: RoutingPoint2D[],
  maxTurns: number = AEA_CALCULATION_CONSTANTS.MAX_CONDUIT_BENDS_WITHOUT_JUNCTION_BOX,
  maxStraightRunM: number = AEA_CALCULATION_CONSTANTS.MAX_CONDUIT_STRAIGHT_RUN_M
): JunctionBoxSuggestion[] {
  if (simplifiedPolyline.length < 2) return [];

  const suggestions: JunctionBoxSuggestion[] = [];
  const interiorTurns = simplifiedPolyline.slice(1, -1);
  let accumulatedDist = 0;

  // 1. Detección por exceso de curvas de 90° (> 3 curvas continuas según AEA 771.12.3)
  let turnsSinceLastBox = 0;
  for (let i = 0; i < interiorTurns.length; i++) {
    turnsSinceLastBox++;
    const prevPt = simplifiedPolyline[i];
    const turnPt = interiorTurns[i];
    accumulatedDist += Math.hypot(turnPt.x - prevPt.x, turnPt.y - prevPt.y);

    if (turnsSinceLastBox > maxTurns) {
      // Se sugiere intercalar la caja en la curva anterior para no sobrepasar el límite
      const targetTurn = interiorTurns[i - 1] || turnPt;
      suggestions.push({
        x: Number(targetTurn.x.toFixed(3)),
        y: Number(targetTurn.y.toFixed(3)),
        reason: 'excess_turns',
        distanceAlongRouteM: Number(accumulatedDist.toFixed(2)),
        recommendedBoxType: 'caja_cuadrada'
      });
      turnsSinceLastBox = 1; // Se reinicia el conteo considerando el tramo siguiente a la caja
    }
  }

  // 2. Detección por exceso de longitud en tramos rectos
  let runDist = 0;
  for (let i = 0; i < simplifiedPolyline.length - 1; i++) {
    const pA = simplifiedPolyline[i];
    const pB = simplifiedPolyline[i + 1];
    const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y);

    if (segLen > maxStraightRunM) {
      const parts = Math.ceil(segLen / maxStraightRunM);
      const stepFraction = 1 / parts;
      for (let p = 1; p < parts; p++) {
        const frac = p * stepFraction;
        const jx = pA.x + (pB.x - pA.x) * frac;
        const jy = pA.y + (pB.y - pA.y) * frac;
        suggestions.push({
          x: Number(jx.toFixed(3)),
          y: Number(jy.toFixed(3)),
          reason: 'excess_length',
          distanceAlongRouteM: Number((runDist + segLen * frac).toFixed(2)),
          recommendedBoxType: 'caja_cuadrada'
        });
      }
    }
    runDist += segLen;
  }

  return suggestions;
}

/**
 * Motor A* para Ruteo Ortogonal 2.5D de Canalizaciones Eléctricas.
 */
export function routeConduitAStar(params: RouteConduitAStarParams): AssistedRouteResult {
  const {
    start,
    goal,
    routingPlane = 'wall',
    walls = [],
    vertices = [],
    columns = [],
    beams: _beams = [],
    openings = [],
    options = {}
  } = params;

  const gridStep = options.gridStepM ?? CONDUIT_ROUTING_CONSTANTS.DEFAULT_GRID_STEP_M;
  const clearance = options.obstacleClearanceM ?? CONDUIT_ROUTING_CONSTANTS.DEFAULT_OBSTACLE_CLEARANCE_M;
  const turnPenalty = options.turnPenaltyM ?? CONDUIT_ROUTING_CONSTANTS.DEFAULT_TURN_PENALTY_M;
  const wallFactor = options.wallPreferenceFactor ?? CONDUIT_ROUTING_CONSTANTS.WALL_ATTRACTION_FACTOR;
  const marginM = options.boundingMarginM ?? CONDUIT_ROUTING_CONSTANTS.BOUNDING_MARGIN_M;
  const maxTurns = options.maxTurnsWithoutBox ?? CONDUIT_ROUTING_CONSTANTS.MAX_TURNS_WITHOUT_BOX;
  const maxStraight = options.maxStraightRunM ?? CONDUIT_ROUTING_CONSTANTS.MAX_STRAIGHT_RUN_M;

  // Mapa de vértices para búsquedas de muros
  const verticesMap =
    vertices instanceof Map
      ? vertices
      : new Map(vertices.map((v) => [v.id, v]));

  // 1. Límites del dominio de búsqueda (Bounding Box con margen)
  const minX = Math.min(start.x, goal.x) - marginM;
  const maxX = Math.max(start.x, goal.x) + marginM;
  const minY = Math.min(start.y, goal.y) - marginM;
  const maxY = Math.max(start.y, goal.y) + marginM;

  // Redondeo de punto a cuadrícula
  const toGrid = (val: number) => Math.round(val / gridStep);
  const fromGrid = (g: number) => Number((g * gridStep).toFixed(4));

  const startGx = toGrid(start.x);
  const startGy = toGrid(start.y);
  const goalGx = toGrid(goal.x);
  const goalGy = toGrid(goal.y);

  // Si start y goal coinciden métricamente en la misma celda
  if (startGx === goalGx && startGy === goalGy) {
    return {
      waypoints: [],
      fullPath: [start, goal],
      totalLengthM: Math.hypot(goal.x - start.x, goal.y - start.y),
      turnsCount: 0,
      junctionBoxSuggestions: [],
      hasObstacleConflict: false,
      status: 'direct'
    };
  }

  // 2. Comprobador de colisiones con obstáculos
  const isBlocked = (gx: number, gy: number): boolean => {
    // Permitir celdas de inicio y fin exactas para no bloquear bocas ancladas a muros o junto a columnas
    if ((gx === startGx && gy === startGy) || (gx === goalGx && gy === goalGy)) {
      return false;
    }

    const worldPt = { x: fromGrid(gx), y: fromGrid(gy) };

    // A. Columnas estructurales (infranqueables en losa y pared)
    for (const col of columns) {
      if (isPointInsideColumn(worldPt, col, clearance)) {
        return true;
      }
    }

    // B. Aberturas (puertas/vanos infranqueables en tendido de pared)
    if (routingPlane === 'wall') {
      for (const op of openings) {
        const wall = walls.find((w) => w.id === op.wallId);
        if (wall && isPointInsideOpeningEnvelope(worldPt, op, wall, verticesMap, clearance)) {
          return true;
        }
      }
    }

    return false;
  };

  // 3. Heurística Manhattan admisible
  const heuristic = (gx: number, gy: number) => {
    return (Math.abs(gx - goalGx) + Math.abs(gy - goalGy)) * gridStep;
  };

  // 4. Inicialización del Min-Heap A*
  const openSet = new PriorityQueue<GridNodeState>();
  const gScores = new Map<string, number>();
  const cameFrom = new Map<string, GridNodeState>();

  const encodeState = (gx: number, gy: number, dir: Direction) => `${gx},${gy},${dir}`;

  // Estado inicial (dirección 0 = inicial sin giro)
  const initialKey = encodeState(startGx, startGy, 0);
  gScores.set(initialKey, 0);
  openSet.push({ gx: startGx, gy: startGy, dir: 0 }, heuristic(startGx, startGy));

  let finalState: GridNodeState | null = null;
  let iterations = 0;
  const maxIterations = 18000;

  while (openSet.size > 0 && iterations < maxIterations) {
    iterations++;
    const current = openSet.pop();
    if (!current) break;

    const currentKey = encodeState(current.gx, current.gy, current.dir);
    const currentG = gScores.get(currentKey) ?? Infinity;

    // Llegada a destino
    if (current.gx === goalGx && current.gy === goalGy) {
      finalState = current;
      break;
    }

    // Explorar los 4 vecinos ortogonales
    for (const nextDir of MOVE_DIRECTIONS) {
      // Evitar dar marcha atrás inmediata (180°)
      if (
        (current.dir === 1 && nextDir === 2) ||
        (current.dir === 2 && nextDir === 1) ||
        (current.dir === 3 && nextDir === 4) ||
        (current.dir === 4 && nextDir === 3)
      ) {
        continue;
      }

      const delta = DIR_DELTAS[nextDir];
      const nextGx = current.gx + delta.dx;
      const nextGy = current.gy + delta.dy;

      // Fuera del área de exploración
      const worldX = fromGrid(nextGx);
      const worldY = fromGrid(nextGy);
      if (worldX < minX || worldX > maxX || worldY < minY || worldY > maxY) {
        continue;
      }

      // Colisión con elemento constructivo
      if (isBlocked(nextGx, nextGy)) {
        continue;
      }

      // Costo del paso
      let stepCost = gridStep;

      // Penalización por curva a 90° (favorece rectas y minimiza quiebres)
      if (current.dir !== 0 && current.dir !== nextDir) {
        stepCost += turnPenalty;
      }

      // En tendido de pared: favorecer trayectorias que discurran a lo largo de muros
      if (routingPlane === 'wall' && walls.length > 0) {
        let onAnyWall = false;
        for (const wall of walls) {
          if (isPointNearWall({ x: worldX, y: worldY }, wall, verticesMap)) {
            onAnyWall = true;
            break;
          }
        }
        stepCost *= onAnyWall ? wallFactor : CONDUIT_ROUTING_CONSTANTS.OPEN_SPACE_WALL_PENALTY;
      }

      const tentativeG = currentG + stepCost;
      const nextKey = encodeState(nextGx, nextGy, nextDir);
      const recordedG = gScores.get(nextKey) ?? Infinity;

      if (tentativeG < recordedG) {
        gScores.set(nextKey, tentativeG);
        cameFrom.set(nextKey, current);
        const fScore = tentativeG + heuristic(nextGx, nextGy);
        openSet.push({ gx: nextGx, gy: nextGy, dir: nextDir }, fScore);
      }
    }
  }

  // 5. Reconstrucción del camino si se encontró solución
  if (finalState) {
    const rawGridPath: RoutingPoint2D[] = [];
    let curr: GridNodeState | undefined = finalState;

    while (curr) {
      rawGridPath.push({ x: fromGrid(curr.gx), y: fromGrid(curr.gy) });
      const currKey = encodeState(curr.gx, curr.gy, curr.dir);
      curr = cameFrom.get(currKey);
    }

    rawGridPath.reverse();

    // Asegurar los extremos exactos
    rawGridPath[0] = { x: Number(start.x.toFixed(3)), y: Number(start.y.toFixed(3)) };
    rawGridPath[rawGridPath.length - 1] = { x: Number(goal.x.toFixed(3)), y: Number(goal.y.toFixed(3)) };

    // Simplificación de tramos colineales
    const simplified = simplifyCollinearPolyline(rawGridPath);

    // Los waypoints son los puntos de quiebre interiores
    const waypoints: ConduitWaypoint[] = simplified.slice(1, -1).map((pt) => ({
      x: Number(pt.x.toFixed(3)),
      y: Number(pt.y.toFixed(3))
    }));

    // Métricas totales
    let totalLengthM = 0;
    for (let i = 0; i < simplified.length - 1; i++) {
      totalLengthM += Math.hypot(simplified[i + 1].x - simplified[i].x, simplified[i + 1].y - simplified[i].y);
    }

    const turnsCount = waypoints.length;
    const junctionBoxSuggestions = detectJunctionBoxes(simplified, maxTurns, maxStraight);

    return {
      waypoints,
      fullPath: simplified,
      totalLengthM: Number(totalLengthM.toFixed(3)),
      turnsCount,
      junctionBoxSuggestions,
      hasObstacleConflict: false,
      status: 'optimal'
    };
  }

  // 6. Fallback de desvío ortogonal simple si el espacio estuvo confinado
  const fallbackPoints: RoutingPoint2D[] = [
    { x: Number(start.x.toFixed(3)), y: Number(start.y.toFixed(3)) }
  ];

  const dx = Math.abs(goal.x - start.x);
  const dy = Math.abs(goal.y - start.y);

  if (dx > 0.05 && dy > 0.05) {
    // Esquina intermedia en escuadra
    fallbackPoints.push({ x: Number(goal.x.toFixed(3)), y: Number(start.y.toFixed(3)) });
  }
  fallbackPoints.push({ x: Number(goal.x.toFixed(3)), y: Number(goal.y.toFixed(3)) });

  const fallbackWaypoints: ConduitWaypoint[] = fallbackPoints.slice(1, -1).map((pt) => ({
    x: pt.x,
    y: pt.y
  }));

  const fallbackDist = dx + dy;
  const junctionBoxSuggestions = detectJunctionBoxes(fallbackPoints, maxTurns, maxStraight);

  return {
    waypoints: fallbackWaypoints,
    fullPath: fallbackPoints,
    totalLengthM: Number(fallbackDist.toFixed(3)),
    turnsCount: fallbackWaypoints.length,
    junctionBoxSuggestions,
    hasObstacleConflict: true,
    status: 'fallback_detour'
  };
}
