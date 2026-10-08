/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Space.ts
 * Ambientes y Espacios Funcionales (BIM IfcSpace).
 * Los ambientes son emergentes: habitan el volumen delimitado por las caras
 * de los muros del edificio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D, WallVertex } from './Wall';

export type SpaceCategory =
  | 'living'
  | 'dormitorio'
  | 'cocina'
  | 'bano'
  | 'pasillo'
  | 'lavadero'
  | 'cochera'
  | 'escalera'
  | 'balcon'
  | 'aire_luz'
  | 'pleno'
  | 'exterior'
  | 'otro';

export type SpaceCoverType = 'cubierto' | 'semicubierto' | 'descubierto' | 'vacio';

export type CeilingProjectionMode = 'total' | 'alero';

export interface CeilingProjection {
  mode: CeilingProjectionMode;
  overhangDepth?: number;   // Profundidad de alero en metros (default: 1.50)
  ceilingHeight?: number;   // Altura libre piso-techo del alero (si difiere de space.ceilingHeight)
  referenceWallId?: string; // ID del muro de fachada / apoyo desde donde proyecta el alero
}

export interface Space {
  id: string;
  name: string;                // Ej: "Living Comedor", "Patio de Aire y Luz", "Pleno Técnico"
  category: SpaceCategory;
  levelId: string;             // Nivel/planta al que pertenece
  ceilingHeight: number;       // Altura libre piso-cielorraso en metros (default: 2.70)
  floorElevation: number;      // Desnivel del piso respecto al nivel de planta (default: 0.00)
  boundaryVertexIds: string[]; // Vértices ordenados que forman el perímetro interior
  wallIds: string[];           // IDs de los muros que lo rodean
  coverType?: SpaceCoverType;  // Tipo de cubierta: cubierto, semicubierto (balcón), descubierto o vacío
  ceilingProjection?: CeilingProjection; // Proyección de techo / alero para ambientes semicubiertos
  color?: string;              // Color tenue de relleno para identificación
}

export const ROOM_NAME_SUGGESTIONS: readonly string[] = [
  'Living Comedor',
  'Cocina',
  'Dormitorio 1',
  'Dormitorio 2',
  'Baño',
  'Lavadero',
  'Pasillo',
  'Balcón',
  'Quincho',
  'Galería',
  'Patio Aire y Luz',
  'Pleno Técnico',
  'Terraza',
  'Cochera'
];

export const STANDARD_CEILING_HEIGHT_PRESETS: readonly number[] = [2.40, 2.60, 2.70, 2.80, 3.00];

export const STANDARD_OVERHANG_DEPTH_PRESETS: readonly number[] = [1.00, 1.50, 2.00, 2.50];

export interface SpaceCoverTypeOption {
  readonly id: SpaceCoverType;
  readonly label: string;
  readonly shortLabel: string;
  readonly defaultCategory: SpaceCategory;
  readonly defaultIP: 'IP20' | 'IP44' | 'IP65';
  readonly aeaAreaFactor: number;
  readonly description: string;
}

export const SPACE_COVER_TYPE_OPTIONS: readonly SpaceCoverTypeOption[] = [
  {
    id: 'cubierto',
    label: 'Cubierto (Interior / Habitable)',
    shortLabel: 'Cubierto',
    defaultCategory: 'living',
    defaultIP: 'IP20',
    aeaAreaFactor: 1.0,
    description: 'Losa o techo completo. 100% computable para superficie límite AEA 771.'
  },
  {
    id: 'semicubierto',
    label: 'Semicubierto (Galería / Balcón / Alero)',
    shortLabel: 'Semicubierto',
    defaultCategory: 'balcon',
    defaultIP: 'IP44',
    aeaAreaFactor: 0.5,
    description: 'Techo o alero abierto al exterior. 50% computable para superficie límite AEA 771.'
  },
  {
    id: 'descubierto',
    label: 'Descubierto (Patio / Terraza / Jardín)',
    shortLabel: 'Descubierto',
    defaultCategory: 'exterior',
    defaultIP: 'IP65',
    aeaAreaFactor: 0.0,
    description: 'A cielo abierto sin cubierta. 0% computable para superficie límite AEA 771.'
  },
  {
    id: 'vacio',
    label: 'Vacío / Aire y Luz / Pleno',
    shortLabel: 'Vacío',
    defaultCategory: 'aire_luz',
    defaultIP: 'IP20',
    aeaAreaFactor: 0.0,
    description: 'Hueco de losa o patio de aire y luz. 0% computable.'
  }
];

export function getSpaceCoverOption(coverType?: SpaceCoverType): SpaceCoverTypeOption {
  const match = SPACE_COVER_TYPE_OPTIONS.find((opt) => opt.id === coverType);
  return match || SPACE_COVER_TYPE_OPTIONS[0];
}

/**
 * Retorna true si el espacio representa un vacío arquitectónico (patio de aire y luz o hueco de losa).
 */
export function isSpaceVoid(space: Space): boolean {
  if (space.coverType) {
    return space.coverType === 'vacio';
  }
  return space.category === 'aire_luz';
}

/**
 * Retorna true si el espacio está a cielo abierto (patio descubierto, terraza descubierta).
 */
export function isSpaceOpenAir(space: Space): boolean {
  if (space.coverType) {
    return space.coverType === 'descubierto';
  }
  return space.category === 'exterior';
}

/**
 * Retorna true si el espacio es semicubierto (galería, balcón con alero o porche).
 */
export function isSpaceSemiCovered(space: Space): boolean {
  if (space.coverType) {
    return space.coverType === 'semicubierto';
  }
  return space.category === 'balcon';
}

/**
 * Retorna true si el espacio es un pleno técnico o ducto de montantes verticales.
 */
export function isSpaceShaft(space: Space): boolean {
  return space.category === 'pleno';
}

export interface SpaceMetrics {
  areaM2: number;
  perimeterM: number;
  volumeM3: number;
  limitAreaM2?: number; // Superficie computable AEA 771 (m²)
}

// ─── CÁLCULOS GEOMÉTRICOS DE SUPERFICIES Y CENTROIDES ───────────────────────

/**
 * Calcula la superficie de un polígono cerrado 2D mediante la fórmula de Gauss (Shoelace).
 */
export function calculatePolygonArea(polygon: Vector2D[]): number {
  const n = polygon.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Calcula el perímetro de un polígono 2D cerrado en metros.
 */
export function calculatePolygonPerimeter(polygon: Vector2D[]): number {
  const n = polygon.length;
  if (n < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    perimeter += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return perimeter;
}

/**
 * Calcula el centroide (centro de masa) geométrico de un polígono 2D.
 * Ideal para posicionar la etiqueta de nombre de ambiente o el centro de iluminación.
 */
export function calculatePolygonCentroid(polygon: Vector2D[]): Vector2D {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n < 3) {
    // Si no es un polígono cerrado, retornar promedio simple
    const sumX = polygon.reduce((acc, p) => acc + p.x, 0);
    const sumY = polygon.reduce((acc, p) => acc + p.y, 0);
    return { x: sumX / n, y: sumY / n };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % n];
    const a = p0.x * p1.y - p1.x * p0.y;
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cy += (p0.y + p1.y) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    // Fallback a promedio si los vértices son colineales
    const sumX = polygon.reduce((acc, p) => acc + p.x, 0);
    const sumY = polygon.reduce((acc, p) => acc + p.y, 0);
    return { x: sumX / n, y: sumY / n };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;

  return { x: cx, y: cy };
}

/**
 * Determina si un punto 2D se encuentra contenido dentro de un polígono cerrado (Ray Casting).
 */
export function isPointInPolygon(point: Vector2D, polygon: Vector2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Resuelve el polígono de puntos a partir de los IDs de vértices y el mapa de vértices.
 */
export function resolveSpacePolygon(
  space: Space,
  vertices: Map<string, WallVertex>
): Vector2D[] {
  const points: Vector2D[] = [];
  if (!space || !Array.isArray(space.boundaryVertexIds)) return points;
  for (const vId of space.boundaryVertexIds) {
    const v = vertices.get(vId);
    if (v) points.push({ x: v.x, y: v.y });
  }
  return points;
}

export interface CeilingProjectionResult {
  coveredAreaM2: number;
  projectionLine?: [Vector2D, Vector2D]; // Línea del límite del alero en coordenadas métricas
  isPartial: boolean;
}

/**
 * Calcula la proyección geométrica del techo o alero para un recinto arquitectónico.
 * Si es semicubierto con alero paramétrico, determina la línea de proyección normalizada (-- - --)
 * y la superficie cubierta efectiva.
 */
export function computeCeilingProjection(
  space: Space,
  verticesMap: Map<string, { x: number; y: number }>,
  wallsMap?: Map<string, { id: string; startVertexId: string; endVertexId: string }>
): CeilingProjectionResult {
  const poly = resolveSpacePolygon(space, verticesMap as any);
  const totalArea = poly.length >= 3 ? calculatePolygonArea(poly) : 0;

  if (isSpaceVoid(space) || isSpaceOpenAir(space)) {
    return { coveredAreaM2: 0, isPartial: false };
  }

  if (!isSpaceSemiCovered(space)) {
    // Cubierto u otro tipo cerrado completo
    return { coveredAreaM2: totalArea, isPartial: false };
  }

  // Recinto semicubierto
  const proj = space.ceilingProjection;
  if (!proj || proj.mode === 'total') {
    return { coveredAreaM2: totalArea, isPartial: false };
  }

  // proj.mode === 'alero'
  const depth = Math.max(0.1, proj.overhangDepth ?? 1.50);

  // Buscar el muro de referencia desde donde se proyecta el alero
  let refWall: { id: string; startVertexId: string; endVertexId: string } | undefined;
  if (proj.referenceWallId && wallsMap) {
    refWall = wallsMap.get(proj.referenceWallId);
  }
  if (!refWall && wallsMap && space.wallIds && space.wallIds.length > 0) {
    // Si no se especificó, buscar el muro más largo del ambiente como apoyo principal
    let maxLen = -1;
    for (const wId of space.wallIds) {
      const w = wallsMap.get(wId);
      if (w) {
        const v1 = verticesMap.get(w.startVertexId);
        const v2 = verticesMap.get(w.endVertexId);
        if (v1 && v2) {
          const l = Math.hypot(v2.x - v1.x, v2.y - v1.y);
          if (l > maxLen) {
            maxLen = l;
            refWall = w;
          }
        }
      }
    }
  }

  if (!refWall || !verticesMap.has(refWall.startVertexId) || !verticesMap.has(refWall.endVertexId)) {
    const covered = Math.min(totalArea, totalArea * 0.5);
    return { coveredAreaM2: Number(covered.toFixed(2)), isPartial: true };
  }

  const v1 = verticesMap.get(refWall.startVertexId)!;
  const v2 = verticesMap.get(refWall.endVertexId)!;
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 1e-4) {
    return { coveredAreaM2: totalArea, isPartial: false };
  }

  // Vector unitario en dirección del muro
  const ux = dx / wallLen;
  const uy = dy / wallLen;

  // Normal candidato
  let nx = -uy;
  let ny = ux;

  // Orientar el normal hacia el interior del ambiente (hacia su centroide)
  const centroid = calculatePolygonCentroid(poly);
  const midX = (v1.x + v2.x) / 2;
  const midY = (v1.y + v2.y) / 2;
  const toCentroidX = centroid.x - midX;
  const toCentroidY = centroid.y - midY;
  if (nx * toCentroidX + ny * toCentroidY < 0) {
    nx = -nx;
    ny = -ny;
  }

  // Línea del alero paralela al muro, desplazada 'depth' metros hacia el interior
  const p1: Vector2D = {
    x: Number((v1.x + nx * depth).toFixed(3)),
    y: Number((v1.y + ny * depth).toFixed(3))
  };
  const p2: Vector2D = {
    x: Number((v2.x + nx * depth).toFixed(3)),
    y: Number((v2.y + ny * depth).toFixed(3))
  };

  const approxCovered = Math.min(totalArea, wallLen * depth);

  return {
    coveredAreaM2: Number(approxCovered.toFixed(2)),
    projectionLine: [p1, p2],
    isPartial: true
  };
}

/**
 * Calcula las métricas BIM del ambiente (superficie útil, perímetro, volumen interior y superficie límite AEA).
 */
export function calculateSpaceMetrics(
  space: Space,
  verticesMap: Map<string, WallVertex>,
  wallsMap?: Map<string, { id: string; startVertexId: string; endVertexId: string }>
): SpaceMetrics {
  const poly = resolveSpacePolygon(space, verticesMap);
  const areaM2 = poly.length >= 3 ? calculatePolygonArea(poly) : 0;
  const perimeterM = poly.length >= 2 ? calculatePolygonPerimeter(poly) : 0;

  const isVoid = isSpaceVoid(space);
  const isOpenAir = isSpaceOpenAir(space);
  const volumeM3 = (isVoid || isOpenAir) ? 0 : Number((areaM2 * (space.ceilingHeight || 2.70)).toFixed(2));

  let limitAreaM2 = areaM2;
  if (isVoid || isOpenAir) {
    limitAreaM2 = 0;
  } else if (isSpaceSemiCovered(space)) {
    const { coveredAreaM2 } = computeCeilingProjection(space, verticesMap, wallsMap);
    limitAreaM2 = Number((coveredAreaM2 * 0.50).toFixed(2));
  }

  return {
    areaM2,
    perimeterM,
    volumeM3,
    limitAreaM2: Number(limitAreaM2.toFixed(2))
  };
}


/**
 * Detecta las caras interiores de un grafo plano de muros (Planar Straight-Line Graph)
 * utilizando el recorrido angular de semiaristas (Half-Edges / Left-hand rule).
 * Garantiza que:
 * 1. Cada recinto interior sea detectado exactamente una vez.
 * 2. NO se generen ambientes fantasma por uniones de ambientes adyacentes ni el perímetro exterior.
 * 3. Los vértices del ambiente queden estrictamente ordenados a lo largo de su perímetro.
 */
export function findEnclosedCycles(
  walls: Array<{ id: string; startVertexId: string; endVertexId: string }>,
  verticesMap?: Map<string, { x: number; y: number }> | Array<{ id: string; x: number; y: number }>
): {
  vertexIds: string[];
  wallIds: string[];
}[] {
  // Si no disponemos de coordenadas de vértices, recurrir al método topológico de respaldo
  if (!verticesMap) {
    return findCyclesTopologicalFallback(walls);
  }

  const vMap =
    verticesMap instanceof Map
      ? verticesMap
      : new Map(verticesMap.map((v) => [v.id, { x: v.x, y: v.y }]));

  interface HalfEdge {
    from: string;
    to: string;
    wallId: string;
    angle: number;
    visited: boolean;
  }

  const outgoing = new Map<string, HalfEdge[]>();
  const halfEdges: HalfEdge[] = [];

  for (const w of walls) {
    if (w.startVertexId === w.endVertexId) continue;
    const v1 = vMap.get(w.startVertexId);
    const v2 = vMap.get(w.endVertexId);
    if (!v1 || !v2) continue;

    if (!outgoing.has(w.startVertexId)) outgoing.set(w.startVertexId, []);
    if (!outgoing.has(w.endVertexId)) outgoing.set(w.endVertexId, []);

    const angle1 = Math.atan2(v2.y - v1.y, v2.x - v1.x);
    const angle2 = Math.atan2(v1.y - v2.y, v1.x - v2.x);

    const he1: HalfEdge = { from: w.startVertexId, to: w.endVertexId, wallId: w.id, angle: angle1, visited: false };
    const he2: HalfEdge = { from: w.endVertexId, to: w.startVertexId, wallId: w.id, angle: angle2, visited: false };

    outgoing.get(w.startVertexId)!.push(he1);
    outgoing.get(w.endVertexId)!.push(he2);
    halfEdges.push(he1, he2);
  }

  // Ordenar semiaristas salientes por ángulo polar ascendente
  for (const list of outgoing.values()) {
    list.sort((a, b) => a.angle - b.angle);
  }

  const cycles: { vertexIds: string[]; wallIds: string[] }[] = [];

  for (const he of halfEdges) {
    if (he.visited) continue;

    const faceEdges: HalfEdge[] = [];
    let curr: HalfEdge | undefined = he;

    while (curr && !curr.visited) {
      curr.visited = true;
      faceEdges.push(curr);

      const nextVertex = curr.to;
      const outList = outgoing.get(nextVertex);
      if (!outList || outList.length === 0) break;

      // En el vértice destino, ubicar la semiarista de regreso hacia curr.from
      const revIdx = outList.findIndex((e) => e.to === curr!.from);
      if (revIdx === -1) break;

      // La semiarista que dobla más cerrado a la izquierda es la inmediatamente precedente
      const nextIdx = (revIdx - 1 + outList.length) % outList.length;
      curr = outList[nextIdx];
    }

    if (faceEdges.length >= 3 && curr === he) {
      // Calcular área con signo mediante fórmula de Gauss (Shoelace)
      const poly = faceEdges.map((e) => vMap.get(e.from)!);
      let signedArea = 0;
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % n];
        signedArea += p1.x * p2.y - p2.x * p1.y;
      }
      signedArea /= 2;

      // Las caras interiores recorridas en sentido antihorario tienen signedArea > 0
      // La cara infinita exterior tiene signo opuesto (negativo) y no se agrega
      if (signedArea > 0.05) {
        cycles.push({
          vertexIds: faceEdges.map((e) => e.from),
          wallIds: faceEdges.map((e) => e.wallId)
        });
      }
    }
  }

  return cycles;
}

function findCyclesTopologicalFallback(
  walls: Array<{ id: string; startVertexId: string; endVertexId: string }>
): { vertexIds: string[]; wallIds: string[] }[] {
  const adj = new Map<string, Array<{ to: string; wallId: string }>>();

  for (const w of walls) {
    if (!adj.has(w.startVertexId)) adj.set(w.startVertexId, []);
    if (!adj.has(w.endVertexId)) adj.set(w.endVertexId, []);
    adj.get(w.startVertexId)!.push({ to: w.endVertexId, wallId: w.id });
    adj.get(w.endVertexId)!.push({ to: w.startVertexId, wallId: w.id });
  }

  const cycles: { vertexIds: string[]; wallIds: string[] }[] = [];
  const visitedPaths = new Set<string>();

  function dfs(
    start: string,
    current: string,
    visited: string[],
    usedWalls: string[]
  ) {
    if (visited.length > 12) return;

    const neighbors = adj.get(current) || [];
    for (const { to, wallId } of neighbors) {
      if (usedWalls.length > 0 && wallId === usedWalls[usedWalls.length - 1]) continue;

      if (to === start && visited.length >= 3) {
        const sortedKey = [...visited].sort().join('-');
        if (!visitedPaths.has(sortedKey)) {
          visitedPaths.add(sortedKey);
          cycles.push({
            vertexIds: [...visited],
            wallIds: [...usedWalls, wallId]
          });
        }
        continue;
      }

      if (!visited.includes(to)) {
        dfs(start, to, [...visited, to], [...usedWalls, wallId]);
      }
    }
  }

  for (const vId of adj.keys()) {
    dfs(vId, vId, [vId], []);
  }

  return cycles;
}

