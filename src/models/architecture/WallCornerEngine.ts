/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: WallCornerEngine.ts (CAD Corner Topology & Miter Joins)
 * Motor geométrico puro para la resolución de encuentros en esquina de muros.
 * Resuelve los ingletes (miter joins) alargando las caras exteriores y
 * recortando las caras interiores para eliminar huecos y solapamientos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D, Wall, WallVertex } from './Wall';
import { getWallFaces, getWallLength, getWallVector } from './Wall';

/**
 * Calcula la intersección analítica 2D de dos rectas infinitas dadas por un punto y un vector director.
 * Line 1: P1 + t * D1
 * Line 2: P2 + s * D2
 */
export function intersectLines2D(
  p1: Vector2D,
  d1: Vector2D,
  p2: Vector2D,
  d2: Vector2D
): Vector2D | null {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-6) {
    return null; // Líneas paralelas o colineales
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / det;

  return {
    x: Number((p1.x + t * d1.x).toFixed(4)),
    y: Number((p1.y + t * d1.y).toFixed(4))
  };
}

interface IncidentWallInfo {
  wall: Wall;
  isStart: boolean; // true si el vértice analizado es startVertexId
  outwardUnit: Vector2D; // Vector unitario apuntando fuera del vértice analizado
  outwardLeftPt: Vector2D; // Punto de la cara izquierda respecto a la dirección outward
  outwardRightPt: Vector2D; // Punto de la cara derecha respecto a la dirección outward
}

/**
 * Resuelve las esquinas de todos los muros de un nivel calculando los polígonos
 * cerrados resultantes con remates en inglete exactos.
 */
export function computeResolvedWallPolygons(
  walls: Wall[],
  vertices: Map<string, WallVertex>
): Map<string, Vector2D[]> {
  const result = new Map<string, Vector2D[]>();

  // Mapa de vértices finales provisionales para cada muro:
  // wallId -> { leftStart, leftEnd, rightEnd, rightStart }
  const wallCorners = new Map<
    string,
    {
      leftStart: Vector2D;
      leftEnd: Vector2D;
      rightEnd: Vector2D;
      rightStart: Vector2D;
    }
  >();

  // 1. Inicializar con los puntos de caras por defecto (cortes perpendiculares)
  for (const wall of walls) {
    const faces = getWallFaces(wall, vertices);
    if (!faces) continue;

    wallCorners.set(wall.id, {
      leftStart: { ...faces.leftFace.start },
      leftEnd: { ...faces.leftFace.end },
      rightEnd: { ...faces.rightFace.end },
      rightStart: { ...faces.rightFace.start }
    });
  }

  // 2. Construir mapa de adyacencia de vértices: vertexId -> muros incidentes
  const vertexToWalls = new Map<string, Wall[]>();
  for (const wall of walls) {
    if (!vertexToWalls.has(wall.startVertexId)) vertexToWalls.set(wall.startVertexId, []);
    if (!vertexToWalls.has(wall.endVertexId)) vertexToWalls.set(wall.endVertexId, []);

    vertexToWalls.get(wall.startVertexId)!.push(wall);
    vertexToWalls.get(wall.endVertexId)!.push(wall);
  }

  // 3. Procesar cada vértice del grafo
  for (const [vertexId, incidentWalls] of vertexToWalls.entries()) {
    const vCenter = vertices.get(vertexId);
    if (!vCenter) continue;

    // Solo resolvemos esquinas en L de 2 muros (encuentros convencionales)
    if (incidentWalls.length === 2) {
      const [wA, wB] = incidentWalls;
      const cornerA = wallCorners.get(wA.id);
      const cornerB = wallCorners.get(wB.id);
      if (!cornerA || !cornerB) continue;

      const infoA = getIncidentInfo(wA, vertexId, vertices);
      const infoB = getIncidentInfo(wB, vertexId, vertices);
      if (!infoA || !infoB) continue;

      const cross = infoA.outwardUnit.x * infoB.outwardUnit.y - infoA.outwardUnit.y * infoB.outwardUnit.x;

      // Si no son colineales (hay un ángulo real de esquina)
      if (Math.abs(cross) > 1e-4) {
        let ptOutLeftA_OutRightB: Vector2D | null = null;
        let ptOutRightA_OutLeftB: Vector2D | null = null;

        // Intersección de la recta OutwardLeft de A con OutwardRight de B
        ptOutLeftA_OutRightB = intersectLines2D(
          infoA.outwardLeftPt,
          infoA.outwardUnit,
          infoB.outwardRightPt,
          infoB.outwardUnit
        );

        // Intersección de la recta OutwardRight de A con OutwardLeft de B
        ptOutRightA_OutLeftB = intersectLines2D(
          infoA.outwardRightPt,
          infoA.outwardUnit,
          infoB.outwardLeftPt,
          infoB.outwardUnit
        );

        // Limitar miter extremo en ángulos ultra agudos (miter limit = 4x espesor máximo)
        const maxThickness = Math.max(wA.thickness, wB.thickness);
        const miterLimit = maxThickness * 4;

        if (ptOutLeftA_OutRightB && Math.hypot(ptOutLeftA_OutRightB.x - vCenter.x, ptOutLeftA_OutRightB.y - vCenter.y) < miterLimit) {
          applyMiterPoint(cornerA, infoA.isStart, 'left', ptOutLeftA_OutRightB);
          applyMiterPoint(cornerB, infoB.isStart, 'right', ptOutLeftA_OutRightB);
        }

        if (ptOutRightA_OutLeftB && Math.hypot(ptOutRightA_OutLeftB.x - vCenter.x, ptOutRightA_OutLeftB.y - vCenter.y) < miterLimit) {
          applyMiterPoint(cornerA, infoA.isStart, 'right', ptOutRightA_OutLeftB);
          applyMiterPoint(cornerB, infoB.isStart, 'left', ptOutRightA_OutLeftB);
        }
      }
    }
  }

  // 4. Construir los polígonos finales de 4 vértices
  for (const [wallId, corners] of wallCorners.entries()) {
    result.set(wallId, [
      corners.leftStart,
      corners.leftEnd,
      corners.rightEnd,
      corners.rightStart
    ]);
  }

  return result;
}

/**
 * Resuelve el polígono de un muro particular en el contexto de sus muros vecinos.
 */
export function getResolvedWallPolygon(
  wall: Wall,
  allWalls: Wall[],
  vertices: Map<string, WallVertex>
): Vector2D[] | null {
  const map = computeResolvedWallPolygons(allWalls, vertices);
  return map.get(wall.id) || null;
}

/**
 * Extrae la información geométrica de un muro con respecto a un vértice incidente.
 */
function getIncidentInfo(
  wall: Wall,
  vertexId: string,
  vertices: Map<string, WallVertex>
): IncidentWallInfo | null {
  const isStart = wall.startVertexId === vertexId;
  const len = getWallLength(wall, vertices);
  if (len < 0.001) return null;

  const vec = getWallVector(wall, vertices);
  const faces = getWallFaces(wall, vertices);
  if (!faces) return null;

  if (isStart) {
    // Vector saliendo del startVertex hacia endVertex
    const outwardUnit: Vector2D = { x: vec.x / len, y: vec.y / len };
    return {
      wall,
      isStart: true,
      outwardUnit,
      outwardLeftPt: { ...faces.leftFace.start },
      outwardRightPt: { ...faces.rightFace.start }
    };
  } else {
    // Vector saliendo del endVertex hacia startVertex
    const outwardUnit: Vector2D = { x: -vec.x / len, y: -vec.y / len };
    // Cuando miramos desde end hacia start (hacia atrás):
    // A la izquierda de la dirección de retroceso está la cara derecha del muro.
    // A la derecha de la dirección de retroceso está la cara izquierda del muro.
    return {
      wall,
      isStart: false,
      outwardUnit,
      outwardLeftPt: { ...faces.rightFace.end },
      outwardRightPt: { ...faces.leftFace.end }
    };
  }
}

/**
 * Asigna el punto de inglete al vértice correspondiente de la cara del muro.
 */
function applyMiterPoint(
  corner: {
    leftStart: Vector2D;
    leftEnd: Vector2D;
    rightEnd: Vector2D;
    rightStart: Vector2D;
  },
  isStart: boolean,
  outwardSide: 'left' | 'right',
  point: Vector2D
): void {
  if (isStart) {
    if (outwardSide === 'left') {
      corner.leftStart = { ...point };
    } else {
      corner.rightStart = { ...point };
    }
  } else {
    // Si es el extremo final (end):
    // La cara outward-left corresponde a la cara derecha del muro original.
    // La cara outward-right corresponde a la cara izquierda del muro original.
    if (outwardSide === 'left') {
      corner.rightEnd = { ...point };
    } else {
      corner.leftEnd = { ...point };
    }
  }
}
