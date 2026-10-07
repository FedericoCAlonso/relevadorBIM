import { describe, it, expect, beforeEach } from 'vitest';
import { useWallElevationStore } from '../useWallElevationViewModel';
import { useProjectStore } from '../useProjectStore';
import { computeNewNodeFromElevation } from '../../models/architecture/elevationPlacement';
import { placeElectricalElementInStore, useElectricalSequenceStore } from '../useElectricalViewModel';

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

  it('permite insertar una boca en el muro desde el alzado con auto-conexión secuencial', () => {
    const wall = useProjectStore.getState().project.walls.find((w) => w.id === 'wall-101')!;
    const verticesMap = new Map(useProjectStore.getState().project.vertices.map((v) => [v.id, v]));

    // Emplazar primer elemento (toma a 0.30m)
    const place1 = computeNewNodeFromElevation({
      wall,
      vertices: verticesMap,
      face: 'left',
      targetX: 1.0,
      targetZ: 0.30
    })!;

    expect(place1).not.toBeNull();
    expect(place1.side).toBe('left');
    expect(place1.wallOffset).toBe(1.0);
    expect(place1.heightZ).toBe(0.30);

    useElectricalSequenceStore.getState().resetAllSequenceState();
    const initialElements = useProjectStore.getState().project.electricalElements.length;
    const initialConduits = useProjectStore.getState().project.conduits.length;

    const node1 = placeElectricalElementInStore({
      worldX: place1.x,
      worldY: place1.y,
      symbolId: 'sym-planta-toma',
      snapInfo: {
        wallId: wall.id,
        wallOffset: place1.wallOffset,
        side: place1.side,
        rotationDeg: place1.rotationDeg
      },
      overrideHeightZ: place1.heightZ
    });

    expect(node1.id).toBeDefined();
    expect(useProjectStore.getState().project.electricalElements).toHaveLength(initialElements + 1);

    // Emplazar segundo elemento contiguo en el mismo muro (toma a 1.20m de X, 0.30m de Z)
    const place2 = computeNewNodeFromElevation({
      wall,
      vertices: verticesMap,
      face: 'left',
      targetX: 1.25,
      targetZ: 0.30
    })!;

    const node2 = placeElectricalElementInStore({
      worldX: place2.x,
      worldY: place2.y,
      symbolId: 'sym-planta-toma',
      snapInfo: {
        wallId: wall.id,
        wallOffset: place2.wallOffset,
        side: place2.side,
        rotationDeg: place2.rotationDeg
      },
      overrideHeightZ: place2.heightZ
    });

    expect(node2.id).toBeDefined();
    expect(useProjectStore.getState().project.electricalElements).toHaveLength(initialElements + 2);

    // Debe haberse auto-conectado con un conducto
    const conduits = useProjectStore.getState().project.conduits;
    expect(conduits).toHaveLength(initialConduits + 1);
    const addedConduit = conduits.find((c) => c.fromElementId === node1.id && c.toElementId === node2.id);
    expect(addedConduit).toBeDefined();
  });

  it('permite insertar un tablero principal desde el alzado', () => {
    const wall = useProjectStore.getState().project.walls.find((w) => w.id === 'wall-101')!;
    const verticesMap = new Map(useProjectStore.getState().project.vertices.map((v) => [v.id, v]));

    const placePanel = computeNewNodeFromElevation({
      wall,
      vertices: verticesMap,
      face: 'left',
      targetX: 2.0,
      targetZ: 1.40,
      boxWidthM: 0.40,
      boxHeightM: 0.50
    })!;

    expect(placePanel).not.toBeNull();
    expect(placePanel.heightZ).toBe(1.40);

    const panelNode = placeElectricalElementInStore({
      worldX: placePanel.x,
      worldY: placePanel.y,
      symbolId: 'sym-planta-tp',
      snapInfo: {
        wallId: wall.id,
        wallOffset: placePanel.wallOffset,
        side: placePanel.side,
        rotationDeg: placePanel.rotationDeg
      },
      overrideHeightZ: placePanel.heightZ
    });

    const panels = useProjectStore.getState().project.panels;
    expect(panels.some((p) => p.id === panelNode.id)).toBe(true);
    const addedPanel = panels.find((p) => p.id === panelNode.id)!;
    expect(addedPanel.heightZ).toBe(1.40);
    expect(addedPanel.wallId).toBe('wall-101');
    expect(addedPanel.isPlaced).toBe(true);
  });

  it('permite modificar dimensiones paramétricas de tableros (widthMM, heightMM, dinModules) y reflejarlas en el alzado', async () => {
    const { buildWallElevation } = await import('../../models/architecture/wallElevation');
    useProjectStore.getState().addPanel({
      id: 'pan-param-1',
      name: 'Tablero Seccional Paramétrico',
      type: 'seccional',
      levelId: 'level-1',
      spaceId: 's1',
      wallId: 'wall-101',
      x: 2.0,
      y: 0,
      heightZ: 1.40,
      isPlaced: true,
      symbolId: 'sym-planta-ts',
      incomings: [],
      widthMM: 300,
      heightMM: 400,
      dinModules: 24
    });

    const wall = useProjectStore.getState().project.walls.find((w) => w.id === 'wall-101')!;
    const verticesMap = new Map(useProjectStore.getState().project.vertices.map((v) => [v.id, v]));

    let elev = buildWallElevation({
      wall,
      vertices: verticesMap,
      face: 'left',
      openings: [],
      elements: [],
      panels: useProjectStore.getState().project.panels,
      conduits: [],
      circuits: [],
      spaces: []
    })!;

    let box = elev.boxes.find((b) => b.id === 'pan-param-1')!;
    expect(box).toBeDefined();
    expect(box.width).toBe(0.30);
    expect(box.height).toBe(0.40);
    expect(box.widthMM).toBe(300);
    expect(box.heightMM).toBe(400);
    expect(box.dinModules).toBe(24);

    // Modificar dimensiones del tablero a 48 módulos DIN (400x600mm)
    useProjectStore.getState().updatePanel('pan-param-1', {
      widthMM: 400,
      heightMM: 600,
      dinModules: 48
    });

    elev = buildWallElevation({
      wall,
      vertices: verticesMap,
      face: 'left',
      openings: [],
      elements: [],
      panels: useProjectStore.getState().project.panels,
      conduits: [],
      circuits: [],
      spaces: []
    })!;

    box = elev.boxes.find((b) => b.id === 'pan-param-1')!;
    expect(box.width).toBe(0.40);
    expect(box.height).toBe(0.60);
    expect(box.widthMM).toBe(400);
    expect(box.heightMM).toBe(600);
    expect(box.dinModules).toBe(48);
  });
});
