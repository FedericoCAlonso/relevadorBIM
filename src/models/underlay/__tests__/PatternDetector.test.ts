/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: PatternDetector.test.ts
 * Pruebas unitarias para detección de patrones invariante a rotación
 * mediante autovalores y momentos de inercia 2D.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  binarizeImageData,
  calculateImageMoments,
  calculateEigenSignature,
  compareEigenSignatures,
  tightenBoundingBox,
  createPatternExemplar,
  detectPatternMatchesWithExemplars,
  detectPatternMatches,
  type BoundingBoxPx
} from '../PatternDetector';

describe('PatternDetector - Modelo de Detección por Autovalores', () => {
  it('debe binarizar correctamente píxeles oscuros y claros según luminancia', () => {
    // 4 píxeles: blanco, negro, gris claro, gris oscuro
    const width = 2;
    const height = 2;
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255, // Blanco -> 0
      0, 0, 0, 255,       // Negro -> 1
      220, 220, 220, 255, // Gris claro (>180) -> 0
      50, 50, 50, 255     // Gris oscuro (<180) -> 1
    ]);

    const binary = binarizeImageData(rgba, width, height, 180);
    expect(binary[0]).toBe(0);
    expect(binary[1]).toBe(1);
    expect(binary[2]).toBe(0);
    expect(binary[3]).toBe(1);
  });

  it('debe calcular autovalores rigurosamente invariantes entre un patrón horizontal y uno rotado 90°', () => {
    const size = 40;
    const maskHorizontal = new Uint8Array(size * size);
    const maskVertical = new Uint8Array(size * size);

    // Rectángulo horizontal de 20x8 centrado en (20, 20)
    for (let y = 16; y < 24; y++) {
      for (let x = 10; x < 30; x++) {
        maskHorizontal[y * size + x] = 1;
      }
    }

    // Mismo rectángulo pero rotado 90° (vertical de 8x20) centrado en (20, 20)
    for (let y = 10; y < 30; y++) {
      for (let x = 16; x < 24; x++) {
        maskVertical[y * size + x] = 1;
      }
    }

    const boxH: BoundingBoxPx = { x: 5, y: 5, width: 30, height: 30 };
    const boxV: BoundingBoxPx = { x: 5, y: 5, width: 30, height: 30 };

    const momentsH = calculateImageMoments(maskHorizontal, size, boxH);
    const momentsV = calculateImageMoments(maskVertical, size, boxV);

    const sigH = calculateEigenSignature(momentsH, boxH.width, boxH.height);
    const sigV = calculateEigenSignature(momentsV, boxV.width, boxV.height);

    expect(sigH).not.toBeNull();
    expect(sigV).not.toBeNull();

    // Mismo número de píxeles
    expect(sigH!.pixelCount).toBe(sigV!.pixelCount);

    // Autovalor mayor (lambda1) idéntico
    expect(sigH!.eigenvalues[0]).toBeCloseTo(sigV!.eigenvalues[0], 4);
    // Autovalor menor (lambda2) idéntico
    expect(sigH!.eigenvalues[1]).toBeCloseTo(sigV!.eigenvalues[1], 4);
    // Traza (lambda1 + lambda2) idéntica
    expect(sigH!.trace).toBeCloseTo(sigV!.trace, 4);
    // Excentricidad idéntica
    expect(sigH!.eccentricity).toBeCloseTo(sigV!.eccentricity, 3);

    // Comparación directa de firmas espectrales invariantes
    const similarity = compareEigenSignatures(sigH!, sigV!);
    expect(similarity).toBeGreaterThan(0.95); // Prácticamente 1.0 (coincidencia perfecta)
  });

  it('debe rechazar formas geométricas distintas', () => {
    const size = 30;
    const maskSquare = new Uint8Array(size * size);
    const maskThinLine = new Uint8Array(size * size);

    // Cuadrado compacto 12x12
    for (let y = 9; y < 21; y++) {
      for (let x = 9; x < 21; x++) {
        maskSquare[y * size + x] = 1;
      }
    }

    // Línea delgada 24x2
    for (let y = 14; y < 16; y++) {
      for (let x = 3; x < 27; x++) {
        maskThinLine[y * size + x] = 1;
      }
    }

    const box: BoundingBoxPx = { x: 0, y: 0, width: 30, height: 30 };
    const sigSquare = calculateEigenSignature(calculateImageMoments(maskSquare, size, box), 30, 30);
    const sigLine = calculateEigenSignature(calculateImageMoments(maskThinLine, size, box), 30, 30);

    const similarity = compareEigenSignatures(sigSquare!, sigLine!);
    expect(similarity).toBeLessThan(0.40); // Muy bajo puntaje, rechazado
  });

  it('debe detectar múltiples instancias de un símbolo en un mapa de bits y calcular sus posiciones de mundo', () => {
    const width = 200;
    const height = 150;
    const binaryPlan = new Uint8Array(width * height);

    // Función auxiliar para dibujar un símbolo en forma de cruz/centro de 10x10
    const drawSymbol = (cx: number, cy: number) => {
      for (let x = cx - 4; x <= cx + 4; x++) {
        binaryPlan[cy * width + x] = 1;
      }
      for (let y = cy - 4; y <= cy + 4; y++) {
        binaryPlan[y * width + cx] = 1;
      }
    };

    // Planta 3 símbolos idénticos en distintas ubicaciones
    drawSymbol(30, 30);   // Símbolo 1
    drawSymbol(120, 40);  // Símbolo 2
    drawSymbol(80, 110);  // Símbolo 3

    // Muestra tomada sobre el Símbolo 1
    const sampleBox: BoundingBoxPx = { x: 23, y: 23, width: 15, height: 15 };

    const scaleMetersPerPx = 0.05; // 1 px = 0.05 m
    const originWorld = { x: 10, y: 20 };

    const matches = detectPatternMatches(
      binaryPlan,
      width,
      height,
      sampleBox,
      scaleMetersPerPx,
      originWorld,
      0.80
    );

    // Debe encontrar exactamente los 3 símbolos
    expect(matches.length).toBe(3);

    // Verificar que los centros detectados se aproximan a las coordenadas (30,30), (120,40), (80,110)
    const centersPx = matches.map((m) => ({ x: Math.round(m.centerPx.x), y: Math.round(m.centerPx.y) }));
    expect(centersPx).toContainEqual({ x: 30, y: 30 });
    expect(centersPx).toContainEqual({ x: 120, y: 40 });
    expect(centersPx).toContainEqual({ x: 80, y: 110 });

    // Verificar coordenadas de mundo escaladas
    const match1 = matches.find((m) => Math.round(m.centerPx.x) === 30 && Math.round(m.centerPx.y) === 30);
    expect(match1).toBeDefined();
    expect(match1!.worldPos.x).toBeCloseTo(10 + 30 * 0.05, 2); // 11.5 m
    expect(match1!.worldPos.y).toBeCloseTo(20 + 30 * 0.05, 2); // 21.5 m
  });

  it('debe auto-ceñir la selección del usuario a los trazos de tinta negra (tightenBoundingBox)', () => {
    const size = 50;
    const mask = new Uint8Array(size * size);

    // Dibuja un rectángulo pequeño de tinta entre x: 20..26, y: 20..26 (7x7 píxeles)
    for (let y = 20; y <= 26; y++) {
      for (let x = 20; x <= 26; x++) {
        mask[y * size + x] = 1;
      }
    }

    // El usuario seleccionó descuidadamente una caja holgada de 30x30 desde (10, 10)
    const looseBox: BoundingBoxPx = { x: 10, y: 10, width: 30, height: 30 };
    const tightBox = tightenBoundingBox(mask, size, looseBox);

    // Debe ajustarse a x: 19..27, y: 19..27 (con margen de 1px)
    expect(tightBox.x).toBe(19);
    expect(tightBox.y).toBe(19);
    expect(tightBox.width).toBe(9); // 7 + 2px padding
    expect(tightBox.height).toBe(9);
  });

  it('debe descartar falsos positivos mediante aprendizaje activo con ejemplares negativos', () => {
    const width = 150;
    const height = 100;
    const binary = new Uint8Array(width * height);

    // 1. Dibuja dos bocas circulares legítimas (radio 4)
    const drawCircle = (cx: number, cy: number) => {
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d >= 2.5 && d <= 4.2) {
            binary[y * width + x] = 1;
          }
        }
      }
    };

    // 2. Dibuja un símbolo falso positivo (ej. un cuadrado o texto "X" con densidad similar)
    const drawSquareFalsePositive = (cx: number, cy: number) => {
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          if (x === cx - 4 || x === cx + 4 || y === cy - 4 || y === cy + 4) {
            binary[y * width + x] = 1;
          }
        }
      }
    };

    drawCircle(30, 30); // Boca 1 (Válida)
    drawCircle(80, 30); // Boca 2 (Válida)
    drawSquareFalsePositive(120, 30); // Falso positivo en (120, 30)

    const posExemplar = createPatternExemplar(binary, width, { x: 24, y: 24, width: 12, height: 12 }, false)!;
    expect(posExemplar).not.toBeNull();

    // Detección inicial sin negativos (puede capturar el cuadrado si el umbral es permisivo)
    const initialMatches = detectPatternMatchesWithExemplars(
      binary,
      width,
      height,
      [posExemplar],
      [],
      0.05,
      { x: 0, y: 0 },
      0.50
    );
    expect(initialMatches.length).toBeGreaterThanOrEqual(1);

    // El usuario descarta el match en x ≈ 120, creando un ejemplar negativo
    const negExemplar = createPatternExemplar(binary, width, { x: 114, y: 24, width: 12, height: 12 }, true)!;
    expect(negExemplar).not.toBeNull();

    // Detección con aprendizaje activo penalizando el negativo
    const refinedMatches = detectPatternMatchesWithExemplars(
      binary,
      width,
      height,
      [posExemplar],
      [negExemplar],
      0.05,
      { x: 0, y: 0 },
      0.50
    );

    // Solo deben quedar las dos bocas legítimas
    const centersX = refinedMatches.map((m) => Math.round(m.centerPx.x));
    expect(centersX).toContain(30);
    expect(centersX).toContain(80);
    expect(centersX).not.toContain(120); // El falso positivo fue completamente eliminado
  });

  it('debe detectar un símbolo que se encuentra físicamente conectado a una cañería/línea', () => {
    const width = 100;
    const height = 60;
    const binary = new Uint8Array(width * height);

    // Dibuja una boca en (30, 30)
    for (let x = 26; x <= 34; x++) {
      binary[30 * width + x] = 1;
    }
    for (let y = 26; y <= 34; y++) {
      binary[y * width + 30] = 1;
    }

    // Dibuja una línea de cañería que atraviesa la boca y sale hasta el borde
    for (let x = 0; x < 60; x++) {
      binary[30 * width + x] = 1;
    }

    const sampleBox: BoundingBoxPx = { x: 25, y: 25, width: 11, height: 11 };
    const matches = detectPatternMatches(
      binary,
      width,
      height,
      sampleBox,
      0.05,
      { x: 0, y: 0 },
      0.65
    );

    expect(matches.length).toBeGreaterThanOrEqual(1);
    const m = matches.find((match) => Math.abs(match.centerPx.x - 30) <= 2 && Math.abs(match.centerPx.y - 30) <= 2);
    expect(m).toBeDefined();
  });
});
