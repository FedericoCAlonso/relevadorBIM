/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL STORE SLICE: electricalSlice.ts
 * Responsabilidad Única (SRP):
 * Operaciones de dominio electromecánico y de relevamiento de campo:
 * bocas (`electricalElements`), cañerías (`conduits`), circuitos (`circuits`),
 * ramas eléctricas (`applyBranchUpdates`), sincronización de circuitos en
 * tránsito (`syncPassingCircuits`), derivación de conductores y tableros (`panels`).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { applyBranchUpdates, syncPassingCircuits } from '../../models/electrical/electricalBranch';
import { deriveConduitConductors } from '../../models/electrical/electricalConductorDerivation';
import { buildDefaultPanelsAndCircuits } from '../../models/architecture/projectMigration';
import type { ElectricalSlice, StoreGet, StoreSet } from './storeTypes';

export function createElectricalSlice(set: StoreSet, get: StoreGet): ElectricalSlice {
  return {
    addElectricalElement: (element) =>
      set((state) => ({
        project: {
          ...state.project,
          electricalElements: [...state.project.electricalElements, element],
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    updateElectricalElement: (elementId, updates) =>
      set((state) => {
        const allElements = state.project.electricalElements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el
        );
        if (updates.circuitId !== undefined || updates.passingCircuitIds !== undefined) {
          const synced = syncPassingCircuits({
            elements: allElements,
            conduits: state.project.conduits
          });
          return {
            project: {
              ...state.project,
              electricalElements: synced.updatedElements,
              conduits: synced.updatedConduits,
              meta: { ...state.project.meta, updatedAt: Date.now() }
            }
          };
        }
        return {
          project: {
            ...state.project,
            electricalElements: allElements,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    deleteElectricalElement: (elementId) =>
      set((state) => ({
        project: {
          ...state.project,
          electricalElements: state.project.electricalElements.filter((el) => el.id !== elementId),
          conduits: state.project.conduits.filter(
            (c) => c.fromElementId !== elementId && c.toElementId !== elementId
          ),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        },
        selectedEntity: state.selectedEntity?.id === elementId ? null : state.selectedEntity,
        selectedEntities: state.selectedEntities.filter((e) => e.id !== elementId)
      })),

    batchUpdateElectricalElements: (elementIds, updates) =>
      set((state) => {
        const idSet = new Set(elementIds);
        const updatedElements = state.project.electricalElements.map((e) =>
          idSet.has(e.id) ? { ...e, ...updates } : e
        );
        const synced = syncPassingCircuits({
          elements: updatedElements,
          conduits: state.project.conduits
        });
        return {
          project: {
            ...state.project,
            electricalElements: synced.updatedElements,
            conduits: synced.updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    addConduit: (conduit) =>
      set((state) => {
        let candidate = conduit;
        const elementsMap = new Map(state.project.electricalElements.map((e) => [e.id, e]));
        const panelsMap = new Map(state.project.panels.map((p) => [p.id, p]));
        const fromEl =
          elementsMap.get(candidate.fromElementId) || panelsMap.get(candidate.fromElementId);
        const toEl =
          elementsMap.get(candidate.toElementId) || panelsMap.get(candidate.toElementId);

        if (!candidate.circuitId && candidate.circuitIds === undefined) {
          const inheritedId =
            (fromEl && 'circuitId' in fromEl && fromEl.circuitId) ||
            (toEl && 'circuitId' in toEl && toEl.circuitId) ||
            undefined;
          if (inheritedId) {
            candidate = {
              ...candidate,
              circuitId: inheritedId,
              circuitIds: [inheritedId]
            };
          }
        }

        if (!candidate.conductors || candidate.conductors.length === 0) {
          const derived = deriveConduitConductors({
            conduit: candidate,
            circuits: state.project.circuits,
            fromElement: fromEl,
            toElement: toEl
          });
          if (derived.length > 0) {
            candidate = { ...candidate, conductors: derived };
          }
        }

        const allConduits = [...state.project.conduits, candidate];
        const synced = syncPassingCircuits({
          elements: state.project.electricalElements,
          conduits: allConduits
        });
        return {
          project: {
            ...state.project,
            electricalElements: synced.updatedElements,
            conduits: synced.updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    updateConduit: (conduitId, updates) =>
      set((state) => {
        const target = state.project.conduits.find((c) => c.id === conduitId);
        let nextConductors = updates.conductors;

        if (
          nextConductors === undefined &&
          (updates.circuitId !== undefined || updates.circuitIds !== undefined) &&
          target
        ) {
          const candidateConduit = { ...target, ...updates };
          const elementsMap = new Map(state.project.electricalElements.map((e) => [e.id, e]));
          const panelsMap = new Map(state.project.panels.map((p) => [p.id, p]));
          const fromEl =
            elementsMap.get(candidateConduit.fromElementId) ||
            panelsMap.get(candidateConduit.fromElementId);
          const toEl =
            elementsMap.get(candidateConduit.toElementId) ||
            panelsMap.get(candidateConduit.toElementId);

          nextConductors = deriveConduitConductors({
            conduit: candidateConduit,
            circuits: state.project.circuits,
            fromElement: fromEl,
            toElement: toEl
          });
        }

        const finalUpdates =
          nextConductors !== undefined ? { ...updates, conductors: nextConductors } : updates;

        const allConduits = state.project.conduits.map((c) =>
          c.id === conduitId ? { ...c, ...finalUpdates } : c
        );
        const synced = syncPassingCircuits({
          elements: state.project.electricalElements,
          conduits: allConduits
        });
        return {
          project: {
            ...state.project,
            electricalElements: synced.updatedElements,
            conduits: synced.updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    deleteConduit: (conduitId) =>
      set((state) => {
        const remainingConduits = state.project.conduits.filter((c) => c.id !== conduitId);
        const synced = syncPassingCircuits({
          elements: state.project.electricalElements,
          conduits: remainingConduits
        });
        return {
          project: {
            ...state.project,
            electricalElements: synced.updatedElements,
            conduits: synced.updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          },
          selectedEntity: state.selectedEntity?.id === conduitId ? null : state.selectedEntity,
          selectedEntities: state.selectedEntities.filter((e) => e.id !== conduitId)
        };
      }),

    batchUpdateConduits: (conduitIds, updates) =>
      set((state) => {
        const idSet = new Set(conduitIds);
        const updatedConduits = state.project.conduits.map((c) =>
          idSet.has(c.id) ? { ...c, ...updates } : c
        );
        const synced = syncPassingCircuits({
          elements: state.project.electricalElements,
          conduits: updatedConduits
        });
        return {
          project: {
            ...state.project,
            electricalElements: synced.updatedElements,
            conduits: synced.updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    batchDeriveConduitConductors: (conduitIds) =>
      set((state) => {
        const targetIds =
          conduitIds && conduitIds.length > 0
            ? new Set(conduitIds)
            : new Set(
                state.selectedEntities
                  .filter((e) => e.type === 'conduit')
                  .map((e) => e.id)
              );

        if (targetIds.size === 0) return state;

        const elementsMap = new Map(state.project.electricalElements.map((e) => [e.id, e]));
        const panelsMap = new Map(state.project.panels.map((p) => [p.id, p]));

        const updatedConduits = state.project.conduits.map((conduit) => {
          if (!targetIds.has(conduit.id)) return conduit;

          const fromEl =
            elementsMap.get(conduit.fromElementId) || panelsMap.get(conduit.fromElementId);
          const toEl =
            elementsMap.get(conduit.toElementId) || panelsMap.get(conduit.toElementId);

          const newConductors = deriveConduitConductors({
            conduit,
            circuits: state.project.circuits,
            fromElement: fromEl,
            toElement: toEl
          });

          return {
            ...conduit,
            conductors: newConductors
          };
        });

        return {
          project: {
            ...state.project,
            conduits: updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    addCircuit: (circuit) =>
      set((state) => ({
        project: {
          ...state.project,
          circuits: [...state.project.circuits, circuit],
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    updateCircuit: (circuitId, updates) =>
      set((state) => {
        const updatedCircuits = state.project.circuits.map((c) =>
          c.id === circuitId ? { ...c, ...updates } : c
        );

        const affectsConductors =
          updates.wireSectionBaseMM2 !== undefined ||
          updates.wireSectionPeMM2 !== undefined ||
          updates.phases !== undefined ||
          updates.phaseColor !== undefined ||
          updates.voltageV !== undefined;

        let updatedConduits = state.project.conduits;

        if (affectsConductors) {
          const elementsMap = new Map(state.project.electricalElements.map((e) => [e.id, e]));
          const panelsMap = new Map((state.project.panels || []).map((p) => [p.id, p]));

          updatedConduits = state.project.conduits.map((conduit) => {
            const carriesCircuit =
              conduit.circuitId === circuitId ||
              (conduit.circuitIds && conduit.circuitIds.includes(circuitId));

            if (!carriesCircuit) return conduit;

            const fromEl =
              elementsMap.get(conduit.fromElementId) || panelsMap.get(conduit.fromElementId);
            const toEl =
              elementsMap.get(conduit.toElementId) || panelsMap.get(conduit.toElementId);

            const newConductors = deriveConduitConductors({
              conduit,
              circuits: updatedCircuits,
              fromElement: fromEl,
              toElement: toEl
            });

            return {
              ...conduit,
              conductors: newConductors
            };
          });
        }

        return {
          project: {
            ...state.project,
            circuits: updatedCircuits,
            conduits: updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    deleteCircuit: (circuitId) =>
      set((state) => {
        const remainingCircuits = state.project.circuits.filter((c) => c.id !== circuitId);
        const elementsMap = new Map(state.project.electricalElements.map((e) => [e.id, e]));
        const panelsMap = new Map((state.project.panels || []).map((p) => [p.id, p]));

        const updatedConduits = state.project.conduits.map((cd) => {
          const carriesCircuit =
            cd.circuitId === circuitId ||
            (cd.circuitIds && cd.circuitIds.includes(circuitId));

          if (!carriesCircuit) return cd;

          const nextCircuitId = cd.circuitId === circuitId ? null : cd.circuitId;
          const nextCircuitIds = cd.circuitIds?.filter((id) => id !== circuitId);

          const candidate = {
            ...cd,
            circuitId: nextCircuitId,
            circuitIds: nextCircuitIds
          };

          const fromEl = elementsMap.get(cd.fromElementId) || panelsMap.get(cd.fromElementId);
          const toEl = elementsMap.get(cd.toElementId) || panelsMap.get(cd.toElementId);

          const newConductors = deriveConduitConductors({
            conduit: candidate,
            circuits: remainingCircuits,
            fromElement: fromEl,
            toElement: toEl
          });

          return {
            ...candidate,
            conductors: newConductors
          };
        });

        return {
          project: {
            ...state.project,
            circuits: remainingCircuits,
            electricalElements: state.project.electricalElements.map((el) =>
              el.circuitId === circuitId ? { ...el, circuitId: null } : el
            ),
            conduits: updatedConduits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    updateElectricalBranch: (branch, updates) =>
      set((state) => {
        const { updatedElements, updatedConduits, updatedPanels, updatedCircuits } =
          applyBranchUpdates({
            branch,
            updates,
            allElements: state.project.electricalElements,
            allConduits: state.project.conduits,
            allPanels: state.project.panels,
            allCircuits: state.project.circuits,
            materialCatalog: state.project.materialCatalog
          });

        return {
          project: {
            ...state.project,
            electricalElements: updatedElements,
            conduits: updatedConduits,
            panels: updatedPanels,
            circuits: updatedCircuits,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    addPanel: (panel) =>
      set((state) => ({
        project: {
          ...state.project,
          panels: [...state.project.panels, panel],
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    updatePanel: (panelId, updates) =>
      set((state) => ({
        project: {
          ...state.project,
          panels: state.project.panels.map((p) =>
            p.id === panelId ? { ...p, ...updates } : p
          ),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    deletePanel: (panelId) =>
      set((state) => {
        if (state.project.panels.length <= 1) {
          return state;
        }
        const remainingPanels = state.project.panels.filter((p) => p.id !== panelId);
        const fallbackPanelId = remainingPanels[0].id;
        const remainingConduits = state.project.conduits.filter(
          (c) => c.fromElementId !== panelId && c.toElementId !== panelId
        );
        return {
          selectedEntity: state.selectedEntity?.id === panelId ? null : state.selectedEntity,
          project: {
            ...state.project,
            panels: remainingPanels,
            conduits: remainingConduits,
            circuits: state.project.circuits.map((c) => ({
              ...c,
              panelId: c.panelId === panelId ? fallbackPanelId : c.panelId,
              targetPanelId: c.targetPanelId === panelId ? null : c.targetPanelId
            })),
            meta: { ...state.project.meta, updatedAt: Date.now() }
          }
        };
      }),

    ensureDefaultCircuits: () => {
      const { project } = get();
      const generated = buildDefaultPanelsAndCircuits(project);
      if (!generated) return;
      set((state) => ({
        project: {
          ...state.project,
          panels: generated.panels,
          circuits: generated.circuits,
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      }));
    }
  };
}
