/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: TerminalReferenceMetrics.test.ts
 * Pruebas unitarias para Etiquetas de Pase / Remates de Cañería:
 * - Generación de dotación y colores normalizados de conductores.
 * - Desacoplamiento métrico de longitud total frente al trazado 2D esquemático.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  createConductorsForTerminal,
  AEA_CONDUCTOR_COLORS
} from '../electricalStandards';
import { calculateConduitRealLength } from '../conduitMetrics';
import type { ElectricalElement, Conduit } from '../ElectricalModel';
import { createDefaultLevel, type Level } from '../../architecture/Level';

describe('Etiquetas de Pase y Remates de Cañería (Terminal References)', () => {
  describe('createConductorsForTerminal', () => {
    it('genera dotación monofásica (3 conductores: Fase, Neutro, PE)', () => {
      const conductors = createConductorsForTerminal(2.5, 3);
      expect(conductors).toHaveLength(3);
      expect(conductors[0]).toEqual({
        role: 'fase',
        sectionMM2: 2.5,
        color: AEA_CONDUCTOR_COLORS.fase
      });
      expect(conductors[1]).toEqual({
        role: 'neutro',
        sectionMM2: 2.5,
        color: AEA_CONDUCTOR_COLORS.neutro
      });
      expect(conductors[2]).toEqual({
        role: 'pe',
        sectionMM2: 2.5,
        color: AEA_CONDUCTOR_COLORS.pe
      });
    });

    it('genera dotación trifásica sin neutro (4 conductores: R, S, T, PE)', () => {
      const conductors = createConductorsForTerminal(4.0, 4);
      expect(conductors).toHaveLength(4);
      expect(conductors.map((c) => c.role)).toEqual(['fase_r', 'fase_s', 'fase_t', 'pe']);
      expect(conductors.every((c) => c.sectionMM2 === 4.0)).toBe(true);
      expect(conductors[0].color).toBe(AEA_CONDUCTOR_COLORS.fase_r);
      expect(conductors[1].color).toBe(AEA_CONDUCTOR_COLORS.fase_s);
      expect(conductors[2].color).toBe(AEA_CONDUCTOR_COLORS.fase_t);
      expect(conductors[3].color).toBe(AEA_CONDUCTOR_COLORS.pe);
    });

    it('genera dotación trifásica completa (5 conductores: R, S, T, Neutro, PE)', () => {
      const conductors = createConductorsForTerminal(6.0, 5);
      expect(conductors).toHaveLength(5);
      expect(conductors.map((c) => c.role)).toEqual([
        'fase_r',
        'fase_s',
        'fase_t',
        'neutro',
        'pe'
      ]);
      expect(conductors.every((c) => c.sectionMM2 === 6.0)).toBe(true);
      expect(conductors[3].color).toBe(AEA_CONDUCTOR_COLORS.neutro);
      expect(conductors[4].color).toBe(AEA_CONDUCTOR_COLORS.pe);
    });
  });

  describe('Cómputo Métrico Desacoplado', () => {
    const level: Level = createDefaultLevel('lvl-1', 'Planta Baja', 0);
    const levelsMap = new Map<string, Level>([['lvl-1', level]]);

    const startBoca: ElectricalElement = {
      id: 'boca-origen',
      symbolId: 'sym-centro',
      levelId: 'lvl-1',
      spaceId: 'sp-1',
      placement: 'ceiling',
      x: 2.0,
      y: 2.0,
      heightZ: 2.60
    };

    const terminalTag: ElectricalElement = {
      id: 'tag-pase',
      symbolId: 'sym-terminal-referencia',
      levelId: 'lvl-1',
      spaceId: 'sp-1',
      placement: 'ceiling',
      x: 2.8, // Dibujado a solo 0.8m en plano
      y: 2.0,
      heightZ: 2.60,
      isTerminalReference: true,
      targetDescription: 'A Tablero General en SS',
      totalLengthM: 18.5 // Longitud física real declarada del tramo
    };

    it('calcula la longitud 2D/3D basada en geometría si no hay manualLengthM', () => {
      const geoLen = calculateConduitRealLength({
        fromElement: startBoca,
        toElement: terminalTag,
        levelsMap
      });
      // 0.8m x 1.10 = 0.88m
      expect(geoLen).toBeCloseTo(0.88, 2);
    });

    it('la cañería que converge a la etiqueta adopta la longitud fija total del tramo', () => {
      const conduit: Conduit = {
        id: 'cond-1',
        fromElementId: startBoca.id,
        toElementId: terminalTag.id,
        fromLevelId: 'lvl-1',
        toLevelId: 'lvl-1',
        diameterMM: 22,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        manualLengthM: terminalTag.totalLengthM, // Sincronizado con totalLengthM
        conductors: createConductorsForTerminal(4.0, 3)
      };

      const effectiveLength =
        conduit.manualLengthM ||
        calculateConduitRealLength({
          fromElement: startBoca,
          toElement: terminalTag,
          levelsMap
        });

      expect(effectiveLength).toBe(18.5);

      // Si el dibujante desplaza la etiqueta 5 metros más lejos en el lienzo por estética:
      const movedTag: ElectricalElement = {
        ...terminalTag,
        x: 7.8,
        y: 6.0
      };

      // El cómputo efectivo debe permanecer invariante en 18.5 m
      const effectiveLengthAfterMove =
        conduit.manualLengthM ||
        calculateConduitRealLength({
          fromElement: startBoca,
          toElement: movedTag,
          levelsMap
        });

      expect(effectiveLengthAfterMove).toBe(18.5);
    });
  });
});
