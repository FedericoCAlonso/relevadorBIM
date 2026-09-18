/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: ColorLab.ts (Patrón Estricto MVVM)
 * Funciones puras de conversión cromática sRGB -> CIELAB y métrica perceptual Delta E (CIE76).
 * Permite filtrado temprano rápido de candidatos y catalogación de tintas CAD.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BoundingBoxPx } from './PatternDetector';

export type LabColor = [number, number, number]; // [L*, a*, b*]

/**
 * Convierte un canal sRGB normalizado [0, 1] a luminancia lineal (curva gamma sRGB)
 */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Función no lineal para el espacio CIE 1931 XYZ -> CIELAB
 */
function fLab(t: number): number {
  return t > 0.00885645167 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116;
}

/**
 * Convierte valores sRGB [0..255] al espacio perceptualmente uniforme CIELAB (D65 illuminant, 2° observer).
 * L* in [0, 100], a* in [-128, 127], b* in [-128, 127].
 */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const linR = srgbToLinear(Math.max(0, Math.min(255, r)) / 255);
  const linG = srgbToLinear(Math.max(0, Math.min(255, g)) / 255);
  const linB = srgbToLinear(Math.max(0, Math.min(255, b)) / 255);

  // Matriz de transformación sRGB a CIE XYZ (D65) normalizada con Xn=0.95047, Yn=1.00000, Zn=1.08883
  const x = (linR * 0.4124564 + linG * 0.3575761 + linB * 0.1804375) / 0.95047;
  const y = (linR * 0.2126729 + linG * 0.7151522 + linB * 0.072175) / 1.0;
  const z = (linR * 0.0193339 + linG * 0.119192 + linB * 0.9503041) / 1.08883;

  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);

  const L = Math.max(0, Math.min(100, 116 * fy - 16));
  const aVal = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [Number(L.toFixed(2)), Number(aVal.toFixed(2)), Number(bVal.toFixed(2))];
}

/**
 * Distancia perceptual Delta E (CIE76): distancia euclídea en el espacio CIELAB.
 * Valores < 2.3 indican diferencias imperceptibles al ojo humano.
 * Valores > 20 indican colores claramente disímiles (ej. amarillo vs cian o rojo vs negro).
 */
export function deltaE(lab1: LabColor, lab2: LabColor): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Extrae el color dominante (mediana en CIELAB) de los píxeles de tinta/trazo dentro de una caja.
 * Ignora el papel blanco de fondo usando la máscara binaria o umbral de tinta.
 */
export function extractDominantLabColor(
  rgbaData: Uint8ClampedArray | Uint8Array,
  imgWidth: number,
  box: BoundingBoxPx,
  binaryMask?: Uint8Array
): LabColor | null {
  const startX = Math.max(0, Math.floor(box.x));
  const endX = Math.min(imgWidth, Math.ceil(box.x + box.width));
  const startY = Math.max(0, Math.floor(box.y));
  const endY = Math.ceil(box.y + box.height);

  const lValues: number[] = [];
  const aValues: number[] = [];
  const bValues: number[] = [];

  for (let y = startY; y < endY; y++) {
    const rowOffset = y * imgWidth;
    for (let x = startX; x < endX; x++) {
      const idx = rowOffset + x;
      // Si hay máscara binaria, solo consideramos los píxeles activos (tinta/trazo)
      if (binaryMask && binaryMask[idx] === 0) continue;

      const pIdx = idx * 4;
      const r = rgbaData[pIdx];
      const g = rgbaData[pIdx + 1];
      const b = rgbaData[pIdx + 2];
      const a = rgbaData[pIdx + 3];

      if (a < 50) continue;

      // Descartar fondo blanco puro si no había máscara binaria
      if (!binaryMask && r > 240 && g > 240 && b > 240) continue;

      const lab = rgbToLab(r, g, b);
      lValues.push(lab[0]);
      aValues.push(lab[1]);
      bValues.push(lab[2]);
    }
  }

  if (lValues.length === 0) return null;

  // Mediana para robustez frente a antialiasing en bordes
  lValues.sort((v1, v2) => v1 - v2);
  aValues.sort((v1, v2) => v1 - v2);
  bValues.sort((v1, v2) => v1 - v2);

  const mid = Math.floor(lValues.length / 2);
  return [
    Number(lValues[mid].toFixed(2)),
    Number(aValues[mid].toFixed(2)),
    Number(bValues[mid].toFixed(2))
  ];
}
