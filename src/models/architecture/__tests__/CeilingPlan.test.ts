import { describe, it, expect } from 'vitest';
import {
  CEILING_MATERIAL_OPTIONS,
  getCeilingMaterialOption,
  computeEffectiveCeilingPolygon,
  calculateSettingOutDimensions,
  buildCeilingPlanData,
  CEILING_DISTRIBUTION_PRESETS,
  computeCeilingGridDistribution,
  calculatePresetDistribution
} from '../ceilingPlan';
import type { Space } from '../Space';
import type { WallVertex, Wall } from '../Wall';
import type { ElectricalElement } from '../../electrical/ElectricalModel';

describe('Modelo: Plano de Cielorraso Reflejado (RCP - ceilingPlan.ts)', () => {
  const verticesMap = new Map<string, WallVertex>([
    ['v1', { id: 'v1', x: 0, y: 0 }],
    ['v2', { id: 'v2', x: 6, y: 0 }],
    ['v3', { id: 'v3', x: 6, y: 4 }],
    ['v4', { id: 'v4', x: 0, y: 4 }]
  ]);

  const wallsMap = new Map<string, Wall>([
    ['w1', { id: 'w1', startVertexId: 'v1', endVertexId: 'v2', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false }],
    ['w2', { id: 'w2', startVertexId: 'v2', endVertexId: 'v3', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false }],
    ['w3', { id: 'w3', startVertexId: 'v3', endVertexId: 'v4', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false }],
    ['w4', { id: 'w4', startVertexId: 'v4', endVertexId: 'v1', levelId: 'lvl-1', thickness: 0.15, height: 2.7, isBearing: false }]
  ]);

  const baseSpace: Space = {
    id: 'sp-living',
    name: 'Living Comedor',
    category: 'living',
    levelId: 'lvl-1',
    ceilingHeight: 2.70,
    floorElevation: 0,
    boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
    wallIds: ['w1', 'w2', 'w3', 'w4'],
    coverType: 'cubierto'
  };

  it('debe tener el catálogo de materiales de cielorraso con sus metadatos constructivos', () => {
    expect(CEILING_MATERIAL_OPTIONS.length).toBeGreaterThanOrEqual(4);

    const losa = getCeilingMaterialOption('losa_hormigon');
    expect(losa.id).toBe('losa_hormigon');
    expect(losa.defaultRecessed).toBe(false);

    const yeso = getCeilingMaterialOption('suspendido_yeso');
    expect(yeso.id).toBe('suspendido_yeso');
    expect(yeso.defaultRecessed).toBe(true);

    const modular = getCeilingMaterialOption('modular_desmontable');
    expect(modular.id).toBe('modular_desmontable');
    expect(modular.defaultRecessed).toBe(true);
  });

  it('debe calcular el contorno interior efectivo para un ambiente cubierto', () => {
    const poly = computeEffectiveCeilingPolygon(baseSpace, verticesMap, wallsMap);
    expect(poly.length).toBe(4);
    expect(poly[0]).toEqual({ x: 0, y: 0 });
    expect(poly[1]).toEqual({ x: 6, y: 0 });
    expect(poly[2]).toEqual({ x: 6, y: 4 });
    expect(poly[3]).toEqual({ x: 0, y: 4 });
  });

  it('debe retornar polígono vacío para recintos descubiertos o vacíos (sin cielorraso)', () => {
    const descubierto: Space = { ...baseSpace, coverType: 'descubierto' };
    expect(computeEffectiveCeilingPolygon(descubierto, verticesMap, wallsMap)).toEqual([]);

    const vacio: Space = { ...baseSpace, coverType: 'vacio' };
    expect(computeEffectiveCeilingPolygon(vacio, verticesMap, wallsMap)).toEqual([]);
  });

  it('debe calcular el contorno efectivo recortado por alero paramétrico en semicubierto', () => {
    const semicubiertoAlero: Space = {
      ...baseSpace,
      coverType: 'semicubierto',
      ceilingProjection: {
        mode: 'alero',
        overhangDepth: 1.50,
        referenceWallId: 'w1'
      }
    };

    const poly = computeEffectiveCeilingPolygon(semicubiertoAlero, verticesMap, wallsMap);
    expect(poly.length).toBe(4);
    // Debe formar la franja rectangular del alero: (0,0) -> (6,0) -> (6, 1.50) -> (0, 1.50)
    expect(poly[0]).toEqual({ x: 0, y: 0 });
    expect(poly[1]).toEqual({ x: 6, y: 0 });
    expect(poly[2].y).toBeCloseTo(1.5, 2);
    expect(poly[3].y).toBeCloseTo(1.5, 2);
  });

  it('debe calcular cotas ortogonales de replanteo milimétricas a las 4 caras de muro', () => {
    // Boca en el punto (2.00, 1.50) dentro del cuarto de 6x4 (X: 0..6, Y: 0..4)
    const boxPos = { x: 2.0, y: 1.5 };
    const polygon = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 0, y: 4 }
    ];

    const settingOut = calculateSettingOutDimensions('el-boca-1', boxPos, polygon);

    expect(settingOut.elementId).toBe('el-boca-1');
    expect(settingOut.boxPos).toEqual(boxPos);

    // Muro Izquierdo (x = 0): distancia = 2.00m
    const leftRay = settingOut.rays.find(r => r.direction === 'left');
    expect(leftRay).toBeDefined();
    expect(leftRay!.distanceM).toBeCloseTo(2.0, 2);
    expect(leftRay!.wallPoint.x).toBeCloseTo(0, 2);

    // Muro Derecho (x = 6): distancia = 4.00m
    const rightRay = settingOut.rays.find(r => r.direction === 'right');
    expect(rightRay).toBeDefined();
    expect(rightRay!.distanceM).toBeCloseTo(4.0, 2);
    expect(rightRay!.wallPoint.x).toBeCloseTo(6, 2);

    // Muro Superior / Norte (y = 0 en SVG): distancia = 1.50m
    const topRay = settingOut.rays.find(r => r.direction === 'top');
    expect(topRay).toBeDefined();
    expect(topRay!.distanceM).toBeCloseTo(1.5, 2);

    // Muro Inferior / Sur (y = 4): distancia = 2.50m
    const bottomRay = settingOut.rays.find(r => r.direction === 'bottom');
    expect(bottomRay).toBeDefined();
    expect(bottomRay!.distanceM).toBeCloseTo(2.5, 2);

    // PrimaryX debe ser el más cercano: left (2.0m < 4.0m)
    expect(settingOut.primaryX.direction).toBe('left');
    // PrimaryY debe ser el más cercano: top (1.5m < 2.5m)
    expect(settingOut.primaryY.direction).toBe('top');
  });

  it('debe construir la estructura CeilingPlanData con bocas cenitales y bajadas a muro', () => {
    // 1 boca de techo y 1 llave de luz en pared
    const elements: ElectricalElement[] = [
      {
        id: 'el-centro-1',
        symbolId: 'sym-planta-boca-techo',
        levelId: 'lvl-1',
        spaceId: 'sp-living',
        placement: 'ceiling',
        heightZ: 2.70,
        x: 3.0,
        y: 2.0,
        rotation: 0
      },
      {
        id: 'el-llave-1',
        symbolId: 'sym-llave-1-efecto',
        levelId: 'lvl-1',
        spaceId: 'sp-living',
        placement: 'wall',
        heightZ: 1.20,
        wallId: 'w4',
        x: 0.1,
        y: 1.0,
        rotation: 0
      }
    ];

    const rcpData = buildCeilingPlanData({
      space: baseSpace,
      verticesMap,
      wallsMap,
      elements,
      material: 'suspendido_yeso'
    });

    expect(rcpData).toBeDefined();
    expect(rcpData!.spaceName).toBe('Living Comedor');
    expect(rcpData!.material).toBe('suspendido_yeso');
    expect(rcpData!.ceilingBoxes.length).toBe(1);
    expect(rcpData!.ceilingBoxes[0].element.id).toBe('el-centro-1');
    expect(rcpData!.wallDrops.length).toBe(1);
    expect(rcpData!.wallDrops[0].element.id).toBe('el-llave-1');
    expect(rcpData!.wallDrops[0].isSwitch).toBe(true);
    expect(rcpData!.areaM2).toBe(24); // 6m * 4m
  });

  it('debe calcular la cuadrícula simétrica de bocas con la regla luminotécnica d = S / 2', () => {
    const bounds = { minX: 0, minY: 0, maxX: 6, maxY: 4, width: 6, height: 4 };

    // 2 columnas, 1 fila (2 bocas en línea horizontal)
    const points2 = computeCeilingGridDistribution({ bounds, cols: 2, rows: 1 });
    expect(points2.length).toBe(2);
    // Cada mitad de 6m mide 3m. La boca va al centro de cada mitad: 1.5m y 4.5m
    expect(points2[0]).toEqual({ x: 1.5, y: 2.0 });
    expect(points2[1]).toEqual({ x: 4.5, y: 2.0 });

    // Matriz 2x2 (4 bocas)
    const points4 = computeCeilingGridDistribution({ bounds, cols: 2, rows: 2 });
    expect(points4.length).toBe(4);
    expect(points4[0]).toEqual({ x: 1.5, y: 1.0 });
    expect(points4[1]).toEqual({ x: 4.5, y: 1.0 });
    expect(points4[2]).toEqual({ x: 1.5, y: 3.0 });
    expect(points4[3]).toEqual({ x: 4.5, y: 3.0 });
  });

  it('debe calcular los presets predefinidos de distribución para un recinto apaisado', () => {
    const bounds = { minX: 0, minY: 0, maxX: 6, maxY: 4, width: 6, height: 4 };

    expect(CEILING_DISTRIBUTION_PRESETS.length).toBeGreaterThanOrEqual(5);

    // Preset 1 boca en centro
    const pCenter = calculatePresetDistribution('1_center', bounds);
    expect(pCenter).toEqual([{ x: 3.0, y: 2.0 }]);

    // Preset 2 bocas en línea a lo largo del eje mayor (X porque 6 > 4)
    const pLinear2 = calculatePresetDistribution('2_linear', bounds);
    expect(pLinear2.length).toBe(2);
    expect(pLinear2[0]).toEqual({ x: 1.5, y: 2.0 });
    expect(pLinear2[1]).toEqual({ x: 4.5, y: 2.0 });

    // Preset 4 bocas (matriz 2x2)
    const pGrid4 = calculatePresetDistribution('4_grid', bounds);
    expect(pGrid4.length).toBe(4);
  });
});

