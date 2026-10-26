/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL FACADE: useProjectStore.ts
 * Responsabilidad Única (SRP):
 * Orquesta y unifica los slices modulares de Zustand (`historySlice`,
 * `selectionAndCatalogSlice`, `architectureSlice`, `electricalSlice`) bajo un
 * único contrato reactivo `useProjectStore` con total retrocompatibilidad.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import {
  generateUniqueId,
  MAX_PROJECT_UNDO_STACK,
  type SelectedEntity,
  type ProjectHistoryEntry,
  type SelectByCriteriaParams,
  type ProjectStoreState
} from './store/storeTypes';
import { createHistorySlice, createHistoryWrappedSet } from './store/historySlice';
import { createSelectionAndCatalogSlice } from './store/selectionAndCatalogSlice';
import { createArchitectureSlice } from './store/architectureSlice';
import { createElectricalSlice } from './store/electricalSlice';

export { generateUniqueId, MAX_PROJECT_UNDO_STACK };
export type { SelectedEntity, ProjectHistoryEntry, SelectByCriteriaParams, ProjectStoreState };

export const useProjectStore = create<ProjectStoreState>((rawSet, get) => {
  const set = createHistoryWrappedSet(rawSet);

  return {
    ...createHistorySlice(set, rawSet, get),
    ...createSelectionAndCatalogSlice(set, get),
    ...createArchitectureSlice(set, get),
    ...createElectricalSlice(set, get)
  };
});
