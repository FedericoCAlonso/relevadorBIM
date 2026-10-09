/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIG: electricalCatalogsConfig.ts
 * Opciones de Selectores, Presets Comerciales y Paleta de Circuitos.
 * Centraliza listas de materiales y opciones UI sin strings hardcodeados.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  CircuitType,
  PanelType,
  ConduitRoutingPlane,
  ConduitRoutingMode,
  BoxCategory,
  BoxMaterialBase,
  ConductorRole
} from '../models/electrical/ElectricalModel';

export const CABLE_SECTION_PRESETS = [1.0, 1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0] as const;
export const CABLE_QUICK_SECTIONS = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0] as const;

export const BREAKER_AMPERAGE_PRESETS = [10, 16, 20, 25, 32, 40, 50, 63] as const;
export const DIFFERENTIAL_AMPERAGE_PRESETS = [25, 40, 63] as const;

export const CONDUIT_DIAMETER_PRESETS = [16, 19, 22, 25, 32, 40, 50] as const;
export const CONDUIT_QUICK_DIAMETERS = [19, 22, 25, 32] as const;

export const TERMINAL_METERS_PRESETS = [5, 10, 15, 20, 25, 30] as const;

export const TERMINAL_REFERENCE_PRESETS = [
  'A Tablero General',
  'A Tablero Seccional',
  'Pase a Planta Alta',
  'Pase a Planta Baja',
  'Subida a Azotea',
  'Acometida de Red'
] as const;

export const CIRCUIT_COLOR_PALETTE: readonly string[] = [
  '#2563eb', // Azul institucional
  '#dc2626', // Rojo
  '#16a34a', // Verde
  '#d97706', // Ámbar
  '#9333ea', // Púrpura
  '#0891b2', // Cian
  '#ea580c', // Naranja
  '#4f46e5', // Índigo
  '#be123c', // Rosa intenso
  '#475569'  // Gris pizarra
];

export const DEFAULT_CIRCUIT_COLOR = '#2563eb';

export interface ConduitRoutingPlaneOption {
  readonly id: ConduitRoutingPlane;
  readonly label: string;
  readonly iconSymbol: string;
  readonly description: string;
}

export const CONDUIT_ROUTING_PLANE_OPTIONS: readonly ConduitRoutingPlaneOption[] = [
  {
    id: 'ceiling_slab',
    label: 'Losa / Cielorraso',
    iconSymbol: '☁',
    description: 'Tendido horizontal en losa superior con bajadas a bocas'
  },
  {
    id: 'floor_slab',
    label: 'Piso / Contrapiso',
    iconSymbol: '👣',
    description: 'Tendido horizontal bajo contrapiso con subidas a cajas'
  },
  {
    id: 'wall',
    label: 'Pared / Mampostería',
    iconSymbol: '🧱',
    description: 'Tendido directo por la mampostería entre bocas'
  }
] as const;

export interface ConduitRoutingModeOption {
  readonly id: ConduitRoutingMode;
  readonly label: string;
  readonly iconSymbol: string;
}

export const CONDUIT_ROUTING_MODE_OPTIONS: readonly ConduitRoutingModeOption[] = [
  { id: 'orthogonal', label: '90° Ortogonal (Escuadra)', iconSymbol: '📐' },
  { id: 'schematic_arc', label: 'Arco Esquemático Unifilar', iconSymbol: '⌒' }
] as const;

export interface CircuitTypeOption {
  readonly id: CircuitType;
  readonly label: string;
  readonly description: string;
  readonly defaultWireMM2: number;
  readonly defaultBreakerA: number;
}

export const CIRCUIT_TYPE_OPTIONS: readonly CircuitTypeOption[] = [
  { id: 'IUG', label: 'IUG (Iluminación General)', description: 'Bocas de iluminación y bocas mixtas hasta 16A', defaultWireMM2: 1.5, defaultBreakerA: 10 },
  { id: 'IUE', label: 'IUE (Iluminación Especial)', description: 'Iluminación exterior o locales de alta potencia', defaultWireMM2: 2.5, defaultBreakerA: 16 },
  { id: 'TUG', label: 'TUG (Tomas Generales)', description: 'Tomacorrientes hasta 10A (máx 15 bocas)', defaultWireMM2: 2.5, defaultBreakerA: 16 },
  { id: 'TUE', label: 'TUE (Tomas Especiales)', description: 'Tomacorrientes 20A / cargas mayores (máx 12 bocas)', defaultWireMM2: 2.5, defaultBreakerA: 20 },
  { id: 'ACU', label: 'ACU (Alimentación Clima)', description: 'Equipos fijos de climatización y aire acondicionado', defaultWireMM2: 2.5, defaultBreakerA: 16 },
  { id: 'FM', label: 'FM (Fuerza Motriz / Bombas)', description: 'Motores, bombas elevadoras y portones', defaultWireMM2: 2.5, defaultBreakerA: 20 },
  { id: 'LP', label: 'LP (Línea Principal)', description: 'Alimentador troncal desde medidor a Tablero Principal', defaultWireMM2: 4.0, defaultBreakerA: 32 },
  { id: 'LS', label: 'LS (Línea Seccional)', description: 'Alimentador entre Tablero Principal y Subtableros', defaultWireMM2: 2.5, defaultBreakerA: 25 },
  { id: 'OTRO', label: 'OTRO (Uso Específico)', description: 'Circuitos especiales auxiliares o señalización', defaultWireMM2: 1.5, defaultBreakerA: 10 }
] as const;

export interface PanelTypeOption {
  readonly id: PanelType;
  readonly label: string;
  readonly description: string;
}

export const PANEL_TYPE_OPTIONS: readonly PanelTypeOption[] = [
  { id: 'principal', label: 'Principal (Cabecera TP)', description: 'Tablero Principal ubicado junto a la acometida/medidor' },
  { id: 'seccional', label: 'Seccional (Subtablero TS)', description: 'Tablero Seccional de distribución en cada planta' },
  { id: 'auxiliar', label: 'Auxiliar / Bombas', description: 'Tablero de automatismo, bombas o servicios auxiliares' }
] as const;

export interface InstallationStateOption {
  readonly id: 'existente' | 'proyectado' | 'a_reemplazar';
  readonly label: string;
  readonly color: string;
  readonly bg: string;
  readonly inactive: string;
}

export const INSTALLATION_STATE_OPTIONS: readonly InstallationStateOption[] = [
  {
    id: 'existente',
    label: 'Existente',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300',
    inactive: 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'
  },
  {
    id: 'proyectado',
    label: 'Proyectado',
    color: 'text-blue-400',
    bg: 'bg-blue-950/60 border-blue-600/60 text-blue-300',
    inactive: 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'
  },
  {
    id: 'a_reemplazar',
    label: 'A Reemplazar',
    color: 'text-amber-400',
    bg: 'bg-amber-950/60 border-amber-600/60 text-amber-300',
    inactive: 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'
  }
] as const;

export interface BoxCategoryOption {
  readonly id: BoxCategory;
  readonly label: string;
}

export const BOX_CATEGORIES_CATALOG: readonly BoxCategoryOption[] = [
  { id: 'caja_rectangular', label: 'Caja Rectangular (5x10)' },
  { id: 'caja_octogonal', label: 'Caja Octogonal (Losa/Centro)' },
  { id: 'caja_cuadrada', label: 'Caja Cuadrada (10x10 Paso/Deriv.)' },
  { id: 'caja_mignon', label: 'Caja Mignon (5x5)' },
  { id: 'gabinete_tablero', label: 'Gabinete / Caja de Tablero' },
  { id: 'otro', label: 'Otro tipo de caja / pase' }
] as const;

export interface BoxMaterialOption {
  readonly id: BoxMaterialBase;
  readonly label: string;
}

export const BOX_MATERIALS_CATALOG: readonly BoxMaterialOption[] = [
  { id: 'chapa', label: 'Chapa de Acero' },
  { id: 'pvc', label: 'PVC / Ignífugo' },
  { id: 'aluminio', label: 'Aluminio' },
  { id: 'otro', label: 'Otro material' }
];

export interface ConductorRoleOption {
  readonly id: ConductorRole;
  readonly label: string;
}

export const CONDUCTOR_ROLE_OPTIONS: readonly ConductorRoleOption[] = [
  { id: 'fase', label: 'Fase' },
  { id: 'neutro', label: 'Neutro' },
  { id: 'pe', label: 'Tierra (PE)' },
  { id: 'retorno', label: 'Retorno' },
  { id: 'comando', label: 'Comando' },
  { id: 'fase_r', label: 'Fase R (L1)' },
  { id: 'fase_s', label: 'Fase S (L2)' },
  { id: 'fase_t', label: 'Fase T (L3)' }
];

export {
  CONDUIT_MATERIALS_CATALOG,
  DEFAULT_CONDUIT_MATERIAL,
  DEFAULT_CONDUIT_DIAMETER_MM,
  DEFAULT_CABLE_STANDARD
} from '../models/electrical/electricalStandards';
