/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: spaceWallReference.ts
 * Cálculo geométrico y relacional de las paredes de un ambiente específico.
 * Asigna referencias relativas normalizadas (Pared A, Pared B, Pared C...)
 * en sentido horario partiendo desde el vértice más al Norte/Noroeste.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Space } from './Space';
import { resolveSpacePolygon, isPointInPolygon } from './Space';
import type { Wall, WallVertex } from './Wall';

export interface SpaceWallReference {
  /** Letra asignada en secuencia horaria: 'A', 'B', 'C', 'D'... */
  readonly letter: string;
  /** Índice numérico base 0 (0 para 'A', 1 para 'B', etc.) */
  readonly index: number;
  /** Nombre completo contextual para el usuario: ej. "Pared A · Living" */
  readonly fullName: string;
  /** Rótulo corto: ej. "Pared A" */
  readonly shortLabel: string;
  /** ID del muro físico asociado si existe en el modelo */
  readonly wallId: string | null;
  /** Coordenada de inicio del tramo (en sentido horario) */
  readonly p1: { readonly x: number; readonly y: number };
  /** Coordenada de fin del tramo (en sentido horario) */
  readonly p2: { readonly x: number; readonly y: number };
  /** Longitud métrica del tramo en metros */
  readonly lengthM: number;
  /** Orientación cardinal predominante en planta */
  readonly compassOrientation: 'Norte' | 'Sur' | 'Este' | 'Oeste';
  /** Punto medio geométrico del tramo */
  readonly midPoint: { readonly x: number; readonly y: number };
  /** Vector unitario apuntando hacia el interior del recinto */
  readonly innerNormal: { readonly x: number; readonly y: number };
  /** Coordenadas recomendadas para el badge identificador dentro del ambiente */
  readonly badgePosition: { readonly x: number; readonly y: number };
}

/**
 * Calcula las referencias relativas de las paredes de un ambiente (Pared A, B, C...).
 * Las caras se ordenan invariablemente en sentido horario partiendo desde la esquina superior/Norte.
 */
export function calculateSpaceWallReferences(
  space: Space,
  verticesMap: Map<string, WallVertex>,
  walls: ReadonlyArray<Wall> | ReadonlyMap<string, Wall>
): SpaceWallReference[] {
  const poly = resolveSpacePolygon(space, verticesMap);
  if (poly.length < 3) return [];

  const wallIterable = walls instanceof Map ? walls.values() : walls;

  // 1. Cálculo de área con signo (Shoelace) para garantizar sentido horario
  let signedArea = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    signedArea += p1.x * p2.y - p2.x * p1.y;
  }
  signedArea /= 2;

  // En el sistema de coordenadas de pantalla/SVG (Y crece hacia abajo),
  // signedArea > 0 corresponde a orientación Horaria (Clockwise).
  const cwPoly = signedArea > 0 ? [...poly] : [...poly].reverse();

  // 2. Normalización del vértice de partida: el punto más al Norte (menor Y, menor X)
  let bestIdx = 0;
  for (let i = 1; i < cwPoly.length; i++) {
    const cur = cwPoly[i];
    const best = cwPoly[bestIdx];
    if (cur.y < best.y - 0.05 || (Math.abs(cur.y - best.y) <= 0.05 && cur.x < best.x)) {
      bestIdx = i;
    }
  }

  const orderedPoly = [
    ...cwPoly.slice(bestIdx),
    ...cwPoly.slice(0, bestIdx)
  ];

  // 3. Baricentro / Centroide del polígono para derivar orientaciones cardinales
  let cx = 0;
  let cy = 0;
  for (const pt of orderedPoly) {
    cx += pt.x;
    cy += pt.y;
  }
  cx /= orderedPoly.length;
  cy /= orderedPoly.length;

  // 4. Derivación de tramos perimetrales
  const results: SpaceWallReference[] = [];

  for (let i = 0; i < orderedPoly.length; i++) {
    const p1 = orderedPoly[i];
    const p2 = orderedPoly[(i + 1) % orderedPoly.length];
    const letter = String.fromCharCode(65 + i);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Normal candidata hacia el interior del ambiente (giro de 90° a la derecha)
    let inNx = -dy / len;
    let inNy = dx / len;
    const testPt = { x: midX + inNx * 0.05, y: midY + inNy * 0.05 };
    if (!isPointInPolygon(testPt, orderedPoly)) {
      inNx = -inNx;
      inNy = -inNy;
    }

    // Ubicación del badge flotante ligeramente desfasado hacia el interior del recinto
    const badgeDist = Math.min(0.35, len * 0.25);
    const badgeX = midX + inNx * badgeDist;
    const badgeY = midY + inNy * badgeDist;

    // Orientación cardinal relativa al centroide
    const vx = midX - cx;
    const vy = midY - cy;
    let orientation: 'Norte' | 'Sur' | 'Este' | 'Oeste';
    if (Math.abs(vy) >= Math.abs(vx)) {
      orientation = vy < 0 ? 'Norte' : 'Sur';
    } else {
      orientation = vx > 0 ? 'Este' : 'Oeste';
    }

    // Búsqueda del muro físico que contiene este tramo
    let matchedWallId: string | null = null;
    for (const w of wallIterable) {
      const vS = verticesMap.get(w.startVertexId);
      const vE = verticesMap.get(w.endVertexId);
      if (!vS || !vE) continue;

      // a) Coincidencia directa de extremos
      const dDirect = Math.hypot(vS.x - p1.x, vS.y - p1.y) + Math.hypot(vE.x - p2.x, vE.y - p2.y);
      const dInverted = Math.hypot(vS.x - p2.x, vS.y - p2.y) + Math.hypot(vE.x - p1.x, vE.y - p1.y);
      if (dDirect < 0.05 || dInverted < 0.05) {
        matchedWallId = w.id;
        break;
      }

      // b) Colinealidad si el muro físico es más largo y abarca este tramo
      const wallDx = vE.x - vS.x;
      const wallDy = vE.y - vS.y;
      const wallLenSq = wallDx * wallDx + wallDy * wallDy;
      if (wallLenSq > 0.01) {
        const t = Math.max(0, Math.min(1, ((midX - vS.x) * wallDx + (midY - vS.y) * wallDy) / wallLenSq));
        const projX = vS.x + t * wallDx;
        const projY = vS.y + t * wallDy;
        if (Math.hypot(midX - projX, midY - projY) < 0.08) {
          matchedWallId = w.id;
          break;
        }
      }
    }

    results.push({
      letter,
      index: i,
      fullName: `Pared ${letter} · ${space.name}`,
      shortLabel: `Pared ${letter}`,
      wallId: matchedWallId,
      p1: { x: Number(p1.x.toFixed(3)), y: Number(p1.y.toFixed(3)) },
      p2: { x: Number(p2.x.toFixed(3)), y: Number(p2.y.toFixed(3)) },
      lengthM: Number(len.toFixed(2)),
      compassOrientation: orientation,
      midPoint: { x: Number(midX.toFixed(3)), y: Number(midY.toFixed(3)) },
      innerNormal: { x: Number(inNx.toFixed(3)), y: Number(inNy.toFixed(3)) },
      badgePosition: { x: Number(badgeX.toFixed(3)), y: Number(badgeY.toFixed(3)) }
    });
  }

  return results;
}
