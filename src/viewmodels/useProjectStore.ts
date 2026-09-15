/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useProjectStore.ts
 * Estado Global del Proyecto BIM y Operaciones CRUD de Arquitectura e Instalación.
 * Patrón MVVM: Expone estado observable y comandos a la vista.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import type { BuildingProject } from '../models/architecture/BuildingProject';
import { createEmptyProject } from '../models/architecture/BuildingProject';
import type { Opening } from '../models/architecture/Opening';
import type { ElectricalElement, Conduit } from '../models/electrical/ElectricalModel';
import { solveRectangularSpace, solveSpaceFromDoorJamb, solveTeeWallBranch } from '../models/surveying/RelativeSolver';

export interface SelectedEntity {
  type: 'wall' | 'opening' | 'space' | 'electrical_element' | 'conduit';
  id: string;
}

interface ProjectStoreState {
  project: BuildingProject;
  selectedEntity: SelectedEntity | null;
  activeSpaceId: string | null;

  // Acciones de Selección y Navegación
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setActiveLevel: (levelId: string) => void;
  setActiveSpace: (spaceId: string | null) => void;

  // Acciones de Relevamiento Arquitectónico BIM
  createInitialRoom: (params: {
    name: string;
    width: number;
    length: number;
    wallThickness?: number;
    ceilingHeight?: number;
  }) => void;

  linkNewRoomFromDoor: (params: {
    hostWallId: string;
    openingId: string;
    distanceCornerToJamb: number;
    whichJamb: 1 | 2;
    side: 'left' | 'right';
    newRoomWidth: number;
    newRoomDepth: number;
    name: string;
    category?: any;
  }) => boolean;

  createTeeWallBranch: (params: {
    hostWallId: string;
    offsetFromStart: number;
    branchLength: number;
    side: 'left' | 'right';
    thickness?: number;
  }) => boolean;

  updateWallLength: (wallId: string, newLengthM: number) => void;
  addOpening: (opening: Opening) => void;
  updateOpening: (openingId: string, updates: Partial<Opening>) => void;
  deleteOpening: (openingId: string) => void;

  // Acciones Electromecánicas
  addElectricalElement: (element: ElectricalElement) => void;
  updateElectricalElement: (elementId: string, updates: Partial<ElectricalElement>) => void;
  deleteElectricalElement: (elementId: string) => void;

  addConduit: (conduit: Conduit) => void;
  deleteConduit: (conduitId: string) => void;

  // Inicialización / Carga
  loadProject: (project: BuildingProject) => void;
  resetProject: () => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: createEmptyProject(),
  selectedEntity: null,
  activeSpaceId: null,

  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  setActiveLevel: (levelId) =>
    set((state) => ({
      project: { ...state.project, activeLevelId: levelId },
      selectedEntity: null
    })),

  setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId }),

  createInitialRoom: ({ name, width, length, wallThickness = 0.15, ceilingHeight = 2.70 }) => {
    const { project } = get();
    const result = solveRectangularSpace({
      origin: { x: 2.0, y: 2.0 }, // Margen inicial en el canvas
      width,
      length,
      wallThickness,
      ceilingHeight,
      levelId: project.activeLevelId,
      name,
      category: 'living',
      prefixId: `amb-${Date.now()}`
    });

    set({
      project: {
        ...project,
        vertices: [...project.vertices, ...result.vertices],
        walls: [...project.walls, ...result.walls],
        spaces: [...project.spaces, result.space],
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      activeSpaceId: result.space.id
    });
  },

  linkNewRoomFromDoor: ({
    hostWallId,
    openingId,
    distanceCornerToJamb,
    whichJamb,
    side,
    newRoomWidth,
    newRoomDepth,
    name,
    category = 'dormitorio'
  }) => {
    const { project } = get();
    const hostWall = project.walls.find((w) => w.id === hostWallId);
    const opening = project.openings.find((o) => o.id === openingId);
    if (!hostWall || !opening) return false;

    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

    const result = solveSpaceFromDoorJamb({
      hostWall,
      opening,
      verticesMap,
      distanceCornerToJamb,
      whichJamb,
      side,
      newRoomWidth,
      newRoomDepth,
      wallThickness: hostWall.thickness,
      ceilingHeight: hostWall.height,
      levelId: project.activeLevelId,
      name,
      category,
      prefixId: `amb-${Date.now()}`
    });

    if (!result) return false;

    set({
      project: {
        ...project,
        vertices: [...project.vertices, ...result.vertices],
        walls: [...project.walls, ...result.walls],
        spaces: [...project.spaces, result.space],
        meta: { ...project.meta, updatedAt: Date.now() }
      },
      activeSpaceId: result.space.id
    });

    return true;
  },

  createTeeWallBranch: ({ hostWallId, offsetFromStart, branchLength, side, thickness }) => {
    const { project } = get();
    const hostWall = project.walls.find((w) => w.id === hostWallId);
    if (!hostWall) return false;

    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
    const result = solveTeeWallBranch({
      hostWall,
      verticesMap,
      offsetFromStart,
      branchLength,
      side,
      thickness,
      levelId: project.activeLevelId
    });

    if (!result) return false;

    set({
      project: {
        ...project,
        vertices: [...project.vertices, result.branchVertex, result.endVertex],
        walls: [...project.walls, result.branchWall],
        meta: { ...project.meta, updatedAt: Date.now() }
      }
    });

    return true;
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

    // Desplaza el vértice final manteniendo el ángulo de dirección
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

  addOpening: (opening) =>
    set((state) => ({
      project: {
        ...state.project,
        openings: [...state.project.openings, opening],
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

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

  deleteConduit: (conduitId) =>
    set((state) => ({
      project: {
        ...state.project,
        conduits: state.project.conduits.filter((c) => c.id !== conduitId),
        meta: { ...state.project.meta, updatedAt: Date.now() }
      }
    })),

  loadProject: (project) => set({ project, selectedEntity: null, activeSpaceId: null }),

  resetProject: () => set({ project: createEmptyProject(), selectedEntity: null, activeSpaceId: null })
}));
