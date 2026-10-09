import { describe, it, expect } from 'vitest';
import { computeNewNodeFromElevation } from '../elevationPlacement';
import type { Wall, WallVertex } from '../Wall';

describe('elevationPlacement — Emplazamiento de nodos desde alzado', () => {
  const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
  const v2: WallVertex = { id: 'v2', x: 4, y: 0 };
  const vertices = new Map([
    ['v1', v1],
    ['v2', v2]
  ]);

  const wall: Wall = {
    id: 'w1',
    levelId: 'lvl1',
    startVertexId: 'v1',
    endVertexId: 'v2',
    thickness: 0.20,
    height: 2.80,
    wallType: 'standard'
  };

  it('calcula posición en planta para cara izquierda', () => {
    const res = computeNewNodeFromElevation({
      wall,
      vertices,
      face: 'left',
      targetX: 1.0,
      targetZ: 1.10,
      boxWidthM: 0.10,
      boxHeightM: 0.10
    });

    expect(res).not.toBeNull();
    expect(res?.wallOffset).toBe(1.0);
    expect(res?.x).toBe(1.0);
    // Cara izquierda: normal (0, 1) -> +thickness/2 = +0.10
    expect(res?.y).toBe(0.10);
    expect(res?.heightZ).toBe(1.10);
    expect(res?.side).toBe('left');
    // Para que el símbolo apoye su base en la pared y proyecte hacia afuera (ambiente)
    expect(res?.rotationDeg).toBe(180);
  });

  it('calcula posición en planta para cara derecha (invertida en X)', () => {
    const res = computeNewNodeFromElevation({
      wall,
      vertices,
      face: 'right',
      targetX: 1.0,
      targetZ: 0.30,
      boxWidthM: 0.10,
      boxHeightM: 0.10
    });

    expect(res).not.toBeNull();
    // Cara derecha: targetX = 1 -> u = 4 - 1 = 3
    expect(res?.wallOffset).toBe(3.0);
    expect(res?.x).toBe(3.0);
    // Cara derecha: -thickness/2 = -0.10
    expect(res?.y).toBe(-0.10);
    expect(res?.heightZ).toBe(0.30);
    expect(res?.side).toBe('right');
    expect(res?.rotationDeg).toBe(0);
  });

  it('limita la posición dentro de los límites del muro y tamaño de caja', () => {
    const res = computeNewNodeFromElevation({
      wall,
      vertices,
      face: 'left',
      targetX: -10,
      targetZ: 99,
      boxWidthM: 0.10,
      boxHeightM: 0.10
    });

    expect(res).not.toBeNull();
    expect(res?.wallOffset).toBe(0.05); // halfW
    expect(res?.heightZ).toBe(2.75);    // wall.height - halfH = 2.80 - 0.05
  });

  it('calcula rotación correcta para muro vertical en caras izquierda y derecha', () => {
    const vVert1: WallVertex = { id: 'vv1', x: 0, y: 0 };
    const vVert2: WallVertex = { id: 'vv2', x: 0, y: 3 };
    const vertMap = new Map([
      ['vv1', vVert1],
      ['vv2', vVert2]
    ]);
    const vertWall: Wall = {
      id: 'wVert',
      levelId: 'lvl1',
      startVertexId: 'vv1',
      endVertexId: 'vv2',
      thickness: 0.15,
      height: 2.60,
      wallType: 'standard'
    };

    // Muro a 90°: cara izquierda gira 90 + 180 = 270° (hacia x < 0)
    const leftRes = computeNewNodeFromElevation({
      wall: vertWall,
      vertices: vertMap,
      face: 'left',
      targetX: 1.5,
      targetZ: 1.0
    });
    expect(leftRes?.rotationDeg).toBe(270);

    // Muro a 90°: cara derecha mantiene 90° (hacia x > 0)
    const rightRes = computeNewNodeFromElevation({
      wall: vertWall,
      vertices: vertMap,
      face: 'right',
      targetX: 1.5,
      targetZ: 1.0
    });
    expect(rightRes?.rotationDeg).toBe(90);
  });
});
