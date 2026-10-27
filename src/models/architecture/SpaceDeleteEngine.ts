/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: SpaceDeleteEngine.ts
 * Responsabilidad Única:
 * Motor geométrico y topológico puro para la eliminación completa de un
 * ambiente (espacio arquitectónico) preservando irrestrictamente los muros
 * y vértices compartidos con recintos adyacentes ("no desarmar ambientes vecinos").
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from './BuildingProject';
import type { Space } from './Space';
import type { Wall } from './Wall';

export interface DeleteSpaceResult {
  project: BuildingProject;
  deletedWallIds: string[];
  preservedWallIds: string[];
  deletedVertexIds: string[];
}

/**
 * Determina si un muro está compartido con algún otro ambiente del proyecto.
 * Considera tanto la inclusión directa en `otherSpace.wallIds` como la
 * pertenencia topológica consecutiva en el perímetro `boundaryVertexIds`.
 */
export function isWallSharedWithOtherSpaces(
  wall: Wall,
  otherSpaces: Space[]
): boolean {
  if (otherSpaces.some((s) => s.wallIds.includes(wall.id))) {
    return true;
  }

  for (const s of otherSpaces) {
    const vIds = s.boundaryVertexIds;
    if (!vIds || vIds.length < 2) continue;
    const n = vIds.length;
    for (let i = 0; i < n; i++) {
      const v1 = vIds[i];
      const v2 = vIds[(i + 1) % n];
      if (
        (wall.startVertexId === v1 && wall.endVertexId === v2) ||
        (wall.startVertexId === v2 && wall.endVertexId === v1)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Elimina un ambiente entero del proyecto.
 * - Preserva todos los muros que comparte con otros ambientes para no desarmarlos.
 * - Elimina únicamente los muros exclusivos del ambiente a borrar.
 * - Limpia aberturas asociadas a los muros eliminados (preserva las de muros compartidos).
 * - Desvincula o limpia elementos eléctricos correspondientes.
 * - Remueve vértices huérfanos que pertenecían exclusivamente a los muros borrados.
 */
export function deleteSpaceFromProject(
  spaceId: string,
  project: BuildingProject
): DeleteSpaceResult {
  const targetSpace = project.spaces.find((s) => s.id === spaceId);
  if (!targetSpace) {
    return {
      project,
      deletedWallIds: [],
      preservedWallIds: [],
      deletedVertexIds: []
    };
  }

  const otherSpaces = project.spaces.filter((s) => s.id !== spaceId);

  // 1. Identificar todos los muros que delimitan el ambiente objetivo
  const boundaryWallIds = new Set<string>(targetSpace.wallIds);

  const bVertices = targetSpace.boundaryVertexIds;
  if (bVertices && bVertices.length >= 2) {
    const n = bVertices.length;
    for (const w of project.walls) {
      if (w.levelId !== targetSpace.levelId) continue;
      for (let i = 0; i < n; i++) {
        const v1 = bVertices[i];
        const v2 = bVertices[(i + 1) % n];
        if (
          (w.startVertexId === v1 && w.endVertexId === v2) ||
          (w.startVertexId === v2 && w.endVertexId === v1)
        ) {
          boundaryWallIds.add(w.id);
        }
      }
    }
  }

  // 2. Separar muros compartidos (a preservar) de muros exclusivos (a eliminar)
  const deletedWallIds: string[] = [];
  const preservedWallIds: string[] = [];

  for (const wId of boundaryWallIds) {
    const wall = project.walls.find((w) => w.id === wId);
    if (!wall) continue;

    if (isWallSharedWithOtherSpaces(wall, otherSpaces)) {
      preservedWallIds.push(wId);
    } else {
      deletedWallIds.push(wId);
    }
  }

  const deletedWallIdsSet = new Set(deletedWallIds);

  // 3. Muros restantes
  const remainingWalls = project.walls.filter((w) => !deletedWallIdsSet.has(w.id));

  // 4. Aberturas restantes (se eliminan solo las de muros borrados)
  const remainingOpenings = project.openings.filter((op) => !deletedWallIdsSet.has(op.wallId));

  // 5. Elementos eléctricos y paneles
  // Elementos en muros eliminados se descartan; los del interior del espacio se desvinculan
  const deletedElementIds = new Set<string>();
  const remainingElements = project.electricalElements
    .filter((el) => {
      if (el.wallId && deletedWallIdsSet.has(el.wallId)) {
        deletedElementIds.add(el.id);
        return false;
      }
      return true;
    })
    .map((el) => {
      if (el.spaceId === spaceId) {
        return { ...el, spaceId: otherSpaces[0]?.id || '' };
      }
      return el;
    });

  const remainingPanels = project.panels.map((p) => {
    if (p.spaceId === spaceId) {
      return { ...p, spaceId: otherSpaces[0]?.id || '' };
    }
    return p;
  });

  // Conduits conectados a elementos eliminados se descartan
  const remainingConduits = project.conduits.filter(
    (c) => !deletedElementIds.has(c.fromElementId) && !deletedElementIds.has(c.toElementId)
  );

  // 6. Limpieza de vértices huérfanos
  const usedVertexIds = new Set<string>();
  for (const w of remainingWalls) {
    usedVertexIds.add(w.startVertexId);
    usedVertexIds.add(w.endVertexId);
  }
  for (const s of otherSpaces) {
    for (const vId of s.boundaryVertexIds) {
      usedVertexIds.add(vId);
    }
  }

  const deletedVertexIds: string[] = [];
  const remainingVertices = project.vertices.filter((v) => {
    if (usedVertexIds.has(v.id)) {
      return true;
    }
    deletedVertexIds.push(v.id);
    return false;
  });

  // 7. Remover el espacio objetivo
  const remainingSpaces = otherSpaces;

  return {
    project: {
      ...project,
      vertices: remainingVertices,
      walls: remainingWalls,
      openings: remainingOpenings,
      spaces: remainingSpaces,
      electricalElements: remainingElements,
      panels: remainingPanels,
      conduits: remainingConduits,
      meta: { ...project.meta, updatedAt: Date.now() }
    },
    deletedWallIds,
    preservedWallIds,
    deletedVertexIds
  };
}
