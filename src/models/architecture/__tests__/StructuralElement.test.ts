import { describe, it, expect } from 'vitest';
import {
  getColumnPolygon,
  isPointInsideColumn,
  getBeamPolygon,
  type StructuralColumn,
  type StructuralBeam
} from '../StructuralElement';
import { isSpaceVoid, isSpaceShaft, type Space } from '../Space';

describe('StructuralElement (Columnas y Vigas)', () => {
  it('debe calcular los 4 vértices de una columna rectangular sin rotación', () => {
    const col: StructuralColumn = {
      id: 'col-1',
      levelId: 'lvl-1',
      x: 2.0,
      y: 3.0,
      width: 0.20,
      depth: 0.40,
      shape: 'rectangular'
    };

    const poly = getColumnPolygon(col);
    expect(poly).toHaveLength(4);
    // Vértice 0: (-0.10, -0.20) + (2, 3) = (1.90, 2.80)
    expect(poly[0].x).toBeCloseTo(1.90);
    expect(poly[0].y).toBeCloseTo(2.80);
    // Vértice 2: (0.10, 0.20) + (2, 3) = (2.10, 3.20)
    expect(poly[2].x).toBeCloseTo(2.10);
    expect(poly[2].y).toBeCloseTo(3.20);
  });

  it('debe detectar correctamente si un punto cae dentro de una columna rectangular (zona de exclusión)', () => {
    const col: StructuralColumn = {
      id: 'col-1',
      levelId: 'lvl-1',
      x: 0,
      y: 0,
      width: 0.20,
      depth: 0.20,
      shape: 'rectangular'
    };

    expect(isPointInsideColumn({ x: 0.05, y: 0.05 }, col)).toBe(true);
    expect(isPointInsideColumn({ x: 0, y: 0 }, col)).toBe(true);
    expect(isPointInsideColumn({ x: 0.15, y: 0 }, col)).toBe(false);
    // Con margen de 0.06m debe dar true
    expect(isPointInsideColumn({ x: 0.15, y: 0 }, col, 0.06)).toBe(true);
  });

  it('debe detectar si un punto cae dentro de una columna circular', () => {
    const colCirc: StructuralColumn = {
      id: 'col-circ-1',
      levelId: 'lvl-1',
      x: 5.0,
      y: 5.0,
      width: 0.30, // diámetro 0.30m -> radio 0.15m
      depth: 0.30,
      shape: 'circular'
    };

    expect(isPointInsideColumn({ x: 5.10, y: 5.0 }, colCirc)).toBe(true);
    expect(isPointInsideColumn({ x: 5.20, y: 5.0 }, colCirc)).toBe(false);
  });

  it('debe calcular el polígono de una viga saliente horizontal', () => {
    const beam: StructuralBeam = {
      id: 'beam-1',
      levelId: 'lvl-1',
      startX: 0,
      startY: 0,
      endX: 4.0,
      endY: 0,
      width: 0.20, // semiancho 0.10 hacia arriba y abajo
      dropHeightM: 0.35
    };

    const poly = getBeamPolygon(beam);
    expect(poly).toHaveLength(4);
    // Para viga a lo largo de X, la normal apunta a (0, 1)
    expect(poly[0].x).toBeCloseTo(0);
    expect(poly[0].y).toBeCloseTo(0.10);
    expect(poly[1].x).toBeCloseTo(4.0);
    expect(poly[1].y).toBeCloseTo(0.10);
  });
});

describe('Space Voids y Plenos Técnicos', () => {
  it('debe identificar patios de aire y luz como vacíos', () => {
    const spaceAireLuz: Space = {
      id: 'sp-1',
      name: 'Aire y Luz',
      category: 'aire_luz',
      levelId: 'lvl-1',
      ceilingHeight: 0,
      floorElevation: 0,
      boundaryVertexIds: [],
      wallIds: []
    };

    expect(isSpaceVoid(spaceAireLuz)).toBe(true);
    expect(isSpaceShaft(spaceAireLuz)).toBe(false);
  });

  it('debe identificar plenos técnicos como shafts de montantes', () => {
    const spacePleno: Space = {
      id: 'sp-2',
      name: 'Pleno Eléctrico',
      category: 'pleno',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: [],
      wallIds: []
    };

    expect(isSpaceShaft(spacePleno)).toBe(true);
    expect(isSpaceVoid(spacePleno)).toBe(false);
  });
});
