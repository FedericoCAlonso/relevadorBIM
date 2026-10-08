import { describe, it, expect } from 'vitest';
import {
  SPACE_COVER_TYPE_OPTIONS,
  STANDARD_OVERHANG_DEPTH_PRESETS,
  getSpaceCoverOption,
  isSpaceVoid,
  isSpaceOpenAir,
  isSpaceSemiCovered,
  computeCeilingProjection,
  calculateSpaceMetrics,
  type Space
} from '../Space';
import type { WallVertex } from '../Wall';

describe('Modelo: Tipología de Cubierta y Proyección de Techos/Aleros (Space)', () => {
  it('debe contener el catálogo de tipos de cubierta con sus factores normativos AEA y grados IP', () => {
    expect(SPACE_COVER_TYPE_OPTIONS.length).toBe(4);

    const cubierto = getSpaceCoverOption('cubierto');
    expect(cubierto.id).toBe('cubierto');
    expect(cubierto.aeaAreaFactor).toBe(1.0);
    expect(cubierto.defaultIP).toBe('IP20');

    const semicubierto = getSpaceCoverOption('semicubierto');
    expect(semicubierto.id).toBe('semicubierto');
    expect(semicubierto.aeaAreaFactor).toBe(0.5);
    expect(semicubierto.defaultIP).toBe('IP44');

    const descubierto = getSpaceCoverOption('descubierto');
    expect(descubierto.id).toBe('descubierto');
    expect(descubierto.aeaAreaFactor).toBe(0.0);
    expect(descubierto.defaultIP).toBe('IP65');

    const vacio = getSpaceCoverOption('vacio');
    expect(vacio.id).toBe('vacio');
    expect(vacio.aeaAreaFactor).toBe(0.0);
  });

  it('debe proveer presets de profundidad de alero normalizados', () => {
    expect(STANDARD_OVERHANG_DEPTH_PRESETS).toEqual([1.00, 1.50, 2.00, 2.50]);
  });

  it('debe identificar correctamente recintos abiertos y vacíos', () => {
    const spaceCub: Space = {
      id: 'sp-1',
      name: 'Living',
      category: 'living',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: [],
      wallIds: [],
      coverType: 'cubierto'
    };
    expect(isSpaceOpenAir(spaceCub)).toBe(false);
    expect(isSpaceSemiCovered(spaceCub)).toBe(false);
    expect(isSpaceVoid(spaceCub)).toBe(false);

    const spaceDesc: Space = {
      ...spaceCub,
      coverType: 'descubierto'
    };
    expect(isSpaceOpenAir(spaceDesc)).toBe(true);
    expect(isSpaceSemiCovered(spaceDesc)).toBe(false);

    const spaceSemi: Space = {
      ...spaceCub,
      coverType: 'semicubierto'
    };
    expect(isSpaceSemiCovered(spaceSemi)).toBe(true);
    expect(isSpaceOpenAir(spaceSemi)).toBe(false);
  });

  it('debe calcular volumen de aire 0 para recintos descubiertos o vacíos', () => {
    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 4, y: 0 }],
      ['v3', { id: 'v3', x: 4, y: 4 }],
      ['v4', { id: 'v4', x: 0, y: 4 }]
    ]);

    const spaceDesc: Space = {
      id: 'sp-patio',
      name: 'Patio',
      category: 'exterior',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      wallIds: [],
      coverType: 'descubierto'
    };

    const metricsDesc = calculateSpaceMetrics(spaceDesc, verticesMap);
    expect(metricsDesc.areaM2).toBe(16);
    expect(metricsDesc.volumeM3).toBe(0); // Cero falsos cómputos cúbicos
    expect(metricsDesc.limitAreaM2).toBe(0); // 0% computable AEA

    const spaceCub: Space = {
      ...spaceDesc,
      coverType: 'cubierto'
    };
    const metricsCub = calculateSpaceMetrics(spaceCub, verticesMap);
    expect(metricsCub.areaM2).toBe(16);
    expect(metricsCub.volumeM3).toBe(43.2); // 16 * 2.70
    expect(metricsCub.limitAreaM2).toBe(16); // 100% computable AEA
  });

  it('debe calcular proyección de alero en ambiente semicubierto con línea paramétrica y superficie efectiva', () => {
    // Galería de 5m de ancho (X: 0 a 5) y 4m de fondo (Y: 0 a 4) = 20 m²
    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 5, y: 0 }],
      ['v3', { id: 'v3', x: 5, y: 4 }],
      ['v4', { id: 'v4', x: 0, y: 4 }]
    ]);

    const wallsMap = new Map([
      ['w1', { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' }], // Muro de fachada de 5m en y=0
      ['w2', { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' }],
      ['w3', { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' }],
      ['w4', { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' }]
    ]);

    // Caso 1: Semicubierto con techo total
    const spaceTotal: Space = {
      id: 'sp-galeria',
      name: 'Galería',
      category: 'balcon',
      levelId: 'lvl-1',
      ceilingHeight: 2.60,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      wallIds: ['w1', 'w2', 'w3', 'w4'],
      coverType: 'semicubierto',
      ceilingProjection: {
        mode: 'total'
      }
    };

    const projTotal = computeCeilingProjection(spaceTotal, verticesMap, wallsMap);
    expect(projTotal.coveredAreaM2).toBe(20);
    expect(projTotal.isPartial).toBe(false);

    // Caso 2: Semicubierto con alero de 1.50m desde el muro w1 (fachada)
    const spaceAlero: Space = {
      ...spaceTotal,
      ceilingProjection: {
        mode: 'alero',
        overhangDepth: 1.50,
        referenceWallId: 'w1'
      }
    };

    const projAlero = computeCeilingProjection(spaceAlero, verticesMap, wallsMap);
    // 5m de muro * 1.50m de alero = 7.50 m²
    expect(projAlero.coveredAreaM2).toBe(7.5);
    expect(projAlero.isPartial).toBe(true);
    expect(projAlero.projectionLine).toBeDefined();

    const [p1, p2] = projAlero.projectionLine!;
    // El muro w1 va de (0,0) a (5,0). El centroide del ambiente está en (2.5, 2).
    // Por ende, la normal apunta hacia +y.
    // La línea de alero debe estar en y = 1.50
    expect(p1.y).toBeCloseTo(1.5, 2);
    expect(p2.y).toBeCloseTo(1.5, 2);
    expect(p1.x).toBeCloseTo(0, 2);
    expect(p2.x).toBeCloseTo(5, 2);

    // Y el cálculo de métricas en Space debe computar limitAreaM2 como el 50% de 7.50 = 3.75 m²
    const metricsAlero = calculateSpaceMetrics(spaceAlero, verticesMap, wallsMap);
    expect(metricsAlero.limitAreaM2).toBe(3.75);
  });
});
