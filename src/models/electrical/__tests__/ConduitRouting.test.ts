import { describe, it, expect } from 'vitest';
import { areNodesOnSameWall, resolveDefaultRoutingPlane } from '../conduitRouting';
import { getConduitLengthBreakdown } from '../conduitMetrics';
import type { SpatialElectricalNode } from '../ElectricalModel';

const node = (over: Partial<SpatialElectricalNode>): SpatialElectricalNode => ({
  id: 'n',
  levelId: 'lvl',
  spaceId: 's',
  x: 0,
  y: 0,
  heightZ: 1,
  wallId: 'w1',
  ...over
});

describe('Vía de tendido por defecto', () => {
  it('mismo muro y mismo nivel → pared, aunque la preferencia sea losa', () => {
    expect(resolveDefaultRoutingPlane(node({}), node({}), 'ceiling_slab')).toBe('wall');
  });

  it('muros distintos → respeta la preferencia', () => {
    expect(resolveDefaultRoutingPlane(node({}), node({ wallId: 'w2' }), 'ceiling_slab')).toBe('ceiling_slab');
    expect(resolveDefaultRoutingPlane(node({}), node({ wallId: 'w2' }), 'floor_slab')).toBe('floor_slab');
  });

  it('niveles distintos → respeta la preferencia', () => {
    expect(resolveDefaultRoutingPlane(node({}), node({ levelId: 'otro' }), 'ceiling_slab')).toBe('ceiling_slab');
  });

  it('sin muro o con nodos ausentes → respeta la preferencia', () => {
    expect(areNodesOnSameWall(node({ wallId: null }), node({ wallId: null }))).toBe(false);
    expect(areNodesOnSameWall(undefined, node({}))).toBe(false);
    expect(resolveDefaultRoutingPlane(undefined, undefined, 'ceiling_slab')).toBe('ceiling_slab');
  });

  it('el cómputo por pared no suma subidas ficticias a la losa', () => {
    const a = node({ id: 'a', x: 0, heightZ: 0.3 });
    const b = node({ id: 'b', x: 1, heightZ: 0.3 });
    const wall = getConduitLengthBreakdown({
      fromElement: a,
      toElement: b,
      levelsMap: new Map(),
      routingPlane: resolveDefaultRoutingPlane(a, b, 'ceiling_slab'),
      ceilingHeightM: 2.7
    });
    const slab = getConduitLengthBreakdown({
      fromElement: a,
      toElement: b,
      levelsMap: new Map(),
      routingPlane: 'ceiling_slab',
      ceilingHeightM: 2.7
    });
    expect(wall.dzLocal).toBe(0);
    expect(wall.totalLengthM).toBeLessThan(slab.totalLengthM);
  });
});
