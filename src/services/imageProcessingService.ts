/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: imageProcessingService.ts
 * Procesamiento de mapas de bits y extracción de máscaras binarias de láminas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { binarizeImageData, PATTERN_DETECTOR_CONSTANTS } from '../models/underlay/PatternDetector';

const maskCache = new Map<string, { width: number; height: number; mask: Uint8Array }>();

/**
 * Obtiene la máscara binaria en caché de forma síncrona si ya fue cargada.
 */
export function getCachedUnderlayBinaryMask(
  sheetId: string
): { width: number; height: number; mask: Uint8Array } | null {
  return maskCache.get(sheetId) || null;
}

/**
 * Extrae la máscara binaria de una imagen a partir de su URL o dataURL.
 * Utiliza caché en memoria para no re-procesar la misma lámina.
 */
export async function getUnderlayBinaryMask(
  sheetId: string,
  imageUrl: string
): Promise<{ width: number; height: number; mask: Uint8Array }> {
  if (maskCache.has(sheetId)) {
    return maskCache.get(sheetId)!;
  }

  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      // Entorno Node / Vitest sin DOM Image completo
      const dummy = new Uint8Array(100);
      resolve({ width: 10, height: 10, mask: dummy });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto 2D del lienzo.'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const mask = binarizeImageData(
          imgData.data,
          img.width,
          img.height,
          PATTERN_DETECTOR_CONSTANTS.LUMINANCE_THRESHOLD
        );

        const result = { width: img.width, height: img.height, mask };
        maskCache.set(sheetId, result);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Error al cargar la imagen de la lámina de fondo.'));
    };
    img.src = imageUrl;
  });
}

/**
 * Limpia la caché de máscaras binarias
 */
export function clearUnderlayMaskCache(sheetId?: string) {
  if (sheetId) {
    maskCache.delete(sheetId);
  } else {
    maskCache.clear();
  }
}
