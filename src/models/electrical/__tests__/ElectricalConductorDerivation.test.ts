import { describe, it, expect } from 'vitest';
import type { Conduit, ElectricalElement, Circuit } from '../ElectricalModel';
import {
  deriveConduitConductors,
  getSwitchTypeInfo
} from '../electricalConductorDerivation';

describe('electricalConductorDerivation', () => {
  const sampleCircuits: Circuit[] = [
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
    },
    {
      id: 'c3',
      panelId: 'panel-1',
      name: 'C3 - Especial',
      type: 'TUE',
      voltageV: 220,
      wireSectionBaseMM2: 4.0,
      wireSectionPeMM2: 4.0,
      breakerAmperageA: 20
    },
    {
      id: 'c-tri',
      panelId: 'panel-1',
      name: 'C4 - Trifásico',
      type: 'FM',
      voltageV: 380,
      phases: 3,
      wireSectionBaseMM2: 4.0,
      wireSectionPeMM2: 4.0,
      breakerAmperageA: 25
    }
  ];

  describe('getSwitchTypeInfo', () => {
    it('detecta correctamente llaves de 1, 2, 3, 4 puntos y combinación', () => {
      expect(getSwitchTypeInfo('sym-planta-llave-1')).toEqual({
        isSwitch: true,
        switchPoints: 1,
        isCombination: false
      });
      expect(getSwitchTypeInfo('sym-planta-llave-2')).toEqual({
        isSwitch: true,
        switchPoints: 2,
        isCombination: false
      });
      expect(getSwitchTypeInfo('sym-planta-llave-3')).toEqual({
        isSwitch: true,
        switchPoints: 3,
        isCombination: false
      });
      expect(getSwitchTypeInfo('sym-planta-llave-4')).toEqual({
        isSwitch: true,
        switchPoints: 4,
        isCombination: false
      });
      expect(getSwitchTypeInfo('sym-planta-llave-comb')).toEqual({
        isSwitch: true,
        switchPoints: 2,
        isCombination: true
      });
      expect(getSwitchTypeInfo('sym-planta-boca-techo')).toEqual({
        isSwitch: false,
        switchPoints: 0,
        isCombination: false
      });
    });
  });

  describe('Regla de Circuitos Troncales y PE Compartido', () => {
    it('genera 1 fase + 1 neutro + 1 PE para un solo circuito monofásico (C1 1.5mm²)', () => {
      const conduit: Conduit = {
        id: 'cond-1',
        fromElementId: 'boca-1',
        toElementId: 'boca-2',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits
      });

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.role)).toEqual(['fase', 'neutro', 'pe']);
      expect(result.every((c) => c.sectionMM2 === 1.5)).toBe(true);
    });

    it('regla del usuario: caño con C1 (1.5mm²) y C2 (2.5mm²) genera 2x1.5 + 2x2.5 + 1x2.5 PE (total 5 conductores)', () => {
      const conduit: Conduit = {
        id: 'cond-multi',
        fromElementId: 'boca-1',
        toElementId: 'boca-2',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 22,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        circuitIds: ['c1', 'c2'],
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits
      });

      // Debe haber exactamente 5 conductores:
      // 2 cables de 1.5 mm² (fase y neutro de C1)
      // 2 cables de 2.5 mm² (fase y neutro de C2)
      // 1 cable de 2.5 mm² de PE (máximo entre 1.5 y 2.5)
      expect(result).toHaveLength(5);

      const c1Conductors = result.filter((c) => c.circuitId === 'c1');
      expect(c1Conductors).toHaveLength(2);
      expect(c1Conductors.map((c) => c.role)).toEqual(['fase', 'neutro']);
      expect(c1Conductors.every((c) => c.sectionMM2 === 1.5)).toBe(true);

      const c2Conductors = result.filter((c) => c.circuitId === 'c2' && c.role !== 'pe');
      expect(c2Conductors).toHaveLength(2);
      expect(c2Conductors.map((c) => c.role)).toEqual(['fase', 'neutro']);
      expect(c2Conductors.every((c) => c.sectionMM2 === 2.5)).toBe(true);

      const peConductors = result.filter((c) => c.role === 'pe');
      expect(peConductors).toHaveLength(1);
      expect(peConductors[0].sectionMM2).toBe(2.5); // Sección unificada máxima
    });

    it('caño con 3 circuitos (C1 1.5mm², C2 2.5mm², C3 4.0mm²) unifica PE en 4.0mm²', () => {
      const conduit: Conduit = {
        id: 'cond-3',
        fromElementId: 'boca-1',
        toElementId: 'boca-2',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 25,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        circuitIds: ['c1', 'c2', 'c3'],
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits
      });

      expect(result).toHaveLength(7); // 2 + 2 + 2 + 1 PE
      const pe = result.find((c) => c.role === 'pe');
      expect(pe?.sectionMM2).toBe(4.0);
    });

    it('soporta circuito trifásico (3 fases + neutro + PE)', () => {
      const conduit: Conduit = {
        id: 'cond-tri',
        fromElementId: 'panel-1',
        toElementId: 'boca-fuerza',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 25,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        circuitId: 'c-tri',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits
      });

      expect(result).toHaveLength(5);
      expect(result.map((c) => c.role)).toEqual(['fase_r', 'fase_s', 'fase_t', 'neutro', 'pe']);
      expect(result.every((c) => c.sectionMM2 === 4.0)).toBe(true);
    });
  });

  describe('Regla de Caños hacia Llaves de Comando (Efecto)', () => {
    const centerBox: ElectricalElement = {
      id: 'box-center',
      symbolId: 'sym-planta-boca-techo',
      placement: 'ceiling',
      levelId: 'l1',
      spaceId: 's1',
      x: 2,
      y: 2,
      heightZ: 2.6,
      circuitId: 'c1'
    };

    it('Llave 1 punto: genera 1 fase + 1 retorno + 1 PE (misma sección de la fase)', () => {
      const switch1: ElectricalElement = {
        id: 'box-sw1',
        symbolId: 'sym-planta-llave-1',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1',
        returnRef: 'a'
      };

      const conduit: Conduit = {
        id: 'cond-sw1',
        fromElementId: centerBox.id,
        toElementId: switch1.id,
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: centerBox,
        toElement: switch1
      });

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.role)).toEqual(['fase', 'retorno', 'pe']);
      expect(result[0].sectionMM2).toBe(1.5);
      expect(result[1].sectionMM2).toBe(1.5);
      expect(result[1].reference).toBe('a');
      expect(result[2].role).toBe('pe');
      expect(result[2].sectionMM2).toBe(1.5); // PE con la misma sección de fase
    });

    it('Llave 2 puntos: genera 1 fase + 2 retornos + 1 PE', () => {
      const switch2: ElectricalElement = {
        id: 'box-sw2',
        symbolId: 'sym-planta-llave-2',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1'
      };

      const conduit: Conduit = {
        id: 'cond-sw2',
        fromElementId: centerBox.id,
        toElementId: switch2.id,
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: centerBox,
        toElement: switch2
      });

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.role)).toEqual(['fase', 'retorno', 'retorno', 'pe']);
      const retornos = result.filter((c) => c.role === 'retorno');
      expect(retornos).toHaveLength(2);
      expect(retornos[0].reference).toBe('a');
      expect(retornos[1].reference).toBe('b');
      const pe = result.find((c) => c.role === 'pe');
      expect(pe?.sectionMM2).toBe(1.5);
    });

    it('Llave 3 puntos: genera 1 fase + 3 retornos + 1 PE', () => {
      const switch3: ElectricalElement = {
        id: 'box-sw3',
        symbolId: 'sym-planta-llave-3',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1'
      };

      const conduit: Conduit = {
        id: 'cond-sw3',
        fromElementId: centerBox.id,
        toElementId: switch3.id,
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: centerBox,
        toElement: switch3
      });

      expect(result).toHaveLength(5);
      expect(result.map((c) => c.role)).toEqual(['fase', 'retorno', 'retorno', 'retorno', 'pe']);
      const retornos = result.filter((c) => c.role === 'retorno');
      expect(retornos.map((r) => r.reference)).toEqual(['a', 'b', 'c']);
    });

    it('Llave 4 puntos: genera 1 fase + 4 retornos + 1 PE', () => {
      const switch4: ElectricalElement = {
        id: 'box-sw4',
        symbolId: 'sym-planta-llave-4',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1'
      };

      const conduit: Conduit = {
        id: 'cond-sw4',
        fromElementId: centerBox.id,
        toElementId: switch4.id,
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: centerBox,
        toElement: switch4
      });

      expect(result).toHaveLength(6);
      expect(result.map((c) => c.role)).toEqual([
        'fase',
        'retorno',
        'retorno',
        'retorno',
        'retorno',
        'pe'
      ]);
      const retornos = result.filter((c) => c.role === 'retorno');
      expect(retornos.map((r) => r.reference)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('Llave de Combinación: genera 1 fase + 2 retornos (puentes viajeros) + 1 PE', () => {
      const switchComb: ElectricalElement = {
        id: 'box-swcomb',
        symbolId: 'sym-planta-llave-comb',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 2,
        heightZ: 1.2,
        circuitId: 'c1'
      };

      const conduit: Conduit = {
        id: 'cond-swcomb',
        fromElementId: centerBox.id,
        toElementId: switchComb.id,
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: centerBox,
        toElement: switchComb
      });

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.role)).toEqual(['fase', 'retorno', 'retorno', 'pe']);
      const pe = result.find((c) => c.role === 'pe');
      expect(pe?.sectionMM2).toBe(1.5);
    });

    it('Conexión directa entre dos llaves de combinación: genera 2 retornos (puentes) + 1 PE', () => {
      const switchComb1: ElectricalElement = {
        id: 'box-swcomb-1',
        symbolId: 'sym-planta-llave-comb',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 0,
        heightZ: 1.2,
        circuitId: 'c1'
      };

      const switchComb2: ElectricalElement = {
        id: 'box-swcomb-2',
        symbolId: 'sym-planta-llave-comb',
        placement: 'wall',
        levelId: 'l1',
        spaceId: 's1',
        x: 5,
        y: 0,
        heightZ: 1.2,
        circuitId: 'c1'
      };

      const conduit: Conduit = {
        id: 'cond-comb-between',
        fromElementId: switchComb1.id,
        toElementId: switchComb2.id,
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: switchComb1,
        toElement: switchComb2
      });

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.role)).toEqual(['retorno', 'retorno', 'pe']);
      expect(result.every((c) => c.sectionMM2 === 1.5)).toBe(true);
    });
  });

  describe('Preservación de Conductores Adicionales / Pasantes', () => {
    it('agrega retornos pasantes adicionales a la línea troncal sin duplicar PE', () => {
      const conduit: Conduit = {
        id: 'cond-pass',
        fromElementId: 'center-1',
        toElementId: 'center-2',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 22,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        circuitId: 'c1',
        conductors: [
          // Conductor adicional existente (retorno pasante)
          { role: 'retorno', sectionMM2: 1.5, reference: 'b' }
        ]
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits
      });

      // Línea C1 (Fase + Neutro + PE) + Retorno 'b'
      expect(result).toHaveLength(4);
      expect(result.filter((c) => c.role === 'pe')).toHaveLength(1);
      expect(result.some((c) => c.role === 'retorno' && c.reference === 'b')).toBe(true);
    });

    it('cuando un conducto tiene circuitIds vacío ([]), no debe heredar de las bocas y retorna conductores vacíos', () => {
      const box1: ElectricalElement = {
        id: 'box-1',
        symbolId: 'sym-planta-boca-techo',
        placement: 'ceiling',
        levelId: 'l1',
        spaceId: 's1',
        x: 0,
        y: 0,
        heightZ: 2.6,
        circuitId: 'c1'
      };
      const box2: ElectricalElement = {
        id: 'box-2',
        symbolId: 'sym-planta-boca-techo',
        placement: 'ceiling',
        levelId: 'l1',
        spaceId: 's1',
        x: 3,
        y: 0,
        heightZ: 2.6,
        circuitId: 'c1'
      };

      const conduit: Conduit = {
        id: 'cond-deselected',
        fromElementId: 'box-1',
        toElementId: 'box-2',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 19,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: null,
        circuitIds: [], // Deseleccionado explícitamente
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits,
        fromElement: box1,
        toElement: box2
      });

      expect(result).toEqual([]);
    });

    it('al alternar y deseleccionar un circuito de un caño multi-circuito, se recalculan exactamente los conductores restantes', () => {
      const conduit: Conduit = {
        id: 'cond-multi-to-single',
        fromElementId: 'box-1',
        toElementId: 'box-2',
        fromLevelId: 'l1',
        toLevelId: 'l1',
        diameterMM: 22,
        material: 'pvc_rigido_metrico',
        isVerticalRiser: false,
        circuitId: 'c1',
        circuitIds: ['c1'], // Se deseleccionó C2
        conductors: []
      };

      const result = deriveConduitConductors({
        conduit,
        circuits: sampleCircuits
      });

      // Solo debe tener C1: 2x1.5 (fase y neutro) + 1x1.5 PE (todos identificados con C1)
      expect(result).toHaveLength(3);
      expect(result.filter((c) => c.circuitId === 'c1')).toHaveLength(3);
      expect(result.filter((c) => c.circuitId === 'c2')).toHaveLength(0);
      const pe = result.find((c) => c.role === 'pe');
      expect(pe?.sectionMM2).toBe(1.5);
    });
  });
});

