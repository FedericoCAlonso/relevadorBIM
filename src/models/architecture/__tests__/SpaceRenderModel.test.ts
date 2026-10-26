import { describe, it, expect } from 'vitest';
import type { Space } from '../Space';
import {
  getSpaceSurfaceKind,
  getSpaceSurfaceStyle,
  getSpaceInfoLabel,
  getPolygonBounds
} from '../spaceRenderModel';
import { ARCHITECTURAL_SPACE_STYLES } from '../../../config';

const makeSpace = (overrides: Partial<Space>): Space =>
  ({
    id: 's1',
    levelId: 'L1',
    name: 'Test',
    category: 'living',
    ceilingHeight: 2.7,
    ...overrides
  }) as Space;

describe('spaceRenderModel - clasificación visual de ambientes', () => {
  it('clasifica por tipo de cubierta y categoría con precedencia vacío > pleno > descubierto > semicubierto', () => {
    expect(getSpaceSurfaceKind(makeSpace({ coverType: 'vacio' }))).toBe('void');
    expect(getSpaceSurfaceKind(makeSpace({ category: 'pleno' }))).toBe('shaft');
    expect(getSpaceSurfaceKind(makeSpace({ coverType: 'descubierto' }))).toBe('open_air');
    expect(getSpaceSurfaceKind(makeSpace({ coverType: 'semicubierto' }))).toBe('semi_covered');
    expect(getSpaceSurfaceKind(makeSpace({ coverType: 'cubierto' }))).toBe('covered');
  });

  it('aplica el color propio del ambiente solo en cubiertos y semicubiertos', () => {
    expect(getSpaceSurfaceStyle('covered', '#abcdef').fill).toBe('#abcdef');
    expect(getSpaceSurfaceStyle('covered').fill).toBe(ARCHITECTURAL_SPACE_STYLES.COVERED.fill);
    expect(getSpaceSurfaceStyle('semi_covered', '#abcdef').fill).toBe('#abcdef');
    expect(getSpaceSurfaceStyle('open_air', '#abcdef').fill).toBe(ARCHITECTURAL_SPACE_STYLES.OPEN_AIR.fill);
    expect(getSpaceSurfaceStyle('void').stroke).toBe(ARCHITECTURAL_SPACE_STYLES.VOID.stroke);
  });

  it('genera rótulos informativos idénticos a los históricos', () => {
    const s = makeSpace({});
    expect(getSpaceInfoLabel(s, 'covered', 12, null)).toBe('12.00 m² · h: 2.70m');
    expect(getSpaceInfoLabel(s, 'void', 4, null)).toBe('4.00 m² · VACÍO / AIRE Y LUZ');
    expect(getSpaceInfoLabel(s, 'shaft', 1, null)).toBe('1.00 m² · PLENO TÉCNICO');
    expect(getSpaceInfoLabel(s, 'open_air', 10, null)).toBe('10.00 m² · DESCUBIERTO (A cielo abierto · 0% AEA)');
    expect(getSpaceInfoLabel(s, 'semi_covered', 10, null)).toBe('10.00 m² · SEMICUBIERTO · h: 2.70m (50% AEA: 5.00 m²)');
    expect(
      getSpaceInfoLabel(s, 'semi_covered', 10, { coveredAreaM2: 6, uncoveredAreaM2: 4, isPartial: true })
    ).toBe('10.00 m² · SEMICUBIERTO (Techado: 6.00 m² · 50% AEA: 3.00 m² | Libre: 4.00 m²)');
  });

  it('calcula la caja envolvente de un polígono', () => {
    expect(getPolygonBounds([{ x: 1, y: 5 }, { x: 4, y: 2 }, { x: 3, y: 9 }])).toEqual({ minX: 1, minY: 2, maxX: 4, maxY: 9 });
  });
});
