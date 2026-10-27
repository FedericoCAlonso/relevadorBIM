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

  it('debe redimensionar la longitud en bloque en modo absoluto respetando orientaciones', () => {
    const store = useProjectStore.getState();

    // w1: de (0,0) a (3,0) -> largo 3.0 m, horizontal
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 3.0,
      angleDeg: 0,
      thickness: 0.15
    })!.wall;

    // w2: de (0,5) a (0,9) -> largo 4.0 m, vertical
    const w2 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 5 },
      lengthM: 4.0,
      angleDeg: 90,
      thickness: 0.20
    })!.wall;

    // Fijar ambas paredes a 6.0 m de largo
    store.batchUpdateWallLengths([w1.id, w2.id], 6.0, 'absolute');

    const project = useProjectStore.getState().project;
    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

    const v1End = verticesMap.get(w1.endVertexId)!;
    const v2End = verticesMap.get(w2.endVertexId)!;

    // w1 ahora llega hasta x = 6.0, y = 0
    expect(v1End.x).toBeCloseTo(6.0, 2);
    expect(v1End.y).toBeCloseTo(0, 2);

    // w2 ahora llega hasta x = 0, y = 11.0 (5 + 6)
    expect(v2End.x).toBeCloseTo(0, 2);
    expect(v2End.y).toBeCloseTo(11.0, 2);

    // Espesores siguen intactos
    const updatedW1 = project.walls.find((w) => w.id === w1.id)!;
    const updatedW2 = project.walls.find((w) => w.id === w2.id)!;
    expect(updatedW1.thickness).toBe(0.15);
    expect(updatedW2.thickness).toBe(0.20);
  });

  it('debe aplicar incrementos y decrementos delta en bloque a paredes de longitudes heterogéneas', () => {
    const store = useProjectStore.getState();

    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 3.0,
      angleDeg: 0
    })!.wall;

    const w2 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 5 },
      lengthM: 5.0,
      angleDeg: 0
    })!.wall;

    // Incrementar en +0.50 m ambas paredes
    store.batchUpdateWallLengths([w1.id, w2.id], 0.50, 'delta');

    let project = useProjectStore.getState().project;
    let verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

    let v1End = verticesMap.get(w1.endVertexId)!;
    let v2End = verticesMap.get(w2.endVertexId)!;

    expect(v1End.x).toBeCloseTo(3.50, 2);
    expect(v2End.x).toBeCloseTo(5.50, 2);

    // Decrementar en -1.0 m ambas paredes
    store.batchUpdateWallLengths([w1.id, w2.id], -1.0, 'delta');

    project = useProjectStore.getState().project;
    verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

    v1End = verticesMap.get(w1.endVertexId)!;
    v2End = verticesMap.get(w2.endVertexId)!;

    expect(v1End.x).toBeCloseTo(2.50, 2);
    expect(v2End.x).toBeCloseTo(4.50, 2);
  });

  it('debe ajustar la posición de aberturas existentes al redimensionar paredes en bloque', () => {
    const store = useProjectStore.getState();

    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!.wall;

    // Insertar una ventana en el centro (distancia 2.0 m)
    store.addOpeningDirect({
      wallId: w1.id,
      distanceAlongWall: 2.0,
      width: 1.0,
      height: 1.1,
      sill: 1.0,
      type: 'window'
    });

    // Extender el muro a 8.0 m
    store.batchUpdateWallLengths([w1.id], 8.0, 'absolute');

    const project = useProjectStore.getState().project;
    const op = project.openings.find((o) => o.wallId === w1.id)!;

    // La abertura debe haber sido reajustada proporcional o posicionalmente
    expect(op).toBeDefined();
    expect(op.distanceAlongWall).toBeGreaterThan(0);
    expect(op.distanceAlongWall + op.width).toBeLessThanOrEqual(8.0);
  });
});
