/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: wallRenderModel.ts
 * Estilo visual y rótulos de muros en planta según su tipología.
 * Funciones puras, sin dependencias de React ni del DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WallType } from './Wall';
import { CAD_WALL_STYLES } from '../../config';

export interface WallBodyStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

const TYPOLOGY_KEYS: Record<WallType, 'standard' | 'low_wall' | 'railing' | 'separator'> = {
  standard: 'standard',
  low_wall: 'low_wall',
  railing: 'railing',
  separator: 'separator'
};

/** Estilo del cuerpo del muro; la selección tiene precedencia sobre la tipología y el hover. */
export function getWallBodyStyle(wall: { wallType?: WallType }, isSelected: boolean, isHovered: boolean): WallBodyStyle {
  if (isSelected) {
    const { fill, stroke, strokeWidth } = CAD_WALL_STYLES.selected;
    return { fill, stroke, strokeWidth };
  }
  const style = CAD_WALL_STYLES[TYPOLOGY_KEYS[wall.wallType ?? 'standard']];
  return {
    fill: isHovered ? style.fillHover : style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDasharray: 'strokeDasharray' in style ? style.strokeDasharray : undefined
  };
}

/** Rótulo sobre el cuerpo del muro: altura para antepechos, "Baranda" para barandas; null si no aplica. */
export function getWallTypologyLabel(wall: { wallType?: WallType; height?: number }): string | null {
  if (wall.wallType === 'low_wall') return `h=${wall.height || CAD_WALL_STYLES.defaultLowWallHeightM}m`;
  if (wall.wallType === 'railing') return 'Baranda';
  if (wall.wallType === 'separator') return 'Límite Virtual';
  return null;
}
