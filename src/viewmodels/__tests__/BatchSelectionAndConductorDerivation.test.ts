import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import type { Conduit, ElectricalElement, Circuit } from '../../models/electrical/ElectricalModel';

describe('BatchSelectionAndConductorDerivation', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();

    // Configurar circuitos de prueba
    const circuits: Circuit[] = [
      {
        id: 'c1',
        panelId: 'panel-1',
        name: 'C1 - Iluminación',
        type: 'IUG',
        voltageV: 220,
        wireSectionBaseMM2: 1.5,
        wireSectionPeMM2: 1.5,
        breakerAmperageA: 10
      },
      {
        id: 'c2',
        panelId: 'panel-1',
        name: 'C2 - Tomas',
        type: 'TUG',
        voltageV: 220,
        wireSectionBaseMM2: 2.5,
        wireSectionPeMM2: 2.5,
        breakerAmperageA: 16
      }
    ];

    useProjectStore.setState((state) => ({
      project: {
        ...state.project,
        circuits
      }
    }));
  });

  describe('Multi-Selección y Selección por Criterio', () => {
    beforeEach(() => {
      const el1: ElectricalElement = {
        id: 'b1',
        symbolId: 'sym-planta-boca-techo',
        placement: 'ceiling',
        levelId: 'level-1',
        spaceId: 's1',
        x: 0,
        y: 0,
        heightZ: 2.6,
        circuitId: 'c1',
        status: 'existente'
      };
      const el2: ElectricalElement = {
        id: 'sw1',
        symbolId: 'sym-planta-llave-1',
        placement: 'wall',
        levelId: 'level-1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1',
        status: 'existente'
      };
      const el3: ElectricalElement = {
        id: 'toma1',
        symbolId: 'sym-planta-toma',
        placement: 'wall',
        levelId: 'level-1',
        spaceId: 's1',
        x: 3,
        y: 0,
        heightZ: 0.3,
        circuitId: 'c2',
        status: 'proyectado'
      };

      const c1: Conduit = {
        id: 'cond-1',
        fromElementId: 'b1',
        toElementId: 'sw1',
        fromLevelId: 'level-1',
        toLevelId: 'level-1',
        diameterMM: 19,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };
      const c2: Conduit = {
        id: 'cond-2',
        fromElementId: 'b1',
        toElementId: 'toma1',
        fromLevelId: 'level-1',
        toLevelId: 'level-1',
        diameterMM: 22,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitIds: ['c1', 'c2'],
        conductors: []
      };

      useProjectStore.setState((state) => ({
        project: {
          ...state.project,
          electricalElements: [el1, el2, el3],
          conduits: [c1, c2]
        }
      }));
    });

    it('toggleSelectEntity conmuta selección simple y selección múltiple con Shift', () => {
      const store = useProjectStore.getState();

      // Selección simple
      store.toggleSelectEntity({ type: 'electrical_element', id: 'b1' }, false);
      expect(useProjectStore.getState().selectedEntity?.id).toBe('b1');
      expect(useProjectStore.getState().selectedEntities).toHaveLength(1);

      // Selección múltiple (Shift + Clic): suma sw1
      useProjectStore.getState().toggleSelectEntity({ type: 'electrical_element', id: 'sw1' }, true);
      expect(useProjectStore.getState().selectedEntities).toHaveLength(2);
      expect(useProjectStore.getState().selectedEntities.map((e) => e.id)).toContain('b1');
      expect(useProjectStore.getState().selectedEntities.map((e) => e.id)).toContain('sw1');

      // Shift + Clic en elemento ya seleccionado: lo remueve
      useProjectStore.getState().toggleSelectEntity({ type: 'electrical_element', id: 'b1' }, true);
      expect(useProjectStore.getState().selectedEntities).toHaveLength(1);
      expect(useProjectStore.getState().selectedEntities[0].id).toBe('sw1');
    });

    it('selectByCriteria selecciona todos los elementos por circuito (C1)', () => {
      const store = useProjectStore.getState();
      store.selectByCriteria({ circuitId: 'c1' });

      const selected = useProjectStore.getState().selectedEntities;
      // Deben estar b1, sw1, cond-1 y cond-2 (porque cond-2 lleva C1 y C2)
      expect(selected.map((e) => e.id)).toContain('b1');
      expect(selected.map((e) => e.id)).toContain('sw1');
      expect(selected.map((e) => e.id)).toContain('cond-1');
      expect(selected.map((e) => e.id)).toContain('cond-2');
      expect(selected).toHaveLength(4);
    });

    it('selectByCriteria selecciona caños por material y diámetro (RS 19)', () => {
      const store = useProjectStore.getState();
      store.selectByCriteria({
        conduitMaterial: 'hierro_semipesado_rs',
        conduitDiameterMM: 19
      });

      const selected = useProjectStore.getState().selectedEntities;
      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe('cond-1');
    });

    it('selectByCriteria selecciona bocas por símbolo (sym-planta-llave-1)', () => {
      const store = useProjectStore.getState();
      store.selectByCriteria({
        elementSymbolId: 'sym-planta-llave-1'
      });

      const selected = useProjectStore.getState().selectedEntities;
      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe('sw1');
    });

    it('batchUpdateConduits actualiza caños seleccionados por lote', () => {
      const store = useProjectStore.getState();
      store.batchUpdateConduits(['cond-1', 'cond-2'], {
        material: 'hierro_semipesado_rs',
        diameterMM: 25
      });

      const conduits = useProjectStore.getState().project.conduits;
      expect(conduits[0].material).toBe('hierro_semipesado_rs');
      expect(conduits[0].diameterMM).toBe(25);
      expect(conduits[1].material).toBe('hierro_semipesado_rs');
      expect(conduits[1].diameterMM).toBe(25);
    });

    it('batchUpdateElectricalElements actualiza bocas seleccionadas por lote', () => {
      const store = useProjectStore.getState();
      store.batchUpdateElectricalElements(['b1', 'sw1'], {
        status: 'a_reemplazar'
      });

      const elements = useProjectStore.getState().project.electricalElements;
      const b1 = elements.find((e) => e.id === 'b1');
      const sw1 = elements.find((e) => e.id === 'sw1');
      expect(b1?.status).toBe('a_reemplazar');
      expect(sw1?.status).toBe('a_reemplazar');
    });
  });

  describe('Deducción Automática de Conductores en Store', () => {
    it('updateConduit con cambio de circuitos deriva automáticamente conductores (regla PE compartido)', () => {
      const b1: ElectricalElement = {
        id: 'b1',
        symbolId: 'sym-planta-boca-techo',
        placement: 'ceiling',
        levelId: 'level-1',
        spaceId: 's1',
        x: 0,
        y: 0,
        heightZ: 2.6
      };
      const b2: ElectricalElement = {
        id: 'b2',
        symbolId: 'sym-planta-boca-techo',
        placement: 'ceiling',
        levelId: 'level-1',
        spaceId: 's1',
        x: 4,
        y: 0,
        heightZ: 2.6
      };
      const cond: Conduit = {
        id: 'cond-test',
        fromElementId: 'b1',
        toElementId: 'b2',
        fromLevelId: 'level-1',
        toLevelId: 'level-1',
        diameterMM: 22,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        conductors: []
      };

      useProjectStore.setState((state) => ({
        project: {
          ...state.project,
          electricalElements: [b1, b2],
          conduits: [cond]
        }
      }));

      // Asignar C1 (1.5mm²) y C2 (2.5mm²) al caño
      useProjectStore.getState().updateConduit('cond-test', {
        circuitIds: ['c1', 'c2']
      });

      const updated = useProjectStore.getState().project.conduits.find((c) => c.id === 'cond-test');
      expect(updated?.conductors).toHaveLength(5); // 2 de 1.5 + 2 de 2.5 + 1 de 2.5 PE
      const pe = updated?.conductors.find((c) => c.role === 'pe');
      expect(pe?.sectionMM2).toBe(2.5);
    });

    it('batchDeriveConduitConductors calcula conductores para todo el lote seleccionado', () => {
      const b1: ElectricalElement = {
        id: 'b1',
        symbolId: 'sym-planta-boca-techo',
        placement: 'ceiling',
        levelId: 'level-1',
        spaceId: 's1',
        x: 0,
        y: 0,
        heightZ: 2.6
      };
      const sw1: ElectricalElement = {
        id: 'sw1',
        symbolId: 'sym-planta-llave-2',
        placement: 'wall',
        levelId: 'level-1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1'
      };
      const cSw: Conduit = {
        id: 'c-sw',
        fromElementId: 'b1',
        toElementId: 'sw1',
        fromLevelId: 'level-1',
        toLevelId: 'level-1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: [] // Vacío inicialmente
      };

      useProjectStore.setState((state) => ({
        project: {
          ...state.project,
          electricalElements: [b1, sw1],
          conduits: [cSw]
        },
        selectedEntities: [{ type: 'conduit', id: 'c-sw' }]
      }));

      useProjectStore.getState().batchDeriveConduitConductors();

      const updated = useProjectStore.getState().project.conduits.find((c) => c.id === 'c-sw');
      // Llave 2 puntos: 1 Fase + 2 Retornos + 1 PE = 4 conductores
      expect(updated?.conductors).toHaveLength(4);
      expect(updated?.conductors.map((c) => c.role)).toEqual(['fase', 'retorno', 'retorno', 'pe']);
      const pe = updated?.conductors.find((c) => c.role === 'pe');
      expect(pe?.sectionMM2).toBe(1.5);
    });
  });
});
