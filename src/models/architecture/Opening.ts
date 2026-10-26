/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Opening.ts
 * Aberturas Hospedadas (Puertas, Ventanas, Vanos).
 * Perforan el muro anfitrión y proveen jambas físicas para el rebote de láser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Wall, WallVertex, Vector2D } from './Wall';
import { getWallVector, getWallLength, getWallLeftNormal, getWallSideOffsets } from './Wall';

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
  presetId?: string;           // ID del preset / plantilla de carpintería aplicada si aplica
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
  const { leftOffset, rightOffset } = getWallSideOffsets(wall);

  return {
    leftJamb1: { x: jambs.jamb1.x + normal.x * leftOffset, y: jambs.jamb1.y + normal.y * leftOffset },
    leftJamb2: { x: jambs.jamb2.x + normal.x * leftOffset, y: jambs.jamb2.y + normal.y * leftOffset },
    rightJamb1: { x: jambs.jamb1.x + normal.x * rightOffset, y: jambs.jamb1.y + normal.y * rightOffset },
    rightJamb2: { x: jambs.jamb2.x + normal.x * rightOffset, y: jambs.jamb2.y + normal.y * rightOffset }
  };
}

/** Geometría local (unidades del llamador) de la hoja y el arco de una puerta batiente. */
export interface DoorSwingGeometry {
  hingeX: number;
  hingeY: number;
  leafY: number;
  sweep: 0 | 1;
  arcPath: string;
}

/**
 * Calcula bisagra, extremo de hoja y arco de barrido de una puerta en el sistema local de la abertura
 * (origen en la jamba 1, eje X a lo largo del muro).
 * La bisagra apoya sobre la cara hacia donde abre la puerta.
 */
export function getDoorSwingGeometry(
  swing: OpeningSwing,
  widthLocal: number,
  yLeftLocal: number,
  yRightLocal: number
): DoorSwingGeometry {
  const isLeft = swing.startsWith('left');
  const isIn = swing.endsWith('in');
  const hingeX = isLeft ? 0 : widthLocal;
  const targetX = isLeft ? widthLocal : 0;
  const hingeY = isIn ? yLeftLocal : yRightLocal;
  const leafY = isIn ? hingeY - widthLocal : hingeY + widthLocal;
  const sweep = swing === 'left_in' || swing === 'right_out' ? 1 : 0;
  const arcPath = `M ${hingeX} ${leafY} A ${widthLocal} ${widthLocal} 0 0 ${sweep} ${targetX} ${hingeY}`;
  return { hingeX, hingeY, leafY, sweep, arcPath };
}

/**
 * Invierte la mano de bisagra (izquierda <-> derecha) manteniendo el sentido interior/exterior.
 */
export function toggleOpeningHinge(swing: OpeningSwing = 'left_in'): OpeningSwing {
  if (swing === 'left_in') return 'right_in';
  if (swing === 'right_in') return 'left_in';
  if (swing === 'left_out') return 'right_out';
  if (swing === 'right_out') return 'left_out';
  return 'left_out';
}

/**
 * Invierte el sentido de apertura (adentro <-> afuera) manteniendo la mano de bisagra.
 */
export function toggleOpeningDirection(swing: OpeningSwing = 'left_in'): OpeningSwing {
  if (swing === 'left_in') return 'left_out';
  if (swing === 'left_out') return 'left_in';
  if (swing === 'right_in') return 'right_out';
  if (swing === 'right_out') return 'right_in';
  return 'right_in';
}
