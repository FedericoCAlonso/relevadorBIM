import { describe, it, expect } from 'vitest';
import { solveRectangularSpace, solveSpaceFromDoorJamb, solveTeeWallBranch } from '../RelativeSolver';
import { calculatePolygonArea, resolveSpacePolygon } from '../../architecture/Space';
import type { Opening } from '../../architecture/Opening';
import { calculateVoltageDropPercent, calculateConduitOccupancyFactor } from '../../electrical/calculations';

describe('RelativeSolver & Relevamiento Referenciado', () => {
  it('debe generar un ambiente rectangular cerrado con 4 muros y área exacta', () => {
    const res = solveRectangularSpace({
      origin: { x: 0, y: 0 },
      width: 4.0,
      length: 5.0,
      levelId: 'lvl-1',
      name: 'Living',
      category: 'living'
    });

    expect(res.vertices.length).toBe(4);
    expect(res.walls.length).toBe(4);
    expect(res.space.boundaryVertexIds.length).toBe(4);

    const verticesMap = new Map(res.vertices.map((v) => [v.id, v]));
    const poly = resolveSpacePolygon(res.space, verticesMap);
    const area = calculatePolygonArea(poly);

    expect(area).toBeCloseTo(20.0, 2);
  });

  it('debe acoplar un ambiente nuevo a través de la jamba de una puerta compartiendo el muro anfitrión', () => {
    // 1. Crear ambiente 1 (Living 4x5m)
    const living = solveRectangularSpace({
      origin: { x: 0, y: 0 },
      width: 4.0,
      length: 5.0,
      levelId: 'lvl-1',
      name: 'Living',
      category: 'living'
    });

    const verticesMap = new Map(living.vertices.map((v) => [v.id, v]));
    const eastWall = living.walls[1]; // Muro que va de (4,0) a (4,5)

    // 2. Insertar puerta en el muro este a 1.0m del inicio, ancho 0.80m
    const door: Opening = {
      id: 'door-1',
      wallId: eastWall.id,
      type: 'door',
      width: 0.80,
      height: 2.05,
      sill: 0.0,
      distanceAlongWall: 1.00,
      swing: 'left_in'
    };

    // 3. Acoplar dormitorio nuevo con láser rebotando a 0.50m de la jamba hacia la izquierda
    const dorm = solveSpaceFromDoorJamb({
      hostWall: eastWall,
      opening: door,
      verticesMap,
      distanceCornerToJamb: 0.50,
      whichJamb: 1,
      side: 'left',
      newRoomWidth: 3.50,
      newRoomDepth: 3.00,
      levelId: 'lvl-1',
      name: 'Dormitorio',
      category: 'dormitorio'
    });

    expect(dorm).not.toBeNull();
    if (!dorm) return;

    // Solo debe generar 3 muros nuevos; el 4to es el muro este existente
    expect(dorm.walls.length).toBe(3);
    expect(dorm.space.wallIds).toContain(eastWall.id);

    // Los 4 vértices del nuevo dormitorio deben existir
    expect(dorm.vertices.length).toBe(4);
  });

  it('debe generar un empalme en T perpendicular sin solapamientos', () => {
    const living = solveRectangularSpace({
      origin: { x: 0, y: 0 },
      width: 4.0,
      length: 5.0,
      levelId: 'lvl-1',
      name: 'Living',
      category: 'living'
    });

    const verticesMap = new Map(living.vertices.map((v) => [v.id, v]));
    const northWall = living.walls[0]; // de (0,0) a (4,0)

    const tee = solveTeeWallBranch({
      hostWall: northWall,
      verticesMap,
      offsetFromStart: 2.0,
      branchLength: 3.0,
      side: 'left',
      levelId: 'lvl-1'
    });

    expect(tee).not.toBeNull();
    if (!tee) return;

    expect(tee.branchVertex.x).toBeCloseTo(2.0, 2);
    expect(tee.branchVertex.y).toBeCloseTo(0.0, 2);
    // Como el muro va en +X y side es 'left' (normal +Y), la rama debe extenderse hacia +Y
    expect(tee.endVertex.y).toBeCloseTo(3.0, 2);
  });

  it('debe calcular la caída de tensión reglamentaria AEA 90364', () => {
    const calc = calculateVoltageDropPercent({
      currentA: 16.0,
      lengthM: 20.0,
      sectionMM2: 2.5,
      voltageV: 220
    });

    // Delta V = (2 * 20m * 16A * 0.9) / (56 * 2.5) = 576 / 140 = 4.11 V (~1.87%)
    expect(calc.deltaVVolts).toBeCloseTo(4.11, 1);
    expect(calc.deltaVPercent).toBeLessThan(3.0);
    expect(calc.isCompliant).toBe(true);
  });

  it('debe verificar el factor de ocupación de cañería <= 35% según AEA', () => {
    const calc = calculateConduitOccupancyFactor({
      conduitDiameterMM: 19,
      conductors: [
        { role: 'fase', sectionMM2: 2.5 },
        { role: 'neutro', sectionMM2: 2.5 },
        { role: 'pe', sectionMM2: 2.5 }
      ]
    });

    expect(calc.maxAllowedPercent).toBe(35.0);
    expect(calc.occupancyPercent).toBeLessThan(35.0);
    expect(calc.isCompliant).toBe(true);
  });
});
