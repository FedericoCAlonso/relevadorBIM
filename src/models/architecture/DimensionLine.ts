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
  LABEL_BG_COLOR: '#ffffff',
  LABEL_BORDER_COLOR: '#cbd5e1',
  DELETE_BTN_COLOR: '#ef4444',
  TICK_SIZE: 6,                   // Tamaño visual del tic oblicuo a 45°
  TICK_HALF_LENGTH_PX: 5,
  TEXT_OFFSET_PX: 8,
  MIN_DISTANCE_M: 0.05,
  FONT_SIZE: 11,
  STROKE_WIDTH: 1.5,
  HIT_WIDTH: 18                   // Área de impacto táctil
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


export interface DimensionRenderGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distM: number;
  tickDx: number;
  tickDy: number;
  midX: number;
  midY: number;
  textX: number;
  textY: number;
  angleDeg: number;
  labelText: string;
}

/**
 * Calcula las coordenadas en pantalla, tics a 45° y ángulo legible de una cota lineal.
 * Retorna null si la distancia en metros es inferior al mínimo representable.
 */
export function computeDimensionRenderGeometry(
  dim: Pick<DimensionLine, 'p1' | 'p2' | 'label'>,
  zoom: number
): DimensionRenderGeometry | null {
  const distM = Math.hypot(dim.p2.x - dim.p1.x, dim.p2.y - dim.p1.y);
  if (distM < DIMENSION_CONSTANTS.MIN_DISTANCE_M) return null;

  const x1 = dim.p1.x * zoom;
  const y1 = dim.p1.y * zoom;
  const x2 = dim.p2.x * zoom;
  const y2 = dim.p2.y * zoom;

  const angleRad = Math.atan2(y2 - y1, x2 - x1);
  const tickAngleRad = angleRad + Math.PI / 4;
  const tickDx = Math.cos(tickAngleRad) * DIMENSION_CONSTANTS.TICK_HALF_LENGTH_PX;
  const tickDy = Math.sin(tickAngleRad) * DIMENSION_CONSTANTS.TICK_HALF_LENGTH_PX;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const normX = -(y2 - y1) / (distM * zoom);
  const normY = (x2 - x1) / (distM * zoom);
  const textX = midX + normX * DIMENSION_CONSTANTS.TEXT_OFFSET_PX;
  const textY = midY + normY * DIMENSION_CONSTANTS.TEXT_OFFSET_PX;

  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

  const labelText = formatDimensionText(distM, dim.label);

  return {
    x1,
    y1,
    x2,
    y2,
    distM,
    tickDx,
    tickDy,
    midX,
    midY,
    textX,
    textY,
    angleDeg,
    labelText
  };
}
