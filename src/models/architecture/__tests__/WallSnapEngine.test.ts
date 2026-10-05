import { describe, it, expect } from 'vitest';
import {
  calculatePolarAngleSnap,
  calculateWallSlideSnap,
  calculateSmartGuides,
  findWallDragSnap,
  adjustOpeningOnWallResize
} from '../WallSnapEngine';
import type { Wall, WallVertex } from '../Wall';
import type { Opening } from '../Opening';

describe('Motor Matemático de Snap CAD (WallSnapEngine)', () => {
  describe('calculatePolarAngleSnap', () => {
    it('debe imantar a 0° cuando el vector es casi horizontal hacia la derecha', () => {
      const fixedPoint = { x: 0, y: 0 };
      const draggedPoint = { x: 4.0, y: 0.10 }; // ~1.4° de inclinación
      const res = calculatePolarAngleSnap(draggedPoint, fixedPoint, 3.5);
      expect(res).not.toBeNull();
      expect(res?.angleDeg).toBe(0);
      expect(res?.snappedPoint.y).toBe(0);
      expect(res?.snappedPoint.x).toBeCloseTo(4.0, 1);
    });

    it('debe imantar a 90° cuando el vector es casi vertical hacia arriba', () => {
      const fixedPoint = { x: 2.0, y: 1.0 };
      const draggedPoint = { x: 2.10, y: 5.0 }; // ~88.5° de inclinación
      const res = calculatePolarAngleSnap(draggedPoint, fixedPoint, 4.0);
      expect(res).not.toBeNull();
      expect(res?.angleDeg).toBe(90);
      expect(res?.snappedPoint.x).toBe(2.0);
      expect(res?.snappedPoint.y).toBeCloseTo(5.0, 1);
    });

    it('debe imantar a 45° en diagonales en escuadra', () => {
      const fixedPoint = { x: 0, y: 0 };
      const draggedPoint = { x: 3.05, y: 2.95 }; // casi 45°
      const res = calculatePolarAngleSnap(draggedPoint, fixedPoint, 4.0);
      expect(res).not.toBeNull();
      expect(res?.angleDeg).toBe(45);
    });

    it('no debe imantar si el ángulo está fuera de tolerancia', () => {
      const fixedPoint = { x: 0, y: 0 };
      const draggedPoint = { x: 4.0, y: 1.5 }; // ~20.5°
      const res = calculatePolarAngleSnap(draggedPoint, fixedPoint, 4.0);
      expect(res).toBeNull();
    });
  });

  describe('calculateWallSlideSnap (Empalme en T deslizante)', () => {
    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 10, y: 0 }]
    ]);

    const wallReceiver: Wall = {
      id: 'wall-pass',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.15,
      height: 2.80,
      description: 'Muro Pasillo'
    };

    it('debe proyectar perpendicularmente sobre el eje del muro pasante dentro de la tolerancia', () => {
      const draggedPoint = { x: 4.5, y: 0.12 }; // a 12 cm de la recta y=0
      const res = calculateWallSlideSnap(draggedPoint, [wallReceiver], verticesMap, 'wall-other', 0.25);
      expect(res).not.toBeNull();
      expect(res?.wall.id).toBe('wall-pass');
      expect(res?.snappedPoint.x).toBe(4.5);
      expect(res?.snappedPoint.y).toBe(0.0);
      expect(res?.guide.type).toBe('wall_axis');
    });

    it('no debe proyectar si el punto está más allá de la tolerancia perpendicular', () => {
      const draggedPoint = { x: 4.5, y: 0.60 }; // a 60 cm
      const res = calculateWallSlideSnap(draggedPoint, [wallReceiver], verticesMap, 'wall-other', 0.25);
      expect(res).toBeNull();
    });
  });

  describe('calculateSmartGuides (Alineación X/Y)', () => {
    const vertices: WallVertex[] = [
      { id: 'v-corner', x: 5.0, y: 8.0 },
      { id: 'v-other', x: 1.0, y: 1.0 }
    ];

    it('debe generar guía vertical si coincide en X', () => {
      const point = { x: 5.05, y: 3.0 }; // X cerca de 5.0
      const res = calculateSmartGuides(point, vertices, new Set(['v-self']), 0.15);
      expect(res.guides.length).toBe(1);
      expect(res.guides[0].type).toBe('x_align');
      expect(res.snappedPoint.x).toBe(5.0);
    });

    it('debe generar guía horizontal si coincide en Y', () => {
      const point = { x: 9.0, y: 7.95 }; // Y cerca de 8.0
      const res = calculateSmartGuides(point, vertices, new Set(['v-self']), 0.15);
      expect(res.guides.length).toBe(1);
      expect(res.guides[0].type).toBe('y_align');
      expect(res.snappedPoint.y).toBe(8.0);
    });
  });

  describe('findWallDragSnap (Prioridades Integradas)', () => {
    const allVertices: WallVertex[] = [
      { id: 'v-start', x: 0, y: 0 },
      { id: 'v-target', x: 6, y: 0 },
      { id: 'v-distant', x: 10, y: 8 }
    ];

    const allWalls: Wall[] = [
      {
        id: 'w-active',
        levelId: 'lvl-1',
        startVertexId: 'v-start',
        endVertexId: 'v-end-drag',
        thickness: 0.15,
        height: 2.80
      }
    ];

    it('debe priorizar Snap a Vértice (fusión) por encima de otras guías', () => {
      const point = { x: 6.05, y: 0.05 }; // muy cerca de v-target (6,0)
      const res = findWallDragSnap({
        point,
        fixedPoint: { x: 0, y: 0 },
        draggedWallId: 'w-active',
        draggedVertexId: 'v-end-drag',
        allWalls,
        allVertices
      });

      expect(res.targetType).toBe('vertex');
      expect(res.targetVertexId).toBe('v-target');
      expect(res.snappedPoint).toEqual({ x: 6, y: 0 });
    });
  });

  describe('adjustOpeningOnWallResize (Preservación de Aberturas)', () => {
    const opening: Opening = {
      id: 'op-1',
      wallId: 'w-1',
      type: 'door',
      width: 0.80,
      height: 2.05,
      sill: 0.0,
      distanceAlongWall: 1.0, // a 1.0m del inicio en pared de 4.0m
      swing: 'left_in'
    };

    it('cuando se arrastra el extremo final (end), distanceAlongWall debe conservarse inalterada', () => {
      // Muro pasa de 4.0m a 6.0m
      const newDist = adjustOpeningOnWallResize({
        opening,
        draggedEnd: 'end',
        oldLength: 4.0,
        newLength: 6.0
      });
      expect(newDist).toBe(1.0);
    });

    it('cuando se arrastra el extremo inicial (start), la puerta debe mantener su posición relativa al extremo final fijo', () => {
      // En muro original de 4.0m, la puerta está de 1.0m a 1.8m.
      // Distancia desde el fin: 4.0 - 1.8 = 2.2m.
      // Si la pared se alarga hacia la izquierda a 5.0m:
      // La puerta debe seguir a 2.2m del fin -> nuevo inicio a jamba = 5.0 - 2.2 - 0.8 = 2.0m.
      const newDist = adjustOpeningOnWallResize({
        opening,
        draggedEnd: 'start',
        oldLength: 4.0,
        newLength: 5.0
      });
      expect(newDist).toBe(2.0);
    });
  });
});
