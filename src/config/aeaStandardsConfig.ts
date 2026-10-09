/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIG: aeaStandardsConfig.ts
 * Constantes y Parámetros Oficiales de Reglamentación AEA 90364-770/771 e IRAM.
 * Centraliza la física eléctrica y criterios normativos sin valores mágicos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ConductorRole, CircuitType } from '../models/electrical/ElectricalModel';

export const AEA_GRID_CONSTANTS = {
  DEFAULT_VOLTAGE_SINGLE_PHASE: 220,
  DEFAULT_VOLTAGE_THREE_PHASE: 380,
  NOMINAL_VOLTAGE_SINGLE_PHASE: 220,
  NOMINAL_VOLTAGE_THREE_PHASE: 380,
  GRID_FREQUENCY_HZ: 50,
  COPPER_CONDUCTIVITY_M_OHM_MM2: 56, // Conductividad del cobre comercial a 20°C
  SIMULTANEITY_FACTOR_DEFAULT: 0.8,
  POWER_FACTOR_COS_PHI_DEFAULT: 0.9
} as const;

export const AEA_VOLTAGE_DROP_LIMITS = {
  LIGHTING_CIRCUITS_MAX_PERCENT: 3.0,
  POWER_CIRCUITS_MAX_PERCENT: 5.0,
  MAIN_FEEDER_LP_MAX_PERCENT: 1.0,
  SECTIONAL_FEEDER_LS_MAX_PERCENT: 1.5
} as const;

export const AEA_CONDUIT_OCCUPANCY_LIMITS = {
  SINGLE_CONDUCTOR_MAX_PERCENT: 53,
  TWO_CONDUCTORS_MAX_PERCENT: 31,
  THREE_OR_MORE_CONDUCTORS_MAX_PERCENT: 35,
  WARNING_THRESHOLD_PERCENT: 40 // Umbral preventivo informativo
} as const;

export const AEA_CONDUIT_PHYSICAL_LIMITS = {
  MAX_BENDS_BETWEEN_BOXES: 3, // Máximo 3 curvas a 90° entre cajas de paso/inspección
  MAX_STRAIGHT_RUN_WITHOUT_BOX_M: 15.0, // Tramo recto continuo máximo sin caja
  MAX_RUN_WITH_BENDS_WITHOUT_BOX_M: 12.0 // Tramo con curvas máximo sin caja
} as const;

export const AEA_NORMALIZED_PIPE_BEND_RADIUS_M: Readonly<Record<number, number>> = {
  16: 0.10,
  19: 0.12,
  22: 0.15,
  25: 0.18,
  32: 0.22,
  40: 0.28,
  50: 0.35
};

export interface AeaMountingHeight {
  readonly id: string;
  readonly label: string;
  readonly heightM: number;
  readonly description: string;
}

export const AEA_MOUNTING_HEIGHTS: readonly AeaMountingHeight[] = [
  { id: 'toma_bajo', label: 'Tomas Bajos (+0.30 m)', heightM: 0.30, description: 'Tomacorrientes generales a nivel de zócalo' },
  { id: 'llave_punto', label: 'Llaves / Pulsadores (+1.10 m)', heightM: 1.10, description: 'Interruptores de efecto y timbres junto a puertas' },
  { id: 'toma_medio', label: 'Tomas Medios / Mesada (+1.20 m)', heightM: 1.20, description: 'Tomacorrientes sobre mesada en cocina y baño' },
  { id: 'toma_alto', label: 'Tomas Altos / Clima (+2.00 m)', heightM: 2.00, description: 'Alimentación para aires acondicionados y campanas' },
  { id: 'aplique_pared', label: 'Apliques de Pared (+2.20 m)', heightM: 2.20, description: 'Luminarias de pared y carteles de salida' },
  { id: 'cielorraso', label: 'Cielorraso / Centro (Losa)', heightM: 2.70, description: 'Bocas de iluminación y ventiladores de techo' }
] as const;

export const AEA_MINIMUM_WIRE_SECTIONS_MM2: Readonly<Record<CircuitType, number>> = {
  IUG: 1.5,
  IUE: 1.5,
  TUG: 2.5,
  TUE: 2.5,
  ACU: 2.5,
  FM: 2.5,
  LP: 4.0,
  LS: 2.5,
  OTRO: 1.5
};

export const AEA_CONDUCTOR_COLORS: Readonly<Record<ConductorRole, string>> = {
  fase: '#854d0e',     // Castaño / Marrón institucional
  fase_r: '#92400e',   // Fase R (Castaño)
  fase_s: '#0f172a',   // Fase S (Negro)
  fase_t: '#dc2626',   // Fase T (Rojo)
  neutro: '#0284c7',   // Neutro (Celeste / Azul claro)
  pe: '#16a34a',       // Conductor de Protección Tierra (Verde-Amarillo)
  retorno: '#ca8a04',  // Retorno de iluminación (Amarillo / Naranja)
  comando: '#7c3aed'   // Señal / Comando (Violeta / Gris)
};

export interface ElectrificationDegreeRange {
  readonly id: 'minimo' | 'medio' | 'elevado' | 'superior';
  readonly label: string;
  readonly minSurfaceM2: number;
  readonly maxSurfaceM2: number;
  readonly minCircuitsCount: number;
  readonly description: string;
}

export const AEA_ELECTRIFICATION_DEGREES_CATALOG: readonly ElectrificationDegreeRange[] = [
  {
    id: 'minimo',
    label: 'Mínimo',
    minSurfaceM2: 0,
    maxSurfaceM2: 60,
    minCircuitsCount: 2,
    description: 'Hasta 60 m² (1 circuito IUG + 1 circuito TUG)'
  },
  {
    id: 'medio',
    label: 'Medio',
    minSurfaceM2: 60.01,
    maxSurfaceM2: 130,
    minCircuitsCount: 3,
    description: 'De 60 a 130 m² (mínimo 1 IUG + 1 TUG + 1 libre IUG/TUG/TUE)'
  },
  {
    id: 'elevado',
    label: 'Elevado',
    minSurfaceM2: 130.01,
    maxSurfaceM2: 200,
    minCircuitsCount: 5,
    description: 'De 130 a 200 m² (mínimo 2 IUG + 2 TUG + 1 circuito especial/TUE)'
  },
  {
    id: 'superior',
    label: 'Superior',
    minSurfaceM2: 200.01,
    maxSurfaceM2: Infinity,
    minCircuitsCount: 6,
    description: 'Más de 200 m² (mínimo 2 IUG + 3 TUG + 1 libre/TUE/fuerza motriz)'
  }
] as const;
