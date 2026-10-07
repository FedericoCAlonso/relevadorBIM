import { describe, it, expect, beforeEach } from 'vitest';
import { useWallElevationStore } from '../useWallElevationViewModel';
import { useProjectStore } from '../useProjectStore';

describe('useWallElevationStore', () => {
  beforeEach(() => {
    // Reset Zustand stores
    const projectStore = useProjectStore.getState();
    projectStore.resetProject();
    useWallElevationStore.getState().closeElevation();

    // Crear un muro de prueba en el project store
    useProjectStore.setState({
      project: {
        ...projectStore.project,
        vertices: [
          { id: 'v1', x: 0, y: 0 },
          { id: 'v2', x: 4, y: 0 }
        ],
        walls: [
          {
            id: 'wall-101',
            levelId: 'level-1',
            startVertexId: 'v1',
            endVertexId: 'v2',
            thickness: 0.15,
            height: 2.80,
            wallType: 'standard',
            justification: 'center'
          }
        ]
      }
    });
  });

  it('inicia cerrado por defecto con target nulo', () => {
    const state = useWallElevationStore.getState();
    expect(state.target).toBeNull();
    expect(state.selection).toBeNull();
  });

  it('abre la vista de alzado con el ID de muro especificado si existe en el proyecto', () => {
    useWallElevationStore.getState().openElevation('wall-101', 'left');
    const state = useWallElevationStore.getState();
    expect(state.target).not.toBeNull();
    expect(state.target?.wallId).toBe('wall-101');
    expect(state.target?.face).toBe('left');
  });

  it('ignora la apertura si el muro no existe en el proyecto', () => {
    useWallElevationStore.getState().openElevation('wall-inexistente');
    expect(useWallElevationStore.getState().target).toBeNull();
  });

  it('permite alternar la cara de observación del muro', () => {
    useWallElevationStore.getState().openElevation('wall-101', 'right');
    expect(useWallElevationStore.getState().target?.face).toBe('right');

    useWallElevationStore.getState().setFace('left');
    expect(useWallElevationStore.getState().target?.face).toBe('left');

    useWallElevationStore.getState().setFace('right');
    expect(useWallElevationStore.getState().target?.face).toBe('right');
  });

  it('gestiona la selección de cajas y aberturas', () => {
    const store = useWallElevationStore.getState();
    store.setSelection({ type: 'box', id: 'box-1' });
    expect(useWallElevationStore.getState().selection).toEqual({
      type: 'box',
      id: 'box-1'
    });

    store.setSelection({ type: 'opening', id: 'op-1' });
    expect(useWallElevationStore.getState().selection).toEqual({
      type: 'opening',
      id: 'op-1'
    });

    store.setSelection(null);
    expect(useWallElevationStore.getState().selection).toBeNull();
  });

  it('cierra la elevación y limpia selección', () => {
    useWallElevationStore.getState().openElevation('wall-101');
    useWallElevationStore.getState().setSelection({ type: 'box', id: 'box-1' });
    expect(useWallElevationStore.getState().target).not.toBeNull();

    useWallElevationStore.getState().closeElevation();
    const state = useWallElevationStore.getState();
    expect(state.target).toBeNull();
    expect(state.selection).toBeNull();
  });

  it('permite rotar y actualizar la orientación de la caja a horizontal en el store del proyecto', () => {
    useProjectStore.getState().addElectricalElement({
      id: 'elem-toma-1',
      levelId: 'level-1',
      spaceId: 's1',
      wallId: 'wall-101',
      x: 1,
      y: 0,
      heightZ: 1.10,
      placement: 'wall',
      symbolId: 'sym-planta-toma',
      side: 'left',
      boxOrientation: 'vertical',
      boxRotationDeg: 0
    });

    const { updateElectricalElement } = useProjectStore.getState();
    updateElectricalElement('elem-toma-1', {
      boxOrientation: 'horizontal',
      boxRotationDeg: 90
    });

    const elem = useProjectStore.getState().project.electricalElements.find((e) => e.id === 'elem-toma-1');
    expect(elem?.boxOrientation).toBe('horizontal');
    expect(elem?.boxRotationDeg).toBe(90);
  });

  it('permite seleccionar canalizaciones y actualizar su traza elevationRoute', () => {
    useProjectStore.getState().addElectricalElement({
      id: 'e1',
      levelId: 'level-1',
      spaceId: 's1',
      wallId: 'wall-101',
      x: 1,
      y: 0,
      heightZ: 0.30,
      placement: 'wall',
      symbolId: 'sym-toma',
      side: 'left'
    });
    useProjectStore.getState().addElectricalElement({
      id: 'e2',
      levelId: 'level-1',
      spaceId: 's1',
      wallId: 'wall-101',
      x: 3,
      y: 0,
      heightZ: 1.10,
      placement: 'wall',
      symbolId: 'sym-toma',
      side: 'left'
    });

    useProjectStore.getState().addConduit({
      id: 'cond-1',
      fromElementId: 'e1',
      toElementId: 'e2',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 22,
      material: 'hierro_semipesado',
      isVerticalRiser: false,
      conductors: [],
      routingPlane: 'wall'
    });

    // Selección de canalización
    useWallElevationStore.getState().setSelection({ type: 'conduit', id: 'cond-1' });
    expect(useWallElevationStore.getState().selection).toEqual({ type: 'conduit', id: 'cond-1' });

    // Actualizar traza en el proyecto
    useProjectStore.getState().updateConduit('cond-1', {
      elevationRoute: {
        wallId: 'wall-101',
        preset: 'top_bridge',
        points: [
          { u: 1, z: 0.3 },
          { u: 1, z: 2.5 },
          { u: 3, z: 2.5 },
          { u: 3, z: 1.1 }
        ]
      }
    });

    const cond = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-1');
    expect(cond?.elevationRoute?.preset).toBe('top_bridge');
    expect(cond?.elevationRoute?.points).toHaveLength(4);
  });
});
