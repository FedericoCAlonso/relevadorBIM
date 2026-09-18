/**
 * ═══════════════════════════════════════════════════════════════════════════
 * electricalPhysics.ts — Responsabilidad Única:
 * Fórmulas Físicas y Verificaciones Normativas AEA 90364-771
 * (Caídas de Tensión, Factor de Ocupación de Cañería).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ConductorLine, ConduitMaterial } from './ElectricalModel';
import { AEA_CALCULATION_CONSTANTS, getSizesForConduitMaterial } from './electricalStandards';

/** Conductividad del cobre comercial en m / (Ohm * mm²) a 20°C */
export const CONDUCTIVIDAD_COBRE = AEA_CALCULATION_CONSTANTS.COPPER_CONDUCTIVITY_M_OHM_MM2;

/**
 * Calcula la caída de tensión porcentual (Delta V %) en un tramo de circuito según AEA 90364-771.
 * Límite admisible: 3% para circuitos de iluminación, 5% para tomas/fuerza motriz.
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

  // Límite reglamentario AEA: 3% para iluminación, 5% para fuerza motriz/tomas
  const isCompliant = deltaVPercent <= AEA_CALCULATION_CONSTANTS.MAX_VOLTAGE_DROP_LIGHTING_PERCENT;

  return {
    deltaVVolts: Number(deltaVVolts.toFixed(2)),
    deltaVPercent: Number(deltaVPercent.toFixed(2)),
    isCompliant
  };
}

/**
 * Factor de ocupación de cañería (Norma AEA 90364-771.12.3.4):
 * La suma de las áreas exteriores de los conductores (incluida aislación)
 * no debe superar el 35% de la sección interna útil de la cañería.
 */
export function calculateConduitOccupancyFactor(params: {
  conduitDiameterMM: number; // Diámetro comercial
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
