import { describe, it, expect } from 'vitest';
import {
  calculateDimensionDistance,
  formatDimensionText,
  DIMENSION_CONSTANTS
} from '../DimensionLine';

describe('DimensionLine (Model layer)', () => {
  it('calcula correctamente la distancia euclídea horizontal y vertical', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 4, y: 0 };
    expect(calculateDimensionDistance(p1, p2)).toBe(4.00);

    const p3 = { x: 0, y: 3 };
    expect(calculateDimensionDistance(p1, p3)).toBe(3.00);
  });

  it('calcula correctamente la distancia euclídea diagonal', () => {
    const p1 = { x: 1, y: 1 };
    const p2 = { x: 4, y: 5 }; // dx=3, dy=4 -> 5
    expect(calculateDimensionDistance(p1, p2)).toBe(5.00);
  });

  it('formatea el texto métrico con sufijo m', () => {
    expect(formatDimensionText(4.25)).toBe('4.25 m');
    expect(formatDimensionText(5)).toBe('5.00 m');
  });

  it('respeta el rótulo personalizado si está definido', () => {
    expect(formatDimensionText(4.25, 'Pasillo A')).toBe('Pasillo A');
    expect(formatDimensionText(4.25, '   ')).toBe('4.25 m');
  });

  it('define constantes de diseño adecuadas para visualización CAD', () => {
    expect(DIMENSION_CONSTANTS.TICK_SIZE).toBeGreaterThan(0);
    expect(DIMENSION_CONSTANTS.FONT_SIZE).toBeGreaterThan(0);
    expect(DIMENSION_CONSTANTS.DEFAULT_COLOR).toBeDefined();
    expect(DIMENSION_CONSTANTS.SELECTED_COLOR).toBeDefined();
  });
});
