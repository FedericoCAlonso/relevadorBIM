/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: PatternDetectorAssistedSnap.test.ts
 * Verificación de auto-muestreo asistido en 1er clic (Smart Assisted Placement),
 * persistencia multi-stamp y conmutación de snap magnético ON/OFF.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import {
  findTemplateCorrelationSnap
} from '../../models/underlay/GramSvd';
import {
  extractNormalizedPatch,
  calculateImageMoments
} from '../../models/underlay/PatternDetector';

describe('Auto-muestreo Asistido y Snap Magnético (Smart Assisted Placement)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe centrar el encuadre de la plantilla en el centroide de tinta de la primera boca', () => {
    const width = 100;
    const height = 100;
    const binary = new Uint8Array(width * height);

    // Dibujar un símbolo de boca en (30, 30) de tamaño 10x10
    for (let y = 25; y <= 35; y++) {
      for (let x = 25; x <= 35; x++) {
        if (Math.hypot(x - 30, y - 30) <= 4) {
          binary[y * width + x] = 1;
        }
      }
    }

    // Supongamos que el usuario hace clic ligeramente desplazado en (32, 29)
    const userClickPx = { x: 32, y: 29 };
    const boxSizePx = 16;
    const roughBox = {
      x: Math.round(userClickPx.x - boxSizePx / 2),
      y: Math.round(userClickPx.y - boxSizePx / 2),
      width: boxSizePx,
      height: boxSizePx
    };

    const moments = calculateImageMoments(binary, width, roughBox);
    expect(moments).not.toBeNull();
    expect(moments!.m00).toBeGreaterThan(4);
    // El centroide calculado por momentos debe auto-alinear exactamente al centroide de tinta (30, 30)
    expect(moments!.m10 / moments!.m00).toBeCloseTo(30, 0);
    expect(moments!.m01 / moments!.m00).toBeCloseTo(30, 0);
  });

  it('debe guiar magnéticamente inserciones subsiguientes hacia otros símbolos coincidentes', () => {
    const width = 120;
    const height = 120;
    const binary = new Uint8Array(width * height);

    // Boca #1 en (25, 25)
    for (let y = 20; y <= 30; y++) binary[y * width + 25] = 1;
    for (let x = 20; x <= 30; x++) binary[25 * width + x] = 1;

    // Boca #2 en (75, 25) (misma orientación 0°)
    for (let y = 20; y <= 30; y++) binary[y * width + 75] = 1;
    for (let x = 70; x <= 80; x++) binary[25 * width + x] = 1;

    // Boca #3 en (25, 75) rotada a 90°
    for (let x = 20; x <= 30; x++) binary[75 * width + x] = 1;
    for (let y = 70; y <= 80; y++) binary[y * width + 25] = 1;

    // 1. Extraer plantilla de la Boca #1
    const templatePatch = extractNormalizedPatch(binary, width, { x: 17, y: 17, width: 16, height: 16 }, 24);

    // 2. Probar cursor cercano a Boca #2 (ej. en 78, 27)
    const cursorNearBoca2 = { x: 78, y: 27 };
    const snapResult2 = findTemplateCorrelationSnap(
      binary,
      width,
      height,
      cursorNearBoca2,
      { width: 16, height: 16 },
      templatePatch,
      0,
      12,
      0.45,
      true
    );

    expect(snapResult2.isSnapped).toBe(true);
    expect(snapResult2.snappedCenterPx.x).toBeCloseTo(75, 0);
    expect(snapResult2.snappedCenterPx.y).toBeCloseTo(25, 0);
    expect(snapResult2.snappedRotationDeg).toBe(0);

    // 3. Probar cursor cercano a Boca #3 rotada a 90° (ej. en 23, 73)
    const cursorNearBoca3 = { x: 23, y: 73 };
    const snapResult3 = findTemplateCorrelationSnap(
      binary,
      width,
      height,
      cursorNearBoca3,
      { width: 16, height: 16 },
      templatePatch,
      0,
      12,
      0.45,
      true
    );

    expect(snapResult3.isSnapped).toBe(true);
    expect(snapResult3.snappedCenterPx.x).toBeCloseTo(25, 0);
    expect(snapResult3.snappedCenterPx.y).toBeCloseTo(75, 0);
  });

  it('no debe aplicar snap magnético en paredes vacías o áreas sin símbolo', () => {
    const width = 100;
    const height = 100;
    const binary = new Uint8Array(width * height);

    // 1. Símbolo circular en (20, 20)
    for (let y = 15; y <= 25; y++) {
      for (let x = 15; x <= 25; x++) {
        if (Math.hypot(x - 20, y - 20) <= 4) {
          binary[y * width + x] = 1;
        }
      }
    }

    // 2. Muro liso continuo distante en x: 60..62
    for (let y = 0; y < height; y++) {
      binary[y * width + 60] = 1;
      binary[y * width + 61] = 1;
    }

    // Plantilla de la boca circular
    const templatePatch = extractNormalizedPatch(binary, width, { x: 12, y: 12, width: 16, height: 16 }, 24);

    // Cursor sobre pared en (60, 80)
    const onPlainWall = { x: 60, y: 80 };
    const snapResult = findTemplateCorrelationSnap(
      binary,
      width,
      height,
      onPlainWall,
      { width: 16, height: 16 },
      templatePatch,
      0,
      12,
      0.45,
      true
    );

    // Debe mantener fielmente la posición del cursor sin forzar falsos acoples
    expect(snapResult.isSnapped).toBe(false);
    expect(snapResult.snappedCenterPx.x).toBe(60);
    expect(snapResult.snappedCenterPx.y).toBe(80);
  });

  describe('Automuestreo con 1 Clic en Detección de Patrones', () => {
    it('debe auto-centrar el recuadro sobre el baricentro exacto de la tinta ante un clic descentrado', () => {
      const width = 100;
      const height = 100;
      const binary = new Uint8Array(width * height);

      // Símbolo en (60, 40)
      for (let y = 35; y <= 45; y++) {
        for (let x = 55; x <= 65; x++) {
          if (Math.hypot(x - 60, y - 40) <= 4) {
            binary[y * width + x] = 1;
          }
        }
      }

      // Clic del usuario en (63, 38)
      const userClickPx = { x: 63, y: 38 };
      const boxSizePx = 20;
      const roughBox = {
        x: Math.round(userClickPx.x - boxSizePx / 2),
        y: Math.round(userClickPx.y - boxSizePx / 2),
        width: boxSizePx,
        height: boxSizePx
      };

      const moments = calculateImageMoments(binary, width, roughBox);
      expect(moments.m00).toBeGreaterThan(4);
      const autoCx = Math.round(moments.m10 / moments.m00);
      const autoCy = Math.round(moments.m01 / moments.m00);

      expect(autoCx).toBe(60);
      expect(autoCy).toBe(40);

      const centeredBox = {
        x: Math.round(autoCx - boxSizePx / 2),
        y: Math.round(autoCy - boxSizePx / 2),
        width: boxSizePx,
        height: boxSizePx
      };

      // Simular búfer RGBA para verificar extracción cromática
      const rgba = new Uint8ClampedArray(width * height * 4);
      // Fondo blanco (255, 255, 255, 255)
      rgba.fill(255);
      // Tinta roja (255, 0, 0, 255) en los píxeles del símbolo
      for (let y = 35; y <= 45; y++) {
        for (let x = 55; x <= 65; x++) {
          if (Math.hypot(x - 60, y - 40) <= 4) {
            const idx = (y * width + x) * 4;
            rgba[idx] = 255;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = 255;
          }
        }
      }

      const patch = extractNormalizedPatch(binary, width, centeredBox, 24, rgba);
      expect(patch.colorChannels).toBeDefined();
      expect(patch.colorChannels!.r).toBeDefined();
      expect(patch.colorChannels!.g).toBeDefined();
      expect(patch.colorChannels!.b).toBeDefined();

      // En el centro del parche, los canales G y B deben tener alta absorción (tinta roja)
      const patchCenterIdx = 12 * 24 + 12;
      expect(patch.colorChannels!.g[patchCenterIdx]).toBeCloseTo(1.0, 1);
      expect(patch.colorChannels!.b[patchCenterIdx]).toBeCloseTo(1.0, 1);
      expect(patch.colorChannels!.r[patchCenterIdx]).toBeCloseTo(0.0, 1);
    });
  });
});
