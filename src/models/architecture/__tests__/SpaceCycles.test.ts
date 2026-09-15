import { describe, it, expect } from 'vitest';
import { findEnclosedCycles } from '../Space';

describe('Detección Planar de Ambientes (findEnclosedCycles)', () => {
  it('debe detectar exactamente 1 ambiente para un recinto cerrado simple de 4 muros', () => {
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 },
      { id: 'v4', x: 0, y: 4 }
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(1);
    expect(cycles[0].vertexIds.length).toBe(4);
    expect(cycles[0].wallIds.length).toBe(4);
  });

  it('debe detectar EXACTAMENTE 2 ambientes en dos recintos adyacentes con muro medianero compartido (sin falso ambiente compuesto ni perímetro exterior)', () => {
    // Habitación 1: (0,0) a (4,4)
    // Habitación 2: (4,0) a (8,4), compartiendo muro v2-v3
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v5', x: 8, y: 0 },
      { id: 'v6', x: 8, y: 4 }
    ];

    const walls = [
      // Recinto 1
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' }, // Muro compartido
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      // Recinto 2
      { id: 'w5', startVertexId: 'v2', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v3' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    // ¡Debe haber exactamente 2 ambientes, NO 3 (no debe detectar la unión de ambos)!
    expect(cycles.length).toBe(2);

    // Verificar que cada ciclo tenga sus 4 vértices correspondientes
    const sets = cycles.map((c) => new Set(c.vertexIds));
    const hasRoom1 = sets.some((s) => s.has('v1') && s.has('v2') && s.has('v3') && s.has('v4'));
    const hasRoom2 = sets.some((s) => s.has('v2') && s.has('v5') && s.has('v6') && s.has('v3'));

    expect(hasRoom1).toBe(true);
    expect(hasRoom2).toBe(true);
  });

  it('no debe detectar ambientes si los muros no cierran ningún recinto (paredes abiertas o aletas)', () => {
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 }
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(0);
  });
});
