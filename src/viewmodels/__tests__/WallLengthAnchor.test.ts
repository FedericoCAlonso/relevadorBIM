import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';

describe('Wall Length Modification with Pinned Anchor (Controlled Falsa Escuadra)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe alargar la pared fijando el vértice de inicio (start) y desplazando el vértice final', () => {
    const store = useProjectStore.getState();

    // Pared de (0,0) a (4,0)
    const w = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!.wall;

    // Fijar inicio explícitamente y alargar a 5.5 m
    store.updateWallLength(w.id, 5.5, 'start');

    const project = useProjectStore.getState().project;
    const vStart = project.vertices.find((v) => v.id === w.startVertexId)!;
    const vEnd = project.vertices.find((v) => v.id === w.endVertexId)!;

    // vStart permanece inmóvil en (0,0)
    expect(vStart.x).toBeCloseTo(0.0, 3);
    expect(vStart.y).toBeCloseTo(0.0, 3);

    // vEnd se desplaza a (5.5, 0)
    expect(vEnd.x).toBeCloseTo(5.5, 3);
    expect(vEnd.y).toBeCloseTo(0.0, 3);
  });

  it('debe alargar la pared fijando el vértice final (end) y desplazando el vértice de inicio', () => {
    const store = useProjectStore.getState();

    // Pared de (0,0) a (4,0)
    const w = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!.wall;

    // Fijar extremo final y alargar a 6.0 m
    store.updateWallLength(w.id, 6.0, 'end');

    const project = useProjectStore.getState().project;
    const vStart = project.vertices.find((v) => v.id === w.startVertexId)!;
    const vEnd = project.vertices.find((v) => v.id === w.endVertexId)!;

    // vEnd permanece inmóvil en (4,0)
    expect(vEnd.x).toBeCloseTo(4.0, 3);
    expect(vEnd.y).toBeCloseTo(0.0, 3);

    // vStart se desplaza hacia atrás a (-2, 0) para que el largo sea 6.0 m
    expect(vStart.x).toBeCloseTo(-2.0, 3);
    expect(vStart.y).toBeCloseTo(0.0, 3);
  });

  it('debe alargar simétricamente la pared desde el centro (center)', () => {
    const store = useProjectStore.getState();

    // Pared de (0,0) a (4,0), punto medio en (2,0)
    const w = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!.wall;

    // Alargar a 6.0 m desde el centro (+1.0 m a cada lado)
    store.updateWallLength(w.id, 6.0, 'center');

    const project = useProjectStore.getState().project;
    const vStart = project.vertices.find((v) => v.id === w.startVertexId)!;
    const vEnd = project.vertices.find((v) => v.id === w.endVertexId)!;

    expect(vStart.x).toBeCloseTo(-1.0, 3);
    expect(vStart.y).toBeCloseTo(0.0, 3);

    expect(vEnd.x).toBeCloseTo(5.0, 3);
    expect(vEnd.y).toBeCloseTo(0.0, 3);
  });

  it('debe respetar selectedWallAnchorMode del store si no se pasa anchorMode explícito', () => {
    const store = useProjectStore.getState();

    const w = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!.wall;

    // El usuario tocó el nodo vEnd en el lienzo o selector -> setSelectedWallAnchorMode('end')
    store.setSelectedWallAnchorMode('end');

    // Modificamos a 5.0m sin especificar anchorMode
    store.updateWallLength(w.id, 5.0);

    const project = useProjectStore.getState().project;
    const vStart = project.vertices.find((v) => v.id === w.startVertexId)!;
    const vEnd = project.vertices.find((v) => v.id === w.endVertexId)!;

    // Como selectedWallAnchorMode era 'end', vEnd debe quedar fijo y vStart debe moverse a (-1, 0)
    expect(vEnd.x).toBeCloseTo(4.0, 3);
    expect(vStart.x).toBeCloseTo(-1.0, 3);
  });

  it('debe deformar con falsa escuadra controlada manteniendo la unión de esquinas en un recinto cerrado', () => {
    const store = useProjectStore.getState();

    // Muro 1 (Sur): (0,0) a (4,0)
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    })!.wall;

    // Muro 2 (Este): (4,0) a (4,3) conectado a w1.endVertexId
    const w2 = store.addWallFromAnchor({
      startVertexId: w1.endVertexId,
      lengthM: 3.0,
      angleDeg: 90
    })!.wall;

    // Muro 3 (Norte): (4,3) a (0,3)
    const w3 = store.addWallFromAnchor({
      startVertexId: w2.endVertexId,
      lengthM: 4.0,
      angleDeg: 180
    })!.wall;

    // Muro 4 (Oeste): (0,3) a (0,0)
    const w4 = store.addWallFromAnchor({
      startVertexId: w3.endVertexId,
      lengthM: 3.0,
      angleDeg: 270
    })!.wall;

    expect(w4.endVertexId).toBe(w1.startVertexId);

    // Seleccionamos w1 (Sur), fijamos su inicio (0,0) y alargamos a 4.5 m (falsa escuadra real)
    store.updateWallLength(w1.id, 4.5, 'start');

    const project = useProjectStore.getState().project;
    const cornerSE = project.vertices.find((v) => v.id === w1.endVertexId)!;

    // La esquina SE se desplazó a x = 4.5
    expect(cornerSE.x).toBeCloseTo(4.5, 3);
    expect(cornerSE.y).toBeCloseTo(0.0, 3);

    // Muro 2 (Este) sigue compartiendo la misma esquina cornerSE:
    // ahora va de (4.5, 0) a (4.0, 3.0) -> ¡Ángulo con falsa escuadra perfecta, NO se desconectó!
    const updatedW2 = project.walls.find((w) => w.id === w2.id)!;
    expect(updatedW2.startVertexId).toBe(cornerSE.id);

    const cornerNE = project.vertices.find((v) => v.id === w2.endVertexId)!;
    expect(cornerNE.x).toBeCloseTo(4.0, 3);
    expect(cornerNE.y).toBeCloseTo(3.0, 3);

    // La distancia de w2 ahora es hypot(4.0 - 4.5, 3.0 - 0.0) = hypot(-0.5, 3.0) = 3.041m
    const w2Len = Math.hypot(cornerNE.x - cornerSE.x, cornerNE.y - cornerSE.y);
    expect(w2Len).toBeCloseTo(3.041, 2);
  });
});
