/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: spaceRenderModel.ts
 * Clasificación visual de ambientes: estilo de superficie y rótulo informativo.
 * Funciones puras, sin dependencias de React ni del DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Space, CeilingProjectionResult } from './Space';
import {
  isSpaceVoid,
  isSpaceShaft,
  isSpaceOpenAir,
  isSpaceSemiCovered,
  getSpaceCoverOption
} from './Space';
import { ARCHITECTURAL_SPACE_STYLES } from '../../config';

export type SpaceSurfaceKind = 'void' | 'shaft' | 'open_air' | 'semi_covered' | 'covered';

export interface SpaceSurfaceStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

/** Rótulo técnico por tipo de superficie (el factor computable se agrega en `getSpaceInfoLabel`). */
const SURFACE_KIND_TITLE: Record<SpaceSurfaceKind, string> = {
  void: 'VACÍO / AIRE Y LUZ',
  shaft: 'PLENO TÉCNICO',
  open_air: 'DESCUBIERTO (A cielo abierto',
  semi_covered: 'SEMICUBIERTO',
  covered: ''
};

/** Orden de precedencia: el primer predicado verdadero define el tipo visual. */
const SURFACE_KIND_RULES: ReadonlyArray<readonly [SpaceSurfaceKind, (s: Space) => boolean]> = [
  ['void', isSpaceVoid],
  ['shaft', isSpaceShaft],
  ['open_air', isSpaceOpenAir],
  ['semi_covered', isSpaceSemiCovered]
];

export function getSpaceSurfaceKind(space: Space): SpaceSurfaceKind {
  return SURFACE_KIND_RULES.find(([, matches]) => matches(space))?.[0] ?? 'covered';
}

/** Estilo de relleno y contorno según el tipo de superficie; respeta el color propio del ambiente. */
export function getSpaceSurfaceStyle(kind: SpaceSurfaceKind, spaceColor?: string): SpaceSurfaceStyle {
  const S = ARCHITECTURAL_SPACE_STYLES;
  switch (kind) {
    case 'void':
      return S.VOID;
    case 'shaft':
      return S.SHAFT;
    case 'open_air':
      return S.OPEN_AIR;
    case 'semi_covered':
      return {
        fill: spaceColor || S.SEMI_COVERED.fillUnderRoof,
        stroke: S.SEMI_COVERED.stroke,
        strokeWidth: S.SEMI_COVERED.strokeWidth,
        strokeDasharray: S.SEMI_COVERED.strokeDasharray
      };
    default:
      return {
        fill: spaceColor || S.COVERED.fill,
        stroke: S.COVERED.stroke,
        strokeWidth: S.COVERED.strokeWidth,
        strokeDasharray: S.COVERED.strokeDasharray
      };
  }
}

const formatPercent = (factor: number): string => `${Math.round(factor * 100)}%`;

/** Rótulo informativo (superficie y tipo) que se muestra bajo el nombre del ambiente. */
export function getSpaceInfoLabel(
  space: Space,
  kind: SpaceSurfaceKind,
  areaM2: number,
  projection: CeilingProjectionResult | null
): string {
  const area = `${areaM2.toFixed(2)} m²`;
  const title = SURFACE_KIND_TITLE[kind];

  if (kind === 'void' || kind === 'shaft') return `${area} · ${title}`;

  if (kind === 'open_air') {
    const factor = getSpaceCoverOption('descubierto').aeaAreaFactor;
    return `${area} · ${title} · ${formatPercent(factor)} AEA)`;
  }

  if (kind === 'semi_covered') {
    const factor = getSpaceCoverOption('semicubierto').aeaAreaFactor;
    const pct = formatPercent(factor);
    if (projection?.isPartial) {
      return `${area} · ${title} (Techado: ${projection.coveredAreaM2.toFixed(2)} m² · ${pct} AEA: ${(projection.coveredAreaM2 * factor).toFixed(2)} m² | Libre: ${projection.uncoveredAreaM2.toFixed(2)} m²)`;
    }
    return `${area} · ${title} · h: ${space.ceilingHeight.toFixed(2)}m (${pct} AEA: ${(areaM2 * factor).toFixed(2)} m²)`;
  }

  return `${area} · h: ${space.ceilingHeight.toFixed(2)}m`;
}

/** Caja envolvente axial de un polígono (para cruces diagonales de vacíos). */
export function getPolygonBounds(polygon: ReadonlyArray<{ x: number; y: number }>): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
