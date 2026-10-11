import { describe, it, expect } from 'vitest';
import {
  getSpaceAnchorPresets,
  detachSpaceBoundary,
  translateSpace
} from '../SpaceMoveEngine';
import { type BuildingProject, createEmptyProject } from '../BuildingProject';
import { createDefaultLevel } from '../Level';
import type { Wall, WallVertex } from '../Wall';
import type { Space } from '../Space';
import type { ElectricalElement, Panel } from '../../electrical/ElectricalModel';

describe('SpaceMoveEngine', () => {
  const createMockProjectWithTwoRooms = (): BuildingProject => {
    // Room 1: Living (0,0) to (6,4)
    // Vertices: v1(0,0), v2(6,0), v3(6,4), v4(0,4)
    // Room 2: Balcón attached to South wall of Room 1: (0,-2) to (6,0)
    // Vertices: v5(0,-2), v6(6,-2), v2(6,0), v1(0,0)
    // Shared wall: w1 from v1 to v2
    const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
    const v2: WallVertex = { id: 'v2', x: 6, y: 0 };
    const v3: WallVertex = { id: 'v3', x: 6, y: 4 };
    const v4: WallVertex = { id: 'v4', x: 0, y: 4 };
    const v5: WallVertex = { id: 'v5', x: 0, y: -2 };
    const v6: WallVertex = { id: 'v6', x: 6, y: -2 };

    const w1: Wall = { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.6 };
    const w2: Wall = { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.6 };
    const w3: Wall = { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.6 };
    const w4: Wall = { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.6 };

    // Balcon walls: w_b1 (v1 -> v5), w_b2 (v5 -> v6), w_b3 (v6 -> v2), and shared w1
    const wb1: Wall = { id: 'wb1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v5', thickness: 0.15, height: 2.6 };
    const wb2: Wall = { id: 'wb2', levelId: 'lvl-1', startVertexId: 'v5', endVertexId: 'v6', thickness: 0.15, height: 2.6 };
    const wb3: Wall = { id: 'wb3', levelId: 'lvl-1', startVertexId: 'v6', endVertexId: 'v2', thickness: 0.15, height: 2.6 };

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

    const spBalcon: Space = {
      id: 'sp-balcon',
      name: 'Balcón',
      category: 'balcon',
      levelId: 'lvl-1',
      ceilingHeight: 2.6,
      floorElevation: 0,
      wallIds: ['w1', 'wb3', 'wb2', 'wb1'],
      boundaryVertexIds: ['v1', 'v2', 'v6', 'v5']
    };

    const elLiving: ElectricalElement = {
      id: 'el-living-1',
      levelId: 'lvl-1',
      spaceId: 'sp-living',
      symbolId: 'sym-boca-techo',
      placement: 'ceiling',
      x: 3,
      y: 2,
      heightZ: 2.6
    };

    const elBalcon: ElectricalElement = {
      id: 'el-balcon-1',
      levelId: 'lvl-1',
      spaceId: 'sp-balcon',
      symbolId: 'sym-aplique-pared',
      placement: 'wall',
      x: 3,
      y: -1,
      heightZ: 2.2
    };

    const panLiving: Panel = {
      id: 'pan-1',
      name: 'Tablero Principal',
      type: 'principal',
      levelId: 'lvl-1',
      spaceId: 'sp-living',
      x: 0.5,
      y: 0.1,
      heightZ: 1.4,
      symbolId: 'sym-panel',
      isThreePhase: false,
      mainBreakerAmperageA: 32,
      mainDifferentialAmperageA: 40,
      hasEarthBar: true,
      incomings: []
    };

    const base = createEmptyProject('Test Project');
    return {
      ...base,
      levels: [createDefaultLevel('lvl-1', 'PB')],
      activeLevelId: 'lvl-1',
      vertices: [v1, v2, v3, v4, v5, v6],
      walls: [w1, w2, w3, w4, wb1, wb2, wb3],
      openings: [],
      spaces: [spLiving, spBalcon],
      electricalElements: [elLiving, elBalcon],
      panels: [panLiving],
      conduits: []
    };
  };

  it('calculates anchor presets accurately for a room', () => {
    const project = createMockProjectWithTwoRooms();
    const presets = getSpaceAnchorPresets('sp-living', project);

    expect(presets.sw).toEqual({ x: 0, y: 0 });
    expect(presets.nw).toEqual({ x: 0, y: 4 });
    expect(presets.se).toEqual({ x: 6, y: 0 });
    expect(presets.ne).toEqual({ x: 6, y: 4 });
    expect(presets.center).toEqual({ x: 3, y: 2 });
  });

  it('detaches shared walls and vertices before moving so neighbor room is unaffected', () => {
    const project = createMockProjectWithTwoRooms();

    // Detach balcon from living
    const detached = detachSpaceBoundary('sp-balcon', project);

    const living = detached.spaces.find((s) => s.id === 'sp-living')!;
    const balcon = detached.spaces.find((s) => s.id === 'sp-balcon')!;

    // Living must still have original walls and vertices
    expect(living.wallIds).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(living.boundaryVertexIds).toEqual(['v1', 'v2', 'v3', 'v4']);

    // Balcon must no longer share w1
    expect(balcon.wallIds).not.toContain('w1');
    // Balcon must no longer share v1 and v2
    expect(balcon.boundaryVertexIds).not.toContain('v1');
    expect(balcon.boundaryVertexIds).not.toContain('v2');

    // New vertices were created
    expect(detached.vertices.length).toBeGreaterThan(project.vertices.length);
  });

  it('translates entire space solidarily along with contained electrical elements', () => {
    const project = createMockProjectWithTwoRooms();

    // Move balcon by dx = 10, dy = 5
    const moved = translateSpace({
      spaceId: 'sp-balcon',
      delta: { x: 10, y: 5 },
      project
    });

    const balcon = moved.spaces.find((s) => s.id === 'sp-balcon')!;

    // Living vertices did NOT move
    const vLiving1 = moved.vertices.find((v) => v.id === 'v1')!;
    expect(vLiving1.x).toBe(0);
    expect(vLiving1.y).toBe(0);

    const elLiving = moved.electricalElements.find((e) => e.id === 'el-living-1')!;
    expect(elLiving.x).toBe(3);
    expect(elLiving.y).toBe(2);

    // Balcon element DID move from (3, -1) to (3 + 10, -1 + 5) = (13, 4)
    const elBalcon = moved.electricalElements.find((e) => e.id === 'el-balcon-1')!;
    expect(elBalcon.x).toBeCloseTo(13, 2);
    expect(elBalcon.y).toBeCloseTo(4, 2);

    // Balcon vertices moved
    const balconVertices = balcon.boundaryVertexIds.map((id) =>
      moved.vertices.find((v) => v.id === id)!
    );
    // Min X should now be 0 + 10 = 10, Max X should be 6 + 10 = 16
    const minX = Math.min(...balconVertices.map((v) => v.x));
    const maxX = Math.max(...balconVertices.map((v) => v.x));
    expect(minX).toBeCloseTo(10, 2);
    expect(maxX).toBeCloseTo(16, 2);
  });
});
