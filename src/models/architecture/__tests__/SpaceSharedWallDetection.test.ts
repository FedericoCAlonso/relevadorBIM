import { describe, it, expect, beforeEach } from 'vitest';
import { findEnclosedCycles } from '../Space';
import { useProjectStore } from '../../../viewmodels/useProjectStore';

describe('Detección Robusta de Ambientes con Muro Compartido y 3 Paredes', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('1. Debe detectar 2 ambientes al agregar 3 paredes conectadas esquina a esquina a un ambiente existente', () => {
    const vertices = [
      // Ambiente 1 (4x4m)
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      // Ambiente 2 (3 paredes agregadas)
      { id: 'v5', x: 8, y: 4 },
      { id: 'v6', x: 8, y: 0 }
    ];

    const walls = [
      // Ambiente 1
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' }, // Muro compartido
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      // 3 paredes que cierran Ambiente 2
      { id: 'w5', startVertexId: 'v3', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v2' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('2. Debe detectar 2 ambientes cuando la 3ra pared tiene un desfasaje/gap milimétrico o de obra (undershoot de 1 a 15 cm)', () => {
    // Caso real de relevamiento con láser: la última pared no toca exactamente el vértice (4,0)
    // por falsa escuadra o espesor, quedando a (4.01, 0.02)
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v5', x: 8, y: 4 },
      { id: 'v6', x: 8, y: 0 },
      { id: 'v7_gap', x: 4.02, y: 0.01 } // Gap de 2 cm en X y 1 cm en Y
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      { id: 'w5', startVertexId: 'v3', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v7_gap' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('3. Debe detectar 2 ambientes cuando la 3ra pared sobrepasa (overshoot de 5 a 15 cm) la esquina de cierre', () => {
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v5', x: 8, y: 4 },
      { id: 'v6', x: 8, y: 0 },
      { id: 'v7_overshoot', x: 3.90, y: 0 } // Sobrepasa x=4 por 10 cm
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      { id: 'w5', startVertexId: 'v3', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v7_overshoot' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('4. Debe detectar 2 ambientes al agregar 3 paredes que cierran en empalme en T sobre un muro continuo largo', () => {
    const vertices = [
      // Muro continuo de 10m
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 10, y: 0 },
      { id: 'v3', x: 10, y: 5 },
      { id: 'v4', x: 0, y: 5 },
      // Segundo ambiente adosado en T entre x=2 y x=6 hacia y=-4
      { id: 'vT1', x: 2, y: 0 },
      { id: 'vA', x: 2, y: -4 },
      { id: 'vB', x: 6, y: -4 },
      { id: 'vT2', x: 6, y: -0.05 } // 5 cm de tolerancia de llegada contra el muro continuo
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' }, // Muro continuo (0,0) a (10,0)
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      // 3 paredes agregadas
      { id: 'w5', startVertexId: 'vT1', endVertexId: 'vA' },
      { id: 'w6', startVertexId: 'vA', endVertexId: 'vB' },
      { id: 'w7', startVertexId: 'vB', endVertexId: 'vT2' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('5. Flujo integral en el Store: crear Cuarto 1 y luego agregar 3 paredes con addWallFromAnchor', () => {
    const store = useProjectStore.getState();

    // 1. Crear Cuarto 1 (4x3m)
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 2, y: 2 },
      lengthM: 4.0,
      angleDeg: 0,
      justification: 'interior'
    })!.wall;

    const w2 = store.addWallFromAnchor({
      startVertexId: w1.endVertexId,
      lengthM: 3.0,
      angleDeg: 90,
      justification: 'interior'
    })!.wall;

    const w3 = store.addWallFromAnchor({
      startVertexId: w2.endVertexId,
      lengthM: 4.0,
      angleDeg: 180,
      justification: 'interior'
    })!.wall;

    const w4 = store.addWallFromAnchor({
      startVertexId: w3.endVertexId,
      lengthM: 3.0,
      angleDeg: 270,
      justification: 'interior'
    })!.wall;

    expect(w4.endVertexId).toBe(w1.startVertexId);
    expect(useProjectStore.getState().project.spaces.length).toBe(1);

    // 2. Anclar en la esquina superior derecha (6,5) = w2.endVertexId
    // Pared 1: hacia el Este (angle 0°), 4m
    const w5 = store.addWallFromAnchor({
      startVertexId: w2.endVertexId,
      lengthM: 4.0,
      angleDeg: 0,
      justification: 'interior'
    })!.wall;

    // Pared 2: hacia el Sur (angle 270°), 3m
    const w6 = store.addWallFromAnchor({
      startVertexId: w5.endVertexId,
      lengthM: 3.0,
      angleDeg: 270,
      justification: 'interior'
    })!.wall;

    // Pared 3: hacia el Oeste (angle 180°), con cota medida libre de 3.95m (5cm de falsa escuadra)
    const w7Res = store.addWallFromAnchor({
      startVertexId: w6.endVertexId,
      lengthM: 3.95,
      angleDeg: 180,
      justification: 'interior'
    });

    expect(w7Res).not.toBeNull();
    // La imantación magnética debe enganchar a la esquina w2.startVertexId
    expect(w7Res!.endVertexId).toBe(w2.startVertexId);

    const spaces = useProjectStore.getState().project.spaces;
    expect(spaces.length).toBe(2);

    // Los dos ambientes deben tener identificadores únicos
    const ids = new Set(spaces.map((s) => s.id));
    expect(ids.size).toBe(2);
  });
});
