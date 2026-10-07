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
});
