import { describe, it, expect } from 'vitest';
import { splitWallAtDistance } from '../WallSplitEngine';
import { type BuildingProject, createEmptyProject } from '../BuildingProject';
import { createDefaultLevel } from '../Level';
import type { Wall, WallVertex } from '../Wall';
import type { Opening } from '../Opening';
import type { Space } from '../Space';

describe('WallSplitEngine', () => {
  const createMockProject = (): BuildingProject => {
    const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
    const v2: WallVertex = { id: 'v2', x: 6, y: 0 };
    const v3: WallVertex = { id: 'v3', x: 6, y: 4 };
    const v4: WallVertex = { id: 'v4', x: 0, y: 4 };

    const w1: Wall = {
      id: 'w1',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.15,
      height: 2.6
    };
    const w2: Wall = {
      id: 'w2',
      levelId: 'lvl-1',
      startVertexId: 'v2',
      endVertexId: 'v3',
      thickness: 0.15,
      height: 2.6
    };
    const w3: Wall = {
      id: 'w3',
      levelId: 'lvl-1',
      startVertexId: 'v3',
      endVertexId: 'v4',
      thickness: 0.15,
      height: 2.6
    };
    const w4: Wall = {
      id: 'w4',
      levelId: 'lvl-1',
      startVertexId: 'v4',
      endVertexId: 'v1',
      thickness: 0.15,
      height: 2.6
    };

    const op1: Opening = {
      id: 'op1',
      wallId: 'w1',
      type: 'door',
      distanceAlongWall: 1.0,
      width: 0.8,
      height: 2.0,
      sill: 0,
      swing: 'left_in'
    };
    const op2: Opening = {
      id: 'op2',
      wallId: 'w1',
      type: 'window',
      distanceAlongWall: 5.0,
      width: 0.8,
      height: 1.2,
      sill: 0.9,
      swing: 'left_in'
    };

    const sp1: Space = {
      id: 'sp1',
      levelId: 'lvl-1',
      name: 'Living',
      category: 'living',
      ceilingHeight: 2.6,
      floorElevation: 0,
      wallIds: ['w1', 'w2', 'w3', 'w4'],
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      color: '#ffffff'
    };

    const base = createEmptyProject('Test Project');
    return {
      ...base,
      levels: [createDefaultLevel('lvl-1', 'Planta Baja')],
      activeLevelId: 'lvl-1',
      vertices: [v1, v2, v3, v4],
      walls: [w1, w2, w3, w4],
      openings: [op1, op2],
      spaces: [sp1]
    };
  };

  it('splits a 6m horizontal wall at 4.5m from start vertex', () => {
    const project = createMockProject();
    const result = splitWallAtDistance({
      hostWallId: 'w1',
      distanceM: 4.5,
      fromVertexId: 'v1',
      project
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const { project: updatedProject, splitVertexId, wall1, wall2 } = result;

    // Check split vertex
    const splitV = updatedProject.vertices.find((v) => v.id === splitVertexId);
    expect(splitV).toBeDefined();
    expect(splitV?.x).toBeCloseTo(4.5, 2);
    expect(splitV?.y).toBeCloseTo(0, 2);

    // Wall 1 should go from v1 to splitVertex
    expect(wall1.startVertexId).toBe('v1');
    expect(wall1.endVertexId).toBe(splitVertexId);

    // Wall 2 should go from splitVertex to v2
    expect(wall2.startVertexId).toBe(splitVertexId);
    expect(wall2.endVertexId).toBe('v2');

    // Host wall w1 must be removed
    expect(updatedProject.walls.find((w) => w.id === 'w1')).toBeUndefined();
    expect(updatedProject.walls.find((w) => w.id === wall1.id)).toBeDefined();
    expect(updatedProject.walls.find((w) => w.id === wall2.id)).toBeDefined();

    // Check opening redistribution
    const op1Updated = updatedProject.openings.find((o) => o.id === 'op1');
    const op2Updated = updatedProject.openings.find((o) => o.id === 'op2');

    expect(op1Updated?.wallId).toBe(wall1.id);
    expect(op1Updated?.distanceAlongWall).toBe(1.0);

    expect(op2Updated?.wallId).toBe(wall2.id);
    // At 5.0m from v1, in wall2 (which starts at 4.5m), distance is 5.0 - 4.5 = 0.5m
    expect(op2Updated?.distanceAlongWall).toBeCloseTo(0.5, 2);

    // Check space boundary update
    const spUpdated = updatedProject.spaces.find((s) => s.id === 'sp1');
    expect(spUpdated).toBeDefined();
    expect(spUpdated?.wallIds).toContain(wall1.id);
    expect(spUpdated?.wallIds).toContain(wall2.id);
    expect(spUpdated?.wallIds).not.toContain('w1');
    expect(spUpdated?.boundaryVertexIds).toContain(splitVertexId);
  });

  it('splits wall at distance from end vertex correctly', () => {
    const project = createMockProject();
    const result = splitWallAtDistance({
      hostWallId: 'w1',
      distanceM: 1.5,
      fromVertexId: 'v2', // 1.5m from end is at x=4.5
      project
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const splitV = result.project.vertices.find((v) => v.id === result.splitVertexId);
    expect(splitV?.x).toBeCloseTo(4.5, 2);
    expect(splitV?.y).toBeCloseTo(0, 2);
  });

  it('rejects split if distance is out of bounds or too close to corners', () => {
    const project = createMockProject();

    // Too close to start
    const res1 = splitWallAtDistance({
      hostWallId: 'w1',
      distanceM: 0.02,
      fromVertexId: 'v1',
      project
    });
    expect(res1).toBeNull();

    // Too close to end
    const res2 = splitWallAtDistance({
      hostWallId: 'w1',
      distanceM: 5.98,
      fromVertexId: 'v1',
      project
    });
    expect(res2).toBeNull();

    // Negative distance
    const res3 = splitWallAtDistance({
      hostWallId: 'w1',
      distanceM: -1,
      fromVertexId: 'v1',
      project
    });
    expect(res3).toBeNull();
  });
});
