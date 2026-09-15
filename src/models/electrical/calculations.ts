/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTOR DE CÁLCULO: calculations.ts
 * Verificaciones Técnicas y Fórmulas según Norma AEA 90364-771.
 * Caídas de Tensión, Factor de Ocupación (<=35%) y Cómputo Métrico 3D.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ElectricalElement, ConductorLine } from './ElectricalModel';
import type { Level } from '../architecture/Level';

/** Conductividad del cobre comercial en m / (Ohm * mm²) a 20°C */
export const CONDUCTIVIDAD_COBRE = 56.0;

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
  totalLengthM: number;        // (dx + dy + dzLocal + dzNiveles) * 1.10
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
  const totalLengthM = Number((rawSum * 1.10).toFixed(2));

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
    voltageV = 220,
    isThreePhase = false,
    cosPhi = 0.9
  } = params;

  if (sectionMM2 <= 0 || voltageV <= 0) {
    return { deltaVVolts: 0, deltaVPercent: 0, isCompliant: false };
  }

  const k = isThreePhase ? Math.sqrt(3) : 2.0;
  // Delta V = (k * L * I * cos(phi)) / (gamma * S)
  const deltaVVolts = (k * lengthM * currentA * cosPhi) / (CONDUCTIVIDAD_COBRE * sectionMM2);
  const deltaVPercent = (deltaVVolts / voltageV) * 100;

  // Límite reglamentario AEA: 3% para circuitos terminales de iluminación, 5% tomas
  const isCompliant = deltaVPercent <= 3.0;

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
  conduitDiameterMM: number; // Diámetro exterior comercial (19, 25, 32 mm)
  conductors: ConductorLine[];
}): {
  occupancyPercent: number;
  maxAllowedPercent: number;
  isCompliant: boolean;
} {
  const { conduitDiameterMM, conductors } = params;

  // Diámetro interior aproximado según tipo comercial estándar
  // Tubo rígido/semirrígido RL19 int ~ 15.5mm; RS25 int ~ 20.8mm; RS32 int ~ 27.2mm
  const internalDiameter = conduitDiameterMM * 0.82;
  const conduitArea = (Math.PI * Math.pow(internalDiameter, 2)) / 4;

  // Estimación de diámetro exterior por conductor (cobre + aislación PVC IRAM 247-3)
  // 1.5mm² ~ 3.0mm ext (área 7.1mm²)
  // 2.5mm² ~ 3.6mm ext (área 10.2mm²)
  // 4.0mm² ~ 4.2mm ext (área 13.9mm²)
  // 6.0mm² ~ 4.8mm ext (área 18.1mm²)
  let totalCablesArea = 0;
  for (const c of conductors) {
    const cableExtDiam = 2.0 + Math.sqrt(c.sectionMM2) * 1.0;
    const cableArea = (Math.PI * Math.pow(cableExtDiam, 2)) / 4;
    totalCablesArea += cableArea;
  }

  const occupancyPercent = conduitArea > 0 ? (totalCablesArea / conduitArea) * 100 : 0;
  const maxAllowedPercent = 35.0;

  return {
    occupancyPercent: Number(occupancyPercent.toFixed(1)),
    maxAllowedPercent,
    isCompliant: occupancyPercent <= maxAllowedPercent
  };
}
