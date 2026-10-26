import { describe, it, expect } from 'vitest';
import {
  findEnclosedCycles,
  calculateSpaceMetrics,
  ROOM_NAME_SUGGESTIONS,
  STANDARD_CEILING_HEIGHT_PRESETS
} from '../Space';

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

  it('debe detectar ambientes cuando comparten una pared parcial común (empalme en T sin partir muro previamente)', () => {
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 6, y: 0 }, // Muro largo de 6m
      { id: 'v3', x: 6, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      // Segundo ambiente adosado parcialmente de x=0 a x=4
      { id: 'vT', x: 4, y: 0 }, // Cae sobre el muro v1-v2
      { id: 'vC', x: 4, y: -3 },
      { id: 'vD', x: 0, y: -3 }
    ];

    const walls = [
      // Habitación 1 (6x4 = 24m²)
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' }, // Muro continuo de 6m
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      // Habitación 2 adosada (4x3 = 12m²)
      { id: 'w5', startVertexId: 'vT', endVertexId: 'vC' },
      { id: 'w6', startVertexId: 'vC', endVertexId: 'vD' },
      { id: 'w7', startVertexId: 'vD', endVertexId: 'v1' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('debe detectar ambientes complejos anidados en L con múltiples paredes compartidas parcialmente', () => {
    // Habitación 1 en "L":
    // (0,0) -> (6,0) -> (6,3) -> (3,3) -> (3,6) -> (0,6) -> (0,0)
    // Habitación 2 que encaja en el hueco de la "L" de (3,3) a (6,6):
    // Comparte parcialmente el tramo vertical (3,3)-(3,6) y el tramo horizontal (3,3)-(6,3)
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 6, y: 0 },
      { id: 'v3', x: 6, y: 3 },
      { id: 'v4', x: 3, y: 3 },
      { id: 'v5', x: 3, y: 6 },
      { id: 'v6', x: 0, y: 6 },
      // Esquina exterior de la Habitación 2
      { id: 'v7', x: 6, y: 6 }
    ];

    const walls = [
      // Perímetro de Habitación 1
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' }, // Compartida con Hab 2
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v5' }, // Compartida con Hab 2
      { id: 'w5', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w6', startVertexId: 'v6', endVertexId: 'v1' },
      // Cierre de Habitación 2
      { id: 'w7', startVertexId: 'v3', endVertexId: 'v7' },
      { id: 'w8', startVertexId: 'v7', endVertexId: 'v5' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);

    const areas = cycles.map((c) => {
      const poly = c.vertexIds.map((id) => vertices.find((v) => v.id === id)!);
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        a += p1.x * p2.y - p2.x * p1.y;
      }
      return a / 2;
    });

    // Hab 1: 6x6 - 3x3 = 27 m²
    // Hab 2: 3x3 = 9 m²
    expect(areas.some((a) => Math.abs(a - 27) < 0.1)).toBe(true);
    expect(areas.some((a) => Math.abs(a - 9) < 0.1)).toBe(true);
  });

  it('debe cerrar el patio/vacío de aire y luz con una Línea Divisoria Virtual (separator)', () => {
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 3, y: 0 },
      { id: 'v3', x: 3, y: 3 },
      { id: 'v4', x: 0, y: 3 }
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      // 4ta cara abierta: se cierra con separator (Línea de separación virtual)
      { id: 'w-sep', startVertexId: 'v4', endVertexId: 'v1' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(1);
    expect(cycles[0].wallIds).toContain('w-sep');
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

  it('debe calcular métricas BIM (área, perímetro y volumen) correctamente mediante calculateSpaceMetrics', () => {
    const verticesMap = new Map([
      ['v1', { id: 'v1', x: 0, y: 0 }],
      ['v2', { id: 'v2', x: 5, y: 0 }],
      ['v3', { id: 'v3', x: 5, y: 4 }],
      ['v4', { id: 'v4', x: 0, y: 4 }]
    ]);

    const space = {
      id: 'sp-1',
      name: 'Living Comedor',
      category: 'living' as const,
      levelId: 'lvl-1',
      ceilingHeight: 2.70,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      wallIds: ['w1', 'w2', 'w3', 'w4']
    };

    const metrics = calculateSpaceMetrics(space, verticesMap);
    // Rectángulo 5m x 4m = 20 m²
    expect(metrics.areaM2).toBe(20);
    // Perímetro = 2*(5+4) = 18 m
    expect(metrics.perimeterM).toBe(18);
    // Volumen = 20 * 2.70 = 54 m³
    expect(metrics.volumeM3).toBe(54);
  });

  it('debe exponer sugerencias de nombres y presets de altura estándar', () => {
    expect(ROOM_NAME_SUGGESTIONS).toContain('Living Comedor');
    expect(ROOM_NAME_SUGGESTIONS).toContain('Cocina');
    expect(STANDARD_CEILING_HEIGHT_PRESETS).toContain(2.70);
  });

  it('debe detectar ambientes cuando el usuario dibuja muros duplicados o superpuestos en la medianera', () => {
    // Habitación 1: (0,0) a (4,4)
    // Habitación 2: (4,0) a (8,4), pero el usuario trazó un muro adicional entre v2 y v3
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v5', x: 8, y: 4 },
      { id: 'v6', x: 8, y: 0 }
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      // Habitación 2 con muro medianero duplicado (w8_dup)
      { id: 'w5', startVertexId: 'v3', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v2' },
      { id: 'w8_dup', startVertexId: 'v2', endVertexId: 'v3' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('debe detectar ambientes con pared parcial común y muro superpuesto parcialmente', () => {
    // Habitación 1 de 6x4m
    // Habitación 2 comparte el tramo de x=2 a x=6
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 6, y: 0 },
      { id: 'v3', x: 6, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v_part', x: 2, y: 0 },
      { id: 'v_r2_1', x: 6, y: -3 },
      { id: 'v_r2_2', x: 2, y: -3 }
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' }, // Tramo continuo (0,0)-(6,0)
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      // Habitación 2 trazada con tramo parcial adosado
      { id: 'w5', startVertexId: 'v2', endVertexId: 'v_r2_1' },
      { id: 'w6', startVertexId: 'v_r2_1', endVertexId: 'v_r2_2' },
      { id: 'w7', startVertexId: 'v_r2_2', endVertexId: 'v_part' },
      { id: 'w8_part', startVertexId: 'v_part', endVertexId: 'v2' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('debe absorber desfasajes de espesor de pared y falsa escuadra (T-junctions con offset hasta 15 cm)', () => {
    // El vértice de llegada cae a 5 cm de la pared divisoria (por ejemplo, por medición de cara vista)
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 5, y: 0 },
      { id: 'v3', x: 5, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v5', x: 9, y: 4 },
      { id: 'v6', x: 9, y: 1 },
      { id: 'v7_off', x: 5.05, y: 1 } // 5 cm de desvío de x=5.00
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      { id: 'w5', startVertexId: 'v3', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v7_off' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('debe detectar ambientes cuando los muros se cruzan formando un recinto sin nodo previo de intersección', () => {
    // Muro que sobrepasa el perímetro y cruza la pared divisoria
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 5, y: 0 },
      { id: 'v3', x: 5, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v5', x: 9, y: 4 },
      { id: 'v6', x: 9, y: 1 },
      { id: 'v7_cross', x: 4.5, y: 1 } // Cruza la pared x=5
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      { id: 'w5', startVertexId: 'v3', endVertexId: 'v5' },
      { id: 'w6', startVertexId: 'v5', endVertexId: 'v6' },
      { id: 'w7', startVertexId: 'v6', endVertexId: 'v7_cross' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(2);
  });

  it('debe detectar exactamente 9 recintos cerrados en una cuadrícula 3x3 de muros compartidos', () => {
    const vertices: { id: string; x: number; y: number }[] = [];
    for (let x = 0; x <= 3; x++) {
      for (let y = 0; y <= 3; y++) {
        vertices.push({ id: `v_${x}_${y}`, x, y });
      }
    }

    const walls: { id: string; startVertexId: string; endVertexId: string }[] = [];
    let wId = 0;
    for (let y = 0; y <= 3; y++) {
      for (let x = 0; x < 3; x++) {
        walls.push({ id: `wh_${++wId}`, startVertexId: `v_${x}_${y}`, endVertexId: `v_${x + 1}_${y}` });
      }
    }
    for (let x = 0; x <= 3; x++) {
      for (let y = 0; y < 3; y++) {
        walls.push({ id: `wv_${++wId}`, startVertexId: `v_${x}_${y}`, endVertexId: `v_${x}_${y + 1}` });
      }
    }

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(9);
  });

  it('no debe generar falsos ambientes con tabiques divisorios internos o aletas ciegas', () => {
    const vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 6, y: 0 },
      { id: 'v3', x: 6, y: 4 },
      { id: 'v4', x: 0, y: 4 },
      { id: 'v_tab', x: 3, y: 2 }
    ];

    const walls = [
      { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
      { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
      { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
      { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' },
      { id: 'w_aleta', startVertexId: 'v1', endVertexId: 'v_tab' }
    ];

    const cycles = findEnclosedCycles(walls, vertices);
    expect(cycles.length).toBe(1);
  });
});
