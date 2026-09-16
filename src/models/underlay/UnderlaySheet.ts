/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: UnderlaySheet.ts (Patrón Estricto MVVM)
 * Entidad de dominio puro para láminas de fondo (planos en PNG, JPG, WebP o PDF)
 * utilizadas como calco métrico y referencia visual en el relevamiento.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface UnderlaySheet {
  id: string;
  levelId: string;           // Cada nivel o planta puede tener su propia lámina
  imageUrl: string;          // Data URL (PNG/JPEG/WebP) en base64
  fileName: string;          // Nombre del archivo original (ej. "planta-baja.png")
  fileType?: string;         // Tipo MIME (ej. "image/png", "application/pdf")
  widthPx: number;           // Ancho nativo de la imagen en píxeles
  heightPx: number;          // Alto nativo de la imagen en píxeles
  scaleMetersPerPx: number;  // Relación métrica calculada: metros por píxel (ej. 0.02 = 50px/metro)
  originWorldX: number;      // Coordenada métrica X de anclaje (por defecto 0.0)
  originWorldY: number;      // Coordenada métrica Y de anclaje (por defecto 0.0)
  opacity: number;           // Opacidad visual de la lámina (entre 0.05 y 1.0, por defecto 0.65)
  visible: boolean;          // Visibilidad activa de la lámina
  isCalibrated: boolean;     // Indica si el usuario ya calibró la escala con una cota real
  rotationDeg?: number;      // Giro angular opcional en grados
}

/**
 * Constantes por defecto para láminas de fondo
 */
export const UNDERLAY_CONSTANTS = {
  DEFAULT_SCALE_METERS_PER_PX: 0.02, // 1 metro = 50 píxeles por defecto
  DEFAULT_OPACITY: 0.65,
  MIN_OPACITY: 0.10,
  MAX_OPACITY: 1.0,
  OPACITY_PRESETS: [0.30, 0.65, 0.95] as const
} as const;

/**
 * Calcula la escala en metros por píxel basándose en dos puntos medidos
 * sobre la lámina y la distancia real métrica informada por el usuario.
 *
 * @param p1 Primer punto de referencia { x, y } (en coordenadas métricas o de pantalla del lienzo)
 * @param p2 Segundo punto de referencia { x, y }
 * @param realDistanceM Distancia real conocida en metros (ej. 4.20)
 * @param currentScaleMetersPerPx Escala actual utilizada durante la medición
 * @returns Nueva escala calibrada (metros por píxel)
 */
export function calculateUnderlayScale(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  realDistanceM: number,
  currentScaleMetersPerPx: number = UNDERLAY_CONSTANTS.DEFAULT_SCALE_METERS_PER_PX
): number {
  if (realDistanceM <= 0 || !isFinite(realDistanceM)) {
    throw new Error('La distancia real debe ser un número positivo mayor a cero.');
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const measuredDistanceWorld = Math.hypot(dx, dy);

  if (measuredDistanceWorld < 0.05) {
    throw new Error('Los dos puntos marcados están demasiado próximos entre sí para calibrar con precisión.');
  }

  // Si los puntos se tomaron en coordenadas de mundo métricas con la escala actual:
  // distPixels = measuredDistanceWorld / currentScaleMetersPerPx
  // newScale = realDistanceM / distPixels
  const distPixels = measuredDistanceWorld / currentScaleMetersPerPx;
  return Number((realDistanceM / distPixels).toFixed(6));
}
