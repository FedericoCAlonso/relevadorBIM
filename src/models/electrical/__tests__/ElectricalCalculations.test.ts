/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ElectricalCalculations.test.ts
 * Pruebas unitarias para generación de etiquetas únicas, curvatura a 90°,
 * ruteo ortogonal y transiciones verticales AEA.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  generateNextUniqueLabel,
  generateRoundedPolylineSvgPath,
  computeOrthogonalConduitPoints,
  getConduitVerticalTransitions
} from '../calculations';

describe('generateNextUniqueLabel (Unicidad determinista)', () => {
  it('genera etiqueta inicial cuando no existen bocas', () => {
    expect(generateNextUniqueLabel('B', [])).toBe('B1');
    expect(generateNextUniqueLabel('TUG', [])).toBe('TUG1');
    expect(generateNextUniqueLabel('IUG ', [])).toBe('IUG 1');
    expect(generateNextUniqueLabel('B-', [])).toBe('B-1');
  });

  it('incrementa secuencialmente sin colisionar con etiquetas existentes', () => {
    const existing = [{ label: 'B1' }, { label: 'B2' }, { label: 'B3' }];
    expect(generateNextUniqueLabel('B', existing)).toBe('B4');
  });

  it('rellena huecos disponibles si existen saltos en la numeración', () => {
    const existing = [{ label: 'B1' }, { label: 'B2' }, { label: 'B4' }];
    // Debe reutilizar el 3 libre
    expect(generateNextUniqueLabel('B', existing)).toBe('B3');
  });

  it('soporta prefijos con guion o espacio conservando el separador', () => {
    const existing = ['TUG-1', 'TUG-2'];
    expect(generateNextUniqueLabel('TUG-', existing)).toBe('TUG-3');

    const existingSpaces = [{ label: 'Boca 1' }, { label: 'Boca 2' }];
    expect(generateNextUniqueLabel('Boca ', existingSpaces)).toBe('Boca 3');
  });

  it('aísla los prefijos diferentes sin interferir entre sí', () => {
    const existing = [{ label: 'IUG 1' }, { label: 'IUG 2' }, { label: 'TUG 1' }];
    expect(generateNextUniqueLabel('TUG ', existing)).toBe('TUG 2');
    expect(generateNextUniqueLabel('B', existing)).toBe('B1');
  });

  it('respeta startNumber cuando se proporciona', () => {
    const existing = [{ label: 'B1' }, { label: 'B2' }];
    expect(generateNextUniqueLabel('B', existing, 10)).toBe('B10');
  });
});

describe('generateRoundedPolylineSvgPath (Curvatura a 90° con radio técnico)', () => {
  it('devuelve cadena vacía o trazo recto para 0, 1 o 2 puntos', () => {
    expect(generateRoundedPolylineSvgPath([])).toBe('');
    expect(generateRoundedPolylineSvgPath([{ x: 10, y: 10 }])).toBe('M 10.0 10.0');
    expect(generateRoundedPolylineSvgPath([{ x: 0, y: 0 }, { x: 50, y: 0 }])).toBe('M 0.0 0.0 L 50.0 0.0');
  });

  it('genera curva Bézier cuadrática continua en un quiebre a 90°', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ];
    const path = generateRoundedPolylineSvgPath(points, 20);
    // Debe comenzar en 0,0, avanzar hasta 80,0, curvar con Q 100,0 hasta 100,20, y terminar en 100,100
    expect(path).toContain('M 0.0 0.0');
    expect(path).toContain('L 80.0 0.0');
    expect(path).toContain('Q 100.0 0.0 100.0 20.0');
    expect(path).toContain('L 100.0 100.0');
  });

  it('limita el radio adaptativamente si el tramo es más corto que el radio', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ];
    // Radio solicitado 20, pero el tramo mide 10, por lo que effectiveRadius = 5
    const path = generateRoundedPolylineSvgPath(points, 20);
    expect(path).toContain('L 5.0 0.0');
    expect(path).toContain('Q 10.0 0.0 10.0 5.0');
    expect(path).toContain('L 10.0 10.0');
  });

  it('no genera arcos si los puntos consecutivos son colineales', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 }
    ];
    const path = generateRoundedPolylineSvgPath(points, 15);
    expect(path).not.toContain('Q');
    expect(path).toBe('M 0.0 0.0 L 50.0 0.0 L 100.0 0.0');
  });
});

describe('computeOrthogonalConduitPoints (Ruteo en escuadra con waypoints)', () => {
  it('conecta directamente si los puntos ya están alineados', () => {
    const pts = computeOrthogonalConduitPoints({ x: 0, y: 5 }, { x: 10, y: 5 });
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 0, y: 5 });
    expect(pts[1]).toEqual({ x: 10, y: 5 });
  });

  it('inserta vértice ortogonal a 90° cuando hay desnivel en ambos ejes', () => {
    const pts = computeOrthogonalConduitPoints({ x: 0, y: 0 }, { x: 10, y: 5 });
    // Al ser dx (10) >= dy (5), avanza en X hasta (10, 0) y luego en Y a (10, 5)
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 10, y: 0 });
    expect(pts[2]).toEqual({ x: 10, y: 5 });
  });

  it('respeta waypoints explícitos interpuestos', () => {
    const waypoints = [{ x: 5, y: 20 }];
    const pts = computeOrthogonalConduitPoints({ x: 0, y: 0 }, { x: 20, y: 20 }, waypoints);
    expect(pts.length).toBeGreaterThanOrEqual(4);
    // Debe incluir el waypoint o sus proyecciones
    const hasWp = pts.some((p) => p.x === 5 && p.y === 20);
    expect(hasWp).toBe(true);
  });
});

describe('getConduitVerticalTransitions (Desniveles verticales y glifos AEA)', () => {
  it('indica sin transición si el desnivel es menor al umbral de 30 cm', () => {
    const trans = getConduitVerticalTransitions(2.60, 2.50);
    expect(trans.hasTransition).toBe(false);
    expect(trans.fromType).toBe('none');
    expect(trans.toType).toBe('none');
  });

  it('detecta bajada cuando conecta boca de techo (2.70m) con llave (1.20m)', () => {
    const trans = getConduitVerticalTransitions(2.70, 1.20);
    expect(trans.hasTransition).toBe(true);
    expect(trans.dzLocal).toBe(1.50);
    expect(trans.toType).toBe('bajada');
    expect(trans.glyphTextTo).toBe('▼ B. 1.50m');
  });

  it('detecta subida cuando conecta toma bajo (0.30m) con boca a mayor altura (1.20m)', () => {
    const trans = getConduitVerticalTransitions(0.30, 1.20);
    expect(trans.hasTransition).toBe(true);
    expect(trans.dzLocal).toBe(0.90);
    expect(trans.toType).toBe('subida');
    expect(trans.glyphTextTo).toBe('▲ S. 0.90m');
  });
});
