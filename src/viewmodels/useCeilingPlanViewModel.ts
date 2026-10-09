/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useCeilingPlanViewModel.ts
 * Orquestación Reactiva y Comandos para el Plano de Cielorraso Reflejado (RCP).
 * Conecta el estado del proyecto con el viewport del cielorraso y cotas de replanteo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react';
import { create } from 'zustand';
import { useProjectStore } from './useProjectStore';
import {
  buildCeilingPlanData,
  type CeilingMaterialType,
  type CeilingPlanData
} from '../models/architecture/ceilingPlan';
import {
  resolveSpacePolygon,
  calculatePolygonCentroid
} from '../models/architecture/Space';
import type { ElectricalElement } from '../models/electrical/ElectricalModel';

export interface CeilingPlanStoreState {
  activeSpaceId: string | null;
  selectedBoxId: string | null;
  showDimensions: boolean;
  showWallDrops: boolean;
  showModularGrid: boolean;
  zoom: number;
  panOffset: { x: number; y: number };

  openCeilingPlan: (spaceId: string) => void;
  closeCeilingPlan: () => void;
  setSelectedBoxId: (id: string | null) => void;
  toggleDimensions: () => void;
  toggleWallDrops: () => void;
  toggleModularGrid: () => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetViewport: () => void;
}

export const useCeilingPlanStore = create<CeilingPlanStoreState>((set) => ({
  activeSpaceId: null,
  selectedBoxId: null,
  showDimensions: true,
  showWallDrops: true,
  showModularGrid: true,
  zoom: 1,
  panOffset: { x: 0, y: 0 },

  openCeilingPlan: (spaceId: string) =>
    set({
      activeSpaceId: spaceId,
      selectedBoxId: null,
      zoom: 1,
      panOffset: { x: 0, y: 0 }
    }),

  closeCeilingPlan: () =>
    set({
      activeSpaceId: null,
      selectedBoxId: null
    }),

  setSelectedBoxId: (id: string | null) => set({ selectedBoxId: id }),

  toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),

  toggleWallDrops: () => set((state) => ({ showWallDrops: !state.showWallDrops })),

  toggleModularGrid: () => set((state) => ({ showModularGrid: !state.showModularGrid })),

  setZoom: (zoom: number) => set({ zoom: Math.max(0.4, Math.min(zoom, 4)) }),

  setPan: (pan: { x: number; y: number }) => set({ panOffset: pan }),

  resetViewport: () => set({ zoom: 1, panOffset: { x: 0, y: 0 } })
}));

/**
 * Actualiza la materialidad constructiva del cielorraso en el store del proyecto.
 */
export function setCeilingMaterialInStore(spaceId: string, material: CeilingMaterialType): void {
  useProjectStore.getState().updateSpace(spaceId, { ceilingMaterial: material });
}

/**
 * Añade una nueva boca cenital en las coordenadas del cielorraso del ambiente.
 */
export function addCeilingBoxInStore(
  spaceId: string,
  pos: { x: number; y: number },
  symbolId: string = 'sym-planta-boca-techo'
): string {
  const store = useProjectStore.getState();
  const space = store.project.spaces.find((s) => s.id === spaceId);
  const levelId = space?.levelId || store.project.activeLevelId;

  const newElement: ElectricalElement = {
    id: `el-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    symbolId,
    levelId,
    spaceId,
    placement: 'ceiling',
    heightZ: space?.ceilingHeight || 2.70,
    x: Number(pos.x.toFixed(3)),
    y: Number(pos.y.toFixed(3)),
    rotation: 0
  };

  store.addElectricalElement(newElement);
  return newElement.id;
}

/**
 * Centra automáticamente una boca en el centroide geométrico del ambiente.
 */
export function centerCeilingBoxInStore(
  spaceId: string,
  symbolId: string = 'sym-planta-boca-techo'
): string | null {
  const store = useProjectStore.getState();
  const space = store.project.spaces.find((s) => s.id === spaceId);
  if (!space) return null;

  const verticesMap = new Map(store.project.vertices.map((v) => [v.id, v]));
  const poly = resolveSpacePolygon(space, verticesMap);
  if (poly.length < 3) return null;

  const centroid = calculatePolygonCentroid(poly);
  return addCeilingBoxInStore(spaceId, centroid, symbolId);
}

/**
 * Elimina una boca cenital del proyecto.
 */
export function deleteCeilingBoxInStore(elementId: string): void {
  useProjectStore.getState().deleteElectricalElement(elementId);
}

/**
 * Mueve una boca cenital a una nueva posición en el cielorraso.
 */
export function moveCeilingBoxInStore(elementId: string, newPos: { x: number; y: number }): void {
  useProjectStore.getState().updateElectricalElement(elementId, {
    x: Number(newPos.x.toFixed(3)),
    y: Number(newPos.y.toFixed(3))
  });
}

/**
 * Hook ViewModel para interactuar con la vista de Cielorraso Reflejado (RCP).
 */
export function useCeilingPlanViewModel() {
  const activeSpaceId = useCeilingPlanStore((s) => s.activeSpaceId);
  const selectedBoxId = useCeilingPlanStore((s) => s.selectedBoxId);
  const showDimensions = useCeilingPlanStore((s) => s.showDimensions);
  const showWallDrops = useCeilingPlanStore((s) => s.showWallDrops);
  const showModularGrid = useCeilingPlanStore((s) => s.showModularGrid);
  const zoom = useCeilingPlanStore((s) => s.zoom);
  const panOffset = useCeilingPlanStore((s) => s.panOffset);

  const openCeilingPlan = useCeilingPlanStore((s) => s.openCeilingPlan);
  const closeCeilingPlan = useCeilingPlanStore((s) => s.closeCeilingPlan);
  const setSelectedBoxId = useCeilingPlanStore((s) => s.setSelectedBoxId);
  const toggleDimensions = useCeilingPlanStore((s) => s.toggleDimensions);
  const toggleWallDrops = useCeilingPlanStore((s) => s.toggleWallDrops);
  const toggleModularGrid = useCeilingPlanStore((s) => s.toggleModularGrid);
  const setZoom = useCeilingPlanStore((s) => s.setZoom);
  const setPan = useCeilingPlanStore((s) => s.setPan);
  const resetViewport = useCeilingPlanStore((s) => s.resetViewport);

  const project = useProjectStore((s) => s.project);

  const space = useMemo(() => {
    return activeSpaceId ? project.spaces.find((s) => s.id === activeSpaceId) || null : null;
  }, [project.spaces, activeSpaceId]);

  const verticesMap = useMemo(() => {
    return new Map(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const wallsMap = useMemo(() => {
    return new Map(project.walls.map((w) => [w.id, w]));
  }, [project.walls]);

  const ceilingPlanData: CeilingPlanData | null = useMemo(() => {
    if (!space) return null;
    return buildCeilingPlanData({
      space,
      verticesMap,
      wallsMap,
      elements: project.electricalElements,
      material: space.ceilingMaterial
    });
  }, [space, verticesMap, wallsMap, project.electricalElements]);

  const selectedBox = useMemo(() => {
    if (!ceilingPlanData || !selectedBoxId) return null;
    return ceilingPlanData.ceilingBoxes.find((b) => b.element.id === selectedBoxId) || null;
  }, [ceilingPlanData, selectedBoxId]);

  const setMaterial = useCallback(
    (material: CeilingMaterialType) => {
      if (activeSpaceId) {
        setCeilingMaterialInStore(activeSpaceId, material);
      }
    },
    [activeSpaceId]
  );

  const addBoxAt = useCallback(
    (pos: { x: number; y: number }, symbolId?: string) => {
      if (activeSpaceId) {
        const id = addCeilingBoxInStore(activeSpaceId, pos, symbolId);
        setSelectedBoxId(id);
      }
    },
    [activeSpaceId, setSelectedBoxId]
  );

  const centerBox = useCallback(
    (symbolId?: string) => {
      if (activeSpaceId) {
        const id = centerCeilingBoxInStore(activeSpaceId, symbolId);
        if (id) setSelectedBoxId(id);
      }
    },
    [activeSpaceId, setSelectedBoxId]
  );

  const deleteBox = useCallback(
    (elementId: string) => {
      deleteCeilingBoxInStore(elementId);
      if (selectedBoxId === elementId) {
        setSelectedBoxId(null);
      }
    },
    [selectedBoxId, setSelectedBoxId]
  );

  const moveBox = useCallback((elementId: string, newPos: { x: number; y: number }) => {
    moveCeilingBoxInStore(elementId, newPos);
  }, []);

  return {
    isOpen: activeSpaceId !== null,
    space,
    ceilingPlanData,
    selectedBoxId,
    selectedBox,
    showDimensions,
    showWallDrops,
    showModularGrid,
    zoom,
    panOffset,

    // Comandos de Vista
    openCeilingPlan,
    closeCeilingPlan,
    setSelectedBoxId,
    toggleDimensions,
    toggleWallDrops,
    toggleModularGrid,
    setZoom,
    setPan,
    resetViewport,

    // Comandos de Dominio
    setMaterial,
    addBoxAt,
    centerBox,
    deleteBox,
    moveBox
  };
}
