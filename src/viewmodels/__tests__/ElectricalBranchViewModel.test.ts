/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ElectricalBranchViewModel.test.ts
 * Verificación en la capa ViewModel (Zustand store) de modificación de ramas completas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import { findConnectedBranch } from '../../models/electrical/electricalBranch';
import type { ElectricalElement, Conduit, Circuit, Panel } from '../../models/electrical/ElectricalModel';

describe('Gestión de Ramas del Grafo Eléctrico en ViewModel (Store)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('permite modificar las características de toda una rama desde el store preservando el tablero', () => {
    const store = useProjectStore.getState();

    // 1. Configurar Tablero Principal
    const panelEl: ElectricalElement = {
      id: 'el-tp',
      symbolId: 'sym-planta-tp',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'wall',
      x: 0,
      y: 0,
      heightZ: 1.40,
      isPanel: true,
      label: 'TP',
      status: 'existente',
      powerW: 0,
      phases: 1
    };
    store.addElectricalElement(panelEl);

    const panelData: Panel = {
      id: 'pan-tp',
      name: 'Tablero Principal',
      type: 'principal',
      levelId: 'level-1',
      spaceId: 'space-1',
      elementId: 'el-tp',
      isThreePhase: false,
      mainBreakerAmperageA: 32,
      mainDifferentialAmperageA: 40
    };
    store.addPanel(panelData);

    // 2. Configurar Bocas B1, B2, B3
    const b1: ElectricalElement = {
      id: 'el-b1',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 2,
      y: 2,
      heightZ: 2.70,
      circuitId: null,
      label: 'B1',
      status: 'proyectado',
      powerW: 100,
      phases: 1
    };
    const b2: ElectricalElement = {
      id: 'el-b2',
      symbolId: 'sym-planta-boca-techo',
      levelId: 'level-1',
      spaceId: 'space-1',
      placement: 'ceiling',
      x: 5,
      y: 2,
      heightZ: 2.70,
      circuitId: null,
      label: 'B2',
      status: 'proyectado',
      powerW: 100,
      phases: 1
    };
    store.addElectricalElement(b1);
    store.addElectricalElement(b2);

    // 3. Conectar Cañerías: TP -> B1 -> B2
    const c1: Conduit = {
      id: 'c-tp-b1',
      fromElementId: 'el-tp',
      toElementId: 'el-b1',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 19,
      material: 'corrugado_blanco_pvc',
      isVerticalRiser: false,
      circuitId: null,
      conductors: []
    };
    const c2: Conduit = {
      id: 'c-b1-b2',
      fromElementId: 'el-b1',
      toElementId: 'el-b2',
      fromLevelId: 'level-1',
      toLevelId: 'level-1',
      diameterMM: 19,
      material: 'corrugado_blanco_pvc',
      isVerticalRiser: false,
      circuitId: null,
      conductors: []
    };
    store.addConduit(c1);
    store.addConduit(c2);

    // Circuito a asignar
    const circTug: Circuit = {
      id: 'circ-tug-1',
      panelId: 'pan-tp',
      name: 'C1 - TUG',
      type: 'TUG',
      voltageV: 220,
      wireSectionBaseMM2: 2.5,
      breakerAmperageA: 16
    };
    store.addCircuit(circTug);

    // 4. Seleccionamos B2 y detectamos la rama
    const currentState = useProjectStore.getState();
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'el-b2' },
      elements: currentState.project.electricalElements,
      conduits: currentState.project.conduits,
      panels: currentState.project.panels
    });

    expect(branch).not.toBeNull();
    expect(branch?.elementIds.sort()).toEqual(['el-b1', 'el-b2'].sort());
    expect(branch?.conduitIds.sort()).toEqual(['c-b1-b2', 'c-tp-b1'].sort());
    expect(branch?.boundaryPanelIds).toEqual(['el-tp']);

    // 5. Aplicamos actualización completa de la rama:
    // Cable a 2.5 mm², caño a hierro semipesado 22mm, circuito a C1-TUG
    currentState.updateElectricalBranch(branch!, {
      circuitId: 'circ-tug-1',
      conduitMaterial: 'hierro_semipesado_rs',
      conduitDiameterMM: 22,
      wireSectionMM2: 2.5,
      status: 'existente'
    });

    const updatedProject = useProjectStore.getState().project;

    // Verificamos bocas
    const updatedB1 = updatedProject.electricalElements.find((e) => e.id === 'el-b1');
    const updatedB2 = updatedProject.electricalElements.find((e) => e.id === 'el-b2');
    expect(updatedB1?.circuitId).toBe('circ-tug-1');
    expect(updatedB1?.status).toBe('existente');
    expect(updatedB2?.circuitId).toBe('circ-tug-1');

    // Verificamos cañerías
    const updatedC1 = updatedProject.conduits.find((c) => c.id === 'c-tp-b1');
    const updatedC2 = updatedProject.conduits.find((c) => c.id === 'c-b1-b2');
    expect(updatedC1?.material).toBe('hierro_semipesado_rs');
    expect(updatedC1?.diameterMM).toBe(22);
    expect(updatedC1?.circuitId).toBe('circ-tug-1');
    expect(updatedC1?.conductors[0].sectionMM2).toBe(2.5);

    expect(updatedC2?.material).toBe('hierro_semipesado_rs');
    expect(updatedC2?.diameterMM).toBe(22);
    expect(updatedC2?.circuitId).toBe('circ-tug-1');

    // Verificamos que el tablero NO haya perdido su naturaleza
    const updatedTp = updatedProject.electricalElements.find((e) => e.id === 'el-tp');
    expect(updatedTp?.isPanel).toBe(true);
    expect(updatedTp?.symbolId).toBe('sym-planta-tp');
    expect(updatedTp?.placement).toBe('wall');
    expect(updatedTp?.heightZ).toBe(1.40);

    const panelRecord = updatedProject.panels.find((p) => p.elementId === 'el-tp');
    expect(panelRecord).toBeDefined();
    expect(panelRecord?.name).toBe('Tablero Principal');
  });
});
