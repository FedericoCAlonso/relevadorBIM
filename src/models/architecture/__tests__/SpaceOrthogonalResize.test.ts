import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import {
  getSpaceOrthogonalDimensions,
  resizeSpaceOrthogonal
} from '../SpaceOrthogonalResize';

describe('SpaceOrthogonalResize (Ajuste Rápido de Dimensiones de Ambiente)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  function createRectangularRoom(width: number, length: number) {
    const store = useProjectStore.getState();

    // w1 (Sur): de (0,0) a (width, 0)
    const w1 = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: width,
      angleDeg: 0
    })!.wall;

    // w2 (Este): de (width, 0) a (width, length)
    const w2 = store.addWallFromAnchor({
      startVertexId: w1.endVertexId,
      lengthM: length,
      angleDeg: 90
    })!.wall;

    // w3 (Norte): de (width, length) a (0, length)
    const w3 = store.addWallFromAnchor({
      startVertexId: w2.endVertexId,
      lengthM: width,
      angleDeg: 180
    })!.wall;

    // w4 (Oeste): de (0, length) a (0, 0)
    store.addWallFromAnchor({
      startVertexId: w3.endVertexId,
      lengthM: length,
      angleDeg: 270
    });

    const spaces = useProjectStore.getState().project.spaces;
    return spaces[0];
  }

  it('debe calcular las dimensiones ortogonales ancho x largo de un recinto cerrado', () => {
    const space = createRectangularRoom(4.0, 5.0);
    expect(space).toBeDefined();

    const dims = getSpaceOrthogonalDimensions(space, useProjectStore.getState().project);
    expect(dims.widthM).toBeCloseTo(4.0, 2);
    expect(dims.lengthM).toBeCloseTo(5.0, 2);
  });

  it('debe expandir el largo (Y) hacia el extremo positivo manteniendo la forma rectangular de 4x5 a 4x5.5', () => {
    const space = createRectangularRoom(4.0, 5.0);
    const initialProject = useProjectStore.getState().project;

    // Aumentar de 5.0 a 5.5 hacia el extremo positivo (+Y)
    const updatedProject = resizeSpaceOrthogonal({
      spaceId: space.id,
      project: initialProject,
      axis: 'length',
      newDimensionM: 5.5,
      direction: 'positive'
    });

    const spaceDims = getSpaceOrthogonalDimensions(space, updatedProject);
    expect(spaceDims.widthM).toBeCloseTo(4.0, 2);
    expect(spaceDims.lengthM).toBeCloseTo(5.5, 2);

    // Verificar coordenadas de los vértices:
    // Los vértices con y=0 siguen en y=0
    // Los vértices con y=5 ahora están en y=5.5
    const topVertices = updatedProject.vertices.filter((v) => Math.abs(v.y - 5.5) < 0.01);
    expect(topVertices).toHaveLength(2);

    const bottomVertices = updatedProject.vertices.filter((v) => Math.abs(v.y - 0.0) < 0.01);
    expect(bottomVertices).toHaveLength(2);
  });

  it('debe expandir el ancho (X) hacia la derecha de 4x5 a 4.6x5 manteniendo la rectangularidad', () => {
    const space = createRectangularRoom(4.0, 5.0);
    const initialProject = useProjectStore.getState().project;

    const updatedProject = resizeSpaceOrthogonal({
      spaceId: space.id,
      project: initialProject,
      axis: 'width',
      newDimensionM: 4.6,
      direction: 'positive'
    });

    const spaceDims = getSpaceOrthogonalDimensions(space, updatedProject);
    expect(spaceDims.widthM).toBeCloseTo(4.6, 2);
    expect(spaceDims.lengthM).toBeCloseTo(5.0, 2);

    const rightVertices = updatedProject.vertices.filter((v) => Math.abs(v.x - 4.6) < 0.01);
    expect(rightVertices).toHaveLength(2);
  });

  it('debe expandir simétricamente desde el centro en ambos sentidos', () => {
    const space = createRectangularRoom(4.0, 5.0);
    const initialProject = useProjectStore.getState().project;

    // Alargar ancho de 4.0 a 6.0 (+1.0 a cada lado)
    const updatedProject = resizeSpaceOrthogonal({
      spaceId: space.id,
      project: initialProject,
      axis: 'width',
      newDimensionM: 6.0,
      direction: 'center'
    });

    const spaceDims = getSpaceOrthogonalDimensions(space, updatedProject);
    expect(spaceDims.widthM).toBeCloseTo(6.0, 2);
    expect(spaceDims.minX).toBeCloseTo(-1.0, 2);
    expect(spaceDims.maxX).toBeCloseTo(5.0, 2);
  });
});
