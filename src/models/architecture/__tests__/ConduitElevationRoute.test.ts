import { describe, it, expect } from 'vitest';
import {
  buildPresetElevationRoute,
  routeLengthBreakdown,
  routeLengthM,
  moveBridgeHeight,
  moveRoutePoint,
  insertRoutePoint,
  removeRoutePoint,
  elevationRouteToPlanWaypoints,
  CONDUIT_ROUTE_DEFAULTS
} from '../conduitElevationRoute';

describe('ConduitElevationRoute — Trazas en alzado de muro', () => {
  it('genera preset top_bridge con 4 puntos ortogonales y despeje superior', () => {
    const route = buildPresetElevationRoute({
      wallId: 'w1',
      fromU: 1.0,
      fromZ: 0.3,
      toU: 3.0,
      toZ: 1.1,
      preset: 'top_bridge',
      ceilingZ: 2.7,
      wallHeightM: 2.8
    });

    expect(route.preset).toBe('top_bridge');
    expect(route.wallId).toBe('w1');
    expect(route.points).toHaveLength(4);

    const [p0, p1, p2, p3] = route.points;
    const expectedBridgeZ = 2.7 - CONDUIT_ROUTE_DEFAULTS.TOP_BRIDGE_CLEARANCE_M; // 2.5
    expect(p0).toEqual({ u: 1.0, z: 0.3 });
    expect(p1).toEqual({ u: 1.0, z: expectedBridgeZ });
    expect(p2).toEqual({ u: 3.0, z: expectedBridgeZ });
    expect(p3).toEqual({ u: 3.0, z: 1.1 });
  });

  it('genera preset direct con enlace en escuadra si las alturas difieren', () => {
    const route = buildPresetElevationRoute({
      wallId: 'w1',
      fromU: 1.0,
      fromZ: 0.3,
      toU: 1.2,
      toZ: 1.1,
      preset: 'direct',
      ceilingZ: 2.7,
      wallHeightM: 2.8
    });

    expect(route.preset).toBe('direct');
    expect(route.points).toHaveLength(3);
    expect(route.points[0]).toEqual({ u: 1.0, z: 0.3 });
    expect(route.points[1]).toEqual({ u: 1.0, z: 1.1 });
    expect(route.points[2]).toEqual({ u: 1.2, z: 1.1 });
  });

  it('genera preset direct horizontal si las alturas coinciden', () => {
    const route = buildPresetElevationRoute({
      wallId: 'w1',
      fromU: 1.0,
      fromZ: 1.1,
      toU: 1.25,
      toZ: 1.1,
      preset: 'direct',
      ceilingZ: 2.7,
      wallHeightM: 2.8
    });

    expect(route.points).toHaveLength(2);
    expect(route.points[0]).toEqual({ u: 1.0, z: 1.1 });
    expect(route.points[1]).toEqual({ u: 1.25, z: 1.1 });
  });

  it('calcula desglose y longitud total ortogonal', () => {
    const points = [
      { u: 1.0, z: 0.3 },
      { u: 1.0, z: 2.5 },
      { u: 3.0, z: 2.5 },
      { u: 3.0, z: 1.1 }
    ];

    const breakdown = routeLengthBreakdown(points);
    // Vertical: |2.5 - 0.3| + |1.1 - 2.5| = 2.2 + 1.4 = 3.6
    // Horizontal: |3.0 - 1.0| = 2.0
    expect(breakdown.verticalM).toBe(3.6);
    expect(breakdown.horizontalM).toBe(2.0);
    expect(breakdown.totalM).toBe(5.6);
    expect(routeLengthM(points)).toBe(5.6);
  });

  it('moveBridgeHeight ajusta la cota del puente sin alterar extremos', () => {
    const points = [
      { u: 1.0, z: 0.3 },
      { u: 1.0, z: 2.5 },
      { u: 3.0, z: 2.5 },
      { u: 3.0, z: 1.1 }
    ];

    const updated = moveBridgeHeight(points, 2.2, 2.7);
    expect(updated[0]).toEqual({ u: 1.0, z: 0.3 });
    expect(updated[1]).toEqual({ u: 1.0, z: 2.2 });
    expect(updated[2]).toEqual({ u: 3.0, z: 2.2 });
    expect(updated[3]).toEqual({ u: 3.0, z: 1.1 });
  });

  it('moveRoutePoint sincroniza quiebres en puente y no mueve extremos', () => {
    const points = [
      { u: 1.0, z: 0.3 },
      { u: 1.0, z: 2.5 },
      { u: 3.0, z: 2.5 },
      { u: 3.0, z: 1.1 }
    ];

    // Intentar mover extremo 0 no produce cambios
    const noMove = moveRoutePoint({
      points,
      index: 0,
      targetU: 0.5,
      targetZ: 0.5,
      wallLengthM: 4,
      wallHeightM: 2.8
    });
    expect(noMove[0]).toEqual({ u: 1.0, z: 0.3 });

    // Mover punto 1 en Z sincroniza punto 2 en Z para mantener horizontalidad
    const moved = moveRoutePoint({
      points,
      index: 1,
      targetU: 1.0,
      targetZ: 2.0,
      wallLengthM: 4,
      wallHeightM: 2.8
    });
    expect(moved[1].z).toBe(2.0);
    expect(moved[2].z).toBe(2.0);
  });

  it('insertRoutePoint y removeRoutePoint respetan límites', () => {
    const points = [
      { u: 1.0, z: 1.0 },
      { u: 2.0, z: 1.0 }
    ];

    const inserted = insertRoutePoint(points, 0, { u: 1.5, z: 1.5 });
    expect(inserted).toHaveLength(3);
    expect(inserted[1]).toEqual({ u: 1.5, z: 1.5 });

    const removed = removeRoutePoint(inserted, 1);
    expect(removed).toEqual(points);

    // Intentar eliminar extremos no tiene efecto
    expect(removeRoutePoint(points, 0)).toEqual(points);
  });

  it('elevationRouteToPlanWaypoints proyecta a coordenadas tridimensionales de planta', () => {
    const points = [
      { u: 1.0, z: 0.3 },
      { u: 1.0, z: 2.5 }
    ];

    // Muro a lo largo del eje X (origen 0,0, dirección 1,0)
    const waypoints = elevationRouteToPlanWaypoints(points, {
      origin: { x: 5, y: 10 },
      ux: 1,
      uy: 0
    });

    expect(waypoints).toEqual([
      { x: 6, y: 10, heightZ: 0.3 },
      { x: 6, y: 10, heightZ: 2.5 }
    ]);
  });
});
