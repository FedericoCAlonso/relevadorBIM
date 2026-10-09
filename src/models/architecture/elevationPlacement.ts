/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: elevationPlacement.ts — Responsabilidad Única:
 * Conversión pura de posiciones deseadas en el alzado de muro (X/Z) a datos
 * de emplazamiento bidimensionales y tridimensionales en planta para nuevas
 * bocas, cajas y tableros.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Wall, WallVertex } from './Wall';
import {
  getWallAxisFrame,
  screenXToAlongWall,
  type ElevationFace
} from './wallElevation';

export interface NewNodeElevationPlacement {
  x: number;
  y: number;
  wallOffset: number;
  heightZ: number;
  side: ElevationFace;
  rotationDeg: number;
}

export interface ComputeNewNodeElevationParams {
  wall: Wall;
  vertices: Map<string, WallVertex>;
  face: ElevationFace;
  targetX: number;
  targetZ: number;
  boxWidthM?: number;
  boxHeightM?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round3(n: number): number {
  return Number(n.toFixed(3));
}

/**
 * Convierte un punto de clic en el alzado (targetX visible, targetZ cota)
 * a las coordenadas de emplazamiento en el sistema de referencia del proyecto.
 */
export function computeNewNodeFromElevation(
  params: ComputeNewNodeElevationParams
): NewNodeElevationPlacement | null {
  const { wall, vertices, face, targetX, targetZ, boxWidthM = 0.10, boxHeightM = 0.10 } = params;
  const frame = getWallAxisFrame(wall, vertices);
  if (!frame) return null;

  const halfW = boxWidthM / 2;
  const halfH = boxHeightM / 2;

  const cx = clamp(targetX, halfW, frame.length - halfW);
  const cz = clamp(targetZ, halfH, wall.height - halfH);

  const u = screenXToAlongWall(cx, frame.length, face);

  // Separación perpendicular según la cara (normal izquierda es +v, derecha es -v)
  const halfThick = wall.thickness / 2;
  const v = face === 'left' ? halfThick : -halfThick;

  const wallAngleDeg = (Math.atan2(frame.uy, frame.ux) * 180) / Math.PI;
  let rotationDeg = face === 'left' ? wallAngleDeg + 180 : wallAngleDeg;
  rotationDeg = Math.round(((rotationDeg % 360) + 360) % 360);

  return {
    x: round3(frame.origin.x + frame.ux * u + frame.nx * v),
    y: round3(frame.origin.y + frame.uy * u + frame.ny * v),
    wallOffset: round3(u),
    heightZ: round3(cz),
    side: face,
    rotationDeg
  };
}
