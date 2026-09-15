/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useProjectStore.ts
 * Estado Global del Proyecto BIM y Operaciones CRUD de Arquitectura e Instalación.
 * Basado en Relevamiento por Puntos de Referencia Físicos (Vértices, Caras, Jambas).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import type { BuildingProject } from '../models/architecture/BuildingProject';
import { createEmptyProject } from '../models/architecture/BuildingProject';
import type { Wall, WallVertex, Vector2D } from '../models/architecture/Wall';
import { getWallVector, getWallLength, getWallLeftNormal } from '../models/architecture/Wall';
import type { Opening, OpeningType, OpeningSwing } from '../models/architecture/Opening';
import type { ElectricalElement, Conduit } from '../models/electrical/ElectricalModel';

export interface SelectedEntity {
  type: 'vertex' | 'wall' | 'opening' | 'space' | 'electrical_element' | 'conduit';
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

  updateWallLength: (wallId: string, newLengthM: number) => void;
  deleteWall: (wallId: string) => void;
  deleteOpening: (openingId: string) => void;

  // Acciones Electromecánicas
  addElectricalElement: (element: ElectricalElement) => void;
  deleteElectricalElement: (elementId: string) => void;
  addConduit: (conduit: Conduit) => void;
  deleteConduit: (conduitId: string) => void;

  // Reset y Carga
  loadProject: (project: BuildingProject) => void;
  resetProject: () => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: createEmptyProject(),
  selectedEntity: null,
  activeAnchorVertexId: null,

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
        id: `v-${Date.now()}-start`,
        x: Number(startCoord.x.toFixed(3)),
        y: Number(startCoord.y.toFixed(3))
      };
    }

    if (!vStart) return null;

    // 2. Calcular coordenada del extremo final usando trigonometría pura
    const rad = (angleDeg * Math.PI) / 180;
    const targetEndX = vStart.x + Math.cos(rad) * lengthM;
    const targetEndY = vStart.y + Math.sin(rad) * lengthM;

    // 3. Snapping magnético: ¿Cierra sobre un vértice existente cercano (tol: 12cm)?
    const SNAP_TOLERANCE = 0.12;
    let vEnd = project.vertices.find(
      (v) => v.id !== vStart?.id && Math.hypot(v.x - targetEndX, v.y - targetEndY) <= SNAP_TOLERANCE
    );

    const isNewStartVertex = !project.vertices.some((v) => v.id === vStart?.id);
    const isNewEndVertex = !vEnd;

    if (!vEnd) {
      vEnd = {
        id: `v-${Date.now()}-end`,
        x: Number(targetEndX.toFixed(3)),
        y: Number(targetEndY.toFixed(3))
      };
    }

    // 4. Crear la pared física
    const newWall: Wall = {
      id: `w-${Date.now()}`,
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
      id: `v-tee-root-${Date.now()}`,
      x: Number(rootPoint.x.toFixed(3)),
      y: Number(rootPoint.y.toFixed(3))
    };

    const branchEndVertex: WallVertex = {
      id: `v-tee-end-${Date.now()}`,
      x: Number(endPoint.x.toFixed(3)),
      y: Number(endPoint.y.toFixed(3))
    };

    const branchWall: Wall = {
      id: `w-branch-${Date.now()}`,
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
      id: `open-${Date.now()}`,
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

    const updatedVertices = project.vertices.map((v) =>
      v.id === vEnd.id ? { ...v, x: Number(newEndX.toFixed(3)), y: Number(newEndY.toFixed(3)) } : v
    );

    set({
      project: {
        ...project,
        vertices: updatedVertices,
        meta: { ...project.meta, updatedAt: Date.now() }
      }
    });
  },

  deleteWall: (wallId) =>
    set((state) => ({
      project: {
        ...state.project,
        walls: state.project.walls.filter((w) => w.id !== wallId),
        openings: state.project.openings.filter((o) => o.wallId !== wallId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      },
      selectedEntity: state.selectedEntity?.id === wallId ? null : state.selectedEntity
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

  addElectricalElement: (element) =>
    set((state) => ({
      project: {
        ...state.project,
        electricalElements: [...state.project.electricalElements, element],
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

  deleteConduit: (conduitId) =>
    set((state) => ({
      project: {
        ...state.project,
        conduits: state.project.conduits.filter((c) => c.id !== conduitId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  loadProject: (project) => set({ project, selectedEntity: null, activeAnchorVertexId: null }),

  resetProject: () => set({ project: createEmptyProject(), selectedEntity: null, activeAnchorVertexId: null })
}));
