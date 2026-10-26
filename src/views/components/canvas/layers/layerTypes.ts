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
