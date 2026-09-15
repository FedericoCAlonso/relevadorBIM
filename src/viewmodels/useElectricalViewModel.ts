/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useElectricalViewModel.ts
 * Capa de Presentación / Lógica de Negocio según Patrón Estricto MVVM.
 * Conecta los Modelos y Estándares AEA con las Vistas sin código hardcodeado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react';
import { useProjectStore } from './useProjectStore';
import type {
  ElectricalElement,
  Conduit,
  ConductorLine,
  ConductorRole
} from '../models/electrical/ElectricalModel';
import {
  CONDUIT_MATERIALS_CATALOG,
  CONDUIT_DIAMETERS_CATALOG,
  CABLE_STANDARDS_CATALOG,
  AEA_HEIGHT_PRESETS,
  AEA_CONDUCTOR_PRESETS,
  AEA_CONDUCTOR_COLORS,
  SUGGESTED_ELEMENT_METADATA_KEYS
} from '../models/electrical/electricalStandards';
import {
  calculateConduitOccupancyFactor,
  getConduitLengthBreakdown,
  type ConduitLengthBreakdown
} from '../models/electrical/calculations';

export function useElectricalViewModel() {
  const {
    project,
    selectedEntity,
    setSelectedEntity,
    updateElectricalElement,
    deleteElectricalElement,
    updateConduit,
    deleteConduit
  } = useProjectStore();

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
      conductors: selectedConduit.conductors
    });
  }, [selectedConduit]);

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

  // ─── ACCIONES / COMANDOS DE CAÑERÍAS Y CONDUCTORES ───

  const setConduitProperties = useCallback(
    (conduitId: string, patch: Partial<Conduit>) => {
      updateConduit(conduitId, patch);
    },
    [updateConduit]
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

  return {
    // Estado del modelo reactivo
    selectedElement,
    selectedConduit,
    elementWall,
    conduitFromElement,
    conduitToElement,
    conduitBreakdown,
    conduitOccupancy,
    circuits: project.circuits,

    // Catálogos normativos (cero código hardcodeado en la vista)
    catalogs: {
      materials: CONDUIT_MATERIALS_CATALOG,
      diameters: CONDUIT_DIAMETERS_CATALOG,
      cableStandards: CABLE_STANDARDS_CATALOG,
      heightPresets: AEA_HEIGHT_PRESETS,
      conductorPresets: AEA_CONDUCTOR_PRESETS,
      suggestedMetadataKeys: SUGGESTED_ELEMENT_METADATA_KEYS
    },

    // Comandos de Bocas
    setElementProperties,
    invertElementWallSide,
    addElementAttribute,
    updateElementAttribute,
    removeElementAttribute,
    removeElement,

    // Comandos de Cañerías
    setConduitProperties,
    applyConduitPreset,
    addConductorToConduit,
    updateConduitConductor,
    removeConductorFromConduit,
    removeConduit
  };
}
