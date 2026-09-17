/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useElectricalViewModel.ts
 * Capa de Presentación / Lógica de Negocio según Patrón Estricto MVVM.
 * Conecta los Modelos y Estándares AEA con las Vistas sin código hardcodeado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react';
import { create } from 'zustand';
import { useProjectStore } from './useProjectStore';
import type {
  ElectricalElement,
  Conduit,
  ConduitRoutingMode,
  ConduitMaterial,
  ConductorLine,
  ConductorRole
} from '../models/electrical/ElectricalModel';
import type { WallPlacementSnap } from '../models/architecture/Wall';
import { resolveSpacePolygon, isPointInPolygon } from '../models/architecture/Space';
import {
  CONDUIT_DIAMETERS_CATALOG,
  AEA_HEIGHT_PRESETS,
  AEA_CONDUCTOR_PRESETS,
  AEA_CONDUCTOR_COLORS,
  AEA_CALCULATION_CONSTANTS,
  SUGGESTED_ELEMENT_METADATA_KEYS,
  DEFAULT_CONDUIT_TYPES,
  DEFAULT_CABLE_TYPES,
  DEFAULT_BOX_TYPES,
  getSizesForConduitType,
  getDefaultSizeForConduitType,
  type ConduitSizeOption
} from '../models/electrical/electricalStandards';
import {
  generateNextUniqueLabel,
  calculateConduitOccupancyFactor,
  getConduitLengthBreakdown,
  type ConduitLengthBreakdown
} from '../models/electrical/calculations';

export interface ElectricalSequenceStoreState {
  sequencePrefix: string;
  sequenceCircuitId: string | null;
  sequencePassingCircuitIds: string[];
  autoConnectConduits: boolean;
  sequenceConduitMaterial: ConduitMaterial;
  sequenceConduitDiameterMM: number;
  sequenceRoutingMode: ConduitRoutingMode;
  lastPlacedElementId: string | null;

  setSequencePrefix: (prefix: string) => void;
  setSequenceCircuitId: (circuitId: string | null) => void;
  setSequencePassingCircuitIds: (circuitIds: string[]) => void;
  toggleSequencePassingCircuit: (circuitId: string) => void;
  setAutoConnectConduits: (autoConnect: boolean) => void;
  setSequenceConduitMaterial: (material: ConduitMaterial) => void;
  setSequenceConduitDiameterMM: (diameterMM: number) => void;
  setSequenceRoutingMode: (mode: ConduitRoutingMode) => void;
  setLastPlacedElementId: (elementId: string | null) => void;
  resetSequence: () => void;
}

export const useElectricalSequenceStore = create<ElectricalSequenceStoreState>((set) => ({
  sequencePrefix: 'B',
  sequenceCircuitId: null,
  sequencePassingCircuitIds: [],
  autoConnectConduits: true,
  sequenceConduitMaterial: 'hierro_semipesado_rs',
  sequenceConduitDiameterMM: 19,
  sequenceRoutingMode: 'orthogonal',
  lastPlacedElementId: null,

  setSequencePrefix: (sequencePrefix) => set({ sequencePrefix }),
  setSequenceCircuitId: (sequenceCircuitId) => set({ sequenceCircuitId }),
  setSequencePassingCircuitIds: (sequencePassingCircuitIds) => set({ sequencePassingCircuitIds }),
  toggleSequencePassingCircuit: (circuitId) =>
    set((state) => {
      const exists = state.sequencePassingCircuitIds.includes(circuitId);
      return {
        sequencePassingCircuitIds: exists
          ? state.sequencePassingCircuitIds.filter((id) => id !== circuitId)
          : [...state.sequencePassingCircuitIds, circuitId]
      };
    }),
  setAutoConnectConduits: (autoConnectConduits) => set({ autoConnectConduits }),
  setSequenceConduitMaterial: (sequenceConduitMaterial) => set({ sequenceConduitMaterial }),
  setSequenceConduitDiameterMM: (sequenceConduitDiameterMM) => set({ sequenceConduitDiameterMM }),
  setSequenceRoutingMode: (sequenceRoutingMode) => set({ sequenceRoutingMode }),
  setLastPlacedElementId: (lastPlacedElementId) => set({ lastPlacedElementId }),
  resetSequence: () => set({ lastPlacedElementId: null })
}));

export interface PlaceElectricalElementInput {
  worldX: number;
  worldY: number;
  symbolId: string;
  snapInfo?: WallPlacementSnap;
  rotationDeg?: number;
  overridePrefix?: string;
  overrideCircuitId?: string | null;
}

/**
 * Función desacoplada para inserción y auto-conexión directa en los stores.
 * Permite ejecución tanto en hooks como en tests sin requerir renderHook de React.
 */
export function placeElectricalElementInStore(
  params: PlaceElectricalElementInput,
  projectStore: ReturnType<typeof useProjectStore.getState> = useProjectStore.getState(),
  sequenceStore: ElectricalSequenceStoreState = useElectricalSequenceStore.getState()
): ElectricalElement {
  const {
    worldX,
    worldY,
    symbolId,
    snapInfo,
    rotationDeg = 0,
    overridePrefix,
    overrideCircuitId
  } = params;

  const { project, addElectricalElement, addConduit } = projectStore;
  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  const isCeiling = symbolId.includes('techo') || symbolId.includes('ventilador');
  const isWall =
    Boolean(snapInfo?.wallId) ||
    symbolId.includes('enchufe') ||
    symbolId.includes('toma') ||
    symbolId.includes('interruptor') ||
    symbolId.includes('llave') ||
    symbolId.includes('tablero') ||
    symbolId.includes('tp') ||
    symbolId.includes('ts') ||
    symbolId.includes('medidor') ||
    symbolId.includes('caja-pase') ||
    symbolId.includes('aplique');

  const containingSpace = project.spaces.find((space) => {
    const poly = resolveSpacePolygon(space, verticesMap);
    return poly.length >= 3 && isPointInPolygon({ x: worldX, y: worldY }, poly);
  });

  const ceilingH = containingSpace ? containingSpace.ceilingHeight : 2.70;

  const activePrefix = overridePrefix !== undefined ? overridePrefix : sequenceStore.sequencePrefix;
  const label = generateNextUniqueLabel(activePrefix, project.electricalElements);

  const powerW =
    symbolId.includes('toma') || symbolId.includes('enchufe')
      ? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_TOMA_W
      : symbolId.includes('techo')
      ? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_CENTRO_LUZ_W
      : symbolId.includes('aplique')
      ? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_APLIQUE_W
      : 0;

  const activeCircuitId = overrideCircuitId !== undefined ? overrideCircuitId : sequenceStore.sequenceCircuitId;

  const isPanel =
    symbolId.includes('tablero') ||
    symbolId.includes('tp') ||
    symbolId.includes('ts') ||
    symbolId.includes('medidor');

  const heightZ = isCeiling
    ? ceilingH
    : isPanel
    ? 1.40
    : symbolId.includes('enchufe') || symbolId.includes('toma')
    ? 0.30
    : 1.20;

  const newElementId = `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const elementRotation = snapInfo?.rotationDeg ?? rotationDeg ?? 0;

  const newElement: ElectricalElement = {
    id: newElementId,
    symbolId,
    levelId: project.activeLevelId,
    spaceId: containingSpace?.id || project.spaces[0]?.id || 'espacio-principal',
    placement: isCeiling ? 'ceiling' : isWall ? 'wall' : 'floor',
    x: Number(worldX.toFixed(3)),
    y: Number(worldY.toFixed(3)),
    heightZ,
    wallId: snapInfo?.wallId || null,
    wallOffset: snapInfo?.wallOffset,
    rotation: elementRotation,
    side: snapInfo?.side,
    circuitId: activeCircuitId,
    passingCircuitIds: [...sequenceStore.sequencePassingCircuitIds],
    status: 'proyectado',
    powerW,
    phases: 1,
    isPanel,
    label,
    attributes: []
  };

  addElectricalElement(newElement);

  if (sequenceStore.autoConnectConduits && sequenceStore.lastPlacedElementId) {
    const prevElement = project.electricalElements.find(
      (e) => e.id === sequenceStore.lastPlacedElementId
    );
    if (prevElement) {
      const circ = activeCircuitId
        ? project.circuits.find((c) => c.id === activeCircuitId)
        : null;
      const section = circ?.wireSectionBaseMM2 || 2.5;

      const conductors: ConductorLine[] = [
        { role: 'fase', sectionMM2: section, color: '#991b1b', circuitId: activeCircuitId || undefined },
        { role: 'neutro', sectionMM2: section, color: '#2563eb', circuitId: activeCircuitId || undefined },
        { role: 'pe', sectionMM2: section, color: '#16a34a', circuitId: activeCircuitId || undefined }
      ];

      const isVerticalRiser = prevElement.levelId !== newElement.levelId;
      const circuitIds = activeCircuitId
        ? [activeCircuitId, ...sequenceStore.sequencePassingCircuitIds]
        : [...sequenceStore.sequencePassingCircuitIds];

      const conduitId = `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      addConduit({
        id: conduitId,
        circuitId: activeCircuitId,
        circuitIds,
        fromElementId: prevElement.id,
        toElementId: newElement.id,
        fromLevelId: prevElement.levelId,
        toLevelId: newElement.levelId,
        diameterMM: sequenceStore.sequenceConduitDiameterMM,
        material: sequenceStore.sequenceConduitMaterial,
        isVerticalRiser,
        conductors,
        routingMode: sequenceStore.sequenceRoutingMode
      });
    }
  }

  sequenceStore.setLastPlacedElementId(newElement.id);
  return newElement;
}

export function useElectricalViewModel() {
  const {
    project,
    selectedEntity,
    setSelectedEntity,
    updateElectricalElement,
    deleteElectricalElement,
    updateConduit,
    deleteConduit,
    addConduitType,
    removeConduitType,
    addCableType,
    removeCableType,
    addBoxType,
    removeBoxType
  } = useProjectStore();

  const sequenceStore = useElectricalSequenceStore();

  // Entidades activas según la entidad seleccionada en el almacén
  const selectedElement = useMemo(() => {
    if (selectedEntity?.type !== 'electrical_element') return null;
    return project.electricalElements.find((e) => e.id === selectedEntity.id) || null;
  }, [selectedEntity, project.electricalElements]);

  const selectedConduit = useMemo(() => {
    if (selectedEntity?.type !== 'conduit') return null;
    return project.conduits.find((c) => c.id === selectedEntity.id) || null;
  }, [selectedEntity, project.conduits]);

  const verticesMap = useMemo(() => {
    return new Map(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const levelsMap = useMemo(() => {
    return new Map(project.levels.map((l) => [l.id, l]));
  }, [project.levels]);

  // Elementos de extremo para la cañería activa
  const conduitFromElement = useMemo(() => {
    if (!selectedConduit) return null;
    return project.electricalElements.find((e) => e.id === selectedConduit.fromElementId) || null;
  }, [selectedConduit, project.electricalElements]);

  const conduitToElement = useMemo(() => {
    if (!selectedConduit) return null;
    return project.electricalElements.find((e) => e.id === selectedConduit.toElementId) || null;
  }, [selectedConduit, project.electricalElements]);

  // Desglose métrico ortogonal 3D calculado en el ViewModel
  const conduitBreakdown = useMemo<ConduitLengthBreakdown | null>(() => {
    if (!conduitFromElement || !conduitToElement) return null;
    return getConduitLengthBreakdown({
      fromElement: conduitFromElement,
      toElement: conduitToElement,
      levelsMap,
      isOrthogonalRouting: true
    });
  }, [conduitFromElement, conduitToElement, levelsMap]);

  // Factor de ocupación reglamentario AEA calculado en el ViewModel
  const conduitOccupancy = useMemo(() => {
    if (!selectedConduit) return null;
    return calculateConduitOccupancyFactor({
      conduitDiameterMM: selectedConduit.diameterMM,
      material: selectedConduit.material,
      conductors: selectedConduit.conductors
    });
  }, [selectedConduit]);

  // Medidas normalizadas válidas para el material de conducto seleccionado
  const conduitAvailableSizes = useMemo<readonly ConduitSizeOption[]>(() => {
    if (!selectedConduit) return [];
    return getSizesForConduitType(selectedConduit.material, project.materialCatalog);
  }, [selectedConduit, project.materialCatalog]);

  // Muro al que está adosada la boca activa
  const elementWall = useMemo(() => {
    if (!selectedElement?.wallId) return null;
    return project.walls.find((w) => w.id === selectedElement.wallId) || null;
  }, [selectedElement, project.walls]);

  // ─── ACCIONES / COMANDOS DE BOCAS ELÉCTRICAS ───

  const setElementProperties = useCallback(
    (elementId: string, patch: Partial<ElectricalElement>) => {
      updateElectricalElement(elementId, patch);
    },
    [updateElectricalElement]
  );

  /** Invierte la cara física del muro sobre la cual está montada la boca */
  const invertElementWallSide = useCallback(
    (elementId: string) => {
      const el = project.electricalElements.find((e) => e.id === elementId);
      if (!el || !el.wallId) return;
      const wall = project.walls.find((w) => w.id === el.wallId);
      if (!wall) return;

      const vStart = verticesMap.get(wall.startVertexId);
      const vEnd = verticesMap.get(wall.endVertexId);
      if (!vStart || !vEnd) return;

      const dx = vEnd.x - vStart.x;
      const dy = vEnd.y - vStart.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) return;

      const nx = -dy / len;
      const ny = dx / len;

      const curSide = el.side || 'left';
      const newSide: 'left' | 'right' = curSide === 'left' ? 'right' : 'left';
      const mult = curSide === 'left' ? -1 : 1;
      const newX = el.x + mult * wall.thickness * nx;
      const newY = el.y + mult * wall.thickness * ny;
      const curRot = el.rotation || 0;

      updateElectricalElement(el.id, {
        x: Number(newX.toFixed(3)),
        y: Number(newY.toFixed(3)),
        side: newSide,
        rotation: (curRot + 180) % 360
      });
    },
    [project.electricalElements, project.walls, verticesMap, updateElectricalElement]
  );

  /** Gestión de Metadatos Clave-Valor Arbitrarios (Modelo TRAZA) */
  const addElementAttribute = useCallback(
    (elementId: string, key = '', value = '') => {
      const el = project.electricalElements.find((e) => e.id === elementId);
      if (!el) return;
      const attributes = el.attributes ? [...el.attributes] : [];
      attributes.push({ key, value });
      updateElectricalElement(elementId, { attributes });
    },
    [project.electricalElements, updateElectricalElement]
  );

  const updateElementAttribute = useCallback(
    (elementId: string, index: number, patch: Partial<{ key: string; value: string }>) => {
      const el = project.electricalElements.find((e) => e.id === elementId);
      if (!el || !el.attributes || !el.attributes[index]) return;
      const attributes = [...el.attributes];
      attributes[index] = { ...attributes[index], ...patch };
      updateElectricalElement(elementId, { attributes });
    },
    [project.electricalElements, updateElectricalElement]
  );

  const removeElementAttribute = useCallback(
    (elementId: string, index: number) => {
      const el = project.electricalElements.find((e) => e.id === elementId);
      if (!el || !el.attributes) return;
      const attributes = el.attributes.filter((_, i) => i !== index);
      updateElectricalElement(elementId, { attributes });
    },
    [project.electricalElements, updateElectricalElement]
  );

  const removeElement = useCallback(
    (elementId: string) => {
      deleteElectricalElement(elementId);
      setSelectedEntity(null);
    },
    [deleteElectricalElement, setSelectedEntity]
  );

  /** Activa o desactiva un circuito en tránsito por la caja de la boca (caja de paso/derivación) */
  const toggleElementPassingCircuit = useCallback(
    (elementId: string, circuitId: string) => {
      const el = project.electricalElements.find((e) => e.id === elementId);
      if (!el) return;
      const current = el.passingCircuitIds ? [...el.passingCircuitIds] : [];
      const updated = current.includes(circuitId)
        ? current.filter((id) => id !== circuitId)
        : [...current, circuitId];
      updateElectricalElement(elementId, { passingCircuitIds: updated });
    },
    [project.electricalElements, updateElectricalElement]
  );

  // ─── ACCIONES / COMANDOS DE CAÑERÍAS Y CONDUCTORES ───

  const setConduitProperties = useCallback(
    (conduitId: string, patch: Partial<Conduit>) => {
      const conduit = project.conduits.find((c) => c.id === conduitId);
      if (!conduit) return;

      const finalPatch = { ...patch };

      // Si cambia el tipo de material, verificar si el calibre actual es válido para ese material
      if (patch.material && patch.material !== conduit.material) {
        const validSizes = getSizesForConduitType(patch.material, project.materialCatalog);
        const currentDiameter = patch.diameterMM ?? conduit.diameterMM;
        const isValid = validSizes.some((s) => s.value === currentDiameter);
        if (!isValid) {
          finalPatch.diameterMM = getDefaultSizeForConduitType(patch.material, project.materialCatalog);
        }
      }

      updateConduit(conduitId, finalPatch);
    },
    [project.conduits, project.materialCatalog, updateConduit]
  );

  /** Alterna la asignación de un circuito a la cañería (multi-circuito) */
  const toggleConduitCircuit = useCallback(
    (conduitId: string, circuitId: string) => {
      const conduit = project.conduits.find((c) => c.id === conduitId);
      if (!conduit) return;

      const current = conduit.circuitIds || (conduit.circuitId ? [conduit.circuitId] : []);
      const updated = current.includes(circuitId)
        ? current.filter((id) => id !== circuitId)
        : [...current, circuitId];

      updateConduit(conduitId, {
        circuitIds: updated,
        circuitId: updated[0] || null
      });
    },
    [project.conduits, updateConduit]
  );

  /** Aplica un preset reglamentario de conductores de un solo toque */
  const applyConduitPreset = useCallback(
    (conduitId: string, presetId: string) => {
      const preset = AEA_CONDUCTOR_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      // Clonar profundamente los conductores del preset para evitar mutaciones indeseadas
      const conductors: ConductorLine[] = preset.conductors.map((c) => ({ ...c }));
      updateConduit(conduitId, { conductors });
    },
    [updateConduit]
  );

  /** Agrega un conductor con su color normalizado AEA según su rol */
  const addConductorToConduit = useCallback(
    (conduitId: string, role: ConductorRole, defaultSectionMM2: number) => {
      const conduit = project.conduits.find((c) => c.id === conduitId);
      if (!conduit) return;

      const color = AEA_CONDUCTOR_COLORS[role] || '#92400e';
      const reference = role === 'retorno' ? 'a' : undefined;

      const conductors: ConductorLine[] = [
        ...conduit.conductors,
        {
          role,
          sectionMM2: defaultSectionMM2,
          color,
          reference
        }
      ];
      updateConduit(conduitId, { conductors });
    },
    [project.conduits, updateConduit]
  );

  const updateConduitConductor = useCallback(
    (conduitId: string, index: number, patch: Partial<ConductorLine>) => {
      const conduit = project.conduits.find((c) => c.id === conduitId);
      if (!conduit || !conduit.conductors[index]) return;

      const conductors = [...conduit.conductors];
      const updatedItem = { ...conductors[index], ...patch };

      // Si cambió el rol, actualizar el color normalizado automáticamente salvo que se especifique
      if (patch.role && !patch.color) {
        updatedItem.color = AEA_CONDUCTOR_COLORS[patch.role] || updatedItem.color;
      }

      conductors[index] = updatedItem;
      updateConduit(conduitId, { conductors });
    },
    [project.conduits, updateConduit]
  );

  const removeConductorFromConduit = useCallback(
    (conduitId: string, index: number) => {
      const conduit = project.conduits.find((c) => c.id === conduitId);
      if (!conduit) return;
      const conductors = conduit.conductors.filter((_, i) => i !== index);
      updateConduit(conduitId, { conductors });
    },
    [project.conduits, updateConduit]
  );

  const removeConduit = useCallback(
    (conduitId: string) => {
      deleteConduit(conduitId);
      setSelectedEntity(null);
    },
    [deleteConduit, setSelectedEntity]
  );

  // Próxima etiqueta sugerida única para el prefijo de secuencia activo
  const nextSuggestedLabel = useMemo(() => {
    return generateNextUniqueLabel(sequenceStore.sequencePrefix, project.electricalElements);
  }, [sequenceStore.sequencePrefix, project.electricalElements]);

  /**
   * Emplaza una boca eléctrica con resolución de dominio arquitectónico (espacio, altura,
   * potencia AEA y etiqueta única determinista). Si el auto-enlace está activo y existe una boca previa,
   * traza automáticamente la cañería lógica entre ambas con el circuito y sección asignados.
   */
  const placeElectricalElement = useCallback(
    (params: PlaceElectricalElementInput): ElectricalElement => {
      return placeElectricalElementInStore(params);
    },
    []
  );

  const toggleConduitRoutingMode = useCallback(
    (conduitId: string) => {
      const conduit = project.conduits.find((c) => c.id === conduitId);
      if (!conduit) return;
      const nextMode: ConduitRoutingMode =
        conduit.routingMode === 'orthogonal' ? 'schematic_arc' : 'orthogonal';
      updateConduit(conduitId, { routingMode: nextMode });
    },
    [project.conduits, updateConduit]
  );

  const setConduitWaypoints = useCallback(
    (conduitId: string, waypoints: Array<{ x: number; y: number }>) => {
      updateConduit(conduitId, { waypoints });
    },
    [updateConduit]
  );

  return {
    // Estado del modelo reactivo
    selectedElement,
    selectedConduit,
    elementWall,
    conduitFromElement,
    conduitToElement,
    conduitBreakdown,
    conduitOccupancy,
    conduitAvailableSizes,
    circuits: project.circuits,

    // Secuencia de inserción continua y ruteo
    sequence: {
      prefix: sequenceStore.sequencePrefix,
      circuitId: sequenceStore.sequenceCircuitId,
      passingCircuitIds: sequenceStore.sequencePassingCircuitIds,
      autoConnectConduits: sequenceStore.autoConnectConduits,
      conduitMaterial: sequenceStore.sequenceConduitMaterial,
      conduitDiameterMM: sequenceStore.sequenceConduitDiameterMM,
      routingMode: sequenceStore.sequenceRoutingMode,
      lastPlacedElementId: sequenceStore.lastPlacedElementId,
      nextSuggestedLabel,
      setPrefix: sequenceStore.setSequencePrefix,
      setCircuitId: sequenceStore.setSequenceCircuitId,
      setPassingCircuitIds: sequenceStore.setSequencePassingCircuitIds,
      togglePassingCircuit: sequenceStore.toggleSequencePassingCircuit,
      setAutoConnectConduits: sequenceStore.setAutoConnectConduits,
      setConduitMaterial: sequenceStore.setSequenceConduitMaterial,
      setConduitDiameterMM: sequenceStore.setSequenceConduitDiameterMM,
      setRoutingMode: sequenceStore.setSequenceRoutingMode,
      setLastPlacedElementId: sequenceStore.setLastPlacedElementId,
      resetSequence: sequenceStore.resetSequence
    },

    // Catálogos normativos y abiertos (cero código hardcodeado en la vista)
    catalogs: {
      conduitTypes: project.materialCatalog?.conduitTypes || DEFAULT_CONDUIT_TYPES,
      cableTypes: project.materialCatalog?.cableTypes || DEFAULT_CABLE_TYPES,
      boxTypes: project.materialCatalog?.boxTypes || DEFAULT_BOX_TYPES,
      materials: (project.materialCatalog?.conduitTypes || DEFAULT_CONDUIT_TYPES).map((c) => ({
        id: c.id,
        label: c.name,
        description: c.description || '',
        standardReference: c.name,
        allowedInSlab: true
      })),
      diameters: CONDUIT_DIAMETERS_CATALOG,
      cableStandards: (project.materialCatalog?.cableTypes || DEFAULT_CABLE_TYPES).map((c) => ({
        id: c.id,
        label: c.name,
        description: c.description || ''
      })),
      heightPresets: AEA_HEIGHT_PRESETS,
      conductorPresets: AEA_CONDUCTOR_PRESETS,
      suggestedMetadataKeys: SUGGESTED_ELEMENT_METADATA_KEYS
    },

    // Gestión del Catálogo de Materiales
    addConduitType,
    removeConduitType,
    addCableType,
    removeCableType,
    addBoxType,
    removeBoxType,

    // Comandos de Bocas
    placeElectricalElement,
    setElementProperties,
    invertElementWallSide,
    addElementAttribute,
    updateElementAttribute,
    removeElementAttribute,
    removeElement,
    toggleElementPassingCircuit,

    // Comandos de Cañerías
    setConduitProperties,
    applyConduitPreset,
    addConductorToConduit,
    updateConduitConductor,
    removeConductorFromConduit,
    removeConduit,
    toggleConduitCircuit,
    toggleConduitRoutingMode,
    setConduitWaypoints
  };
}
