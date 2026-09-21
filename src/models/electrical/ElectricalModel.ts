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

export interface ConductorLine {
  role: ConductorRole;
  sectionMM2: number;      // Sección en mm² (ej: 1.5, 2.5, 4.0, 6.0)
  color?: string;          // Marrón, celeste, verde-amarillo, etc.
  reference?: string;      // Referencia o letra de retorno (ej: "a", "b", "c")
  cableStandard?: CableStandard;
  circuitId?: string;      // ID del circuito al que pertenece este conductor en el conducto
}

export interface SpatialElectricalNode {
  id: string;
  levelId: string;
  spaceId: string;
  x: number;
  y: number;
  heightZ: number;
  wallId?: string | null;
  wallOffset?: number;
  rotation?: number;
  side?: 'left' | 'right' | 'interior' | 'exterior';
}

export interface ElectricalElement extends SpatialElectricalNode {
  symbolId: string;        // ID de la biblioteca (ej: 'sym-planta-boca-techo', 'sym-planta-toma')
  placement: ElementPlacement; // 'ceiling' (techo), 'wall' (pared), 'floor' (piso)
  circuitId?: string | null; // Circuito asignado que alimenta el consumo de esta boca
  passingCircuitIds?: string[]; // Circuitos adicionales que transitan o pasan por esta caja (caja de paso/derivación)
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
  boxTypeId?: string;     // Tipo de caja / contenedor físico asociado
  attributes?: Array<{ key: string; value: string }>; // Metadatos técnicos libres clave-valor (TRAZA)
  isTerminalReference?: boolean; // Verdadero si representa un remate o etiqueta de caño/referencia (no es caja física ni boca de consumo)
  targetDescription?: string; // Destino de la referencia (ej: "A Tablero General en SS", "Continúa en Plano IE-02")
  targetPanelId?: string | null; // ID del tablero destino si aplica
  additionalLengthM?: number; // Metros adicionales de conducto/montante fuera de plano
  earthMeasurement?: {
    ohms: number;
    method: 'caida_tension' | 'dos_puntas';
    date: string;
  };
}

export type BuiltinConduitMaterial =
  | 'hierro_semipesado_rs'
  | 'hierro_liviano_rl'
  | 'pvc_rigido_metrico'
  | 'corrugado_blanco_pvc'
  | 'bandeja_perforada_20'
  | 'corrugado_naranja'
  | 'manguera_negra'
  | 'corrugado_blanco'
  | 'corrugado_ignifugo'
  | 'cano_rigido_pvc'
  | 'cano_acero'
  | 'bandeja';

export type ConduitMaterial = BuiltinConduitMaterial | (string & {});

export type BuiltinCableStandard =
  | 'IRAM_NM_247_3'     // Unipolar estándar PVC antiflama 450/750V
  | 'IRAM_62267_LSOH'   // Libre de halógenos y baja emisión de humos (lugares concurridos)
  | 'IRAM_2178_SUB'     // Subterráneo / intemperie 0.6/1.1 kV
  | 'IRAM_NM_247_5'     // Tipo Taller doble aislación
  | 'TELA_GOMA'         // Antiguo tela/goma
  | 'ALAMBRE_MACIZO';   // Alambre macizo

export type CableStandard = BuiltinCableStandard | (string & {});

// ─── DEFINICIONES DE LAS 3 CATEGORÍAS FÍSICAS RÍGIDAS CON CATÁLOGO ABIERTO ───

export interface ConduitSizeOption {
  value: number;            // Dimensión en mm (diámetro exterior o ancho de bandeja)
  label: string;            // Etiqueta legible (ej: 'RS 19 (3/4")')
  standardSize?: string;    // Denominación estándar comercial
  usefulAreaMM2?: number;   // Sección útil interior en mm² para cálculo de ocupación
  isTray?: boolean;         // ¿Es bandeja portacables?
}

export interface ConduitTypeDefinition {
  id: string;
  name: string;             // Ej: "Caño Hierro Semipesado RS", "Manguera Negra de Riego"
  description?: string;
  availableSizes: ConduitSizeOption[];
  defaultSizeMM: number;
  isCustom?: boolean;       // True si fue agregado por el usuario
}

export interface CableTypeDefinition {
  id: string;
  name: string;             // Ej: "IRAM NM 247-3 (Unipolar PVC)", "Antiguo Tela / Goma"
  description?: string;
  availableSectionsMM2: number[]; // Ej: [1.0, 1.5, 2.5, 4.0, 6.0, 10.0]
  defaultSectionMM2: number;
  isCustom?: boolean;
}

export type BoxCategory =
  | 'caja_rectangular'
  | 'caja_octogonal'
  | 'caja_cuadrada'
  | 'caja_mignon'
  | 'gabinete_tablero'
  | 'otro';

export type BoxMaterialBase = 'chapa' | 'pvc' | 'aluminio' | 'otro';

export interface BoxTypeDefinition {
  id: string;
  name: string;             // Ej: "Caja Rectangular 5x10 Chapa", "Caja Octogonal Chica", "Gabinete 12 Polos DIN"
  category: BoxCategory;
  materialBase?: BoxMaterialBase;
  description?: string;
  isCustom?: boolean;
}

export interface ProjectMaterialCatalog {
  conduitTypes: ConduitTypeDefinition[];
  cableTypes: CableTypeDefinition[];
  boxTypes: BoxTypeDefinition[];
}

export type ConduitRoutingPlane = 'ceiling_slab' | 'floor_slab' | 'wall';

export type LabelDisplayMode = 'full' | 'circuit_element' | 'element_only';

export interface ConduitWaypoint {
  x: number;
  y: number;
  heightZ?: number;
  isVerticalTransition?: boolean;
  transitionType?: 'none' | 'subida' | 'bajada';
  dzLocal?: number;
}

export type ConduitRoutingMode = 'orthogonal' | 'schematic_arc';

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
  routingMode?: ConduitRoutingMode; // Ruteo en escuadra ortogonal ('orthogonal') o arco unifilar ('schematic_arc')
  routingPlane?: ConduitRoutingPlane; // Vía de tendido: 'ceiling_slab' (losa techo), 'floor_slab' (contrapiso), 'wall' (pared)
  waypoints?: ConduitWaypoint[]; // Puntos intermedios 2D/3D
  isRiserTerminal?: boolean; // Termina en montante vertical / pase de losa
  additionalLengthM?: number; // Metros adicionales restantes cargados a mano (ej: hasta subsuelo o azotea)
  targetDescription?: string; // Descripción del destino de montante (ej: "A Tablero General")
  status?: 'existente' | 'proyectado' | 'a_reemplazar'; // Estado de relevamiento físico
  notes?: string;
}

export type CircuitType = 'IUG' | 'IUE' | 'TUG' | 'TUE' | 'FM' | 'ACU' | 'LP' | 'LS' | 'OTRO';

export interface Circuit {
  id: string;
  panelId: string;          // Tablero alimentador
  targetPanelId?: string | null; // Tablero receptor alimentado si es LP o LS
  name: string;             // Ej: "C1 - IUG Planta Baja"
  type: CircuitType;
  voltageV: number;         // 220 o 380
  wireSectionBaseMM2: number; // Sección troncal (ej: 2.5 mm²)
  breakerAmperageA: number;   // Calibre de la termomagnética (ej: 10, 16, 20, 25 A)
  differentialId?: string;    // ID del disyuntor que lo protege
  color?: string;
  description?: string;
  phases?: 1 | 3;           // 1 = Monofásico (1F+N+PE), 3 = Trifásico (3F+N+PE o 3F+PE)
  wireSectionPeMM2?: number;// Sección del conductor de protección PE (por defecto igual a wireSectionBaseMM2)
}

export type PanelType = 'principal' | 'seccional' | 'auxiliar';

export type IncomingSourceType =
  | 'grid_meter'          // Acometida de red / Medidor (para TP)
  | 'upstream_panel'      // Línea Seccional desde otro tablero (para TS)
  | 'generator'           // Grupo Electrógeno (Emergencia)
  | 'solar_inverter'      // Inversor Solar Fotovoltaico
  | 'ups_battery';        // UPS / Banco de baterías

export interface PanelIncoming {
  id: string;
  sourceType: IncomingSourceType;
  name: string;                   // Ej: "Acometida Red 3x380V", "Alimentación GE Diésel 10kVA"
  voltageV: number;               // 220 o 380
  phases: 1 | 3;                  // Monofásica o trifásica
  upstreamPanelId?: string | null;// Si proviene de un tablero padre
  feederCircuitId?: string | null;// ID del circuito seccional (LS) alimentador
  feederConduitId?: string | null;// ID de la cañería física de acometida
  mainBreakerAmperageA?: number;  // Termomagnética / seccionador de entrada (ej: 40A)
  mainDifferentialAmperageA?: number; // Disyuntor cabecera para esta entrada (ej: 40A 30mA)
  isDefaultActive?: boolean;      // True para la entrada normal de red
}

export interface PanelTransferSwitch {
  hasMultipleIncomings: boolean;
  type: 'manual' | 'automatic_ats';
  interlocked: boolean;           // Enclavamiento mecánico/eléctrico
  notes?: string;
}

export interface Panel extends SpatialElectricalNode {
  name: string;                   // Ej: "Tablero Principal (TP)", "Tablero Seccional (TS1)"
  type: PanelType;
  isPlaced?: boolean;             // True si está ubicado en el plano; false si es virtual/inicial no posicionado
  symbolId?: string;              // Ej: 'sym-planta-tablero-principal', 'sym-planta-tablero-seccional'
  gabineteBoxTypeId?: string;     // ID del catálogo de cajas / gabinetes

  // ─── DISTRIBUIDOR: ENTRADAS DE ALIMENTACIÓN ───
  incomings: PanelIncoming[];     // 1 o más entradas (Red, Emergencia GE, etc.)
  transferSwitch?: PanelTransferSwitch;

  // ─── BARRAS DE DISTRIBUCIÓN Y PROTECCIONES ───
  busbarCapacityA?: number;       // Capacidad admisible de barras (ej: 63A, 80A, 125A)
  hasEarthBar?: boolean;          // Barra colectora de puesta a tierra (PE)
  earthResistanceOhms?: number;   // Medición de resistencia de jabalina asociada

  // Metadatos técnicos y relevamiento libre
  attributes?: Array<{ key: string; value: string }>;

  // ─── COMPATIBILIDAD CON VISTAS EXISTENTES ───
  elementId?: string;             // ID histórico transitorio si aplica
  isThreePhase?: boolean;         // Monofásico o trifásico
  mainBreakerAmperageA?: number;  // Termomagnética de cabecera general
  mainDifferentialAmperageA?: number; // Disyuntor cabecera general
}
