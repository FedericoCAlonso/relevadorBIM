/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: elevationViewport.ts — Responsabilidad Única:
 * Matemática pura de encuadre (zoom/pan/fit) del visor de alzado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface ElevationViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ELEVATION_VIEWPORT_CONSTANTS = {
  ZOOM_STEP: 1.25,
  WHEEL_ZOOM_BASE: 1.0015,
  MIN_VIEW_WIDTH_M: 0.30,
  MAX_ZOOM_OUT_RATIO: 2.5
} as const;

export function fitViewBox(bounds: ElevationViewBox): ElevationViewBox {
  return { ...bounds };
}

/**
 * Escala el encuadre manteniendo fijo el punto `focus` (en metros). factor > 1 acerca.
 * El ancho resultante se limita entre un mínimo físico y un múltiplo del encuadre total.
 */
export function zoomViewBox(
  vb: ElevationViewBox,
  factor: number,
  focus: { x: number; y: number },
  bounds: ElevationViewBox
): ElevationViewBox {
  const { MIN_VIEW_WIDTH_M, MAX_ZOOM_OUT_RATIO } = ELEVATION_VIEWPORT_CONSTANTS;
  const aspect = vb.height / vb.width;
  const width = Math.min(Math.max(vb.width / factor, MIN_VIEW_WIDTH_M), bounds.width * MAX_ZOOM_OUT_RATIO);
  const ratio = width / vb.width;
  return {
    x: focus.x - (focus.x - vb.x) * ratio,
    y: focus.y - (focus.y - vb.y) * ratio,
    width,
    height: width * aspect
  };
}

export function panViewBox(vb: ElevationViewBox, dx: number, dy: number): ElevationViewBox {
  return { ...vb, x: vb.x - dx, y: vb.y - dy };
}

export function viewBoxCenter(vb: ElevationViewBox): { x: number; y: number } {
  return { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
}

export function viewBoxToAttribute(vb: ElevationViewBox): string {
  return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
}
