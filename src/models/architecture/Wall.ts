/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Wall.ts
 * Entidad de Muro Físico y Vértices de Edificio (BIM 2D).
 * Las paredes pertenecen al edificio, conectan vértices compartidos y
 * poseen espesor físico paramétrico y dos caras (izquierda/derecha).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface WallVertex {
  id: string;
  x: number; // Coordenada X en metros en el plano global del edificio
  y: number; // Coordenada Y en metros en el plano global del edificio
}

export interface WallFaceReference {
  wallId: string;
  face: 'left' | 'right';
  startOffset: number; // Distancia desde el vértice de inicio en metros
  endOffset: number;   // Distancia hasta donde se extiende este tramo
}

export interface Wall {
  id: string;
  levelId: string;           // ID del nivel/planta al que pertenece
  startVertexId: string;     // ID del vértice inicial
  endVertexId: string;       // ID del vértice final
  thickness: number;         // Espesor del muro en metros (ej: 0.10, 0.15, 0.20, 0.30)
  height: number;            // Altura libre en metros (default: 2.80)
  leftSpaceId?: string | null;  // ID del ambiente que da a la cara izquierda
  rightSpaceId?: string | null; // ID del ambiente que da a la cara derecha
  isBearing?: boolean;       // ¿Es muro portante / medianera?
  description?: string;
}

/** Vector 2D en metros */
export interface Vector2D {
  x: number;
  y: number;
}

/** Segmento 2D definido por dos puntos */
export interface Segment2D {
  start: Vector2D;
  end: Vector2D;
}

// ─── UTILIDADES GEOMÉTRICAS PURAS DE MUROS ─────────────────────────────────

/**
 * Obtiene el vector director de un muro desde start hasta end.
 */
export function getWallVector(wall: Wall, vertices: Map<string, WallVertex>): Vector2D {
  const vStart = vertices.get(wall.startVertexId);
  const vEnd = vertices.get(wall.endVertexId);
  if (!vStart || !vEnd) return { x: 0, y: 0 };
  return { x: vEnd.x - vStart.x, y: vEnd.y - vStart.y };
}

/**
 * Calcula la longitud geométrica del eje del muro en metros.
 */
export function getWallLength(wall: Wall, vertices: Map<string, WallVertex>): number {
  const vec = getWallVector(wall, vertices);
  return Math.hypot(vec.x, vec.y);
}

/**
 * Calcula el ángulo del muro en radianes con respecto al eje X positivo.
 */
export function getWallAngleRad(wall: Wall, vertices: Map<string, WallVertex>): number {
  const vec = getWallVector(wall, vertices);
  return Math.atan2(vec.y, vec.x);
}

/**
 * Calcula el ángulo del muro en grados [0, 360).
 */
export function getWallAngleDeg(wall: Wall, vertices: Map<string, WallVertex>): number {
  let deg = (getWallAngleRad(wall, vertices) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * Calcula el vector unitario normal a la izquierda del muro.
 */
export function getWallLeftNormal(wall: Wall, vertices: Map<string, WallVertex>): Vector2D {
  const len = getWallLength(wall, vertices);
  if (len === 0) return { x: 0, y: 1 };
  const vec = getWallVector(wall, vertices);
  // Rotación de 90° antihoraria: (-y/len, x/len)
  return { x: -vec.y / len, y: vec.x / len };
}

/**
 * Obtiene las dos caras físicas interiores/exteriores del muro offseteadas por la mitad del espesor.
 */
export function getWallFaces(
  wall: Wall,
  vertices: Map<string, WallVertex>
): { leftFace: Segment2D; rightFace: Segment2D } | null {
  const vStart = vertices.get(wall.startVertexId);
  const vEnd = vertices.get(wall.endVertexId);
  if (!vStart || !vEnd) return null;

  const normal = getWallLeftNormal(wall, vertices);
  const halfT = wall.thickness / 2;

  const offsetX = normal.x * halfT;
  const offsetY = normal.y * halfT;

  return {
    leftFace: {
      start: { x: vStart.x + offsetX, y: vStart.y + offsetY },
      end: { x: vEnd.x + offsetX, y: vEnd.y + offsetY }
    },
    rightFace: {
      start: { x: vStart.x - offsetX, y: vStart.y - offsetY },
      end: { x: vEnd.x - offsetX, y: vEnd.y - offsetY }
    }
  };
}

/**
 * Obtiene el polígono de 4 vértices que representa el cuerpo con espesor del muro en 2D.
 */
export function getWallPolygon(wall: Wall, vertices: Map<string, WallVertex>): Vector2D[] | null {
  const faces = getWallFaces(wall, vertices);
  if (!faces) return null;

  // Recorrido horario/antihorario de las 4 esquinas del muro
  return [
    faces.leftFace.start,
    faces.leftFace.end,
    faces.rightFace.end,
    faces.rightFace.start
  ];
}
