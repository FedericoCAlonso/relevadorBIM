/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: GramSvd.test.ts
 * Pruebas unitarias para descomposición Gram-SVD, consenso por varianza
 * inversa, rotaciones de parches y snap magnético subpíxel.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  eigenDecompositionSymmetric,
  computeGramSvdConsensus,
  calculateWeightedCorrelation,
  rotateNormalizedPatch,
  magneticSubpixelSnap,
  findTemplateCorrelationSnap,
  calculateMultiRotationWeightedZNCC
} from '../GramSvd';
import { extractNormalizedPatch, type NormalizedPatch } from '../PatternDetector';

describe('GramSvd - Descomposición Espectral y Consenso Morfológico', () => {
  describe('eigenDecompositionSymmetric (Jacobi para matrices simétricas)', () => {
    it('debe diagonalizar una matriz 2x2 simétrica con autovalores exactos', () => {
      // Matriz [[2, 1], [1, 2]]
      // Autovalores teóricos: (2+2 +/- sqrt(0 + 4))/2 -> 3 y 1
      const A = [
        [2, 1],
        [1, 2]
      ];
      const { eigenvalues, eigenvectors } = eigenDecompositionSymmetric(A);

      expect(eigenvalues[0]).toBeCloseTo(3, 4);
      expect(eigenvalues[1]).toBeCloseTo(1, 4);

      // Los autovectores deben ser ortonormales
      const v1 = [eigenvectors[0][0], eigenvectors[1][0]];
      const v2 = [eigenvectors[0][1], eigenvectors[1][1]];

      const normV1 = Math.hypot(v1[0], v1[1]);
      const normV2 = Math.hypot(v2[0], v2[1]);
      const dot = v1[0] * v2[0] + v1[1] * v2[1];

      expect(normV1).toBeCloseTo(1, 4);
      expect(normV2).toBeCloseTo(1, 4);
      expect(dot).toBeCloseTo(0, 4);
    });

    it('debe resolver una matriz 3x3 simétrica', () => {
      const A = [
        [3, 0, 0],
        [0, 5, 0],
        [0, 0, 2]
      ];
      const { eigenvalues } = eigenDecompositionSymmetric(A);
      expect(eigenvalues[0]).toBeCloseTo(5, 4);
      expect(eigenvalues[1]).toBeCloseTo(3, 4);
      expect(eigenvalues[2]).toBeCloseTo(2, 4);
    });
  });

  describe('computeGramSvdConsensus', () => {
    const createTestPatch = (drawFn: (x: number, y: number) => number, size = 24): NormalizedPatch => {
      const data = new Float32Array(size * size);
      let sum = 0;
      let sumSq = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const val = drawFn(x, y);
          const idx = y * size + x;
          data[idx] = val;
          sum += val;
          sumSq += val * val;
        }
      }
      const n = size * size;
      const mean = sum / n;
      const std = Math.sqrt(Math.max(1e-7, sumSq / n - mean * mean));
      return { size, data, mean, std };
    };

    it('debe dar pureza 1.0 para 2 muestras idénticas', () => {
      // Dibujar un círculo centrado
      const circlePatch = createTestPatch((x, y) => {
        const d = Math.hypot(x - 12, y - 12);
        return d >= 5 && d <= 7 ? 1 : 0;
      });

      const consensus = computeGramSvdConsensus([circlePatch, circlePatch]);
      expect(consensus).not.toBeNull();
      expect(consensus!.purityRatio).toBeCloseTo(1.0, 2);
      expect(consensus!.singularValues[0]).toBeGreaterThan(0);
      expect(consensus!.singularValues[1]).toBeCloseTo(0, 4);

      // Todos los pesos de confianza deben ser 1.0 porque la varianza entre muestras es 0
      for (let i = 0; i < consensus!.confidenceWeights.length; i++) {
        expect(consensus!.confidenceWeights[i]).toBeCloseTo(1.0, 3);
      }
    });

    it('debe filtrar cañerías cruzadas y asignar bajo peso a las zonas de ruido', () => {
      // Muestra 1: Círculo (símbolo) + Línea horizontal en y=12 (cañería 1)
      const patchWithHoriz = createTestPatch((x, y) => {
        const isCircle = Math.hypot(x - 12, y - 12) <= 4;
        const isHorizLine = y === 12 && (x < 5 || x > 19);
        return isCircle || isHorizLine ? 1 : 0;
      });

      // Muestra 2: Círculo (símbolo) + Línea vertical en x=12 (cañería 2)
      const patchWithVert = createTestPatch((x, y) => {
        const isCircle = Math.hypot(x - 12, y - 12) <= 4;
        const isVertLine = x === 12 && (y < 5 || y > 19);
        return isCircle || isVertLine ? 1 : 0;
      });

      const consensus = computeGramSvdConsensus([patchWithHoriz, patchWithVert]);
      expect(consensus).not.toBeNull();

      // La varianza principal sigma1 domina fuertemente sobre sigma2
      expect(consensus!.singularValues[0]).toBeGreaterThan(consensus!.singularValues[1]);
      expect(consensus!.purityRatio).toBeGreaterThan(0.70);

      // En el centro del círculo (donde ambas muestras coinciden), el peso de confianza debe ser ~1.0
      const centerIdx = 12 * 24 + 12;
      expect(consensus!.confidenceWeights[centerIdx]).toBeGreaterThan(0.95);

      // En el extremo de la línea horizontal (x=2, y=12), solo la muestra 1 tenía tinta
      const noiseIdx = 12 * 24 + 2;
      // El peso de confianza debe ser notablemente inferior
      expect(consensus!.confidenceWeights[noiseIdx]).toBeLessThan(0.30);
    });
  });

  describe('rotateNormalizedPatch', () => {
    it('debe rotar parches en 90°, 180°, 270° y volver a la identidad a los 360°', () => {
      const size = 10;
      const idx = (r: number, c: number) => r * size + c;
      const data = new Float32Array(size * size);
      // Poner un píxel en esquina superior derecha: (9, 0)
      data[idx(0, 9)] = 1.0;

      const p0: NormalizedPatch = { size, data, mean: 0.1, std: 0.3 };

      // 90° horario: (9, 0) -> (9, 9) (esquina inferior derecha)
      const p90 = rotateNormalizedPatch(p0, 90);
      expect(p90.data[idx(9, 9)]).toBe(1.0);

      // 180°: (9, 0) -> (0, 9) (esquina inferior izquierda)
      const p180 = rotateNormalizedPatch(p0, 180);
      expect(p180.data[idx(9, 0)]).toBe(1.0);

      // 270°: (9, 0) -> (0, 0) (esquina superior izquierda)
      const p270 = rotateNormalizedPatch(p0, 270);
      expect(p270.data[idx(0, 0)]).toBe(1.0);

      // 4 rotaciones de 90° consecutivas
      const p360 = rotateNormalizedPatch(rotateNormalizedPatch(rotateNormalizedPatch(p90, 90), 90), 90);
      expect(p360.data[idx(0, 9)]).toBe(1.0);
    });
  });

  describe('magneticSubpixelSnap', () => {
    it('debe auto-centrar el recuadro cuando el usuario hace clic con un desfase de 3 píxeles', () => {
      const imgWidth = 60;
      const imgHeight = 60;
      const mask = new Uint8Array(imgWidth * imgHeight);

      // Dibujar un círculo relleno de radio 5 centrado en (30, 30)
      for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
          if (Math.hypot(x - 30, y - 30) <= 5) {
            mask[y * imgWidth + x] = 1;
          }
        }
      }

      // Parche de referencia centrado exactamente en el círculo en (30, 30)
      const refPatch = extractNormalizedPatch(mask, imgWidth, {
        x: 23,
        y: 23,
        width: 14,
        height: 14
      }, 24);

      // Simular que el usuario hace clic en (33, 28) - 3 píxeles a la derecha, 2 arriba
      const userClickCenter = { x: 33, y: 28 };
      const snapped = magneticSubpixelSnap(
        mask,
        imgWidth,
        imgHeight,
        userClickCenter,
        14,
        14,
        refPatch,
        0,
        4
      );

      // El micro-snap debe corregir la posición exactamente al centroide (30, 30)
      expect(snapped.centerPx.x).toBe(30);
      expect(snapped.centerPx.y).toBe(30);
      expect(snapped.bestScore).toBeGreaterThan(0.90);
    });
  });

  describe('calculateWeightedCorrelation', () => {
    it('debe ignorar discrepancias en píxeles donde el peso es cero', () => {
      const size = 10;
      const d = size * size;
      const dataA = new Float32Array(d).fill(0);
      const dataB = new Float32Array(d).fill(0);
      const weights = new Float32Array(d).fill(1.0);

      // Símbolo base en común: píxeles 0..9 con valor 1.0
      for (let i = 0; i < 10; i++) {
        dataA[i] = 1.0;
        dataB[i] = 1.0;
      }

      // Ruido: en dataB hay valores espurios en los píxeles 50..55
      for (let i = 50; i < 55; i++) {
        dataB[i] = 1.0;
      }

      const patchA: NormalizedPatch = { size, data: dataA, mean: 0.1, std: 0.3 };
      const patchB: NormalizedPatch = { size, data: dataB, mean: 0.15, std: 0.35 };

      // Con pesos uniformes, el ruido degrada la correlación
      const scoreUnweighted = calculateWeightedCorrelation(patchA, patchB, weights);

      // Si la máscara de confianza pone peso 0 en la zona de ruido (50..55):
      for (let i = 50; i < 55; i++) {
        weights[i] = 0.0;
      }
      const scoreWeighted = calculateWeightedCorrelation(patchA, patchB, weights);

      expect(scoreWeighted).toBeGreaterThan(scoreUnweighted);
      expect(scoreWeighted).toBeCloseTo(1.0, 2);
    });

    it('debe detectar un símbolo rotado usando calculateMultiRotationWeightedZNCC con máscara de confianza', () => {
      const size = 12;
      const d = size * size;
      const dataA = new Float32Array(d).fill(0);
      const dataB = new Float32Array(d).fill(0);
      const weights = new Float32Array(d).fill(1.0);

      // Símbolo asimétrico en A (L-shape): línea vertical en x=2 y horizontal en y=2
      for (let y = 2; y <= 6; y++) dataA[y * size + 2] = 1.0;
      for (let x = 2; x <= 6; x++) dataA[2 * size + x] = 1.0;

      // En B el mismo símbolo pero rotado 90° horario
      // (x, y) -> (n - 1 - y, x). Con n=12:
      // x=2, y=2..6 -> dstX = 12 - 1 - y = 9..5, dstY = 2 (horizontal)
      // y=2, x=2..6 -> dstX = 12 - 1 - 2 = 9, dstY = 2..6 (vertical)
      for (let y = 2; y <= 6; y++) {
        const dstX = size - 1 - y;
        const dstY = 2;
        dataB[dstY * size + dstX] = 1.0;
      }
      for (let x = 2; x <= 6; x++) {
        const dstX = size - 1 - 2;
        const dstY = x;
        dataB[dstY * size + dstX] = 1.0;
      }

      const patchA: NormalizedPatch = { size, data: dataA, mean: 0.1, std: 0.3 };
      const patchB: NormalizedPatch = { size, data: dataB, mean: 0.1, std: 0.3 };

      const score = calculateWeightedCorrelation(patchA, patchB, weights);
      // Sin rotación, la correlación es baja
      expect(score).toBeLessThan(0.60);

      // Con multi-rotación, detecta la orientación a 90° y da correlación alta (~1.0)
      const multiScore = calculateMultiRotationWeightedZNCC(patchB, patchA, weights);
      expect(multiScore).toBeGreaterThan(0.95);
    });
  });

  describe('findTemplateCorrelationSnap (Shape-Aware Template Snap)', () => {
    it('debe acoplarse con precisión milimétrica al símbolo y ser inmune a muros gruesos adyacentes', () => {
      const width = 100;
      const height = 100;
      const binary = new Uint8Array(width * height);

      // 1. Muro grueso continuo de 8px de espesor en x: 10..17 (masa de tinta enorme)
      for (let y = 0; y < height; y++) {
        for (let x = 10; x <= 17; x++) {
          binary[y * width + x] = 1;
        }
      }

      // 2. Símbolo técnico de boca (cruz circular) en (40, 40)
      for (let y = 34; y <= 46; y++) binary[y * width + 40] = 1;
      for (let x = 34; x <= 46; x++) binary[40 * width + x] = 1;

      // Extraer plantilla de referencia del símbolo en (40, 40)
      const templateBox = { x: 32, y: 32, width: 16, height: 16 };
      const refPatch = extractNormalizedPatch(binary, width, templateBox, 24);

      // El usuario pasa el cursor a 6 px de distancia del símbolo: (46, 42)
      const nearSymbol = { x: 46, y: 42 };
      const snapResult = findTemplateCorrelationSnap(
        binary,
        width,
        height,
        nearSymbol,
        { width: 16, height: 16 },
        refPatch,
        0,
        16,
        0.35
      );

      expect(snapResult.isSnapped).toBe(true);
      expect(snapResult.snappedCenterPx.x).toBeCloseTo(40, 0);
      expect(snapResult.snappedCenterPx.y).toBeCloseTo(40, 0);
      expect(snapResult.score).toBeGreaterThan(0.70);

      // El usuario pasa el cursor sobre el muro grueso (x: 14, y: 40):
      // A diferencia del Mean-Shift que saltaría al muro, la correlación de forma da bajo puntaje
      // y NO activa el snap, manteniendo la posición del cursor.
      const onWall = { x: 14, y: 40 };
      const wallSnapResult = findTemplateCorrelationSnap(
        binary,
        width,
        height,
        onWall,
        { width: 16, height: 16 },
        refPatch,
        0,
        16,
        0.35
      );

      expect(wallSnapResult.isSnapped).toBe(false);
      expect(wallSnapResult.snappedCenterPx.x).toBe(14);
      expect(wallSnapResult.snappedCenterPx.y).toBe(40);
    });

    it('debe detectar y acoplar símbolos rotados a 90° con allowMultiRotation activo', () => {
      const width = 80;
      const height = 80;
      const binary = new Uint8Array(width * height);

      // Símbolo asimétrico vertical (ej. una "L"): en (20, 20)
      // Segmento vertical largo y base corta horizontal hacia la derecha
      for (let y = 15; y <= 25; y++) binary[y * width + 20] = 1;
      for (let x = 20; x <= 24; x++) binary[25 * width + x] = 1;

      // Extraer plantilla upright (0°)
      const templateBox = { x: 14, y: 14, width: 14, height: 14 };
      const refPatch = extractNormalizedPatch(binary, width, templateBox, 16);

      // En (50, 50), dibujar el mismo símbolo rotado 90° horario:
      // (dx, dy) -> (-dy, dx). El segmento vertical largo pasa a horizontal inferior
      for (let x = 45; x <= 55; x++) binary[50 * width + x] = 1;
      for (let y = 50; y <= 54; y++) binary[y * width + 45] = 1;

      // Buscar snap con allowMultiRotation = true
      const nearPos = { x: 53, y: 48 };
      const result = findTemplateCorrelationSnap(
        binary,
        width,
        height,
        nearPos,
        { width: 14, height: 14 },
        refPatch,
        0,
        12,
        0.40,
        true
      );

      expect(result.isSnapped).toBe(true);
      expect(Math.abs(result.snappedCenterPx.x - 50)).toBeLessThanOrEqual(2);
      expect(Math.abs(result.snappedCenterPx.y - 50)).toBeLessThanOrEqual(2);
      expect(result.snappedRotationDeg).toBe(90);
    });
  });

  describe('Gram-SVD Multicanal Cromático (Tensor RGB en R^(3d))', () => {
    const createColorPatch = (
      size: number,
      rgbFn: (x: number, y: number) => [number, number, number]
    ): NormalizedPatch => {
      const n = size * size;
      const data = new Float32Array(n);
      const r = new Float32Array(n);
      const g = new Float32Array(n);
      const b = new Float32Array(n);

      let sum = 0;
      let sumSq = 0;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = y * size + x;
          const [cr, cg, cb] = rgbFn(x, y);
          // cr, cg, cb: densidades de absorción de tinta entre 0.0 y 1.0
          r[idx] = cr;
          g[idx] = cg;
          b[idx] = cb;
          const composite = Math.max(cr, cg, cb);
          data[idx] = composite;
          sum += composite;
          sumSq += composite * composite;
        }
      }

      const mean = sum / n;
      const std = Math.sqrt(Math.max(1e-7, sumSq / n - mean * mean));

      return {
        size,
        data,
        mean,
        std,
        colorChannels: { r, g, b }
      };
    };

    it('debe descomponer muestras en color y conservar el autosímbolo cromático en el consenso', () => {
      // Muestra 1 y 2: Símbolo circular rojo puro (r: 1, g: 0, b: 0 de absorción -> cian/magenta absorbe)
      const patch1 = createColorPatch(24, (x, y) => {
        const d = Math.hypot(x - 12, y - 12);
        return d <= 5 ? [1.0, 0.0, 0.0] : [0.0, 0.0, 0.0];
      });

      const patch2 = createColorPatch(24, (x, y) => {
        const d = Math.hypot(x - 12, y - 12);
        return d <= 5 ? [1.0, 0.0, 0.0] : [0.0, 0.0, 0.0];
      });

      const consensus = computeGramSvdConsensus([patch1, patch2]);
      expect(consensus).not.toBeNull();
      expect(consensus!.purityRatio).toBeCloseTo(1.0, 2);
      expect(consensus!.consensusPatch.colorChannels).toBeDefined();

      const cChannels = consensus!.consensusPatch.colorChannels!;
      // En el centro (12, 12), el canal R debe ser dominante y los canales G/B nulos
      const centerIdx = 12 * 24 + 12;
      expect(cChannels.r[centerIdx]).toBeGreaterThan(0.8);
      expect(cChannels.g[centerIdx]).toBeCloseTo(0, 2);
      expect(cChannels.b[centerIdx]).toBeCloseTo(0, 2);
    });

    it('debe discriminar símbolos de igual forma geométrica pero diferente color mediante correlación multicanal', () => {
      // Símbolo A: círculo rojo [1, 0, 0]
      const redCircle = createColorPatch(24, (x, y) => {
        const d = Math.hypot(x - 12, y - 12);
        return d <= 5 ? [1.0, 0.0, 0.0] : [0.0, 0.0, 0.0];
      });

      // Símbolo B: idéntico círculo pero azul [0, 0, 1]
      const blueCircle = createColorPatch(24, (x, y) => {
        const d = Math.hypot(x - 12, y - 12);
        return d <= 5 ? [0.0, 0.0, 1.0] : [0.0, 0.0, 0.0];
      });

      // Símbolo C: segundo círculo rojo idéntico
      const redCircle2 = createColorPatch(24, (x, y) => {
        const d = Math.hypot(x - 12, y - 12);
        return d <= 5 ? [1.0, 0.0, 0.0] : [0.0, 0.0, 0.0];
      });

      const weights = new Float32Array(24 * 24).fill(1.0);

      const scoreRedWithRed = calculateWeightedCorrelation(redCircle, redCircle2, weights);
      const scoreRedWithBlue = calculateWeightedCorrelation(redCircle, blueCircle, weights);

      // Los dos símbolos rojos deben correlacionar perfectamente (~1.0)
      expect(scoreRedWithRed).toBeCloseTo(1.0, 2);
      // El círculo rojo contra el círculo azul ortogonal en el espacio cromático debe dar correlación fuertemente penalizada
      expect(scoreRedWithBlue).toBeLessThan(scoreRedWithRed - 0.50);
    });

    it('debe aislar y enviar a cero las perturbaciones de caños de color ajeno presentes en solo una muestra', () => {
      // Símbolo base: boca verde [0, 1, 0]
      const baseFn = (x: number, y: number) => {
        const d = Math.hypot(x - 12, y - 12);
        return d <= 4 ? [0.0, 1.0, 0.0] : [0.0, 0.0, 0.0];
      };

      // Muestra 1: boca verde + una cañería azul cruzando horizontalmente
      const patch1 = createColorPatch(24, (x, y) => {
        if (y >= 11 && y <= 13 && (x < 6 || x > 18)) {
          return [0.0, 0.0, 1.0]; // cañería azul
        }
        return baseFn(x, y) as [number, number, number];
      });

      // Muestra 2: boca verde limpia
      const patch2 = createColorPatch(24, (x, y) => {
        return baseFn(x, y) as [number, number, number];
      });

      const consensus = computeGramSvdConsensus([patch1, patch2]);
      expect(consensus).not.toBeNull();

      // En la zona de la cañería azul (ej. x: 3, y: 12), la varianza es alta -> el peso W debe atenuarse fuertemente
      const pipeIdx = 12 * 24 + 3;
      const centerIdx = 12 * 24 + 12;

      expect(consensus!.confidenceWeights[pipeIdx]).toBeLessThan(consensus!.confidenceWeights[centerIdx]);
      expect(consensus!.confidenceWeights[pipeIdx]).toBeLessThan(0.70);
      expect(consensus!.confidenceWeights[centerIdx]).toBeGreaterThan(0.95);
    });
  });
});
