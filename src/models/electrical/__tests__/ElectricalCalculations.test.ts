/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ElectricalCalculations.test.ts
 * Pruebas unitarias para generación de etiquetas únicas, curvatura a 90°,
 * ruteo ortogonal y transiciones verticales AEA.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  generateNextUniqueLabel,
  generateNextUniqueLabelInCircuit,
  formatElementLabel,
  generateRoundedPolylineSvgPath,
  computeOrthogonalConduitPoints,
  getConduitVerticalTransitions,
  getConduitLengthBreakdown,
  computeWaypointTransitionMetrics,
  isBendAngleValid,
  getNextElevationDetailTag
} from '../calculations';

describe('generateNextUniqueLabel (Unicidad determinista)', () => {
  it('genera etiqueta inicial cuando no existen bocas', () => {
    expect(generateNextUniqueLabel('B', [])).toBe('B1');
    expect(generateNextUniqueLabel('TUG', [])).toBe('TUG1');
    expect(generateNextUniqueLabel('IUG ', [])).toBe('IUG 1');
    expect(generateNextUniqueLabel('B-', [])).toBe('B-1');
  });

  it('incrementa secuencialmente sin colisionar con etiquetas existentes', () => {
    const existing = [{ label: 'B1' }, { label: 'B2' }, { label: 'B3' }];
    expect(generateNextUniqueLabel('B', existing)).toBe('B4');
  });

  it('rellena huecos disponibles si existen saltos en la numeración', () => {
    const existing = [{ label: 'B1' }, { label: 'B2' }, { label: 'B4' }];
    // Debe reutilizar el 3 libre
    expect(generateNextUniqueLabel('B', existing)).toBe('B3');
  });

  it('soporta prefijos con guion o espacio conservando el separador', () => {
    const existing = ['TUG-1', 'TUG-2'];
    expect(generateNextUniqueLabel('TUG-', existing)).toBe('TUG-3');

    const existingSpaces = [{ label: 'Boca 1' }, { label: 'Boca 2' }];
    expect(generateNextUniqueLabel('Boca ', existingSpaces)).toBe('Boca 3');
  });

  it('aísla los prefijos diferentes sin interferir entre sí', () => {
    const existing = [{ label: 'IUG 1' }, { label: 'IUG 2' }, { label: 'TUG 1' }];
    expect(generateNextUniqueLabel('TUG ', existing)).toBe('TUG 2');
    expect(generateNextUniqueLabel('B', existing)).toBe('B1');
  });

  it('respeta startNumber cuando se proporciona', () => {
    const existing = [{ label: 'B1' }, { label: 'B2' }];
    expect(generateNextUniqueLabel('B', existing, 10)).toBe('B10');
  });
});

describe('generateRoundedPolylineSvgPath (Curvatura a 90° con radio técnico)', () => {
  it('devuelve cadena vacía o trazo recto para 0, 1 o 2 puntos', () => {
    expect(generateRoundedPolylineSvgPath([])).toBe('');
    expect(generateRoundedPolylineSvgPath([{ x: 10, y: 10 }])).toBe('M 10.0 10.0');
    expect(generateRoundedPolylineSvgPath([{ x: 0, y: 0 }, { x: 50, y: 0 }])).toBe('M 0.0 0.0 L 50.0 0.0');
  });

  it('genera curva Bézier cuadrática continua en un quiebre a 90°', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ];
    const path = generateRoundedPolylineSvgPath(points, 20);
    // Debe comenzar en 0,0, avanzar hasta 80,0, curvar con Q 100,0 hasta 100,20, y terminar en 100,100
    expect(path).toContain('M 0.0 0.0');
    expect(path).toContain('L 80.0 0.0');
    expect(path).toContain('Q 100.0 0.0 100.0 20.0');
    expect(path).toContain('L 100.0 100.0');
  });

  it('limita el radio adaptativamente si el tramo es más corto que el radio', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ];
    // Radio solicitado 20, pero el tramo mide 10, por lo que effectiveRadius = 5
    const path = generateRoundedPolylineSvgPath(points, 20);
    expect(path).toContain('L 5.0 0.0');
    expect(path).toContain('Q 10.0 0.0 10.0 5.0');
    expect(path).toContain('L 10.0 10.0');
  });

  it('no genera arcos si los puntos consecutivos son colineales', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 }
    ];
    const path = generateRoundedPolylineSvgPath(points, 15);
    expect(path).not.toContain('Q');
    expect(path).toBe('M 0.0 0.0 L 50.0 0.0 L 100.0 0.0');
  });
});

describe('computeOrthogonalConduitPoints (Ruteo en escuadra con waypoints)', () => {
  it('conecta directamente si los puntos ya están alineados', () => {
    const pts = computeOrthogonalConduitPoints({ x: 0, y: 5 }, { x: 10, y: 5 });
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 0, y: 5 });
    expect(pts[1]).toEqual({ x: 10, y: 5 });
  });

  it('inserta vértice ortogonal a 90° cuando hay desnivel en ambos ejes', () => {
    const pts = computeOrthogonalConduitPoints({ x: 0, y: 0 }, { x: 10, y: 5 });
    // Al ser dx (10) >= dy (5), avanza en X hasta (10, 0) y luego en Y a (10, 5)
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 10, y: 0 });
    expect(pts[2]).toEqual({ x: 10, y: 5 });
  });

  it('respeta waypoints explícitos interpuestos', () => {
    const waypoints = [{ x: 5, y: 20 }];
    const pts = computeOrthogonalConduitPoints({ x: 0, y: 0 }, { x: 20, y: 20 }, waypoints);
    expect(pts.length).toBeGreaterThanOrEqual(4);
    // Debe incluir el waypoint o sus proyecciones
    const hasWp = pts.some((p) => p.x === 5 && p.y === 20);
    expect(hasWp).toBe(true);
  });
});

describe('getConduitVerticalTransitions (Desniveles verticales y glifos AEA)', () => {
  it('indica sin transición si el desnivel es menor al umbral de 30 cm', () => {
    const trans = getConduitVerticalTransitions(2.60, 2.50);
    expect(trans.hasTransition).toBe(false);
    expect(trans.fromType).toBe('none');
    expect(trans.toType).toBe('none');
  });

  it('detecta bajada cuando conecta boca de techo (2.70m) con llave (1.20m)', () => {
    const trans = getConduitVerticalTransitions(2.70, 1.20);
    expect(trans.hasTransition).toBe(true);
    expect(trans.dzLocal).toBe(1.50);
    expect(trans.toType).toBe('bajada');
    expect(trans.glyphTextTo).toBe('▼ B. 1.50m');
  });

  it('detecta subida cuando conecta toma bajo (0.30m) con boca a mayor altura (1.20m)', () => {
    const trans = getConduitVerticalTransitions(0.30, 1.20);
    expect(trans.hasTransition).toBe(true);
    expect(trans.dzLocal).toBe(0.90);
    expect(trans.toType).toBe('subida');
    expect(trans.glyphTextTo).toBe('▲ S. 0.90m');
  });

  it('soporta transiciones simultáneas de subida y bajada por losa de techo (ceiling_slab)', () => {
    // Conecta dos tomas a 0.30m por losa a 2.60m: sube 2.30m en origen y baja 2.30m en destino
    const trans = getConduitVerticalTransitions(0.30, 0.30, 0.30, 'ceiling_slab', 2.60);
    expect(trans.hasTransition).toBe(true);
    expect(trans.fromType).toBe('subida');
    expect(trans.toType).toBe('bajada');
    expect(trans.glyphTextFrom).toBe('▲ S. 2.30m');
    expect(trans.glyphTextTo).toBe('▼ B. 2.30m');
    expect(trans.dzLocal).toBe(4.60);
  });

  it('soporta transiciones simultáneas de bajada y subida por contrapiso (floor_slab)', () => {
    // Conecta dos tomas a 1.20m por piso (Z=0): baja 1.20m en origen y sube 1.20m en destino
    const trans = getConduitVerticalTransitions(1.20, 1.20, 0.30, 'floor_slab');
    expect(trans.hasTransition).toBe(true);
    expect(trans.fromType).toBe('bajada');
    expect(trans.toType).toBe('subida');
    expect(trans.glyphTextFrom).toBe('▼ B. 1.20m');
    expect(trans.glyphTextTo).toBe('▲ S. 1.20m');
    expect(trans.dzLocal).toBe(2.40);
  });
});

describe('generateNextUniqueLabelInCircuit (Unicidad por circuito)', () => {
  it('aísla los números entre circuitos distintos', () => {
    const existing = [
      { label: 'B1', circuitId: 'circ-1' },
      { label: 'B2', circuitId: 'circ-1' },
      { label: 'B1', circuitId: 'circ-2' }
    ];

    // Para circ-1, el próximo es B3
    expect(generateNextUniqueLabelInCircuit('B', 'circ-1', existing)).toBe('B3');
    // Para circ-2, el próximo es B2
    expect(generateNextUniqueLabelInCircuit('B', 'circ-2', existing)).toBe('B2');
    // Para un circuito nuevo circ-3, el próximo es B1
    expect(generateNextUniqueLabelInCircuit('B', 'circ-3', existing)).toBe('B1');
  });

  it('aísla las bocas sin circuito asignado (null o undefined)', () => {
    const existing = [
      { label: 'B1', circuitId: null },
      { label: 'B1', circuitId: 'circ-1' }
    ];
    expect(generateNextUniqueLabelInCircuit('B', null, existing)).toBe('B2');
  });
});

describe('formatElementLabel (Modelo relacional Tablero -> Circuito -> Boca)', () => {
  const panel = { name: 'Tablero Principal (TP)' };
  const circuit = { name: 'C1 - Iluminación Uso General' };

  it('formatea en modo completo Tablero_Circuito_Boca', () => {
    expect(
      formatElementLabel({
        elementLabel: 'B1',
        circuit,
        panel,
        mode: 'full'
      })
    ).toBe('TP_C1_B1');
  });

  it('formatea en modo circuito y boca C1_B1', () => {
    expect(
      formatElementLabel({
        elementLabel: 'B2',
        circuit,
        panel,
        mode: 'circuit_element'
      })
    ).toBe('C1_B2');
  });

  it('formatea en modo boca pura B1', () => {
    expect(
      formatElementLabel({
        elementLabel: 'B3',
        circuit,
        panel,
        mode: 'element_only'
      })
    ).toBe('B3');
  });

  it('maneja bocas sin circuito o sin tablero con elegancia', () => {
    expect(
      formatElementLabel({
        elementLabel: 'B1',
        circuit: null,
        panel: null,
        mode: 'full'
      })
    ).toBe('B1');

    expect(
      formatElementLabel({
        elementLabel: 'B1',
        circuit,
        panel: null,
        mode: 'full'
      })
    ).toBe('C1_B1');
  });
});

describe('getConduitLengthBreakdown (Vías de tendido y waypoints)', () => {
  const levelsMap = new Map();
  const elA = {
    id: 'el-1',
    symbolId: 'toma',
    levelId: 'lvl-1',
    spaceId: 's-1',
    placement: 'wall' as const,
    x: 0,
    y: 0,
    heightZ: 0.30
  };
  const elB = {
    id: 'el-2',
    symbolId: 'toma',
    levelId: 'lvl-1',
    spaceId: 's-1',
    placement: 'wall' as const,
    x: 3,
    y: 4,
    heightZ: 0.30
  };

  it('calcula tendido por losa (ceiling_slab): diagonal en planta + subida y bajada por pared', () => {
    // dx=3, dy=4 -> distPlanta = 5 (diagonal libre permitida por losa)
    // ceilingHeight = 2.60m. Subida = 2.30m, Bajada = 2.30m -> dzLocal = 4.60m
    // Suma cruda = 5 + 4.60 = 9.60m
    // Con factor de curvas 1.10 = 9.60 * 1.10 = 10.56m
    const breakdown = getConduitLengthBreakdown({
      fromElement: elA,
      toElement: elB,
      levelsMap,
      routingPlane: 'ceiling_slab',
      ceilingHeightM: 2.60
    });

    expect(breakdown.distPlantaHorizontal).toBe(5.0);
    expect(breakdown.dzLocal).toBe(4.60);
    expect(breakdown.totalLengthM).toBe(10.56);
  });

  it('calcula tendido por pared (wall): ortogonal en planta a 90°', () => {
    // dx=3, dy=4 -> distPlanta = 3 + 4 = 7m
    // Mismo nivel Z=0.30 -> dzLocal = 0
    // Total = 7 * 1.10 = 7.70m
    const breakdown = getConduitLengthBreakdown({
      fromElement: elA,
      toElement: elB,
      levelsMap,
      routingPlane: 'wall'
    });

    expect(breakdown.distPlantaHorizontal).toBe(7.0);
    expect(breakdown.dzLocal).toBe(0.0);
    expect(breakdown.totalLengthM).toBe(7.70);
  });

  it('incluye waypoints intermedios y longitud adicional de montante', () => {
    const waypoints = [{ x: 3, y: 0, heightZ: 2.60, dzLocal: 0.50 }];
    const breakdown = getConduitLengthBreakdown({
      fromElement: elA,
      toElement: elB,
      levelsMap,
      routingPlane: 'ceiling_slab',
      ceilingHeightM: 2.60,
      waypoints,
      additionalLengthM: 10.0
    });

    // Tramo 1: (0,0) a (3,0) = 3m. Tramo 2: (3,0) a (3,4) = 4m. Total planta = 7m
    // dzLocal = 4.60 (subida y bajada) + 0.50 (wp) = 5.10m
    // additionalLengthM = 10m
    // Suma cruda = 7 + 5.10 + 10 = 22.10m
    // Total = 22.10 * 1.10 = 24.31m
    expect(breakdown.distPlantaHorizontal).toBe(7.0);
    expect(breakdown.dzLocal).toBe(5.10);
    expect(breakdown.additionalLengthM).toBe(10.0);
    expect(breakdown.totalLengthM).toBe(24.31);
  });

  it('calcula la hipotenusa cuando el quiebre vertical tiene ángulo de 45°', () => {
    // Transición vertical de 1.50m a 45°
    const waypoints = [
      {
        x: 3,
        y: 0,
        kind: 'elevation_change' as const,
        elevationFromZ: 2.60,
        elevationToZ: 1.10,
        transitionAngleDeg: 45
      }
    ];

    const breakdown = getConduitLengthBreakdown({
      fromElement: elA,
      toElement: elB,
      levelsMap,
      routingPlane: 'ceiling_slab',
      ceilingHeightM: 2.60,
      waypoints
    });

    // ΔZ = 1.50m, a 45° => H = 1.50 / sin(45°) = 2.121m
    // dzLocal = 4.60 (subida/bajada extremos) + 2.121 = 6.72m
    expect(breakdown.dzLocal).toBeCloseTo(6.72, 1);
  });
});

describe('computeWaypointTransitionMetrics (Geometría curva, contracurva e hipotenusa)', () => {
  it('resuelve bajada a plomo de 90° con desplazamiento en planta cero', () => {
    const metrics = computeWaypointTransitionMetrics({
      x: 5,
      y: 5,
      elevationFromZ: 2.60,
      elevationToZ: 1.10,
      transitionAngleDeg: 90
    });

    expect(metrics.dz).toBe(1.50);
    expect(metrics.angleDeg).toBe(90);
    expect(metrics.hypotenuseM).toBe(1.50);
    expect(metrics.offsetPlantaM).toBe(0);
  });

  it('resuelve desvío inclinado a 45° con hipotenusa y desplazamiento en planta', () => {
    const metrics = computeWaypointTransitionMetrics({
      x: 5,
      y: 5,
      elevationFromZ: 2.60,
      elevationToZ: 1.10,
      transitionAngleDeg: 45
    });

    expect(metrics.dz).toBe(1.50);
    expect(metrics.angleDeg).toBe(45);
    // H = 1.50 * sqrt(2) ≈ 2.121
    expect(metrics.hypotenuseM).toBeCloseTo(2.121, 2);
    // ΔL = 1.50 / tan(45°) = 1.50
    expect(metrics.offsetPlantaM).toBeCloseTo(1.50, 2);
  });
});

describe('isBendAngleValid (Restricción de deflexión <= 90°)', () => {
  it('permite tramo recto (deflexión 0°)', () => {
    expect(isBendAngleValid({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 })).toBe(true);
  });

  it('permite giro exacto a escuadra a 90°', () => {
    expect(isBendAngleValid({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 })).toBe(true);
    expect(isBendAngleValid({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: -5 })).toBe(true);
  });

  it('permite curva suave menor a 90° (ej: 45°)', () => {
    expect(isBendAngleValid({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 8, y: 3 })).toBe(true);
  });

  it('prohíbe curvas cerradas en U con deflexión mayor a 90° (retroceso prohibido)', () => {
    // El caño viene de (0,0) a (5,0) y luego dobla hacia atrás a (2, 2)
    expect(isBendAngleValid({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 2, y: 2 })).toBe(false);
    // Vuelve hacia atrás completamente (180°)
    expect(isBendAngleValid({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });
});

describe('getNextElevationDetailTag (Nomenclatura normalizada de vistas A, B, C...)', () => {
  it('asigna A cuando no existen vistas previas', () => {
    expect(getNextElevationDetailTag([])).toBe('A');
  });

  it('asigna correlativamente sin colisionar con vistas existentes', () => {
    expect(getNextElevationDetailTag(['A', 'B'])).toBe('C');
    expect(getNextElevationDetailTag(['A', 'C'])).toBe('B');
  });
});

