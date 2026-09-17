/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ConduitConnection.test.ts
 * Verificación de Modelado, Selección y Enlace de Conductos con Tableros.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import { placeElectricalElementInStore, useElectricalSequenceStore } from '../useElectricalViewModel';
import { getSymbolById } from '../../models/electrical/symbolsLib';
import { getConduitLengthBreakdown } from '../../models/electrical/calculations';
import { createDefaultLevel } from '../../models/architecture/Level';
import type { ElectricalElement } from '../../models/electrical/ElectricalModel';

describe('Enlace de Conductos con Tableros y Bocas', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useElectricalSequenceStore.getState().resetAllSequenceState();
  });

  it('los símbolos de tableros deben estar registrados en el catálogo con categoría tableros', () => {
    const tp = getSymbolById('sym-planta-tp');
    const ts = getSymbolById('sym-planta-ts');
    const medidor = getSymbolById('sym-planta-medidor');

    expect(tp).toBeDefined();
    expect(tp?.categoria).toBe('tableros');
    expect(ts).toBeDefined();
    expect(ts?.categoria).toBe('tableros');
    expect(medidor).toBeDefined();
    expect(medidor?.categoria).toBe('tableros');
  });

  it('debe permitir vincular un Tablero Principal con una Boca de Techo mediante un conducto', () => {
    const { addElectricalElement, addConduit } = useProjectStore.getState();

    const panelId = 'el-tp-1';
    const lightId = 'el-light-1';

    // 1. Agregar Tablero Principal (isPanel: true, h: 1.40m)
    addElectricalElement({
      id: panelId,
      symbolId: 'sym-planta-tp',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'wall',
      x: 0,
      y: 0,
      heightZ: 1.40,
      wallId: 'wall-1',
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 0,
      phases: 1,
      isPanel: true,
      label: 'Tablero Principal',
      attributes: []
    });

    // 2. Agregar Boca de Techo (h: 2.70m)
    addElectricalElement({
      id: lightId,
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 4.0,
      y: 3.0,
      heightZ: 2.70,
      wallId: null,
      rotation: 0,
      circuitId: 'circ-1',
      status: 'proyectado',
      powerW: 100,
      phases: 1,
      isPanel: false,
      label: 'Centro Techo 1',
      attributes: []
    });

    // 3. Crear tramo de conducto entre Tablero y Boca
    const conduitId = 'cond-tp-light';
    addConduit({
      id: conduitId,
      circuitId: 'circ-1',
      circuitIds: ['circ-1'],
      fromElementId: panelId,
      toElementId: lightId,
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 19,
      material: 'hierro_semipesado_rs',
      isVerticalRiser: false,
      conductors: [
        { role: 'fase', sectionMM2: 2.5, color: '#991b1b' },
        { role: 'neutro', sectionMM2: 2.5, color: '#2563eb' },
        { role: 'pe', sectionMM2: 2.5, color: '#16a34a' }
      ]
    });

    const state = useProjectStore.getState();
    const createdConduit = state.project.conduits.find((c) => c.id === conduitId);

    expect(createdConduit).toBeDefined();
    expect(createdConduit?.fromElementId).toBe(panelId);
    expect(createdConduit?.toElementId).toBe(lightId);
    expect(createdConduit?.circuitId).toBe('circ-1');

    // 4. Calcular cómputo de longitud ortogonal con desnivel Z
    const fromEl = state.project.electricalElements.find((e) => e.id === panelId)!;
    const toEl = state.project.electricalElements.find((e) => e.id === lightId)!;

    const breakdown = getConduitLengthBreakdown({
      fromElement: fromEl,
      toElement: toEl,
      levelsMap: new Map([['level-1', createDefaultLevel('level-1', 'PB', 0)]])
    });

    // dx = 4.0, dy = 3.0 -> L_horizontal = 7.0m
    // dz = |2.70 - 1.40| = 1.30m
    // L_base = 7.0 + 1.30 = 8.30m
    // Factor 1.10 = 8.30 * 1.10 = 9.13m
    expect(breakdown.distPlantaOrthogonal).toBe(7.0);
    expect(breakdown.dzLocal).toBe(1.30);
    expect(breakdown.totalLengthM).toBeCloseTo(9.13, 2);
  });

  it('debe permitir vincular dos tableros (Tablero Principal y Tablero Seccional) mediante cañería troncal', () => {
    const { addElectricalElement, addConduit } = useProjectStore.getState();

    const tpId = 'tp-1';
    const tsId = 'ts-1';

    addElectricalElement({
      id: tpId,
      symbolId: 'sym-planta-tp',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'wall',
      x: 0,
      y: 0,
      heightZ: 1.40,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 0,
      phases: 3,
      isPanel: true,
      label: 'Tablero Principal General',
      attributes: []
    });

    addElectricalElement({
      id: tsId,
      symbolId: 'sym-planta-ts',
      levelId: 'level-1',
      spaceId: 'space-2',
      placement: 'wall',
      x: 10.0,
      y: 0,
      heightZ: 1.40,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 0,
      phases: 1,
      isPanel: true,
      label: 'Tablero Seccional Planta',
      attributes: []
    });

    addConduit({
      id: 'cond-troncal',
      circuitId: null,
      circuitIds: [],
      fromElementId: tpId,
      toElementId: tsId,
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 25,
      material: 'hierro_semipesado_rs',
      isVerticalRiser: false,
      conductors: [
        { role: 'fase', sectionMM2: 6.0, color: '#991b1b' },
        { role: 'neutro', sectionMM2: 6.0, color: '#2563eb' },
        { role: 'pe', sectionMM2: 6.0, color: '#16a34a' }
      ]
    });

    const state = useProjectStore.getState();
    const cond = state.project.conduits.find((c) => c.id === 'cond-troncal');
    expect(cond).toBeDefined();
    expect(cond?.fromElementId).toBe(tpId);
    expect(cond?.toElementId).toBe(tsId);
    expect(cond?.diameterMM).toBe(25);
  });

  it('debe encadenar cañerías ortogonales automáticamente al insertar una secuencia de bocas con etiqueta única', () => {
    const seqStore = useElectricalSequenceStore.getState();
    seqStore.resetSequence();
    seqStore.setSequencePrefix('B');
    seqStore.setAutoConnectConduits(true);
    seqStore.setSequenceRoutingMode('orthogonal');
    seqStore.setSequenceCircuitId(null);

    // 1. Insertar primera boca de techo en (2, 2)
    const el1 = placeElectricalElementInStore({
      worldX: 2.0,
      worldY: 2.0,
      symbolId: 'sym-planta-boca-techo'
    }) as ElectricalElement;

    expect(el1.label).toBe('B1');
    expect(el1.placement).toBe('ceiling');
    expect(useProjectStore.getState().project.conduits).toHaveLength(0);

    // 2. Insertar segunda boca de techo en (5, 2)
    const el2 = placeElectricalElementInStore({
      worldX: 5.0,
      worldY: 2.0,
      symbolId: 'sym-planta-boca-techo'
    }) as ElectricalElement;

    expect(el2.label).toBe('B2');
    const conduitsAfter2 = useProjectStore.getState().project.conduits;
    expect(conduitsAfter2).toHaveLength(1);
    expect(conduitsAfter2[0].fromElementId).toBe(el1.id);
    expect(conduitsAfter2[0].toElementId).toBe(el2.id);
    expect(conduitsAfter2[0].routingMode).toBe('orthogonal');
    expect(conduitsAfter2[0].diameterMM).toBe(19);

    // 3. Configurar circuito activo C1 y colocar tercera boca en (5, 6)
    useProjectStore.getState().addCircuit({
      id: 'circ-c1',
      panelId: 'panel-tp',
      name: 'C1 - IUG Planta Baja',
      type: 'IUG',
      voltageV: 220,
      wireSectionBaseMM2: 1.5,
      breakerAmperageA: 10
    });
    seqStore.setSequenceCircuitId('circ-c1');

    const el3 = placeElectricalElementInStore({
      worldX: 5.0,
      worldY: 6.0,
      symbolId: 'sym-planta-boca-techo'
    }) as ElectricalElement;

    expect(el3.label).toBe('B1'); // Primera boca en el nuevo circuito C1
    expect(el3.circuitId).toBe('circ-c1');

    const conduitsAfter3 = useProjectStore.getState().project.conduits;
    expect(conduitsAfter3).toHaveLength(2);
    const cond2to3 = conduitsAfter3[1];
    expect(cond2to3.fromElementId).toBe(el2.id);
    expect(cond2to3.toElementId).toBe(el3.id);
    expect(cond2to3.circuitId).toBe('circ-c1');
    // Conductor section heredado del circuito (1.5 mm²)
    expect(cond2to3.conductors[0].sectionMM2).toBe(1.5);
    expect(cond2to3.conductors[0].circuitId).toBe('circ-c1');

    // 4. Resetear la secuencia e insertar una cuarta boca: NO debe encadenar con B1 pero sigue en C1 -> B2
    seqStore.resetSequence();
    const el4 = placeElectricalElementInStore({
      worldX: 8.0,
      worldY: 8.0,
      symbolId: 'sym-planta-boca-techo'
    }) as ElectricalElement;

    expect(el4.label).toBe('B2'); // Segunda boca en el circuito C1
    // La cantidad de cañerías no debe haber aumentado
    expect(useProjectStore.getState().project.conduits).toHaveLength(2);
  });

  it('debe crear cañerías con arco esquemático genérico (schematic_arc) por defecto y permitir alternar a ortogonal', () => {
    const seqStore = useElectricalSequenceStore.getState();
    seqStore.resetSequence();
    seqStore.setAutoConnectConduits(true);
    seqStore.setSequencePrefix('B');
    // Verificamos que por defecto el modo sea schematic_arc
    expect(seqStore.sequenceRoutingMode).toBe('schematic_arc');

    // 1. Insertar dos bocas sin cambiar modo -> debe conectar con arco esquemático
    const el1 = placeElectricalElementInStore({
      worldX: 1.0,
      worldY: 1.0,
      symbolId: 'sym-planta-boca-techo'
    });
    const el2 = placeElectricalElementInStore({
      worldX: 4.0,
      worldY: 1.0,
      symbolId: 'sym-planta-boca-techo'
    });

    const conduits = useProjectStore.getState().project.conduits;
    expect(conduits).toHaveLength(1);
    const cond = conduits[0];
    expect(cond.routingMode).toBe('schematic_arc');
    expect(cond.fromElementId).toBe(el1.id);
    expect(cond.toElementId).toBe(el2.id);

    // 2. Modificar la cañería para alternar a 90° ortogonal
    useProjectStore.getState().updateConduit(cond.id, { routingMode: 'orthogonal' });
    const updatedCond = useProjectStore.getState().project.conduits.find((c) => c.id === cond.id);
    expect(updatedCond?.routingMode).toBe('orthogonal');

    // 3. Alternar nuevamente a schematic_arc
    useProjectStore.getState().updateConduit(cond.id, { routingMode: 'schematic_arc' });
    const revertedCond = useProjectStore.getState().project.conduits.find((c) => c.id === cond.id);
    expect(revertedCond?.routingMode).toBe('schematic_arc');
  });

  it('debe permitir trazar un recorrido arbitrario de conducto con waypoints y calcular su longitud total real', () => {
    const { addElectricalElement, addConduit } = useProjectStore.getState();

    // 1. Boca 1 (Toma a 0.30m)
    addElectricalElement({
      id: 'el-toma-1',
      symbolId: 'sym-planta-toma-doble',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'wall',
      x: 0,
      y: 0,
      heightZ: 0.30,
      wallId: 'wall-1',
      rotation: 0,
      circuitId: 'circ-1',
      status: 'existente',
      powerW: 150,
      phases: 1,
      isPanel: false,
      label: 'TUG1',
      attributes: []
    });

    // 2. Boca 2 (Toma a 0.30m en otra pared opuesta)
    addElectricalElement({
      id: 'el-toma-2',
      symbolId: 'sym-planta-toma-doble',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'wall',
      x: 6.0,
      y: 8.0,
      heightZ: 0.30,
      wallId: 'wall-2',
      rotation: 0,
      circuitId: 'circ-1',
      status: 'existente',
      powerW: 150,
      phases: 1,
      isPanel: false,
      label: 'TUG2',
      attributes: []
    });

    // 3. Trazado arbitrario por losa pasando por 2 quiebres intermedios (waypoints)
    const waypoints = [
      { x: 2.0, y: 0.0 }, // Quiebre 1 en esquina
      { x: 2.0, y: 8.0 }  // Quiebre 2 hacia el otro extremo
    ];

    addConduit({
      id: 'cond-arbitrario',
      circuitId: 'circ-1',
      circuitIds: ['circ-1'],
      fromElementId: 'el-toma-1',
      toElementId: 'el-toma-2',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 19,
      material: 'hierro_semipesado_rs',
      isVerticalRiser: false,
      routingMode: 'orthogonal',
      routingPlane: 'ceiling_slab',
      waypoints,
      conductors: [
        { role: 'fase', sectionMM2: 2.5, color: '#991b1b' },
        { role: 'neutro', sectionMM2: 2.5, color: '#2563eb' },
        { role: 'pe', sectionMM2: 2.5, color: '#16a34a' }
      ]
    });

    const cond = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-arbitrario');
    expect(cond).toBeDefined();
    expect(cond?.waypoints).toHaveLength(2);
    expect(cond?.waypoints?.[0]).toEqual({ x: 2.0, y: 0.0 });
    expect(cond?.waypoints?.[1]).toEqual({ x: 2.0, y: 8.0 });

    // 4. Verificar el cómputo métrico exacto:
    // Tramo 1: (0,0) -> (2,0) = 2.0m
    // Tramo 2: (2,0) -> (2,8) = 8.0m
    // Tramo 3: (2,8) -> (6,8) = 4.0m
    // Total horizontal planta = 14.0m
    // Subida desde Toma 1 (h: 0.30) a losa (2.60): 2.60 - 0.30 = 2.30m
    // Bajada desde losa a Toma 2 (h: 0.30): 2.60 - 0.30 = 2.30m
    // Total Z = 4.60m
    // Suma cruda = 14.0 + 4.60 = 18.60m
    // Con factor 1.10 (curvas y holgura): 18.60 * 1.10 = 20.46m
    const fromEl = useProjectStore.getState().project.electricalElements.find((e) => e.id === 'el-toma-1')!;
    const toEl = useProjectStore.getState().project.electricalElements.find((e) => e.id === 'el-toma-2')!;

    const breakdown = getConduitLengthBreakdown({
      fromElement: fromEl,
      toElement: toEl,
      levelsMap: new Map([['level-1', createDefaultLevel('level-1', 'PB', 0)]]),
      routingPlane: 'ceiling_slab',
      ceilingHeightM: 2.60,
      waypoints
    });

    expect(breakdown.distPlantaHorizontal).toBe(14.0);
    expect(breakdown.dzLocal).toBe(4.60);
    expect(breakdown.totalLengthM).toBeCloseTo(20.46, 2);

    // 5. Permite restablecer los quiebres a trazo directo
    useProjectStore.getState().updateConduit('cond-arbitrario', { waypoints: undefined });
    const clearedCond = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-arbitrario');
    expect(clearedCond?.waypoints).toBeUndefined();
  });

  it('los waypoints deben estar restringidos exclusivamente a modos no-arco (schematic_arc nunca debe poseer waypoints)', () => {
    const { addElectricalElement, addConduit, updateConduit } = useProjectStore.getState();

    // Crear dos bocas
    addElectricalElement({
      id: 'boca-a',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 1,
      y: 1,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'BA',
      attributes: []
    });

    addElectricalElement({
      id: 'boca-b',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 5,
      y: 5,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'BB',
      attributes: []
    });

    // 1. Conducto creado en modo ortogonal con waypoints
    addConduit({
      id: 'cond-test-1',
      circuitId: null,
      circuitIds: [],
      fromElementId: 'boca-a',
      toElementId: 'boca-b',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 19,
      material: 'hierro_semipesado_rs',
      isVerticalRiser: false,
      routingMode: 'orthogonal',
      routingPlane: 'ceiling_slab',
      waypoints: [{ x: 1, y: 5 }],
      conductors: []
    });

    const condOrtogonal = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-test-1');
    expect(condOrtogonal?.routingMode).toBe('orthogonal');
    expect(condOrtogonal?.waypoints).toHaveLength(1);

    // 2. Al alternar a schematic_arc, se resetean los waypoints
    updateConduit('cond-test-1', { routingMode: 'schematic_arc', waypoints: undefined });
    const condArc = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-test-1');
    expect(condArc?.routingMode).toBe('schematic_arc');
    expect(condArc?.waypoints).toBeUndefined();
  });

  it('permite modificar waypoints existentes: agregar, desplazar y eliminar puntos intermedios', () => {
    const { addElectricalElement, addConduit, updateConduit } = useProjectStore.getState();

    addElectricalElement({
      id: 'box-1',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 0,
      y: 0,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'B1',
      attributes: []
    });

    addElectricalElement({
      id: 'box-2',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 10,
      y: 10,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'B2',
      attributes: []
    });

    addConduit({
      id: 'cond-edit-test',
      circuitId: null,
      circuitIds: [],
      fromElementId: 'box-1',
      toElementId: 'box-2',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 22,
      material: 'hierro_semipesado_rs',
      isVerticalRiser: false,
      routingMode: 'orthogonal',
      routingPlane: 'ceiling_slab',
      waypoints: [{ x: 2, y: 0 }],
      conductors: []
    });

    // 1. Agregar nuevo waypoint al final
    const cond = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-edit-test')!;
    const nextWp = [...(cond.waypoints || []), { x: 2, y: 8 }];
    updateConduit('cond-edit-test', { waypoints: nextWp });

    let updated = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-edit-test')!;
    expect(updated.waypoints).toHaveLength(2);
    expect(updated.waypoints?.[1]).toEqual({ x: 2, y: 8 });

    // 2. Desplazar / modificar posición de un waypoint (simulación de arrastre)
    const draggedWp = [...updated.waypoints!];
    draggedWp[0] = { x: 3.5, y: 0.5 };
    updateConduit('cond-edit-test', { waypoints: draggedWp });

    updated = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-edit-test')!;
    expect(updated.waypoints?.[0]).toEqual({ x: 3.5, y: 0.5 });

    // 3. Eliminar un waypoint individual
    const filteredWp = updated.waypoints!.filter((_, i) => i !== 0);
    updateConduit('cond-edit-test', { waypoints: filteredWp });

    updated = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-edit-test')!;
    expect(updated.waypoints).toHaveLength(1);
    expect(updated.waypoints?.[0]).toEqual({ x: 2, y: 8 });

    // 4. Deshacer último waypoint
    updateConduit('cond-edit-test', { waypoints: updated.waypoints!.slice(0, -1) });
    updated = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-edit-test')!;
    expect(updated.waypoints).toHaveLength(0);
  });

  it('permite rediseñar la trayectoria completa de un conducto existente sin duplicarlo', () => {
    const { addElectricalElement, addConduit, updateConduit } = useProjectStore.getState();

    addElectricalElement({
      id: 'box-start',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 0,
      y: 0,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'BS',
      attributes: []
    });

    addElectricalElement({
      id: 'box-dest-original',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 5,
      y: 0,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'BD1',
      attributes: []
    });

    addElectricalElement({
      id: 'box-dest-new',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 0,
      y: 8,
      heightZ: 2.6,
      wallId: null,
      rotation: 0,
      circuitId: null,
      status: 'proyectado',
      powerW: 60,
      phases: 1,
      isPanel: false,
      label: 'BD2',
      attributes: []
    });

    addConduit({
      id: 'cond-redesign',
      circuitId: null,
      circuitIds: [],
      fromElementId: 'box-start',
      toElementId: 'box-dest-original',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 19,
      material: 'hierro_semipesado_rs',
      isVerticalRiser: false,
      routingMode: 'orthogonal',
      routingPlane: 'ceiling_slab',
      conductors: []
    });

    expect(useProjectStore.getState().project.conduits).toHaveLength(1);

    // Rediseño: se reasignan destino y waypoints sobre el mismo conduitId
    updateConduit('cond-redesign', {
      toElementId: 'box-dest-new',
      waypoints: [{ x: 0, y: 4 }]
    });

    const conduits = useProjectStore.getState().project.conduits;
    expect(conduits).toHaveLength(1);
    expect(conduits[0].id).toBe('cond-redesign');
    expect(conduits[0].fromElementId).toBe('box-start');
    expect(conduits[0].toElementId).toBe('box-dest-new');
    expect(conduits[0].waypoints).toEqual([{ x: 0, y: 4 }]);
  });
});

