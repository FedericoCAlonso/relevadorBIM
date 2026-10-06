/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: StructuralElement.ts
 * Entidades Estructurales de Hormigón Armado y Acero (BIM 2D).
 * Representa columnas y vigas salientes como elementos que generan
 * interferencias físicas y zonas de exclusión de canaleteado eléctrico.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D } from './Wall';

export type ColumnMaterial = 'concrete' | 'steel';
export type ColumnShape = 'rectangular' | 'circular';

export interface StructuralColumn {
  id: string;
  levelId: string;
  x: number;                  // Coordenada X del centro en metros
  y: number;                  // Coordenada Y del centro en metros
  width: number;              // Ancho / Dimensión X en metros (ej: 0.20)
  depth: number;              // Profundidad / Dimensión Y en metros (ej: 0.20, 0.40) o diámetro si es circular
  rotationDeg?: number;       // Rotación en grados sexagesimales (default: 0)
  shape?: ColumnShape;        // 'rectangular' (default) o 'circular'
  material?: ColumnMaterial;  // 'concrete' (default) o 'steel'
  description?: string;
}

export interface StructuralBeam {
  id: string;
  levelId: string;
  startX: number;             // Extremo inicial X en metros
  startY: number;             // Extremo inicial Y en metros
  endX: number;               // Extremo final X en metros
  endY: number;               // Extremo final Y en metros
  width: number;              // Ancho de viga en metros (ej: 0.15, 0.20)
  dropHeightM: number;        // Cuelgue de viga bajo losa en metros (ej: 0.30, 0.40)
  description?: string;
}

/** Presets normalizados para columnas (m) */
export const COLUMN_DIMENSION_PRESETS: readonly { label: string; width: number; depth: number }[] = [
  { label: '20 x 20 cm', width: 0.20, depth: 0.20 },
  { label: '20 x 30 cm', width: 0.20, depth: 0.30 },
  { label: '20 x 40 cm', width: 0.20, depth: 0.40 },
  { label: '15 x 15 cm', width: 0.15, depth: 0.15 },
  { label: 'Ø 25 cm', width: 0.25, depth: 0.25 }
];

/** Presets normalizados para vigas salientes (m) */
export const BEAM_DIMENSION_PRESETS: readonly { label: string; width: number; dropHeightM: number }[] = [
  { label: '15 x 30 cm', width: 0.15, dropHeightM: 0.30 },
  { label: '20 x 30 cm', width: 0.20, dropHeightM: 0.30 },
  { label: '20 x 40 cm', width: 0.20, dropHeightM: 0.40 },
  { label: '20 x 50 cm', width: 0.20, dropHeightM: 0.50 }
];

/**
 * Obtiene los 4 vértices del polígono de una columna rectangular en coordenadas de planta.
 */
export function getColumnPolygon(column: StructuralColumn): Vector2D[] {
  const hw = column.width / 2;
  const hd = column.depth / 2;
  const rotRad = ((column.rotationDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const localCorners: Vector2D[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd }
  ];

  return localCorners.map((c) => ({
    x: column.x + c.x * cos - c.y * sin,
    y: column.y + c.x * sin + c.y * cos
  }));
}

/**
 * Determina si un punto 2D (x, y) cae dentro de la sección de una columna (zona no canaleteable).
 */
export function isPointInsideColumn(point: Vector2D, column: StructuralColumn, marginM = 0): boolean {
  if (column.shape === 'circular') {
    const radius = column.width / 2 + marginM;
    const distSq = (point.x - column.x) ** 2 + (point.y - column.y) ** 2;
    return distSq <= radius ** 2;
  }

  // Para columnas rectangulares: transformar el punto al sistema de coordenadas local de la columna
  const rotRad = (-(column.rotationDeg || 0) * Math.PI) / 180;
  const dx = point.x - column.x;
  const dy = point.y - column.y;
  const localX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
  const localY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);

  const halfW = column.width / 2 + marginM;
  const halfD = column.depth / 2 + marginM;

  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfD;
}

/**
 * Calcula los 4 vértices del contorno en planta de una viga saliente.
 */
export function getBeamPolygon(beam: StructuralBeam): Vector2D[] {
  const dx = beam.endX - beam.startX;
  const dy = beam.endY - beam.startY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [];

  // Normal unitaria perpendicular (rotación de 90°)
  const nx = -dy / len;
  const ny = dx / len;
  const halfW = beam.width / 2;

  return [
    { x: beam.startX + nx * halfW, y: beam.startY + ny * halfW },
    { x: beam.endX + nx * halfW, y: beam.endY + ny * halfW },
    { x: beam.endX - nx * halfW, y: beam.endY - ny * halfW },
    { x: beam.startX - nx * halfW, y: beam.startY - ny * halfW }
  ];
}
