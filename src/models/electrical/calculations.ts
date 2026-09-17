/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTOR DE CÁLCULO: calculations.ts
 * Verificaciones Técnicas y Fórmulas según Norma AEA 90364-771.
 * Caídas de Tensión, Factor de Ocupación (<=35%) y Cómputo Métrico 3D.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  ElectricalElement,
  ConductorLine,
  ConduitMaterial,
  ConduitRoutingPlane,
  LabelDisplayMode,
  ConduitWaypoint
} from './ElectricalModel';
import type { Level } from '../architecture/Level';
import { AEA_CALCULATION_CONSTANTS, getSizesForConduitMaterial } from './electricalStandards';

/** Conductividad del cobre comercial en m / (Ohm * mm²) a 20°C */
export const CONDUCTIVIDAD_COBRE = AEA_CALCULATION_CONSTANTS.COPPER_CONDUCTIVITY_M_OHM_MM2;

/**
 * Calcula la longitud 3D real de una cañería entre dos bocas eléctricas.
 * Contempla la distancia en planta (ortogonal en pared o diagonal/libre en losa de techo o contrapiso),
 * las subidas y bajadas de pared hacia la losa o contrapiso,
 * waypoints intermedios, altura entre pisos si atraviesa niveles (montante) y longitudes adicionales de pase.
 */
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

export function getConduitLengthBreakdown(params: {
  fromElement: ElectricalElement;
  toElement: ElectricalElement;
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
  // Por losa de techo ('ceiling_slab') o contrapiso ('floor_slab'), la norma AEA 90364-771
  // permite recorridos en diagonal libre sin obligar a ruteo en escuadra.
  // Por pared ('wall'), rige el ruteo ortogonal estricto a 90°.
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
      // En losa o contrapiso: diagonal euclidiana libre
      distPlantaHorizontal += Math.hypot(segDx, segDy);
    } else {
      // En pared ('wall'): ortogonal si isOrthogonalRouting es true, sino hipotenusa
      distPlantaHorizontal += isOrthogonalRouting ? segDx + segDy : Math.hypot(segDx, segDy);
    }
  }

  // 2. Desniveles verticales locales (subidas y bajadas por pared)
  let dzLocal = 0;
  if (routingPlane === 'ceiling_slab') {
    // Cruza por losa superior a cota Z_ceiling.
    // Sube en boca de inicio desde su altura hasta el techo: max(0, Z_ceiling - h1)
    // Baja en boca de destino desde el techo hasta su altura: max(0, Z_ceiling - h2)
    const subidaOrigen = Math.max(0, ceilingHeightM - fromElement.heightZ);
    const bajadaDestino = Math.max(0, ceilingHeightM - toElement.heightZ);
    dzLocal = subidaOrigen + bajadaDestino;
  } else if (routingPlane === 'floor_slab') {
    // Cruza por contrapiso / losa de piso a cota Z = 0.00.
    // Baja en boca de inicio hasta el piso: max(0, h1)
    // Sube en boca de destino desde el piso: max(0, h2)
    dzLocal = Math.max(0, fromElement.heightZ) + Math.max(0, toElement.heightZ);
  } else {
    // Por pared a cota de montaje: desnivel directo entre bocas
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
  fromElement: ElectricalElement;
  toElement: ElectricalElement;
  levelsMap: Map<string, Level>;
  isOrthogonalRouting?: boolean;
  routingPlane?: ConduitRoutingPlane;
  ceilingHeightM?: number;
  waypoints?: ConduitWaypoint[];
  additionalLengthM?: number;
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
 * Genera la próxima etiqueta única para un circuito determinado.
 * Garantiza que la numeración sea independiente y única por cada circuito
 * (ej: C1 tiene B1, B2... y C2 tiene B1, B2...).
 * Si circuitId es null o undefined, numera dentro de las bocas sin circuito.
 */
export function generateNextUniqueLabelInCircuit(
  prefix: string,
  circuitId: string | null | undefined,
  existingElements: Array<{ label?: string; circuitId?: string | null }>,
  startNumber: number = 1
): string {
  const filtered = existingElements.filter((el) => {
    if (!circuitId) {
      return !el.circuitId;
    }
    return el.circuitId === circuitId;
  });

  return generateNextUniqueLabel(prefix, filtered, startNumber);
}

/**
 * Formatea dinámicamente la etiqueta compuesta de una boca eléctrica
 * según el modelo relacional (Tablero -> Circuito -> Boca).
 * Modos:
 * - 'full': "TP_C1_B1" (Tablero_Circuito_Boca)
 * - 'circuit_element': "C1_B1" (Circuito_Boca)
 * - 'element_only': "B1" (Solo Boca)
 */
export function formatElementLabel(params: {
  elementLabel?: string;
  circuit?: { name: string } | null;
  panel?: { name: string } | null;
  mode?: LabelDisplayMode;
}): string {
  const { elementLabel, circuit, panel, mode = 'full' } = params;
  const cleanEl = (elementLabel || '').trim();

  if (mode === 'element_only' || (!circuit && !panel)) {
    return cleanEl;
  }

  // Extraer identificador corto del circuito (ej: "C1" de "C1 - Tomas Uso General")
  let circShort = '';
  if (circuit?.name) {
    const match = circuit.name.trim().match(/^([a-zA-Z0-9]+)/);
    circShort = match ? match[1] : circuit.name.trim().split(' ')[0];
  }

  if (mode === 'circuit_element') {
    if (circShort && cleanEl) {
      if (cleanEl.toLowerCase().startsWith(circShort.toLowerCase() + '_')) {
        return cleanEl;
      }
      return `${circShort}_${cleanEl}`;
    }
    return circShort || cleanEl;
  }

  // mode === 'full': Tablero_Circuito_Boca
  let panelShort = '';
  if (panel?.name) {
    const parenMatch = panel.name.match(/\(([^)]+)\)/);
    if (parenMatch) {
      panelShort = parenMatch[1].trim();
    } else {
      const match = panel.name.trim().match(/^([a-zA-Z0-9]+)/);
      panelShort = match ? match[1] : panel.name.trim().split(' ')[0];
    }
  }

  const parts: string[] = [];
  if (panelShort) parts.push(panelShort);
  if (circShort) parts.push(circShort);
  if (cleanEl) parts.push(cleanEl);

  return parts.join('_');
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
 * Soporta vías de tendido:
 * - 'ceiling_slab': subida en pared en origen hasta losa de techo, bajada en pared en destino desde losa.
 * - 'floor_slab': bajada en pared en origen hasta contrapiso, subida en pared en destino desde contrapiso.
 * - 'wall': desnivel directo entre bocas montadas en pared.
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
