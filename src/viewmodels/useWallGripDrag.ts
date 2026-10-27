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
import { CAD_WALL_STYLES } from '../config/appCadConfig';

export interface ActiveWallDragState {
  wallId: string;
  draggedVertexId: string;
  draggedEnd: 'start' | 'end';
  fixedVertexPos: Vector2D;
  oldLength: number;
  pointerType: string;
  touchClientPos?: { x: number; y: number };
  currentPointWorld?: Vector2D;
  currentLengthM?: number;
  currentAngleDeg?: number;
  snapLabel?: string;
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
  const [isOrthoMode, setIsOrthoMode] = useState(false);
  const toggleOrthoMode = useCallback(() => setIsOrthoMode((v) => !v), []);

  const activeDragRef = useRef<ActiveWallDragState | null>(null);
  const snapResultRef = useRef<WallSnapResult | null>(null);
  const lastSnapTypeRef = useRef<string>('none');

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
      const currentPos = draggedEnd === 'start' ? { x: vStart.x, y: vStart.y } : { x: vEnd.x, y: vEnd.y };

      // Si el extremo es compartido, independizarlo para permitir libertad en tramos comunes
      const actualVertexId = splitSharedVertexForWall(wallId, vertexId);

      const state: ActiveWallDragState = {
        wallId,
        draggedVertexId: actualVertexId,
        draggedEnd,
        fixedVertexPos,
        oldLength,
        pointerType: e.pointerType || 'mouse',
        touchClientPos: { x: e.clientX, y: e.clientY },
        currentPointWorld: currentPos,
        currentLengthM: oldLength,
        currentAngleDeg: 0
      };

      activeDragRef.current = state;
      snapResultRef.current = null;
      lastSnapTypeRef.current = 'none';
      setActiveDrag(state);
      setActiveSnapResult(null);
    },
    [project.walls, project.vertices, splitSharedVertexForWall, setSelectedEntity]
  );

  /**
   * Procesa el movimiento del puntero, aplicando offset ergonómico táctil y evaluando el snap.
   */
  const handleGripPointerMove = useCallback(
    (e: React.PointerEvent, containerElement?: HTMLElement | null) => {
      const drag = activeDragRef.current;
      const targetContainer = containerElement || containerRef?.current;
      if (!drag || !targetContainer) return;

      e.stopPropagation();
      e.preventDefault();

      const rect = targetContainer.getBoundingClientRect();
      const rawTouchX = e.clientX;
      const rawTouchY = e.clientY;
      let targetClientX = rawTouchX;
      let targetClientY = rawTouchY;

      // En dispositivos touch (dedo), elevamos el punto métrico para que la yema no tape el vértice
      if (drag.pointerType === 'touch') {
        targetClientY -= CAD_WALL_STYLES.gripTouchElevationOffsetPx;
      }

      // Convertir coordenadas de pantalla a coordenadas del mundo (metros)
      const worldX = (targetClientX - rect.left - panOffset.x) / zoom;
      const worldY = (targetClientY - rect.top - panOffset.y) / zoom;
      const rawPoint: Vector2D = { x: worldX, y: worldY };

      const isShift = 'shiftKey' in e ? Boolean((e as React.PointerEvent).shiftKey) : false;
      const effectiveOrtho = isOrthoMode || isShift;

      // Evaluar snap magnético (vértices, empalmes en T, smart guides, polar/orto)
      const snapResult = findWallDragSnap({
        point: rawPoint,
        fixedPoint: drag.fixedVertexPos,
        draggedWallId: drag.wallId,
        draggedVertexId: drag.draggedVertexId,
        allWalls: project.walls.filter((w) => w.levelId === project.activeLevelId),
        allVertices: project.vertices,
        options: {
          orthoMode: effectiveOrtho
        }
      });

      const snapped = snapResult.snappedPoint;
      const dx = snapped.x - drag.fixedVertexPos.x;
      const dy = snapped.y - drag.fixedVertexPos.y;
      const currentLengthM = Math.hypot(dx, dy);
      let currentAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (currentAngleDeg < 0) currentAngleDeg += 360;

      let snapLabel: string | undefined;
      if (snapResult.targetType === 'vertex') snapLabel = 'Empalme Vértice';
      else if (snapResult.targetType === 'wall_slide') snapLabel = 'Deslizar en Muro';
      else if (snapResult.targetType === 'smart_guide') snapLabel = 'Guía Inteligente';
      else if (snapResult.targetType === 'polar_angle') snapLabel = 'Ángulo Orto/Polar';
      else if (snapResult.targetType === 'grid') snapLabel = 'Grilla';

      // Feedback háptico en tiempo real al entrar en una zona de snap magnético
      if (
        snapResult.targetType !== 'none' &&
        lastSnapTypeRef.current !== snapResult.targetType &&
        typeof navigator !== 'undefined' &&
        navigator.vibrate
      ) {
        navigator.vibrate(8);
      }
      lastSnapTypeRef.current = snapResult.targetType;

      snapResultRef.current = snapResult;
      setActiveSnapResult(snapResult);

      setActiveDrag((prev) =>
        prev
          ? {
              ...prev,
              touchClientPos: { x: rawTouchX, y: rawTouchY },
              currentPointWorld: snapped,
              currentLengthM,
              currentAngleDeg,
              snapLabel
            }
          : null
      );

      // Actualizar posición en tiempo real para render fluido a 60 fps
      updateVertexPosition(drag.draggedVertexId, snapResult.snappedPoint);
    },
    [zoom, panOffset, project.walls, project.vertices, project.activeLevelId, updateVertexPosition, containerRef, isOrthoMode]
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

      // Si encajó con éxito en un vértice o muro, disparar micro-vibración háptica final
      if (snap && snap.targetType !== 'none' && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }

      commitWallVertexDrag({
        wallId: drag.wallId,
        draggedVertexId: drag.draggedVertexId,
        newPos: finalPos,
        mergeWithVertexId,
        draggedEnd: drag.draggedEnd,
        oldLength: drag.oldLength
      });

      lastSnapTypeRef.current = 'none';
      setActiveDrag(null);
      setActiveSnapResult(null);
    },
    [commitWallVertexDrag]
  );

  // Listener global de ventana durante arrastre para evitar que pérdidas de captura en táctil interrumpan el gesto
  useEffect(() => {
    if (!activeDrag) return;
    const onWindowPointerMove = (e: PointerEvent) => {
      handleGripPointerMove(e as unknown as React.PointerEvent);
    };
    const onWindowPointerUp = (e: PointerEvent) => {
      handleGripPointerUp(e as unknown as React.PointerEvent);
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [activeDrag, handleGripPointerMove, handleGripPointerUp]);

  return {
    activeDrag,
    activeSnapResult,
    isOrthoMode,
    setIsOrthoMode,
    toggleOrthoMode,
    handleGripPointerDown,
    handleGripPointerMove,
    handleGripPointerUp
  };
}
