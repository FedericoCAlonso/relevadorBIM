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

export interface WallPlacementSnap {
  wallId: string;
  wallOffset: number;
  rotationDeg: number;
  side: 'left' | 'right';
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

export interface WallSnapResult {
  wall: Wall;
  snappedPoint: Vector2D;
  distanceAlongWall: number;
  rotationDeg: number;
  side: 'left' | 'right';
}

/**
 * Realiza snap magnético de un punto 2D hacia la cara del muro más cercano,
 * calculando automáticamente la posición exacta sobre el paramento y el ángulo
 * de rotación para que el símbolo quede adosado y orientado hacia el ambiente.
 */
export function calculateWallSnap(
  point: Vector2D,
  walls: Wall[],
  vertices: Map<string, WallVertex>,
  snapToleranceM = 0.50
): WallSnapResult | null {
  let bestResult: WallSnapResult | null = null;
  let minDistance = snapToleranceM;

  for (const wall of walls) {
    const vStart = vertices.get(wall.startVertexId);
    const vEnd = vertices.get(wall.endVertexId);
    if (!vStart || !vEnd) continue;

    const dx = vEnd.x - vStart.x;
    const dy = vEnd.y - vStart.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.01) continue;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy; // Normal izquierda
    const ny = ux;

    const vx = point.x - vStart.x;
    const vy = point.y - vStart.y;

    // Proyección longitudinal a lo largo del muro
    const t = vx * ux + vy * uy;
    // Distancia perpendicular (con signo: >0 izquierda, <0 derecha)
    const distNormal = vx * nx + vy * ny;
    const absDist = Math.abs(distNormal);

    // Permitir snap si el cursor cae a lo largo del muro y dentro de la tolerancia
    if (t >= 0 && t <= len && absDist < minDistance) {
      minDistance = absDist;
      const side: 'left' | 'right' = distNormal >= 0 ? 'left' : 'right';
      const halfT = wall.thickness / 2;

      // Desplazar el punto snap a la superficie de la cara del muro
      const faceOffset = side === 'left' ? halfT : -halfT;
      const snappedX = vStart.x + ux * t + nx * faceOffset;
      const snappedY = vStart.y + uy * t + ny * faceOffset;

      // Ángulo del muro
      const wallAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
      // Para que el símbolo se oriente apoyado en la pared y proyectando hacia el ambiente (fuera del muro):
      let rotationDeg = side === 'left' ? wallAngleDeg + 180 : wallAngleDeg;
      rotationDeg = (rotationDeg % 360 + 360) % 360;

      bestResult = {
        wall,
        snappedPoint: { x: Number(snappedX.toFixed(3)), y: Number(snappedY.toFixed(3)) },
        distanceAlongWall: Number(t.toFixed(3)),
        rotationDeg: Number(rotationDeg.toFixed(1)),
        side
      };
    }
  }

  return bestResult;
}

