/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: UnderlaySheet.test.ts
 * Pruebas unitarias para cálculo y calibración métrica de láminas de fondo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  calculateUnderlayScale,
  UNDERLAY_CONSTANTS
} from '../UnderlaySheet';

describe('Calibración Métrica de Láminas de Fondo (UnderlaySheet Model)', () => {
  it('debe calcular la escala métrica correcta con 2 puntos horizontales', () => {
    // Supongamos que a escala inicial de 0.02 m/px, dos puntos miden 2.0 metros (100 píxeles).
    // La cota real del plano indica 4.00 metros.
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 2.0, y: 0 };
    const realDistanceM = 4.00;

    const newScale = calculateUnderlayScale(p1, p2, realDistanceM, 0.02);

    // 100 px = 4.00 m -> 1 px = 0.04 m
    expect(newScale).toBeCloseTo(0.04, 5);
  });

  it('debe calcular la escala métrica correcta con 2 puntos diagonales', () => {
    // Triángulo 3-4-5 metros medidos a escala 0.01 m/px (distancia medida = 5.0 metros = 500 px)
    const p1 = { x: 1.0, y: 1.0 };
    const p2 = { x: 4.0, y: 5.0 }; // dx = 3, dy = 4, dist = 5.0
    const realDistanceM = 10.0; // La cota real es de 10 metros

    const newScale = calculateUnderlayScale(p1, p2, realDistanceM, 0.01);

    // 500 px = 10.0 m -> 1 px = 0.02 m
    expect(newScale).toBeCloseTo(0.02, 5);
  });

  it('debe rechazar distancias reales menores o iguales a cero', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 5, y: 0 };

    expect(() => calculateUnderlayScale(p1, p2, 0)).toThrow();
    expect(() => calculateUnderlayScale(p1, p2, -2.5)).toThrow();
  });

  it('debe rechazar puntos demasiado cercanos entre sí', () => {
    const p1 = { x: 10, y: 10 };
    const p2 = { x: 10.01, y: 10.01 }; // dist < 0.05m

    expect(() => calculateUnderlayScale(p1, p2, 5.0)).toThrow();
  });

  it('debe contener constantes por defecto coherentes y seguras', () => {
    expect(UNDERLAY_CONSTANTS.DEFAULT_SCALE_METERS_PER_PX).toBeGreaterThan(0);
    expect(UNDERLAY_CONSTANTS.DEFAULT_OPACITY).toBeGreaterThanOrEqual(0.1);
    expect(UNDERLAY_CONSTANTS.DEFAULT_OPACITY).toBeLessThanOrEqual(1.0);
    expect(UNDERLAY_CONSTANTS.OPACITY_PRESETS.length).toBe(3);
  });
});
