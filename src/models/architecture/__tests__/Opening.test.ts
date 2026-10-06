import { describe, it, expect } from 'vitest';
import type { Wall, WallVertex } from '../Wall';
import { getOpeningJambs, getOpeningPhysicalJambs, type Opening } from '../Opening';

describe('Opening - Geometría de Jambas y Aberturas de Cara a Cara', () => {
  const verticesMap = new Map<string, WallVertex>([
    ['v1', { id: 'v1', x: 0, y: 0 }],
    ['v2', { id: 'v2', x: 5, y: 0 }]
  ]);

  const baseOpening: Opening = {
    id: 'op-1',
    wallId: 'w-1',
    type: 'door',
    width: 0.80,
    height: 2.05,
    sill: 0.0,
    distanceAlongWall: 1.00,
    swing: 'left_in'
  };

  describe('getOpeningJambs', () => {
    it('debe calcular las coordenadas longitudinales en el eje del muro', () => {
      const wall: Wall = {
        id: 'w-1',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.20,
        height: 2.80,
        justification: 'center'
      };

      const jambs = getOpeningJambs(baseOpening, wall, verticesMap);
      expect(jambs).not.toBeNull();
      expect(jambs?.jamb1.x).toBeCloseTo(1.00, 3);
      expect(jambs?.jamb1.y).toBeCloseTo(0, 3);
      expect(jambs?.jamb2.x).toBeCloseTo(1.80, 3);
      expect(jambs?.jamb2.y).toBeCloseTo(0, 3);
    });
  });

  describe('getOpeningPhysicalJambs con justificación en eje (center)', () => {
    const wall: Wall = {
      id: 'w-1',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.20,
      height: 2.80,
      justification: 'center'
    };

    it('debe extender las jambas de +halfT a -halfT (+0.10 a -0.10)', () => {
      const phys = getOpeningPhysicalJambs(baseOpening, wall, verticesMap);
      expect(phys).not.toBeNull();

      // Normal izquierda es (0, 1) para un muro de (0,0) a (5,0)
      // leftJamb1 está a +0.10 en Y
      expect(phys?.leftJamb1.x).toBeCloseTo(1.00, 3);
      expect(phys?.leftJamb1.y).toBeCloseTo(0.10, 3);

      // rightJamb1 está a -0.10 en Y
      expect(phys?.rightJamb1.x).toBeCloseTo(1.00, 3);
      expect(phys?.rightJamb1.y).toBeCloseTo(-0.10, 3);

      // Jamba 2
      expect(phys?.leftJamb2.x).toBeCloseTo(1.80, 3);
      expect(phys?.leftJamb2.y).toBeCloseTo(0.10, 3);
      expect(phys?.rightJamb2.x).toBeCloseTo(1.80, 3);
      expect(phys?.rightJamb2.y).toBeCloseTo(-0.10, 3);
    });
  });

  describe('getOpeningPhysicalJambs con justificación en cara interior (interior)', () => {
    const wall: Wall = {
      id: 'w-1',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.15,
      height: 2.80,
      justification: 'interior'
    };

    it('debe anclar la cara interior en y=0 y la exterior en y=-0.15 de cara a cara', () => {
      const phys = getOpeningPhysicalJambs(baseOpening, wall, verticesMap);
      expect(phys).not.toBeNull();

      // leftJamb (cara interior) debe estar exactamente en y=0
      expect(phys?.leftJamb1.x).toBeCloseTo(1.00, 3);
      expect(phys?.leftJamb1.y).toBeCloseTo(0.00, 3);

      // rightJamb (cara exterior) debe estar en y=-0.15
      expect(phys?.rightJamb1.x).toBeCloseTo(1.00, 3);
      expect(phys?.rightJamb1.y).toBeCloseTo(-0.15, 3);

      expect(phys?.leftJamb2.x).toBeCloseTo(1.80, 3);
      expect(phys?.leftJamb2.y).toBeCloseTo(0.00, 3);

      expect(phys?.rightJamb2.x).toBeCloseTo(1.80, 3);
      expect(phys?.rightJamb2.y).toBeCloseTo(-0.15, 3);
    });
  });

  describe('getOpeningPhysicalJambs con justificación en cara exterior (exterior)', () => {
    const wall: Wall = {
      id: 'w-1',
      levelId: 'lvl-1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.30,
      height: 2.80,
      justification: 'exterior'
    };

    it('debe anclar la cara exterior en y=0 y la interior en y=+0.30 de cara a cara', () => {
      const phys = getOpeningPhysicalJambs(baseOpening, wall, verticesMap);
      expect(phys).not.toBeNull();

      // leftJamb (cara interior) debe estar en y=+0.30
      expect(phys?.leftJamb1.x).toBeCloseTo(1.00, 3);
      expect(phys?.leftJamb1.y).toBeCloseTo(0.30, 3);

      // rightJamb (cara exterior) debe estar en y=0.00
      expect(phys?.rightJamb1.x).toBeCloseTo(1.00, 3);
      expect(phys?.rightJamb1.y).toBeCloseTo(0.00, 3);
    });
  });
});
