/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: WallSnapEngine.ts (CAD Smart Grips & Snap Matemático Puro)
 * Provee cálculo vectorial puro de imantación magnética para extremos de muro:
 * 1. Snap a vértice existente (fusión automática de esquinas).
 * 2. Deslizamiento sobre muro receptor en empalmes en "T".
 * 3. Guías inteligentes de alineación X / Y con otros vértices (Smart Guides).
 * 4. Tracking polar a ángulos notables (0°, 45°, 90°, 180°, etc.).
 * 5. Preservación invariante de aberturas a distancia física fija.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D, Wall, WallVertex } from './Wall';
import type { Opening } from './Opening';
import { CAD_SNAP_CONFIG } from '../../config/appCadConfig';

export type SnapTargetType =
  | 'vertex'
  | 'wall_slide'
  | 'smart_guide'
  | 'polar_angle'
  | 'grid'
  | 'none';

export interface GuideLine {
  type: 'x_align' | 'y_align' | 'polar_ray' | 'wall_axis';
  from: Vector2D;
  to: Vector2D;
  label?: string;
  referenceVertexId?: string;
  referenceWallId?: string;
}

export interface WallSnapResult {
  snappedPoint: Vector2D;
  targetType: SnapTargetType;
  targetVertexId?: string;
  targetWallId?: string;
  angleDeg?: number;
  lengthM?: number;
  guides: GuideLine[];
}

export interface WallSnapOptions {
  vertexToleranceM?: number;    // default: 0.25 m
  wallSlideToleranceM?: number; // default: 0.25 m
  alignToleranceM?: number;     // default: 0.15 m
  angleToleranceDeg?: number;   // default: 4.0 deg
  gridStepM?: number;           // default: 0.05 m
  enableGrid?: boolean;         // default: false
}

export const NOTABLE_POLAR_ANGLES_DEG = CAD_SNAP_CONFIG.NOTABLE_POLAR_ANGLES_DEG;

/**
 * Normaliza un ángulo en grados al rango [0, 360).
 */
export function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

/**
 * Calcula la diferencia angular mínima entre dos ángulos en grados.
 */
export function getSmallestAngleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(normalizeAngleDeg(a) - normalizeAngleDeg(b));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Calcula la imantación polar a ángulos notables (0°, 45°, 90°, etc.) respecto a un vértice fijo.
 */
export function calculatePolarAngleSnap(
  point: Vector2D,
  fixedPoint: Vector2D,
  toleranceDeg: number = CAD_SNAP_CONFIG.ANGLE_TOLERANCE_DEG
): { snappedPoint: Vector2D; angleDeg: number; lengthM: number } | null {
  const dx = point.x - fixedPoint.x;
  const dy = point.y - fixedPoint.y;
  const lengthM = Math.hypot(dx, dy);
  if (lengthM < 0.05) return null;

  const rawRad = Math.atan2(dy, dx);
  const rawDeg = normalizeAngleDeg((rawRad * 180) / Math.PI);

  let bestAngle: number | null = null;
  let minDiff = toleranceDeg;

  for (const targetAngle of NOTABLE_POLAR_ANGLES_DEG) {
    const diff = getSmallestAngleDiffDeg(rawDeg, targetAngle);
    if (diff <= minDiff) {
      minDiff = diff;
      bestAngle = targetAngle;
    }
  }

  if (bestAngle === null) return null;

  const targetRad = (bestAngle * Math.PI) / 180;
  const snappedPoint: Vector2D = {
    x: Number((fixedPoint.x + lengthM * Math.cos(targetRad)).toFixed(3)),
    y: Number((fixedPoint.y + lengthM * Math.sin(targetRad)).toFixed(3))
  };

  return { snappedPoint, angleDeg: bestAngle, lengthM: Number(lengthM.toFixed(3)) };
}

/**
 * Calcula la proyección ortogonal perpendicular a un muro receptor (empalme en "T" deslizante).
 */
export function calculateWallSlideSnap(
  point: Vector2D,
  walls: Wall[],
  vertices: Map<string, WallVertex>,
  excludeWallId?: string,
  toleranceM: number = CAD_SNAP_CONFIG.WALL_SLIDE_TOLERANCE_M
): { snappedPoint: Vector2D; wall: Wall; guide: GuideLine } | null {
  let bestResult: { snappedPoint: Vector2D; wall: Wall; guide: GuideLine } | null = null;
  let minPerpDist = toleranceM;

  for (const wall of walls) {
    if (excludeWallId && wall.id === excludeWallId) continue;
    const vStart = vertices.get(wall.startVertexId);
    const vEnd = vertices.get(wall.endVertexId);
    if (!vStart || !vEnd) continue;

    const wx = vEnd.x - vStart.x;
    const wy = vEnd.y - vStart.y;
    const wallLen = Math.hypot(wx, wy);
    if (wallLen < 0.10) continue;

    const ux = wx / wallLen;
    const uy = wy / wallLen;

    const px = point.x - vStart.x;
    const py = point.y - vStart.y;
    const t = px * ux + py * uy;

    // Solo snap si la proyección cae dentro del cuerpo longitudinal del muro
    if (t < -0.05 || t > wallLen + 0.05) continue;

    const clampedT = Math.max(0, Math.min(wallLen, t));
    const projX = vStart.x + clampedT * ux;
    const projY = vStart.y + clampedT * uy;

    const perpDist = Math.hypot(point.x - projX, point.y - projY);
    if (perpDist <= minPerpDist) {
      minPerpDist = perpDist;
      bestResult = {
        snappedPoint: { x: Number(projX.toFixed(3)), y: Number(projY.toFixed(3)) },
        wall,
        guide: {
          type: 'wall_axis',
          from: { x: vStart.x, y: vStart.y },
          to: { x: vEnd.x, y: vEnd.y },
          label: `Empalme en T · ${wall.description || 'Muro'}`,
          referenceWallId: wall.id
        }
      };
    }
  }

  return bestResult;
}

/**
 * Calcula guías inteligentes de alineación X o Y (Smart Guides) con otros vértices del nivel.
 */
export function calculateSmartGuides(
  point: Vector2D,
  vertices: WallVertex[],
  excludeVertexIds: Set<string>,
  toleranceM: number = CAD_SNAP_CONFIG.ALIGN_TOLERANCE_M
): { snappedPoint: Vector2D; guides: GuideLine[] } {
  let snappedX = point.x;
  let snappedY = point.y;
  const guides: GuideLine[] = [];

  let minDiffX = toleranceM;
  let minDiffY = toleranceM;
  let bestVertX: WallVertex | null = null;
  let bestVertY: WallVertex | null = null;

  for (const v of vertices) {
    if (excludeVertexIds.has(v.id)) continue;

    const diffX = Math.abs(point.x - v.x);
    if (diffX <= minDiffX) {
      minDiffX = diffX;
      bestVertX = v;
    }

    const diffY = Math.abs(point.y - v.y);
    if (diffY <= minDiffY) {
      minDiffY = diffY;
      bestVertY = v;
    }
  }

  if (bestVertX) {
    snappedX = bestVertX.x;
    guides.push({
      type: 'x_align',
      from: { x: bestVertX.x, y: Math.min(point.y, bestVertX.y) - 1.0 },
      to: { x: bestVertX.x, y: Math.max(point.y, bestVertX.y) + 1.0 },
      label: 'Alineación Vertical',
      referenceVertexId: bestVertX.id
    });
  }

  if (bestVertY) {
    snappedY = bestVertY.y;
    guides.push({
      type: 'y_align',
      from: { x: Math.min(point.x, bestVertY.x) - 1.0, y: bestVertY.y },
      to: { x: Math.max(point.x, bestVertY.x) + 1.0, y: bestVertY.y },
      label: 'Alineación Horizontal',
      referenceVertexId: bestVertY.id
    });
  }

  return {
    snappedPoint: { x: Number(snappedX.toFixed(3)), y: Number(snappedY.toFixed(3)) },
    guides
  };
}

/**
 * Orquestador principal de Snap para arrastre de extremos de muro.
 * Evalúa las capas magnéticas por orden de prioridad estricto.
 */
export function findWallDragSnap(params: {
  point: Vector2D;
  fixedPoint: Vector2D;
  draggedWallId: string;
  draggedVertexId: string;
  allWalls: Wall[];
  allVertices: WallVertex[];
  options?: WallSnapOptions;
}): WallSnapResult {
  const {
    point,
    fixedPoint,
    draggedWallId,
    draggedVertexId,
    allWalls,
    allVertices,
    options = {}
  } = params;

  const vertexToleranceM = options.vertexToleranceM ?? CAD_SNAP_CONFIG.VERTEX_TOLERANCE_M;
  const wallSlideToleranceM = options.wallSlideToleranceM ?? CAD_SNAP_CONFIG.WALL_SLIDE_TOLERANCE_M;
  const alignToleranceM = options.alignToleranceM ?? CAD_SNAP_CONFIG.ALIGN_TOLERANCE_M;
  const angleToleranceDeg = options.angleToleranceDeg ?? CAD_SNAP_CONFIG.ANGLE_TOLERANCE_DEG;
  const enableGrid = options.enableGrid ?? false;
  const gridStepM = options.gridStepM ?? CAD_SNAP_CONFIG.GRID_STEP_M;

  const verticesMap = new Map(allVertices.map((v) => [v.id, v]));
  const excludeVertexIds = new Set<string>([draggedVertexId]);

  // 1. PRIORIDAD MÁXIMA: Snap a Vértice Existente (Fusión de Esquinas)
  let closestVertex: WallVertex | null = null;
  let minVertDist = vertexToleranceM;

  for (const v of allVertices) {
    if (v.id === draggedVertexId) continue;
    const dist = Math.hypot(point.x - v.x, point.y - v.y);
    if (dist <= minVertDist) {
      minVertDist = dist;
      closestVertex = v;
    }
  }

  if (closestVertex) {
    const dx = closestVertex.x - fixedPoint.x;
    const dy = closestVertex.y - fixedPoint.y;
    const lengthM = Number(Math.hypot(dx, dy).toFixed(3));
    const angleDeg = Number(normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));

    return {
      snappedPoint: { x: closestVertex.x, y: closestVertex.y },
      targetType: 'vertex',
      targetVertexId: closestVertex.id,
      lengthM,
      angleDeg,
      guides: []
    };
  }

  // 2. PRIORIDAD 2: Deslizamiento sobre Muro Receptor (Empalme en "T")
  const wallSlide = calculateWallSlideSnap(
    point,
    allWalls,
    verticesMap,
    draggedWallId,
    wallSlideToleranceM
  );

  if (wallSlide) {
    const dx = wallSlide.snappedPoint.x - fixedPoint.x;
    const dy = wallSlide.snappedPoint.y - fixedPoint.y;
    const lengthM = Number(Math.hypot(dx, dy).toFixed(3));
    const angleDeg = Number(normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));

    return {
      snappedPoint: wallSlide.snappedPoint,
      targetType: 'wall_slide',
      targetWallId: wallSlide.wall.id,
      lengthM,
      angleDeg,
      guides: [wallSlide.guide]
    };
  }

  // 3. PRIORIDAD 3: Guías Inteligentes X / Y (Smart Guides de Alineación)
  const smartGuides = calculateSmartGuides(point, allVertices, excludeVertexIds, alignToleranceM);
  if (smartGuides.guides.length > 0) {
    const dx = smartGuides.snappedPoint.x - fixedPoint.x;
    const dy = smartGuides.snappedPoint.y - fixedPoint.y;
    const lengthM = Number(Math.hypot(dx, dy).toFixed(3));
    const angleDeg = Number(normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));

    return {
      snappedPoint: smartGuides.snappedPoint,
      targetType: 'smart_guide',
      lengthM,
      angleDeg,
      guides: smartGuides.guides
    };
  }

  // 4. PRIORIDAD 4: Tracking Polar a Ángulos Notables (0°, 45°, 90°, etc.)
  const polar = calculatePolarAngleSnap(point, fixedPoint, angleToleranceDeg);
  if (polar) {
    return {
      snappedPoint: polar.snappedPoint,
      targetType: 'polar_angle',
      angleDeg: polar.angleDeg,
      lengthM: polar.lengthM,
      guides: [
        {
          type: 'polar_ray',
          from: fixedPoint,
          to: polar.snappedPoint,
          label: `${polar.angleDeg}°`
        }
      ]
    };
  }

  // 5. PRIORIDAD 5: Snap a Grilla CAD (si está habilitado)
  if (enableGrid && gridStepM > 0) {
    const gx = Math.round(point.x / gridStepM) * gridStepM;
    const gy = Math.round(point.y / gridStepM) * gridStepM;
    const dx = gx - fixedPoint.x;
    const dy = gy - fixedPoint.y;
    const lengthM = Number(Math.hypot(dx, dy).toFixed(3));
    const angleDeg = Number(normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));

    return {
      snappedPoint: { x: Number(gx.toFixed(3)), y: Number(gy.toFixed(3)) },
      targetType: 'grid',
      lengthM,
      angleDeg,
      guides: []
    };
  }

  // 6. Sin Snap: movimiento libre
  const dx = point.x - fixedPoint.x;
  const dy = point.y - fixedPoint.y;
  const lengthM = Number(Math.hypot(dx, dy).toFixed(3));
  const angleDeg = Number(normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));

  return {
    snappedPoint: { x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) },
    targetType: 'none',
    lengthM,
    angleDeg,
    guides: []
  };
}

/**
 * Ajusta la posición de aberturas de un muro cuando este cambia de longitud por arrastre.
 * Preserva la distancia física fija respecto a la esquina que NO se movió.
 */
export function adjustOpeningOnWallResize(params: {
  opening: Opening;
  draggedEnd: 'start' | 'end';
  oldLength: number;
  newLength: number;
}): number {
  const { opening, draggedEnd, oldLength, newLength } = params;
  const maxAllowedDist = Math.max(0, newLength - opening.width);

  if (draggedEnd === 'end') {
    // El inicio del muro (vStart) quedó fijo: distanceAlongWall se preserva tal cual
    return Math.max(0, Math.min(maxAllowedDist, opening.distanceAlongWall));
  } else {
    // El fin del muro (vEnd) quedó fijo: preservamos la distancia respecto al extremo final
    const distFromEnd = oldLength - (opening.distanceAlongWall + opening.width);
    const newDistFromStart = newLength - distFromEnd - opening.width;
    return Math.max(0, Math.min(maxAllowedDist, Number(newDistFromStart.toFixed(3))));
  }
}
