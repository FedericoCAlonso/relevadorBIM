import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';

describe('Sistema General de Deshacer y Rehacer Multinivel (Undo/Redo)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe registrar historial para operaciones variadas y permitir deshacer y rehacer paso a paso', () => {
    const store = useProjectStore.getState();

    expect(useProjectStore.getState().canUndo).toBe(false);
    expect(useProjectStore.getState().canRedo).toBe(false);

    // 1. Agregar pared 1
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!;
    expect(useProjectStore.getState().project.walls.length).toBe(1);
    expect(useProjectStore.getState().canUndo).toBe(true);

    // 2. Agregar pared 2
    store.addWallFromAnchor({
      startVertexId: w1.endVertexId,
      lengthM: 3.0,
      angleDeg: 90
    });
    expect(useProjectStore.getState().project.walls.length).toBe(2);

    // 3. Agregar abertura (puerta) en pared 1
    store.addOpeningReferenced({
      hostWallId: w1.wall.id,
      referenceVertexId: w1.wall.startVertexId,
      offsetToJambM: 0.5,
      widthM: 0.8,
      type: 'door'
    });
    expect(useProjectStore.getState().project.openings.length).toBe(1);

    // 4. Agregar elemento eléctrico
    store.addElectricalElement({
      id: 'el-undo-1',
      symbolId: 'sym-toma',
      levelId: 'level-1',
      spaceId: 's1',
      placement: 'wall',
      wallId: w1.wall.id,
      x: 1.0,
      y: 0.0,
      heightZ: 0.30,
      label: 'Toma 1'
    });
    expect(useProjectStore.getState().project.electricalElements.length).toBe(1);

    // 5. Modificar elemento eléctrico
    store.updateElectricalElement('el-undo-1', {
      heightZ: 1.10,
      label: 'Toma Alto'
    });
    expect(useProjectStore.getState().project.electricalElements[0].heightZ).toBe(1.10);

    // --- SECUENCIA DE DESHACER (UNDO) ---

    // Deshacer paso 5 (modificación de boca)
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.electricalElements[0].heightZ).toBe(0.30);
    expect(useProjectStore.getState().project.electricalElements[0].label).toBe('Toma 1');
    expect(useProjectStore.getState().canRedo).toBe(true);

    // Deshacer paso 4 (creación de boca)
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.electricalElements.length).toBe(0);

    // Deshacer paso 3 (creación de abertura)
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.openings.length).toBe(0);

    // Deshacer paso 2 (pared 2)
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.walls.length).toBe(1);

    // Deshacer paso 1 (pared 1)
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.walls.length).toBe(0);
    expect(useProjectStore.getState().canUndo).toBe(false);

    // --- SECUENCIA DE REHACER (REDO) ---

    // Rehacer paso 1 (pared 1)
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.walls.length).toBe(1);

    // Rehacer paso 2 (pared 2)
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.walls.length).toBe(2);

    // Rehacer paso 3 (abertura)
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.openings.length).toBe(1);

    // Rehacer paso 4 (boca)
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.electricalElements.length).toBe(1);
    expect(useProjectStore.getState().project.electricalElements[0].heightZ).toBe(0.30);

    // Rehacer paso 5 (modificación de boca)
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.electricalElements[0].heightZ).toBe(1.10);
    expect(useProjectStore.getState().canRedo).toBe(false);
  });
});
