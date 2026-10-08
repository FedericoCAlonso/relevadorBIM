import { describe, it, expect } from 'vitest';
import {
  AEA_ELECTRIFICATION_DEGREES,
  getElectrificationDegree,
  calculateProjectLimitSurface,
  getRecommendedIPForCover
} from '../electricalStandards';
import type { Space } from '../../architecture/Space';
import type { WallVertex } from '../../architecture/Wall';

describe('Normativa AEA 90364-7-771: Grados de Electrificación y Superficie Límite', () => {
  it('debe catalogar los 4 grados de electrificación según AEA 771.8 con circuitos mínimos', () => {
    expect(AEA_ELECTRIFICATION_DEGREES.length).toBe(4);

    const [minimo, medio, elevado, superior] = AEA_ELECTRIFICATION_DEGREES;
    expect(minimo.id).toBe('minimo');
    expect(minimo.maxLimitSurfaceM2).toBe(60);
    expect(minimo.minCircuits).toBe(2);

    expect(medio.id).toBe('medio');
    expect(medio.minLimitSurfaceM2).toBe(60);
    expect(medio.maxLimitSurfaceM2).toBe(130);
    expect(medio.minCircuits).toBe(3);

    expect(elevado.id).toBe('elevado');
    expect(elevado.minLimitSurfaceM2).toBe(130);
    expect(elevado.maxLimitSurfaceM2).toBe(200);
    expect(elevado.minCircuits).toBe(5);

    expect(superior.id).toBe('superior');
    expect(superior.minLimitSurfaceM2).toBe(200);
    expect(superior.minCircuits).toBe(6);
  });

  it('debe clasificar el grado de electrificación según el umbral exacto de S_límite', () => {
    expect(getElectrificationDegree(35).id).toBe('minimo');
    expect(getElectrificationDegree(60).id).toBe('minimo');
    expect(getElectrificationDegree(60.01).id).toBe('medio');
    expect(getElectrificationDegree(130).id).toBe('medio');
    expect(getElectrificationDegree(130.01).id).toBe('elevado');
    expect(getElectrificationDegree(200).id).toBe('elevado');
    expect(getElectrificationDegree(200.01).id).toBe('superior');
    expect(getElectrificationDegree(350).id).toBe('superior');
  });

  it('debe sugerir grado de protección IP reglamentario según tipo de cubierta', () => {
    expect(getRecommendedIPForCover('cubierto')).toBe('IP20');
    expect(getRecommendedIPForCover('semicubierto')).toBe('IP44');
    expect(getRecommendedIPForCover('descubierto')).toBe('IP65');
    expect(getRecommendedIPForCover('vacio')).toBe('IP20');
    expect(getRecommendedIPForCover(undefined)).toBe('IP20');
  });

  it('debe calcular S_límite aplicando S_cubierta + 0.50 * S_semicubierta y excluir descubiertos y vacíos', () => {
    // 3 ambientes:
    // 1. Living (cubierto): 50 m²
    // 2. Balcón / Galería (semicubierto): 20 m²
    // 3. Patio (descubierto): 30 m²
    // 4. Pozo de aire y luz (vacío): 4 m²
    // S_cub = 50 m²
    // S_semicub = 20 m²
    // S_descub = 30 m²
    // S_vacio = 4 m²
    // S_limite = 50 + 0.50 * 20 = 60 m² -> Grado Mínimo

    const verticesMap = new Map<string, WallVertex>([
      // Living: (0,0) a (10,5) = 50 m²
      ['lv1', { id: 'lv1', x: 0, y: 0 }],
      ['lv2', { id: 'lv2', x: 10, y: 0 }],
      ['lv3', { id: 'lv3', x: 10, y: 5 }],
      ['lv4', { id: 'lv4', x: 0, y: 5 }],
      // Balcon: (10,0) a (15,4) = 20 m²
      ['bl1', { id: 'bl1', x: 10, y: 0 }],
      ['bl2', { id: 'bl2', x: 15, y: 0 }],
      ['bl3', { id: 'bl3', x: 15, y: 4 }],
      ['bl4', { id: 'bl4', x: 10, y: 4 }],
      // Patio: (0,5) a (6,10) = 30 m²
      ['pt1', { id: 'pt1', x: 0, y: 5 }],
      ['pt2', { id: 'pt2', x: 6, y: 5 }],
      ['pt3', { id: 'pt3', x: 6, y: 10 }],
      ['pt4', { id: 'pt4', x: 0, y: 10 }],
      // Vacio: (6,5) a (8,7) = 4 m²
      ['vc1', { id: 'vc1', x: 6, y: 5 }],
      ['vc2', { id: 'vc2', x: 8, y: 5 }],
      ['vc3', { id: 'vc3', x: 8, y: 7 }],
      ['vc4', { id: 'vc4', x: 6, y: 7 }]
    ]);

    const spaces: Space[] = [
      {
        id: 'sp-living',
        name: 'Living',
        category: 'living',
        levelId: 'lvl-1',
        ceilingHeight: 2.70,
        floorElevation: 0,
        boundaryVertexIds: ['lv1', 'lv2', 'lv3', 'lv4'],
        wallIds: [],
        coverType: 'cubierto'
      },
      {
        id: 'sp-balcon',
        name: 'Balcón',
        category: 'balcon',
        levelId: 'lvl-1',
        ceilingHeight: 2.50,
        floorElevation: 0,
        boundaryVertexIds: ['bl1', 'bl2', 'bl3', 'bl4'],
        wallIds: [],
        coverType: 'semicubierto'
      },
      {
        id: 'sp-patio',
        name: 'Patio',
        category: 'exterior',
        levelId: 'lvl-1',
        ceilingHeight: 2.70,
        floorElevation: 0,
        boundaryVertexIds: ['pt1', 'pt2', 'pt3', 'pt4'],
        wallIds: [],
        coverType: 'descubierto'
      },
      {
        id: 'sp-vacio',
        name: 'Hueco de luz',
        category: 'aire_luz',
        levelId: 'lvl-1',
        ceilingHeight: 2.70,
        floorElevation: 0,
        boundaryVertexIds: ['vc1', 'vc2', 'vc3', 'vc4'],
        wallIds: [],
        coverType: 'vacio'
      }
    ];

    const result = calculateProjectLimitSurface(spaces, verticesMap);
    expect(result.coveredAreaM2).toBe(50);
    expect(result.semiCoveredAreaM2).toBe(20);
    expect(result.openAreaM2).toBe(30);
    expect(result.voidAreaM2).toBe(4);
    expect(result.totalLimitAreaM2).toBe(60); // 50 + 10
    expect(result.electrificationDegree.id).toBe('minimo');

    // Si sumamos 10 m² cubiertos más (dormitorio de 10 m²), S_limite pasa a 70 m² -> Grado Medio
    const extraSpace: Space = {
      id: 'sp-dorm',
      name: 'Dormitorio',
      category: 'dormitorio',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['dm1', 'dm2', 'dm3', 'dm4'],
      wallIds: [],
      coverType: 'cubierto'
    };
    verticesMap.set('dm1', { id: 'dm1', x: 20, y: 0 });
    verticesMap.set('dm2', { id: 'dm2', x: 25, y: 0 });
    verticesMap.set('dm3', { id: 'dm3', x: 25, y: 2 });
    verticesMap.set('dm4', { id: 'dm4', x: 20, y: 2 });

    const result2 = calculateProjectLimitSurface([...spaces, extraSpace], verticesMap);
    expect(result2.totalLimitAreaM2).toBe(70);
    expect(result2.electrificationDegree.id).toBe('medio');
    expect(result2.electrificationDegree.minCircuits).toBe(3);
  });
});
