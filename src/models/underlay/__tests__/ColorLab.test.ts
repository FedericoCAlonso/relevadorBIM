import { describe, it, expect } from 'vitest';
import { rgbToLab, deltaE, extractDominantLabColor } from '../ColorLab';

describe('ColorLab - Conversión CIELAB y Métrica Perceptual Delta E', () => {
  it('debe convertir colores sRGB estándar a CIELAB con valores de referencia conocidos', () => {
    // Blanco puro: L* = 100, a* = 0, b* = 0
    const whiteLab = rgbToLab(255, 255, 255);
    expect(whiteLab[0]).toBeCloseTo(100, 1);
    expect(whiteLab[1]).toBeCloseTo(0, 1);
    expect(whiteLab[2]).toBeCloseTo(0, 1);

    // Negro puro: L* = 0, a* = 0, b* = 0
    const blackLab = rgbToLab(0, 0, 0);
    expect(blackLab[0]).toBeCloseTo(0, 1);
    expect(blackLab[1]).toBeCloseTo(0, 1);
    expect(blackLab[2]).toBeCloseTo(0, 1);

    // Rojo puro (255, 0, 0): L* ~ 53.2, a* ~ 80.1, b* ~ 67.2
    const redLab = rgbToLab(255, 0, 0);
    expect(redLab[0]).toBeGreaterThan(50);
    expect(redLab[1]).toBeGreaterThan(70); // Fuertemente positivo en canal a* (rojo)
    expect(redLab[2]).toBeGreaterThan(50); // Positivo en canal b* (amarillo)

    // Verde puro (0, 255, 0): a* debe ser fuertemente negativo (verde)
    const greenLab = rgbToLab(0, 255, 0);
    expect(greenLab[1]).toBeLessThan(-70);

    // Azul puro (0, 0, 255): b* debe ser fuertemente negativo (azul)
    const blueLab = rgbToLab(0, 0, 255);
    expect(blueLab[2]).toBeLessThan(-70);
  });

  it('debe calcular distancias perceptuales Delta E coherentes', () => {
    const red = rgbToLab(255, 0, 0);
    const darkRed = rgbToLab(200, 0, 0);
    const cyan = rgbToLab(0, 255, 255);

    const distSameColor = deltaE(red, darkRed);
    const distOppositeColor = deltaE(red, cyan);

    expect(distSameColor).toBeLessThan(distOppositeColor);
    expect(distOppositeColor).toBeGreaterThan(100); // Rojo vs Cian es oposición casi máxima
  });

  it('debe extraer el color dominante de tinta ignorando el fondo blanco', () => {
    const width = 10;
    const height = 10;
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    const binaryMask = new Uint8Array(width * height);

    // Rellenar todo con blanco (255, 255, 255, 255)
    for (let i = 0; i < width * height; i++) {
      rgbaData[i * 4] = 255;
      rgbaData[i * 4 + 1] = 255;
      rgbaData[i * 4 + 2] = 255;
      rgbaData[i * 4 + 3] = 255;
      binaryMask[i] = 0;
    }

    // Dibujar trazo rojo (255, 0, 0) en los píxeles centrales
    for (let y = 4; y <= 6; y++) {
      for (let x = 4; x <= 6; x++) {
        const idx = y * width + x;
        rgbaData[idx * 4] = 255;
        rgbaData[idx * 4 + 1] = 0;
        rgbaData[idx * 4 + 2] = 0;
        binaryMask[idx] = 1;
      }
    }

    const dominant = extractDominantLabColor(
      rgbaData,
      width,
      { x: 0, y: 0, width, height },
      binaryMask
    );

    expect(dominant).not.toBeNull();
    const pureRedLab = rgbToLab(255, 0, 0);
    expect(deltaE(dominant!, pureRedLab)).toBeCloseTo(0, 1);
  });
});
