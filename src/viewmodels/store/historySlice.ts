/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL STORE SLICE: historySlice.ts
 * Responsabilidad Única (SRP):
 * Motor de snapshots multinivel Deshacer / Rehacer (`undo`/`redo`),
 * interceptor automático de mutaciones sobre `project`, carga con migración
 * legacy (`loadProject`), reseteo y actualización de metadatos/ajustes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../../models/architecture/BuildingProject';
import { createEmptyProject } from '../../models/architecture/BuildingProject';
import { migrateLoadedProject } from '../../models/architecture/projectMigration';
import {
  MAX_PROJECT_UNDO_STACK,
  type HistoryAndMetaSlice,
  type ProjectHistoryEntry,
  type StoreGet,
  type StoreSet
} from './storeTypes';

/**
 * Clona un `BuildingProject` para el historial de Deshacer/Rehacer.
 * Preserva las referencias pesadas inmutables de `imageUrl` en `underlaySheets`
 * mientras clona profundamente la geometría, electricidad y metadatos.
 */
export function cloneProject(project: BuildingProject): BuildingProject {
  if (typeof structuredClone === 'function') {
    return structuredClone(project);
  }
  return JSON.parse(JSON.stringify(project));
}

/**
 * Envuelve el `rawSet` de Zustand para capturar automáticamente una instantánea
 * en `undoStack` cada vez que una acción produce una nueva referencia `project`
 * (salvo cuando se indica `_skipHistory: true`).
 */
export function createHistoryWrappedSet(rawSet: StoreSet): StoreSet {
  return (partial, replace) => {
    rawSet((state) => {
      const nextPartial = typeof partial === 'function' ? partial(state) : partial;
      if (!nextPartial || typeof nextPartial !== 'object') {
        return nextPartial;
      }

      if ('_skipHistory' in nextPartial && nextPartial._skipHistory) {
        const { _skipHistory, ...rest } = nextPartial;
        return rest;
      }

      if ('project' in nextPartial && nextPartial.project && nextPartial.project !== state.project) {
        const currentEntry: ProjectHistoryEntry = {
          project: cloneProject(state.project),
          activeAnchorVertexId: state.activeAnchorVertexId
        };
        const nextUndo = [...(state.undoStack || []), currentEntry];
        if (nextUndo.length > MAX_PROJECT_UNDO_STACK) {
          nextUndo.shift();
        }
        return {
          ...nextPartial,
          undoStack: nextUndo,
          redoStack: [],
          canUndo: true,
          canRedo: false
        };
      }

      return nextPartial;
    }, replace);
  };
}

export function createHistorySlice(
  set: StoreSet,
  rawSet: StoreSet,
  get: StoreGet
): HistoryAndMetaSlice {
  return {
    project: createEmptyProject(),
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,

    undo: () => {
      const state = get();
      const stack = state.undoStack || [];
      if (stack.length === 0) return;
      const prevEntry = stack[stack.length - 1];
      const newUndoStack = stack.slice(0, -1);
      const currentEntry: ProjectHistoryEntry = {
        project: cloneProject(state.project),
        activeAnchorVertexId: state.activeAnchorVertexId
      };
      const nextRedoStack = [currentEntry, ...(state.redoStack || [])];
      if (nextRedoStack.length > MAX_PROJECT_UNDO_STACK) {
        nextRedoStack.pop();
      }

      rawSet({
        project: prevEntry.project,
        activeAnchorVertexId: prevEntry.activeAnchorVertexId,
        undoStack: newUndoStack,
        redoStack: nextRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: true,
        selectedEntity: null,
        selectedEntities: []
      });

      get().autoDetectSpaces();
    },

    redo: () => {
      const state = get();
      const stack = state.redoStack || [];
      if (stack.length === 0) return;
      const nextEntry = stack[0];
      const newRedoStack = stack.slice(1);
      const currentEntry: ProjectHistoryEntry = {
        project: cloneProject(state.project),
        activeAnchorVertexId: state.activeAnchorVertexId
      };
      const nextUndoStack = [...(state.undoStack || []), currentEntry];
      if (nextUndoStack.length > MAX_PROJECT_UNDO_STACK) {
        nextUndoStack.shift();
      }

      rawSet({
        project: nextEntry.project,
        activeAnchorVertexId: nextEntry.activeAnchorVertexId,
        undoStack: nextUndoStack,
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
        selectedEntity: null,
        selectedEntities: []
      });

      get().autoDetectSpaces();
    },

    updateProjectMeta: (patch) =>
      set((state) => ({
        project: {
          ...state.project,
          meta: {
            ...state.project.meta,
            ...patch,
            updatedAt: Date.now()
          }
        }
      })),

    updateElectricalSettings: (patch) =>
      set((state) => ({
        project: {
          ...state.project,
          electricalSettings: {
            ...state.project.electricalSettings,
            ...patch
          },
          meta: {
            ...state.project.meta,
            updatedAt: Date.now()
          }
        }
      })),

    updateCircuitCalculationOverride: (circuitId, patch) =>
      set((state) => {
        const currentOverrides = state.project.electricalSettings?.circuitOverrides || {};
        const existing = currentOverrides[circuitId] || {};
        return {
          project: {
            ...state.project,
            electricalSettings: {
              ...state.project.electricalSettings,
              circuitOverrides: {
                ...currentOverrides,
                [circuitId]: {
                  ...existing,
                  ...patch
                }
              }
            },
            meta: {
              ...state.project.meta,
              updatedAt: Date.now()
            }
          }
        };
      }),

    loadProject: (project) => {
      const migrated = migrateLoadedProject(project);
      set({
        project: migrated,
        selectedEntity: null,
        selectedEntities: [],
        activeAnchorVertexId: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        _skipHistory: true
      });
    },

    resetProject: () =>
      set({
        project: createEmptyProject(),
        selectedEntity: null,
        selectedEntities: [],
        activeAnchorVertexId: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        _skipHistory: true
      })
  };
}
