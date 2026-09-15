/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: MeasurementAnchor.ts
 * Puntos de Anclaje Físico para Relevamiento por Rebote Láser.
 * Representa esquinas interiores, cantos de vanos/jambas y puntos de empalme en T.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D } from '../architecture/Wall';

export type AnchorKind =
  | 'inner_corner'   // Esquina interior entre dos muros
  | 'jamb'           // Canto / marco de puerta o ventana
  | 'wall_tee'       // Punto de empalme en T sobre cara de muro
  | 'space_center'   // Centroide de ambiente (techo)
  | 'space_subcenter'// Sub-centro (1/4, 3/4 o retícula de luminarias)
  | 'free_point';    // Coordenada libre

export interface SurveyAnchor {
  id: string;
  kind: AnchorKind;
  position: Vector2D;       // Coordenada (X, Y) métrica en el edificio
  elevationZ: number;       // Altura en metros (0.00 = piso, 1.20 = llave, 2.70 = techo)
  label: string;            // Nombre descriptivo (ej: "Esquina NO", "Jamba Izquierda P1")
  relatedWallId?: string;
  relatedOpeningId?: string;
  relatedSpaceId?: string;
}
