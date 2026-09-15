/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Space.ts
 * Ambientes y Espacios Funcionales (BIM IfcSpace).
 * Los ambientes son emergentes: habitan el volumen delimitado por las caras
 * de los muros del edificio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Vector2D, WallVertex } from './Wall';

export type SpaceCategory =
  | 'living'
  | 'dormitorio'
  | 'cocina'
  | 'bano'
  | 'pasillo'
  | 'lavadero'
  | 'cochera'
  | 'escalera'
  | 'exterior'
  | 'otro';

export interface Space {
  id: string;
  name: string;                // Ej: "Living Comedor", "Dormitorio 1"
  category: SpaceCategory;
  levelId: string;             // Nivel/planta al que pertenece
  ceilingHeight: number;       // Altura libre piso-cielorraso en metros (default: 2.70)
  floorElevation: number;      // Desnivel del piso respecto al nivel de planta (default: 0.00)
  boundaryVertexIds: string[]; // Vértices ordenados que forman el perímetro interior
  wallIds: string[];           // IDs de los muros que lo rodean
  color?: string;              // Color tenue de relleno para identificación
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
  for (const vId of space.boundaryVertexIds) {
    const v = vertices.get(vId);
    if (v) points.push({ x: v.x, y: v.y });
  }
  return points;
}

/**
 * Detecta ciclos simples en el grafo de muros para identificar ambientes cerrados.
 */
export function findEnclosedCycles(walls: Array<{ id: string; startVertexId: string; endVertexId: string }>): {
  vertexIds: string[];
  wallIds: string[];
}[] {
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

