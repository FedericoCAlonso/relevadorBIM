/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Opening.ts
 * Aberturas Hospedadas (Puertas, Ventanas, Vanos).
 * Perforan el muro anfitrión y proveen jambas físicas para el rebote de láser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Wall, WallVertex, Vector2D } from './Wall';
import { getWallVector, getWallLength, getWallLeftNormal } from './Wall';

export type OpeningType = 'door' | 'window' | 'passage';

export type OpeningSwing = 'left_in' | 'right_in' | 'left_out' | 'right_out' | 'double' | 'sliding' | 'none';

export interface Opening {
  id: string;
  wallId: string;              // Muro anfitrión donde está alojada
  type: OpeningType;           // 'door' (puerta), 'window' (ventana), 'passage' (vano libre)
  width: number;               // Ancho libre del vano en metros (ej: 0.70, 0.80, 1.20)
  height: number;              // Altura en metros (default: 2.05 para puertas, 1.10 para ventanas)
  sill: number;                // Antepecho en metros (0.0 para puertas/vanos, 0.90 para ventanas)
  distanceAlongWall: number;   // Distancia métrica desde el StartVertex del muro hasta la 1ra jamba
  swing: OpeningSwing;         // Sentido de giro / batiente
  label?: string;              // Ej: "P1", "V2"
}

export interface JambPoint {
  id: string;
  x: number;
  y: number;
  face: 'left' | 'right' | 'center';
  jambIndex: 1 | 2; // 1 = jamba proximal al startVertex, 2 = jamba distal
}

/**
 * Calcula las coordenadas 2D exactas de las dos jambas del vano en el eje del muro.
 */
export function getOpeningJambs(
  opening: Opening,
  wall: Wall,
  vertices: Map<string, WallVertex>
): { jamb1: Vector2D; jamb2: Vector2D } | null {
  const vStart = vertices.get(wall.startVertexId);
  const wallLen = getWallLength(wall, vertices);
  if (!vStart || wallLen === 0) return null;

  const vec = getWallVector(wall, vertices);
  const unitX = vec.x / wallLen;
  const unitY = vec.y / wallLen;

  const d1 = opening.distanceAlongWall;
  const d2 = opening.distanceAlongWall + opening.width;

  return {
    jamb1: {
      x: vStart.x + unitX * d1,
      y: vStart.y + unitY * d1
    },
    jamb2: {
      x: vStart.x + unitX * d2,
      y: vStart.y + unitY * d2
    }
  };
}

/**
 * Obtiene los 4 puntos de las jambas en ambas caras (izquierda y derecha) para snapping de láser.
 */
export function getOpeningPhysicalJambs(
  opening: Opening,
  wall: Wall,
  vertices: Map<string, WallVertex>
): {
  leftJamb1: Vector2D;
  leftJamb2: Vector2D;
  rightJamb1: Vector2D;
  rightJamb2: Vector2D;
} | null {
  const jambs = getOpeningJambs(opening, wall, vertices);
  if (!jambs) return null;

  const normal = getWallLeftNormal(wall, vertices);
  const halfT = wall.thickness / 2;
  const offX = normal.x * halfT;
  const offY = normal.y * halfT;

  return {
    leftJamb1: { x: jambs.jamb1.x + offX, y: jambs.jamb1.y + offY },
    leftJamb2: { x: jambs.jamb2.x + offX, y: jambs.jamb2.y + offY },
    rightJamb1: { x: jambs.jamb1.x - offX, y: jambs.jamb1.y - offY },
    rightJamb2: { x: jambs.jamb2.x - offX, y: jambs.jamb2.y - offY }
  };
}
