/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useProjectStore.ts
 * Estado Global del Proyecto BIM y Operaciones CRUD de Arquitectura e Instalación.
 * Basado en Relevamiento por Puntos de Referencia Físicos (Vértices, Caras, Jambas).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import type { BuildingProject, ProjectMetadata } from '../models/architecture/BuildingProject';
import { createEmptyProject } from '../models/architecture/BuildingProject';
import type { Wall, WallVertex, Vector2D } from '../models/architecture/Wall';
import { getWallVector, getWallLength, getWallLeftNormal } from '../models/architecture/Wall';
import type { Opening, OpeningType, OpeningSwing } from '../models/architecture/Opening';
import type { Space } from '../models/architecture/Space';
import { findEnclosedCycles } from '../models/architecture/Space';
import type {
  ElectricalElement,
  Conduit,
  Circuit,
  Panel,
  ConduitTypeDefinition,
  CableTypeDefinition,
  BoxTypeDefinition
} from '../models/electrical/ElectricalModel';
import { createDefaultMaterialCatalog } from '../models/electrical/electricalStandards';
import type { UnderlaySheet } from '../models/underlay/UnderlaySheet';
import type { DimensionLine } from '../models/architecture/DimensionLine';

let idCounter = 0;
export function generateUniqueId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export interface SelectedEntity {
  type: 'vertex' | 'wall' | 'opening' | 'space' | 'electrical_element' | 'conduit' | 'dimension';
  id: string;
}

interface ProjectStoreState {
  project: BuildingProject;
  selectedEntity: SelectedEntity | null;
  activeAnchorVertexId: string | null;

  // Selección y Navegación
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setActiveAnchorVertexId: (vertexId: string | null) => void;
  setActiveLevel: (levelId: string) => void;

  // ─── ACCIONES DE RELEVAMIENTO POR REFERENCIA (MURO A MURO) ───────────────
  
  /**
   * Traza una nueva pared a partir de un punto de anclaje (vértice existente o coordenada libre).
   * Si el extremo final queda a menos de 10 cm de otro vértice existente, se une automáticamente (snap de cierre).
   */
  addWallFromAnchor: (params: {
    startVertexId?: string;
    startCoord?: Vector2D;
    lengthM: number;
    angleDeg: number;       // 0 = Este, 90 = Norte, 180 = Oeste, 270 = Sur (o libre)
    thickness?: number;     // default 0.15m
  }) => { wall: Wall; endVertexId: string } | null;

  /**
   * Genera una pared perpendicular (empalme en T) naciendo a cierta distancia
   * a lo largo de la cara de un muro existente.
   */
  addBranchWallFromOffset: (params: {
    hostWallId: string;
    referenceVertexId: string; // Vértice desde el cual se mide el offset
    offsetM: number;           // Distancia medida desde ese vértice
    branchLengthM: number;     // Largo de la nueva pared
    side: 'left' | 'right';    // Lado hacia donde nace la T
    thickness?: number;
  }) => Wall | null;

  /**
   * Inserta una puerta, ventana o vano sobre un muro referenciada a una distancia
   * medida desde una esquina específica hacia la jamba.
   */
  addOpeningReferenced: (params: {
    hostWallId: string;
    referenceVertexId: string; // Esquina de referencia
    offsetToJambM: number;     // Distancia desde la esquina hasta el marco
    widthM: number;            // Ancho del vano
    type: OpeningType;
    swing?: OpeningSwing;
    label?: string;
  }) => Opening | null;

  updateWall: (wallId: string, updates: Partial<Wall>) => void;
  updateWallLength: (wallId: string, newLengthM: number) => void;
  rotateWall: (wallId: string, deltaAngleDeg: number) => void;
  invertWallDirection: (wallId: string) => void;
  deleteWall: (wallId: string) => void;
  undoLastWall: () => void;
  updateOpening: (openingId: string, updates: Partial<Opening>) => void;
  deleteOpening: (openingId: string) => void;

  // Acciones de Ambientes / Espacios
  updateSpace: (spaceId: string, updates: Partial<Space>) => void;
  autoDetectSpaces: () => void;

  // Acciones Electromecánicas y Circuitos (Norma AEA 90364-771)
  addElectricalElement: (element: ElectricalElement) => void;
  updateElectricalElement: (elementId: string, updates: Partial<ElectricalElement>) => void;
  deleteElectricalElement: (elementId: string) => void;
  addConduit: (conduit: Conduit) => void;
  updateConduit: (conduitId: string, updates: Partial<Conduit>) => void;
  deleteConduit: (conduitId: string) => void;
  addCircuit: (circuit: Circuit) => void;
  updateCircuit: (circuitId: string, updates: Partial<Circuit>) => void;
  deleteCircuit: (circuitId: string) => void;
  addPanel: (panel: Panel) => void;
  updatePanel: (panelId: string, updates: Partial<Panel>) => void;
  deletePanel: (panelId: string) => void;
  ensureDefaultCircuits: () => void;

  // Catálogo Abierto de Materiales (3 Categorías)
  addConduitType: (def: ConduitTypeDefinition) => void;
  removeConduitType: (id: string) => void;
  addCableType: (def: CableTypeDefinition) => void;
  removeCableType: (id: string) => void;
  addBoxType: (def: BoxTypeDefinition) => void;
  removeBoxType: (id: string) => void;

  // Láminas de Fondo (Underlays / Planos PDF e Imágenes)
  setUnderlaySheet: (levelId: string, sheet: UnderlaySheet) => void;
  updateUnderlaySheet: (levelId: string, updates: Partial<UnderlaySheet>) => void;
  removeUnderlaySheet: (levelId: string) => void;

  // Cotas Métricas Libres
  addDimensionLine: (dimension: DimensionLine) => void;
  updateDimensionLine: (dimensionId: string, updates: Partial<DimensionLine>) => void;
  deleteDimensionLine: (dimensionId: string) => void;

  // Reset y Carga
  loadProject: (project: BuildingProject) => void;
  resetProject: () => void;
  updateProjectMeta: (patch: Partial<ProjectMetadata>) => void;

  // Visualización CAD
  showDimensions: boolean;
  setShowDimensions: (show: boolean) => void;
  toggleDimensions: () => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: createEmptyProject(),
  selectedEntity: null,
  activeAnchorVertexId: null,
  showDimensions: true,

  setShowDimensions: (show) => set({ showDimensions: show }),
  toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),

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

  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
  setActiveAnchorVertexId: (vertexId) => set({ activeAnchorVertexId: vertexId }),

  setActiveLevel: (levelId) =>
    set((state) => ({
      project: { ...state.project, activeLevelId: levelId },
      selectedEntity: null,
      activeAnchorVertexId: null
    })),

  addWallFromAnchor: ({
    startVertexId,
    startCoord,
    lengthM,
    angleDeg,
    thickness = 0.15
  }) => {
    const { project } = get();
    if (lengthM <= 0) return null;

    let vStart: WallVertex | undefined;

    // 1. Determinar vértice de inicio
    if (startVertexId) {
      vStart = project.vertices.find((v) => v.id === startVertexId);
    } else if (startCoord) {
      vStart = {
        id: generateUniqueId('v-start'),
        x: Number(startCoord.x.toFixed(3)),
        y: Number(startCoord.y.toFixed(3))
      };
    }

    if (!vStart) return null;

    // 2. Calcular coordenada del extremo final usando trigonometría pura
    const rad = (angleDeg * Math.PI) / 180;
    const targetEndX = vStart.x + Math.cos(rad) * lengthM;
    const targetEndY = vStart.y + Math.sin(rad) * lengthM;

    // 3. Snapping magnético: ¿Cierra sobre un vértice existente cercano (tol: 20cm)?
    const SNAP_TOLERANCE = 0.20;
    let vEnd = project.vertices.find(
      (v) => v.id !== vStart?.id && Math.hypot(v.x - targetEndX, v.y - targetEndY) <= SNAP_TOLERANCE
    );

    const isNewStartVertex = !project.vertices.some((v) => v.id === vStart?.id);
    const isNewEndVertex = !vEnd;

    if (!vEnd) {
      vEnd = {
        id: generateUniqueId('v-end'),
        x: Number(targetEndX.toFixed(3)),
        y: Number(targetEndY.toFixed(3))
      };
    }

    // 4. Crear la pared física
    const newWall: Wall = {
      id: generateUniqueId('w'),
      levelId: project.activeLevelId,
      startVertexId: vStart.id,
      endVertexId: vEnd.id,
      thickness,
      height: 2.80
    };

    const updatedVertices = [...project.vertices];
    if (isNewStartVertex) updatedVertices.push(vStart);
    if (isNewEndVertex) updatedVertices.push(vEnd);

    set({
      project: {
        ...project,
        vertices: updatedVertices,
        walls: [...project.walls, newWall],
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      // Dejar activo el extremo final como punto de anclaje para encadenar la siguiente pared
      activeAnchorVertexId: vEnd.id,
      selectedEntity: { type: 'wall', id: newWall.id }
    });

    get().autoDetectSpaces();

    return { wall: newWall, endVertexId: vEnd.id };
  },

  addBranchWallFromOffset: ({
    hostWallId,
    referenceVertexId,
    offsetM,
    branchLengthM,
    side,
    thickness = 0.15
  }) => {
    const { project } = get();
    const hostWall = project.walls.find((w) => w.id === hostWallId);
    if (!hostWall || branchLengthM <= 0) return null;

    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
    const vStart = verticesMap.get(hostWall.startVertexId);
    const vEnd = verticesMap.get(hostWall.endVertexId);
    if (!vStart || !vEnd) return null;

    const wallVec = getWallVector(hostWall, verticesMap);
    const wallLen = getWallLength(hostWall, verticesMap);
    if (wallLen === 0) return null;

    // Dirección normalizada del muro
    const uWall = { x: wallVec.x / wallLen, y: wallVec.y / wallLen };
    const leftNormal = getWallLeftNormal(hostWall, verticesMap);
    const uBranch = side === 'left' ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };

    // Si la referencia es el vértice final, el offset se cuenta desde vEnd hacia vStart
    const isFromStart = referenceVertexId === hostWall.startVertexId;
    const rootPoint: Vector2D = isFromStart
      ? { x: vStart.x + uWall.x * offsetM, y: vStart.y + uWall.y * offsetM }
      : { x: vEnd.x - uWall.x * offsetM, y: vEnd.y - uWall.y * offsetM };

    const endPoint: Vector2D = {
      x: rootPoint.x + uBranch.x * branchLengthM,
      y: rootPoint.y + uBranch.y * branchLengthM
    };

    const branchRootVertex: WallVertex = {
      id: generateUniqueId('v-tee-root'),
      x: Number(rootPoint.x.toFixed(3)),
      y: Number(rootPoint.y.toFixed(3))
    };

    const branchEndVertex: WallVertex = {
      id: generateUniqueId('v-tee-end'),
      x: Number(endPoint.x.toFixed(3)),
      y: Number(endPoint.y.toFixed(3))
    };

    const branchWall: Wall = {
      id: generateUniqueId('w-branch'),
      levelId: project.activeLevelId,
      startVertexId: branchRootVertex.id,
      endVertexId: branchEndVertex.id,
      thickness,
      height: hostWall.height
    };

    set({
      project: {
        ...project,
        vertices: [...project.vertices, branchRootVertex, branchEndVertex],
        walls: [...project.walls, branchWall],
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      activeAnchorVertexId: branchEndVertex.id,
      selectedEntity: { type: 'wall', id: branchWall.id }
    });

    return branchWall;
  },

  addOpeningReferenced: ({
    hostWallId,
    referenceVertexId,
    offsetToJambM,
    widthM,
    type,
    swing = 'left_in',
    label
  }) => {
    const { project } = get();
    const hostWall = project.walls.find((w) => w.id === hostWallId);
    if (!hostWall || widthM <= 0) return null;

    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
    const wallLen = getWallLength(hostWall, verticesMap);

    // Calcular la distancia desde startVertex según cuál vértice se tomó como referencia
    const isFromStart = referenceVertexId === hostWall.startVertexId;
    const distanceAlongWall = isFromStart
      ? offsetToJambM
      : Math.max(0, wallLen - offsetToJambM - widthM);

    const newOpening: Opening = {
      id: generateUniqueId('open'),
      wallId: hostWall.id,
      type,
      width: widthM,
      height: type === 'door' ? 2.05 : 1.10,
      sill: type === 'door' ? 0.0 : 0.90,
      distanceAlongWall: Number(distanceAlongWall.toFixed(3)),
      swing,
      label: label || (type === 'door' ? 'P' : 'V')
    };

    set({
      project: {
        ...project,
        openings: [...project.openings, newOpening],
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      selectedEntity: { type: 'opening', id: newOpening.id }
    });

    return newOpening;
  },

  updateWall: (wallId, updates) => {
    set((state) => ({
      project: {
        ...state.project,
        walls: state.project.walls.map((w) => (w.id === wallId ? { ...w, ...updates } : w)),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    }));
  },

  updateWallLength: (wallId, newLengthM) => {
    const { project } = get();
    const wall = project.walls.find((w) => w.id === wallId);
    if (!wall || newLengthM <= 0) return;

    const vStart = project.vertices.find((v) => v.id === wall.startVertexId);
    const vEnd = project.vertices.find((v) => v.id === wall.endVertexId);
    if (!vStart || !vEnd) return;

    const currentDx = vEnd.x - vStart.x;
    const currentDy = vEnd.y - vStart.y;
    const currentLen = Math.hypot(currentDx, currentDy);
    if (currentLen === 0) return;

    const ratio = newLengthM / currentLen;
    const newEndX = vStart.x + currentDx * ratio;
    const newEndY = vStart.y + currentDy * ratio;

    set({
      project: {
        ...project,
        vertices: project.vertices.map((v) =>
          v.id === vEnd.id ? { ...v, x: Number(newEndX.toFixed(3)), y: Number(newEndY.toFixed(3)) } : v
        ),
        meta: { ...project.meta, updatedAt: Date.now() }
      }
    });
    get().autoDetectSpaces();
  },

  rotateWall: (wallId, deltaAngleDeg) => {
    const { project } = get();
    const wall = project.walls.find((w) => w.id === wallId);
    if (!wall) return;

    const vStart = project.vertices.find((v) => v.id === wall.startVertexId);
    const vEnd = project.vertices.find((v) => v.id === wall.endVertexId);
    if (!vStart || !vEnd) return;

    const currentDx = vEnd.x - vStart.x;
    const currentDy = vEnd.y - vStart.y;
    const currentLen = Math.hypot(currentDx, currentDy);
    const currentAngle = Math.atan2(currentDy, currentDx);
    const deltaRad = (deltaAngleDeg * Math.PI) / 180;
    const newAngle = currentAngle + deltaRad;

    const newEndX = vStart.x + Math.cos(newAngle) * currentLen;
    const newEndY = vStart.y + Math.sin(newAngle) * currentLen;

    set({
      project: {
        ...project,
        vertices: project.vertices.map((v) =>
          v.id === vEnd.id ? { ...v, x: Number(newEndX.toFixed(3)), y: Number(newEndY.toFixed(3)) } : v
        ),
        meta: { ...project.meta, updatedAt: Date.now() }
      }
    });
    get().autoDetectSpaces();
  },

  invertWallDirection: (wallId) => {
    set((state) => ({
      project: {
        ...state.project,
        walls: state.project.walls.map((w) =>
          w.id === wallId ? { ...w, startVertexId: w.endVertexId, endVertexId: w.startVertexId } : w
        ),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    }));
  },

  deleteWall: (wallId) => {
    const { project } = get();
    const targetWall = project.walls.find((w) => w.id === wallId);
    if (!targetWall) return;

    const remainingWalls = project.walls.filter((w) => w.id !== wallId);

    // Identificar si los vértices quedaron huérfanos sin paredes
    const isStartUsed = remainingWalls.some(
      (w) => w.startVertexId === targetWall.startVertexId || w.endVertexId === targetWall.startVertexId
    );
    const isEndUsed = remainingWalls.some(
      (w) => w.startVertexId === targetWall.endVertexId || w.endVertexId === targetWall.endVertexId
    );

    let updatedVertices = project.vertices;
    if (!isStartUsed) updatedVertices = updatedVertices.filter((v) => v.id !== targetWall.startVertexId);
    if (!isEndUsed) updatedVertices = updatedVertices.filter((v) => v.id !== targetWall.endVertexId);

    let newAnchor = get().activeAnchorVertexId;
    if (newAnchor === targetWall.startVertexId || newAnchor === targetWall.endVertexId) {
      newAnchor = updatedVertices[updatedVertices.length - 1]?.id || null;
    }

    set({
      project: {
        ...project,
        vertices: updatedVertices,
        walls: remainingWalls,
        openings: project.openings.filter((o) => o.wallId !== wallId),
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      activeAnchorVertexId: newAnchor,
      selectedEntity: get().selectedEntity?.id === wallId ? null : get().selectedEntity
    });

    get().autoDetectSpaces();
  },

  undoLastWall: () => {
    const { project } = get();
    if (project.walls.length === 0) return;

    const lastWall = project.walls[project.walls.length - 1];
    const remainingWalls = project.walls.slice(0, -1);

    const isEndUsedElsewhere = remainingWalls.some(
      (w) => w.startVertexId === lastWall.endVertexId || w.endVertexId === lastWall.endVertexId
    );
    const isStartUsedElsewhere = remainingWalls.some(
      (w) => w.startVertexId === lastWall.startVertexId || w.endVertexId === lastWall.startVertexId
    );

    let updatedVertices = project.vertices;
    if (!isEndUsedElsewhere) {
      updatedVertices = updatedVertices.filter((v) => v.id !== lastWall.endVertexId);
    }
    if (!isStartUsedElsewhere && remainingWalls.length === 0) {
      updatedVertices = updatedVertices.filter((v) => v.id !== lastWall.startVertexId);
    }

    const newAnchor = isStartUsedElsewhere
      ? lastWall.startVertexId
      : updatedVertices[updatedVertices.length - 1]?.id || null;

    set({
      project: {
        ...project,
        vertices: updatedVertices,
        walls: remainingWalls,
        openings: project.openings.filter((o) => o.wallId !== lastWall.id),
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      activeAnchorVertexId: newAnchor,
      selectedEntity: null
    });

    get().autoDetectSpaces();
  },

  updateOpening: (openingId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        openings: state.project.openings.map((o) => (o.id === openingId ? { ...o, ...updates } : o)),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  deleteOpening: (openingId) =>
    set((state) => ({
      project: {
        ...state.project,
        openings: state.project.openings.filter((o) => o.id !== openingId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      },
      selectedEntity: state.selectedEntity?.id === openingId ? null : state.selectedEntity
    })),

  updateSpace: (spaceId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        spaces: state.project.spaces.map((s) => (s.id === spaceId ? { ...s, ...updates } : s)),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  autoDetectSpaces: () => {
    const { project } = get();
    const wallsInLevel = project.walls.filter((w) => w.levelId === project.activeLevelId);
    const verticesMap = new Map(project.vertices.map((v) => [v.id, { x: v.x, y: v.y }]));
    const cycles = findEnclosedCycles(wallsInLevel, verticesMap);

    const otherLevelSpaces = project.spaces.filter((s) => s.levelId !== project.activeLevelId);

    const newSpacesInLevel: Space[] = cycles.map((c, idx) => {
      const existing = project.spaces.find(
        (s) =>
          s.levelId === project.activeLevelId &&
          s.boundaryVertexIds.length === c.vertexIds.length &&
          c.vertexIds.every((id) => s.boundaryVertexIds.includes(id))
      );

      if (existing) {
        return {
          ...existing,
          boundaryVertexIds: c.vertexIds,
          wallIds: c.wallIds
        };
      }

      return {
        id: generateUniqueId('space'),
        name: `Ambiente ${otherLevelSpaces.length + idx + 1}`,
        category: 'living',
        levelId: project.activeLevelId,
        ceilingHeight: 2.70,
        floorElevation: 0.0,
        boundaryVertexIds: c.vertexIds,
        wallIds: c.wallIds
      };
    });

    set({
      project: {
        ...project,
        spaces: [...otherLevelSpaces, ...newSpacesInLevel]
      }
    });
  },

  addElectricalElement: (element) =>
    set((state) => ({
      project: {
        ...state.project,
        electricalElements: [...state.project.electricalElements, element],
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  updateElectricalElement: (elementId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        electricalElements: state.project.electricalElements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el
        ),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

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
      selectedEntity: state.selectedEntity?.id === elementId ? null : state.selectedEntity
    })),

  addConduit: (conduit) =>
    set((state) => ({
      project: {
        ...state.project,
        conduits: [...state.project.conduits, conduit],
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  updateConduit: (conduitId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        conduits: state.project.conduits.map((c) =>
          c.id === conduitId ? { ...c, ...updates } : c
        ),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  deleteConduit: (conduitId) =>
    set((state) => ({
      project: {
        ...state.project,
        conduits: state.project.conduits.filter((c) => c.id !== conduitId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      },
      selectedEntity: state.selectedEntity?.id === conduitId ? null : state.selectedEntity
    })),

  addCircuit: (circuit) =>
    set((state) => ({
      project: {
        ...state.project,
        circuits: [...state.project.circuits, circuit],
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  updateCircuit: (circuitId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        circuits: state.project.circuits.map((c) =>
          c.id === circuitId ? { ...c, ...updates } : c
        ),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  deleteCircuit: (circuitId) =>
    set((state) => ({
      project: {
        ...state.project,
        circuits: state.project.circuits.filter((c) => c.id !== circuitId),
        electricalElements: state.project.electricalElements.map((el) =>
          el.circuitId === circuitId ? { ...el, circuitId: null } : el
        ),
        conduits: state.project.conduits.map((cd) =>
          cd.circuitId === circuitId
            ? { ...cd, circuitId: null, circuitIds: cd.circuitIds?.filter((id) => id !== circuitId) }
            : cd
        ),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

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
    set((state) => ({
      project: {
        ...state.project,
        panels: state.project.panels.filter((p) => p.id !== panelId),
        circuits: state.project.circuits.filter((c) => c.panelId !== panelId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  ensureDefaultCircuits: () => {
    const { project } = get();
    if (project.circuits.length > 0) return;
    const now = Date.now();
    const panelId = project.panels[0]?.id || `pan-${now}`;
    const newPanels: Panel[] = project.panels.length > 0 ? project.panels : [
      {
        id: panelId,
        name: 'Tablero Seccional General (TSG)',
        type: 'principal',
        levelId: project.activeLevelId,
        spaceId: 'espacio-principal',
        elementId: '',
        isThreePhase: false,
        mainBreakerAmperageA: 32,
        mainDifferentialAmperageA: 40
      }
    ];
    const newCircuits: Circuit[] = [
      {
        id: `circ-${now}-1`,
        panelId,
        name: 'C1 - IUG (Iluminación)',
        type: 'IUG',
        voltageV: 220,
        wireSectionBaseMM2: 1.5,
        breakerAmperageA: 10,
        color: '#2563eb',
        description: 'Circuito de Iluminación Uso General'
      },
      {
        id: `circ-${now}-2`,
        panelId,
        name: 'C2 - TUG (Tomacorrientes)',
        type: 'TUG',
        voltageV: 220,
        wireSectionBaseMM2: 2.5,
        breakerAmperageA: 16,
        color: '#ea580c',
        description: 'Circuito de Tomas de Uso General'
      },
      {
        id: `circ-${now}-3`,
        panelId,
        name: 'C3 - TUE (Tomas Especiales)',
        type: 'TUE',
        voltageV: 220,
        wireSectionBaseMM2: 2.5,
        breakerAmperageA: 20,
        color: '#16a34a',
        description: 'Circuito de Tomas de Uso Especial'
      }
    ];
    set((state) => ({
      project: {
        ...state.project,
        panels: newPanels,
        circuits: newCircuits,
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    }));
  },

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
    }),

  addDimensionLine: (dimension) =>
    set((state) => ({
      project: {
        ...state.project,
        dimensions: [...(state.project.dimensions || []), dimension],
        meta: { ...state.project.meta, updatedAt: Date.now() }
      },
      selectedEntity: { type: 'dimension', id: dimension.id }
    })),

  updateDimensionLine: (dimensionId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        dimensions: (state.project.dimensions || []).map((d) =>
          d.id === dimensionId ? { ...d, ...updates } : d
        ),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  deleteDimensionLine: (dimensionId) =>
    set((state) => ({
      project: {
        ...state.project,
        dimensions: (state.project.dimensions || []).filter((d) => d.id !== dimensionId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      },
      selectedEntity: state.selectedEntity?.id === dimensionId ? null : state.selectedEntity
    })),

  loadProject: (project) =>
    set({
      project: {
        ...project,
        materialCatalog: project.materialCatalog || createDefaultMaterialCatalog(),
        underlaySheets: project.underlaySheets || {},
        dimensions: project.dimensions || []
      },
      selectedEntity: null,
      activeAnchorVertexId: null
    }),

  resetProject: () => set({ project: createEmptyProject(), selectedEntity: null, activeAnchorVertexId: null })
}));
