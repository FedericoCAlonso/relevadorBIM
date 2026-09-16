/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ElectricalStandards.test.ts
 * Verificación de Catálogos Normativos AEA y Motor de Cálculo MVVM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  CONDUIT_MATERIALS_CATALOG,
  DEFAULT_CONDUIT_MATERIAL,
  DEFAULT_CONDUIT_DIAMETER_MM,
  AEA_CALCULATION_CONSTANTS,
  AEA_CONDUCTOR_PRESETS,
  getSizesForConduitMaterial,
  getDefaultSizeForConduitMaterial,
  createDefaultMaterialCatalog,
  getSizesForConduitType,
  getDefaultSizeForConduitType,
  BOX_CATEGORIES_CATALOG,
  BOX_MATERIALS_CATALOG
} from '../electricalStandards';
import {
  getConduitLengthBreakdown,
  calculateConduitOccupancyFactor
} from '../calculations';
import type { ElectricalElement } from '../ElectricalModel';
import type { Level } from '../../architecture/Level';

describe('Catálogos y Normas Eléctricas AEA (Model layer)', () => {
  it('debe tener Caño Hierro Semipesado RS como primera opción y por defecto', () => {
    expect(DEFAULT_CONDUIT_MATERIAL).toBe('hierro_semipesado_rs');
    expect(CONDUIT_MATERIALS_CATALOG[0].id).toBe('hierro_semipesado_rs');
    expect(CONDUIT_MATERIALS_CATALOG[1].id).toBe('hierro_liviano_rl');
    expect(CONDUIT_MATERIALS_CATALOG[2].id).toBe('pvc_rigido_metrico');
    expect(CONDUIT_MATERIALS_CATALOG[3].id).toBe('corrugado_blanco_pvc');
    expect(CONDUIT_MATERIALS_CATALOG[4].id).toBe('bandeja_perforada_20');
  });

  it('debe tener el diámetro por defecto normalizado en 19 mm', () => {
    expect(DEFAULT_CONDUIT_DIAMETER_MM).toBe(19);
  });

  it('debe calcular trayectorias estrictamente ortogonales y considerar desnivel Z', () => {
    const elA: ElectricalElement = {
      id: 'el-1',
      symbolId: 'sym-toma',
      levelId: 'lvl-1',
      spaceId: 'sp-1',
      placement: 'wall',
      x: 0,
      y: 0,
      heightZ: 0.30 // Toma zócalo
    };

    const elB: ElectricalElement = {
      id: 'el-2',
      symbolId: 'sym-techo',
      levelId: 'lvl-1',
      spaceId: 'sp-1',
      placement: 'ceiling',
      x: 3.0,
      y: 4.0,
      heightZ: 2.70 // Centro de techo
    };

    const levelsMap = new Map<string, Level>();

    const breakdown = getConduitLengthBreakdown({
      fromElement: elA,
      toElement: elB,
      levelsMap,
      isOrthogonalRouting: true
    });

    // dx = 3, dy = 4 -> Distancia ortogonal en planta = 3 + 4 = 7m (no hipotenusa de 5m)
    expect(breakdown.dx).toBe(3);
    expect(breakdown.dy).toBe(4);
    expect(breakdown.distPlantaOrthogonal).toBe(7);

    // Desnivel vertical Z = |2.70 - 0.30| = 2.40m
    expect(breakdown.dzLocal).toBe(2.40);

    // Suma cruda = 7.0 + 2.40 = 9.40m. Con 10% de curvas y desperdicio = 9.40 * 1.1 = 10.34m
    expect(breakdown.totalLengthM).toBe(10.34);
  });

  it('debe verificar el límite de ocupación reglamentaria AEA del 35%', () => {
    // 3 cables de 2.5 mm² en caño de Ø19mm (estándar TUG)
    const compliant = calculateConduitOccupancyFactor({
      conduitDiameterMM: 19,
      conductors: [
        { role: 'fase', sectionMM2: 2.5 },
        { role: 'neutro', sectionMM2: 2.5 },
        { role: 'pe', sectionMM2: 2.5 }
      ]
    });

    expect(compliant.isCompliant).toBe(true);
    expect(compliant.occupancyPercent).toBeLessThanOrEqual(AEA_CALCULATION_CONSTANTS.MAX_CONDUIT_OCCUPANCY_PERCENT);

    // Caño sobrecargado con 10 cables de 6mm² en caño de Ø16mm
    const overloaded = calculateConduitOccupancyFactor({
      conduitDiameterMM: 16,
      conductors: Array(10).fill({ role: 'fase', sectionMM2: 6.0 })
    });

    expect(overloaded.isCompliant).toBe(false);
    expect(overloaded.occupancyPercent).toBeGreaterThan(35.0);
  });

  it('todos los presets de conductores deben tener colores y secciones normalizados', () => {
    for (const preset of AEA_CONDUCTOR_PRESETS) {
      expect(preset.conductors.length).toBeGreaterThan(0);
      for (const cond of preset.conductors) {
        expect(cond.sectionMM2).toBeGreaterThan(0);
        expect(cond.color).toBeDefined();
        expect(cond.color?.startsWith('#')).toBe(true);
      }
    }
  });

  it('debe proveer calibres normalizados dependientes del material de conducto', () => {
    // Caño Hierro Semipesado RS
    const rsSizes = getSizesForConduitMaterial('hierro_semipesado_rs');
    expect(rsSizes.length).toBeGreaterThanOrEqual(6);
    expect(rsSizes[0].standardSize).toBe('RS 16');
    expect(getDefaultSizeForConduitMaterial('hierro_semipesado_rs')).toBe(19);

    // PVC Rígido Métrico
    const pvcSizes = getSizesForConduitMaterial('pvc_rigido_metrico');
    expect(pvcSizes.some((s: any) => s.value === 20)).toBe(true);
    expect(pvcSizes.some((s: any) => s.value === 63)).toBe(true);
    expect(getDefaultSizeForConduitMaterial('pvc_rigido_metrico')).toBe(20);

    // Bandeja Perforada de 20 (no tiene diámetros sino ancho x alto)
    const bandejaSizes = getSizesForConduitMaterial('bandeja_perforada_20');
    expect(bandejaSizes.some((s: any) => s.standardSize.includes('100x20'))).toBe(true);
    expect(bandejaSizes.some((s: any) => s.standardSize.includes('200x20'))).toBe(true);
    expect(bandejaSizes.find((s: any) => s.value === 200)?.usefulAreaMM2).toBe(4000);
    expect(getDefaultSizeForConduitMaterial('bandeja_perforada_20')).toBe(200);
  });

  it('debe generar un catálogo inicial completo con las 3 categorías físicas rígidas', () => {
    const catalog = createDefaultMaterialCatalog();
    expect(catalog.conduitTypes.length).toBeGreaterThanOrEqual(5);
    expect(catalog.cableTypes.length).toBeGreaterThanOrEqual(4);
    expect(catalog.boxTypes.length).toBeGreaterThanOrEqual(5);

    // Canalizaciones
    expect(catalog.conduitTypes[0].id).toBe('hierro_semipesado_rs');
    expect(catalog.conduitTypes[0].availableSizes.length).toBeGreaterThan(0);

    // Conductores
    expect(catalog.cableTypes.some((c) => c.id === 'IRAM_NM_247_3')).toBe(true);
    expect(catalog.cableTypes.some((c) => c.id === 'IRAM_2178_SUB')).toBe(true);

    // Cajas
    expect(catalog.boxTypes.some((b) => b.id === 'caja_rectangular_chapa')).toBe(true);
    expect(catalog.boxTypes.some((b) => b.category === 'gabinete_tablero')).toBe(true);

    // Catálogos auxiliares
    expect(BOX_CATEGORIES_CATALOG.length).toBeGreaterThanOrEqual(5);
    expect(BOX_MATERIALS_CATALOG.length).toBeGreaterThanOrEqual(3);
  });

  it('debe soportar tipos personalizados de canalización y resolver sus calibres dinámicamente', () => {
    const catalog = createDefaultMaterialCatalog();
    const customConduit = {
      id: 'custom_bergman',
      name: 'Caño Bergman Histórico',
      description: 'Caño aislante de latón con papel alquitranado',
      defaultSizeMM: 16,
      availableSizes: [
        { value: 11, label: 'Bergman 11', standardSize: '11', usefulAreaMM2: 95 },
        { value: 16, label: 'Bergman 16', standardSize: '16', usefulAreaMM2: 201 }
      ],
      isCustom: true
    };
    catalog.conduitTypes.push(customConduit);

    const sizes = getSizesForConduitType('custom_bergman', catalog);
    expect(sizes.length).toBe(2);
    expect(sizes[0].standardSize).toBe('11');
    expect(getDefaultSizeForConduitType('custom_bergman', catalog)).toBe(16);
  });
});
