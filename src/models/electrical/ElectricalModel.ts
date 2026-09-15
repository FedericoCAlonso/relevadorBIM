/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: ElectricalModel.ts
 * Dominio Electromecánico según Norma AEA 90364-771.
 * Bocas, Tableros, Circuitos, Cañerías y Montantes Verticales.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type ElementPlacement = 'ceiling' | 'wall' | 'floor';

export type ConductorRole =
  | 'fase'
  | 'neutro'
  | 'pe'
  | 'retorno'
  | 'fase_r'
  | 'fase_s'
  | 'fase_t'
  | 'comando';

export type CableStandard =
  | 'IRAM_NM_247_3'     // Unipolar estándar PVC antiflama 450/750V
  | 'IRAM_62267_LSOH'   // Libre de halógenos y baja emisión de humos (lugares concurridos)
  | 'IRAM_2178_SUB'     // Subterráneo / intemperie 0.6/1.1 kV
  | 'IRAM_NM_247_5';    // Tipo Taller doble aislación

export interface ConductorLine {
  role: ConductorRole;
  sectionMM2: number;      // Sección en mm² (ej: 1.5, 2.5, 4.0, 6.0)
  color?: string;          // Marrón, celeste, verde-amarillo, etc.
  reference?: string;      // Referencia o letra de retorno (ej: "a", "b", "c")
  cableStandard?: CableStandard;
}

export interface ElectricalElement {
  id: string;
  symbolId: string;        // ID de la biblioteca (ej: 'sym-planta-boca-techo', 'sym-planta-toma')
  levelId: string;         // Planta donde se ubica
  spaceId: string;         // ID del ambiente al que pertenece
  placement: ElementPlacement; // 'ceiling' (techo), 'wall' (pared), 'floor' (piso)
  x: number;               // Coordenada X global en metros
  y: number;               // Coordenada Y global en metros
  heightZ: number;         // Altura Z sobre el piso del nivel en metros (ej: 0.30 para tomas, 1.20 para llaves, 2.70 para centros)
  wallId?: string | null;  // Si está adosado a una pared específica
  wallOffset?: number;     // Distancia a lo largo de la pared en metros
  circuitId?: string | null;
  label?: string;          // Ej: "IUG 1", "TUG 2", "B1"
  returnRef?: string;      // Letra o código de retorno (ej: "a", "b") para enlazar llave con luminaria
  notes?: string;

  // ─── PROPIEDADES ENRIQUECIDAS DE TRAZA ───
  rotation?: number;       // Ángulo de giro en grados (0-360) para orientación automática sobre paredes
  side?: 'left' | 'right' | 'interior' | 'exterior'; // Lado de la pared donde se ubica
  status?: 'existente' | 'proyectado' | 'a_reemplazar'; // Estado de relevamiento (TRAZA)
  powerW?: number;         // Potencia nominal estimada en Watts (TRAZA)
  phases?: 1 | 3;          // 1 = Monofásico, 3 = Trifásico (TRAZA)
  isPanel?: boolean;       // Indica si representa un tablero eléctrico
  attributes?: Array<{ key: string; value: string }>; // Metadatos técnicos libres clave-valor (TRAZA)
  earthMeasurement?: {
    ohms: number;
    method: 'caida_tension' | 'dos_puntas';
    date: string;
  };
}

export type ConduitMaterial = 'corrugado_blanco' | 'corrugado_ignifugo' | 'cano_rigido_pvc' | 'cano_acero' | 'bandeja';

export interface Conduit {
  id: string;
  circuitId?: string | null;
  circuitIds?: string[];    // Soporte multi-circuito de TRAZA
  fromElementId: string;    // ID del elemento eléctrico de inicio
  toElementId: string;      // ID del elemento eléctrico final
  fromLevelId: string;
  toLevelId: string;
  diameterMM: number;       // Diámetro exterior en mm (19 = 3/4", 22 = 7/8", 25 = 1", 32 = 1 1/4")
  material: ConduitMaterial;
  isVerticalRiser: boolean; // ¿Es montante que atraviesa losa entre pisos?
  conductors: ConductorLine[];
  manualLengthM?: number;   // Longitud forzada manualmente si aplica
  label?: string;           // Referencia o rótulo en plano (ej: "C1", "X1")
  defaultCableStandard?: CableStandard; // Norma de conductor principal
  notes?: string;
}

export type CircuitType = 'IUG' | 'IUE' | 'TUG' | 'TUE' | 'FM' | 'ACU' | 'OTRO';

export interface Circuit {
  id: string;
  panelId: string;          // Tablero alimentador
  name: string;             // Ej: "C1 - IUG Planta Baja"
  type: CircuitType;
  voltageV: number;         // 220 o 380
  wireSectionBaseMM2: number; // Sección troncal (ej: 2.5 mm²)
  breakerAmperageA: number;   // Calibre de la termomagnética (ej: 10, 16, 20, 25 A)
  differentialId?: string;    // ID del disyuntor que lo protege
  color?: string;
  description?: string;
}

export interface Panel {
  id: string;
  name: string;             // Ej: "Tablero Principal (TP)", "Tablero Seccional (TS1)"
  type: 'principal' | 'seccional' | 'auxiliar';
  levelId: string;
  spaceId: string;
  elementId: string;        // ID de la boca de tablero asociada
  isThreePhase: boolean;    // Monofásico o trifásico
  mainBreakerAmperageA: number; // Termomagnética de cabecera (ej: 32A, 40A)
  mainDifferentialAmperageA: number; // Disyuntor cabecera (ej: 40A 30mA)
}
