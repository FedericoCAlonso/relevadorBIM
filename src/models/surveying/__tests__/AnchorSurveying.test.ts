import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../../viewmodels/useProjectStore';

describe('Flujo de Relevamiento por Puntos de Referencia (useProjectStore)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe encadenar 4 muros tramo a tramo y cerrar el perímetro con snap automático', () => {
    const store = useProjectStore.getState();

    // 1. Trazar primer muro: 4.00m hacia el Este (0°) desde (0,0)
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    });

    expect(w1).not.toBeNull();
    expect(useProjectStore.getState().project.walls.length).toBe(1);
    expect(useProjectStore.getState().project.vertices.length).toBe(2);

    // 2. Desde el extremo final (4, 0), doblar al Norte (90°) por 3.00m
    const w2 = useProjectStore.getState().addWallFromAnchor({
      startVertexId: w1!.endVertexId,
      lengthM: 3.0,
      angleDeg: 90
    });

    expect(w2).not.toBeNull();
    expect(useProjectStore.getState().project.walls.length).toBe(2);
    expect(useProjectStore.getState().project.vertices.length).toBe(3);

    // 3. Desde el extremo (4, 3), doblar al Oeste (180°) por 4.00m
    const w3 = useProjectStore.getState().addWallFromAnchor({
      startVertexId: w2!.endVertexId,
      lengthM: 4.0,
      angleDeg: 180
    });

    expect(w3).not.toBeNull();
    expect(useProjectStore.getState().project.walls.length).toBe(3);
    expect(useProjectStore.getState().project.vertices.length).toBe(4);

    // 4. Desde el extremo (0, 3), doblar al Sur (270°) por 3.00m
    // ¡Debe cerrar sobre el vértice inicial (0,0) sin crear un 5to vértice!
    const w4 = useProjectStore.getState().addWallFromAnchor({
      startVertexId: w3!.endVertexId,
      lengthM: 3.0,
      angleDeg: 270
    });

    expect(w4).not.toBeNull();
    expect(useProjectStore.getState().project.walls.length).toBe(4);
    // El total de vértices debe ser 4 exactamente (cerró sobre el origen con snap)
    expect(useProjectStore.getState().project.vertices.length).toBe(4);
    expect(useProjectStore.getState().project.spaces.length).toBe(1);
    expect(useProjectStore.getState().project.spaces[0].ceilingHeight).toBe(2.70);
  });

  it('debe crear un empalme en T perpendicular a partir de una distancia sobre un muro existente', () => {
    const store = useProjectStore.getState();

    // Muro base de 5.00m hacia el Este
    store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 5.0,
      angleDeg: 0
    });

    const hostWall = useProjectStore.getState().project.walls[0];
    const refVertexId = hostWall.startVertexId;

    // Empalme en T a 2.00m de la esquina, largo 2.50m hacia la izquierda (+Y)
    const teeWall = useProjectStore.getState().addBranchWallFromOffset({
      hostWallId: hostWall.id,
      referenceVertexId: refVertexId,
      offsetM: 2.0,
      branchLengthM: 2.5,
      side: 'left'
    });

    expect(teeWall).not.toBeNull();
    expect(useProjectStore.getState().project.walls.length).toBe(2);

    const vertices = useProjectStore.getState().project.vertices;
    const rootVertex = vertices.find((v) => v.id === teeWall!.startVertexId);
    const endVertex = vertices.find((v) => v.id === teeWall!.endVertexId);

    expect(rootVertex?.x).toBeCloseTo(2.0, 2);
    expect(rootVertex?.y).toBeCloseTo(0.0, 2);
    expect(endVertex?.x).toBeCloseTo(2.0, 2);
    expect(endVertex?.y).toBeCloseTo(2.5, 2);
  });

  it('debe insertar una puerta referenciada a la esquina del muro', () => {
    const store = useProjectStore.getState();

    store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    });

    const wall = useProjectStore.getState().project.walls[0];

    // Insertar puerta a 0.80m de la esquina de inicio, ancho 0.80m
    const opening = useProjectStore.getState().addOpeningReferenced({
      hostWallId: wall.id,
      referenceVertexId: wall.startVertexId,
      offsetToJambM: 0.80,
      widthM: 0.80,
      type: 'door'
    });

    expect(opening).not.toBeNull();
    expect(opening?.distanceAlongWall).toBeCloseTo(0.80, 2);
    expect(useProjectStore.getState().project.openings.length).toBe(1);
  });

  it('debe permitir renombrar un ambiente y modificar la altura de techo h', () => {
    const store = useProjectStore.getState();

    // 1. Trazar habitación cuadrada de 4x4m
    const w1 = store.addWallFromAnchor({ startCoord: { x: 0, y: 0 }, lengthM: 4.0, angleDeg: 0 })!;
    const w2 = store.addWallFromAnchor({ startVertexId: w1.endVertexId, lengthM: 4.0, angleDeg: 90 })!;
    const w3 = store.addWallFromAnchor({ startVertexId: w2.endVertexId, lengthM: 4.0, angleDeg: 180 })!;
    store.addWallFromAnchor({ startVertexId: w3.endVertexId, lengthM: 4.0, angleDeg: 270 })!;

    const state = useProjectStore.getState();
    expect(state.project.spaces.length).toBe(1);

    const detectedSpace = state.project.spaces[0];
    expect(detectedSpace.ceilingHeight).toBe(2.70);

    // 2. Renombrar a "Dormitorio Principal" y fijar h = 3.00m
    store.updateSpace(detectedSpace.id, {
      name: 'Dormitorio Principal',
      ceilingHeight: 3.00
    });

    const updatedSpace = useProjectStore.getState().project.spaces[0];
    expect(updatedSpace.name).toBe('Dormitorio Principal');
    expect(updatedSpace.ceilingHeight).toBe(3.00);
  });

  it('debe clavar puerta y ventana en el muro y permitir eliminar abertura individualmente', () => {
    const store = useProjectStore.getState();

    const w1 = store.addWallFromAnchor({ startCoord: { x: 0, y: 0 }, lengthM: 5.0, angleDeg: 0 })!;
    const wallId = w1.wall.id;
    const refVertexId = w1.wall.startVertexId;

    // Insertar Puerta
    const door = store.addOpeningReferenced({
      hostWallId: wallId,
      referenceVertexId: refVertexId,
      offsetToJambM: 0.50,
      widthM: 0.80,
      type: 'door'
    })!;

    // Insertar Ventana
    const window = store.addOpeningReferenced({
      hostWallId: wallId,
      referenceVertexId: refVertexId,
      offsetToJambM: 2.20,
      widthM: 1.20,
      type: 'window'
    })!;

    expect(useProjectStore.getState().project.openings.length).toBe(2);

    // Eliminar la puerta
    store.deleteOpening(door.id);
    const openingsAfterDelete = useProjectStore.getState().project.openings;
    expect(openingsAfterDelete.length).toBe(1);
    expect(openingsAfterDelete[0].id).toBe(window.id);
    expect(openingsAfterDelete[0].type).toBe('window');
  });
});

