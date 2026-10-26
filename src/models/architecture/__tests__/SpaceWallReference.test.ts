import { describe, it, expect } from 'vitest';
import { calculateSpaceWallReferences } from '../spaceWallReference';
import type { Space } from '../Space';
import type { Wall, WallVertex } from '../Wall';

describe('Referencias Relativas de Paredes por Ambiente (calculateSpaceWallReferences)', () => {
  it('debe asignar letras A, B, C, D en sentido horario partiendo del Norte para un ambiente rectangular', () => {
    const space: Space = {
      id: 'sp-living',
      name: 'Living',
      category: 'living',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      wallIds: ['w1', 'w2', 'w3', 'w4']
    };

    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 5, y: 0 }],
      ['v3', { id: 'v3', x: 5, y: 4 }],
      ['v4', { id: 'v4', x: 0, y: 4 }]
    ]);

    const walls: Wall[] = [
      { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.70 },
      { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.70 },
      { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.70 },
      { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.70 }
    ];

    const refs = calculateSpaceWallReferences(space, verticesMap, walls);

    expect(refs.length).toBe(4);

    // Pared A: Norte (de (0,0) a (5,0))
    expect(refs[0].letter).toBe('A');
    expect(refs[0].shortLabel).toBe('Pared A');
    expect(refs[0].fullName).toBe('Pared A · Living');
    expect(refs[0].lengthM).toBe(5);
    expect(refs[0].compassOrientation).toBe('Norte');
    expect(refs[0].wallId).toBe('w1');
    expect(refs[0].badgePosition.y).toBeGreaterThan(0); // Hacia el interior (Y > 0)

    // Pared B: Este (de (5,0) a (5,4))
    expect(refs[1].letter).toBe('B');
    expect(refs[1].fullName).toBe('Pared B · Living');
    expect(refs[1].lengthM).toBe(4);
    expect(refs[1].compassOrientation).toBe('Este');
    expect(refs[1].wallId).toBe('w2');
    expect(refs[1].badgePosition.x).toBeLessThan(5); // Hacia el interior (X < 5)

    // Pared C: Sur (de (5,4) a (0,4))
    expect(refs[2].letter).toBe('C');
    expect(refs[2].fullName).toBe('Pared C · Living');
    expect(refs[2].lengthM).toBe(5);
    expect(refs[2].compassOrientation).toBe('Sur');
    expect(refs[2].wallId).toBe('w3');
    expect(refs[2].badgePosition.y).toBeLessThan(4); // Hacia el interior (Y < 4)

    // Pared D: Oeste (de (0,4) a (0,0))
    expect(refs[3].letter).toBe('D');
    expect(refs[3].fullName).toBe('Pared D · Living');
    expect(refs[3].lengthM).toBe(4);
    expect(refs[3].compassOrientation).toBe('Oeste');
    expect(refs[3].wallId).toBe('w4');
    expect(refs[3].badgePosition.x).toBeGreaterThan(0); // Hacia el interior (X > 0)
  });

  it('debe mantener la misma orientación horaria aunque los vértices del ambiente vengan en sentido antihorario', () => {
    const spaceCCW: Space = {
      id: 'sp-cocina',
      name: 'Cocina',
      category: 'cocina',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v4', 'v3', 'v2'], // Antihorario
      wallIds: ['w1', 'w2', 'w3', 'w4']
    };

    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 4, y: 0 }],
      ['v3', { id: 'v3', x: 4, y: 3 }],
      ['v4', { id: 'v4', x: 0, y: 3 }]
    ]);

    const walls: Wall[] = [
      { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.70 },
      { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.70 },
      { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.70 },
      { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.70 }
    ];

    const refs = calculateSpaceWallReferences(spaceCCW, verticesMap, walls);

    expect(refs.length).toBe(4);
    expect(refs[0].letter).toBe('A');
    expect(refs[0].compassOrientation).toBe('Norte');
    expect(refs[1].letter).toBe('B');
    expect(refs[1].compassOrientation).toBe('Este');
    expect(refs[2].letter).toBe('C');
    expect(refs[2].compassOrientation).toBe('Sur');
    expect(refs[3].letter).toBe('D');
    expect(refs[3].compassOrientation).toBe('Oeste');
  });

  it('debe manejar paredes compartidas asignando nombres relativos diferentes según el ambiente seleccionado', () => {
    // Living de (0,0) a (4,4)
    // Cocina adyacente de (4,0) a (8,4)
    // Muro w_shared conecta (4,0) y (4,4)
    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 4, y: 0 }],
      ['v3', { id: 'v3', x: 4, y: 4 }],
      ['v4', { id: 'v4', x: 0, y: 4 }],
      ['v5', { id: 'v5', x: 8, y: 0 }],
      ['v6', { id: 'v6', x: 8, y: 4 }]
    ]);

    const sharedWall: Wall = {
      id: 'w-medianera',
      levelId: 'lvl-1',
      startVertexId: 'v2',
      endVertexId: 'v3',
      thickness: 0.15,
      height: 2.70
    };

    const allWalls: Wall[] = [
      { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.70 },
      sharedWall,
      { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.70 },
      { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.70 },
      { id: 'w5', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v5', thickness: 0.15, height: 2.70 },
      { id: 'w6', levelId: 'lvl-1', startVertexId: 'v5', endVertexId: 'v6', thickness: 0.15, height: 2.70 },
      { id: 'w7', levelId: 'lvl-1', startVertexId: 'v6', endVertexId: 'v3', thickness: 0.15, height: 2.70 }
    ];

    const living: Space = {
      id: 'sp-living',
      name: 'Living',
      category: 'living',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      wallIds: ['w1', 'w-medianera', 'w3', 'w4']
    };

    const cocina: Space = {
      id: 'sp-cocina',
      name: 'Cocina',
      category: 'cocina',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v2', 'v5', 'v6', 'v3'],
      wallIds: ['w5', 'w6', 'w7', 'w-medianera']
    };

    const livingRefs = calculateSpaceWallReferences(living, verticesMap, allWalls);
    const cocinaRefs = calculateSpaceWallReferences(cocina, verticesMap, allWalls);

    // En el Living, el muro compartido es la pared Este (Pared B)
    const livingSharedRef = livingRefs.find((r) => r.wallId === 'w-medianera');
    expect(livingSharedRef).toBeDefined();
    expect(livingSharedRef!.letter).toBe('B');
    expect(livingSharedRef!.fullName).toBe('Pared B · Living');

    // En la Cocina, ese mismo muro físico es la pared Oeste (Pared D)
    const cocinaSharedRef = cocinaRefs.find((r) => r.wallId === 'w-medianera');
    expect(cocinaSharedRef).toBeDefined();
    expect(cocinaSharedRef!.letter).toBe('D');
    expect(cocinaSharedRef!.fullName).toBe('Pared D · Cocina');
  });

  it('debe admitir ambientes complejos en forma de L asignando letras hasta la F', () => {
    const spaceL: Space = {
      id: 'sp-l',
      name: 'Estar en L',
      category: 'living',
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'],
      wallIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']
    };

    const verticesMap = new Map<string, WallVertex>([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 6, y: 0 }],
      ['v3', { id: 'v3', x: 6, y: 3 }],
      ['v4', { id: 'v4', x: 3, y: 3 }],
      ['v5', { id: 'v5', x: 3, y: 6 }],
      ['v6', { id: 'v6', x: 0, y: 6 }]
    ]);

    const refs = calculateSpaceWallReferences(spaceL, verticesMap, []);
    expect(refs.length).toBe(6);
    expect(refs.map((r) => r.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
});
