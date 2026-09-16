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
});
