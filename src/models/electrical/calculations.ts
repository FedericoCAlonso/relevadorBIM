/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTOR DE CÁLCULO: calculations.ts
 * Verificaciones Técnicas y Fórmulas según Norma AEA 90364-771.
 * Caídas de Tensión, Factor de Ocupación (<=35%) y Cómputo Métrico 3D.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ElectricalElement, ConductorLine, ConduitMaterial } from './ElectricalModel';
import type { Level } from '../architecture/Level';
import { AEA_CALCULATION_CONSTANTS, getSizesForConduitMaterial } from './electricalStandards';

/** Conductividad del cobre comercial en m / (Ohm * mm²) a 20°C */
export const CONDUCTIVIDAD_COBRE = AEA_CALCULATION_CONSTANTS.COPPER_CONDUCTIVITY_M_OHM_MM2;

/**
 * Calcula la longitud 3D real de una cañería entre dos bocas eléctricas.
 * Contempla la distancia ortogonal en planta más las bajadas/subidas de pared y techo,
 * y la altura entre pisos si atraviesa niveles (montante vertical).
 */
export interface ConduitLengthBreakdown {
  dx: number;
  dy: number;
  distPlantaOrthogonal: number; // dx + dy
  dzLocal: number;              // |z1 - z2|
  dzNiveles: number;           // si atraviesa losas entre niveles
  totalLengthM: number;        // (dx + dy + dzLocal + dzNiveles) * factor curvas
}

export function getConduitLengthBreakdown(params: {
  fromElement: ElectricalElement;
  toElement: ElectricalElement;
  levelsMap: Map<string, Level>;
  isOrthogonalRouting?: boolean;
}): ConduitLengthBreakdown {
  const { fromElement, toElement, levelsMap, isOrthogonalRouting = true } = params;

  // 1. Distancia en planta ortogonal según norma AEA (dx + dy)
  const dx = Math.abs(toElement.x - fromElement.x);
  const dy = Math.abs(toElement.y - fromElement.y);
  const distPlantaOrthogonal = isOrthogonalRouting ? dx + dy : Math.hypot(dx, dy);

  // 2. Desnivel en Z entre alturas de las bocas (|h1 - h2|)
  const dzLocal = Math.abs(toElement.heightZ - fromElement.heightZ);

  // 3. Desnivel entre plantas si es montante vertical
  let dzNiveles = 0;
  if (fromElement.levelId !== toElement.levelId) {
    const lvlFrom = levelsMap.get(fromElement.levelId);
    const lvlTo = levelsMap.get(toElement.levelId);
    if (lvlFrom && lvlTo) {
      dzNiveles = Math.abs(lvlTo.elevationZ - lvlFrom.elevationZ);
    }
  }

  const rawSum = distPlantaOrthogonal + dzLocal + dzNiveles;
  const totalLengthM = Number((rawSum * AEA_CALCULATION_CONSTANTS.CONDUIT_CURVE_MARGIN_FACTOR).toFixed(2));

  return {
    dx: Number(dx.toFixed(2)),
    dy: Number(dy.toFixed(2)),
    distPlantaOrthogonal: Number(distPlantaOrthogonal.toFixed(2)),
    dzLocal: Number(dzLocal.toFixed(2)),
    dzNiveles: Number(dzNiveles.toFixed(2)),
    totalLengthM
  };
}

export function calculateConduitRealLength(params: {
  fromElement: ElectricalElement;
  toElement: ElectricalElement;
  levelsMap: Map<string, Level>;
  isOrthogonalRouting?: boolean;
}): number {
  return getConduitLengthBreakdown(params).totalLengthM;
}

/**
 * Calcula la caída de tensión porcentual (Delta V %) en un tramo de circuito.
 * Para iluminación: admisible <= 3%.
 * Para tomas / fuerza motriz: admisible <= 5%.
 */
export function calculateVoltageDropPercent(params: {
  currentA: number;        // Corriente nominal de carga en Amperios
  lengthM: number;         // Longitud del conductor en metros
  sectionMM2: number;      // Sección del cable en mm² (ej: 2.5)
  voltageV?: number;       // Tensión nominal (default 220V monofásico)
  isThreePhase?: boolean;  // Monofásico o trifásico
  cosPhi?: number;         // Factor de potencia (default 0.9)
}): { deltaVVolts: number; deltaVPercent: number; isCompliant: boolean } {
  const {
    currentA,
    lengthM,
    sectionMM2,
    voltageV = AEA_CALCULATION_CONSTANTS.VOLTAGE_SINGLE_PHASE_V,
    isThreePhase = false,
    cosPhi = AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_FACTOR_COS_PHI
  } = params;

  if (sectionMM2 <= 0 || voltageV <= 0) {
    return { deltaVVolts: 0, deltaVPercent: 0, isCompliant: false };
  }

  const k = isThreePhase ? Math.sqrt(3) : 2.0;
  // Delta V = (k * L * I * cos(phi)) / (gamma * S)
  const deltaVVolts = (k * lengthM * currentA * cosPhi) / (CONDUCTIVIDAD_COBRE * sectionMM2);
  const deltaVPercent = (deltaVVolts / voltageV) * 100;

  // Límite reglamentario AEA: 3% para circuitos terminales de iluminación, 5% tomas
  const isCompliant = deltaVPercent <= AEA_CALCULATION_CONSTANTS.MAX_VOLTAGE_DROP_LIGHTING_PERCENT;

  return {
    deltaVVolts: Number(deltaVVolts.toFixed(2)),
    deltaVPercent: Number(deltaVPercent.toFixed(2)),
    isCompliant
  };
}

/**
 * FACTOR DE OCUPACIÓN DE CAÑERÍA (Norma AEA 90364-771.12.3.4):
 * La suma de las secciones exteriores de los conductores (incluido aislamiento)
 * no debe superar el 35% de la sección interna de la cañería.
 */
export function calculateConduitOccupancyFactor(params: {
  conduitDiameterMM: number; // Diámetro exterior comercial o ancho de bandeja
  material?: ConduitMaterial;
  conductors: ConductorLine[];
}): {
  occupancyPercent: number;
  maxAllowedPercent: number;
  isCompliant: boolean;
} {
  const { conduitDiameterMM, material, conductors } = params;

  let conduitArea = 0;
  if (material) {
    const sizeOpt = getSizesForConduitMaterial(material).find((s) => s.value === conduitDiameterMM);
    if (sizeOpt && typeof sizeOpt.usefulAreaMM2 === 'number' && sizeOpt.usefulAreaMM2 > 0) {
      conduitArea = sizeOpt.usefulAreaMM2;
    }
  }

  if (conduitArea <= 0) {
    // Diámetro interior aproximado según tipo comercial estándar
    const internalDiameter = conduitDiameterMM * 0.82;
    conduitArea = (Math.PI * Math.pow(internalDiameter, 2)) / 4;
  }

  // Estimación de diámetro exterior por conductor (cobre + aislación PVC IRAM 247-3)
  let totalCablesArea = 0;
  for (const c of conductors) {
    const cableExtDiam = 2.0 + Math.sqrt(c.sectionMM2) * 1.0;
    const cableArea = (Math.PI * Math.pow(cableExtDiam, 2)) / 4;
    totalCablesArea += cableArea;
  }

  const occupancyPercent = conduitArea > 0 ? (totalCablesArea / conduitArea) * 100 : 0;
  const maxAllowedPercent = AEA_CALCULATION_CONSTANTS.MAX_CONDUIT_OCCUPANCY_PERCENT;

  return {
    occupancyPercent: Number(occupancyPercent.toFixed(1)),
    maxAllowedPercent,
    isCompliant: occupancyPercent <= maxAllowedPercent
  };
}

/**
 * Genera la próxima etiqueta única para un prefijo dado inspeccionando
 * todas las etiquetas existentes en el proyecto.
 * Garantiza unicidad global en todo el plano (sin duplicados).
 */
export function generateNextUniqueLabel(
  prefix: string,
  existingItems: Array<string | { label?: string }>,
  startNumber: number = 1
): string {
  const cleanPrefix = prefix.trim();
  const basePrefix = cleanPrefix.length > 0 ? cleanPrefix : 'B';

  // Escapar caracteres especiales para la expresión regular
  const escaped = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Coincide con prefijo seguido opcionalmente de espacio, guion o guion bajo, y un número entero al final
  const regex = new RegExp(`^${escaped}(?:[\\s-_]?(\\d+))?$`, 'i');

  const usedNumbers = new Set<number>();

  for (const item of existingItems) {
    const label = typeof item === 'string' ? item : item.label;
    if (!label) continue;
    const match = label.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num)) {
        usedNumbers.add(num);
      }
    }
  }

  let candidate = Math.max(1, Math.floor(startNumber));
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  // Si el prefijo original termina en espacio o guion, respetar ese formato; sino concatenar directo
  if (prefix.endsWith(' ') || prefix.endsWith('-') || prefix.endsWith('_')) {
    return `${prefix}${candidate}`;
  }
  return `${basePrefix}${candidate}`;
}

/**
 * Convierte una secuencia de puntos ortogonales [P0, P1, ..., Pn] en una cadena SVG de trazado `d`
 * con esquinas redondeadas continuas (arcos Bézier cuadráticos tangentes de radio técnico a 90°).
 */
export function generateRoundedPolylineSvgPath(
  points: Array<{ x: number; y: number }>,
  radius: number = 14
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const d1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const d2 = Math.hypot(v2x, v2y);

    // Si los segmentos son muy pequeños o degenerados, dibujar recta directa
    if (d1 < 0.5 || d2 < 0.5) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    const u1x = v1x / d1;
    const u1y = v1y / d1;
    const u2x = v2x / d2;
    const u2y = v2y / d2;

    // Verificar si son casi colineales (recta continua sin quiebre)
    const dot = u1x * u2x + u1y * u2y;
    if (dot < -0.99) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    // Radio efectivo adaptativo al espacio disponible para evitar auto-cruces
    const effectiveRadius = Math.min(radius, d1 / 2, d2 / 2);
    if (effectiveRadius < 0.5) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    const tinX = curr.x + u1x * effectiveRadius;
    const tinY = curr.y + u1y * effectiveRadius;
    const toutX = curr.x + u2x * effectiveRadius;
    const toutY = curr.y + u2y * effectiveRadius;

    d += ` L ${tinX.toFixed(1)} ${tinY.toFixed(1)} Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${toutX.toFixed(1)} ${toutY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  return d;
}

/**
 * Genera una polilínea ortogonal (en escuadra) entre dos puntos,
 * respetando waypoints explícitos intermedios si existen.
 */
export function computeOrthogonalConduitPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  waypoints?: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  const rawKeyPoints = [from, ...(waypoints || []), to];
  const result: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }];

  for (let i = 0; i < rawKeyPoints.length - 1; i++) {
    const pA = rawKeyPoints[i];
    const pB = rawKeyPoints[i + 1];

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;

    if (Math.abs(dx) < 0.1 || Math.abs(dy) < 0.1) {
      result.push({ x: pB.x, y: pB.y });
    } else {
      let corner: { x: number; y: number };
      if (Math.abs(dx) >= Math.abs(dy)) {
        corner = { x: pB.x, y: pA.y };
      } else {
        corner = { x: pA.x, y: pB.y };
      }
      result.push(corner);
      result.push({ x: pB.x, y: pB.y });
    }
  }

  return result;
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
  thresholdM: number = 0.30
): ConduitVerticalTransition {
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
