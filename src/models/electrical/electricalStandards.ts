/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: electricalStandards.ts
 * Catálogos, Normas y Constantes Reglamentarias AEA 90364-771 / IRAM.
 * Centraliza toda la información técnica sin código hardcodeado en las Vistas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  ConduitMaterial,
  CableStandard,
  ConductorRole,
  ConductorLine,
  ConduitSizeOption,
  ConduitTypeDefinition,
  CableTypeDefinition,
  BoxTypeDefinition,
  BoxCategory,
  BoxMaterialBase,
  ProjectMaterialCatalog
} from './ElectricalModel';

export type {
  ConduitSizeOption,
  ConduitTypeDefinition,
  CableTypeDefinition,
  BoxTypeDefinition,
  BoxCategory,
  BoxMaterialBase,
  ProjectMaterialCatalog
};

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
];

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

export const DEFAULT_CABLE_SECTIONS: readonly number[] = [1.0, 1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0];

/** Constantes de Cálculo y Seguridad según Reglamentación AEA */
export const AEA_CALCULATION_CONSTANTS = {
  /** Factor máximo admisible de ocupación en cañerías (AEA 90364-771.12.3.4) */
  MAX_CONDUIT_OCCUPANCY_PERCENT: 35.0,
  /** Coeficiente de mayoración por curvas reglamentarias y desperdicios en obra */
  CONDUIT_CURVE_MARGIN_FACTOR: 1.10,
  /** Conductividad eléctrica del cobre comercial a 20°C en m / (Ohm * mm²) */
  COPPER_CONDUCTIVITY_M_OHM_MM2: 56.0,
  /** Factor de potencia reglamentario cos(phi) para circuitos terminales */
  DEFAULT_POWER_FACTOR_COS_PHI: 0.90,
  /** Tensión monofásica nominal estándar en Argentina (V) */
  VOLTAGE_SINGLE_PHASE_V: 220,
  /** Tensión trifásica nominal estándar en Argentina (V) */
  VOLTAGE_THREE_PHASE_V: 380,
  /** Caída de tensión admisible para circuitos de iluminación (%) */
  MAX_VOLTAGE_DROP_LIGHTING_PERCENT: 3.0,
  /** Caída de tensión admisible para circuitos de tomacorrientes y fuerza motriz (%) */
  MAX_VOLTAGE_DROP_POWER_PERCENT: 5.0,
  /** Carga unitaria estimada para tomas generales (VA / W) según AEA */
  DEFAULT_POWER_TOMA_W: 2200,
  /** Carga unitaria estimada para centro de luz (VA / W) */
  DEFAULT_POWER_CENTRO_LUZ_W: 150,
  /** Carga unitaria estimada para aplique de pared (VA / W) */
  DEFAULT_POWER_APLIQUE_W: 100
} as const;

/** Catálogo Oficial de Materiales de Canalización (Orden Reglamentario Solicitado) */
export interface ConduitMaterialOption {
  readonly id: ConduitMaterial;
  readonly label: string;
  readonly description: string;
  readonly standardReference: string;
  readonly allowedInSlab: boolean;
}

export const CONDUIT_MATERIALS_CATALOG: readonly ConduitMaterialOption[] = [
  {
    id: 'hierro_semipesado_rs',
    label: '1. Caño Hierro Semipesado RS',
    description: 'Acero semipesado según IRAM-IAS U 500-2604 (Norma AEA losas y embutido)',
    standardReference: 'IRAM-IAS U 500-2604',
    allowedInSlab: true
  },
  {
    id: 'hierro_liviano_rl',
    label: '2. Hierro Liviano RL',
    description: 'Acero liviano con costura para canalizaciones embutidas',
    standardReference: 'IRAM-IAS U 500-2005',
    allowedInSlab: false
  },
  {
    id: 'pvc_rigido_metrico',
    label: '3. Caño PVC Rígido (métrico)',
    description: 'Termoplástico rígido aislante curvable en caliente',
    standardReference: 'IRAM 62386-21',
    allowedInSlab: true
  },
  {
    id: 'corrugado_blanco_pvc',
    label: '4. Corrugado Blanco PVC',
    description: '⚠️ Liviano económico. No apto para losas bajo AEA 90364',
    standardReference: 'IRAM 62386-22 (Liviano)',
    allowedInSlab: false
  },
  {
    id: 'bandeja_perforada_20',
    label: '5. Bandeja Perforada de 20',
    description: 'Chapa de acero perforada ancho 200 mm para instalaciones a la vista',
    standardReference: 'AEA 90364-771.12.5',
    allowedInSlab: false
  }
] as const;

export const DEFAULT_CONDUIT_MATERIAL: ConduitMaterial = 'hierro_semipesado_rs';
export const DEFAULT_CONDUIT_DIAMETER_MM = 19;
export const DEFAULT_CABLE_STANDARD: CableStandard = 'IRAM_NM_247_3';

/** Diámetros Comerciales Normalizados de Cañerías (Genérico / Compatibilidad) */
export interface ConduitDiameterOption {
  readonly mm: number;
  readonly inches: string;
  readonly standardSize: string;
}

export const CONDUIT_DIAMETERS_CATALOG: readonly ConduitDiameterOption[] = [
  { mm: 16, inches: '5/8"', standardSize: 'RL16 / RS16' },
  { mm: 19, inches: '3/4"', standardSize: 'RL19 / RS19' },
  { mm: 22, inches: '7/8"', standardSize: 'RL22 / RS22' },
  { mm: 25, inches: '1"', standardSize: 'RL25 / RS25' },
  { mm: 32, inches: '1 1/4"', standardSize: 'RL32 / RS32' },
  { mm: 38, inches: '1 1/2"', standardSize: 'RL38 / RS38' }
] as const;

export const CONDUIT_SIZES_BY_MATERIAL: Record<string, readonly ConduitSizeOption[]> = {
  hierro_semipesado_rs: [
    { value: 16, label: 'RS 16 (5/8")', standardSize: 'RS 16', usefulAreaMM2: 143.1 },
    { value: 19, label: 'RS 19 (3/4") [Estándar]', standardSize: 'RS 19', usefulAreaMM2: 213.8 },
    { value: 22, label: 'RS 22 (7/8")', standardSize: 'RS 22', usefulAreaMM2: 298.6 },
    { value: 25, label: 'RS 25 (1")', standardSize: 'RS 25', usefulAreaMM2: 394.1 },
    { value: 32, label: 'RS 32 (1 1/4")', standardSize: 'RS 32', usefulAreaMM2: 642.4 },
    { value: 38, label: 'RS 38 (1 1/2")', standardSize: 'RS 38', usefulAreaMM2: 934.8 },
    { value: 51, label: 'RS 51 (2")', standardSize: 'RS 51', usefulAreaMM2: 1705.5 }
  ],
  hierro_liviano_rl: [
    { value: 16, label: 'RL 16 (5/8")', standardSize: 'RL 16', usefulAreaMM2: 158.4 },
    { value: 19, label: 'RL 19 (3/4") [Estándar]', standardSize: 'RL 19', usefulAreaMM2: 232.4 },
    { value: 22, label: 'RL 22 (7/8")', standardSize: 'RL 22', usefulAreaMM2: 320.5 },
    { value: 25, label: 'RL 25 (1")', standardSize: 'RL 25', usefulAreaMM2: 422.7 },
    { value: 32, label: 'RL 32 (1 1/4")', standardSize: 'RL 32', usefulAreaMM2: 678.9 },
    { value: 38, label: 'RL 38 (1 1/2")', standardSize: 'RL 38', usefulAreaMM2: 973.1 },
    { value: 51, label: 'RL 51 (2")', standardSize: 'RL 51', usefulAreaMM2: 1749.7 }
  ],
  pvc_rigido_metrico: [
    { value: 16, label: 'Ø16 mm (Métrico IRAM 62386)', standardSize: 'PVC 16', usefulAreaMM2: 132.7 },
    { value: 20, label: 'Ø20 mm (Métrico IRAM 62386) [Estándar]', standardSize: 'PVC 20', usefulAreaMM2: 221.7 },
    { value: 25, label: 'Ø25 mm (Métrico IRAM 62386)', standardSize: 'PVC 25', usefulAreaMM2: 363.0 },
    { value: 32, label: 'Ø32 mm (Métrico IRAM 62386)', standardSize: 'PVC 32', usefulAreaMM2: 615.7 },
    { value: 40, label: 'Ø40 mm (Métrico IRAM 62386)', standardSize: 'PVC 40', usefulAreaMM2: 989.8 },
    { value: 50, label: 'Ø50 mm (Métrico IRAM 62386)', standardSize: 'PVC 50', usefulAreaMM2: 1590.4 },
    { value: 63, label: 'Ø63 mm (Métrico IRAM 62386)', standardSize: 'PVC 63', usefulAreaMM2: 2551.7 }
  ],
  corrugado_blanco_pvc: [
    { value: 16, label: 'Ø16 mm (5/8")', standardSize: 'Corrugado 16', usefulAreaMM2: 132.7 },
    { value: 20, label: 'Ø20 mm (3/4") [Estándar]', standardSize: 'Corrugado 20', usefulAreaMM2: 201.0 },
    { value: 22, label: 'Ø22 mm (7/8")', standardSize: 'Corrugado 22', usefulAreaMM2: 254.4 },
    { value: 25, label: 'Ø25 mm (1")', standardSize: 'Corrugado 25', usefulAreaMM2: 314.1 },
    { value: 32, label: 'Ø32 mm (1 1/4")', standardSize: 'Corrugado 32', usefulAreaMM2: 530.9 }
  ],
  bandeja_perforada_20: [
    { value: 50, label: '50 × 20 mm (Ala 20)', standardSize: 'Bandeja 50x20', usefulAreaMM2: 1000, isTray: true },
    { value: 100, label: '100 × 20 mm (Ala 20)', standardSize: 'Bandeja 100x20', usefulAreaMM2: 2000, isTray: true },
    { value: 150, label: '150 × 20 mm (Ala 20)', standardSize: 'Bandeja 150x20', usefulAreaMM2: 3000, isTray: true },
    { value: 200, label: '200 × 20 mm (Ala 20) [Estándar]', standardSize: 'Bandeja 200x20', usefulAreaMM2: 4000, isTray: true },
    { value: 300, label: '300 × 20 mm (Ala 20)', standardSize: 'Bandeja 300x20', usefulAreaMM2: 6000, isTray: true },
    { value: 450, label: '450 × 20 mm (Ala 20)', standardSize: 'Bandeja 450x20', usefulAreaMM2: 9000, isTray: true },
    { value: 600, label: '600 × 20 mm (Ala 20)', standardSize: 'Bandeja 600x20', usefulAreaMM2: 12000, isTray: true }
  ],
  // Mapeos de compatibilidad con identificadores antiguos
  corrugado_blanco: [
    { value: 16, label: 'Ø16 mm (5/8")', standardSize: 'Corrugado 16', usefulAreaMM2: 132.7 },
    { value: 20, label: 'Ø20 mm (3/4")', standardSize: 'Corrugado 20', usefulAreaMM2: 201.0 },
    { value: 22, label: 'Ø22 mm (7/8")', standardSize: 'Corrugado 22', usefulAreaMM2: 254.4 },
    { value: 25, label: 'Ø25 mm (1")', standardSize: 'Corrugado 25', usefulAreaMM2: 314.1 }
  ],
  corrugado_ignifugo: [
    { value: 16, label: 'Ø16 mm (5/8")', standardSize: 'Ignífugo 16', usefulAreaMM2: 132.7 },
    { value: 20, label: 'Ø20 mm (3/4")', standardSize: 'Ignífugo 20', usefulAreaMM2: 201.0 },
    { value: 25, label: 'Ø25 mm (1")', standardSize: 'Ignífugo 25', usefulAreaMM2: 314.1 }
  ],
  cano_rigido_pvc: [
    { value: 16, label: 'Ø16 mm', standardSize: 'PVC 16', usefulAreaMM2: 132.7 },
    { value: 20, label: 'Ø20 mm', standardSize: 'PVC 20', usefulAreaMM2: 221.7 },
    { value: 25, label: 'Ø25 mm', standardSize: 'PVC 25', usefulAreaMM2: 363.0 },
    { value: 32, label: 'Ø32 mm', standardSize: 'PVC 32', usefulAreaMM2: 615.7 }
  ],
  cano_acero: [
    { value: 19, label: 'RS 19 (3/4")', standardSize: 'RS 19', usefulAreaMM2: 213.8 },
    { value: 25, label: 'RS 25 (1")', standardSize: 'RS 25', usefulAreaMM2: 394.1 },
    { value: 32, label: 'RS 32 (1 1/4")', standardSize: 'RS 32', usefulAreaMM2: 642.4 }
  ],
  bandeja: [
    { value: 100, label: '100 × 20 mm', standardSize: 'Bandeja 100x20', usefulAreaMM2: 2000, isTray: true },
    { value: 200, label: '200 × 20 mm', standardSize: 'Bandeja 200x20', usefulAreaMM2: 4000, isTray: true },
    { value: 300, label: '300 × 20 mm', standardSize: 'Bandeja 300x20', usefulAreaMM2: 6000, isTray: true }
  ]
};

export function getSizesForConduitMaterial(material: ConduitMaterial): readonly ConduitSizeOption[] {
  return CONDUIT_SIZES_BY_MATERIAL[material] || CONDUIT_SIZES_BY_MATERIAL.hierro_semipesado_rs;
}

export function getDefaultSizeForConduitMaterial(material: ConduitMaterial): number {
  switch (material) {
    case 'bandeja_perforada_20':
    case 'bandeja':
      return 200;
    case 'pvc_rigido_metrico':
      return 20;
    case 'hierro_semipesado_rs':
    case 'hierro_liviano_rl':
    default:
      return 19;
  }
}

/** Normas de Cables y Conductores */
export interface CableStandardOption {
  readonly id: CableStandard;
  readonly label: string;
  readonly description: string;
}

export const CABLE_STANDARDS_CATALOG: readonly CableStandardOption[] = [
  {
    id: 'IRAM_NM_247_3',
    label: 'IRAM NM 247-3 (Unipolar PVC)',
    description: 'Antiflama 450/750V estándar interior'
  },
  {
    id: 'IRAM_62267_LSOH',
    label: 'IRAM 62267 (Libre Halógenos)',
    description: 'Baja emisión de humos tóxicos (lugares de concurrencia)'
  },
  {
    id: 'IRAM_2178_SUB',
    label: 'IRAM 2178 (Subterráneo / Sintenax)',
    description: 'Aislación XLPE / Intemperie 0.6/1.1 kV'
  },
  {
    id: 'IRAM_NM_247_5',
    label: 'IRAM NM 247-5 (Tipo Taller)',
    description: 'Vaina redonda flexible doble aislación'
  }
] as const;

/** Código de Colores Reglamentario de Conductores (Norma AEA 90364-771.12.3) */
export const AEA_CONDUCTOR_COLORS: Record<ConductorRole, string> = {
  fase: '#92400e',      // Marrón (Fase Línea estándar)
  fase_r: '#92400e',    // Marrón (Fase R)
  fase_s: '#0f172a',    // Negro (Fase S)
  fase_t: '#dc2626',    // Rojo (Fase T)
  neutro: '#0284c7',    // Celeste (Neutro obligatorio)
  pe: '#16a34a',        // Verde-Amarillo (Protección a tierra obligatoria)
  retorno: '#64748b',   // Gris o blanco (Retorno de interruptores)
  comando: '#d97706'    // Naranja (Circuitos de comando y control)
};

/** Presets de Alturas de Montaje según AEA 90364 */
export interface HeightPresetOption {
  readonly id: string;
  readonly label: string;
  readonly meters: number;
  readonly description: string;
}

export const AEA_HEIGHT_PRESETS: readonly HeightPresetOption[] = [
  { id: 'zocalo', label: 'Zócalo (0.30m)', meters: 0.30, description: 'Tomas bajos zócalo' },
  { id: 'mesada', label: 'Mesada (0.90m)', meters: 0.90, description: 'Cocina y lavadero' },
  { id: 'llave', label: 'Llave (1.20m)', meters: 1.20, description: 'Puntos y tomas medios' },
  { id: 'alto', label: 'Alto (2.20m)', meters: 2.20, description: 'Tomas AA y campanas' },
  { id: 'techo', label: 'Techo (2.70m)', meters: 2.70, description: 'Centros y apliques' }
] as const;

/** Presets Reglamentarios de Llenado de Cañerías */
export interface ConductorPresetOption {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly conductors: readonly ConductorLine[];
}

export const AEA_CONDUCTOR_PRESETS: readonly ConductorPresetOption[] = [
  {
    id: 'iug_2x1.5_pe',
    label: '2x1.5 + PE',
    subtitle: 'Iluminación (IUG)',
    conductors: [
      { role: 'fase', sectionMM2: 1.5, color: AEA_CONDUCTOR_COLORS.fase },
      { role: 'neutro', sectionMM2: 1.5, color: AEA_CONDUCTOR_COLORS.neutro },
      { role: 'pe', sectionMM2: 1.5, color: AEA_CONDUCTOR_COLORS.pe }
    ]
  },
  {
    id: 'tug_2x2.5_pe',
    label: '2x2.5 + PE',
    subtitle: 'Tomacorrientes (TUG)',
    conductors: [
      { role: 'fase', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.fase },
      { role: 'neutro', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.neutro },
      { role: 'pe', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.pe }
    ]
  },
  {
    id: 'tue_2x4.0_pe',
    label: '2x4.0 + PE',
    subtitle: 'Tomas Esp. (TUE/AA)',
    conductors: [
      { role: 'fase', sectionMM2: 4.0, color: AEA_CONDUCTOR_COLORS.fase },
      { role: 'neutro', sectionMM2: 4.0, color: AEA_CONDUCTOR_COLORS.neutro },
      { role: 'pe', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.pe }
    ]
  },
  {
    id: 'retorno_3x2.5_pe',
    label: '3x2.5 + PE',
    subtitle: 'Retorno + Línea',
    conductors: [
      { role: 'fase', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.fase },
      { role: 'neutro', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.neutro },
      { role: 'retorno', sectionMM2: 1.5, color: AEA_CONDUCTOR_COLORS.retorno, reference: 'a' },
      { role: 'pe', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.pe }
    ]
  },
  {
    id: 'trifasico_3x4.0_n_pe',
    label: '3x4.0 + N + PE',
    subtitle: 'Línea Trifásica',
    conductors: [
      { role: 'fase_r', sectionMM2: 4.0, color: AEA_CONDUCTOR_COLORS.fase_r },
      { role: 'fase_s', sectionMM2: 4.0, color: AEA_CONDUCTOR_COLORS.fase_s },
      { role: 'fase_t', sectionMM2: 4.0, color: AEA_CONDUCTOR_COLORS.fase_t },
      { role: 'neutro', sectionMM2: 4.0, color: AEA_CONDUCTOR_COLORS.neutro },
      { role: 'pe', sectionMM2: 2.5, color: AEA_CONDUCTOR_COLORS.pe }
    ]
  }
] as const;

/** Sugerencias de Claves Técnicas y Mediciones de Campo (TRAZA / Instrumental) */
export const SUGGESTED_ELEMENT_METADATA_KEYS = [
  'PAT (Ohm)',
  'Tensión Vfn',
  'Tensión Vft',
  'Tensión Vnt',
  'Aislación (MOhm)',
  'Corriente (A)',
  'Disyuntor (ms)',
  'Marca',
  'Modelo',
  'IP',
  'Tipo Lámpara',
  'Consumo (W)'
] as const;

// ─── CATÁLOGOS INICIALES POR DEFECTO (3 CATEGORÍAS RÍGIDAS CON TIPOS EXTENSIBLES) ───

export const DEFAULT_CONDUIT_TYPES: ConduitTypeDefinition[] = [
  {
    id: 'hierro_semipesado_rs',
    name: 'Caño Hierro Semipesado RS',
    description: 'Acero semipesado según IRAM-IAS U 500-2604 (losas y embutido)',
    defaultSizeMM: 19,
    availableSizes: [
      { value: 16, label: 'RS 16 (5/8")', standardSize: 'RS 16', usefulAreaMM2: 143.1 },
      { value: 19, label: 'RS 19 (3/4") [Estándar]', standardSize: 'RS 19', usefulAreaMM2: 213.8 },
      { value: 22, label: 'RS 22 (7/8")', standardSize: 'RS 22', usefulAreaMM2: 298.6 },
      { value: 25, label: 'RS 25 (1")', standardSize: 'RS 25', usefulAreaMM2: 394.1 },
      { value: 32, label: 'RS 32 (1 1/4")', standardSize: 'RS 32', usefulAreaMM2: 642.4 },
      { value: 38, label: 'RS 38 (1 1/2")', standardSize: 'RS 38', usefulAreaMM2: 934.8 },
      { value: 51, label: 'RS 51 (2")', standardSize: 'RS 51', usefulAreaMM2: 1705.5 }
    ]
  },
  {
    id: 'hierro_liviano_rl',
    name: 'Hierro Liviano RL',
    description: 'Acero liviano con costura IRAM-IAS U 500-2005',
    defaultSizeMM: 19,
    availableSizes: [
      { value: 16, label: 'RL 16 (5/8")', standardSize: 'RL 16', usefulAreaMM2: 158.4 },
      { value: 19, label: 'RL 19 (3/4") [Estándar]', standardSize: 'RL 19', usefulAreaMM2: 232.4 },
      { value: 22, label: 'RL 22 (7/8")', standardSize: 'RL 22', usefulAreaMM2: 320.5 },
      { value: 25, label: 'RL 25 (1")', standardSize: 'RL 25', usefulAreaMM2: 422.7 },
      { value: 32, label: 'RL 32 (1 1/4")', standardSize: 'RL 32', usefulAreaMM2: 678.9 },
      { value: 38, label: 'RL 38 (1 1/2")', standardSize: 'RL 38', usefulAreaMM2: 973.1 },
      { value: 51, label: 'RL 51 (2")', standardSize: 'RL 51', usefulAreaMM2: 1749.7 }
    ]
  },
  {
    id: 'pvc_rigido_metrico',
    name: 'Caño PVC Rígido (métrico)',
    description: 'Termoplástico rígido curvable en caliente IRAM 62386-21',
    defaultSizeMM: 20,
    availableSizes: [
      { value: 16, label: 'Ø16 mm (Métrico)', standardSize: 'PVC 16', usefulAreaMM2: 132.7 },
      { value: 20, label: 'Ø20 mm (Métrico) [Estándar]', standardSize: 'PVC 20', usefulAreaMM2: 221.7 },
      { value: 25, label: 'Ø25 mm (Métrico)', standardSize: 'PVC 25', usefulAreaMM2: 363.0 },
      { value: 32, label: 'Ø32 mm (Métrico)', standardSize: 'PVC 32', usefulAreaMM2: 615.7 },
      { value: 40, label: 'Ø40 mm (Métrico)', standardSize: 'PVC 40', usefulAreaMM2: 989.8 },
      { value: 50, label: 'Ø50 mm (Métrico)', standardSize: 'PVC 50', usefulAreaMM2: 1590.4 },
      { value: 63, label: 'Ø63 mm (Métrico)', standardSize: 'PVC 63', usefulAreaMM2: 2551.7 }
    ]
  },
  {
    id: 'corrugado_blanco_pvc',
    name: 'Corrugado Blanco PVC',
    description: 'Termoplástico corrugado liviano IRAM 62386-22',
    defaultSizeMM: 20,
    availableSizes: [
      { value: 16, label: 'Ø16 mm (5/8")', standardSize: 'Corrugado 16', usefulAreaMM2: 132.7 },
      { value: 20, label: 'Ø20 mm (3/4") [Estándar]', standardSize: 'Corrugado 20', usefulAreaMM2: 201.0 },
      { value: 22, label: 'Ø22 mm (7/8")', standardSize: 'Corrugado 22', usefulAreaMM2: 254.4 },
      { value: 25, label: 'Ø25 mm (1")', standardSize: 'Corrugado 25', usefulAreaMM2: 314.1 },
      { value: 32, label: 'Ø32 mm (1 1/4")', standardSize: 'Corrugado 32', usefulAreaMM2: 530.9 }
    ]
  },
  {
    id: 'corrugado_naranja',
    name: 'Corrugado Naranja (Existente)',
    description: 'Corrugado no ignífugo habitual en instalaciones existentes',
    defaultSizeMM: 20,
    availableSizes: [
      { value: 16, label: 'Ø16 mm (5/8")', standardSize: 'Naranja 16', usefulAreaMM2: 132.7 },
      { value: 20, label: 'Ø20 mm (3/4")', standardSize: 'Naranja 20', usefulAreaMM2: 201.0 },
      { value: 25, label: 'Ø25 mm (1")', standardSize: 'Naranja 25', usefulAreaMM2: 314.1 }
    ]
  },
  {
    id: 'manguera_negra',
    name: 'Manguera Negra Polietileno',
    description: 'Manguera plástica flexible (común en relevamientos rurales/precarios)',
    defaultSizeMM: 19,
    availableSizes: [
      { value: 16, label: '1/2" (13 mm)', standardSize: 'Manguera 1/2"', usefulAreaMM2: 132.7 },
      { value: 19, label: '3/4" (19 mm)', standardSize: 'Manguera 3/4"', usefulAreaMM2: 283.5 },
      { value: 25, label: '1" (25 mm)', standardSize: 'Manguera 1"', usefulAreaMM2: 490.8 }
    ]
  },
  {
    id: 'bandeja_perforada_20',
    name: 'Bandeja Perforada de 20',
    description: 'Chapa de acero perforada ala 20 mm para montaje superficial',
    defaultSizeMM: 100,
    availableSizes: [
      { value: 50, label: '50 × 20 mm', standardSize: 'Bandeja 50x20', usefulAreaMM2: 1000, isTray: true },
      { value: 100, label: '100 × 20 mm', standardSize: 'Bandeja 100x20', usefulAreaMM2: 2000, isTray: true },
      { value: 150, label: '150 × 20 mm', standardSize: 'Bandeja 150x20', usefulAreaMM2: 3000, isTray: true },
      { value: 200, label: '200 × 20 mm', standardSize: 'Bandeja 200x20', usefulAreaMM2: 4000, isTray: true },
      { value: 300, label: '300 × 20 mm', standardSize: 'Bandeja 300x20', usefulAreaMM2: 6000, isTray: true }
    ]
  }
];

export const DEFAULT_CABLE_TYPES: CableTypeDefinition[] = [
  {
    id: 'IRAM_NM_247_3',
    name: 'IRAM NM 247-3 (Unipolar PVC)',
    description: 'Antiflama 450/750V estándar para canalizaciones embutidas o a la vista',
    defaultSectionMM2: 2.5,
    availableSectionsMM2: [1.0, 1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0]
  },
  {
    id: 'IRAM_62267_LSOH',
    name: 'IRAM 62267 (Libre de Halógenos)',
    description: 'Baja emisión de humos y cero halógenos (Afumex / LSOH)',
    defaultSectionMM2: 2.5,
    availableSectionsMM2: [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0]
  },
  {
    id: 'IRAM_2178_SUB',
    name: 'IRAM 2178 (Subterráneo / Sintenax)',
    description: 'Aislación XLPE / Vaina exterior resistente a intemperie 0.6/1.1 kV',
    defaultSectionMM2: 4.0,
    availableSectionsMM2: [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0]
  },
  {
    id: 'IRAM_NM_247_5',
    name: 'IRAM NM 247-5 (Tipo Taller)',
    description: 'Conductor flexible envainado redondo doble aislación',
    defaultSectionMM2: 2.5,
    availableSectionsMM2: [1.0, 1.5, 2.5, 4.0]
  },
  {
    id: 'TELA_GOMA',
    name: 'Antiguo Tela / Goma (Histórico)',
    description: 'Conductores antiguos con trenza textil o goma vulcanizada',
    defaultSectionMM2: 1.5,
    availableSectionsMM2: [1.0, 1.5, 2.5, 4.0]
  },
  {
    id: 'ALAMBRE_MACIZO',
    name: 'Alambre de Cobre Macizo',
    description: 'Conductor rígido macizo sin hebras flexibles',
    defaultSectionMM2: 2.0,
    availableSectionsMM2: [1.0, 1.5, 2.0, 2.5, 4.0]
  }
];

export const DEFAULT_BOX_TYPES: BoxTypeDefinition[] = [
  {
    id: 'caja_rectangular_chapa',
    name: 'Caja Rectangular 5x10 (Chapa)',
    category: 'caja_rectangular',
    materialBase: 'chapa',
    description: 'Chapa de acero estampada embutida'
  },
  {
    id: 'caja_rectangular_pvc',
    name: 'Caja Rectangular 5x10 (PVC)',
    category: 'caja_rectangular',
    materialBase: 'pvc',
    description: 'Termoplástico ignífugo embutido'
  },
  {
    id: 'caja_octogonal_chica',
    name: 'Caja Octogonal Chica 75mm',
    category: 'caja_octogonal',
    materialBase: 'chapa',
    description: 'Para centros de iluminación y apliques'
  },
  {
    id: 'caja_octogonal_grande',
    name: 'Caja Octogonal Grande 90mm (Losa)',
    category: 'caja_octogonal',
    materialBase: 'chapa',
    description: 'Para cruce de cañerías en losa'
  },
  {
    id: 'caja_cuadrada_10x10',
    name: 'Caja Cuadrada 10x10 (Paso / Derivación)',
    category: 'caja_cuadrada',
    materialBase: 'chapa',
    description: 'Caja de paso para empalmes y tirada'
  },
  {
    id: 'caja_mignon',
    name: 'Caja Mignon (5x5)',
    category: 'caja_mignon',
    materialBase: 'chapa',
    description: 'Para tomas pequeños o pulsadores'
  },
  {
    id: 'gabinete_tablero_embutir',
    name: 'Gabinete Tablero Embutir DIN',
    category: 'gabinete_tablero',
    materialBase: 'pvc',
    description: 'Gabinete plástico o metálico para riel DIN'
  },
  {
    id: 'gabinete_tablero_superficie',
    name: 'Gabinete Tablero Superficie DIN',
    category: 'gabinete_tablero',
    materialBase: 'chapa',
    description: 'Gabinete exterior estanco o chapa'
  }
];

export function createDefaultMaterialCatalog(): ProjectMaterialCatalog {
  return {
    conduitTypes: [...DEFAULT_CONDUIT_TYPES],
    cableTypes: [...DEFAULT_CABLE_TYPES],
    boxTypes: [...DEFAULT_BOX_TYPES]
  };
}

export function getSizesForConduitType(
  typeId: string,
  catalog?: ProjectMaterialCatalog
): readonly ConduitSizeOption[] {
  const found = catalog?.conduitTypes.find((c) => c.id === typeId);
  if (found && found.availableSizes.length > 0) {
    return found.availableSizes;
  }
  return CONDUIT_SIZES_BY_MATERIAL[typeId] || CONDUIT_SIZES_BY_MATERIAL.hierro_semipesado_rs;
}

export function getDefaultSizeForConduitType(
  typeId: string,
  catalog?: ProjectMaterialCatalog
): number {
  const found = catalog?.conduitTypes.find((c) => c.id === typeId);
  if (found) return found.defaultSizeMM;
  return getDefaultSizeForConduitMaterial(typeId as ConduitMaterial);
}

