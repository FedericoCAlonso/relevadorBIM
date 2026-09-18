/**
 * ═══════════════════════════════════════════════════════════════════════════
 * conduitMetrics.ts — Responsabilidad Única:
 * Cómputo Métrico 3D de Cañerías, Desniveles Verticales y Transiciones BIM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  SpatialElectricalNode,
  ConduitRoutingPlane,
  ConduitWaypoint
} from './ElectricalModel';
import type { Level } from '../architecture/Level';
import { AEA_CALCULATION_CONSTANTS } from './electricalStandards';

export interface ConduitLengthBreakdown {
  dx: number;
  dy: number;
  distPlantaHorizontal: number; // Distancia real en planta según vía de tendido y waypoints
  distPlantaOrthogonal: number; // Mantenido para retrocompatibilidad con tests existentes
  dzLocal: number;              // Desniveles verticales locales (subidas + bajadas de pared)
  dzNiveles: number;           // Si atraviesa losas entre niveles
  additionalLengthM: number;   // Metros adicionales restantes (montante / pase)
  totalLengthM: number;        // (distPlanta + dzLocal + dzNiveles + additionalLengthM) * 1.10
}

/**
 * Calcula la longitud 3D real de una cañería entre dos nodos espaciales.
 * Contempla la distancia en planta (ortogonal en pared o diagonal en losa de techo/contrapiso),
 * las subidas y bajadas de pared hacia la losa o contrapiso, waypoints intermedios y montantes multinivel.
 */
export function getConduitLengthBreakdown(params: {
  fromElement: SpatialElectricalNode;
  toElement: SpatialElectricalNode;
  levelsMap: Map<string, Level>;
  isOrthogonalRouting?: boolean;
  routingPlane?: ConduitRoutingPlane;
  ceilingHeightM?: number;
  waypoints?: ConduitWaypoint[];
  additionalLengthM?: number;
}): ConduitLengthBreakdown {
  const {
    fromElement,
    toElement,
    levelsMap,
    isOrthogonalRouting = true,
    routingPlane = 'wall',
    ceilingHeightM = 2.70,
    waypoints = [],
    additionalLengthM = 0
  } = params;

  const dx = Math.abs(toElement.x - fromElement.x);
  const dy = Math.abs(toElement.y - fromElement.y);

  // 1. Distancia en planta horizontal según vía de tendido
  const allPoints: Array<{ x: number; y: number }> = [
    { x: fromElement.x, y: fromElement.y },
    ...(waypoints || []).map((w) => ({ x: w.x, y: w.y })),
    { x: toElement.x, y: toElement.y }
  ];

  let distPlantaHorizontal = 0;
  for (let i = 0; i < allPoints.length - 1; i++) {
    const segDx = Math.abs(allPoints[i + 1].x - allPoints[i].x);
    const segDy = Math.abs(allPoints[i + 1].y - allPoints[i].y);

    if (routingPlane === 'ceiling_slab' || routingPlane === 'floor_slab') {
      distPlantaHorizontal += Math.hypot(segDx, segDy);
    } else {
      distPlantaHorizontal += isOrthogonalRouting ? segDx + segDy : Math.hypot(segDx, segDy);
    }
  }

  // 2. Desniveles verticales locales (subidas y bajadas por pared)
  let dzLocal = 0;
  if (routingPlane === 'ceiling_slab') {
    const subidaOrigen = Math.max(0, ceilingHeightM - fromElement.heightZ);
    const bajadaDestino = Math.max(0, ceilingHeightM - toElement.heightZ);
    dzLocal = subidaOrigen + bajadaDestino;
  } else if (routingPlane === 'floor_slab') {
    dzLocal = Math.max(0, fromElement.heightZ) + Math.max(0, toElement.heightZ);
  } else {
    dzLocal = Math.abs(toElement.heightZ - fromElement.heightZ);
  }

  // Sumar desniveles explícitos en waypoints intermedios si existen
  if (waypoints && waypoints.length > 0) {
    for (const wp of waypoints) {
      if (typeof wp.dzLocal === 'number' && wp.dzLocal > 0) {
        dzLocal += wp.dzLocal;
      }
    }
  }

  // 3. Desnivel entre plantas si es montante vertical que atraviesa losas entre niveles
  let dzNiveles = 0;
  if (fromElement.levelId !== toElement.levelId) {
    const lvlFrom = levelsMap.get(fromElement.levelId);
    const lvlTo = levelsMap.get(toElement.levelId);
    if (lvlFrom && lvlTo) {
      dzNiveles = Math.abs(lvlTo.elevationZ - lvlFrom.elevationZ);
    }
  }

  const extraM = Math.max(0, additionalLengthM || 0);
  const rawSum = distPlantaHorizontal + dzLocal + dzNiveles + extraM;
  const totalLengthM = Number((rawSum * AEA_CALCULATION_CONSTANTS.CONDUIT_CURVE_MARGIN_FACTOR).toFixed(2));

  return {
    dx: Number(dx.toFixed(2)),
    dy: Number(dy.toFixed(2)),
    distPlantaHorizontal: Number(distPlantaHorizontal.toFixed(2)),
    distPlantaOrthogonal: Number(distPlantaHorizontal.toFixed(2)),
    dzLocal: Number(dzLocal.toFixed(2)),
    dzNiveles: Number(dzNiveles.toFixed(2)),
    additionalLengthM: Number(extraM.toFixed(2)),
    totalLengthM
  };
}

export function calculateConduitRealLength(params: {
  fromElement: SpatialElectricalNode;
  toElement: SpatialElectricalNode;
  levelsMap: Map<string, Level>;
  isOrthogonalRouting?: boolean;
  routingPlane?: ConduitRoutingPlane;
  ceilingHeightM?: number;
  waypoints?: ConduitWaypoint[];
  additionalLengthM?: number;
}): number {
  return getConduitLengthBreakdown(params).totalLengthM;
}

export interface ConduitVerticalTransition {
  hasTransition: boolean;
  dzLocal: number;
  fromType: 'none' | 'subida' | 'bajada';
  toType: 'none' | 'subida' | 'bajada';
  glyphTextFrom?: string;
  glyphTextTo?: string;
}

/**
 * Analiza el desnivel vertical entre dos bocas eléctricas y genera las cotas
 * y glifos normalizados IRAM/AEA de subida (▲) o bajada (▼).
 */
export function getConduitVerticalTransitions(
  fromHeightZ: number,
  toHeightZ: number,
  thresholdM: number = 0.30,
  routingPlane: ConduitRoutingPlane = 'wall',
  ceilingHeightM: number = 2.70
): ConduitVerticalTransition {
  if (routingPlane === 'ceiling_slab') {
    const subidaOrigen = ceilingHeightM - fromHeightZ;
    const bajadaDestino = ceilingHeightM - toHeightZ;
    const hasFrom = subidaOrigen >= thresholdM;
    const hasTo = bajadaDestino >= thresholdM;

    return {
      hasTransition: hasFrom || hasTo,
      dzLocal: Number((Math.max(0, subidaOrigen) + Math.max(0, bajadaDestino)).toFixed(2)),
      fromType: hasFrom ? 'subida' : 'none',
      toType: hasTo ? 'bajada' : 'none',
      glyphTextFrom: hasFrom ? `▲ S. ${subidaOrigen.toFixed(2)}m` : undefined,
      glyphTextTo: hasTo ? `▼ B. ${bajadaDestino.toFixed(2)}m` : undefined
    };
  }

  if (routingPlane === 'floor_slab') {
    const bajadaOrigen = fromHeightZ;
    const subidaDestino = toHeightZ;
    const hasFrom = bajadaOrigen >= thresholdM;
    const hasTo = subidaDestino >= thresholdM;

    return {
      hasTransition: hasFrom || hasTo,
      dzLocal: Number((Math.max(0, bajadaOrigen) + Math.max(0, subidaDestino)).toFixed(2)),
      fromType: hasFrom ? 'bajada' : 'none',
      toType: hasTo ? 'subida' : 'none',
      glyphTextFrom: hasFrom ? `▼ B. ${bajadaOrigen.toFixed(2)}m` : undefined,
      glyphTextTo: hasTo ? `▲ S. ${subidaDestino.toFixed(2)}m` : undefined
    };
  }

  // Vía de tendido por pared ('wall') a cota directa:
  const dz = Math.abs(fromHeightZ - toHeightZ);
  if (dz < thresholdM) {
    return {
      hasTransition: false,
      dzLocal: 0,
      fromType: 'none',
      toType: 'none'
    };
  }

  const dzRounded = Number(dz.toFixed(2));

  if (fromHeightZ > toHeightZ) {
    return {
      hasTransition: true,
      dzLocal: dzRounded,
      fromType: 'none',
      toType: 'bajada',
      glyphTextTo: `▼ B. ${dzRounded.toFixed(2)}m`
    };
  } else {
    return {
      hasTransition: true,
      dzLocal: dzRounded,
      fromType: 'none',
      toType: 'subida',
      glyphTextTo: `▲ S. ${dzRounded.toFixed(2)}m`
    };
  }
}
