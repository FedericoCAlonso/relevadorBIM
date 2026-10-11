/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: WallSplitEngine.ts
 * Responsabilidad Única:
 * Motor geométrico y topológico puro para partición colineal de muros
 * existentes con inserción de vértices intermedios, redistribución de
 * aberturas y actualización del grafo planar del edificio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from './BuildingProject';
import type { Wall, WallVertex } from './Wall';
import type { Opening } from './Opening';
import type { Space } from './Space';

export interface SplitWallResult {
  project: BuildingProject;
  splitVertexId: string;
  wall1: Wall;
  wall2: Wall;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Divide un muro en dos tramos colineales a una distancia métrica especificada
 * desde uno de sus vértices extremos.
 */
export function splitWallAtDistance(params: {
  hostWallId: string;
  distanceM: number;
  fromVertexId: string;
  project: BuildingProject;
}): SplitWallResult | null {
  const { hostWallId, distanceM, fromVertexId, project } = params;

  const hostWall = project.walls.find((w) => w.id === hostWallId);
  if (!hostWall) return null;

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const vStart = verticesMap.get(hostWall.startVertexId);
  const vEnd = verticesMap.get(hostWall.endVertexId);
  if (!vStart || !vEnd) return null;

  const wallLen = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
  if (wallLen <= 0.10) return null;

  // Tolerancia mínima respecto a los extremos (no partir a menos de 5cm de las esquinas)
  if (distanceM <= 0.04 || distanceM >= wallLen - 0.04) {
    return null;
  }

  // Vector unitario del muro (desde start hacia end)
  const dirX = (vEnd.x - vStart.x) / wallLen;
  const dirY = (vEnd.y - vStart.y) / wallLen;

  // Determinar la distancia offset real desde vStart
  let offsetFromStart = 0;
  if (fromVertexId === hostWall.startVertexId) {
    offsetFromStart = distanceM;
  } else if (fromVertexId === hostWall.endVertexId) {
    offsetFromStart = wallLen - distanceM;
  } else {
    return null;
  }

  const splitX = Number((vStart.x + dirX * offsetFromStart).toFixed(3));
  const splitY = Number((vStart.y + dirY * offsetFromStart).toFixed(3));

  // Buscar si ya existe un vértice coincidente dentro de 1.5 cm
  const existingVertex = project.vertices.find(
    (v) => Math.hypot(v.x - splitX, v.y - splitY) <= 0.015
  );

  let splitVertexId: string;
  let newVertices = [...project.vertices];

  if (existingVertex) {
    splitVertexId = existingVertex.id;
  } else {
    const newVertex: WallVertex = {
      id: generateId('v-split'),
      x: splitX,
      y: splitY
    };
    splitVertexId = newVertex.id;
    newVertices.push(newVertex);
  }

  const wall1Id = generateId('w');
  const wall2Id = generateId('w');

  const wall1: Wall = {
    ...hostWall,
    id: wall1Id,
    startVertexId: hostWall.startVertexId,
    endVertexId: splitVertexId
  };

  const wall2: Wall = {
    ...hostWall,
    id: wall2Id,
    startVertexId: splitVertexId,
    endVertexId: hostWall.endVertexId
  };

  // Reemplazar hostWall con wall1 y wall2 en la lista de muros
  const updatedWalls = project.walls
    .filter((w) => w.id !== hostWallId)
    .concat([wall1, wall2]);

  // Redistribuir aberturas asociadas al hostWall
  const updatedOpenings: Opening[] = project.openings.map((op) => {
    if (op.wallId !== hostWallId) return op;

    const opStart = op.distanceAlongWall;
    const opEnd = op.distanceAlongWall + op.width;

    // Si la abertura está antes del split point
    if (opEnd <= offsetFromStart + 0.02) {
      return { ...op, wallId: wall1Id };
    }
    // Si la abertura está después del split point
    if (opStart >= offsetFromStart - 0.02) {
      return {
        ...op,
        wallId: wall2Id,
        distanceAlongWall: Number(Math.max(0, opStart - offsetFromStart).toFixed(3))
      };
    }
    // Si la abertura queda a caballo, asignarla al tramo con mayor cobertura
    const overlap1 = offsetFromStart - opStart;
    const overlap2 = opEnd - offsetFromStart;
    if (overlap1 >= overlap2) {
      return { ...op, wallId: wall1Id };
    } else {
      return {
        ...op,
        wallId: wall2Id,
        distanceAlongWall: 0
      };
    }
  });

  // Actualizar espacios que contenían a hostWallId
  const updatedSpaces: Space[] = project.spaces.map((sp) => {
    if (!sp.wallIds.includes(hostWallId)) return sp;

    // Sustituir el wallId por los dos nuevos tramos
    const hostIdx = sp.wallIds.indexOf(hostWallId);
    const newWallIds = [...sp.wallIds];
    newWallIds.splice(hostIdx, 1, wall1Id, wall2Id);

    // Insertar el nuevo splitVertexId en la lista boundaryVertexIds
    const newBoundaryVertexIds = [...sp.boundaryVertexIds];
    const sIdx = newBoundaryVertexIds.indexOf(hostWall.startVertexId);
    const eIdx = newBoundaryVertexIds.indexOf(hostWall.endVertexId);

    if (sIdx !== -1 && eIdx !== -1) {
      // Si son consecutivos (considerando ciclo)
      const count = newBoundaryVertexIds.length;
      if ((sIdx + 1) % count === eIdx) {
        newBoundaryVertexIds.splice(eIdx, 0, splitVertexId);
      } else if ((eIdx + 1) % count === sIdx) {
        newBoundaryVertexIds.splice(sIdx, 0, splitVertexId);
      } else {
        // Inserción en caso genérico
        newBoundaryVertexIds.splice(Math.max(sIdx, eIdx), 0, splitVertexId);
      }
    }

    return {
      ...sp,
      wallIds: newWallIds,
      boundaryVertexIds: newBoundaryVertexIds
    };
  });

  const updatedProject: BuildingProject = {
    ...project,
    vertices: newVertices,
    walls: updatedWalls,
    openings: updatedOpenings,
    spaces: updatedSpaces,
    meta: { ...project.meta, updatedAt: Date.now() }
  };

  return {
    project: updatedProject,
    splitVertexId,
    wall1,
    wall2
  };
}
