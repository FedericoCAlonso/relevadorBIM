/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: cableManufacturerCatalog.ts
 * Catálogo Técnico de Cables por Fabricante y Métodos de Tendido AEA/IEC.
 * 
 * Permite realizar cálculos electromecánicos rigurosos con datos de fabricante:
 * - Resistencia efectiva a temperatura de régimen (R en Ohm/km a 70°C/90°C).
 * - Reactancia inductiva (X en Ohm/km a 50 Hz).
 * - Corriente admisible base (Iz0) según método de instalación físico.
 * - Factores de corrección de la norma: agrupamiento (fn) y temperatura (fT).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Métodos normalizados de instalación según AEA 90364-7-771 / IEC 60364-5-52.
 */
export type InstallationMethodCode =
  | 'B1' // Cañería a la vista sobre mampostería / cielo raso
  | 'B2' // Cañería embutida en mampostería / losa
  | 'C'  // Cable fijado directamente sobre pared
  | 'D1' // Cable multiconductor enterrado directo en zanja
  | 'D2' // Cable en caño o conducto enterrado
  | 'E'  // Bandeja perforada (horizontal)
  | 'F'; // Bandeja perforada (unipolares en contacto)

export interface InstallationMethodDefinition {
  readonly code: InstallationMethodCode;
  readonly label: string;
  readonly description: string;
  readonly isUnderground: boolean;
}

export const INSTALLATION_METHODS: readonly InstallationMethodDefinition[] = [
  {
    code: 'B2',
    label: 'B2 · Embutido en Mampostería / Losa',
    description: 'Cañería aislante o metálica embutida en pared o losa de hormigón.',
    isUnderground: false
  },
  {
    code: 'B1',
    label: 'B1 · A la Vista sobre Pared / Cielorraso',
    description: 'Cañería rígida o metálica fijada superficialmente sobre pared o techo.',
    isUnderground: false
  },
  {
    code: 'E',
    label: 'E · Bandeja Portacables Perforada',
    description: 'Cables tendidos en bandeja perforada horizontal o canastilla.',
    isUnderground: false
  },
  {
    code: 'C',
    label: 'C · Fijado Directo a la Pared',
    description: 'Cables tipo Sintenax fijados directamente sobre la estructura con grapas.',
    isUnderground: false
  },
  {
    code: 'D1',
    label: 'D1 · Enterrado Directo en Zanja',
    description: 'Cable con armadura o protección mecánica tendido directamente en zanja de tierra.',
    isUnderground: true
  },
  {
    code: 'D2',
    label: 'D2 · En Conducto Enterrado',
    description: 'Cable alojado dentro de tritubo o cañería de PEAD bajo tierra.',
    isUnderground: true
  },
  {
    code: 'F',
    label: 'F · Bandeja Perforada (Unipolares en contacto)',
    description: 'Cables unipolares tendidos en contacto mutuo en bandeja perforada.',
    isUnderground: false
  }
];

/**
 * Fila técnica por sección nominal con características eléctricas de fabricante.
 */
export interface CableManufacturerRow {
  sectionMM2: number;
  resistanceOhmKm: number;    // R a temperatura de régimen (70°C para PVC, 90°C para XLPE)
  reactanceOhmKm: number;     // XL a 50 Hz
  baseAmpacityA: {            // Corriente admisible base Iz0 a 30°C aire / 20°C tierra
    B1: number;
    B2: number;
    C?: number;
    D1?: number;
    D2?: number;
    E?: number;
    F?: number;
  };
}

export interface CableManufacturerCatalog {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly standard: string;
  readonly insulationType: 'PVC_70' | 'XLPE_90';
  readonly maxOperatingTempC: number;
  readonly isCustom?: boolean;
  readonly rows: readonly CableManufacturerRow[];
}

// ─── 1. CATÁLOGO OFICIAL GENÉRICO IRAM / AEA 90364-771 ───────────────────
// Datos según Norma IRAM NM 247-3 (cobre unipolar PVC 70°C) y AEA 771.19
export const IRAM_GENERIC_CATALOG: CableManufacturerCatalog = {
  id: 'iram_generico_247_3',
  name: 'Norma IRAM NM 247-3 / AEA 771 (Genérico Oficial)',
  manufacturer: 'Normativo IRAM',
  standard: 'IRAM NM 247-3',
  insulationType: 'PVC_70',
  maxOperatingTempC: 70,
  rows: [
    {
      sectionMM2: 1.5,
      resistanceOhmKm: 13.3,
      reactanceOhmKm: 0.118,
      baseAmpacityA: { B1: 15.5, B2: 15.0, C: 17.5, E: 18.5, D1: 22.0, D2: 18.0 }
    },
    {
      sectionMM2: 2.5,
      resistanceOhmKm: 7.98,
      reactanceOhmKm: 0.110,
      baseAmpacityA: { B1: 21.0, B2: 20.0, C: 24.0, E: 25.0, D1: 29.0, D2: 24.0 }
    },
    {
      sectionMM2: 4.0,
      resistanceOhmKm: 4.95,
      reactanceOhmKm: 0.105,
      baseAmpacityA: { B1: 28.0, B2: 27.0, C: 32.0, E: 34.0, D1: 38.0, D2: 31.0 }
    },
    {
      sectionMM2: 6.0,
      resistanceOhmKm: 3.30,
      reactanceOhmKm: 0.100,
      baseAmpacityA: { B1: 36.0, B2: 34.0, C: 41.0, E: 43.0, D1: 47.0, D2: 39.0 }
    },
    {
      sectionMM2: 10.0,
      resistanceOhmKm: 1.91,
      reactanceOhmKm: 0.095,
      baseAmpacityA: { B1: 50.0, B2: 46.0, C: 57.0, E: 60.0, D1: 63.0, D2: 52.0 }
    },
    {
      sectionMM2: 16.0,
      resistanceOhmKm: 1.21,
      reactanceOhmKm: 0.090,
      baseAmpacityA: { B1: 68.0, B2: 62.0, C: 76.0, E: 80.0, D1: 81.0, D2: 67.0 }
    },
    {
      sectionMM2: 25.0,
      resistanceOhmKm: 0.78,
      reactanceOhmKm: 0.088,
      baseAmpacityA: { B1: 89.0, B2: 80.0, C: 101.0, E: 106.0, D1: 104.0, D2: 86.0 }
    },
    {
      sectionMM2: 35.0,
      resistanceOhmKm: 0.524,
      reactanceOhmKm: 0.085,
      baseAmpacityA: { B1: 110.0, B2: 99.0, C: 125.0, E: 131.0, D1: 125.0, D2: 103.0 }
    },
    {
      sectionMM2: 50.0,
      resistanceOhmKm: 0.387,
      reactanceOhmKm: 0.083,
      baseAmpacityA: { B1: 134.0, B2: 118.0, C: 151.0, E: 159.0, D1: 148.0, D2: 122.0 }
    }
  ]
};

// ─── 2. CATÁLOGO PRYSMIAN (SUPERASTIC / SINTENAX) ─────────────────────────
// Datos técnicos oficiales de fabricante Prysmian Argentina a 70°C
export const PRYSMIAN_SUPERASTIC_CATALOG: CableManufacturerCatalog = {
  id: 'prysmian_superastic',
  name: 'Prysmian · Superastic Flex (IRAM NM 247-3 / BWF)',
  manufacturer: 'Prysmian Group',
  standard: 'IRAM NM 247-3',
  insulationType: 'PVC_70',
  maxOperatingTempC: 70,
  rows: [
    {
      sectionMM2: 1.5,
      resistanceOhmKm: 13.3,
      reactanceOhmKm: 0.117,
      baseAmpacityA: { B1: 16.0, B2: 15.0, C: 18.0, E: 19.0, D1: 22.0, D2: 18.0 }
    },
    {
      sectionMM2: 2.5,
      resistanceOhmKm: 7.98,
      reactanceOhmKm: 0.109,
      baseAmpacityA: { B1: 22.0, B2: 21.0, C: 25.0, E: 26.0, D1: 30.0, D2: 25.0 }
    },
    {
      sectionMM2: 4.0,
      resistanceOhmKm: 4.95,
      reactanceOhmKm: 0.104,
      baseAmpacityA: { B1: 30.0, B2: 28.0, C: 34.0, E: 36.0, D1: 39.0, D2: 32.0 }
    },
    {
      sectionMM2: 6.0,
      resistanceOhmKm: 3.30,
      reactanceOhmKm: 0.099,
      baseAmpacityA: { B1: 38.0, B2: 36.0, C: 43.0, E: 45.0, D1: 49.0, D2: 41.0 }
    },
    {
      sectionMM2: 10.0,
      resistanceOhmKm: 1.91,
      reactanceOhmKm: 0.094,
      baseAmpacityA: { B1: 53.0, B2: 50.0, C: 60.0, E: 63.0, D1: 65.0, D2: 54.0 }
    },
    {
      sectionMM2: 16.0,
      resistanceOhmKm: 1.21,
      reactanceOhmKm: 0.089,
      baseAmpacityA: { B1: 71.0, B2: 66.0, C: 80.0, E: 85.0, D1: 85.0, D2: 70.0 }
    },
    {
      sectionMM2: 25.0,
      resistanceOhmKm: 0.78,
      reactanceOhmKm: 0.087,
      baseAmpacityA: { B1: 94.0, B2: 84.0, C: 106.0, E: 112.0, D1: 109.0, D2: 90.0 }
    },
    {
      sectionMM2: 35.0,
      resistanceOhmKm: 0.524,
      reactanceOhmKm: 0.084,
      baseAmpacityA: { B1: 117.0, B2: 104.0, C: 131.0, E: 138.0, D1: 130.0, D2: 108.0 }
    },
    {
      sectionMM2: 50.0,
      resistanceOhmKm: 0.387,
      reactanceOhmKm: 0.082,
      baseAmpacityA: { B1: 141.0, B2: 125.0, C: 159.0, E: 168.0, D1: 155.0, D2: 128.0 }
    }
  ]
};

// ─── 3. CATÁLOGO IMSA (PLASVINIL / PRONOX) ────────────────────────────────
export const IMSA_PLASVINIL_CATALOG: CableManufacturerCatalog = {
  id: 'imsa_plasvinil',
  name: 'IMSA · Plasvinil Extra Flex (IRAM NM 247-3)',
  manufacturer: 'IMSA',
  standard: 'IRAM NM 247-3',
  insulationType: 'PVC_70',
  maxOperatingTempC: 70,
  rows: [
    {
      sectionMM2: 1.5,
      resistanceOhmKm: 13.3,
      reactanceOhmKm: 0.118,
      baseAmpacityA: { B1: 15.5, B2: 15.0, C: 17.5, E: 18.5, D1: 22.0, D2: 18.0 }
    },
    {
      sectionMM2: 2.5,
      resistanceOhmKm: 7.98,
      reactanceOhmKm: 0.110,
      baseAmpacityA: { B1: 21.0, B2: 20.0, C: 24.0, E: 25.0, D1: 29.0, D2: 24.0 }
    },
    {
      sectionMM2: 4.0,
      resistanceOhmKm: 4.95,
      reactanceOhmKm: 0.105,
      baseAmpacityA: { B1: 28.0, B2: 27.0, C: 32.0, E: 34.0, D1: 38.0, D2: 31.0 }
    },
    {
      sectionMM2: 6.0,
      resistanceOhmKm: 3.30,
      reactanceOhmKm: 0.100,
      baseAmpacityA: { B1: 36.0, B2: 34.0, C: 41.0, E: 43.0, D1: 47.0, D2: 39.0 }
    },
    {
      sectionMM2: 10.0,
      resistanceOhmKm: 1.91,
      reactanceOhmKm: 0.095,
      baseAmpacityA: { B1: 50.0, B2: 46.0, C: 57.0, E: 60.0, D1: 63.0, D2: 52.0 }
    },
    {
      sectionMM2: 16.0,
      resistanceOhmKm: 1.21,
      reactanceOhmKm: 0.090,
      baseAmpacityA: { B1: 68.0, B2: 62.0, C: 76.0, E: 80.0, D1: 81.0, D2: 67.0 }
    },
    {
      sectionMM2: 25.0,
      resistanceOhmKm: 0.78,
      reactanceOhmKm: 0.088,
      baseAmpacityA: { B1: 89.0, B2: 80.0, C: 101.0, E: 106.0, D1: 104.0, D2: 86.0 }
    },
    {
      sectionMM2: 35.0,
      resistanceOhmKm: 0.524,
      reactanceOhmKm: 0.085,
      baseAmpacityA: { B1: 110.0, B2: 99.0, C: 125.0, E: 131.0, D1: 125.0, D2: 103.0 }
    },
    {
      sectionMM2: 50.0,
      resistanceOhmKm: 0.387,
      reactanceOhmKm: 0.083,
      baseAmpacityA: { B1: 134.0, B2: 118.0, C: 151.0, E: 159.0, D1: 148.0, D2: 122.0 }
    }
  ]
};

export const PRELOADED_CABLE_CATALOGS: readonly CableManufacturerCatalog[] = [
  IRAM_GENERIC_CATALOG,
  PRYSMIAN_SUPERASTIC_CATALOG,
  IMSA_PLASVINIL_CATALOG
];

// ─── 4. FACTORES DE CORRECCIÓN DE LA NORMA AEA 90364-771 ───────────────────

/**
 * Factor de corrección por agrupamiento de circuitos (fn) según Tabla 771.19.V.
 * Contempla la cantidad de circuitos o cables que comparten la misma canalización.
 */
export function calculateGroupingFactor(circuitsCount: number): number {
  if (circuitsCount <= 1) return 1.0;
  if (circuitsCount === 2) return 0.80;
  if (circuitsCount === 3) return 0.70;
  if (circuitsCount === 4) return 0.65;
  if (circuitsCount === 5) return 0.60;
  if (circuitsCount === 6) return 0.57;
  if (circuitsCount === 7) return 0.54;
  if (circuitsCount === 8) return 0.52;
  return 0.50; // 9 o más circuitos en el mismo conducto
}

/**
 * Factor de corrección por temperatura ambiente (fT) según Tabla 771.19.VI.
 * Temperatura de referencia estándar en aire: 30°C.
 */
export function calculateTemperatureFactor(
  ambientTempC: number = 30,
  insulationType: 'PVC_70' | 'XLPE_90' = 'PVC_70'
): number {
  if (insulationType === 'PVC_70') {
    if (ambientTempC <= 20) return 1.12;
    if (ambientTempC <= 25) return 1.06;
    if (ambientTempC <= 30) return 1.00;
    if (ambientTempC <= 35) return 0.94;
    if (ambientTempC <= 40) return 0.87;
    if (ambientTempC <= 45) return 0.79;
    if (ambientTempC <= 50) return 0.71;
    return 0.61;
  } else {
    // XLPE_90
    if (ambientTempC <= 20) return 1.08;
    if (ambientTempC <= 25) return 1.04;
    if (ambientTempC <= 30) return 1.00;
    if (ambientTempC <= 35) return 0.96;
    if (ambientTempC <= 40) return 0.91;
    if (ambientTempC <= 45) return 0.87;
    if (ambientTempC <= 50) return 0.82;
    return 0.76;
  }
}

/**
 * Obtiene la corriente admisible corregida (Iz) para un cable y método determinado.
 */
export function calculateCorrectedAmpacity(params: {
  sectionMM2: number;
  method: InstallationMethodCode;
  catalog?: CableManufacturerCatalog;
  circuitsCount?: number;
  ambientTempC?: number;
}): {
  baseAmpacityA: number;
  correctedAmpacityA: number;
  groupingFactor: number;
  temperatureFactor: number;
  resistanceOhmKm: number;
  reactanceOhmKm: number;
} {
  const {
    sectionMM2,
    method,
    catalog = IRAM_GENERIC_CATALOG,
    circuitsCount = 1,
    ambientTempC = 30
  } = params;

  const row =
    catalog.rows.find((r) => r.sectionMM2 === sectionMM2) ||
    catalog.rows[0];

  const baseAmpacity = row.baseAmpacityA[method] ?? row.baseAmpacityA.B2 ?? 15.0;
  const groupingFactor = calculateGroupingFactor(circuitsCount);
  const temperatureFactor = calculateTemperatureFactor(ambientTempC, catalog.insulationType);

  const correctedAmpacityA = Number((baseAmpacity * groupingFactor * temperatureFactor).toFixed(1));

  return {
    baseAmpacityA: baseAmpacity,
    correctedAmpacityA,
    groupingFactor,
    temperatureFactor,
    resistanceOhmKm: row.resistanceOhmKm,
    reactanceOhmKm: row.reactanceOhmKm
  };
}
