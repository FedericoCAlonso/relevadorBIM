/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: SpaceOrthogonalResize.ts
 * Responsabilidad Única (SRP):
 * Cálculo de cotas principales ortogonales (Ancho x Largo) de un ambiente
 * cerrado y redimensionamiento paramétrico ortogonal preservando ángulos
 * rectos y rectangularidad topológica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from './BuildingProject';
import type { Space } from './Space';
import type { WallVertex } from './Wall';

export interface SpaceOrthogonalDimensions {
  widthM: number;
  lengthM: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calcula las dimensiones ortogonales principales (ancho en X y largo en Y)
 * de la envolvente de un ambiente arquitectónico.
 */
export function getSpaceOrthogonalDimensions(
  space: Space,
  projectOrVertices: BuildingProject | Map<string, WallVertex>
): SpaceOrthogonalDimensions {
  const verticesMap =
    projectOrVertices instanceof Map
      ? projectOrVertices
      : new Map(projectOrVertices.vertices.map((v) => [v.id, v]));
  const points = (space.boundaryVertexIds || [])
    .map((id) => verticesMap.get(id))
    .filter((v): v is WallVertex => Boolean(v));

  if (points.length === 0) {
    return { widthM: 0, lengthM: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    widthM: Number((maxX - minX).toFixed(3)),
    lengthM: Number((maxY - minY).toFixed(3)),
    minX: Number(minX.toFixed(3)),
    maxX: Number(maxX.toFixed(3)),
    minY: Number(minY.toFixed(3)),
    maxY: Number(maxY.toFixed(3))
  };
}

/**
 * Redimensiona un ambiente ortogonalmente a lo largo de un eje ('width' en X o 'length' en Y),
 * desplazando rígidamente la pared perpendicular seleccionada y extendiendo los muros laterales
 * para mantener el recinto cerrado, ortogonal y rectangular sin deformar esquinas.
 */
export function resizeSpaceOrthogonal(params: {
  spaceId: string;
  project: BuildingProject;
  axis: 'width' | 'length';
  newDimensionM: number;
  direction?: 'positive' | 'negative' | 'center';
}): BuildingProject {
  const { spaceId, project, axis, newDimensionM, direction = 'positive' } = params;
  if (newDimensionM <= 0) return project;

  const space = project.spaces.find((s) => s.id === spaceId);
  if (!space || !space.boundaryVertexIds || space.boundaryVertexIds.length === 0) {
    return project;
  }

  const dims = getSpaceOrthogonalDimensions(space, project);
  const currentDim = axis === 'width' ? dims.widthM : dims.lengthM;
  if (currentDim <= 0) return project;

  const delta = newDimensionM - currentDim;
  if (Math.abs(delta) < 0.001) return project;

  const verticesMap = new Map(project.vertices.map((v) => [v.id, { ...v }]));
  const TOLERANCE = 0.05; // Margen de 5 cm para agrupar vértices alineados en la arista

  if (axis === 'width') {
    // Eje X: Ancho del ambiente
    if (direction === 'positive') {
      // Extremo derecho (+X / Este): desplaza hacia la derecha
      for (const vId of space.boundaryVertexIds) {
        const v = verticesMap.get(vId);
        if (v && Math.abs(v.x - dims.maxX) <= TOLERANCE) {
          v.x = Number((v.x + delta).toFixed(3));
        }
      }
    } else if (direction === 'negative') {
      // Extremo izquierdo (-X / Oeste): desplaza hacia la izquierda
      for (const vId of space.boundaryVertexIds) {
        const v = verticesMap.get(vId);
        if (v && Math.abs(v.x - dims.minX) <= TOLERANCE) {
          v.x = Number((v.x - delta).toFixed(3));
        }
      }
    } else if (direction === 'center') {
      // Expansión simétrica desde el centro (+ y - delta/2)
      const halfDelta = delta / 2;
      for (const vId of space.boundaryVertexIds) {
        const v = verticesMap.get(vId);
        if (v) {
          if (Math.abs(v.x - dims.maxX) <= TOLERANCE) {
            v.x = Number((v.x + halfDelta).toFixed(3));
          } else if (Math.abs(v.x - dims.minX) <= TOLERANCE) {
            v.x = Number((v.x - halfDelta).toFixed(3));
          }
        }
      }
    }
  } else {
    // Eje Y: Largo del ambiente
    if (direction === 'positive') {
      // Extremo inferior (+Y / Sur): desplaza hacia abajo
      for (const vId of space.boundaryVertexIds) {
        const v = verticesMap.get(vId);
        if (v && Math.abs(v.y - dims.maxY) <= TOLERANCE) {
          v.y = Number((v.y + delta).toFixed(3));
        }
      }
    } else if (direction === 'negative') {
      // Extremo superior (-Y / Norte): desplaza hacia arriba
      for (const vId of space.boundaryVertexIds) {
        const v = verticesMap.get(vId);
        if (v && Math.abs(v.y - dims.minY) <= TOLERANCE) {
          v.y = Number((v.y - delta).toFixed(3));
        }
      }
    } else if (direction === 'center') {
      // Expansión simétrica desde el centro (+ y - delta/2)
      const halfDelta = delta / 2;
      for (const vId of space.boundaryVertexIds) {
        const v = verticesMap.get(vId);
        if (v) {
          if (Math.abs(v.y - dims.maxY) <= TOLERANCE) {
            v.y = Number((v.y + halfDelta).toFixed(3));
          } else if (Math.abs(v.y - dims.minY) <= TOLERANCE) {
            v.y = Number((v.y - halfDelta).toFixed(3));
          }
        }
      }
    }
  }

  const updatedVertices = project.vertices.map((v) => {
    const mod = verticesMap.get(v.id);
    return mod ? { ...v, x: mod.x, y: mod.y } : v;
  });

  return {
    ...project,
    vertices: updatedVertices,
    meta: { ...project.meta, updatedAt: Date.now() }
  };
}
