import { describe, it, expect } from 'vitest';
import { getWallBodyStyle, getWallTypologyLabel } from '../wallRenderModel';
import { CAD_WALL_STYLES } from '../../../config';

describe('wallRenderModel - estilo de muros por tipología', () => {
  it('la selección tiene precedencia sobre tipología y hover', () => {
    const s = getWallBodyStyle({ wallType: 'railing' }, true, true);
    expect(s.fill).toBe(CAD_WALL_STYLES.selected.fill);
    expect(s.strokeDasharray).toBeUndefined();
  });

  it('muro estándar por defecto con variante de hover', () => {
    expect(getWallBodyStyle({}, false, false).fill).toBe(CAD_WALL_STYLES.standard.fill);
    expect(getWallBodyStyle({}, false, true).fill).toBe(CAD_WALL_STYLES.standard.fillHover);
  });

  it('antepecho y baranda usan su propia paleta; solo la baranda es discontinua', () => {
    expect(getWallBodyStyle({ wallType: 'low_wall' }, false, false).fill).toBe(CAD_WALL_STYLES.low_wall.fill);
    expect(getWallBodyStyle({ wallType: 'low_wall' }, false, false).strokeDasharray).toBeUndefined();
    const rail = getWallBodyStyle({ wallType: 'railing' }, false, false);
    expect(rail.strokeDasharray).toBe('8 4');
    expect(rail.strokeWidth).toBe(1.5);
  });

  it('rotula antepechos con altura y barandas con texto fijo', () => {
    expect(getWallTypologyLabel({ wallType: 'low_wall', height: 0.9 })).toBe('h=0.9m');
    expect(getWallTypologyLabel({ wallType: 'low_wall' })).toBe('h=1m');
    expect(getWallTypologyLabel({ wallType: 'railing' })).toBe('Baranda');
    expect(getWallTypologyLabel({ wallType: 'standard' })).toBeNull();
  });
});
