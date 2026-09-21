/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: electricalConductorDerivation.ts
 * Lógica pura para la deducción automática de conductores en canalizaciones.
 *
 * Reglas implementadas:
 * 1. Definición de línea troncal según Circuitos asignados (fases, neutro, PE).
 * 2. Regla de PE único compartido (AEA 771.18.2.3): Si un caño lleva más de un
 *    circuito, la tierra se unifica en un solo conductor de protección cuya
 *    sección es el máximo de las secciones de PE requeridas por los circuitos.
 * 3. Bocas de mando / llaves:
 *    - Llave 1 punto: 1 Fase + 1 Retorno + 1 PE (misma sección de la fase).
 *    - Llave 2 puntos: 1 Fase + 2 Retornos ('a', 'b') + 1 PE.
 *    - Llave 3 puntos: 1 Fase + 3 Retornos ('a', 'b', 'c') + 1 PE.
 *    - Llave 4 puntos: 1 Fase + 4 Retornos ('a', 'b', 'c', 'd') + 1 PE.
 *    - Llave combinación: 1 Fase + 2 Retornos (puentes viajeros) + 1 PE.
 *    - Unión entre 2 llaves de combinación: 2 Retornos (puentes) + 1 PE.
 * 4. Preservación de conductores adicionales o de paso (retornos pasantes).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  Conduit,
  Circuit,
  ElectricalElement,
  Panel,
  ConductorLine
} from './ElectricalModel';
import { AEA_CONDUCTOR_COLORS } from './electricalStandards';

export interface SwitchTypeInfo {
  isSwitch: boolean;
  switchPoints: number;
  isCombination: boolean;
}

/**
 * Inspecciona el identificador del símbolo o elemento para determinar si corresponde
 * a una boca de comando / interruptor y su cantidad de efectos o combinación.
 */
export function getSwitchTypeInfo(symbolId?: string | null): SwitchTypeInfo {
  if (!symbolId) {
    return { isSwitch: false, switchPoints: 0, isCombination: false };
  }

  const s = symbolId.toLowerCase();

  if (s.includes('llave-comb') || s.includes('combinacion')) {
    return { isSwitch: true, switchPoints: 2, isCombination: true };
  }
  if (s.includes('llave-4') || s.includes('interruptor-4')) {
    return { isSwitch: true, switchPoints: 4, isCombination: false };
  }
  if (s.includes('llave-3') || s.includes('interruptor-3')) {
    return { isSwitch: true, switchPoints: 3, isCombination: false };
  }
  if (s.includes('llave-2') || s.includes('interruptor-2')) {
    return { isSwitch: true, switchPoints: 2, isCombination: false };
  }
  if (s.includes('llave-1') || s.includes('interruptor-1') || s.includes('llave') || s.includes('interruptor')) {
    return { isSwitch: true, switchPoints: 1, isCombination: false };
  }

  return { isSwitch: false, switchPoints: 0, isCombination: false };
}

/**
 * Obtiene el color reglamentario de fase para un circuito según su configuración de fase.
 */
export function resolvePhaseColor(circuit?: Circuit | null): string {
  if (!circuit) return AEA_CONDUCTOR_COLORS.fase;
  if (circuit.phaseColor === 'negro') return AEA_CONDUCTOR_COLORS.fase_s;
  if (circuit.phaseColor === 'rojo') return AEA_CONDUCTOR_COLORS.fase_t;
  if (circuit.phaseColor === 'marron') return AEA_CONDUCTOR_COLORS.fase_r;
  return AEA_CONDUCTOR_COLORS.fase;
}

/**
 * Determina si un conductor pertenece a un circuito específico, contemplando
 * PE compartido, asignaciones directas y herencia desde la canalización.
 */
export function conductorBelongsToCircuit(
  conductor: ConductorLine,
  targetCircuitId: string,
  conduitCircuitIds?: readonly string[]
): boolean {
  if (conductor.circuitId === targetCircuitId) return true;
  if (conductor.circuitIds && conductor.circuitIds.includes(targetCircuitId)) return true;
  // Si tiene asignación explícita a otro circuito, no pertenece
  if (conductor.circuitId && conductor.circuitId !== targetCircuitId) return false;
  if (conductor.circuitIds && !conductor.circuitIds.includes(targetCircuitId)) return false;
  // Si no tiene asignación explícita a nivel conductor, hereda los circuitos de la canalización
  if (conduitCircuitIds && conduitCircuitIds.includes(targetCircuitId)) {
    return true;
  }
  return false;
}

// ─── DERIVACIÓN PRINCIPAL DE CONDUCTORES ───

export interface DeriveConduitConductorsParams {
  conduit: Conduit;
  circuits: readonly Circuit[];
  fromElement?: ElectricalElement | Panel | null;
  toElement?: ElectricalElement | Panel | null;
  extraConductors?: readonly ConductorLine[];
}

const RETURN_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

/**
 * Deriva de forma pura y determinística la lista de conductores que deben ocupar
 * una canalización física, respetando la topología de conexión y las normas AEA.
 */
export function deriveConduitConductors(params: DeriveConduitConductorsParams): ConductorLine[] {
  const { conduit, circuits, fromElement, toElement, extraConductors = [] } = params;

  // 1. Identificar si los extremos son llaves de comando
  const fromSymbolId = fromElement && 'symbolId' in fromElement ? fromElement.symbolId : undefined;
  const toSymbolId = toElement && 'symbolId' in toElement ? toElement.symbolId : undefined;

  const fromSwitch = getSwitchTypeInfo(fromSymbolId);
  const toSwitch = getSwitchTypeInfo(toSymbolId);

  // Determinar los IDs de circuitos asociados al tramo
  const assignedCircuitIds = new Set<string>();
  if (conduit.circuitIds !== undefined) {
    for (const cid of conduit.circuitIds) {
      if (cid) assignedCircuitIds.add(cid);
    }
  } else if (conduit.circuitId) {
    assignedCircuitIds.add(conduit.circuitId);
  }

  // Si el tramo no tiene configuración explícita (circuitIds es undefined y no hay circuitId),
  // intentar heredarlo de las bocas conectadas
  if (conduit.circuitIds === undefined && !conduit.circuitId) {
    if (fromElement && 'circuitId' in fromElement && fromElement.circuitId) {
      assignedCircuitIds.add(fromElement.circuitId);
    } else if (toElement && 'circuitId' in toElement && toElement.circuitId) {
      assignedCircuitIds.add(toElement.circuitId);
    }
  }

  // Si el tramo no tiene ningún circuito asignado (o el usuario deseleccionó todos los circuitos):
  if (assignedCircuitIds.size === 0) {
    return appendExtraConductors([], conduit, extraConductors);
  }

  const circuitIdList = Array.from(assignedCircuitIds);
  const resolvedCircuits = circuitIdList
    .map((id) => circuits.find((c) => c.id === id))
    .filter((c): c is Circuit => c !== undefined);

  // Sección base de la fase principal para el tramo
  const primaryCircuit = resolvedCircuits[0];
  const basePhaseSection = primaryCircuit?.wireSectionBaseMM2 || 1.5;
  const peSection = primaryCircuit?.wireSectionPeMM2 || primaryCircuit?.wireSectionBaseMM2 || basePhaseSection;
  const primaryCircuitId = primaryCircuit?.id || conduit.circuitId || undefined;

  // CASO A: Tramo que conecta dos llaves de combinación entre sí
  if (fromSwitch.isCombination && toSwitch.isCombination) {
    const conductors: ConductorLine[] = [
      {
        role: 'retorno',
        sectionMM2: basePhaseSection,
        color: AEA_CONDUCTOR_COLORS.retorno,
        reference: 'puente 1',
        circuitId: primaryCircuitId
      },
      {
        role: 'retorno',
        sectionMM2: basePhaseSection,
        color: AEA_CONDUCTOR_COLORS.retorno,
        reference: 'puente 2',
        circuitId: primaryCircuitId
      },
      {
        role: 'pe',
        sectionMM2: peSection,
        color: AEA_CONDUCTOR_COLORS.pe,
        circuitId: primaryCircuitId
      }
    ];
    return appendExtraConductors(conductors, conduit, extraConductors);
  }

  // CASO B: Tramo hacia una llave de comando (desde un centro, caja de paso o tablero)
  if (fromSwitch.isSwitch || toSwitch.isSwitch) {
    const swInfo = fromSwitch.isSwitch ? fromSwitch : toSwitch;
    const swElement = fromSwitch.isSwitch ? fromElement : toElement;
    const swReturnRef = swElement && 'returnRef' in swElement ? swElement.returnRef : undefined;

    const conductors: ConductorLine[] = [];

    // 1. Conductor de Fase (alimentación al interruptor con color configurado)
    conductors.push({
      role: 'fase',
      sectionMM2: basePhaseSection,
      color: resolvePhaseColor(primaryCircuit),
      circuitId: primaryCircuitId
    });

    // 2. Retornos de efecto
    if (swInfo.isCombination) {
      conductors.push(
        {
          role: 'retorno',
          sectionMM2: basePhaseSection,
          color: AEA_CONDUCTOR_COLORS.retorno,
          reference: swReturnRef ? `${swReturnRef}1` : 'puente 1',
          circuitId: primaryCircuitId
        },
        {
          role: 'retorno',
          sectionMM2: basePhaseSection,
          color: AEA_CONDUCTOR_COLORS.retorno,
          reference: swReturnRef ? `${swReturnRef}2` : 'puente 2',
          circuitId: primaryCircuitId
        }
      );
    } else {
      const numPoints = Math.max(1, swInfo.switchPoints);
      for (let i = 0; i < numPoints; i++) {
        const refLetter = i === 0 && swReturnRef ? swReturnRef : RETURN_LETTERS[i] || `r${i + 1}`;
        conductors.push({
          role: 'retorno',
          sectionMM2: basePhaseSection,
          color: AEA_CONDUCTOR_COLORS.retorno,
          reference: refLetter,
          circuitId: primaryCircuitId
        });
      }
    }

    // 3. Conductor de protección PE (obligatorio, sección configurada)
    conductors.push({
      role: 'pe',
      sectionMM2: peSection,
      color: AEA_CONDUCTOR_COLORS.pe,
      circuitId: primaryCircuitId
    });

    return appendExtraConductors(conductors, conduit, extraConductors);
  }

  // CASO C: Tramo de línea troncal / distribución (entre centros, tomas, cajas de paso o tableros)
  const conductors: ConductorLine[] = [];
  let maxPeSection = 0;

  // Si no hay circuitos registrados en la base de datos, usar valores predeterminados (2x2.5 + PE)
  if (resolvedCircuits.length === 0) {
    conductors.push(
      {
        role: 'fase',
        sectionMM2: 2.5,
        color: AEA_CONDUCTOR_COLORS.fase,
        circuitId: primaryCircuitId
      },
      {
        role: 'neutro',
        sectionMM2: 2.5,
        color: AEA_CONDUCTOR_COLORS.neutro,
        circuitId: primaryCircuitId
      },
      {
        role: 'pe',
        sectionMM2: 2.5,
        color: AEA_CONDUCTOR_COLORS.pe,
        circuitId: primaryCircuitId
      }
    );
    return appendExtraConductors(conductors, conduit, extraConductors);
  }

  // 1. Agregar conductores activos (Fase y Neutro) por cada circuito
  for (const c of resolvedCircuits) {
    const phaseSec = c.wireSectionBaseMM2 || 2.5;
    const peSec = c.wireSectionPeMM2 || c.wireSectionBaseMM2 || 2.5;
    if (peSec > maxPeSection) {
      maxPeSection = peSec;
    }

    const isThreePhase = c.phases === 3 || c.voltageV === 380;
    if (isThreePhase) {
      conductors.push(
        {
          role: 'fase_r',
          sectionMM2: phaseSec,
          color: AEA_CONDUCTOR_COLORS.fase_r,
          circuitId: c.id
        },
        {
          role: 'fase_s',
          sectionMM2: phaseSec,
          color: AEA_CONDUCTOR_COLORS.fase_s,
          circuitId: c.id
        },
        {
          role: 'fase_t',
          sectionMM2: phaseSec,
          color: AEA_CONDUCTOR_COLORS.fase_t,
          circuitId: c.id
        },
        {
          role: 'neutro',
          sectionMM2: phaseSec,
          color: AEA_CONDUCTOR_COLORS.neutro,
          circuitId: c.id
        }
      );
    } else {
      conductors.push(
        {
          role: 'fase',
          sectionMM2: phaseSec,
          color: resolvePhaseColor(c),
          circuitId: c.id
        },
        {
          role: 'neutro',
          sectionMM2: phaseSec,
          color: AEA_CONDUCTOR_COLORS.neutro,
          circuitId: c.id
        }
      );
    }
  }

  // 2. Regla del PE Compartido: exactamente UN solo conductor PE para todos los circuitos del caño
  if (conductors.length > 0 && maxPeSection > 0) {
    conductors.push({
      role: 'pe',
      sectionMM2: maxPeSection,
      color: AEA_CONDUCTOR_COLORS.pe,
      circuitId: resolvedCircuits.length === 1 ? resolvedCircuits[0].id : undefined,
      circuitIds: resolvedCircuits.length > 1 ? resolvedCircuits.map((c) => c.id) : undefined
    });
  }

  return appendExtraConductors(conductors, conduit, extraConductors);
}

/**
 * Concatena conductores adicionales existentes o pasantes (retornos, señales, comandos)
 * evitando duplicar fases, neutros o tierras base.
 */
function appendExtraConductors(
  baseConductors: ConductorLine[],
  conduit: Conduit,
  extraConductors: readonly ConductorLine[]
): ConductorLine[] {
  const result = [...baseConductors];

  // Evaluar conductores adicionales proporcionados explícitamente
  for (const extra of extraConductors) {
    if (extra.role === 'retorno' || extra.role === 'comando') {
      result.push({ ...extra });
    }
  }

  // Evaluar si el conducto ya tenía conductores con rol 'retorno' o 'comando'
  // que no fueron auto-generados y deben ser preservados como retornos pasantes
  if (conduit.conductors && conduit.conductors.length > 0) {
    for (const existing of conduit.conductors) {
      if (existing.role === 'retorno' || existing.role === 'comando') {
        const alreadyIncluded = result.some(
          (c) =>
            c.role === existing.role &&
            c.reference === existing.reference &&
            c.sectionMM2 === existing.sectionMM2
        );
        if (!alreadyIncluded) {
          result.push({ ...existing });
        }
      }
    }
  }

  return result;
}
