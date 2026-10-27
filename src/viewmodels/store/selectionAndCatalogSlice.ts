/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL STORE SLICE: selectionAndCatalogSlice.ts
 * Responsabilidad Única (SRP):
 * Selección individual y múltiple de entidades, filtrado por criterios,
 * navegación de nivel/anclaje, preferencias de visualización CAD, gestión
 * del catálogo abierto de materiales y láminas de fondo (Underlay Sheets).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createDefaultMaterialCatalog } from '../../models/electrical/electricalStandards';
import type {
  SelectedEntity,
  SelectionAndCatalogSlice,
  StoreGet,
  StoreSet
} from './storeTypes';

export function createSelectionAndCatalogSlice(
  set: StoreSet,
  get: StoreGet
): SelectionAndCatalogSlice {
  return {
    selectedEntity: null,
    selectedEntities: [],
    isMultiSelectMode: false,
    activeAnchorVertexId: null,
    showDimensions: true,
    labelDisplayMode: 'full',

    setShowDimensions: (show) => set({ showDimensions: show }),
    toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
    setLabelDisplayMode: (labelDisplayMode) => set({ labelDisplayMode }),
    setMultiSelectMode: (active) => set({ isMultiSelectMode: active }),
    toggleMultiSelectMode: () => set((state) => ({ isMultiSelectMode: !state.isMultiSelectMode })),

    setSelectedEntity: (entity) =>
      set({
        selectedEntity: entity,
        selectedEntities: entity ? [entity] : []
      }),

    setSelectedEntities: (entities) =>
      set({
        selectedEntities: entities,
        selectedEntity: entities[0] || null
      }),

    toggleSelectEntity: (entity, multiSelect = false) =>
      set((state) => {
        if (!multiSelect) {
          const isSame =
            state.selectedEntity?.type === entity.type &&
            state.selectedEntity?.id === entity.id &&
            state.selectedEntities.length === 1;
          return {
            selectedEntity: isSame ? null : entity,
            selectedEntities: isSame ? [] : [entity]
          };
        }

        const exists = state.selectedEntities.some(
          (e) => e.type === entity.type && e.id === entity.id
        );
        const nextList = exists
          ? state.selectedEntities.filter((e) => !(e.type === entity.type && e.id === entity.id))
          : [...state.selectedEntities, entity];

        return {
          selectedEntities: nextList,
          selectedEntity: nextList[0] || null
        };
      }),

    clearSelection: () =>
      set({
        selectedEntity: null,
        selectedEntities: []
      }),

    selectByCriteria: (criteria) => {
      const { project } = get();
      const targetLevel = criteria.levelId;
      const entities: SelectedEntity[] = [];

      const matchesConduits =
        criteria.entityType !== 'electrical_element' && !criteria.elementSymbolId;

      const matchesElements =
        criteria.entityType !== 'conduit' &&
        !criteria.conduitMaterial &&
        !criteria.conduitDiameterMM;

      if (matchesConduits) {
        for (const c of project.conduits) {
          if (targetLevel && c.fromLevelId !== targetLevel && c.toLevelId !== targetLevel) continue;
          if (criteria.circuitId) {
            const hasCirc =
              c.circuitId === criteria.circuitId ||
              (c.circuitIds && c.circuitIds.includes(criteria.circuitId));
            if (!hasCirc) continue;
          }
          if (criteria.conduitMaterial && c.material !== criteria.conduitMaterial) continue;
          if (criteria.conduitDiameterMM && c.diameterMM !== criteria.conduitDiameterMM) continue;
          if (criteria.status && c.status !== criteria.status) continue;
          entities.push({ type: 'conduit', id: c.id });
        }
      }

      if (matchesElements) {
        for (const el of project.electricalElements) {
          if (targetLevel && el.levelId !== targetLevel) continue;
          if (criteria.circuitId) {
            const hasCirc =
              el.circuitId === criteria.circuitId ||
              (el.passingCircuitIds && el.passingCircuitIds.includes(criteria.circuitId));
            if (!hasCirc) continue;
          }
          if (criteria.elementSymbolId && el.symbolId !== criteria.elementSymbolId) continue;
          if (criteria.status && el.status !== criteria.status) continue;
          entities.push({ type: 'electrical_element', id: el.id });
        }
      }

      set({
        selectedEntity: entities[0] || null,
        selectedEntities: entities
      });
    },

    setActiveAnchorVertexId: (vertexId) => set({ activeAnchorVertexId: vertexId }),

    setActiveLevel: (levelId) =>
      set((state) => ({
        project: { ...state.project, activeLevelId: levelId },
        selectedEntity: null,
        activeAnchorVertexId: null
      })),

    addConduitType: (def) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              conduitTypes: [...current.conduitTypes.filter((c) => c.id !== def.id), def]
            }
          }
        };
      }),

    removeConduitType: (id) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              conduitTypes: current.conduitTypes.filter((c) => c.id !== id)
            }
          }
        };
      }),

    addCableType: (def) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              cableTypes: [...current.cableTypes.filter((c) => c.id !== def.id), def]
            }
          }
        };
      }),

    removeCableType: (id) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              cableTypes: current.cableTypes.filter((c) => c.id !== id)
            }
          }
        };
      }),

    addBoxType: (def) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              boxTypes: [...current.boxTypes.filter((b) => b.id !== def.id), def]
            }
          }
        };
      }),

    removeBoxType: (id) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              boxTypes: current.boxTypes.filter((b) => b.id !== id)
            }
          }
        };
      }),

    addOpeningType: (def) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        const existing = current.openingTypes || [];
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              openingTypes: [...existing.filter((o) => o.id !== def.id), def]
            }
          }
        };
      }),

    removeOpeningType: (id) =>
      set((state) => {
        const current = state.project.materialCatalog || createDefaultMaterialCatalog();
        const existing = current.openingTypes || [];
        return {
          project: {
            ...state.project,
            materialCatalog: {
              ...current,
              openingTypes: existing.filter((o) => o.id !== id)
            }
          }
        };
      }),

    setUnderlaySheet: (levelId, sheet) =>
      set((state) => ({
        project: {
          ...state.project,
          underlaySheets: {
            ...(state.project.underlaySheets || {}),
            [levelId]: sheet
          },
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    updateUnderlaySheet: (levelId, updates) =>
      set((state) => {
        const existing = state.project.underlaySheets?.[levelId];
        if (!existing) return state;
        return {
          project: {
            ...state.project,
            underlaySheets: {
              ...(state.project.underlaySheets || {}),
              [levelId]: { ...existing, ...updates }
            },
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    removeUnderlaySheet: (levelId) =>
      set((state) => {
        const current = { ...(state.project.underlaySheets || {}) };
        delete current[levelId];
        return {
          project: {
            ...state.project,
            underlaySheets: current,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      })
  };
}
