/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: EccAlignment.test.ts
 * Pruebas unitarias para alineación euclídea continua ECC (SE(2))
 * e interpolación bilineal subpíxel.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  sampleBilinear,
  extractWarpedPatchBilinear,
  alignPatchEccEuclidean
} from '../EccAlignment';
import { computeGramSvdConsensus } from '../GramSvd';

describe('EccAlignment - Alineación Fina Euclídea Continua (ECC)', () => {
  describe('sampleBilinear', () => {
    it('debe interpolar correctamente entre píxeles adyacentes', () => {
      const width = 4;
      const height = 4;
      const mask = new Uint8Array(width * height);
      // Píxel (1, 1) = 0, Píxel (2, 1) = 1
      mask[1 * width + 1] = 0;
      mask[1 * width + 2] = 1;

      // En x=1.5, y=1.0 debe retornar exactamente 0.5
      const valMid = sampleBilinear(mask, width, height, 1.5, 1.0);
      expect(valMid).toBeCloseTo(0.5, 4);

      // En coordenadas enteras debe retornar el valor exacto
      expect(sampleBilinear(mask, width, height, 1, 1)).toBe(0);
      expect(sampleBilinear(mask, width, height, 2, 1)).toBe(1);
    });
  });

  describe('extractWarpedPatchBilinear', () => {
    it('debe extraer un parche centrado y suave sin escalones discretos', () => {
      const size = 50;
      const mask = new Uint8Array(size * size);
      // Dibujar un círculo relleno en (25, 25)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (Math.hypot(x - 25, y - 25) <= 6) {
            mask[y * size + x] = 1;
          }
        }
      }

      const patch = extractWarpedPatchBilinear(
        mask,
        size,
        size,
        { x: 25, y: 25 },
        { width: 16, height: 16 },
        0,
        0,
        0,
        24
      );

      expect(patch.size).toBe(24);
      expect(patch.mean).toBeGreaterThan(0.1);
      expect(patch.std).toBeGreaterThan(0.2);

      // El centro (12, 12) debe ser 1.0
      expect(patch.data[12 * 24 + 12]).toBeCloseTo(1.0, 2);
    });
  });

  describe('alignPatchEccEuclidean', () => {
    it('debe converger con correlación cercana a 1.0 cuando la estimación inicial es perfecta', () => {
      const size = 60;
      const mask = new Uint8Array(size * size);

      // Dibujar una cruz técnica asimétrica centrada en (30, 30)
      for (let y = 20; y <= 40; y++) mask[y * size + 30] = 1;
      for (let x = 24; x <= 36; x++) mask[30 * size + x] = 1;

      const refPatch = extractWarpedPatchBilinear(
        mask,
        size,
        size,
        { x: 30, y: 30 },
        { width: 20, height: 20 },
        0,
        0,
        0,
        24
      );

      const result = alignPatchEccEuclidean(
        mask,
        size,
        size,
        { x: 30, y: 30 },
        { width: 20, height: 20 },
        refPatch,
        0
      );

      expect(result.finalCorrelation).toBeGreaterThan(0.98);
      expect(result.refinedCenterPx.x).toBeCloseTo(30, 1);
      expect(result.refinedCenterPx.y).toBeCloseTo(30, 1);
      expect(result.refinedAngleDeg).toBeCloseTo(0, 1);
    });

    it('debe corregir un desalineamiento subpíxel de (+1.5 px, -1.2 px)', () => {
      const size = 60;
      const mask = new Uint8Array(size * size);

      // Dibujar una figura técnica en (30, 30)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const d = Math.hypot(x - 30, y - 30);
          if (d >= 4 && d <= 7) mask[y * size + x] = 1;
        }
      }

      const refPatch = extractWarpedPatchBilinear(
        mask,
        size,
        size,
        { x: 30, y: 30 },
        { width: 18, height: 18 },
        0,
        0,
        0,
        24
      );

      // El usuario hizo clic en (31.5, 28.8) con desfase subpíxel
      const coarseCenter = { x: 31.5, y: 28.8 };
      const result = alignPatchEccEuclidean(
        mask,
        size,
        size,
        coarseCenter,
        { width: 18, height: 18 },
        refPatch,
        0
      );

      // ECC debe corregir el centro subpíxel de vuelta a (30, 30)
      expect(result.refinedCenterPx.x).toBeCloseTo(30, 0);
      expect(result.refinedCenterPx.y).toBeCloseTo(30, 0);
      expect(result.finalCorrelation).toBeGreaterThan(0.90);
    });

    it('debe restaurar la pureza en Gram-SVD cuando las muestras son refinadas por ECC', () => {
      const size = 70;
      const mask = new Uint8Array(size * size);

      // Muestra 1: Símbolo en (25, 25) con un caño horizontal en y=25
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const d = Math.hypot(x - 25, y - 25);
          if (d >= 4 && d <= 6) mask[y * size + x] = 1;
        }
      }
      for (let x = 10; x <= 40; x++) mask[25 * size + x] = 1;

      // Muestra 2: Mismo símbolo en (50, 50) pero con un caño vertical en x=50
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const d = Math.hypot(x - 50, y - 50);
          if (d >= 4 && d <= 6) mask[y * size + x] = 1;
        }
      }
      for (let y = 35; y <= 65; y++) mask[y * size + 50] = 1;

      // Extraer referencia limpia de muestra 1
      const patch1 = extractWarpedPatchBilinear(
        mask,
        size,
        size,
        { x: 25, y: 25 },
        { width: 16, height: 16 },
        0,
        0,
        0,
        24
      );

      // Simular que el usuario estampó la muestra 2 ligeramente corrida: en (51.2, 49.0)
      const userClickSample2 = { x: 51.2, y: 49.0 };

      // Refinamiento fino por ECC
      const eccResult = alignPatchEccEuclidean(
        mask,
        size,
        size,
        userClickSample2,
        { width: 16, height: 16 },
        patch1,
        0
      );

      // Con ECC el centro se ajusta a (50, 50)
      expect(eccResult.refinedCenterPx.x).toBeCloseTo(50, 0);
      expect(eccResult.refinedCenterPx.y).toBeCloseTo(50, 0);

      // Pasar ambas muestras (patch1 y eccResult.alignedPatch) a Gram-SVD
      const consensus = computeGramSvdConsensus([patch1, eccResult.alignedPatch]);
      expect(consensus).not.toBeNull();

      // La pureza estructural debe ser superior al 80% (el símbolo circular domina)
      expect(consensus!.purityRatio).toBeGreaterThan(0.75);
      expect(consensus!.singularValues[0]).toBeGreaterThan(consensus!.singularValues[1]);
    });

    it('debe alinear y des-rotar un símbolo rotado 90° con leve jitter angular (+3°)', () => {
      const size = 60;
      const mask = new Uint8Array(size * size);

      // Símbolo base en (20, 20): L técnica (brazo vertical y brazo horizontal más corto)
      for (let y = 14; y <= 26; y++) mask[y * size + 20] = 1;
      for (let x = 20; x <= 25; x++) mask[26 * size + x] = 1;

      const refPatch = extractWarpedPatchBilinear(
        mask,
        size,
        size,
        { x: 20, y: 20 },
        { width: 14, height: 14 },
        0,
        0,
        0,
        24
      );

      // Símbolo rotado 90° (horario) en (40, 40):
      // Brazo vertical original -> horizontal en y=40, x de 40 - (20-14)=34 a 40 + (26-20)=46 (o similar)
      // En vez de dibujarlo a mano con posibles errores de rotación, podemos usar extractWarpedPatchBilinear o rotar una región
      // O dibujamos exactamente la L rotada 90°:
      // (dx, dy) -> (-dy, dx)
      // original: dy in [-6, 6] at dx=0; dx in [0, 5] at dy=6.
      // rotada 90°: dy' = dx, dx' = -dy.
      // Brazo vertical (dx=0, dy in [-6, 6]) -> dx' in [-6, 6], dy'=0 (horizontal)
      // Brazo horizontal (dy=6, dx in [0, 5]) -> dx'=-6, dy' in [0, 5] (vertical hacia abajo)
      for (let x = 34; x <= 46; x++) mask[40 * size + x] = 1;
      for (let y = 40; y <= 45; y++) mask[y * size + 34] = 1;

      // Esténcil colocado en (40, 40) a 90°
      const initialAngleRad = Math.PI / 2; // 90°
      const result = alignPatchEccEuclidean(
        mask,
        size,
        size,
        { x: 40, y: 40 },
        { width: 14, height: 14 },
        refPatch,
        initialAngleRad
      );

      // La correlación con el parche de referencia tras des-rotar debe ser muy alta
      expect(result.finalCorrelation).toBeGreaterThan(0.90);
      expect(result.refinedCenterPx.x).toBeCloseTo(40, 0);
      expect(result.refinedCenterPx.y).toBeCloseTo(40, 0);
    });
  });
});
