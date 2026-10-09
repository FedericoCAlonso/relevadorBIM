import { describe, it, expect, beforeEach } from 'vitest';
import {
  useCeilingPlanStore,
  setCeilingMaterialInStore,
  addCeilingBoxInStore,
  centerCeilingBoxInStore,
  deleteCeilingBoxInStore,
  distributeCeilingBoxesInStore
} from '../useCeilingPlanViewModel';
import { useProjectStore } from '../useProjectStore';

describe('ViewModel: Plano de Cielorraso Reflejado (useCeilingPlanViewModel)', () => {
  beforeEach(() => {
    const projectStore = useProjectStore.getState();
    projectStore.resetProject();
    useCeilingPlanStore.getState().closeCeilingPlan();

    // Crear un ambiente cerrado de prueba de 6x4m
    useProjectStore.setState({
      project: {
        ...projectStore.project,
        activeLevelId: 'lvl-1',
        vertices: [
          { id: 'v1', x: 0, y: 0 },
          { id: 'v2', x: 6, y: 0 },
          { id: 'v3', x: 6, y: 4 },
          { id: 'v4', x: 0, y: 4 }
        ],
        walls: [
          { id: 'w1', startVertexId: 'v1', endVertexId: 'v2', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false },
          { id: 'w2', startVertexId: 'v2', endVertexId: 'v3', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false },
          { id: 'w3', startVertexId: 'v3', endVertexId: 'v4', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false },
          { id: 'w4', startVertexId: 'v4', endVertexId: 'v1', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false }
        ],
        spaces: [
          {
            id: 'sp-101',
            name: 'Living Comedor',
            category: 'living',
            levelId: 'lvl-1',
            ceilingHeight: 2.70,
            floorElevation: 0,
            boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
            wallIds: ['w1', 'w2', 'w3', 'w4'],
            coverType: 'cubierto'
          }
        ],
        electricalElements: []
      }
    });
  });

  it('inicia cerrado por defecto con activeSpaceId nulo', () => {
    const state = useCeilingPlanStore.getState();
    expect(state.activeSpaceId).toBeNull();
    expect(state.selectedBoxId).toBeNull();
    expect(state.showDimensions).toBe(true);
    expect(state.showWallDrops).toBe(true);
  });

  it('abre la vista de cielorraso y permite seleccionar bocas y alternar modos', () => {
    const store = useCeilingPlanStore.getState();
    store.openCeilingPlan('sp-101');

    expect(useCeilingPlanStore.getState().activeSpaceId).toBe('sp-101');

    store.toggleDimensions();
    expect(useCeilingPlanStore.getState().showDimensions).toBe(false);

    store.toggleWallDrops();
    expect(useCeilingPlanStore.getState().showWallDrops).toBe(false);

    store.setSelectedBoxId('box-123');
    expect(useCeilingPlanStore.getState().selectedBoxId).toBe('box-123');

    store.closeCeilingPlan();
    expect(useCeilingPlanStore.getState().activeSpaceId).toBeNull();
    expect(useCeilingPlanStore.getState().selectedBoxId).toBeNull();
  });

  it('permite cambiar la materialidad del cielorraso en el store del proyecto', () => {
    setCeilingMaterialInStore('sp-101', 'suspendido_yeso');

    const space = useProjectStore.getState().project.spaces.find(s => s.id === 'sp-101');
    expect(space?.ceilingMaterial).toBe('suspendido_yeso');
  });

  it('permite añadir una boca cenital en una posición métrica del cielorraso', () => {
    const elementId = addCeilingBoxInStore('sp-101', { x: 2.5, y: 1.8 });

    expect(elementId).toBeDefined();
    const element = useProjectStore.getState().project.electricalElements.find(e => e.id === elementId);
    expect(element).toBeDefined();
    expect(element!.placement).toBe('ceiling');
    expect(element!.spaceId).toBe('sp-101');
    expect(element!.x).toBe(2.5);
    expect(element!.y).toBe(1.8);
  });

  it('centra automáticamente una luminaria en el centroide del ambiente', () => {
    // Para un ambiente rectangular de (0,0) a (6,4), el centroide es exactamente (3.0, 2.0)
    const centeredId = centerCeilingBoxInStore('sp-101');

    expect(centeredId).toBeDefined();
    const element = useProjectStore.getState().project.electricalElements.find(e => e.id === centeredId);
    expect(element).toBeDefined();
    expect(element!.x).toBeCloseTo(3.0, 2);
    expect(element!.y).toBeCloseTo(2.0, 2);
    expect(element!.placement).toBe('ceiling');
  });

  it('permite eliminar una boca cenital del cielorraso', () => {
    const elementId = addCeilingBoxInStore('sp-101', { x: 1.0, y: 1.0 });
    expect(useProjectStore.getState().project.electricalElements.length).toBe(1);

    deleteCeilingBoxInStore(elementId);
    expect(useProjectStore.getState().project.electricalElements.length).toBe(0);
  });

  it('permite distribuir múltiples bocas simétricamente reemplazando las anteriores', () => {
    // 1 boca inicial existente
    addCeilingBoxInStore('sp-101', { x: 3.0, y: 2.0 });
    expect(useProjectStore.getState().project.electricalElements.length).toBe(1);

    // Distribuir 4 bocas (matriz 2x2) reemplazando la existente
    const positions = [
      { x: 1.5, y: 1.0 },
      { x: 4.5, y: 1.0 },
      { x: 1.5, y: 3.0 },
      { x: 4.5, y: 3.0 }
    ];
    const createdIds = distributeCeilingBoxesInStore('sp-101', positions, true);

    expect(createdIds.length).toBe(4);
    const elements = useProjectStore.getState().project.electricalElements;
    expect(elements.length).toBe(4);
    expect(elements.every(e => e.placement === 'ceiling')).toBe(true);
    expect(elements.every(e => e.spaceId === 'sp-101')).toBe(true);
  });

  it('permite activar y alternar el modo de colocación directa al tocar (placeMode)', () => {
    const store = useCeilingPlanStore.getState();
    expect(store.isPlaceMode).toBe(false);

    store.togglePlaceMode();
    expect(useCeilingPlanStore.getState().isPlaceMode).toBe(true);

    store.setPlaceMode(false);
    expect(useCeilingPlanStore.getState().isPlaceMode).toBe(false);
  });
});

