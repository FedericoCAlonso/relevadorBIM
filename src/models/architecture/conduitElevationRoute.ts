/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: conduitElevationRoute.ts — Responsabilidad Única:
 * Generación, edición geométrica ortogonal, cómputo métrico y proyección
 * a planta de recorridos reales de canalizaciones en el alzado de muro.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  ConduitElevationPoint,
  ConduitElevationRoute,
  ConduitRoutePreset
} from '../electrical/ElectricalModel';

export const CONDUIT_ROUTE_DEFAULTS = {
  ADJACENT_MAX_GAP_M: 0.30,
  TOP_BRIDGE_CLEARANCE_M: 0.20,
  DRAG_STEP_M: 0.01,
  MIN_SEGMENT_LENGTH_M: 0.05,
  DECIMALS: 3
} as const;

export interface ConduitPresetOption {
  id: ConduitRoutePreset;
  label: string;
  description: string;
}

export const CONDUIT_ROUTE_PRESET_OPTIONS: readonly ConduitPresetOption[] = [
  {
    id: 'top_bridge',
    label: 'Puente superior',
    description: 'Sube hacia el dintel/cielorraso para evitar condensación'
  },
  {
    id: 'direct',
    label: 'Directo',
    description: 'Enlace recto u ortogonal directo entre cajas contiguas'
  },
  {
    id: 'ceiling_exit',
    label: 'A losa / cielorraso',
    description: 'Sube verticalmente hacia la losa o cielorraso'
  },
  {
    id: 'floor_exit',
    label: 'A contrapiso',
    description: 'Baja verticalmente hacia el contrapiso o piso terminado'
  },
  {
    id: 'custom',
    label: 'Personalizado',
    description: 'Recorrido con quiebres modificados por el usuario'
  }
] as const;

function round(n: number): number {
  return Number(n.toFixed(CONDUIT_ROUTE_DEFAULTS.DECIMALS));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Calcula el desglose métrico ortogonal de un recorrido en alzado.
 */
export function routeLengthBreakdown(points: readonly ConduitElevationPoint[]): {
  horizontalM: number;
  verticalM: number;
  totalM: number;
} {
  let horizontalM = 0;
  let verticalM = 0;
  for (let i = 0; i < points.length - 1; i++) {
    horizontalM += Math.abs(points[i + 1].u - points[i].u);
    verticalM += Math.abs(points[i + 1].z - points[i].z);
  }
  return {
    horizontalM: round(horizontalM),
    verticalM: round(verticalM),
    totalM: round(horizontalM + verticalM)
  };
}

/**
 * Retorna la longitud métrica ortogonal desarrollada del recorrido.
 */
export function routeLengthM(points: readonly ConduitElevationPoint[]): number {
  return routeLengthBreakdown(points).totalM;
}

export interface BuildPresetElevationRouteParams {
  wallId: string;
  fromU: number;
  fromZ: number;
  toU: number;
  toZ: number;
  preset: ConduitRoutePreset;
  ceilingZ: number;
  wallHeightM: number;
}

/**
 * Genera la poligonal ortogonal para un preset dado en el sistema de coordenadas del muro (u: abscisa, z: cota).
 */
export function buildPresetElevationRoute(params: BuildPresetElevationRouteParams): ConduitElevationRoute {
  const { wallId, fromU, fromZ, toU, toZ, preset, ceilingZ, wallHeightM } = params;
  const maxZ = Math.min(ceilingZ, wallHeightM);

  if (preset === 'ceiling_exit') {
    const p0: ConduitElevationPoint = { u: round(fromU), z: round(fromZ) };
    const p1: ConduitElevationPoint = { u: round(fromU), z: round(maxZ) };
    return { wallId, preset, points: [p0, p1] };
  }

  if (preset === 'floor_exit') {
    const p0: ConduitElevationPoint = { u: round(fromU), z: round(fromZ) };
    const p1: ConduitElevationPoint = { u: round(fromU), z: 0 };
    return { wallId, preset, points: [p0, p1] };
  }

  if (preset === 'direct') {
    const p0: ConduitElevationPoint = { u: round(fromU), z: round(fromZ) };
    const pTarget: ConduitElevationPoint = { u: round(toU), z: round(toZ) };
    if (Math.abs(fromZ - toZ) < 0.005) {
      return { wallId, preset, points: [p0, pTarget] };
    }
    // Paso ortogonal en escuadra
    const p1: ConduitElevationPoint = { u: round(fromU), z: round(toZ) };
    return { wallId, preset, points: [p0, p1, pTarget] };
  }

  // top_bridge por defecto
  const bridgeTargetZ = maxZ - CONDUIT_ROUTE_DEFAULTS.TOP_BRIDGE_CLEARANCE_M;
  const bridgeZ = round(Math.max(fromZ, toZ, bridgeTargetZ));

  const p0: ConduitElevationPoint = { u: round(fromU), z: round(fromZ) };
  const p1: ConduitElevationPoint = { u: round(fromU), z: bridgeZ };
  const p2: ConduitElevationPoint = { u: round(toU), z: bridgeZ };
  const p3: ConduitElevationPoint = { u: round(toU), z: round(toZ) };

  return { wallId, preset: 'top_bridge', points: [p0, p1, p2, p3] };
}

/**
 * Modifica la cota de altura de un puente superior sin alterar los extremos de conexión.
 */
export function moveBridgeHeight(
  points: readonly ConduitElevationPoint[],
  targetZ: number,
  maxZ: number
): ConduitElevationPoint[] {
  if (points.length < 4) return [...points];
  const clampedZ = round(clamp(targetZ, 0, maxZ));
  return points.map((p, idx) => {
    // Los puntos intermedios del puente (1 y 2 en una ruta estándar de 4 puntos) toman la nueva cota
    if (idx > 0 && idx < points.length - 1) {
      return { u: p.u, z: clampedZ };
    }
    return p;
  });
}

/**
 * Mueve un punto de control del recorrido, preservando la ortogonalidad de los tramos adyacentes.
 */
export function moveRoutePoint(params: {
  points: readonly ConduitElevationPoint[];
  index: number;
  targetU: number;
  targetZ: number;
  wallLengthM: number;
  wallHeightM: number;
}): ConduitElevationPoint[] {
  const { points, index, targetU, targetZ, wallLengthM, wallHeightM } = params;
  if (index < 0 || index >= points.length) return [...points];

  // Los extremos (0 y último) no deben moverse libremente porque anclan a las cajas
  if (index === 0 || index === points.length - 1) {
    return [...points];
  }

  const u = round(clamp(targetU, 0, wallLengthM));
  const z = round(clamp(targetZ, 0, wallHeightM));

  const next = points.map((p) => ({ ...p }));
  next[index] = { u, z };

  // Si es un puente de 4 puntos y se mueve el punto 1 o 2 en Z, ambos sincronizan Z para mantener la horizontal
  if (points.length === 4) {
    if (index === 1) {
      next[2].z = z;
    } else if (index === 2) {
      next[1].z = z;
    }
  }

  return next;
}

/**
 * Inserta un punto intermedio en el recorrido.
 */
export function insertRoutePoint(
  points: readonly ConduitElevationPoint[],
  afterIndex: number,
  point: ConduitElevationPoint
): ConduitElevationPoint[] {
  const next = [...points];
  const idx = clamp(afterIndex + 1, 1, points.length - 1);
  next.splice(idx, 0, { u: round(point.u), z: round(point.z) });
  return next;
}

/**
 * Elimina un punto de control intermedio. Los extremos quedan protegidos.
 */
export function removeRoutePoint(
  points: readonly ConduitElevationPoint[],
  index: number
): ConduitElevationPoint[] {
  if (index <= 0 || index >= points.length - 1 || points.length <= 2) {
    return [...points];
  }
  const next = [...points];
  next.splice(index, 1);
  return next;
}

/**
 * Proyecta los puntos del alzado (u, z) a coordenadas tridimensionales de planta (x, y, heightZ).
 */
export function elevationRouteToPlanWaypoints(
  points: readonly ConduitElevationPoint[],
  wallFrame: { origin: { x: number; y: number }; ux: number; uy: number }
): Array<{ x: number; y: number; heightZ: number }> {
  return points.map((p) => ({
    x: round(wallFrame.origin.x + wallFrame.ux * p.u),
    y: round(wallFrame.origin.y + wallFrame.uy * p.u),
    heightZ: round(p.z)
  }));
}
