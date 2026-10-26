/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIG: appCadConfig.ts
 * Parámetros Operativos del Motor CAD/BIM, Tolerancias de Snap y Tokens SVG.
 * Centraliza la calibración geométrica y estilo visual del lienzo de dibujo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const CAD_VIEWPORT_CONFIG = {
  DEFAULT_PIXELS_PER_METER: 60, // 60 píxeles equivalen a 1 metro
  MIN_ZOOM_PIXELS_PER_METER: 15,
  MAX_ZOOM_PIXELS_PER_METER: 300,
  FIT_MIN_ZOOM_PIXELS_PER_METER: 20,
  FIT_MAX_ZOOM_PIXELS_PER_METER: 120,
  FIT_MIN_SPAN_METERS: 1.5,
  FIT_PADDING_X_PX: 60,
  FIT_PADDING_Y_PX: 220,
  WHEEL_ZOOM_IN_FACTOR: 1.15,
  WHEEL_ZOOM_OUT_FACTOR: 0.85,
  ZOOM_STEP_FACTOR: 1.25,
  DEFAULT_PAN: { x: 150, y: 150 },
  DRAG_RECENT_THRESHOLD_MS: 200,
  PINCH_ZOOM_SENSITIVITY: 1.0,
  SAMPLE_BOX_MIN_SIZE_M: 0.10,
  PATTERN_MATCH_SNAP_TOLERANCE_M: 0.50,
  WALL_PLACEMENT_SNAP_TOLERANCE_M: 0.45,
  SPACE_CENTROID_SNAP_TOLERANCE_M: 0.60,
  SPACE_MOVE_VERTEX_SNAP_TOLERANCE_M: 0.35
} as const;

export const CAD_SNAP_CONFIG = {
  VERTEX_TOLERANCE_M: 0.25,      // Distancia máxima para imantar a esquinas existentes
  VERTEX_TOLERANCE_METERS: 0.25,
  WALL_SLIDE_TOLERANCE_M: 0.25,  // Distancia para enganchar derivaciones en 'T'
  WALL_TOLERANCE_METERS: 0.25,
  ALIGN_TOLERANCE_M: 0.15,       // Distancia para activar guías ortogonales inteligentes
  GUIDE_TOLERANCE_METERS: 0.15,
  ANGLE_TOLERANCE_DEG: 4.0,      // Tolerancia en grados para capturar ejes polares
  ORTHOGONAL_ANGLE_TOLERANCE_DEG: 4.0,
  GRID_STEP_M: 0.05,             // Paso de cuadrícula modular secundaria (5 cm)
  GRID_MAJOR_STEP_M: 1.00,       // Cuadrícula principal (1 metro)
  NOTABLE_POLAR_ANGLES_DEG: [0, 45, 90, 135, 180, 225, 270, 315] as const,
  DESKTOP_QUICK_ANGLES_DEG: [-90, -45, 45, 90] as const,
  MOBILE_QUICK_ANGLES_DEG: [30, 45, 60, 135] as const
} as const;

export const CAD_THEME_COLORS = {
  // Acentos y Selección
  accentPrimary: '#2563eb',       // Azul CAD institucional
  accentPrimaryGlow: 'rgba(37, 99, 235, 0.25)',
  accentHover: '#3b82f6',
  accentSelected: '#1d4ed8',

  // Guías de Imantación (Snap)
  snapGuideLine: '#38bdf8',       // Cyan para guías inteligentes y extensiones
  snapCenter: '#10b981',          // Verde esmeralda para centroide de ambientes
  snapVertex: '#06b6d4',          // Cian brillante para vértices
  snapWarning: '#f59e0b',         // Ámbar para advertencias de proximidad
  snapDanger: '#ef4444',          // Rojo para interferencias

  // Geometría y Paramentos
  wallFillDefault: '#334155',     // Gris pizarra para muros macizos
  wallStrokeDefault: '#0f172a',   // Borde exterior de muro
  wallLowFill: '#64748b',         // Muro bajo
  wallRailingStroke: '#94a3b8',   // Baranda / Reja
  columnFill: '#1e293b',          // Columna de hormigón

  // Cotas y Mediciones
  dimensionLine: '#94a3b8',
  dimensionText: '#f8fafc',
  dimensionHighlight: '#38bdf8',

  // Fondo y Cuadrícula
  canvasBackground: '#0b1120',
  gridLineMinor: '#1e293b',
  gridLineMajor: '#334155',

  // Manipuladores (Grips)
  gripDefault: '#60a5fa',
  gripActive: '#f59e0b',
  gripEndpoint: '#64748b',
  gripBorder: '#ffffff'
} as const;

/**
 * Paleta de overlays interactivos del lienzo CAD (guías, snaps y detección de patrones).
 * Centraliza los colores para que las capas SVG no incrusten hexadecimales.
 */
export const CAD_OVERLAY_COLORS = {
  rubberBand: '#38bdf8',
  guidePolarRay: '#2563eb',
  guideWallAxis: '#f59e0b',
  guideDefault: '#06b6d4',
  labelBackground: '#ffffff',
  badgeBackground: '#0f172a',
  badgeText: '#f8fafc',
  snapVertex: '#10b981',
  snapVertexFill: 'rgba(16, 185, 129, 0.18)',
  snapVertexBadge: '#065f46',
  snapVertexBadgeText: '#ecfdf5',
  snapWall: '#f59e0b',
  snapWallFill: 'rgba(245, 158, 11, 0.22)',
  snapWallBadge: '#78350f',
  snapWallBadgeText: '#fef3c7',
  patternMatchFill: 'rgba(6, 182, 212, 0.12)',
  patternMatchStroke: '#06b6d4',
  patternMatchCentroid: '#0891b2',
  patternDismiss: '#ef4444',
  white: '#ffffff'
} as const;

/** Paleta de entidades estructurales, vértices de anclaje y rayo de previsualización del lienzo CAD. */
export const CAD_STRUCTURE_COLORS = {
  beamFill: 'rgba(148, 163, 184, 0.10)',
  beamFillSelected: 'rgba(37, 99, 235, 0.15)',
  beamStroke: '#64748b',
  beamStrokeSelected: '#2563eb',
  columnFill: '#cbd5e1',
  columnFillSelected: '#3b82f6',
  columnStroke: '#334155',
  columnStrokeSelected: '#1d4ed8',
  columnCrossHair: '#475569',
  columnDiagonal: '#64748b',
  anchorHaloFill: 'rgba(59, 130, 246, 0.25)',
  anchorHaloStroke: '#3b82f6',
  anchorFill: '#2563eb',
  vertexFill: '#64748b',
  vertexStroke: '#ffffff',
  previewRay: '#ef4444'
} as const;

/** Tamaños geométricos (px) de los vértices y marcas del lienzo CAD. */
export const CAD_STRUCTURE_METRICS = {
  anchorHaloRadius: 12,
  anchorRadius: 6,
  vertexRadius: 4.5,
  columnCrossHalfSize: 6,
  columnLabelOffsetPx: 8,
  previewRayMarkerRadius: 5,
  previewRayLabelOffsetPx: 8
} as const;

/** Paleta y métricas de aberturas (puertas, ventanas y vanos) en planta. */
export const CAD_OPENING_STYLES = {
  wallCutFill: '#ffffff',
  selected: '#2563eb',
  selectedDark: '#1d4ed8',
  cutStroke: '#94a3b8',
  jambStroke: '#334155',
  doorLeaf: '#475569',
  doorArc: '#94a3b8',
  windowSill: '#475569',
  windowGlass: '#0284c7',
  labelText: '#ffffff',
  hitAreaPaddingPx: 14,
  selectionHaloPaddingPx: 4,
  labelOffsetPx: 16
} as const;

/** Paleta de rótulos y resaltados de ambientes en planta. */
export const CAD_SPACE_OVERLAY_COLORS = {
  selection: '#2563eb',
  overhangDrawing: '#0284c7',
  voidCross: '#64748b',
  projectionLabelBackground: 'rgba(255, 255, 255, 0.9)',
  projectionLabelStroke: '#0284c7',
  projectionLabelText: '#0284c7',
  projectionGripFill: '#0284c7',
  projectionGripStroke: '#ffffff',
  wallBadgeFill: '#ffffff',
  wallBadgeStroke: '#2563eb',
  wallBadgeText: '#1e40af',
  wallBadgeHoverFill: '#2563eb',
  wallBadgeHoverText: '#ffffff'
} as const;

/** Estilos visuales de muros (por tipología), grips de arrastre y cotas en planta. */
export const CAD_WALL_STYLES = {
  standard: { fill: '#334155', fillHover: '#475569', stroke: '#1e293b', strokeWidth: 1 },
  low_wall: { fill: '#94a3b8', fillHover: '#64748b', stroke: '#475569', strokeWidth: 1 },
  railing: { fill: 'rgba(148, 163, 184, 0.15)', fillHover: 'rgba(148, 163, 184, 0.15)', stroke: '#475569', strokeWidth: 1.5, strokeDasharray: '8 4' },
  separator: { fill: 'none', fillHover: 'rgba(2, 132, 199, 0.08)', stroke: '#0284c7', strokeWidth: 1.5, strokeDasharray: '6 4' },
  selected: { fill: '#2563eb', stroke: '#1d4ed8', strokeWidth: 2, outline: '#60a5fa' },
  gripFill: '#ffffff',
  gripStroke: '#2563eb',
  gripActive: '#10b981',
  dimensionBackground: '#ffffff',
  dimensionStroke: '#cbd5e1',
  hitAreaPaddingPx: 24,
  hitAreaMinWidthPx: 32,
  gripHitRadiusPx: 22,
  gripHaloRadiusPx: 9,
  gripCoreRadiusPx: 4.5,
  defaultLowWallHeightM: 1.0
} as const;

/** Paleta y parámetros geométricos para la representación de tableros, bocas y cañerías en planta. */
export const CAD_ELECTRICAL_STYLES = {
  panelHitRadiusSelectedPx: 48,
  panelHitRadiusDefaultPx: 36,
  panelSelectionHaloRadiusPx: 36,
  panelSelectionStroke: '#f59e0b',
  panelPendingFill: 'rgba(245, 158, 11, 0.25)',
  panelPendingBadgeFill: '#d97706',
  panelActionBadgeFill: '#0f172a',
  panelActionBadgeStroke: '#f59e0b',
  elementHitRadiusSelectedPx: 44,
  elementHitRadiusDefaultPx: 36,
  elementSelectionHaloRadiusPx: 30,
  elementSelectionStroke: '#3b82f6',
  elementPendingFill: 'rgba(245, 158, 11, 0.22)',
  elementPendingStroke: '#f59e0b',
  elementPendingBadgeFill: '#d97706',
  elementActionBadgeFill: '#0f172a',
  elementActionBadgeStroke: '#3b82f6',
  terminalBoxFill: 'rgba(15, 23, 42, 0.92)',
  terminalBoxStroke: '#38bdf8',
  terminalTargetText: '#38bdf8',
  terminalSpecText: '#94a3b8',
  terminalDefaultDiameterMM: 19,
  terminalDefaultConductorsCount: 3,
  terminalDefaultSectionMM2: 2.5,
  terminalDefaultTarget: 'A Tablero',
  terminalMinBoxWidthPx: 130,
  terminalCharWidthPx: 6.5,
  terminalPaddingPx: 28,
  conduitHitWidthPx: 18,
  conduitDefaultStroke: '#ea580c',
  conduitSelectedStroke: '#2563eb',
  conduitSelectedLabelFill: '#1d4ed8',
  conduitWidthSelected: 3.5,
  conduitWidthTray: 3.0,
  conduitWidthDefault: 2.2,
  conduitDashCorrugated: '6 3',
  conduitDashTray: '5 2',
  conduitArcCurveFactor: 0.18,
  conduitArcMaxOffsetPx: 28,
  conduitFilletMinPx: 8,
  conduitFilletMaxPx: 22,
  conduitFilletBasePx: 14,
  conduitFilletRefZoom: 40,
  transitionBadgeFill: '#0f172a',
  transitionDownText: '#38bdf8',
  transitionUpText: '#fbbf24',
  riserBadgeFill: '#b45309',
  waypointHitRadiusPx: 18,
  waypointHaloRadiusPx: 13,
  waypointCoreRadiusPx: 9,
  waypointAccent: '#f59e0b',
  white: '#ffffff',
  panelSnapToleranceM: 0.45,
  elementSnapToleranceM: 0.40,
  dragMoveThresholdPx: 3
} as const;

/** Paleta y parámetros geométricos de los overlays interactivos de herramientas y muestreo SVD. */
export const CAD_INTERACTION_OVERLAY_STYLES = {
  crosshairDefault: '#06b6d4',
  crosshairSnapped: '#10b981',
  crosshairRingDefault: '#0891b2',
  crosshairExtentPx: 100000,
  crosshairArmOuterPx: 45,
  crosshairArmInnerPx: 8,
  crosshairRingRadiusPx: 6,
  autoSampleDefaultSizeM: 0.45,
  autoSampleFill: 'rgba(6, 182, 212, 0.12)',
  marqueeFill: 'rgba(6, 182, 212, 0.20)',
  adjustBoxFill: 'rgba(6, 182, 212, 0.16)',
  adjustHandleHitRadiusPx: 14,
  adjustHandleSizePx: 10,
  stencilFillDefault: 'rgba(6, 182, 212, 0.22)',
  stencilFillSnapped: 'rgba(16, 185, 129, 0.22)',
  stencilTextSnapped: '#059669',
  stencilCrossHalfM: 0.25,
  dimensionDraftStroke: '#2563eb',
  overhangDraftStroke: '#0284c7',
  calibrationDraftStroke: '#0284c7',
  spaceMoveStroke: '#2563eb',
  spaceMoveTargetFill: '#1d4ed8',
  spaceMoveGhostFill: 'rgba(59, 130, 246, 0.18)',
  conduitDraftStroke: '#f59e0b',
  conduitWaypointBadgeFill: '#0f172a',
  conduitWaypointTextFill: '#fbbf24',
  ghostSnapPatternStroke: '#06b6d4',
  ghostSnapWallStroke: '#2563eb',
  white: '#ffffff'
} as const;

/** Parámetros de tramas y cuadrícula de fondo SVG del lienzo CAD. */
export const CAD_CANVAS_PATTERN_STYLES = {
  gridStroke: '#e2e8f0',
  gridStrokeWidth: 0.75,
  openAirHatchSizePx: 14,
  openAirHatchRotateDeg: 45,
  openAirHatchFill: 'rgba(254, 252, 232, 0.45)',
  openAirHatchStroke: '#d97706',
  openAirHatchStrokeWidth: 1.2,
  openAirHatchStrokeOpacity: 0.35
} as const;
