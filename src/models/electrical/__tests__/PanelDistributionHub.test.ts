/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRUEBAS UNITARIAS: PanelDistributionHub.test.ts
 * Valida la arquitectura de Tableros Eléctricos como Distribuidores de Circuitos:
 * 1. Entidades espaciales autónomas (SpatialElectricalNode) en project.panels
 * 2. Cero mezcla con bocas de consumo (no se computan como bocas AEA)
 * 3. Múltiples entradas de alimentación (Red + Grupo Electrógeno de Emergencia + ATS)
 * 4. Conexión de cañerías y cálculo ortogonal hacia bocas y entre tableros
 * 5. Detección topológica de límites en ramas interconectadas
 * 6. Migración transparente de proyectos legacy
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { placeElectricalElementInStore, useElectricalSequenceStore } from '../../../viewmodels/useElectricalViewModel';
import { findConnectedBranch } from '../electricalBranch';
import { getConduitLengthBreakdown } from '../calculations';
import { generarComputoCotizador } from '../../../services/cotizadorBridge';
import { createDefaultLevel } from '../../architecture/Level';
import type { Panel, ElectricalElement, Conduit } from '../ElectricalModel';

describe('Tableros como Distribuidores de Circuitos Autónomos', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useElectricalSequenceStore.getState().resetSequence();
  });

  it('un tablero emplazado se guarda en project.panels y NO en project.electricalElements', () => {
    // Emplazar un Tablero Principal (TP)
    const placedNode = placeElectricalElementInStore({
      worldX: 2.5,
      worldY: 1.0,
      symbolId: 'sym-planta-tablero-principal'
    });

    const updatedState = useProjectStore.getState();

    // 1. Debe existir en project.panels con coordenadas espaciales
    expect(updatedState.project.panels.length).toBeGreaterThanOrEqual(1);
    const panel = updatedState.project.panels.find((p) => p.id === placedNode.id);
    expect(panel).toBeDefined();
    expect(panel?.x).toBe(2.5);
    expect(panel?.y).toBe(1.0);
    expect(panel?.heightZ).toBe(1.40);
    expect(panel?.isPlaced).toBe(true);

    // 2. CRÍTICO: NO debe existir en project.electricalElements (no es una boca)
    const elInBocas = updatedState.project.electricalElements.find((e) => e.id === placedNode.id);
    expect(elInBocas).toBeUndefined();
    expect(updatedState.project.electricalElements).toHaveLength(0);
  });

  it('los tableros no deben computarse como bocas de consumo en el cotizador', () => {
    const store = useProjectStore.getState();

    // Crear un espacio/ambiente
    store.updateSpace(store.project.spaces[0]?.id || 'espacio-principal', {
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4']
    });

    // Emplazar 1 Tablero Principal y 2 bocas (1 centro de luz y 1 tomacorriente)
    placeElectricalElementInStore({
      worldX: 1.0,
      worldY: 1.0,
      symbolId: 'sym-planta-tablero-principal'
    });

    placeElectricalElementInStore({
      worldX: 2.0,
      worldY: 2.0,
      symbolId: 'sym-planta-boca-techo'
    });

    placeElectricalElementInStore({
      worldX: 3.0,
      worldY: 1.0,
      symbolId: 'sym-planta-toma-uso-general'
    });

    const computo = generarComputoCotizador(useProjectStore.getState().project);

    // Solo deben computarse las 2 bocas reales, jamás el tablero
    expect(computo.bocasPorTipo['IUG (Iluminación)']).toBe(1);
    expect(computo.bocasPorTipo['TUG (Tomas Generales)']).toBe(1);
    expect(computo.bocasPorTipo['Tablero Eléctrico']).toBeUndefined();
    expect(computo.tablerosPorTipo?.['Tablero Principal (TP)']).toBe(1);
  });

  it('permite modelar múltiples entradas de alimentación (Red + Grupo Electrógeno) con conmutadora', () => {
    const store = useProjectStore.getState();

    const panelId = 'panel-ge-test';
    const panelConGE: Panel = {
      id: panelId,
      name: 'Tablero General con Transferencia',
      type: 'principal',
      levelId: 'level-1',
      spaceId: 'espacio-principal',
      x: 1.0,
      y: 1.0,
      heightZ: 1.40,
      isPlaced: true,
      hasEarthBar: true,
      incomings: [
        {
          id: 'inc-red',
          sourceType: 'grid_meter',
          name: 'Acometida Red Distribuidora (3x380V)',
          voltageV: 380,
          phases: 3,
          mainBreakerAmperageA: 63,
          mainDifferentialAmperageA: 63,
          isDefaultActive: true
        },
        {
          id: 'inc-ge',
          sourceType: 'generator',
          name: 'Generador Diésel Emergencia 25kVA',
          voltageV: 380,
          phases: 3,
          mainBreakerAmperageA: 40,
          isDefaultActive: false
        }
      ],
      transferSwitch: {
        hasMultipleIncomings: true,
        type: 'automatic_ats',
        interlocked: true,
        notes: 'Tablero de Transferencia Automática ATS con enclavamiento cuádruple'
      }
    };

    store.addPanel(panelConGE);

    const savedPanel = useProjectStore.getState().project.panels.find((p) => p.id === panelId);
    expect(savedPanel?.incomings).toHaveLength(2);
    expect(savedPanel?.incomings[0].sourceType).toBe('grid_meter');
    expect(savedPanel?.incomings[1].sourceType).toBe('generator');
    expect(savedPanel?.transferSwitch?.interlocked).toBe(true);
    expect(savedPanel?.transferSwitch?.type).toBe('automatic_ats');
  });

  it('calcula correctamente la longitud 3D ortogonal de cañería entre un tablero y una boca', () => {
    const tp: Panel = {
      id: 'tp-1',
      name: 'Tablero Principal',
      type: 'principal',
      levelId: 'level-1',
      spaceId: 'sp-1',
      x: 0,
      y: 0,
      heightZ: 1.40,
      isPlaced: true,
      incomings: []
    };

    const boca: ElectricalElement = {
      id: 'boca-1',
      levelId: 'level-1',
      spaceId: 'sp-1',
      symbolId: 'sym-planta-boca-techo',
      placement: 'ceiling',
      x: 3.0,
      y: 4.0,
      heightZ: 2.70,
      status: 'proyectado',
      powerW: 100,
      phases: 1
    };

    const levelsMap = new Map([['level-1', createDefaultLevel('level-1', 'PB', 0)]]);

    const breakdown = getConduitLengthBreakdown({
      fromElement: tp,
      toElement: boca,
      levelsMap
    });

    // dx = 3, dy = 4 -> L_horizontal = 7.0m
    // dz = |2.70 - 1.40| = 1.30m
    // L_base = 7.0 + 1.30 = 8.30m
    // Real con 10% de curvas = 8.30 * 1.10 = 9.13m
    expect(breakdown.distPlantaOrthogonal).toBe(7.0);
    expect(breakdown.dzLocal).toBe(1.30);
    expect(breakdown.totalLengthM).toBeCloseTo(9.13, 2);
  });

  it('reconoce al tablero como límite de rama interconectada en findConnectedBranch', () => {
    const tp: Panel = {
      id: 'tp-hub',
      name: 'TP Hub',
      type: 'principal',
      levelId: 'level-1',
      spaceId: 'sp-1',
      x: 0,
      y: 0,
      heightZ: 1.40,
      isPlaced: true,
      incomings: []
    };

    const b1: ElectricalElement = {
      id: 'b1',
      levelId: 'level-1',
      spaceId: 'sp-1',
      symbolId: 'sym-planta-boca-techo',
      placement: 'ceiling',
      x: 2.0,
      y: 0,
      heightZ: 2.70,
      circuitId: 'c1',
      status: 'proyectado',
      powerW: 100,
      phases: 1
    };

    const b2: ElectricalElement = {
      id: 'b2',
      levelId: 'level-1',
      spaceId: 'sp-1',
      symbolId: 'sym-planta-boca-techo',
      placement: 'ceiling',
      x: 4.0,
      y: 0,
      heightZ: 2.70,
      circuitId: 'c1',
      status: 'proyectado',
      powerW: 100,
      phases: 1
    };

    const conduits: Conduit[] = [
      {
        id: 'c-tp-b1',
        fromElementId: 'tp-hub',
        toElementId: 'b1',
        fromLevelId: 'level-1',
        toLevelId: 'level-1',
        diameterMM: 19,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        conductors: []
      },
      {
        id: 'c-b1-b2',
        fromElementId: 'b1',
        toElementId: 'b2',
        fromLevelId: 'level-1',
        toLevelId: 'level-1',
        diameterMM: 19,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        conductors: []
      }
    ];

    // Iniciamos la búsqueda desde la boca b2
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'b2' },
      elements: [b1, b2],
      conduits,
      panels: [tp]
    });

    expect(branch).not.toBeNull();
    // Bocas de la rama
    expect(branch?.elementIds.sort()).toEqual(['b1', 'b2'].sort());
    // El tablero TP debe figurar como tablero límite primario
    expect(branch?.boundaryPanelIds).toEqual(['tp-hub']);
    expect(branch?.primaryBoundaryPanel?.id).toBe('tp-hub');
  });

  it('migra de forma transparente proyectos legacy con tableros en electricalElements', () => {
    const store = useProjectStore.getState();

    // Proyecto con formato legacy (tablero guardado como boca y panel referenciando elementId)
    const legacyProject = {
      ...store.project,
      panels: [
        {
          id: 'pan-legacy',
          name: 'Tablero Principal Legacy',
          type: 'principal' as const,
          levelId: 'level-1',
          spaceId: 'sp-1',
          elementId: 'elem-tp-legacy',
          isThreePhase: false,
          mainBreakerAmperageA: 32,
          mainDifferentialAmperageA: 40
        }
      ],
      electricalElements: [
        {
          id: 'elem-tp-legacy',
          levelId: 'level-1',
          spaceId: 'sp-1',
          symbolId: 'sym-planta-tablero-principal',
          placement: 'wall' as const,
          x: 5.0,
          y: 3.0,
          heightZ: 1.40,
          isPanel: true,
          status: 'proyectado' as const,
          powerW: 0,
          phases: 1 as const
        },
        {
          id: 'elem-boca-1',
          levelId: 'level-1',
          spaceId: 'sp-1',
          symbolId: 'sym-planta-boca-techo',
          placement: 'ceiling' as const,
          x: 2.0,
          y: 3.0,
          heightZ: 2.70,
          isPanel: false,
          status: 'proyectado' as const,
          powerW: 100,
          phases: 1 as const
        }
      ],
      conduits: [
        {
          id: 'c-legacy',
          fromElementId: 'elem-tp-legacy',
          toElementId: 'elem-boca-1',
          fromLevelId: 'level-1',
          toLevelId: 'level-1',
          diameterMM: 19,
          material: 'hierro_semipesado_rs' as const,
          isVerticalRiser: false,
          conductors: []
        }
      ]
    };

    store.loadProject(legacyProject as any);

    const loadedState = useProjectStore.getState();

    // 1. El tablero debe haber heredado las coordenadas (5.0, 3.0) y quedar autónomo
    const migratedPanel = loadedState.project.panels.find((p) => p.id === 'pan-legacy');
    expect(migratedPanel).toBeDefined();
    expect(migratedPanel?.x).toBe(5.0);
    expect(migratedPanel?.y).toBe(3.0);
    expect(migratedPanel?.isPlaced).toBe(true);
    expect(migratedPanel?.incomings.length).toBeGreaterThanOrEqual(1);

    // 2. La boca de tablero debe haber sido purgada de electricalElements
    const bocas = loadedState.project.electricalElements;
    expect(bocas).toHaveLength(1);
    expect(bocas[0].id).toBe('elem-boca-1');

    // 3. La cañería debe haber migrado su extremo apuntando directamente al panel
    const conduit = loadedState.project.conduits[0];
    expect(conduit.fromElementId).toBe('pan-legacy');
    expect(conduit.toElementId).toBe('elem-boca-1');
  });
});
