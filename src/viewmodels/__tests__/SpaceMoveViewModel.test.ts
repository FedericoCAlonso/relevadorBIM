import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import { getSpaceAnchorPresets } from '../../models/architecture/SpaceMoveEngine';
import type { Wall, WallVertex } from '../../models/architecture/Wall';
import type { Space } from '../../models/architecture/Space';
import type { ElectricalElement } from '../../models/electrical/ElectricalModel';

describe('SpaceMoveViewModel — Reubicación de Ambientes con Punto Base y Soporte Undo', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();

    // Configurar proyecto con un ambiente de prueba: (0,0) a (4,4)
    const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
    const v2: WallVertex = { id: 'v2', x: 4, y: 0 };
    const v3: WallVertex = { id: 'v3', x: 4, y: 4 };
    const v4: WallVertex = { id: 'v4', x: 0, y: 4 };

    const w1: Wall = { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.6 };
    const w2: Wall = { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.6 };
    const w3: Wall = { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.6 };
    const w4: Wall = { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.6 };

    const sp: Space = {
      id: 'sp-1',
      name: 'Cocina',
      category: 'cocina',
      levelId: 'lvl-1',
      ceilingHeight: 2.6,
      floorElevation: 0,
      wallIds: ['w1', 'w2', 'w3', 'w4'],
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4']
    };

    const el: ElectricalElement = {
      id: 'el-1',
      levelId: 'lvl-1',
      spaceId: 'sp-1',
      symbolId: 'sym-boca-techo',
      placement: 'ceiling',
      x: 2,
      y: 2,
      heightZ: 2.6
    };

    const store = useProjectStore.getState();
    store.loadProject({
      ...store.project,
      vertices: [v1, v2, v3, v4],
      walls: [w1, w2, w3, w4],
      spaces: [sp],
      electricalElements: [el]
    });
  });

  it('1. useProjectStore.moveSpace traslada solidariamente geometría y elementos con soporte de Undo', () => {
    const store = useProjectStore.getState();

    // Mover Cocina por dx=5, dy=10
    store.moveSpace('sp-1', { x: 5, y: 10 });

    const updated = useProjectStore.getState().project;
    const v1 = updated.vertices.find((v) => v.id === 'v1');
    expect(v1?.x).toBe(5);
    expect(v1?.y).toBe(10);

    const el = updated.electricalElements.find((e) => e.id === 'el-1');
    expect(el?.x).toBe(7); // 2 + 5
    expect(el?.y).toBe(12); // 2 + 10

    // Verificar soporte de deshacer (Undo)
    expect(useProjectStore.getState().canUndo).toBe(true);
    useProjectStore.getState().undo();

    const restored = useProjectStore.getState().project;
    const v1Restored = restored.vertices.find((v) => v.id === 'v1');
    expect(v1Restored?.x).toBe(0);
    expect(v1Restored?.y).toBe(0);

    const elRestored = restored.electricalElements.find((e) => e.id === 'el-1');
    expect(elRestored?.x).toBe(2);
    expect(elRestored?.y).toBe(2);
  });

  it('2. Calcula puntos de anclaje (Anchor Presets) y resuelve vector de traslación', () => {
    const project = useProjectStore.getState().project;
    const presets = getSpaceAnchorPresets('sp-1', project);

    expect(presets.sw).toEqual({ x: 0, y: 0 });
    expect(presets.nw).toEqual({ x: 0, y: 4 });
    expect(presets.se).toEqual({ x: 4, y: 0 });
    expect(presets.ne).toEqual({ x: 4, y: 4 });
    expect(presets.center).toEqual({ x: 2, y: 2 });

    // Simular flujo de anclaje: tomando la esquina SW (0, 0) y ubicándola en el destino (10, 5)
    const basePoint = presets.sw;
    const destination = { x: 10, y: 5 };
    const delta = {
      x: destination.x - basePoint.x,
      y: destination.y - basePoint.y
    };

    useProjectStore.getState().moveSpace('sp-1', delta);

    const moved = useProjectStore.getState().project;
    const v1Moved = moved.vertices.find((v) => v.id === 'v1');
    expect(v1Moved?.x).toBe(10);
    expect(v1Moved?.y).toBe(5);
  });

  it('3. Desacopla automáticamente muros compartidos al mover un ambiente vecino', () => {
    const store = useProjectStore.getState();

    // Agregar un dormitorio de (4,0) a (8,4) compartiendo el muro este de Cocina (w2)
    const v5: WallVertex = { id: 'v5', x: 8, y: 0 };
    const v6: WallVertex = { id: 'v6', x: 8, y: 4 };

    const w5: Wall = { id: 'w5', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v5', thickness: 0.15, height: 2.6 };
    const w6: Wall = { id: 'w6', levelId: 'lvl-1', startVertexId: 'v5', endVertexId: 'v6', thickness: 0.15, height: 2.6 };
    const w7: Wall = { id: 'w7', levelId: 'lvl-1', startVertexId: 'v6', endVertexId: 'v3', thickness: 0.15, height: 2.6 };

    const spDormitorio: Space = {
      id: 'sp-2',
      name: 'Dormitorio',
      category: 'dormitorio',
      levelId: 'lvl-1',
      ceilingHeight: 2.6,
      floorElevation: 0,
      wallIds: ['w2', 'w5', 'w6', 'w7'],
      boundaryVertexIds: ['v2', 'v5', 'v6', 'v3']
    };

    store.loadProject({
      ...store.project,
      vertices: [...store.project.vertices, v5, v6],
      walls: [...store.project.walls, w5, w6, w7],
      spaces: [...store.project.spaces, spDormitorio]
    });

    // Mover Dormitorio lejos (dx = 20, dy = 0)
    store.moveSpace('sp-2', { x: 20, y: 0 });

    const updated = useProjectStore.getState().project;

    // Cocina (sp-1) debe permanecer exactamente en su lugar original
    const v1 = updated.vertices.find((v) => v.id === 'v1');
    const v2 = updated.vertices.find((v) => v.id === 'v2');
    expect(v1?.x).toBe(0);
    expect(v1?.y).toBe(0);
    expect(v2?.x).toBe(4);
    expect(v2?.y).toBe(0);

    // Dormitorio debe haberse trasladado correctamente
    const dormitorio = updated.spaces.find((s) => s.id === 'sp-2')!;
    const dormVertices = dormitorio.boundaryVertexIds.map((id) =>
      updated.vertices.find((v) => v.id === id)!
    );
    const minDormX = Math.min(...dormVertices.map((v) => v.x));
    expect(minDormX).toBeCloseTo(24, 1); // 4 + 20 = 24
  });
});
