/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: PanelManagement.test.ts
 * Verificación de Gestión de Tableros (Panels) en useProjectStore.
 * Cubre: Crear, Editar, Eliminar seguro, Reasignación de Circuitos y Safeguards.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import type { Panel, Circuit } from '../../models/electrical/ElectricalModel';

describe('Gestión de Tableros Eléctricos en Store (ViewModel)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('el proyecto inicial debe contar con el Tablero Principal por defecto', () => {
    const { project } = useProjectStore.getState();
    expect(project.panels).toBeDefined();
    expect(project.panels.length).toBeGreaterThanOrEqual(1);
    expect(project.panels[0].name).toContain('Tablero');
    expect(project.panels[0].type).toBe('principal');
  });

  it('debe permitir agregar un nuevo tablero seccional', () => {
    const { addPanel } = useProjectStore.getState();

    const newPanel: Panel = {
      id: 'panel-ts-pa',
      name: 'Tablero Seccional Planta Alta (TS-PA)',
      type: 'seccional',
      levelId: 'level-1',
      spaceId: 'space-pasillo',
      elementId: 'elem-ts-pa',
      isThreePhase: false,
      mainBreakerAmperageA: 25,
      mainDifferentialAmperageA: 25
    };

    addPanel(newPanel);

    const state = useProjectStore.getState();
    expect(state.project.panels.length).toBe(2);
    const added = state.project.panels.find((p) => p.id === 'panel-ts-pa');
    expect(added).toBeDefined();
    expect(added?.name).toBe('Tablero Seccional Planta Alta (TS-PA)');
    expect(added?.type).toBe('seccional');
  });

  it('debe permitir editar propiedades de un tablero existente', () => {
    const { project, updatePanel } = useProjectStore.getState();
    const mainPanel = project.panels[0];

    updatePanel(mainPanel.id, {
      name: 'Tablero Principal General (TPG)',
      mainBreakerAmperageA: 50,
      isThreePhase: true
    });

    const state = useProjectStore.getState();
    const updated = state.project.panels.find((p) => p.id === mainPanel.id);
    expect(updated?.name).toBe('Tablero Principal General (TPG)');
    expect(updated?.mainBreakerAmperageA).toBe(50);
    expect(updated?.isThreePhase).toBe(true);
  });

  it('no debe permitir eliminar el único tablero del proyecto (salvaguarda)', () => {
    const { project, deletePanel } = useProjectStore.getState();
    expect(project.panels.length).toBe(1);

    deletePanel(project.panels[0].id);

    const state = useProjectStore.getState();
    expect(state.project.panels.length).toBe(1);
    expect(state.project.panels[0].id).toBe(project.panels[0].id);
  });

  it('al eliminar un tablero secundario, debe reasignar sus circuitos al tablero principal y limpiar targetPanelId', () => {
    const { project, addPanel, addCircuit, deletePanel } = useProjectStore.getState();
    const principalPanelId = project.panels[0].id;

    // Agregar subtablero
    const subPanel: Panel = {
      id: 'sub-panel-1',
      name: 'Tablero Seccional (TS1)',
      type: 'seccional',
      levelId: 'level-1',
      spaceId: 'space-1',
      elementId: 'elem-1',
      isThreePhase: false,
      mainBreakerAmperageA: 25,
      mainDifferentialAmperageA: 25
    };
    addPanel(subPanel);

    // Agregar circuito alimentado por el subtablero
    const circEnSub: Circuit = {
      id: 'circ-sub-c1',
      panelId: 'sub-panel-1',
      name: 'C1 - Iluminación TS1',
      type: 'IUG',
      voltageV: 220,
      wireSectionBaseMM2: 1.5,
      breakerAmperageA: 10
    };
    addCircuit(circEnSub);

    // Agregar línea seccional desde el principal hacia el subtablero
    const lineaSeccional: Circuit = {
      id: 'circ-ls-1',
      panelId: principalPanelId,
      targetPanelId: 'sub-panel-1',
      name: 'LS1 - Alimentador TS1',
      type: 'LS',
      voltageV: 220,
      wireSectionBaseMM2: 4.0,
      breakerAmperageA: 25
    };
    addCircuit(lineaSeccional);

    // Ahora eliminamos el subtablero
    deletePanel('sub-panel-1');

    const state = useProjectStore.getState();
    expect(state.project.panels.length).toBe(1);
    expect(state.project.panels.find((p) => p.id === 'sub-panel-1')).toBeUndefined();

    // El circuito que pertenecía al subtablero ahora debe estar reasignado al principal
    const reallocatedCirc = state.project.circuits.find((c) => c.id === 'circ-sub-c1');
    expect(reallocatedCirc).toBeDefined();
    expect(reallocatedCirc?.panelId).toBe(principalPanelId);

    // La línea seccional debe tener targetPanelId limpio (null)
    const lsCirc = state.project.circuits.find((c) => c.id === 'circ-ls-1');
    expect(lsCirc?.targetPanelId).toBeNull();
  });
});
