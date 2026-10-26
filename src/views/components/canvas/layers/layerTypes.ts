/**
 * Contratos compartidos por las capas SVG del lienzo CAD.
 */
import type React from 'react';

/** Guardas de interacción que comparten las capas clickeables del lienzo. */
export interface LayerInteractionGuards {
  /** Referencia estable a la función que indica si hubo un arrastre reciente (evita clics fantasma). */
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  /** Verdadero cuando otra herramienta (símbolo, cañería, calibración, cota) captura los clics. */
  isInteractionBlocked: boolean;
}

/** Estado en vuelo durante el arrastre de una boca o tablero eléctrico en el lienzo. */
export interface ActiveNodeDragState {
  kind: 'element' | 'panel';
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origRotation: number;
  moved: boolean;
}

/** Estado en vuelo durante el arrastre de un waypoint (quiebre intermedio) de cañería. */
export interface ActiveWaypointDragState {
  conduitId: string;
  wpIndex: number;
  startX: number;
  startY: number;
  origWpX: number;
  origWpY: number;
  moved: boolean;
}

/** Manija activa durante el ajuste fino interactivo del recuadro de Muestra #1. */
export type AdjustSampleHandle = 'nw' | 'ne' | 'se' | 'sw' | 'move' | null;
