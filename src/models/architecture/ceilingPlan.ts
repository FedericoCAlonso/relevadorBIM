/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: ceilingPlan.ts
 * Dominio y Cálculos Geométricos para el Plano de Cielorraso Reflejado (RCP).
 * Reflected Ceiling Plan conforme a estándares BIM y AEA 90364-7-771.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D, WallVertex, Wall } from './Wall';
import type { Space, SpaceCategory, SpaceCoverType } from './Space';
import {
  isSpaceVoid,
  isSpaceOpenAir,
  isSpaceSemiCovered,
  computeCeilingProjection,
  resolveSpacePolygon,
  calculatePolygonArea
} from './Space';
import type { ElectricalElement } from '../electrical/ElectricalModel';

export type CeilingMaterialType =
  | 'losa_hormigon'
  | 'suspendido_yeso'
  | 'modular_desmontable'
  | 'madera_vista'
  | 'otro';

export interface CeilingMaterialOption {
  readonly id: CeilingMaterialType;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly defaultRecessed: boolean;
}

export const CEILING_MATERIAL_OPTIONS: readonly CeilingMaterialOption[] = [
  {
    id: 'losa_hormigon',
    label: 'Losa de Hormigón / Viguetas',
    shortLabel: 'Losa Hormigón',
    description: 'Estructura rígida de losa con cajas octogonales fijas en hormigón.',
    defaultRecessed: false
  },
  {
    id: 'suspendido_yeso',
    label: 'Suspendido de Placa de Yeso (Durlock)',
    shortLabel: 'Yeso Continuo',
    description: 'Cielorraso suspendido continuo, apto para embutir spots y tiras LED.',
    defaultRecessed: true
  },
  {
    id: 'modular_desmontable',
    label: 'Modular Desmontable (60x60 / 60x120)',
    shortLabel: 'Modular 60x60',
    description: 'Estructura registrable tipo Armstrong / paneles LED modulares.',
    defaultRecessed: true
  },
  {
    id: 'madera_vista',
    label: 'Madera Vista / Machimbre',
    shortLabel: 'Madera Vista',
    description: 'Techo o cabios de madera a la vista para luminarias suspendidas/apliques.',
    defaultRecessed: false
  },
  {
    id: 'otro',
    label: 'Otro Cielorraso / Sin Definir',
    shortLabel: 'Otro',
    description: 'Materialidad especial o no catalogada.',
    defaultRecessed: false
  }
];

export function getCeilingMaterialOption(type?: CeilingMaterialType): CeilingMaterialOption {
  return CEILING_MATERIAL_OPTIONS.find((opt) => opt.id === type) || CEILING_MATERIAL_OPTIONS[0];
}

export type CeilingDistributionPresetType =
  | '1_center'
  | '2_linear'
  | '3_linear'
  | '4_grid'
  | '6_grid';

export interface CeilingDistributionPresetOption {
  readonly id: CeilingDistributionPresetType;
  readonly label: string;
  readonly shortLabel: string;
  readonly count: number;
  readonly cols: (isWide: boolean) => number;
  readonly rows: (isWide: boolean) => number;
  readonly description: string;
}

export const CEILING_DISTRIBUTION_PRESETS: readonly CeilingDistributionPresetOption[] = [
  {
    id: '1_center',
    label: '1 Boca (Centro)',
    shortLabel: '1 Centro',
    count: 1,
    cols: () => 1,
    rows: () => 1,
    description: 'Boca única en el baricentro de la habitación.'
  },
  {
    id: '2_linear',
    label: '2 Bocas (En Línea)',
    shortLabel: '2 en Línea',
    count: 2,
    cols: (isWide) => (isWide ? 2 : 1),
    rows: (isWide) => (isWide ? 1 : 2),
    description: 'Distribuidas a 1/4 y 3/4 a lo largo del eje principal.'
  },
  {
    id: '3_linear',
    label: '3 Bocas (En Línea)',
    shortLabel: '3 en Línea',
    count: 3,
    cols: (isWide) => (isWide ? 3 : 1),
    rows: (isWide) => (isWide ? 1 : 3),
    description: '3 bocas equidistantes a lo largo del eje principal.'
  },
  {
    id: '4_grid',
    label: '4 Bocas (Matriz 2×2)',
    shortLabel: '4 (2×2)',
    count: 4,
    cols: () => 2,
    rows: () => 2,
    description: 'Cuadrícula simétrica de 2 columnas por 2 filas.'
  },
  {
    id: '6_grid',
    label: '6 Bocas (Matriz 3×2)',
    shortLabel: '6 (3×2)',
    count: 6,
    cols: (isWide) => (isWide ? 3 : 2),
    rows: (isWide) => (isWide ? 2 : 3),
    description: 'Distribución uniforme de 6 luminarias en matriz 3×2.'
  }
];

export interface CeilingBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calcula una cuadrícula ortogonal simétrica de bocas dentro de los límites del cielorraso.
 * Aplica la regla estándar de distribución luminotécnica:
 * distancia al muro perimetral = mitad de la separación entre bocas (d = S / 2).
 */
export function computeCeilingGridDistribution(params: {
  bounds: CeilingBounds;
  cols: number;
  rows: number;
}): Vector2D[] {
  const { bounds, cols, rows } = params;
  if (cols <= 0 || rows <= 0) return [];
  const points: Vector2D[] = [];
  const colStep = bounds.width / cols;
  const rowStep = bounds.height / rows;

  for (let r = 0; r < rows; r++) {
    const y = bounds.minY + (r + 0.5) * rowStep;
    for (let c = 0; c < cols; c++) {
      const x = bounds.minX + (c + 0.5) * colStep;
      points.push({
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3))
      });
    }
  }
  return points;
}

/**
 * Calcula las coordenadas de replanteo para un preset predefinido de distribución.
 */
export function calculatePresetDistribution(
  presetId: CeilingDistributionPresetType,
  bounds: CeilingBounds
): Vector2D[] {
  const preset = CEILING_DISTRIBUTION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return [];
  const isWide = bounds.width >= bounds.height;
  const cols = preset.cols(isWide);
  const rows = preset.rows(isWide);
  return computeCeilingGridDistribution({ bounds, cols, rows });
}

/**
 * Determina el contorno interior efectivo del cielorraso para un ambiente.
 * Si es cubierto, retorna el polígono de muros interiores.
 * Si es semicubierto con alero, retorna el polígono de la franja techada efectiva.
 * Si es descubierto o vacío, retorna un arreglo vacío (sin losa/cielorraso).
 */
export function computeEffectiveCeilingPolygon(
  space: Space,
  verticesMap: Map<string, WallVertex>,
  wallsMap?: Map<string, Wall>
): Vector2D[] {
  if (isSpaceVoid(space) || isSpaceOpenAir(space)) {
    return [];
  }

  const basePoly = resolveSpacePolygon(space, verticesMap);
  if (basePoly.length < 3) return [];

  if (isSpaceSemiCovered(space) && space.ceilingProjection?.mode === 'alero') {
    const projResult = computeCeilingProjection(space, verticesMap, wallsMap);
    if (projResult.coveredPolygon && projResult.coveredPolygon.length >= 3) {
      return projResult.coveredPolygon;
    }
    if (projResult.projectionLine && wallsMap && space.ceilingProjection.referenceWallId) {
      const refWall = wallsMap.get(space.ceilingProjection.referenceWallId);
      if (refWall) {
        const v1 = verticesMap.get(refWall.startVertexId);
        const v2 = verticesMap.get(refWall.endVertexId);
        if (v1 && v2) {
          const [p1, p2] = projResult.projectionLine;
          return [
            { x: v1.x, y: v1.y },
            { x: v2.x, y: v2.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p1.y }
          ];
        }
      }
    }
  }

  return basePoly;
}

export interface SettingOutRay {
  direction: 'left' | 'right' | 'top' | 'bottom';
  distanceM: number;
  wallPoint: Vector2D; // Punto de impacto en la cara interior del muro
  boxPoint: Vector2D;  // Posición de la boca cenital
}

export interface BoxSettingOutDimensions {
  elementId: string;
  boxPos: Vector2D;
  rays: SettingOutRay[];
  primaryX: SettingOutRay; // Cota al muro más cercano en X
  primaryY: SettingOutRay; // Cota al muro más cercano en Y
}

/**
 * Calcula las cotas ortogonales de replanteo de una boca cenital hacia
 * las 4 caras interiores de los muros perimetrales del cielorraso.
 */
export function calculateSettingOutDimensions(
  elementId: string,
  boxPos: Vector2D,
  polygon: Vector2D[]
): BoxSettingOutDimensions {
  const n = polygon.length;
  if (n < 3) {
    const dummyRay: SettingOutRay = { direction: 'left', distanceM: 0, wallPoint: boxPos, boxPoint: boxPos };
    return {
      elementId,
      boxPos,
      rays: [dummyRay],
      primaryX: dummyRay,
      primaryY: dummyRay
    };
  }

  let closestLeft: { dist: number; point: Vector2D } | null = null;
  let closestRight: { dist: number; point: Vector2D } | null = null;
  let closestTop: { dist: number; point: Vector2D } | null = null;
  let closestBottom: { dist: number; point: Vector2D } | null = null;

  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];

    // 1. Rayo horizontal: y = boxPos.y
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (boxPos.y >= minY - 1e-5 && boxPos.y <= maxY + 1e-5 && Math.abs(b.y - a.y) > 1e-6) {
      const t = (boxPos.y - a.y) / (b.y - a.y);
      if (t >= -1e-5 && t <= 1 + 1e-5) {
        const xHit = a.x + t * (b.x - a.x);
        if (xHit <= boxPos.x + 1e-5) {
          const dist = boxPos.x - xHit;
          if (!closestLeft || dist < closestLeft.dist) {
            closestLeft = { dist, point: { x: xHit, y: boxPos.y } };
          }
        }
        if (xHit >= boxPos.x - 1e-5) {
          const dist = xHit - boxPos.x;
          if (!closestRight || dist < closestRight.dist) {
            closestRight = { dist, point: { x: xHit, y: boxPos.y } };
          }
        }
      }
    }

    // 2. Rayo vertical: x = boxPos.x
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (boxPos.x >= minX - 1e-5 && boxPos.x <= maxX + 1e-5 && Math.abs(b.x - a.x) > 1e-6) {
      const t = (boxPos.x - a.x) / (b.x - a.x);
      if (t >= -1e-5 && t <= 1 + 1e-5) {
        const yHit = a.y + t * (b.y - a.y);
        if (yHit <= boxPos.y + 1e-5) {
          const dist = boxPos.y - yHit;
          if (!closestTop || dist < closestTop.dist) {
            closestTop = { dist, point: { x: boxPos.x, y: yHit } };
          }
        }
        if (yHit >= boxPos.y - 1e-5) {
          const dist = yHit - boxPos.y;
          if (!closestBottom || dist < closestBottom.dist) {
            closestBottom = { dist, point: { x: boxPos.x, y: yHit } };
          }
        }
      }
    }
  }

  // Fallback a bounding box si algún rayo no intersectó
  let polyMinX = Infinity, polyMaxX = -Infinity, polyMinY = Infinity, polyMaxY = -Infinity;
  for (const p of polygon) {
    if (p.x < polyMinX) polyMinX = p.x;
    if (p.x > polyMaxX) polyMaxX = p.x;
    if (p.y < polyMinY) polyMinY = p.y;
    if (p.y > polyMaxY) polyMaxY = p.y;
  }

  const leftRay: SettingOutRay = {
    direction: 'left',
    distanceM: Number((closestLeft ? closestLeft.dist : Math.max(0, boxPos.x - polyMinX)).toFixed(3)),
    wallPoint: closestLeft ? closestLeft.point : { x: polyMinX, y: boxPos.y },
    boxPoint: boxPos
  };

  const rightRay: SettingOutRay = {
    direction: 'right',
    distanceM: Number((closestRight ? closestRight.dist : Math.max(0, polyMaxX - boxPos.x)).toFixed(3)),
    wallPoint: closestRight ? closestRight.point : { x: polyMaxX, y: boxPos.y },
    boxPoint: boxPos
  };

  const topRay: SettingOutRay = {
    direction: 'top',
    distanceM: Number((closestTop ? closestTop.dist : Math.max(0, boxPos.y - polyMinY)).toFixed(3)),
    wallPoint: closestTop ? closestTop.point : { x: boxPos.x, y: polyMinY },
    boxPoint: boxPos
  };

  const bottomRay: SettingOutRay = {
    direction: 'bottom',
    distanceM: Number((closestBottom ? closestBottom.dist : Math.max(0, polyMaxY - boxPos.y)).toFixed(3)),
    wallPoint: closestBottom ? closestBottom.point : { x: boxPos.x, y: polyMaxY },
    boxPoint: boxPos
  };

  const primaryX = leftRay.distanceM <= rightRay.distanceM ? leftRay : rightRay;
  const primaryY = topRay.distanceM <= bottomRay.distanceM ? topRay : bottomRay;

  return {
    elementId,
    boxPos,
    rays: [leftRay, rightRay, topRay, bottomRay],
    primaryX,
    primaryY
  };
}

export interface CeilingPlanData {
  spaceId: string;
  spaceName: string;
  category: SpaceCategory;
  coverType: SpaceCoverType;
  ceilingHeight: number;
  material: CeilingMaterialType;
  polygon: Vector2D[];
  areaM2: number;
  ceilingBoxes: Array<{
    element: ElectricalElement;
    settingOut: BoxSettingOutDimensions;
  }>;
  wallDrops: Array<{
    element: ElectricalElement;
    wallPos: Vector2D;
    isSwitch: boolean;
  }>;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export interface BuildCeilingPlanParams {
  space: Space;
  verticesMap: Map<string, WallVertex>;
  wallsMap?: Map<string, Wall>;
  elements: ElectricalElement[];
  material?: CeilingMaterialType;
}

/**
 * Ensambla la estructura completa del Plano de Cielorraso Reflejado (RCP).
 */
export function buildCeilingPlanData(params: BuildCeilingPlanParams): CeilingPlanData | null {
  const { space, verticesMap, wallsMap, elements, material } = params;

  const polygon = computeEffectiveCeilingPolygon(space, verticesMap, wallsMap);
  if (polygon.length < 3) return null;

  const areaM2 = Number(calculatePolygonArea(polygon).toFixed(2));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;

  // Filtrar bocas cenitales
  const ceilingBoxes: CeilingPlanData['ceilingBoxes'] = [];
  const wallDrops: CeilingPlanData['wallDrops'] = [];

  for (const el of elements) {
    if (el.levelId !== space.levelId) continue;

    const isExplicitCeiling = el.placement === 'ceiling';
    const isCeilingSymbol = el.symbolId.includes('techo') || el.symbolId.includes('aplique-techo') || el.symbolId.includes('dicroica');

    // Criterio de pertenencia a cielorraso
    if (isExplicitCeiling || (isCeilingSymbol && el.placement !== 'wall')) {
      // Verificar proximidad al espacio
      const inBoundingBox = el.x >= minX - 0.2 && el.x <= maxX + 0.2 && el.y >= minY - 0.2 && el.y <= maxY + 0.2;
      if (el.spaceId === space.id || inBoundingBox) {
        const boxPos: Vector2D = { x: el.x, y: el.y };
        const settingOut = calculateSettingOutDimensions(el.id, boxPos, polygon);
        ceilingBoxes.push({ element: el, settingOut });
      }
      continue;
    }

    // Cajas de pared (llaves y tomas) perimetrales que alimentan o vinculan al cielorraso
    if (el.placement === 'wall') {
      const belongsToRoomWall = space.wallIds && el.wallId ? space.wallIds.includes(el.wallId) : false;
      const inProximity = el.x >= minX - 0.35 && el.x <= maxX + 0.35 && el.y >= minY - 0.35 && el.y <= maxY + 0.35;

      if (belongsToRoomWall || (el.spaceId === space.id && inProximity)) {
        const isSwitch =
          el.symbolId.includes('llave') ||
          el.symbolId.includes('interruptor') ||
          el.symbolId.includes('pulsador') ||
          el.symbolId.includes('punto');

        wallDrops.push({
          element: el,
          wallPos: { x: el.x, y: el.y },
          isSwitch
        });
      }
    }
  }

  const resolvedMaterial: CeilingMaterialType =
    material || (space as any).ceilingMaterial || 'losa_hormigon';

  return {
    spaceId: space.id,
    spaceName: space.name,
    category: space.category,
    coverType: space.coverType || 'cubierto',
    ceilingHeight: space.ceilingHeight,
    material: resolvedMaterial,
    polygon,
    areaM2,
    ceilingBoxes,
    wallDrops,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height
    }
  };
}
