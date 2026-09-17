/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ElectricalBranch.test.ts
 * Verificación de detección topológica y actualización de ramas interconectadas.
 * Cubre: Trazado conexo, límites en tableros, preservación de tableros y actualización atómica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  findConnectedBranch,
  applyBranchUpdates,
  type BranchUpdatePayload
} from '../electricalBranch';
import type {
  ElectricalElement,
  Conduit,
  Panel,
  Circuit
} from '../ElectricalModel';

describe('Modelo de Ramas del Grafo Eléctrico (electricalBranch)', () => {
  // Configuración de fixtures base:
  // Tablero Principal (TP) conectado a Rama 1 (B1 -> B2 -> B3) y a Rama 2 (B4 -> B5)
  const panelElement: ElectricalElement = {
    id: 'elem-tp',
    symbolId: 'sym-planta-tp',
    levelId: 'level-1',
    spaceId: 'space-1',
    placement: 'wall',
    x: 0,
    y: 0,
    heightZ: 1.40,
    isPanel: true,
    label: 'Tablero Principal',
    status: 'existente',
    powerW: 0,
    phases: 1,
    attributes: []
  };

  const panelData: Panel = {
    id: 'panel-tp',
    name: 'Tablero Principal (TP)',
    type: 'principal',
    levelId: 'level-1',
    spaceId: 'space-1',
    x: 0,
    y: 0,
    heightZ: 1.4,
    isPlaced: true,
    incomings: [
      {
        id: 'inc-tp',
        name: 'Red Distribuidora',
        sourceType: 'grid_meter',
        voltageV: 220,
        phases: 1
      }
    ],
    elementId: 'elem-tp',
    isThreePhase: false,
    mainBreakerAmperageA: 32,
    mainDifferentialAmperageA: 40
  };

  const b1: ElectricalElement = {
    id: 'elem-b1',
    symbolId: 'sym-planta-boca-techo',
    levelId: 'level-1',
    spaceId: 'space-1',
    placement: 'ceiling',
    x: 2,
    y: 0,
    heightZ: 2.70,
    circuitId: 'circ-old',
    label: 'B1',
    status: 'proyectado',
    powerW: 100,
    phases: 1
  };

  const b2: ElectricalElement = {
    id: 'elem-b2',
    symbolId: 'sym-planta-boca-techo',
    levelId: 'level-1',
    spaceId: 'space-1',
    placement: 'ceiling',
    x: 4,
    y: 0,
    heightZ: 2.70,
    circuitId: 'circ-old',
    label: 'B2',
    status: 'proyectado',
    powerW: 100,
    phases: 1
  };

  const b3: ElectricalElement = {
    id: 'elem-b3',
    symbolId: 'sym-planta-toma',
    levelId: 'level-1',
    spaceId: 'space-1',
    placement: 'wall',
    x: 6,
    y: 0,
    heightZ: 0.30,
    circuitId: 'circ-old',
    label: 'B3',
    status: 'proyectado',
    powerW: 150,
    phases: 1
  };

  // Cañerías Rama 1: TP -> B1 -> B2 -> B3
  const cTpB1: Conduit = {
    id: 'cond-tp-b1',
    fromElementId: 'elem-tp',
    toElementId: 'elem-b1',
    fromLevelId: 'level-1',
    toLevelId: 'level-1',
    diameterMM: 19,
    material: 'corrugado_blanco_pvc',
    isVerticalRiser: false,
    circuitId: 'circ-old',
    conductors: [
      { role: 'fase', sectionMM2: 1.5 },
      { role: 'neutro', sectionMM2: 1.5 },
      { role: 'pe', sectionMM2: 1.5 }
    ]
  };

  const cB1B2: Conduit = {
    id: 'cond-b1-b2',
    fromElementId: 'elem-b1',
    toElementId: 'elem-b2',
    fromLevelId: 'level-1',
    toLevelId: 'level-1',
    diameterMM: 19,
    material: 'corrugado_blanco_pvc',
    isVerticalRiser: false,
    circuitId: 'circ-old',
    conductors: [
      { role: 'fase', sectionMM2: 1.5 },
      { role: 'neutro', sectionMM2: 1.5 },
      { role: 'pe', sectionMM2: 1.5 }
    ]
  };

  const cB2B3: Conduit = {
    id: 'cond-b2-b3',
    fromElementId: 'elem-b2',
    toElementId: 'elem-b3',
    fromLevelId: 'level-1',
    toLevelId: 'level-1',
    diameterMM: 19,
    material: 'corrugado_blanco_pvc',
    isVerticalRiser: false,
    circuitId: 'circ-old',
    conductors: [
      { role: 'fase', sectionMM2: 1.5 },
      { role: 'neutro', sectionMM2: 1.5 },
      { role: 'pe', sectionMM2: 1.5 }
    ]
  };

  // Elementos de Rama 2 (conectada al mismo TP pero independiente)
  const b4: ElectricalElement = {
    id: 'elem-b4',
    symbolId: 'sym-planta-toma',
    levelId: 'level-1',
    spaceId: 'space-2',
    placement: 'wall',
    x: 0,
    y: 5,
    heightZ: 0.30,
    circuitId: 'circ-other',
    label: 'B4',
    status: 'existente',
    powerW: 150,
    phases: 1
  };

  const cTpB4: Conduit = {
    id: 'cond-tp-b4',
    fromElementId: 'elem-tp',
    toElementId: 'elem-b4',
    fromLevelId: 'level-1',
    toLevelId: 'level-1',
    diameterMM: 22,
    material: 'hierro_semipesado_rs',
    isVerticalRiser: false,
    circuitId: 'circ-other',
    conductors: [{ role: 'fase', sectionMM2: 2.5 }]
  };

  const allElements = [panelElement, b1, b2, b3, b4];
  const allConduits = [cTpB1, cB1B2, cB2B3, cTpB4];
  const allPanels = [panelData];
  const allCircuits: Circuit[] = [
    {
      id: 'circ-old',
      panelId: 'panel-tp',
      name: 'C1 - Iluminación',
      type: 'IUG',
      voltageV: 220,
      wireSectionBaseMM2: 1.5,
      breakerAmperageA: 10
    },
    {
      id: 'circ-new',
      panelId: 'panel-tp',
      name: 'C2 - Tomas',
      type: 'TUG',
      voltageV: 220,
      wireSectionBaseMM2: 2.5,
      breakerAmperageA: 16
    },
    {
      id: 'circ-other',
      panelId: 'panel-tp',
      name: 'C3 - Especial',
      type: 'TUE',
      voltageV: 220,
      wireSectionBaseMM2: 4.0,
      breakerAmperageA: 20
    }
  ];

  it('debe encontrar toda la rama conexa seleccionando cualquiera de sus bocas intermedias', () => {
    // Seleccionamos B2 (en medio de la Rama 1)
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'elem-b2' },
      elements: allElements,
      conduits: allConduits,
      panels: allPanels
    });

    expect(branch).not.toBeNull();
    // Debe contener B1, B2, B3
    expect(branch?.elementIds.sort()).toEqual(['elem-b1', 'elem-b2', 'elem-b3'].sort());
    // Debe contener los 3 tramos de cañería de la Rama 1
    expect(branch?.conduitIds.sort()).toEqual(['cond-b1-b2', 'cond-b2-b3', 'cond-tp-b1'].sort());
    // El tablero TP debe estar identificado como límite / extremo
    expect(branch?.boundaryPanelIds).toEqual(['elem-tp']);
    expect(branch?.primaryBoundaryPanel?.id).toBe('elem-tp');

    // REGLA FUNDAMENTAL: NO debe haber atravesado el tablero TP hacia la Rama 2 (B4 ni cond-tp-b4)
    expect(branch?.elementIds).not.toContain('elem-b4');
    expect(branch?.conduitIds).not.toContain('cond-tp-b4');
  });

  it('debe encontrar la misma rama seleccionando un tramo de cañería', () => {
    // Seleccionamos el tramo que une B2 y B3
    const branch = findConnectedBranch({
      startEntity: { type: 'conduit', id: 'cond-b2-b3' },
      elements: allElements,
      conduits: allConduits,
      panels: allPanels
    });

    expect(branch).not.toBeNull();
    expect(branch?.elementIds.sort()).toEqual(['elem-b1', 'elem-b2', 'elem-b3'].sort());
    expect(branch?.conduitIds.sort()).toEqual(['cond-b1-b2', 'cond-b2-b3', 'cond-tp-b1'].sort());
    expect(branch?.boundaryPanelIds).toEqual(['elem-tp']);
  });

  it('debe actualizar características de cañería, cable y circuito en toda la rama sin tocar la Rama 2', () => {
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'elem-b1' },
      elements: allElements,
      conduits: allConduits,
      panels: allPanels
    })!;

    const payload: BranchUpdatePayload = {
      circuitId: 'circ-new',
      conduitMaterial: 'hierro_semipesado_rs',
      conduitDiameterMM: 22,
      wireSectionMM2: 2.5,
      status: 'existente'
    };

    const result = applyBranchUpdates({
      branch,
      updates: payload,
      allElements,
      allConduits,
      allPanels,
      allCircuits
    });

    // 1. Todas las bocas de Rama 1 (B1, B2, B3) deben tener el nuevo circuito y estado
    const updatedB1 = result.updatedElements.find((e) => e.id === 'elem-b1');
    const updatedB2 = result.updatedElements.find((e) => e.id === 'elem-b2');
    const updatedB3 = result.updatedElements.find((e) => e.id === 'elem-b3');

    expect(updatedB1?.circuitId).toBe('circ-new');
    expect(updatedB1?.status).toBe('existente');
    expect(updatedB2?.circuitId).toBe('circ-new');
    expect(updatedB3?.circuitId).toBe('circ-new');

    // 2. Todos los tramos de cañería de Rama 1 deben tener nuevo material, diámetro y sección
    const updatedCondsRama1 = result.updatedConduits.filter((c) =>
      ['cond-tp-b1', 'cond-b1-b2', 'cond-b2-b3'].includes(c.id)
    );

    expect(updatedCondsRama1).toHaveLength(3);
    for (const c of updatedCondsRama1) {
      expect(c.material).toBe('hierro_semipesado_rs');
      expect(c.diameterMM).toBe(22);
      expect(c.circuitId).toBe('circ-new');
      expect(c.conductors[0].sectionMM2).toBe(2.5);
      expect(c.conductors[0].circuitId).toBe('circ-new');
    }

    // 3. REGLA MANDATORIA: El tablero NO debe perder su naturaleza
    const updatedTp = result.updatedElements.find((e) => e.id === 'elem-tp');
    expect(updatedTp?.isPanel).toBe(true);
    expect(updatedTp?.symbolId).toBe('sym-planta-tp');
    expect(updatedTp?.heightZ).toBe(1.40);
    expect(updatedTp?.placement).toBe('wall');
    expect(updatedTp?.status).toBe('existente'); // Actualiza estado de relevamiento

    // 4. REGLA MANDATORIA: Elementos de la Rama 2 permanecen inalterados
    const b4Unchanged = result.updatedElements.find((e) => e.id === 'elem-b4');
    expect(b4Unchanged?.circuitId).toBe('circ-other');

    const cTpB4Unchanged = result.updatedConduits.find((c) => c.id === 'cond-tp-b4');
    expect(cTpB4Unchanged?.circuitId).toBe('circ-other');
    expect(cTpB4Unchanged?.material).toBe('hierro_semipesado_rs');
  });

  it('debe soportar ramas con bifurcaciones en T o estrella', () => {
    // B1 se conecta a B2 y a B3 como derivación en T
    const tElements: ElectricalElement[] = [
      { id: 'b-root', symbolId: 'sym-planta-boca-techo', levelId: 'l1', spaceId: 's1', placement: 'ceiling', x: 0, y: 0, heightZ: 2.6 },
      { id: 'b-left', symbolId: 'sym-planta-boca-techo', levelId: 'l1', spaceId: 's1', placement: 'ceiling', x: -2, y: 0, heightZ: 2.6 },
      { id: 'b-right', symbolId: 'sym-planta-boca-techo', levelId: 'l1', spaceId: 's1', placement: 'ceiling', x: 2, y: 0, heightZ: 2.6 }
    ];

    const tConduits: Conduit[] = [
      { id: 'c-left', fromElementId: 'b-root', toElementId: 'b-left', fromLevelId: 'l1', toLevelId: 'l1', diameterMM: 19, material: 'pvc_rigido_metrico', isVerticalRiser: false, conductors: [] },
      { id: 'c-right', fromElementId: 'b-root', toElementId: 'b-right', fromLevelId: 'l1', toLevelId: 'l1', diameterMM: 19, material: 'pvc_rigido_metrico', isVerticalRiser: false, conductors: [] }
    ];

    // Al seleccionar b-left, debe recorrer b-root y alcanzar b-right
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'b-left' },
      elements: tElements,
      conduits: tConduits
    });

    expect(branch).not.toBeNull();
    expect(branch?.elementIds.sort()).toEqual(['b-left', 'b-right', 'b-root'].sort());
    expect(branch?.conduitIds.sort()).toEqual(['c-left', 'c-right'].sort());
  });

  it('debe aplicar presets reglamentarios AEA a todos los tramos de la rama', () => {
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'elem-b3' },
      elements: allElements,
      conduits: allConduits,
      panels: allPanels
    })!;

    const result = applyBranchUpdates({
      branch,
      updates: {
        conductorPresetId: 'tug_2x2.5_pe', // Preset 2x2.5 + 2.5 PE
        circuitId: 'circ-new'
      },
      allElements,
      allConduits,
      allPanels,
      allCircuits
    });

    const c1 = result.updatedConduits.find((c) => c.id === 'cond-tp-b1')!;
    expect(c1.conductors).toHaveLength(3);
    expect(c1.conductors.map((c) => c.role)).toEqual(['fase', 'neutro', 'pe']);
    expect(c1.conductors[0].sectionMM2).toBe(2.5);
    expect(c1.conductors[0].circuitId).toBe('circ-new');
  });

  it('debe manejar ciclos en la rama sin bucles infinitos', () => {
    // Triángulo cerrado: B1 <-> B2 <-> B3 <-> B1
    const loopElements: ElectricalElement[] = [
      { id: 'b1', symbolId: 'sym-planta-boca-techo', levelId: 'l1', spaceId: 's1', placement: 'ceiling', x: 0, y: 0, heightZ: 2.6 },
      { id: 'b2', symbolId: 'sym-planta-boca-techo', levelId: 'l1', spaceId: 's1', placement: 'ceiling', x: 2, y: 0, heightZ: 2.6 },
      { id: 'b3', symbolId: 'sym-planta-boca-techo', levelId: 'l1', spaceId: 's1', placement: 'ceiling', x: 1, y: 2, heightZ: 2.6 }
    ];

    const loopConduits: Conduit[] = [
      { id: 'c12', fromElementId: 'b1', toElementId: 'b2', fromLevelId: 'l1', toLevelId: 'l1', diameterMM: 19, material: 'pvc_rigido_metrico', isVerticalRiser: false, conductors: [] },
      { id: 'c23', fromElementId: 'b2', toElementId: 'b3', fromLevelId: 'l1', toLevelId: 'l1', diameterMM: 19, material: 'pvc_rigido_metrico', isVerticalRiser: false, conductors: [] },
      { id: 'c31', fromElementId: 'b3', toElementId: 'b1', fromLevelId: 'l1', toLevelId: 'l1', diameterMM: 19, material: 'pvc_rigido_metrico', isVerticalRiser: false, conductors: [] }
    ];

    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'b2' },
      elements: loopElements,
      conduits: loopConduits
    });

    expect(branch).not.toBeNull();
    expect(branch?.elements).toHaveLength(3);
    expect(branch?.conduits).toHaveLength(3);
  });

  it('al cambiar el material de la cañería debe validar o ajustar el diámetro según el catálogo', () => {
    const branch = findConnectedBranch({
      startEntity: { type: 'electrical_element', id: 'elem-b1' },
      elements: allElements,
      conduits: allConduits,
      panels: allPanels
    })!;

    // Cambiamos a bandeja perforada con calibre inexistente (ej 19mm no es de bandeja)
    const result = applyBranchUpdates({
      branch,
      updates: {
        conduitMaterial: 'bandeja_perforada_20',
        conduitDiameterMM: 19 // inválido para bandeja
      },
      allElements,
      allConduits,
      allPanels,
      allCircuits
    });

    const c1 = result.updatedConduits.find((c) => c.id === 'cond-tp-b1')!;
    expect(c1.material).toBe('bandeja_perforada_20');
    // Debe haber hecho fallback al default de bandeja (50mm o 100mm)
    expect(c1.diameterMM).toBeGreaterThanOrEqual(50);
  });
});
