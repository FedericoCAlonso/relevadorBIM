/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: electricalBranch.ts
 * Algoritmos y tipos de grafo eléctrico para ramas interconectadas.
 * Detección de componentes conexas, límites en tableros y actualización atómica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  ElectricalElement,
  Conduit,
  Panel,
  Circuit,
  ConduitMaterial,
  CableStandard,
  ConductorLine,
  ConduitRoutingPlane,
  ProjectMaterialCatalog
} from './ElectricalModel';
import {
  AEA_CONDUCTOR_COLORS,
  AEA_CONDUCTOR_PRESETS,
  getSizesForConduitType,
  getDefaultSizeForConduitType
} from './electricalStandards';

export interface ElectricalBranch {
  /** Bocas que forman parte de la rama (excluyendo los tableros límite) */
  elements: ElectricalElement[];
  /** Tramos de cañería que forman parte de la rama */
  conduits: Conduit[];
  /** Tableros eléctricos conectados en los extremos de la rama */
  boundaryPanels: ElectricalElement[];
  /** IDs de todas las bocas */
  elementIds: string[];
  /** IDs de todas las cañerías */
  conduitIds: string[];
  /** IDs de los tableros límite */
  boundaryPanelIds: string[];
  /** Tablero límite primario si existe alguno conectado */
  primaryBoundaryPanel: ElectricalElement | null;
  /** Circuito predominante detectado en la rama si existe */
  predominantCircuitId: string | null;
  /** Material predominante detectado en las cañerías de la rama */
  predominantMaterial: ConduitMaterial | null;
  /** Diámetro predominante detectado en las cañerías de la rama */
  predominantDiameterMM: number | null;
  /** Sección de conductor predominante en la rama */
  predominantWireSectionMM2: number | null;
}

export interface BranchUpdatePayload {
  /** Nuevo circuito asignado a la rama completa */
  circuitId?: string | null;
  /** Sección troncal de conductores (mm²) a aplicar a las cañerías */
  wireSectionMM2?: number;
  /** Norma / Tipo de cable estándar */
  cableStandard?: CableStandard;
  /** Preset reglamentario AEA de conductores a aplicar a los tramos */
  conductorPresetId?: string;
  /** Lista explícita de conductores a clonar a los tramos */
  conductors?: ConductorLine[];
  /** Tipo / Material de conducto */
  conduitMaterial?: ConduitMaterial;
  /** Calibre / Diámetro comercial en mm */
  conduitDiameterMM?: number;
  /** Vía de tendido del conducto */
  routingPlane?: ConduitRoutingPlane;
  /** Estado de relevamiento de la rama */
  status?: 'existente' | 'proyectado' | 'a_reemplazar';
}

/**
 * Determina si un elemento eléctrico representa físicamente un tablero.
 */
export function isPanelElement(
  element: ElectricalElement,
  panels: readonly Panel[] = []
): boolean {
  if (element.isPanel) return true;
  return panels.some((p) => p.elementId === element.id);
}

/**
 * Encuentra la rama interconectada a partir de una boca o cañería dada.
 *
 * Propiedades del recorrido:
 * 1. Es conexo: agrupa todos los tramos de cañería y bocas interconectadas.
 * 2. Se detiene en tableros: cuando la búsqueda topológica alcanza un tablero,
 *    éste se registra como extremo/límite de la rama y NO se expande hacia otros
 *    circuitos o tramos que parten de ese mismo tablero.
 * 3. Preserva la naturaleza de los tableros en los extremos.
 */
export function findConnectedBranch(params: {
  startEntity: { type: 'electrical_element' | 'conduit'; id: string };
  elements: readonly ElectricalElement[];
  conduits: readonly Conduit[];
  panels?: readonly Panel[];
}): ElectricalBranch | null {
  const { startEntity, elements, conduits, panels = [] } = params;

  const elementsMap = new Map<string, ElectricalElement>(elements.map((e) => [e.id, e]));
  const conduitsMap = new Map<string, Conduit>(conduits.map((c) => [c.id, c]));

  // Índice de adyacencia de elementos a conductos
  const elementToConduits = new Map<string, Conduit[]>();
  for (const c of conduits) {
    const listFrom = elementToConduits.get(c.fromElementId) || [];
    listFrom.push(c);
    elementToConduits.set(c.fromElementId, listFrom);

    const listTo = elementToConduits.get(c.toElementId) || [];
    listTo.push(c);
    elementToConduits.set(c.toElementId, listTo);
  }

  const visitedConduitIds = new Set<string>();
  const visitedElementIds = new Set<string>();
  const branchElements: ElectricalElement[] = [];
  const branchConduits: Conduit[] = [];
  const boundaryPanels: ElectricalElement[] = [];

  const queue: string[] = [];

  if (startEntity.type === 'conduit') {
    const startConduit = conduitsMap.get(startEntity.id);
    if (!startConduit) return null;

    visitedConduitIds.add(startConduit.id);
    branchConduits.push(startConduit);

    visitedElementIds.add(startConduit.fromElementId);
    queue.push(startConduit.fromElementId);

    visitedElementIds.add(startConduit.toElementId);
    queue.push(startConduit.toElementId);
  } else if (startEntity.type === 'electrical_element') {
    const startElement = elementsMap.get(startEntity.id);
    if (!startElement) return null;

    visitedElementIds.add(startElement.id);
    queue.push(startElement.id);
  } else {
    return null;
  }

  // BFS para recorrer toda la red conexa
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentElement = elementsMap.get(currentId);
    if (!currentElement) continue;

    const isPanel = isPanelElement(currentElement, panels);

    if (isPanel) {
      // Si llegamos a un tablero: es un extremo de la rama.
      if (!boundaryPanels.some((p) => p.id === currentElement.id)) {
        boundaryPanels.push(currentElement);
      }
      // CRÍTICO: NO expandir a través del tablero hacia otros circuitos o ramas
      // salvo si fue la entidad de inicio y la rama aún no tiene cañerías.
      if (startEntity.type === 'electrical_element' && startEntity.id === currentElement.id && branchConduits.length === 0) {
        // Si el usuario seleccionó un tablero directamente, expande a sus cañerías conectadas inmediatas
        const connectedConduits = elementToConduits.get(currentId) || [];
        for (const c of connectedConduits) {
          if (!visitedConduitIds.has(c.id)) {
            visitedConduitIds.add(c.id);
            branchConduits.push(c);
            const neighborId = c.fromElementId === currentId ? c.toElementId : c.fromElementId;
            if (!visitedElementIds.has(neighborId)) {
              visitedElementIds.add(neighborId);
              queue.push(neighborId);
            }
          }
        }
      }
      continue;
    }

    // Es una boca común
    if (!branchElements.some((e) => e.id === currentElement.id)) {
      branchElements.push(currentElement);
    }

    // Explorar cañerías conectadas a esta boca
    const connectedConduits = elementToConduits.get(currentId) || [];
    for (const c of connectedConduits) {
      if (!visitedConduitIds.has(c.id)) {
        visitedConduitIds.add(c.id);
        branchConduits.push(c);
      }

      const neighborId = c.fromElementId === currentId ? c.toElementId : c.fromElementId;
      if (!visitedElementIds.has(neighborId)) {
        visitedElementIds.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  // Si la rama no tiene ni bocas ni cañerías (entidad huérfana no encontrada), retornar null
  if (branchElements.length === 0 && branchConduits.length === 0 && boundaryPanels.length === 0) {
    return null;
  }

  // Detección de frecuencias predominantes para presets de UI
  const circuitCount = new Map<string, number>();
  const materialCount = new Map<ConduitMaterial, number>();
  const diameterCount = new Map<number, number>();
  const sectionCount = new Map<number, number>();

  for (const el of branchElements) {
    if (el.circuitId) {
      circuitCount.set(el.circuitId, (circuitCount.get(el.circuitId) || 0) + 1);
    }
  }

  for (const cd of branchConduits) {
    if (cd.circuitId) {
      circuitCount.set(cd.circuitId, (circuitCount.get(cd.circuitId) || 0) + 1);
    }
    if (cd.material) {
      materialCount.set(cd.material, (materialCount.get(cd.material) || 0) + 1);
    }
    if (cd.diameterMM) {
      diameterCount.set(cd.diameterMM, (diameterCount.get(cd.diameterMM) || 0) + 1);
    }
    for (const cond of cd.conductors) {
      if (cond.sectionMM2) {
        sectionCount.set(cond.sectionMM2, (sectionCount.get(cond.sectionMM2) || 0) + 1);
      }
    }
  }

  const getTopKey = <K>(map: Map<K, number>): K | null => {
    let topKey: K | null = null;
    let max = -1;
    for (const [k, v] of map.entries()) {
      if (v > max) {
        max = v;
        topKey = k;
      }
    }
    return topKey;
  };

  const predominantCircuitId = getTopKey(circuitCount);
  const predominantMaterial = getTopKey(materialCount);
  const predominantDiameterMM = getTopKey(diameterCount);
  const predominantWireSectionMM2 = getTopKey(sectionCount);

  return {
    elements: branchElements,
    conduits: branchConduits,
    boundaryPanels,
    elementIds: branchElements.map((e) => e.id),
    conduitIds: branchConduits.map((c) => c.id),
    boundaryPanelIds: boundaryPanels.map((p) => p.id),
    primaryBoundaryPanel: boundaryPanels[0] || null,
    predominantCircuitId,
    predominantMaterial,
    predominantDiameterMM,
    predominantWireSectionMM2
  };
}

/**
 * Aplica una actualización completa a toda la rama del grafo eléctrico.
 *
 * Cumple con las directivas mandatorias:
 * 1. Actualiza todas las bocas de la rama.
 * 2. Actualiza todos los tramos de cañería de la rama.
 * 3. En los extremos donde se conecta a un tablero:
 *    - Actualiza datos pertinentes (ej: estado de relevamiento).
 *    - Si se asigna un circuito, garantiza consistencia con el tablero alimentador.
 *    - NUNCA degrada el tablero: preserva `isPanel: true`, su símbolo, montaje y altura.
 * 4. La actualización queda circunscrita exclusivamente a los elementos de esa rama.
 */
export function applyBranchUpdates(params: {
  branch: ElectricalBranch;
  updates: BranchUpdatePayload;
  allElements: readonly ElectricalElement[];
  allConduits: readonly Conduit[];
  allPanels: readonly Panel[];
  allCircuits: readonly Circuit[];
  materialCatalog?: ProjectMaterialCatalog;
}): {
  updatedElements: ElectricalElement[];
  updatedConduits: Conduit[];
  updatedPanels: Panel[];
  updatedCircuits: Circuit[];
} {
  const {
    branch,
    updates,
    allElements,
    allConduits,
    allPanels,
    allCircuits,
    materialCatalog
  } = params;

  const branchElementIdSet = new Set(branch.elementIds);
  const branchConduitIdSet = new Set(branch.conduitIds);
  const boundaryPanelIdSet = new Set(branch.boundaryPanelIds);

  // 1. Procesar Cañerías
  const updatedConduits = allConduits.map((conduit) => {
    if (!branchConduitIdSet.has(conduit.id)) {
      return conduit;
    }

    const cPatch: Partial<Conduit> = {};

    // Material y Diámetro
    if (updates.conduitMaterial !== undefined) {
      cPatch.material = updates.conduitMaterial;
      const validSizes = getSizesForConduitType(updates.conduitMaterial, materialCatalog);
      const targetDiameter = updates.conduitDiameterMM ?? conduit.diameterMM;
      const isValid = validSizes.some((s) => s.value === targetDiameter);
      cPatch.diameterMM = isValid
        ? targetDiameter
        : getDefaultSizeForConduitType(updates.conduitMaterial, materialCatalog);
    } else if (updates.conduitDiameterMM !== undefined) {
      cPatch.diameterMM = updates.conduitDiameterMM;
    }

    // Vía de tendido
    if (updates.routingPlane !== undefined) {
      cPatch.routingPlane = updates.routingPlane;
    }

    // Norma de cable
    if (updates.cableStandard !== undefined) {
      cPatch.defaultCableStandard = updates.cableStandard;
    }

    // Circuito asignado
    if (updates.circuitId !== undefined) {
      cPatch.circuitId = updates.circuitId;
      cPatch.circuitIds = updates.circuitId ? [updates.circuitId] : [];
    }

    // Conductores
    if (updates.conductorPresetId) {
      const preset = AEA_CONDUCTOR_PRESETS.find((p) => p.id === updates.conductorPresetId);
      if (preset) {
        cPatch.conductors = preset.conductors.map((c) => ({
          ...c,
          cableStandard: updates.cableStandard ?? c.cableStandard ?? conduit.defaultCableStandard,
          circuitId: updates.circuitId !== undefined ? updates.circuitId || undefined : c.circuitId
        }));
      }
    } else if (updates.conductors) {
      cPatch.conductors = updates.conductors.map((c) => ({
        ...c,
        circuitId: updates.circuitId !== undefined ? updates.circuitId || undefined : c.circuitId
      }));
    } else if (updates.wireSectionMM2 !== undefined || updates.cableStandard !== undefined || updates.circuitId !== undefined) {
      // Ajustar conductores existentes o crear conjunto estándar si estaba vacío
      const existing: ConductorLine[] = conduit.conductors.length > 0 ? conduit.conductors : [
        { role: 'fase', sectionMM2: updates.wireSectionMM2 || 2.5, color: AEA_CONDUCTOR_COLORS.fase },
        { role: 'neutro', sectionMM2: updates.wireSectionMM2 || 2.5, color: AEA_CONDUCTOR_COLORS.neutro },
        { role: 'pe', sectionMM2: updates.wireSectionMM2 || 2.5, color: AEA_CONDUCTOR_COLORS.pe }
      ];

      cPatch.conductors = existing.map((c) => ({
        ...c,
        sectionMM2: updates.wireSectionMM2 !== undefined ? updates.wireSectionMM2 : c.sectionMM2,
        cableStandard: updates.cableStandard ?? c.cableStandard ?? conduit.defaultCableStandard,
        circuitId: updates.circuitId !== undefined ? updates.circuitId || undefined : c.circuitId
      }));
    }

    return { ...conduit, ...cPatch };
  });

  // 2. Procesar Bocas y Tableros en el grafo de Elementos Eléctricos
  const updatedElements = allElements.map((element) => {
    // Caso A: Es una boca de la rama
    if (branchElementIdSet.has(element.id)) {
      const elPatch: Partial<ElectricalElement> = {};
      if (updates.circuitId !== undefined) {
        elPatch.circuitId = updates.circuitId;
      }
      if (updates.status !== undefined) {
        elPatch.status = updates.status;
      }
      return { ...element, ...elPatch };
    }

    // Caso B: Es un tablero en el extremo de la rama
    if (boundaryPanelIdSet.has(element.id)) {
      const panelPatch: Partial<ElectricalElement> = {};
      // Se actualiza estado de relevamiento si se especifica
      if (updates.status !== undefined) {
        panelPatch.status = updates.status;
      }
      // GARANTÍA MANDATORIA: El tablero NO pierde su naturaleza.
      // isPanel, symbolId, placement, heightZ quedan intactos.
      return {
        ...element,
        ...panelPatch,
        isPanel: true // Asegurar formalmente que siempre preserva su naturaleza
      };
    }

    // Caso C: Elemento ajeno a esta rama
    return element;
  });

  // 3. Procesar Circuitos y Tableros (Consistencia en extremos de tablero)
  let updatedCircuits = [...allCircuits];
  let updatedPanels = [...allPanels];

  if (updates.circuitId && branch.primaryBoundaryPanel) {
    const boundaryPanelEl = branch.primaryBoundaryPanel;
    const matchedPanel = allPanels.find((p) => p.elementId === boundaryPanelEl.id || p.id === boundaryPanelEl.id);

    if (matchedPanel) {
      // Si el circuito asignado existe, asegurar que su alimentador esté asociado al tablero al que se conecta
      updatedCircuits = allCircuits.map((circ) => {
        if (circ.id === updates.circuitId) {
          return {
            ...circ,
            panelId: matchedPanel.id,
            wireSectionBaseMM2: updates.wireSectionMM2 ?? circ.wireSectionBaseMM2
          };
        }
        return circ;
      });
    }
  }

  return {
    updatedElements,
    updatedConduits,
    updatedPanels,
    updatedCircuits
  };
}
