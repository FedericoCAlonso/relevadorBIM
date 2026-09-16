/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: DimensionLine.ts (Patrón Estricto MVVM)
 * Entidad de dominio puro para cotas métricas lineales libres en el plano CAD.
 * Permite acotar distancias entre puntos arbitrarios, sobre planos de fondo,
 * muros o elementos de la instalación.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface DimensionLine {
  id: string;
  levelId: string;
  p1: Point2D;          // Punto inicial en coordenadas de mundo (metros)
  p2: Point2D;          // Punto final en coordenadas de mundo (metros)
  label?: string;       // Rótulo opcional personalizado
  offsetM?: number;     // Desplazamiento perpendicular opcional de la línea de cota
}

export const DIMENSION_CONSTANTS = {
  DEFAULT_COLOR: '#0284c7',       // Azul técnico CAD / Sky
  SELECTED_COLOR: '#ea580c',      // Naranja al seleccionarla
  TICK_SIZE: 6,                   // Tamaño visual del tic oblicuo a 45°
  FONT_SIZE: 11,
  STROKE_WIDTH: 1.5,
  HIT_WIDTH: 16                   // Área de impacto táctil
} as const;

/**
 * Calcula la distancia métrica real entre los extremos de la cota.
 */
export function calculateDimensionDistance(p1: Point2D, p2: Point2D): number {
  return Number(Math.hypot(p2.x - p1.x, p2.y - p1.y).toFixed(2));
}

/**
 * Formatea la distancia métrica para visualización.
 */
export function formatDimensionText(distanceM: number, customLabel?: string): string {
  if (customLabel && customLabel.trim()) {
    return customLabel.trim();
  }
  return `${distanceM.toFixed(2)} m`;
}
