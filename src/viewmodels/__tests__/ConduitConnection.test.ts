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
    });

    expect(el1.label).toBe('B1');
    expect(el1.placement).toBe('ceiling');
    expect(useProjectStore.getState().project.conduits).toHaveLength(0);

    // 2. Insertar segunda boca de techo en (5, 2)
    const el2 = placeElectricalElementInStore({
      worldX: 5.0,
      worldY: 2.0,
      symbolId: 'sym-planta-boca-techo'
    });

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
    });

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
    });

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
});
