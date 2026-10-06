import { describe, it, expect } from 'vitest';
import type { Wall, WallVertex } from '../Wall';
import {
  computeResolvedWallPolygons,
  getResolvedWallPolygon,
  intersectLines2D
} from '../WallCornerEngine';

describe('WallCornerEngine - Resolución Geométrica de Esquinas en Inglete (Miter Joins)', () => {
  describe('intersectLines2D (Intersección analítica de rectas)', () => {
    it('debe calcular la intersección de dos rectas perpendiculares', () => {
      // Recta 1 horizontal: y = -0.10, pasa por (0, -0.10) dir (1, 0)
      const p1 = { x: 0, y: -0.10 };
      const d1 = { x: 1, y: 0 };
      // Recta 2 vertical: x = -0.10, pasa por (-0.10, 0) dir (0, 1)
      const p2 = { x: -0.10, y: 0 };
      const d2 = { x: 0, y: 1 };

      const inter = intersectLines2D(p1, d1, p2, d2);
      expect(inter).not.toBeNull();
      expect(inter?.x).toBeCloseTo(-0.10, 3);
      expect(inter?.y).toBeCloseTo(-0.10, 3);
    });

    it('debe retornar null para rectas paralelas', () => {
      const p1 = { x: 0, y: 0 };
      const d1 = { x: 1, y: 0 };
      const p2 = { x: 0, y: 1 };
      const d2 = { x: 1, y: 0 };

      const inter = intersectLines2D(p1, d1, p2, d2);
      expect(inter).toBeNull();
    });
  });

  describe('Esquina en L a 90° con justificación en eje (center)', () => {
    // Esquina en V1=(0,0):
    // Wall 1: V0=(-4, 0) -> V1=(0, 0) (Horizontal, va al Este)
    // Wall 2: V1=(0, 0) -> V2=(0, 4) (Vertical, va al Norte)
    // Espesor = 0.20 m (halfT = 0.10 m)
    const verticesMap = new Map<string, WallVertex>([
      ['v0', { id: 'v0', x: -4, y: 0 }],
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 0, y: 4 }]
    ]);

    const wall1: Wall = {
      id: 'w1',
      levelId: 'lvl-1',
      startVertexId: 'v0',
      endVertexId: 'v1',
      thickness: 0.20,
      height: 2.80,
      justification: 'center'
    };

    const wall2: Wall = {
      id: 'w2',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.20,
      height: 2.80,
      justification: 'center'
    };

    it('debe alargar las caras exteriores hasta el punto de inglete (-0.10, -0.10)', () => {
      const polyMap = computeResolvedWallPolygons([wall1, wall2], verticesMap);
      const poly1 = polyMap.get('w1');
      const poly2 = polyMap.get('w2');

      expect(poly1).toBeDefined();
      expect(poly2).toBeDefined();

      // En el extremo V1, la cara exterior de wall1 debe coincidir con el vértice exterior (0.10, -0.10)
      const hasExteriorMiter1 = poly1!.some(
        (p) => Math.abs(p.x - 0.10) < 0.01 && Math.abs(p.y - -0.10) < 0.01
      );
      expect(hasExteriorMiter1).toBe(true);

      // Y la cara interior de wall1 en V1 debe ser (-0.10, +0.10)
      const hasInteriorMiter1 = poly1!.some(
        (p) => Math.abs(p.x - -0.10) < 0.01 && Math.abs(p.y - 0.10) < 0.01
      );
      expect(hasInteriorMiter1).toBe(true);

      // Igual para wall2: su cara exterior debe llegar a (0.10, -0.10)
      const hasExteriorMiter2 = poly2!.some(
        (p) => Math.abs(p.x - 0.10) < 0.01 && Math.abs(p.y - -0.10) < 0.01
      );
      expect(hasExteriorMiter2).toBe(true);
    });
  });

  describe('Esquina en L con justificación en cara interior (interior)', () => {
    // Vértices sobre la cara interior:
    // Wall 1: V0=(-4, 0) -> V1=(0, 0)
    // Wall 2: V1=(0, 0) -> V2=(0, 4)
    // Espesor = 0.15 m
    // Cara interior pasa exactamente por V=(0,0).
    // Cara exterior está a x = +0.15, y = -0.15
    const verticesMap = new Map<string, WallVertex>([
      ['v0', { id: 'v0', x: -4, y: 0 }],
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 0, y: 4 }]
    ]);

    const wall1: Wall = {
      id: 'w1',
      levelId: 'lvl-1',
      startVertexId: 'v0',
      endVertexId: 'v1',
      thickness: 0.15,
      height: 2.80,
      justification: 'interior'
    };

    const wall2: Wall = {
      id: 'w2',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.15,
      height: 2.80,
      justification: 'interior'
    };

    it('debe mantener la esquina interior en (0, 0) y alargar la exterior a (0.15, -0.15)', () => {
      const polyMap = computeResolvedWallPolygons([wall1, wall2], verticesMap);
      const poly1 = polyMap.get('w1');
      const poly2 = polyMap.get('w2');

      expect(poly1).toBeDefined();
      expect(poly2).toBeDefined();

      // Esquina interior exactamente en (0, 0)
      const hasInteriorCorner = poly1!.some(
        (p) => Math.abs(p.x) < 0.01 && Math.abs(p.y) < 0.01
      );
      expect(hasInteriorCorner).toBe(true);

      // Esquina exterior alargada a (0.15, -0.15)
      const hasExteriorMiter = poly1!.some(
        (p) => Math.abs(p.x - 0.15) < 0.01 && Math.abs(p.y - -0.15) < 0.01
      );
      expect(hasExteriorMiter).toBe(true);
    });
  });

  describe('Habitación rectangular cerrada de 4 muros (Room Loop)', () => {
    // 4 muros en anillo rectangular
    // v0=(0,0), v1=(4,0), v2=(4,3), v3=(0,3)
    const verticesMap = new Map<string, WallVertex>([
      ['v0', { id: 'v0', x: 0, y: 0 }],
      ['v1', { id: 'v1', x: 4, y: 0 }],
      ['v2', { id: 'v2', x: 4, y: 3 }],
      ['v3', { id: 'v3', x: 0, y: 3 }]
    ]);

    const walls: Wall[] = [
      { id: 'w0', levelId: 'lvl-1', startVertexId: 'v0', endVertexId: 'v1', thickness: 0.20, height: 2.80, justification: 'center' },
      { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.20, height: 2.80, justification: 'center' },
      { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.20, height: 2.80, justification: 'center' },
      { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v0', thickness: 0.20, height: 2.80, justification: 'center' }
    ];

    it('debe resolver las 4 esquinas con ingletes cerrados sin huecos', () => {
      const polyMap = computeResolvedWallPolygons(walls, verticesMap);
      expect(polyMap.size).toBe(4);

      for (const w of walls) {
        const poly = polyMap.get(w.id);
        expect(poly).toBeDefined();
        expect(poly?.length).toBe(4);
      }

      // La esquina exterior en v0 debe estar en (-0.10, -0.10)
      const poly0 = polyMap.get('w0')!;
      const poly3 = polyMap.get('w3')!;

      const hasExt0 = poly0.some((p) => Math.abs(p.x - -0.10) < 0.01 && Math.abs(p.y - -0.10) < 0.01);
      const hasExt3 = poly3.some((p) => Math.abs(p.x - -0.10) < 0.01 && Math.abs(p.y - -0.10) < 0.01);
      expect(hasExt0).toBe(true);
      expect(hasExt3).toBe(true);
    });
  });

  describe('Muro aislado / extremo libre', () => {
    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 5, y: 0 }]
    ]);
    const wall: Wall = {
      id: 'w-single',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.20,
      height: 2.80,
      justification: 'center'
    };

    it('debe mantener corte perpendicular plano en extremos no conectados', () => {
      const poly = getResolvedWallPolygon(wall, [wall], verticesMap);
      expect(poly).not.toBeNull();
      expect(poly?.length).toBe(4);
      // En v1: x = 0
      expect(poly?.some((p) => Math.abs(p.x) < 0.01 && Math.abs(p.y - 0.10) < 0.01)).toBe(true);
      expect(poly?.some((p) => Math.abs(p.x) < 0.01 && Math.abs(p.y - -0.10) < 0.01)).toBe(true);
    });
  });
});
