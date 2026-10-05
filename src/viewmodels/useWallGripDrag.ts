/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useWallGripDrag.ts
 * Hook reactivo para gestión de Arrastre de Extremos de Muro (CAD Smart Grips).
 * Orquesta PointerEvents (Mouse y Touch), cálculo de Snap, Smart Guides,
 * offset táctil y confirmación atómica en useProjectStore.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from './useProjectStore';
import { findWallDragSnap, type WallSnapResult } from '../models/architecture/WallSnapEngine';
import type { Vector2D } from '../models/architecture/Wall';

export interface ActiveWallDragState {
  wallId: string;
  draggedVertexId: string;
  draggedEnd: 'start' | 'end';
  fixedVertexPos: Vector2D;
  oldLength: number;
  pointerType: string;
}

export function useWallGripDrag(params: {
  zoom: number;
  panOffset: { x: number; y: number };
  containerRect?: DOMRect | null;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { zoom, panOffset, containerRef } = params;

  const {
    project,
    updateVertexPosition,
    splitSharedVertexForWall,
    commitWallVertexDrag,
    setSelectedEntity
  } = useProjectStore();

  const [activeDrag, setActiveDrag] = useState<ActiveWallDragState | null>(null);
  const [activeSnapResult, setActiveSnapResult] = useState<WallSnapResult | null>(null);

  const activeDragRef = useRef<ActiveWallDragState | null>(null);
  const snapResultRef = useRef<WallSnapResult | null>(null);

  useEffect(() => {
    activeDragRef.current = activeDrag;
  }, [activeDrag]);

  useEffect(() => {
    snapResultRef.current = activeSnapResult;
  }, [activeSnapResult]);

  /**
   * Inicia el arrastre de una manija de extremo de muro (vStart o vEnd).
   */
  const handleGripPointerDown = useCallback(
    (
      e: React.PointerEvent,
      wallId: string,
      draggedEnd: 'start' | 'end',
      vertexId: string
    ) => {
      e.stopPropagation();
      e.preventDefault();

      setSelectedEntity({ type: 'wall', id: wallId });

      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Fallback silencioso en entornos de prueba o navegadores antiguos
      }

      const wall = project.walls.find((w) => w.id === wallId);
      if (!wall) return;

      const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
      const vStart = verticesMap.get(wall.startVertexId);
      const vEnd = verticesMap.get(wall.endVertexId);
      if (!vStart || !vEnd) return;

      const oldLength = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
      const fixedVertexPos = draggedEnd === 'start' ? { x: vEnd.x, y: vEnd.y } : { x: vStart.x, y: vStart.y };

      // Si el extremo es compartido, independizarlo para permitir libertad en tramos comunes
      const actualVertexId = splitSharedVertexForWall(wallId, vertexId);

      const state: ActiveWallDragState = {
        wallId,
        draggedVertexId: actualVertexId,
        draggedEnd,
        fixedVertexPos,
        oldLength,
        pointerType: e.pointerType || 'mouse'
      };

      activeDragRef.current = state;
      snapResultRef.current = null;
      setActiveDrag(state);
      setActiveSnapResult(null);
    },
    [project.walls, project.vertices, splitSharedVertexForWall, setSelectedEntity]
  );

  /**
   * Procesa el movimiento del puntero, aplicando offset táctil si es touch y evaluando el snap.
   */
  const handleGripPointerMove = useCallback(
    (e: React.PointerEvent, containerElement?: HTMLElement | null) => {
      const drag = activeDragRef.current;
      const targetContainer = containerElement || containerRef?.current;
      if (!drag || !targetContainer) return;

      e.stopPropagation();
      e.preventDefault();

      const rect = targetContainer.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;

      // En dispositivos touch (dedo), elevar el punto 28px para que la yema no tape el vértice
      if (drag.pointerType === 'touch') {
        clientY -= 28;
      }

      // Convertir coordenadas de pantalla a coordenadas del mundo (metros)
      const worldX = (clientX - rect.left - panOffset.x) / zoom;
      const worldY = (clientY - rect.top - panOffset.y) / zoom;
      const rawPoint: Vector2D = { x: worldX, y: worldY };

      // Evaluar snap magnético (vértices, empalmes en T, smart guides, polar)
      const snapResult = findWallDragSnap({
        point: rawPoint,
        fixedPoint: drag.fixedVertexPos,
        draggedWallId: drag.wallId,
        draggedVertexId: drag.draggedVertexId,
        allWalls: project.walls.filter((w) => w.levelId === project.activeLevelId),
        allVertices: project.vertices
      });

      snapResultRef.current = snapResult;
      setActiveSnapResult(snapResult);

      // Actualizar posición en tiempo real para render fluido a 60 fps
      updateVertexPosition(drag.draggedVertexId, snapResult.snappedPoint);
    },
    [zoom, panOffset, project.walls, project.vertices, project.activeLevelId, updateVertexPosition, containerRef]
  );

  /**
   * Finaliza el arrastre consolidando los cambios de forma atómica en el store.
   */
  const handleGripPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = activeDragRef.current;
      if (!drag) return;

      e.stopPropagation();
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }

      const snap = snapResultRef.current;
      const finalPos = snap ? snap.snappedPoint : drag.fixedVertexPos;
      const mergeWithVertexId = snap?.targetType === 'vertex' ? snap.targetVertexId : undefined;

      // Si encajó con éxito en un vértice o muro, disparar micro-vibración háptica
      if (snap && snap.targetType !== 'none' && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }

      commitWallVertexDrag({
        wallId: drag.wallId,
        draggedVertexId: drag.draggedVertexId,
        newPos: finalPos,
        mergeWithVertexId,
        draggedEnd: drag.draggedEnd,
        oldLength: drag.oldLength
      });

      setActiveDrag(null);
      setActiveSnapResult(null);
    },
    [commitWallVertexDrag]
  );

  return {
    activeDrag,
    activeSnapResult,
    handleGripPointerDown,
    handleGripPointerMove,
    handleGripPointerUp
  };
}
