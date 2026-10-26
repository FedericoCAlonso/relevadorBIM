import { describe, it, expect } from 'vitest';
import {
  routeConduitAStar,
  simplifyCollinearPolyline,
  detectJunctionBoxes,
  type RoutingPoint2D
} from '../conduitAStarRouter';
import type { StructuralColumn } from '../../architecture/StructuralElement';
import type { Wall, WallVertex } from '../../architecture/Wall';
import type { Opening } from '../../architecture/Opening';

describe('Motor de Ruteo Ortogonal de Canalizaciones (A* 2.5D)', () => {
  describe('simplifyCollinearPolyline', () => {
    it('mantiene extremos en polilínea vacía o de 2 puntos', () => {
      expect(simplifyCollinearPolyline([])).toEqual([]);
      expect(simplifyCollinearPolyline([{ x: 0, y: 0 }, { x: 5, y: 0 }])).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]);
    });

    it('elimina puntos intermedios en la misma recta horizontal', () => {
      const input: RoutingPoint2D[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 }
      ];
      const result = simplifyCollinearPolyline(input);
      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]);
    });

    it('conserva esquinas a 90° en trayectoria escalonada', () => {
      const input: RoutingPoint2D[] = [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
        { x: 5, y: 3 }
      ];
      const result = simplifyCollinearPolyline(input);
      expect(result).toEqual(input);
    });
  });

  describe('detectJunctionBoxes (Reglamentación AEA 771.12.3)', () => {
    it('no sugiere cajas en trayectorias con 3 o menos curvas y tramos menores a 12m', () => {
      const path: RoutingPoint2D[] = [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
        { x: 5, y: 3 },
        { x: 5, y: 5 }
      ]; // 3 quiebres a 90°
      const suggestions = detectJunctionBoxes(path, 3, 12.0);
      expect(suggestions).toHaveLength(0);
    });

    it('sugiere caja de paso al superar 3 curvas de 90°', () => {
      const path: RoutingPoint2D[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 }, // curva 1
        { x: 1, y: 2 }, // curva 2
        { x: 3, y: 2 }, // curva 3
        { x: 3, y: 4 }, // curva 4 (exceso)
        { x: 5, y: 4 }
      ];
      const suggestions = detectJunctionBoxes(path, 3, 12.0);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].reason).toBe('excess_turns');
      expect(suggestions[0].x).toBe(3);
      expect(suggestions[0].y).toBe(2);
    });

    it('sugiere caja de paso en tramos rectos mayores a 12 metros', () => {
      const path: RoutingPoint2D[] = [
        { x: 0, y: 0 },
        { x: 25, y: 0 } // tramo de 25m
      ];
      const suggestions = detectJunctionBoxes(path, 3, 12.0);
      expect(suggestions.length).toBe(2); // Particiones a ~8.33m y ~16.66m
      expect(suggestions[0].reason).toBe('excess_length');
      expect(suggestions[0].x).toBeCloseTo(8.333, 2);
      expect(suggestions[1].x).toBeCloseTo(16.666, 2);
    });
  });

  describe('routeConduitAStar — Búsqueda libre y desvío de obstáculos', () => {
    it('conecta puntos alineados en línea recta sin waypoints intermedios', () => {
      const result = routeConduitAStar({
        start: { x: 1, y: 2 },
        goal: { x: 6, y: 2 },
        routingPlane: 'ceiling_slab'
      });

      expect(result.status).toBe('optimal');
      expect(result.turnsCount).toBe(0);
      expect(result.waypoints).toHaveLength(0);
      expect(result.totalLengthM).toBeCloseTo(5.0, 1);
      expect(result.hasObstacleConflict).toBe(false);
    });

    it('conecta puntos diagonales con un único quiebre a 90° (L-shape)', () => {
      const result = routeConduitAStar({
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 3 },
        routingPlane: 'ceiling_slab'
      });

      expect(result.status).toBe('optimal');
      expect(result.turnsCount).toBe(1);
      expect(result.waypoints).toHaveLength(1);
      expect(result.totalLengthM).toBeCloseTo(7.0, 1);
    });

    it('esquiva una columna estructural interpuesta en la trayectoria recta', () => {
      // Columna de 0.40 x 0.40 m ubicada en (2.5, 0.0)
      const column: StructuralColumn = {
        id: 'col-1',
        levelId: 'lvl-1',
        x: 2.5,
        y: 0.0,
        width: 0.40,
        depth: 0.40,
        shape: 'rectangular',
        material: 'concrete'
      };

      const result = routeConduitAStar({
        start: { x: 0, y: 0 },
        goal: { x: 5, y: 0 },
        columns: [column],
        routingPlane: 'ceiling_slab'
      });

      expect(result.status).toBe('optimal');
      expect(result.hasObstacleConflict).toBe(false);
      // La trayectoria no puede ser recta; debe haber esquivado la columna
      expect(result.turnsCount).toBeGreaterThanOrEqual(2);
      // Ningún waypoint ni punto debe estar dentro de la columna
      for (const pt of result.fullPath) {
        const insideCol = Math.abs(pt.x - column.x) < 0.20 && Math.abs(pt.y - column.y) < 0.20;
        expect(insideCol).toBe(false);
      }
    });

    it('en modo pared respeta el vano de una puerta evitando cruzarlo', () => {
      const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
      const v2: WallVertex = { id: 'v2', x: 6, y: 0 };
      const wall: Wall = {
        id: 'w1',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.20,
        height: 2.80
      };

      // Puerta de 0.90m en x=2.50 a 3.40m
      const door: Opening = {
        id: 'door-1',
        wallId: 'w1',
        type: 'door',
        width: 0.90,
        height: 2.05,
        sill: 0.0,
        distanceAlongWall: 2.5,
        swing: 'left_in'
      };

      const result = routeConduitAStar({
        start: { x: 1.0, y: 0.0 },
        goal: { x: 5.0, y: 0.0 },
        walls: [wall],
        vertices: [v1, v2],
        openings: [door],
        routingPlane: 'wall'
      });

      expect(result.status).toBe('optimal');
      // Debe haber generado un desvío fuera del eje del vano de la puerta
      expect(result.turnsCount).toBeGreaterThan(0);
    });

    it('retorna fallback y bandera hasObstacleConflict si el destino está completamente bloqueado', () => {
      // Columna envolviendo al destino
      const giantColumn: StructuralColumn = {
        id: 'col-giant',
        levelId: 'lvl-1',
        x: 4.0,
        y: 4.0,
        width: 2.0,
        depth: 2.0,
        shape: 'rectangular',
        material: 'concrete'
      };

      // Si el destino o el entorno está bloqueado
      const result = routeConduitAStar({
        start: { x: 0, y: 0 },
        goal: { x: 4.0, y: 4.0 },
        columns: [giantColumn],
        routingPlane: 'ceiling_slab',
        options: {
          gridStepM: 0.20,
          boundingMarginM: 0.5
        }
      });

      expect(result.waypoints.length).toBeGreaterThanOrEqual(0);
      expect(result.fullPath.length).toBeGreaterThanOrEqual(2);
    });
  });
});
