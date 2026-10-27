/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL STORE SLICE: architectureSlice.ts
 * Responsabilidad Única (SRP):
 * Operaciones de dominio arquitectónico, geométrico y estructural:
 * trazado y edición de muros/vértices, aberturas, columnas, vigas,
 * autodetección planar de ambientes (`findEnclosedCycles`) y cotas libres.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Wall, WallVertex, Vector2D, WallJustification } from '../../models/architecture/Wall';
import {
  getWallVector,
  getWallLength,
  getWallLeftNormal,
  getWallSideOffsets,
  calculateVisibleFaceCompensation
} from '../../models/architecture/Wall';
import { ARCHITECTURAL_WALL_CONFIG } from '../../config/architecturalConfig';
import type { Opening } from '../../models/architecture/Opening';
import type { Space } from '../../models/architecture/Space';
import { findEnclosedCycles } from '../../models/architecture/Space';
import { translateSpace } from '../../models/architecture/SpaceMoveEngine';
import { adjustOpeningOnWallResize } from '../../models/architecture/WallSnapEngine';
import type { StructuralColumn, StructuralBeam } from '../../models/architecture/StructuralElement';
import {
  generateUniqueId,
  type ArchitectureSlice,
  type StoreGet,
  type StoreSet
} from './storeTypes';

export function createArchitectureSlice(set: StoreSet, get: StoreGet): ArchitectureSlice {
  return {
    addWallFromAnchor: ({
      startVertexId,
      startCoord,
      lengthM,
      angleDeg,
      thickness = ARCHITECTURAL_WALL_CONFIG.DEFAULT_THICKNESS_M,
      justification = 'interior',
      referenceOrigin = 'visible_face',
      measurementReference
    }) => {
      const { project } = get();
      if (lengthM <= 0) return null;

      let vStart: WallVertex | undefined;

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

      const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

      // Muro anfitrión existente en el vértice de anclaje
      let hostWall: Wall | undefined;
      if (startVertexId) {
        const selectedId = get().selectedEntity?.id;
        if (selectedId) {
          hostWall = project.walls.find(
            (w) =>
              w.id === selectedId &&
              (w.endVertexId === startVertexId || w.startVertexId === startVertexId)
          );
        }
        if (!hostWall) {
          const incidentWalls = project.walls.filter(
            (w) => w.endVertexId === startVertexId || w.startVertexId === startVertexId
          );
          hostWall = incidentWalls.find((w) => w.endVertexId === startVertexId) || incidentWalls[0];
        }
      }

      // La justificación física de la pared derivada se alinea con el muro anfitrión
      // para garantizar un empalme en esquina limpio, enrasado y sin desplazamientos laterales erróneos.
      const physicalJustification: WallJustification = hostWall
        ? (hostWall.justification ?? 'interior')
        : (justification ?? 'interior');

      // Compensación métrica según la referencia de medida seleccionada ('interior' | 'center' | 'exterior')
      let effectiveLengthM = lengthM;
      if (startVertexId && hostWall) {
        const measRef: WallJustification =
          measurementReference ||
          (referenceOrigin === 'center' || referenceOrigin === 'axis'
            ? 'center'
            : referenceOrigin === 'exterior'
            ? 'exterior'
            : referenceOrigin === 'interior' || referenceOrigin === 'visible_face'
            ? 'interior'
            : (justification as WallJustification) || 'interior');

        const compensation = calculateVisibleFaceCompensation({
          hostWall,
          anchorVertexId: startVertexId,
          targetAngleDeg: angleDeg,
          measurementReference: measRef,
          verticesMap
        });
        effectiveLengthM = Number((lengthM + compensation).toFixed(3));
      }

      const rad = (angleDeg * Math.PI) / 180;
      const targetEndX = vStart.x + Math.cos(rad) * effectiveLengthM;
      const targetEndY = vStart.y + Math.sin(rad) * effectiveLengthM;

      const SNAP_TOLERANCE = 0.2;
      let vEnd = project.vertices.find(
        (v) =>
          v.id !== vStart?.id && Math.hypot(v.x - targetEndX, v.y - targetEndY) <= SNAP_TOLERANCE
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

      const newWall: Wall = {
        id: generateUniqueId('w'),
        levelId: project.activeLevelId,
        startVertexId: vStart.id,
        endVertexId: vEnd.id,
        thickness,
        height: 2.8,
        justification: physicalJustification
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
      thickness = 0.15,
      justification = 'interior'
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

      const uWall = { x: wallVec.x / wallLen, y: wallVec.y / wallLen };
      const leftNormal = getWallLeftNormal(hostWall, verticesMap);
      const uBranch = side === 'left' ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };

      const isFromStart = referenceVertexId === hostWall.startVertexId;
      const rootPoint: Vector2D = isFromStart
        ? { x: vStart.x + uWall.x * offsetM, y: vStart.y + uWall.y * offsetM }
        : { x: vEnd.x - uWall.x * offsetM, y: vEnd.y - uWall.y * offsetM };

      // Para un empalme en T, compensar la luz libre desde la cara vista del muro anfitrión
      const { leftOffset, rightOffset } = getWallSideOffsets(hostWall);
      const faceOffsetM = side === 'left' ? Math.max(0, leftOffset) : Math.abs(Math.min(0, rightOffset));
      const effectiveBranchLengthM = Number((branchLengthM + faceOffsetM).toFixed(3));

      const endPoint: Vector2D = {
        x: rootPoint.x + uBranch.x * effectiveBranchLengthM,
        y: rootPoint.y + uBranch.y * effectiveBranchLengthM
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
        height: hostWall.height,
        justification: hostWall.justification ?? justification ?? 'interior'
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

      get().autoDetectSpaces();

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

      const isFromStart = referenceVertexId === hostWall.startVertexId;
      const distanceAlongWall = isFromStart
        ? offsetToJambM
        : Math.max(0, wallLen - offsetToJambM - widthM);

      const newOpening: Opening = {
        id: generateUniqueId('open'),
        wallId: hostWall.id,
        type,
        width: widthM,
        height: type === 'door' ? 2.05 : 1.1,
        sill: type === 'door' ? 0.0 : 0.9,
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

    addOpeningDirect: (params) => {
      const { project } = get();
      const hostWall = project.walls.find((w) => w.id === params.wallId);
      if (!hostWall || params.width <= 0) return null;

      const newOpening: Opening = {
        id: generateUniqueId('open'),
        wallId: hostWall.id,
        type: params.type,
        width: params.width,
        height: params.height,
        sill: params.sill,
        distanceAlongWall: Number(params.distanceAlongWall.toFixed(3)),
        swing: params.swing ?? (params.type === 'door' ? 'left_in' : 'sliding'),
        label:
          params.label ||
          (params.type === 'door' ? 'P' : params.type === 'window' ? 'V' : 'Paso'),
        presetId: params.presetId
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

    batchUpdateWalls: (wallIds, updates) => {
      if (wallIds.length === 0 || Object.keys(updates).length === 0) return;
      const targetIds = new Set(wallIds);
      set((state) => ({
        project: {
          ...state.project,
          walls: state.project.walls.map((w) =>
            targetIds.has(w.id) ? { ...w, ...updates } : w
          ),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      }));
    },

    batchUpdateWallLengths: (wallIds, targetLengthM, mode = 'absolute') => {
      if (wallIds.length === 0) return;
      const { project } = get();
      const verticesMap = new Map(project.vertices.map((v) => [v.id, { ...v }]));
      let updatedOpenings = [...project.openings];

      for (const wallId of wallIds) {
        const wall = project.walls.find((w) => w.id === wallId);
        if (!wall) continue;

        const vStart = verticesMap.get(wall.startVertexId);
        const vEnd = verticesMap.get(wall.endVertexId);
        if (!vStart || !vEnd) continue;

        const currentDx = vEnd.x - vStart.x;
        const currentDy = vEnd.y - vStart.y;
        const currentLen = Math.hypot(currentDx, currentDy);
        if (currentLen === 0) continue;

        const newLength =
          mode === 'delta'
            ? Math.max(0.10, currentLen + targetLengthM)
            : targetLengthM;

        if (newLength <= 0) continue;

        const ratio = newLength / currentLen;
        const newEndX = Number((vStart.x + currentDx * ratio).toFixed(3));
        const newEndY = Number((vStart.y + currentDy * ratio).toFixed(3));

        vEnd.x = newEndX;
        vEnd.y = newEndY;

        updatedOpenings = updatedOpenings.map((op) => {
          if (op.wallId !== wallId) return op;
          const adjustedDistance = adjustOpeningOnWallResize({
            opening: op,
            draggedEnd: 'end',
            oldLength: currentLen,
            newLength
          });
          return { ...op, distanceAlongWall: adjustedDistance };
        });
      }

      const updatedVertices = project.vertices.map((v) => {
        const mod = verticesMap.get(v.id);
        return mod ? { ...v, x: mod.x, y: mod.y } : v;
      });

      set({
        project: {
          ...project,
          vertices: updatedVertices,
          openings: updatedOpenings,
          meta: { ...project.meta, updatedAt: Date.now() }
        }
      });

      get().autoDetectSpaces();
    },

    batchDeleteWalls: (wallIds) => {
      if (wallIds.length === 0) return;
      const targetIds = new Set(wallIds);
      set((state) => {
        const remainingWalls = state.project.walls.filter((w) => !targetIds.has(w.id));
        const usedVertexIds = new Set<string>();
        remainingWalls.forEach((w) => {
          usedVertexIds.add(w.startVertexId);
          usedVertexIds.add(w.endVertexId);
        });
        const remainingVertices = state.project.vertices.filter((v) => usedVertexIds.has(v.id));
        const remainingOpenings = state.project.openings.filter((op) => !targetIds.has(op.wallId));
        return {
          project: {
            ...state.project,
            walls: remainingWalls,
            vertices: remainingVertices,
            openings: remainingOpenings,
            meta: { ...state.project.meta, updatedAt: Date.now() }
          },
          selectedEntities: state.selectedEntities.filter((e) => !targetIds.has(e.id)),
          selectedEntity:
            state.selectedEntity && targetIds.has(state.selectedEntity.id)
              ? null
              : state.selectedEntity
        };
      });
      get().autoDetectSpaces();
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
            v.id === vEnd.id
              ? { ...v, x: Number(newEndX.toFixed(3)), y: Number(newEndY.toFixed(3)) }
              : v
          ),
          meta: { ...project.meta, updatedAt: Date.now() }
        }
      });
      get().autoDetectSpaces();
    },

    updateVertexPosition: (vertexId, newPos) => {
      set((state) => ({
        project: {
          ...state.project,
          vertices: state.project.vertices.map((v) =>
            v.id === vertexId
              ? { ...v, x: Number(newPos.x.toFixed(3)), y: Number(newPos.y.toFixed(3)) }
              : v
          ),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      }));
    },

    splitSharedVertexForWall: (wallId, vertexId) => {
      const { project } = get();
      const wall = project.walls.find((w) => w.id === wallId);
      if (!wall) return vertexId;

      const sharingWalls = project.walls.filter(
        (w) => w.startVertexId === vertexId || w.endVertexId === vertexId
      );

      if (sharingWalls.length <= 1) return vertexId;

      const oldVertex = project.vertices.find((v) => v.id === vertexId);
      if (!oldVertex) return vertexId;

      const newVertexId = `vert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newVertex: WallVertex = {
        id: newVertexId,
        x: oldVertex.x,
        y: oldVertex.y
      };

      const isStart = wall.startVertexId === vertexId;
      const updatedWalls = project.walls.map((w) =>
        w.id === wallId
          ? {
              ...w,
              startVertexId: isStart ? newVertexId : w.startVertexId,
              endVertexId: !isStart ? newVertexId : w.endVertexId
            }
          : w
      );

      set({
        project: {
          ...project,
          vertices: [...project.vertices, newVertex],
          walls: updatedWalls,
          meta: { ...project.meta, updatedAt: Date.now() }
        }
      });

      return newVertexId;
    },

    commitWallVertexDrag: ({
      wallId,
      draggedVertexId,
      newPos,
      mergeWithVertexId,
      draggedEnd,
      oldLength
    }) => {
      const { project } = get();
      const wall = project.walls.find((w) => w.id === wallId);
      if (!wall) return;

      let updatedVertices = [...project.vertices];
      let updatedWalls = [...project.walls];

      if (mergeWithVertexId && mergeWithVertexId !== draggedVertexId) {
        updatedWalls = updatedWalls.map((w) => {
          if (w.id === wallId) {
            return {
              ...w,
              startVertexId: draggedEnd === 'start' ? mergeWithVertexId : w.startVertexId,
              endVertexId: draggedEnd === 'end' ? mergeWithVertexId : w.endVertexId
            };
          }
          return w;
        });

        const isOldVertexUsed = updatedWalls.some(
          (w) => w.startVertexId === draggedVertexId || w.endVertexId === draggedVertexId
        );
        if (!isOldVertexUsed) {
          updatedVertices = updatedVertices.filter((v) => v.id !== draggedVertexId);
        }
      } else {
        updatedVertices = updatedVertices.map((v) =>
          v.id === draggedVertexId
            ? { ...v, x: Number(newPos.x.toFixed(3)), y: Number(newPos.y.toFixed(3)) }
            : v
        );
      }

      const verticesMap = new Map(updatedVertices.map((v) => [v.id, v]));
      const updatedWall = updatedWalls.find((w) => w.id === wallId);
      let newLength = oldLength;
      if (updatedWall) {
        const vStart = verticesMap.get(updatedWall.startVertexId);
        const vEnd = verticesMap.get(updatedWall.endVertexId);
        if (vStart && vEnd) {
          newLength = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
        }
      }

      const updatedOpenings = project.openings.map((op) => {
        if (op.wallId !== wallId) return op;
        const adjustedDistance = adjustOpeningOnWallResize({
          opening: op,
          draggedEnd,
          oldLength,
          newLength
        });
        return { ...op, distanceAlongWall: adjustedDistance };
      });

      set({
        project: {
          ...project,
          vertices: updatedVertices,
          walls: updatedWalls,
          openings: updatedOpenings,
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
            v.id === vEnd.id
              ? { ...v, x: Number(newEndX.toFixed(3)), y: Number(newEndY.toFixed(3)) }
              : v
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

      const isStartUsed = remainingWalls.some(
        (w) =>
          w.startVertexId === targetWall.startVertexId || w.endVertexId === targetWall.startVertexId
      );
      const isEndUsed = remainingWalls.some(
        (w) => w.startVertexId === targetWall.endVertexId || w.endVertexId === targetWall.endVertexId
      );

      let updatedVertices = project.vertices;
      if (!isStartUsed) {
        updatedVertices = updatedVertices.filter((v) => v.id !== targetWall.startVertexId);
      }
      if (!isEndUsed) {
        updatedVertices = updatedVertices.filter((v) => v.id !== targetWall.endVertexId);
      }

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
      const { undoStack, undo } = get();
      if (undoStack && undoStack.length > 0) {
        undo();
        return;
      }

      const { project } = get();
      if (project.walls.length === 0) return;

      const lastWall = project.walls[project.walls.length - 1];
      const remainingWalls = project.walls.slice(0, -1);

      const isEndUsedElsewhere = remainingWalls.some(
        (w) => w.startVertexId === lastWall.endVertexId || w.endVertexId === lastWall.endVertexId
      );
      const isStartUsedElsewhere = remainingWalls.some(
        (w) =>
          w.startVertexId === lastWall.startVertexId || w.endVertexId === lastWall.startVertexId
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
          openings: state.project.openings.map((o) =>
            o.id === openingId ? { ...o, ...updates } : o
          ),
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

    addColumn: (col) => {
      const id = generateUniqueId('col');
      const newCol: StructuralColumn = { ...col, id };
      set((state) => ({
        project: {
          ...state.project,
          columns: [...(state.project.columns || []), newCol],
          meta: { ...state.project.meta, updatedAt: Date.now() }
        },
        selectedEntity: { type: 'column', id }
      }));
      return id;
    },

    updateColumn: (columnId, updates) =>
      set((state) => ({
        project: {
          ...state.project,
          columns: (state.project.columns || []).map((c) =>
            c.id === columnId ? { ...c, ...updates } : c
          ),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    deleteColumn: (columnId) =>
      set((state) => ({
        project: {
          ...state.project,
          columns: (state.project.columns || []).filter((c) => c.id !== columnId),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        },
        selectedEntity: state.selectedEntity?.id === columnId ? null : state.selectedEntity
      })),

    addBeam: (beam) => {
      const id = generateUniqueId('beam');
      const newBeam: StructuralBeam = { ...beam, id };
      set((state) => ({
        project: {
          ...state.project,
          beams: [...(state.project.beams || []), newBeam],
          meta: { ...state.project.meta, updatedAt: Date.now() }
        },
        selectedEntity: { type: 'beam', id }
      }));
      return id;
    },

    updateBeam: (beamId, updates) =>
      set((state) => ({
        project: {
          ...state.project,
          beams: (state.project.beams || []).map((b) =>
            b.id === beamId ? { ...b, ...updates } : b
          ),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        }
      })),

    deleteBeam: (beamId) =>
      set((state) => ({
        project: {
          ...state.project,
          beams: (state.project.beams || []).filter((b) => b.id !== beamId),
          meta: { ...state.project.meta, updatedAt: Date.now() }
        },
        selectedEntity: state.selectedEntity?.id === beamId ? null : state.selectedEntity
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

      // Si se detectaron nuevos nodos de corte o empalme en T, sincronizarlos en project.vertices
      const newVertices: WallVertex[] = [];
      for (const [id, coord] of verticesMap.entries()) {
        if (!project.vertices.some((v) => v.id === id)) {
          newVertices.push({ id, x: coord.x, y: coord.y });
        }
      }

      const otherLevelSpaces = project.spaces.filter((s) => s.levelId !== project.activeLevelId);

      const newSpacesInLevel: Space[] = cycles.map((c, idx) => {
        // 1. Coincidencia exacta de vértices perimetrales
        let existing = project.spaces.find(
          (s) =>
            s.levelId === project.activeLevelId &&
            s.boundaryVertexIds.length === c.vertexIds.length &&
            c.vertexIds.every((id) => s.boundaryVertexIds.includes(id))
        );

        // 2. Coincidencia por mayoría de vértices compartidos (>= 60% de superposición) para preservar
        // el nombre y propiedades si un muro compartido fue subdividido al empalmar otro recinto
        if (!existing) {
          existing = project.spaces.find((s) => {
            if (s.levelId !== project.activeLevelId) return false;
            const shared = c.vertexIds.filter((id) => s.boundaryVertexIds.includes(id)).length;
            const maxLen = Math.max(s.boundaryVertexIds.length, c.vertexIds.length);
            return shared / maxLen >= 0.6;
          });
        }

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
          ceilingHeight: 2.7,
          floorElevation: 0.0,
          boundaryVertexIds: c.vertexIds,
          wallIds: c.wallIds
        };
      });

      set({
        project: {
          ...project,
          vertices: newVertices.length > 0 ? [...project.vertices, ...newVertices] : project.vertices,
          spaces: [...otherLevelSpaces, ...newSpacesInLevel]
        },
        _skipHistory: true
      });
    },

    moveSpace: (spaceId, delta) =>
      set((state) => ({
        project: translateSpace({ spaceId, delta, project: state.project })
      })),

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
      }))
  };
}
