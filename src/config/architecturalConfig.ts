/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIG: architecturalConfig.ts
 * Parámetros Constructivos, Espesores de Muros, Aberturas y Ambientes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { OpeningType, OpeningSwing } from '../models/architecture/Opening';
import type { SpaceCoverType } from '../models/architecture/Space';

export const ARCHITECTURAL_WALL_CONFIG = {
  DEFAULT_THICKNESS_M: 0.15,
  THICKNESS_PRESETS: [0.10, 0.15, 0.20, 0.30] as const,
  DEFAULT_HEIGHT_M: 2.70,
  DEFAULT_LOW_WALL_HEIGHT_M: 1.00,
  DEFAULT_RAILING_HEIGHT_M: 0.90,
  TEE_DEFAULT_OFFSET_M: 1.50,
  TEE_DEFAULT_LENGTH_M: 2.50
} as const;

export const ARCHITECTURAL_OPENING_CONFIG = {
  DOOR_DEFAULT_WIDTH_M: 0.80,
  DOOR_DEFAULT_HEIGHT_M: 2.05,
  WINDOW_DEFAULT_WIDTH_M: 1.20,
  WINDOW_DEFAULT_HEIGHT_M: 1.10,
  WINDOW_DEFAULT_SILL_M: 0.90,
  PASSAGE_DEFAULT_WIDTH_M: 0.90,
  PASSAGE_DEFAULT_HEIGHT_M: 2.05,
  DEFAULT_OFFSET_M: 0.60,
  WIDTH_PRESETS: [0.70, 0.80, 0.90, 1.20, 1.50] as const,
  SILL_PRESETS: [0.80, 0.90, 1.00, 1.10] as const
} as const;

export interface OpeningTypeOption {
  readonly id: OpeningType;
  readonly label: string;
  readonly defaultWidthM: number;
}

export const OPENING_TYPE_OPTIONS: readonly OpeningTypeOption[] = [
  { id: 'door', label: 'Puerta', defaultWidthM: 0.80 },
  { id: 'window', label: 'Ventana', defaultWidthM: 1.20 },
  { id: 'passage', label: 'Vano Libre', defaultWidthM: 0.90 }
] as const;

export interface OpeningSwingOption {
  readonly id: OpeningSwing;
  readonly label: string;
}

export const OPENING_SWING_OPTIONS: readonly OpeningSwingOption[] = [
  { id: 'left_in', label: 'Izquierda (Hacia Adentro)' },
  { id: 'right_in', label: 'Derecha (Hacia Adentro)' },
  { id: 'left_out', label: 'Izquierda (Hacia Afuera)' },
  { id: 'right_out', label: 'Derecha (Hacia Afuera)' },
  { id: 'double', label: 'Doble Hoja' },
  { id: 'sliding', label: 'Corrediza' },
  { id: 'none', label: 'Sin Batiente / Fijo' }
] as const;

export const ARCHITECTURAL_SPACE_CONFIG = {
  DEFAULT_CEILING_HEIGHT_M: 2.70,
  CEILING_HEIGHT_PRESETS: [2.40, 2.60, 2.70, 3.00, 3.50] as const,
  MINIMUM_DETECTABLE_AREA_M2: 0.05
} as const;

export interface SpaceCoverTypeOption {
  readonly id: SpaceCoverType;
  readonly label: string;
  readonly shortLabel: string;
  readonly defaultCategory: string;
  readonly defaultIP: 'IP20' | 'IP44' | 'IP65';
  readonly aeaAreaFactor: number;
  readonly description: string;
}

export const SPACE_COVER_TYPE_OPTIONS: readonly SpaceCoverTypeOption[] = [
  {
    id: 'cubierto',
    label: 'Cubierto (Interior / Habitable)',
    shortLabel: 'Cubierto',
    defaultCategory: 'living',
    defaultIP: 'IP20',
    aeaAreaFactor: 1.0,
    description: 'Losa o techo completo. 100% computable para superficie límite AEA 771.'
  },
  {
    id: 'semicubierto',
    label: 'Semicubierto (Galería / Balcón / Alero)',
    shortLabel: 'Semicubierto',
    defaultCategory: 'balcon',
    defaultIP: 'IP44',
    aeaAreaFactor: 0.5,
    description: 'Techo o alero abierto al exterior. 50% computable para superficie límite AEA 771.'
  },
  {
    id: 'descubierto',
    label: 'Descubierto (Patio / Terraza / Jardín)',
    shortLabel: 'Descubierto',
    defaultCategory: 'exterior',
    defaultIP: 'IP65',
    aeaAreaFactor: 0.0,
    description: 'A cielo abierto sin cubierta. 0% computable para superficie límite AEA 771.'
  },
  {
    id: 'vacio',
    label: 'Vacío / Aire y Luz / Pleno',
    shortLabel: 'Vacío',
    defaultCategory: 'aire_luz',
    defaultIP: 'IP20',
    aeaAreaFactor: 0.0,
    description: 'Hueco de losa o patio de aire y luz. 0% computable.'
  }
] as const;
