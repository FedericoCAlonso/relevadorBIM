import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';

describe('Batch Wall Updates and Bulk Editing (useProjectStore)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe actualizar únicamente las propiedades modificadas en bloque manteniendo las propiedades heterogéneas intactas', () => {
    const store = useProjectStore.getState();

    // Muro 1: espesor 0.15, altura 2.80, tipo 'standard', portante true
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0,
      thickness: 0.15
    })!.wall;
    store.updateWall(w1.id, { height: 2.80, wallType: 'standard', isBearing: true });

    // Muro 2: espesor 0.20, altura 3.00, tipo 'low_wall', portante false
    const w2 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 2 },
      lengthM: 5.0,
      angleDeg: 0,
      thickness: 0.20
    })!.wall;
    store.updateWall(w2.id, { height: 3.00, wallType: 'low_wall', isBearing: false });

    // Actualizamos en bloque SOLO el espesor a 0.30 m
    store.batchUpdateWalls([w1.id, w2.id], { thickness: 0.30 });

    const updatedProject = useProjectStore.getState().project;
    const updatedW1 = updatedProject.walls.find((w) => w.id === w1.id)!;
    const updatedW2 = updatedProject.walls.find((w) => w.id === w2.id)!;

    // Ambos muros ahora tienen espesor 0.30
    expect(updatedW1.thickness).toBe(0.30);
    expect(updatedW2.thickness).toBe(0.30);

    // Las propiedades que tenían valores diferentes permanecen intactas
    expect(updatedW1.height).toBe(2.80);
    expect(updatedW2.height).toBe(3.00);

    expect(updatedW1.wallType).toBe('standard');
    expect(updatedW2.wallType).toBe('low_wall');

    expect(updatedW1.isBearing).toBe(true);
    expect(updatedW2.isBearing).toBe(false);
  });

  it('debe permitir cambiar la tipología y justificación en bloque sin alterar espesor ni altura', () => {
    const store = useProjectStore.getState();

    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 3.0,
      angleDeg: 0,
      thickness: 0.10
    })!.wall;
    store.updateWall(w1.id, { height: 2.60 });

    const w2 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 1 },
      lengthM: 3.0,
      angleDeg: 0,
      thickness: 0.15
    })!.wall;
    store.updateWall(w2.id, { height: 3.20 });

    // Actualizamos tipología a 'railing' y justificación a 'interior'
    store.batchUpdateWalls([w1.id, w2.id], { wallType: 'railing', justification: 'interior' });

    const updated = useProjectStore.getState().project.walls;
    const uW1 = updated.find((w) => w.id === w1.id)!;
    const uW2 = updated.find((w) => w.id === w2.id)!;

    expect(uW1.wallType).toBe('railing');
    expect(uW2.wallType).toBe('railing');
    expect(uW1.justification).toBe('interior');
    expect(uW2.justification).toBe('interior');

    // Espesores y alturas originales no se sobreescribieron
    expect(uW1.thickness).toBe(0.10);
    expect(uW2.thickness).toBe(0.15);
    expect(uW1.height).toBe(2.60);
    expect(uW2.height).toBe(3.20);
  });

  it('debe eliminar muros en bloque con batchDeleteWalls y limpiar selección', () => {
    const store = useProjectStore.getState();

    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 2.0,
      angleDeg: 0
    })!.wall;
    const w2 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 5 },
      lengthM: 2.0,
      angleDeg: 0
    })!.wall;

    store.setSelectedEntities([
      { type: 'wall', id: w1.id },
      { type: 'wall', id: w2.id }
    ]);

    expect(useProjectStore.getState().selectedEntities).toHaveLength(2);

    store.batchDeleteWalls([w1.id, w2.id]);

    const state = useProjectStore.getState();
    expect(state.project.walls).toHaveLength(0);
    expect(state.selectedEntities).toHaveLength(0);
    expect(state.selectedEntity).toBeNull();
  });
});
