/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Space.ts
 * Ambientes y Espacios Funcionales (BIM IfcSpace).
 * Los ambientes son emergentes: habitan el volumen delimitado por las caras
 * de los muros del edificio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D, WallVertex } from './Wall';
import type { CeilingMaterialType } from './ceilingPlan';
import { SPACE_COVER_TYPE_OPTIONS, type SpaceCoverTypeOption } from '../../config/architecturalConfig';

export type SpaceCategory =
  | 'living'
  | 'dormitorio'
  | 'cocina'
  | 'bano'
  | 'pasillo'
  | 'lavadero'
  | 'cochera'
  | 'escalera'
  | 'balcon'
  | 'aire_luz'
  | 'pleno'
  | 'exterior'
  | 'otro';

export type SpaceCoverType = 'cubierto' | 'semicubierto' | 'descubierto' | 'vacio';

export type CeilingProjectionMode = 'total' | 'alero';

export interface CeilingProjection {
  mode: CeilingProjectionMode;
  overhangDepth?: number;   // Profundidad de alero en metros (default: 1.50)
  ceilingHeight?: number;   // Altura libre piso-techo del alero (si difiere de space.ceilingHeight)
  referenceWallId?: string; // ID del muro de fachada / apoyo desde donde proyecta el alero
  projectionLine?: [Vector2D, Vector2D]; // Línea explícita trazada por 2 clics o calculada
  invertSide?: boolean;     // Invertir cuál de los dos lados del corte es el techado vs descubierto
}

export interface Space {
  id: string;
  name: string;                // Ej: "Living Comedor", "Patio de Aire y Luz", "Pleno Técnico"
  category: SpaceCategory;
  levelId: string;             // Nivel/planta al que pertenece
  ceilingHeight: number;       // Altura libre piso-cielorraso en metros (default: 2.70)
  floorElevation: number;      // Desnivel del piso respecto al nivel de planta (default: 0.00)
  boundaryVertexIds: string[]; // Vértices ordenados que forman el perímetro interior
  wallIds: string[];           // IDs de los muros que lo rodean
  coverType?: SpaceCoverType;  // Tipo de cubierta: cubierto, semicubierto (balcón), descubierto o vacío
  ceilingProjection?: CeilingProjection; // Proyección de techo / alero para ambientes semicubiertos
  ceilingMaterial?: CeilingMaterialType; // Materialidad constructiva del cielorraso (losa, durlock, etc.)
  color?: string;              // Color tenue de relleno para identificación
}

export const ROOM_NAME_SUGGESTIONS: readonly string[] = [
  'Living Comedor',
  'Cocina',
  'Dormitorio 1',
  'Dormitorio 2',
  'Baño',
  'Lavadero',
  'Pasillo',
  'Balcón',
  'Quincho',
  'Galería',
  'Patio Aire y Luz',
  'Pleno Técnico',
  'Terraza',
  'Cochera'
];

export const STANDARD_CEILING_HEIGHT_PRESETS: readonly number[] = [2.40, 2.60, 2.70, 2.80, 3.00];

export const STANDARD_OVERHANG_DEPTH_PRESETS: readonly number[] = [1.00, 1.50, 2.00, 2.50];

export { SPACE_COVER_TYPE_OPTIONS };
export type { SpaceCoverTypeOption };

export function getSpaceCoverOption(coverType?: SpaceCoverType): SpaceCoverTypeOption {
  const match = SPACE_COVER_TYPE_OPTIONS.find((opt) => opt.id === coverType);
  return match || SPACE_COVER_TYPE_OPTIONS[0];
}

/**
 * Retorna true si el espacio representa un vacío arquitectónico (patio de aire y luz o hueco de losa).
 */
export function isSpaceVoid(space: Space): boolean {
  if (space.coverType) {
    return space.coverType === 'vacio';
  }
  return space.category === 'aire_luz';
}

/**
 * Retorna true si el espacio está a cielo abierto (patio descubierto, terraza descubierta).
 */
export function isSpaceOpenAir(space: Space): boolean {
  if (space.coverType) {
    return space.coverType === 'descubierto';
  }
  return space.category === 'exterior';
}

/**
 * Retorna true si el espacio es semicubierto (galería, balcón con alero o porche).
 */
export function isSpaceSemiCovered(space: Space): boolean {
  if (space.coverType) {
    return space.coverType === 'semicubierto';
  }
  return space.category === 'balcon';
}

/**
 * Retorna true si el espacio es un pleno técnico o ducto de montantes verticales.
 */
export function isSpaceShaft(space: Space): boolean {
  return space.category === 'pleno';
}

export interface SpaceMetrics {
  areaM2: number;
  perimeterM: number;
  volumeM3: number;
  limitAreaM2?: number; // Superficie computable AEA 771 (m²)
  coveredAreaM2?: number; // Superficie semicubierta techada (m²)
  uncoveredAreaM2?: number; // Superficie a cielo abierto remanente (m²)
}

// ─── CÁLCULOS GEOMÉTRICOS DE SUPERFICIES Y CENTROIDES ───────────────────────

/**
 * Calcula la superficie de un polígono cerrado 2D mediante la fórmula de Gauss (Shoelace).
 */
export function calculatePolygonArea(polygon: Vector2D[]): number {
  const n = polygon.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Calcula el perímetro de un polígono 2D cerrado en metros.
 */
export function calculatePolygonPerimeter(polygon: Vector2D[]): number {
  const n = polygon.length;
  if (n < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    perimeter += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return perimeter;
}

/**
 * Calcula el centroide (centro de masa) geométrico de un polígono 2D.
 * Ideal para posicionar la etiqueta de nombre de ambiente o el centro de iluminación.
 */
export function calculatePolygonCentroid(polygon: Vector2D[]): Vector2D {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n < 3) {
    // Si no es un polígono cerrado, retornar promedio simple
    const sumX = polygon.reduce((acc, p) => acc + p.x, 0);
    const sumY = polygon.reduce((acc, p) => acc + p.y, 0);
    return { x: sumX / n, y: sumY / n };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % n];
    const a = p0.x * p1.y - p1.x * p0.y;
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cy += (p0.y + p1.y) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    // Fallback a promedio si los vértices son colineales
    const sumX = polygon.reduce((acc, p) => acc + p.x, 0);
    const sumY = polygon.reduce((acc, p) => acc + p.y, 0);
    return { x: sumX / n, y: sumY / n };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;

  return { x: cx, y: cy };
}

/**
 * Determina si un punto 2D se encuentra contenido dentro de un polígono cerrado (Ray Casting).
 */
export function isPointInPolygon(point: Vector2D, polygon: Vector2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Resuelve el polígono de puntos a partir de los IDs de vértices y el mapa de vértices.
 */
export function resolveSpacePolygon(
  space: Space,
  vertices: Map<string, WallVertex>
): Vector2D[] {
  const points: Vector2D[] = [];
  if (!space || !Array.isArray(space.boundaryVertexIds)) return points;
  for (const vId of space.boundaryVertexIds) {
    const v = vertices.get(vId);
    if (v) points.push({ x: v.x, y: v.y });
  }
  return points;
}

export interface CeilingProjectionResult {
  coveredAreaM2: number;
  uncoveredAreaM2: number;
  projectionLine?: [Vector2D, Vector2D]; // Línea del límite del alero en coordenadas métricas
  isPartial: boolean;
  coveredPolygon?: Vector2D[];
  uncoveredPolygon?: Vector2D[];
}

/**
 * Recorta un polígono 2D simple contra un semiplano delimitado por una recta dirigida (P1 -> P2).
 * Retorna las coordenadas de los vértices del subpolígono resultante (Sutherland-Hodgman).
 */
export function clipPolygonHalfPlane(
  polygon: Vector2D[],
  lineP1: Vector2D,
  lineP2: Vector2D,
  keepSide: 'positive' | 'negative'
): Vector2D[] {
  const n = polygon.length;
  if (n < 3) return [];

  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return polygon;

  const nx = -dy / len;
  const ny = dx / len;

  const dist = (p: Vector2D) => (p.x - lineP1.x) * nx + (p.y - lineP1.y) * ny;
  const isInside = (d: number) => (keepSide === 'positive' ? d >= -1e-5 : d <= 1e-5);

  const output: Vector2D[] = [];

  for (let i = 0; i < n; i++) {
    const cur = polygon[i];
    const next = polygon[(i + 1) % n];

    const dCur = dist(cur);
    const dNext = dist(next);

    const curInside = isInside(dCur);
    const nextInside = isInside(dNext);

    if (curInside) {
      output.push({ x: Number(cur.x.toFixed(3)), y: Number(cur.y.toFixed(3)) });
      if (!nextInside) {
        const t = dCur / (dCur - dNext);
        output.push({
          x: Number((cur.x + t * (next.x - cur.x)).toFixed(3)),
          y: Number((cur.y + t * (next.y - cur.y)).toFixed(3))
        });
      }
    } else if (nextInside) {
      const t = dCur / (dCur - dNext);
      output.push({
        x: Number((cur.x + t * (next.x - cur.x)).toFixed(3)),
        y: Number((cur.y + t * (next.y - cur.y)).toFixed(3))
      });
    }
  }

  return output;
}

/**
 * Encuentra el segmento de intersección entre una recta infinita (P1, P2) y el perímetro de un polígono.
 */
export function getLineIntersectionWithPolygon(
  polygon: Vector2D[],
  lineP1: Vector2D,
  lineP2: Vector2D
): [Vector2D, Vector2D] | null {
  const n = polygon.length;
  if (n < 3) return null;

  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return null;

  const nx = -dy / len;
  const ny = dx / len;

  const dist = (p: Vector2D) => (p.x - lineP1.x) * nx + (p.y - lineP1.y) * ny;
  const intersections: Vector2D[] = [];

  for (let i = 0; i < n; i++) {
    const cur = polygon[i];
    const next = polygon[(i + 1) % n];
    const dCur = dist(cur);
    const dNext = dist(next);

    if (Math.abs(dCur) < 1e-5) {
      intersections.push({ x: Number(cur.x.toFixed(3)), y: Number(cur.y.toFixed(3)) });
    } else if (dCur * dNext < 0) {
      const t = dCur / (dCur - dNext);
      intersections.push({
        x: Number((cur.x + t * (next.x - cur.x)).toFixed(3)),
        y: Number((cur.y + t * (next.y - cur.y)).toFixed(3))
      });
    }
  }

  const unique: Vector2D[] = [];
  for (const pt of intersections) {
    if (!unique.some((u) => Math.hypot(u.x - pt.x, u.y - pt.y) < 1e-3)) {
      unique.push(pt);
    }
  }

  if (unique.length >= 2) {
    // Ordenar a lo largo del vector directriz (lineP1 -> lineP2) para preservar orientación
    unique.sort((a, b) => {
      const projA = (a.x - lineP1.x) * dx + (a.y - lineP1.y) * dy;
      const projB = (b.x - lineP1.x) * dx + (b.y - lineP1.y) * dy;
      return projA - projB;
    });
    return [unique[0], unique[unique.length - 1]];
  }

  return null;
}

/**
 * Calcula la proyección geométrica del techo o alero para un recinto arquitectónico.
 * Si es semicubierto con alero paramétrico o línea de alero trazada, determina la línea de proyección normalizada (-- - --),
 * los subpolígonos cubierto y descubierto, y las superficies efectivas.
 */
export function computeCeilingProjection(
  space: Space,
  verticesMap: Map<string, { x: number; y: number }>,
  wallsMap?: Map<string, { id: string; startVertexId: string; endVertexId: string }>
): CeilingProjectionResult {
  const poly = resolveSpacePolygon(space, verticesMap as any);
  const totalArea = poly.length >= 3 ? calculatePolygonArea(poly) : 0;

  if (isSpaceVoid(space) || isSpaceOpenAir(space)) {
    return { coveredAreaM2: 0, uncoveredAreaM2: totalArea, isPartial: false };
  }

  if (!isSpaceSemiCovered(space)) {
    // Cubierto u otro tipo cerrado completo
    return { coveredAreaM2: totalArea, uncoveredAreaM2: 0, isPartial: false };
  }

  // Recinto semicubierto
  const proj = space.ceilingProjection;
  if (!proj || proj.mode === 'total') {
    return { coveredAreaM2: totalArea, uncoveredAreaM2: 0, isPartial: false };
  }

  // Caso A: Línea explícita trazada por 2 clics
  if (proj.projectionLine && proj.projectionLine.length === 2) {
    const [p1, p2] = proj.projectionLine;
    const cutLine = getLineIntersectionWithPolygon(poly, p1, p2) || [p1, p2];

    // Determinar qué lado es el cubierto
    let coveredSide: 'positive' | 'negative' = proj.invertSide ? 'positive' : 'negative';

    if (proj.referenceWallId && wallsMap) {
      const refWall = wallsMap.get(proj.referenceWallId);
      if (refWall) {
        const v1 = verticesMap.get(refWall.startVertexId);
        const v2 = verticesMap.get(refWall.endVertexId);
        if (v1 && v2) {
          const midX = (v1.x + v2.x) / 2;
          const midY = (v1.y + v2.y) / 2;
          const dx = cutLine[1].x - cutLine[0].x;
          const dy = cutLine[1].y - cutLine[0].y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const dRef = (midX - cutLine[0].x) * nx + (midY - cutLine[0].y) * ny;
          coveredSide = dRef >= 0 ? 'positive' : 'negative';
          if (proj.invertSide) {
            coveredSide = coveredSide === 'positive' ? 'negative' : 'positive';
          }
        }
      }
    }

    const uncoveredSide = coveredSide === 'positive' ? 'negative' : 'positive';
    const coveredPoly = clipPolygonHalfPlane(poly, cutLine[0], cutLine[1], coveredSide);
    const uncoveredPoly = clipPolygonHalfPlane(poly, cutLine[0], cutLine[1], uncoveredSide);

    const covArea = coveredPoly.length >= 3 ? calculatePolygonArea(coveredPoly) : 0;
    const uncovArea = uncoveredPoly.length >= 3 ? calculatePolygonArea(uncoveredPoly) : totalArea - covArea;

    return {
      coveredAreaM2: Number(covArea.toFixed(2)),
      uncoveredAreaM2: Number(uncovArea.toFixed(2)),
      projectionLine: cutLine,
      isPartial: true,
      coveredPolygon: coveredPoly,
      uncoveredPolygon: uncoveredPoly
    };
  }

  // Caso B: proj.mode === 'alero' paramétrico por profundidad desde muro de apoyo
  const depth = Math.max(0.1, proj.overhangDepth ?? 1.50);

  // Buscar el muro de referencia desde donde se proyecta el alero
  let refWall: { id: string; startVertexId: string; endVertexId: string } | undefined;
  if (proj.referenceWallId && wallsMap) {
    refWall = wallsMap.get(proj.referenceWallId);
  }
  if (!refWall && wallsMap && space.wallIds && space.wallIds.length > 0) {
    let maxLen = -1;
    for (const wId of space.wallIds) {
      const w = wallsMap.get(wId);
      if (w) {
        const v1 = verticesMap.get(w.startVertexId);
        const v2 = verticesMap.get(w.endVertexId);
        if (v1 && v2) {
          const l = Math.hypot(v2.x - v1.x, v2.y - v1.y);
          if (l > maxLen) {
            maxLen = l;
            refWall = w;
          }
        }
      }
    }
  }

  if (!refWall || !verticesMap.has(refWall.startVertexId) || !verticesMap.has(refWall.endVertexId)) {
    const covered = Math.min(totalArea, totalArea * 0.5);
    return {
      coveredAreaM2: Number(covered.toFixed(2)),
      uncoveredAreaM2: Number((totalArea - covered).toFixed(2)),
      isPartial: true
    };
  }

  const v1 = verticesMap.get(refWall.startVertexId)!;
  const v2 = verticesMap.get(refWall.endVertexId)!;
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 1e-4) {
    return { coveredAreaM2: totalArea, uncoveredAreaM2: 0, isPartial: false };
  }

  // Vector unitario en dirección del muro
  const ux = dx / wallLen;
  const uy = dy / wallLen;

  // Normal candidato
  let nx = -uy;
  let ny = ux;

  // Orientar el normal hacia el interior del ambiente (hacia su centroide)
  const centroid = calculatePolygonCentroid(poly);
  const midX = (v1.x + v2.x) / 2;
  const midY = (v1.y + v2.y) / 2;
  const toCentroidX = centroid.x - midX;
  const toCentroidY = centroid.y - midY;
  if (nx * toCentroidX + ny * toCentroidY < 0) {
    nx = -nx;
    ny = -ny;
  }

  // Línea del alero paralela al muro, desplazada 'depth' metros hacia el interior
  const p1: Vector2D = {
    x: Number((v1.x + nx * depth).toFixed(3)),
    y: Number((v1.y + ny * depth).toFixed(3))
  };
  const p2: Vector2D = {
    x: Number((v2.x + nx * depth).toFixed(3)),
    y: Number((v2.y + ny * depth).toFixed(3))
  };

  const cutLine = getLineIntersectionWithPolygon(poly, p1, p2) || [p1, p2];

  // Evaluar qué lado corresponde al muro de referencia
  const cdx = cutLine[1].x - cutLine[0].x;
  const cdy = cutLine[1].y - cutLine[0].y;
  const clen = Math.hypot(cdx, cdy) || 1;
  const cnx = -cdy / clen;
  const cny = cdx / clen;
  const dMidWall = (midX - cutLine[0].x) * cnx + (midY - cutLine[0].y) * cny;
  let coveredSide: 'positive' | 'negative' = dMidWall >= 0 ? 'positive' : 'negative';
  if (proj.invertSide) {
    coveredSide = coveredSide === 'positive' ? 'negative' : 'positive';
  }
  const uncoveredSide = coveredSide === 'positive' ? 'negative' : 'positive';

  const coveredPoly = clipPolygonHalfPlane(poly, cutLine[0], cutLine[1], coveredSide);
  const uncoveredPoly = clipPolygonHalfPlane(poly, cutLine[0], cutLine[1], uncoveredSide);

  let coveredArea = coveredPoly.length >= 3 ? calculatePolygonArea(coveredPoly) : Math.min(totalArea, wallLen * depth);
  let uncoveredArea = uncoveredPoly.length >= 3 ? calculatePolygonArea(uncoveredPoly) : Math.max(0, totalArea - coveredArea);

  coveredArea = Math.min(totalArea, Math.max(0, coveredArea));
  uncoveredArea = Math.min(totalArea, Math.max(0, uncoveredArea));

  return {
    coveredAreaM2: Number(coveredArea.toFixed(2)),
    uncoveredAreaM2: Number(uncoveredArea.toFixed(2)),
    projectionLine: cutLine,
    isPartial: true,
    coveredPolygon: coveredPoly,
    uncoveredPolygon: uncoveredPoly
  };
}

/**
 * Calcula las métricas BIM del ambiente (superficie útil, perímetro, volumen interior y superficie límite AEA).
 */
export function calculateSpaceMetrics(
  space: Space,
  verticesMap: Map<string, WallVertex>,
  wallsMap?: Map<string, { id: string; startVertexId: string; endVertexId: string }>
): SpaceMetrics {
  const poly = resolveSpacePolygon(space, verticesMap);
  const areaM2 = poly.length >= 3 ? calculatePolygonArea(poly) : 0;
  const perimeterM = poly.length >= 2 ? calculatePolygonPerimeter(poly) : 0;

  const isVoid = isSpaceVoid(space);
  const isOpenAir = isSpaceOpenAir(space);
  const volumeM3 = (isVoid || isOpenAir) ? 0 : Number((areaM2 * (space.ceilingHeight || 2.70)).toFixed(2));

  let coveredAreaM2 = isVoid || isOpenAir ? 0 : areaM2;
  let uncoveredAreaM2 = isVoid || isOpenAir ? areaM2 : 0;
  let limitAreaM2 = areaM2;

  if (isVoid || isOpenAir) {
    limitAreaM2 = 0;
  } else if (isSpaceSemiCovered(space)) {
    const proj = computeCeilingProjection(space, verticesMap, wallsMap);
    coveredAreaM2 = proj.coveredAreaM2;
    uncoveredAreaM2 = proj.uncoveredAreaM2;
    limitAreaM2 = Number((coveredAreaM2 * 0.50).toFixed(2));
  }

  return {
    areaM2,
    perimeterM,
    volumeM3,
    limitAreaM2: Number(limitAreaM2.toFixed(2)),
    coveredAreaM2: Number(coveredAreaM2.toFixed(2)),
    uncoveredAreaM2: Number(uncoveredAreaM2.toFixed(2))
  };
}


// Distancia de un punto a un segmento rectilíneo 2D
function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): { dist: number; t: number; proj: { x: number; y: number } } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) {
    return { dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0, proj: { x: a.x, y: a.y } };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { dist: Math.hypot(p.x - proj.x, p.y - proj.y), t, proj };
}

// Punto de corte entre dos segmentos rectilíneos 2D
function segmentSegmentIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): { x: number; y: number } | null {
  const dx1 = b.x - a.x;
  const dy1 = b.y - a.y;
  const dx2 = d.x - c.x;
  const dy2 = d.y - c.y;

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-8) return null;

  const s = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / det;
  const t = ((c.x - a.x) * dy1 - (c.y - a.y) * dx1) / det;

  if (s > 0.001 && s < 0.999 && t > 0.001 && t < 0.999) {
    return { x: a.x + s * dx1, y: a.y + s * dy1 };
  }
  return null;
}

/**
 * Detecta las caras interiores de un grafo plano de muros (Planar Straight-Line Graph)
 * utilizando el recorrido angular de semiaristas (Half-Edges / Left-hand rule).
 * Garantiza que:
 * 1. Cada recinto interior sea detectado exactamente una vez.
 * 2. NO se generen ambientes fantasma por uniones de ambientes adyacentes ni el perímetro exterior.
 * 3. Los vértices del ambiente queden estrictamente ordenados a lo largo de su perímetro.
 * 4. Soporta muros duplicados, superpuestos parcialmente, empalmes en T y cruces sin vértices previos.
 */
export function findEnclosedCycles(
  walls: Array<{ id: string; startVertexId: string; endVertexId: string }>,
  verticesMap?: Map<string, { x: number; y: number }> | Array<{ id: string; x: number; y: number }>
): {
  vertexIds: string[];
  wallIds: string[];
}[] {
  // Si no disponemos de coordenadas de vértices, recurrir al método topológico de respaldo
  if (!verticesMap) {
    return findCyclesTopologicalFallback(walls);
  }

  // 1. Mapa de coordenadas
  const vMap = new Map<string, { x: number; y: number }>();
  if (verticesMap instanceof Map) {
    for (const [id, coord] of verticesMap.entries()) {
      vMap.set(id, { x: Number(coord.x.toFixed(4)), y: Number(coord.y.toFixed(4)) });
    }
  } else {
    for (const v of verticesMap) {
      vMap.set(v.id, { x: Number(v.x.toFixed(4)), y: Number(v.y.toFixed(4)) });
    }
  }

  // Helper para registrar o reutilizar un vértice existente dentro de tolerancia
  let virtualVertexCounter = 0;
  function getOrCreateVertexId(pt: { x: number; y: number }): string {
    for (const [id, coord] of vMap.entries()) {
      if (Math.hypot(coord.x - pt.x, coord.y - pt.y) < 0.03) {
        return id;
      }
    }
    const newId = `v_node_${++virtualVertexCounter}`;
    const rounded = { x: Number(pt.x.toFixed(4)), y: Number(pt.y.toFixed(4)) };
    vMap.set(newId, rounded);
    if (verticesMap instanceof Map) {
      verticesMap.set(newId, rounded);
    }
    return newId;
  }

  // 2. Recolectar segmentos válidos
  interface Segment {
    wallId: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    v1Id: string;
    v2Id: string;
  }
  const segments: Segment[] = [];
  for (const w of walls) {
    if (w.startVertexId === w.endVertexId) continue;
    const p1 = vMap.get(w.startVertexId);
    const p2 = vMap.get(w.endVertexId);
    if (!p1 || !p2) continue;
    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 0.01) continue;
    segments.push({ wallId: w.id, p1, p2, v1Id: w.startVertexId, v2Id: w.endVertexId });
  }

  // 3. Planarización: Detectar puntos de corte e intersecciones
  const splitPointsPerSegment = new Map<number, { x: number; y: number }[]>();
  for (let i = 0; i < segments.length; i++) {
    splitPointsPerSegment.set(i, []);
  }

  // a) Intersecciones X entre segmentos de pared
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      const inter = segmentSegmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
      if (inter) {
        splitPointsPerSegment.get(i)!.push(inter);
        splitPointsPerSegment.get(j)!.push(inter);
      }
    }
  }

  // b) T-junctions y empalmes parciales (tolerancia de hasta 15 cm para absorber espesores y desfasajes en obra)
  const T_JUNCTION_TOLERANCE = 0.15;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    for (const [vId, pt] of vMap.entries()) {
      if (vId === s.v1Id || vId === s.v2Id) continue;
      const { dist, t, proj } = pointToSegmentDistance(pt, s.p1, s.p2);
      const len = Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
      const distFromEnds = Math.min(t * len, (1 - t) * len);
      if (dist <= T_JUNCTION_TOLERANCE && distFromEnds >= 0.02) {
        pt.x = Number(proj.x.toFixed(4));
        pt.y = Number(proj.y.toFixed(4));
        if (verticesMap instanceof Map && verticesMap.has(vId)) {
          const orig = verticesMap.get(vId)!;
          orig.x = pt.x;
          orig.y = pt.y;
        }
        splitPointsPerSegment.get(i)!.push(proj);
      }
    }
  }

  // 4. Subdividir segmentos en aristas atómicas y fusionar aristas superpuestas/coincidentes
  interface AtomicEdge {
    v1: string;
    v2: string;
    wallIds: string[];
  }
  const atomicEdgesMap = new Map<string, AtomicEdge>();

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const pts = splitPointsPerSegment.get(i) || [];

    const dx = s.p2.x - s.p1.x;
    const dy = s.p2.y - s.p1.y;
    const lenSq = dx * dx + dy * dy;

    const uniquePoints: { pt: { x: number; y: number }; t: number; id: string }[] = [
      { pt: s.p1, t: 0, id: s.v1Id },
      { pt: s.p2, t: 1, id: s.v2Id }
    ];

    for (const p of pts) {
      const t = ((p.x - s.p1.x) * dx + (p.y - s.p1.y) * dy) / lenSq;
      if (t > 0.005 && t < 0.995) {
        const id = getOrCreateVertexId(p);
        uniquePoints.push({ pt: p, t, id });
      }
    }

    uniquePoints.sort((a, b) => a.t - b.t);

    const cleanChain: string[] = [];
    for (const item of uniquePoints) {
      if (cleanChain.length === 0 || cleanChain[cleanChain.length - 1] !== item.id) {
        cleanChain.push(item.id);
      }
    }

    for (let k = 0; k < cleanChain.length - 1; k++) {
      const idA = cleanChain[k];
      const idB = cleanChain[k + 1];
      if (idA === idB) continue;

      const key = idA < idB ? `${idA}--${idB}` : `${idB}--${idA}`;
      const existing = atomicEdgesMap.get(key);
      if (existing) {
        if (!existing.wallIds.includes(s.wallId)) {
          existing.wallIds.push(s.wallId);
        }
      } else {
        atomicEdgesMap.set(key, { v1: idA, v2: idB, wallIds: [s.wallId] });
      }
    }
  }

  // 5. Construir Half-Edges en el Grafo Plano
  interface HalfEdge {
    from: string;
    to: string;
    wallIds: string[];
    angle: number;
    visited: boolean;
  }

  const outgoing = new Map<string, HalfEdge[]>();
  const halfEdges: HalfEdge[] = [];

  for (const edge of atomicEdgesMap.values()) {
    const p1 = vMap.get(edge.v1);
    const p2 = vMap.get(edge.v2);
    if (!p1 || !p2) continue;

    if (!outgoing.has(edge.v1)) outgoing.set(edge.v1, []);
    if (!outgoing.has(edge.v2)) outgoing.set(edge.v2, []);

    const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angle2 = Math.atan2(p1.y - p2.y, p1.x - p2.x);

    const he1: HalfEdge = { from: edge.v1, to: edge.v2, wallIds: edge.wallIds, angle: angle1, visited: false };
    const he2: HalfEdge = { from: edge.v2, to: edge.v1, wallIds: edge.wallIds, angle: angle2, visited: false };

    outgoing.get(edge.v1)!.push(he1);
    outgoing.get(edge.v2)!.push(he2);
    halfEdges.push(he1, he2);
  }

  // Ordenar semiaristas salientes por ángulo polar ascendente
  for (const list of outgoing.values()) {
    list.sort((a, b) => a.angle - b.angle);
  }

  // 6. Extracción de Caras Planas mediante Giro a la Izquierda
  const cycles: { vertexIds: string[]; wallIds: string[] }[] = [];

  for (const he of halfEdges) {
    if (he.visited) continue;

    const faceEdges: HalfEdge[] = [];
    let curr: HalfEdge | undefined = he;

    while (curr && !curr.visited) {
      curr.visited = true;
      faceEdges.push(curr);

      const nextVertex = curr.to;
      const outList = outgoing.get(nextVertex);
      if (!outList || outList.length === 0) break;

      const revIdx = outList.findIndex((e) => e.to === curr!.from);
      if (revIdx === -1) break;

      const nextIdx = (revIdx - 1 + outList.length) % outList.length;
      curr = outList[nextIdx];
    }

    if (faceEdges.length >= 3 && curr === he) {
      const poly = faceEdges.map((e) => vMap.get(e.from)!);
      let signedArea = 0;
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % n];
        signedArea += p1.x * p2.y - p2.x * p1.y;
      }
      signedArea /= 2;

      // Solo caras cerradas en orientación antihoraria con área positiva > 0.05 m²
      if (signedArea > 0.05) {
        const uniqueWallIds: string[] = [];
        for (const e of faceEdges) {
          for (const wid of e.wallIds) {
            if (!uniqueWallIds.includes(wid)) {
              uniqueWallIds.push(wid);
            }
          }
        }

        cycles.push({
          vertexIds: faceEdges.map((e) => e.from),
          wallIds: uniqueWallIds
        });
      }
    }
  }

  return cycles;
}

function findCyclesTopologicalFallback(
  walls: Array<{ id: string; startVertexId: string; endVertexId: string }>
): { vertexIds: string[]; wallIds: string[] }[] {
  const adj = new Map<string, Array<{ to: string; wallId: string }>>();

  for (const w of walls) {
    if (!adj.has(w.startVertexId)) adj.set(w.startVertexId, []);
    if (!adj.has(w.endVertexId)) adj.set(w.endVertexId, []);
    adj.get(w.startVertexId)!.push({ to: w.endVertexId, wallId: w.id });
    adj.get(w.endVertexId)!.push({ to: w.startVertexId, wallId: w.id });
  }

  const cycles: { vertexIds: string[]; wallIds: string[] }[] = [];
  const visitedPaths = new Set<string>();

  function dfs(
    start: string,
    current: string,
    visited: string[],
    usedWalls: string[]
  ) {
    if (visited.length > 12) return;

    const neighbors = adj.get(current) || [];
    for (const { to, wallId } of neighbors) {
      if (usedWalls.length > 0 && wallId === usedWalls[usedWalls.length - 1]) continue;

      if (to === start && visited.length >= 3) {
        const sortedKey = [...visited].sort().join('-');
        if (!visitedPaths.has(sortedKey)) {
          visitedPaths.add(sortedKey);
          cycles.push({
            vertexIds: [...visited],
            wallIds: [...usedWalls, wallId]
          });
        }
        continue;
      }

      if (!visited.includes(to)) {
        dfs(start, to, [...visited, to], [...usedWalls, wallId]);
      }
    }
  }

  for (const vId of adj.keys()) {
    dfs(vId, vId, [vId], []);
  }

  return cycles;
}

