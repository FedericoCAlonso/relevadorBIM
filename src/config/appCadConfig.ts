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
  ZOOM_STEP_FACTOR: 1.25,
  DEFAULT_PAN: { x: 150, y: 150 },
  DRAG_RECENT_THRESHOLD_MS: 200,
  PINCH_ZOOM_SENSITIVITY: 1.0
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
