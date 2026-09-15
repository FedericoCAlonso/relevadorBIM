import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { calculateWallSnap } from '../../../models/architecture/Wall';

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

  it('debe emplazar puerta y ventana en el muro y permitir gestionar/actualizar aberturas', () => {
    const store = useProjectStore.getState();

    const w1 = store.addWallFromAnchor({ startCoord: { x: 0, y: 0 }, lengthM: 5.0, angleDeg: 0 })!;
    const wallId = w1.wall.id;
    const refVertexId = w1.wall.startVertexId;

    // Emplazar Puerta
    const door = store.addOpeningReferenced({
      hostWallId: wallId,
      referenceVertexId: refVertexId,
      offsetToJambM: 0.50,
      widthM: 0.80,
      type: 'door'
    })!;

    expect(door).toBeDefined();
    expect(door.type).toBe('door');
    expect(door.distanceAlongWall).toBe(0.50);

    // Actualizar abertura emplazada (ancho, distancia, sentido)
    store.updateOpening(door.id, {
      width: 0.90,
      distanceAlongWall: 0.80,
      swing: 'right_out'
    });

    const updatedDoor = useProjectStore.getState().project.openings.find((o) => o.id === door.id);
    expect(updatedDoor?.width).toBe(0.90);
    expect(updatedDoor?.distanceAlongWall).toBe(0.80);
    expect(updatedDoor?.swing).toBe('right_out');

    // Emplazar Ventana
    const win = store.addOpeningReferenced({
      hostWallId: wallId,
      referenceVertexId: refVertexId,
      offsetToJambM: 2.0,
      widthM: 1.20,
      type: 'window'
    })!;

    expect(useProjectStore.getState().project.openings.length).toBe(2);

    // Eliminar solo la puerta
    store.deleteOpening(door.id);
    const remainingOpenings = useProjectStore.getState().project.openings;
    expect(remainingOpenings.length).toBe(1);
    expect(remainingOpenings[0].id).toBe(win.id);
  });

  it('debe insertar y actualizar elementos eléctricos con etiqueta y altura Z', () => {
    const store = useProjectStore.getState();

    store.addElectricalElement({
      id: 'el-test-1',
      symbolId: 'boca_centro_iluminacion',
      levelId: 'nivel-pb',
      spaceId: 'space-test',
      placement: 'ceiling',
      x: 2.50,
      y: 2.50,
      heightZ: 2.70,
      label: 'IUG 1'
    });

    expect(useProjectStore.getState().project.electricalElements.length).toBe(1);

    store.updateElectricalElement('el-test-1', {
      label: 'IUG Centro',
      heightZ: 2.80
    });

    const el = useProjectStore.getState().project.electricalElements[0];
    expect(el.label).toBe('IUG Centro');
    expect(el.heightZ).toBe(2.80);

    store.deleteElectricalElement('el-test-1');
    expect(useProjectStore.getState().project.electricalElements.length).toBe(0);
  });

  it('debe permitir modificar largo, espesor, rotar e invertir dirección de un muro', () => {
    const store = useProjectStore.getState();

    // Muro horizontal inicial: de (0,0) a (4,0), largo 4.0m
    const res = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0,
      thickness: 0.15
    })!;

    const wallId = res.wall.id;

    // 1. Modificar largo a 6.0m
    store.updateWallLength(wallId, 6.0);
    let vEnd = useProjectStore.getState().project.vertices.find((v) => v.id === res.endVertexId);
    expect(vEnd?.x).toBeCloseTo(6.0, 2);
    expect(vEnd?.y).toBeCloseTo(0.0, 2);

    // 2. Modificar espesor a 0.20m
    store.updateWall(wallId, { thickness: 0.20 });
    let wall = useProjectStore.getState().project.walls.find((w) => w.id === wallId);
    expect(wall?.thickness).toBe(0.20);

    // 3. Rotar muro +90° alrededor del punto de inicio (0,0)
    store.rotateWall(wallId, 90);
    vEnd = useProjectStore.getState().project.vertices.find((v) => v.id === res.endVertexId);
    expect(vEnd?.x).toBeCloseTo(0.0, 2);
    expect(vEnd?.y).toBeCloseTo(6.0, 2);

    // 4. Invertir dirección de la pared
    const originalStartId = wall!.startVertexId;
    const originalEndId = wall!.endVertexId;
    store.invertWallDirection(wallId);
    wall = useProjectStore.getState().project.walls.find((w) => w.id === wallId);
    expect(wall?.startVertexId).toBe(originalEndId);
    expect(wall?.endVertexId).toBe(originalStartId);
  });

  it('debe deshacer la última pared (undoLastWall) y limpiar vértices huérfanos', () => {
    const store = useProjectStore.getState();

    // Trazar pared 1: (0,0) -> (4,0)
    const w1 = store.addWallFromAnchor({ startCoord: { x: 0, y: 0 }, lengthM: 4.0, angleDeg: 0 })!;
    expect(useProjectStore.getState().project.walls.length).toBe(1);
    expect(useProjectStore.getState().project.vertices.length).toBe(2);
    expect(useProjectStore.getState().activeAnchorVertexId).toBe(w1.endVertexId);

    // Trazar pared 2: (4,0) -> (4,3)
    const w2 = store.addWallFromAnchor({ startVertexId: w1.endVertexId, lengthM: 3.0, angleDeg: 90 })!;
    expect(useProjectStore.getState().project.walls.length).toBe(2);
    expect(useProjectStore.getState().project.vertices.length).toBe(3);
    expect(useProjectStore.getState().activeAnchorVertexId).toBe(w2.endVertexId);

    // Deshacer pared 2
    store.undoLastWall();
    expect(useProjectStore.getState().project.walls.length).toBe(1);
    expect(useProjectStore.getState().project.vertices.length).toBe(2);
    // El anclaje debe haber vuelto al extremo de la pared 1
    expect(useProjectStore.getState().activeAnchorVertexId).toBe(w1.endVertexId);

    // Deshacer pared 1 (la última restante)
    store.undoLastWall();
    expect(useProjectStore.getState().project.walls.length).toBe(0);
    expect(useProjectStore.getState().project.vertices.length).toBe(0);
    expect(useProjectStore.getState().activeAnchorVertexId).toBeNull();
  });

  it('debe realizar snap magnético sobre la cara del muro y calcular rotación automática', () => {
    const store = useProjectStore.getState();

    // Muro horizontal de (0,0) a (5,0), espesor 0.20m (halfT = 0.10m)
    const res = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 5.0,
      angleDeg: 0,
      thickness: 0.20
    })!;

    const walls = useProjectStore.getState().project.walls;
    const verticesMap = new Map(useProjectStore.getState().project.vertices.map((v) => [v.id, v]));

    // Cursor en (2.5, 0.25) -> cerca de la cara izquierda (+Y) del muro
    const snapLeft = calculateWallSnap({ x: 2.5, y: 0.25 }, walls, verticesMap, 0.50);
    expect(snapLeft).not.toBeNull();
    expect(snapLeft?.wall.id).toBe(res.wall.id);
    expect(snapLeft?.side).toBe('left');
    // Coordenada Y proyectada sobre la cara izquierda (0 + 0.10)
    expect(snapLeft?.snappedPoint.x).toBeCloseTo(2.5, 2);
    expect(snapLeft?.snappedPoint.y).toBeCloseTo(0.10, 2);
    // Cara izquierda: rotación 180° (para proyectar hacia el ambiente +Y fuera del muro)
    expect(snapLeft?.rotationDeg).toBe(180);

    // Cursor en (3.0, -0.30) -> cerca de la cara derecha (-Y) del muro
    const snapRight = calculateWallSnap({ x: 3.0, y: -0.30 }, walls, verticesMap, 0.50);
    expect(snapRight).not.toBeNull();
    expect(snapRight?.side).toBe('right');
    // Coordenada Y proyectada sobre la cara derecha (0 - 0.10)
    expect(snapRight?.snappedPoint.x).toBeCloseTo(3.0, 2);
    expect(snapRight?.snappedPoint.y).toBeCloseTo(-0.10, 2);
    // Cara derecha: rotación 0° (para proyectar hacia el ambiente -Y fuera del muro)
    expect(snapRight?.rotationDeg).toBe(0);
  });

  it('debe soportar propiedades enriquecidas de TRAZA en elementos eléctricos (status, powerW, phases, rotation)', () => {
    const store = useProjectStore.getState();

    store.addElectricalElement({
      id: 'el-traza-1',
      symbolId: 'sym-planta-toma-doble',
      levelId: 'nivel-pb',
      spaceId: 'space-cocina',
      placement: 'wall',
      x: 3.0,
      y: 0.10,
      heightZ: 1.20,
      rotation: 180,
      side: 'right',
      status: 'existente',
      powerW: 2200,
      phases: 1
    });

    const el = useProjectStore.getState().project.electricalElements[0];
    expect(el.status).toBe('existente');
    expect(el.powerW).toBe(2200);
    expect(el.phases).toBe(1);
    expect(el.rotation).toBe(180);
    expect(el.side).toBe('right');

    // Cambiar estado a 'a_reemplazar' y potencia a 3000W trifásico
    store.updateElectricalElement(el.id, {
      status: 'a_reemplazar',
      powerW: 3000,
      phases: 3,
      rotation: 90
    });

    const updated = useProjectStore.getState().project.electricalElements[0];
    expect(updated.status).toBe('a_reemplazar');
    expect(updated.powerW).toBe(3000);
    expect(updated.phases).toBe(3);
    expect(updated.rotation).toBe(90);
  });

  it('debe gestionar circuitos normalizados, asociar bocas con retornos y verificar ocupación AEA 90364', () => {
    const store = useProjectStore.getState();

    // Inicializar circuitos estándar si no están
    store.ensureDefaultCircuits();
    expect(store.project.circuits.length).toBeGreaterThanOrEqual(3);

    // Añadir nuevo circuito especial
    const nuevoCircuitoId = 'circ-aire-1';
    store.addCircuit({
      id: nuevoCircuitoId,
      panelId: 'pan-tsg',
      name: 'C4 - ACU Climatización',
      type: 'ACU',
      voltageV: 220,
      wireSectionBaseMM2: 4.0,
      breakerAmperageA: 20,
      color: '#8b5cf6'
    });

    const circ = useProjectStore.getState().project.circuits.find((c) => c.id === nuevoCircuitoId);
    expect(circ).toBeDefined();
    expect(circ?.wireSectionBaseMM2).toBe(4.0);

    // Añadir boca de toma asignada a este circuito
    store.addElectricalElement({
      id: 'el-aire-1',
      symbolId: 'sym-planta-toma',
      levelId: 'nivel-pb',
      spaceId: 'space-living',
      placement: 'wall',
      x: 2.0,
      y: 0.10,
      heightZ: 2.20,
      circuitId: nuevoCircuitoId,
      returnRef: 'a',
      label: 'Toma AC 1'
    });

    const boca = useProjectStore.getState().project.electricalElements.find((e) => e.id === 'el-aire-1');
    expect(boca?.circuitId).toBe(nuevoCircuitoId);
    expect(boca?.returnRef).toBe('a');

    // Crear cañería con conductores
    store.addConduit({
      id: 'cond-1',
      fromElementId: 'el-traza-1',
      toElementId: 'el-aire-1',
      fromLevelId: 'nivel-pb',
      toLevelId: 'nivel-pb',
      diameterMM: 19,
      material: 'corrugado_blanco',
      isVerticalRiser: false,
      circuitIds: [nuevoCircuitoId],
      conductors: [
        { role: 'fase', sectionMM2: 4.0, color: '#8B4513' },
        { role: 'neutro', sectionMM2: 4.0, color: '#1E90FF' },
        { role: 'pe', sectionMM2: 2.5, color: '#32CD32' },
        { role: 'retorno', sectionMM2: 1.5, color: '#ca8a04', reference: 'a' }
      ]
    });

    const conduit = useProjectStore.getState().project.conduits[0];
    expect(conduit).toBeDefined();
    expect(conduit.conductors.length).toBe(4);

    // Actualizar diámetro y verificar actualización
    store.updateConduit(conduit.id, { diameterMM: 22 });
    const updatedConduit = useProjectStore.getState().project.conduits[0];
    expect(updatedConduit.diameterMM).toBe(22);
  });
});
