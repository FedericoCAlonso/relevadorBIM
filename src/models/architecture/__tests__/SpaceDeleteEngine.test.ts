import { describe, it, expect } from 'vitest';
import {
  deleteSpaceFromProject,
  isWallSharedWithOtherSpaces
} from '../SpaceDeleteEngine';
import { type BuildingProject, createEmptyProject } from '../BuildingProject';
import { createDefaultLevel } from '../Level';
import type { Wall, WallVertex } from '../Wall';
import type { Space } from '../Space';
import type { Opening } from '../Opening';
import type { ElectricalElement } from '../../electrical/ElectricalModel';

describe('SpaceDeleteEngine — Eliminación de Ambientes Preservando Muros Compartidos', () => {
  const createMockProjectWithAdjacentRooms = (): BuildingProject => {
    // Room 1 (Living): (0,0) a (4,4)
    // Vertices: v1(0,0), v2(4,0), v3(4,4), v4(0,4)
    // Walls: w1(v1->v2), w2(v2->v3), w3(v3->v4), w4(v4->v1)
    //
    // Room 2 (Cocina): (4,0) a (8,4)
    // Vertices: v2(4,0), v5(8,0), v6(8,4), v3(4,4)
    // Walls: w2(v2->v3) [COMPARTIDO CON LIVING], w5(v2->v5), w6(v5->v6), w7(v6->v3)
    const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
    const v2: WallVertex = { id: 'v2', x: 4, y: 0 };
    const v3: WallVertex = { id: 'v3', x: 4, y: 4 };
    const v4: WallVertex = { id: 'v4', x: 0, y: 4 };
    const v5: WallVertex = { id: 'v5', x: 8, y: 0 };
    const v6: WallVertex = { id: 'v6', x: 8, y: 4 };

    const w1: Wall = { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.6 };
    const w2: Wall = { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.6 }; // Shared
    const w3: Wall = { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.6 };
    const w4: Wall = { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.6 };

    const w5: Wall = { id: 'w5', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v5', thickness: 0.15, height: 2.6 };
    const w6: Wall = { id: 'w6', levelId: 'lvl-1', startVertexId: 'v5', endVertexId: 'v6', thickness: 0.15, height: 2.6 };
    const w7: Wall = { id: 'w7', levelId: 'lvl-1', startVertexId: 'v6', endVertexId: 'v3', thickness: 0.15, height: 2.6 };

    const spLiving: Space = {
      id: 'sp-living',
      name: 'Living',
      category: 'living',
      levelId: 'lvl-1',
      ceilingHeight: 2.6,
      floorElevation: 0,
      wallIds: ['w1', 'w2', 'w3', 'w4'],
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4']
    };

    const spCocina: Space = {
      id: 'sp-cocina',
      name: 'Cocina',
      category: 'cocina',
      levelId: 'lvl-1',
      ceilingHeight: 2.6,
      floorElevation: 0,
      wallIds: ['w2', 'w5', 'w6', 'w7'],
      boundaryVertexIds: ['v2', 'v5', 'v6', 'v3']
    };

    const opShared: Opening = {
      id: 'op-door',
      wallId: 'w2',
      type: 'door',
      width: 0.8,
      height: 2.0,
      distanceAlongWall: 1.5,
      sill: 0,
      swing: 'left_in'
    };

    const opExclusiveLiving: Opening = {
      id: 'op-win-living',
      wallId: 'w4',
      type: 'window',
      width: 1.2,
      height: 1.1,
      distanceAlongWall: 1.0,
      sill: 1.0,
      swing: 'none'
    };

    const elLiving: ElectricalElement = {
      id: 'el-1',
      levelId: 'lvl-1',
      spaceId: 'sp-living',
      wallId: 'w4',
      symbolId: 'sym-toma',
      placement: 'wall',
      x: 0,
      y: 2,
      heightZ: 0.3
    };

    const elCocina: ElectricalElement = {
      id: 'el-2',
      levelId: 'lvl-1',
      spaceId: 'sp-cocina',
      wallId: 'w6',
      symbolId: 'sym-toma',
      placement: 'wall',
      x: 8,
      y: 2,
      heightZ: 0.3
    };

    const base = createEmptyProject('Test Delete Space');
    return {
      ...base,
      levels: [createDefaultLevel('lvl-1', 'PB')],
      activeLevelId: 'lvl-1',
      vertices: [v1, v2, v3, v4, v5, v6],
      walls: [w1, w2, w3, w4, w5, w6, w7],
      openings: [opShared, opExclusiveLiving],
      spaces: [spLiving, spCocina],
      electricalElements: [elLiving, elCocina],
      panels: [],
      conduits: []
    };
  };

  it('detecta correctamente si un muro es compartido con otro ambiente', () => {
    const project = createMockProjectWithAdjacentRooms();
    const otherSpaces = project.spaces.filter((s) => s.id !== 'sp-living');

    const wallShared = project.walls.find((w) => w.id === 'w2')!;
    const wallExclusive = project.walls.find((w) => w.id === 'w1')!;

    expect(isWallSharedWithOtherSpaces(wallShared, otherSpaces)).toBe(true);
    expect(isWallSharedWithOtherSpaces(wallExclusive, otherSpaces)).toBe(false);
  });

  it('al eliminar Living, preserva el muro w2 y sus vértices para no desarmar Cocina', () => {
    const project = createMockProjectWithAdjacentRooms();

    const result = deleteSpaceFromProject('sp-living', project);
    const updated = result.project;

    // 1. El ambiente Living ya no existe
    expect(updated.spaces.some((s) => s.id === 'sp-living')).toBe(false);

    // 2. Cocina permanece intacta con todas sus paredes y vértices
    const cocina = updated.spaces.find((s) => s.id === 'sp-cocina');
    expect(cocina).toBeDefined();
    expect(cocina?.wallIds).toEqual(['w2', 'w5', 'w6', 'w7']);

    // 3. Muro w2 fue preservado
    expect(result.preservedWallIds).toContain('w2');
    expect(updated.walls.some((w) => w.id === 'w2')).toBe(true);

    // 4. Muros exclusivos de Living (w1, w3, w4) fueron eliminados
    expect(result.deletedWallIds).toEqual(expect.arrayContaining(['w1', 'w3', 'w4']));
    expect(updated.walls.some((w) => w.id === 'w1')).toBe(false);
    expect(updated.walls.some((w) => w.id === 'w3')).toBe(false);
    expect(updated.walls.some((w) => w.id === 'w4')).toBe(false);

    // 5. La puerta del muro compartido w2 se preserva; la ventana de w4 se elimina
    expect(updated.openings.some((op) => op.id === 'op-door')).toBe(true);
    expect(updated.openings.some((op) => op.id === 'op-win-living')).toBe(false);

    // 6. Vértices v2 y v3 (compartidos por w2 y cocina) se preservan
    expect(updated.vertices.some((v) => v.id === 'v2')).toBe(true);
    expect(updated.vertices.some((v) => v.id === 'v3')).toBe(true);

    // 7. Vértices v1 y v4 (exclusivos de Living) fueron eliminados
    expect(updated.vertices.some((v) => v.id === 'v1')).toBe(false);
    expect(updated.vertices.some((v) => v.id === 'v4')).toBe(false);

    // 8. Elemento en muro w4 de Living fue eliminado; elemento de Cocina se conserva
    expect(updated.electricalElements.some((el) => el.id === 'el-1')).toBe(false);
    expect(updated.electricalElements.some((el) => el.id === 'el-2')).toBe(true);
  });
});
