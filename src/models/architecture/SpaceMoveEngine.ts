/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: SpaceMoveEngine.ts
 * Responsabilidad Única:
 * Motor geométrico y topológico puro para reubicación y traslación de
 * ambientes completos (espacios arquitectónicos) con desacople de muros
 * compartidos, arrastre de elementos electromecánicos contenidos y cálculo
 * de puntos de anclaje (Anchor Presets).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from './BuildingProject';
import type { Vector2D, Wall, WallVertex } from './Wall';
import type { Space } from './Space';
import { isPointInPolygon, resolveSpacePolygon } from './Space';

export type SpaceAnchorPreset = 'sw' | 'nw' | 'se' | 'ne' | 'center';

export interface SpaceAnchorOption {
  readonly id: SpaceAnchorPreset;
  readonly label: string;
  readonly shortLabel: string;
}

export const SPACE_ANCHOR_OPTIONS: readonly SpaceAnchorOption[] = [
  { id: 'sw', label: 'Esquina Sudoeste (SW)', shortLabel: 'SW' },
  { id: 'nw', label: 'Esquina Noroeste (NW)', shortLabel: 'NW' },
  { id: 'ne', label: 'Esquina Noreste (NE)', shortLabel: 'NE' },
  { id: 'se', label: 'Esquina Sudeste (SE)', shortLabel: 'SE' },
  { id: 'center', label: 'Centro del Ambiente', shortLabel: 'Centro' }
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Calcula las coordenadas métricas de los puntos de anclaje estándar (presets)
 * de un espacio arquitectónico en base a su envolvente poligonal.
 */
export function getSpaceAnchorPresets(
  spaceId: string,
  project: BuildingProject
): Record<SpaceAnchorPreset, Vector2D> {
  const zeroPreset: Record<SpaceAnchorPreset, Vector2D> = {
    sw: { x: 0, y: 0 },
    nw: { x: 0, y: 0 },
    se: { x: 0, y: 0 },
    ne: { x: 0, y: 0 },
    center: { x: 0, y: 0 }
  };

  const space = project.spaces.find((s) => s.id === spaceId);
  if (!space || !Array.isArray(space.boundaryVertexIds) || space.boundaryVertexIds.length === 0) {
    return zeroPreset;
  }

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const points = space.boundaryVertexIds
    .map((id) => verticesMap.get(id))
    .filter((v): v is WallVertex => Boolean(v));

  if (points.length === 0) {
    return zeroPreset;
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
    sw: { x: Number(minX.toFixed(3)), y: Number(minY.toFixed(3)) },
    nw: { x: Number(minX.toFixed(3)), y: Number(maxY.toFixed(3)) },
    se: { x: Number(maxX.toFixed(3)), y: Number(minY.toFixed(3)) },
    ne: { x: Number(maxX.toFixed(3)), y: Number(maxY.toFixed(3)) },
    center: {
      x: Number(((minX + maxX) / 2).toFixed(3)),
      y: Number(((minY + maxY) / 2).toFixed(3))
    }
  };
}

/**
 * Desacopla la envolvente de un espacio de cualquier muro o vértice compartido
 * con otros recintos antes de moverlo, clonando los elementos geométricos compartidos
 * para que los recintos vecinos no sufran deformaciones ni traslaciones no deseadas.
 */
export function detachSpaceBoundary(
  spaceId: string,
  project: BuildingProject
): BuildingProject {
  const space = project.spaces.find((s) => s.id === spaceId);
  if (!space) return project;

  const otherSpaces = project.spaces.filter((s) => s.id !== spaceId);

  // 1. Muros compartidos por este espacio y algún otro espacio
  const sharedWallIds = new Set(
    space.wallIds.filter((wId) => otherSpaces.some((s) => s.wallIds.includes(wId)))
  );

  // 2. Vértices compartidos con muros que no pertenecen a este espacio o usados por otros espacios
  const spaceWallIdsSet = new Set(space.wallIds);
  const externalWalls = project.walls.filter((w) => !spaceWallIdsSet.has(w.id));
  const sharedVertexIds = new Set<string>();

  for (const vId of space.boundaryVertexIds) {
    if (otherSpaces.some((s) => s.boundaryVertexIds.includes(vId))) {
      sharedVertexIds.add(vId);
    } else if (externalWalls.some((w) => w.startVertexId === vId || w.endVertexId === vId)) {
      sharedVertexIds.add(vId);
    }
  }

  // Si no hay muros ni vértices compartidos, el espacio ya es topológicamente independiente
  if (sharedWallIds.size === 0 && sharedVertexIds.size === 0) {
    return project;
  }

  // Clonar vértices compartidos
  const vertexCloneMap = new Map<string, string>();
  const newVertices = [...project.vertices];
  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  for (const vId of sharedVertexIds) {
    const origV = verticesMap.get(vId);
    if (origV) {
      const clonedId = generateId('v-detach');
      const clonedVertex: WallVertex = {
        id: clonedId,
        x: origV.x,
        y: origV.y
      };
      newVertices.push(clonedVertex);
      vertexCloneMap.set(vId, clonedId);
    }
  }

  // Clonar muros compartidos y reasignar conexiones
  const newWalls = [...project.walls];
  const updatedSpaceWallIds: string[] = [];

  for (const wId of space.wallIds) {
    const w = project.walls.find((wall) => wall.id === wId);
    if (!w) continue;

    const isShared = sharedWallIds.has(wId);
    const mappedStart = vertexCloneMap.get(w.startVertexId) ?? w.startVertexId;
    const mappedEnd = vertexCloneMap.get(w.endVertexId) ?? w.endVertexId;

    if (isShared) {
      const clonedWallId = generateId('w-detach');
      const clonedWall: Wall = {
        ...w,
        id: clonedWallId,
        startVertexId: mappedStart,
        endVertexId: mappedEnd
      };
      newWalls.push(clonedWall);
      updatedSpaceWallIds.push(clonedWallId);
    } else {
      if (mappedStart !== w.startVertexId || mappedEnd !== w.endVertexId) {
        const wallIdx = newWalls.findIndex((wall) => wall.id === wId);
        if (wallIdx !== -1) {
          newWalls[wallIdx] = {
            ...w,
            startVertexId: mappedStart,
            endVertexId: mappedEnd
          };
        }
      }
      updatedSpaceWallIds.push(wId);
    }
  }

  const updatedBoundaryVertexIds = space.boundaryVertexIds.map(
    (vId) => vertexCloneMap.get(vId) ?? vId
  );

  const updatedSpaces: Space[] = project.spaces.map((s) => {
    if (s.id !== spaceId) return s;
    return {
      ...s,
      wallIds: updatedSpaceWallIds,
      boundaryVertexIds: updatedBoundaryVertexIds
    };
  });

  return {
    ...project,
    vertices: newVertices,
    walls: newWalls,
    spaces: updatedSpaces,
    meta: { ...project.meta, updatedAt: Date.now() }
  };
}

/**
 * Traslada un espacio arquitectónico completo por un vector delta (dx, dy).
 * Desacopla automáticamente cualquier muro o vértice compartido y arrastra
 * solidariamente sus muros, vértices, aberturas y bocas/tableros contenidos.
 */
export function translateSpace(params: {
  spaceId: string;
  delta: Vector2D;
  project: BuildingProject;
}): BuildingProject {
  const { spaceId, delta, project } = params;

  if (Math.abs(delta.x) < 1e-4 && Math.abs(delta.y) < 1e-4) {
    return project;
  }

  // 1. Asegurar independencia topológica respecto a recintos adyacentes
  const detachedProject = detachSpaceBoundary(spaceId, project);
  const targetSpace = detachedProject.spaces.find((s) => s.id === spaceId);
  if (!targetSpace) return detachedProject;

  const spaceVertexIdsSet = new Set(targetSpace.boundaryVertexIds);

  // 2. Mapear y trasladar los vértices del espacio
  const updatedVertices = detachedProject.vertices.map((v) => {
    if (spaceVertexIdsSet.has(v.id)) {
      return {
        ...v,
        x: Number((v.x + delta.x).toFixed(3)),
        y: Number((v.y + delta.y).toFixed(3))
      };
    }
    return v;
  });

  // 3. Determinar polígono previo a la traslación para detectar elementos contenidos
  const initialVerticesMap = new Map(detachedProject.vertices.map((v) => [v.id, v]));
  const spacePolygon = resolveSpacePolygon(targetSpace, initialVerticesMap);

  const movedElementIds = new Set<string>();

  // 4. Trasladar elementos eléctricos contenidos o asociados al espacio
  const updatedElectricalElements = detachedProject.electricalElements.map((el) => {
    const isInside =
      el.spaceId === spaceId ||
      (spacePolygon.length >= 3 && isPointInPolygon({ x: el.x, y: el.y }, spacePolygon));

    if (isInside) {
      movedElementIds.add(el.id);
      return {
        ...el,
        x: Number((el.x + delta.x).toFixed(3)),
        y: Number((el.y + delta.y).toFixed(3)),
        spaceId
      };
    }
    return el;
  });

  // 5. Trasladar tableros eléctricos contenidos o asociados al espacio
  const updatedPanels = detachedProject.panels.map((panel) => {
    const isInside =
      panel.spaceId === spaceId ||
      (spacePolygon.length >= 3 && isPointInPolygon({ x: panel.x, y: panel.y }, spacePolygon));

    if (isInside) {
      movedElementIds.add(panel.id);
      return {
        ...panel,
        x: Number((panel.x + delta.x).toFixed(3)),
        y: Number((panel.y + delta.y).toFixed(3)),
        spaceId
      };
    }
    return panel;
  });

  // 6. Trasladar waypoints de conductos que conectan elementos que se movieron juntos
  const updatedConduits = detachedProject.conduits.map((c) => {
    if (
      c.waypoints &&
      c.waypoints.length > 0 &&
      movedElementIds.has(c.fromElementId) &&
      movedElementIds.has(c.toElementId)
    ) {
      return {
        ...c,
        waypoints: c.waypoints.map((wp) => ({
          ...wp,
          x: Number((wp.x + delta.x).toFixed(3)),
          y: Number((wp.y + delta.y).toFixed(3))
        }))
      };
    }
    return c;
  });

  return {
    ...detachedProject,
    vertices: updatedVertices,
    electricalElements: updatedElectricalElements,
    panels: updatedPanels,
    conduits: updatedConduits,
    meta: { ...detachedProject.meta, updatedAt: Date.now() }
  };
}
