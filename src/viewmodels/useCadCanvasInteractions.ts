/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useCadCanvasInteractions.ts
 * Responsabilidad Única (SRP):
 * Orquesta el estado de viewport (zoom, pan), los gestos de puntero/táctiles
 * (paneo, rueda, pinch-to-zoom, arrastre de recuadros SVD), la resolución de
 * snap en hover y el despacho de clics de emplazamiento sobre el lienzo CAD.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CAD_VIEWPORT_CONFIG } from '../config';
import type { Wall, WallPlacementSnap, WallVertex } from '../models/architecture/Wall';
import type { Space } from '../models/architecture/Space';
import type { UnderlaySheet } from '../models/underlay/UnderlaySheet';
import type { DetectedPatternMatch } from '../models/underlay/PatternDetector';
import type { ConduitRoutingMode } from '../models/electrical/ElectricalModel';
import {
  computeFitViewport,
  computeWheelZoomViewport,
  computePinchZoomViewport,
  computeAdjustedSampleSquareBox,
  resolveCanvasHoverSnap,
  type SampleSquareBox
} from '../models/architecture/cadViewportModel';
import type {
  ActiveNodeDragState,
  ActiveWaypointDragState,
  AdjustSampleHandle
} from '../views/components/canvas/layers/layerTypes';

export interface UseCadCanvasInteractionsParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  allVertices: ReadonlyArray<WallVertex>;
  verticesMap: Map<string, WallVertex>;
  activeLevelWalls: ReadonlyArray<Wall>;
  activeLevelSpaces: ReadonlyArray<Space>;
  selectedSymbolId?: string | null;
  isConnectingConduit: boolean;
  pendingConduitStartId: string | null;
  sequenceRoutingMode: ConduitRoutingMode;
  editingConduitRouteId: string | null;
  underlaySheet: UnderlaySheet | null;
  isCalibratingUnderlay: boolean;
  onCalibrationCanvasClick?: (worldX: number, worldY: number) => void;
  isAddingDimension: boolean;
  onDimensionCanvasClick?: (worldX: number, worldY: number) => void;
  isDrawingOverhang: boolean;
  onOverhangCanvasClick?: (worldX: number, worldY: number) => void;
  isMovingSpace: boolean;
  onMoveSpaceCanvasClick?: (worldX: number, worldY: number) => void;
  isSamplingPattern: boolean;
  patternSamplingMode: 'auto' | 'box';
  positiveExemplarsCount: number;
  onRotateStencil?: () => void;
  onPatternStencilPlaced?: (centerWorld: { x: number; y: number }) => void;
  getStencilSnapPoint?: (
    worldPos: { x: number; y: number },
    toleranceMeters?: number
  ) => { snappedPos: { x: number; y: number }; isSnapped: boolean };
  onAutoPatternSampleAtPoint?: (worldPos: { x: number; y: number }) => void;
  onPatternSampleBoxCompleted?: (p1: { x: number; y: number }, p2: { x: number; y: number }) => void;
  isAdjustingSampleBox: boolean;
  provisionalSquareBox: SampleSquareBox | null;
  onUpdateProvisionalSquareBox?: (box: SampleSquareBox) => void;
  detectedPatternMatches: ReadonlyArray<DetectedPatternMatch>;
  isArchitectureLocked: boolean;
  isSnapEnabled: boolean;
  getPlacingSnapPoint?: (
    worldPos: { x: number; y: number },
    symbolId?: string,
    isShiftBypassed?: boolean
  ) => {
    snappedPos: { x: number; y: number };
    isSnapped: boolean;
    rotationDeg: 0 | 90 | 180 | 270;
    score: number;
  };
  onCanvasClick?: (
    worldX: number,
    worldY: number,
    snapInfo?: WallPlacementSnap,
    rotationDeg?: number
  ) => void;
  onCommitConduitWithTerminalReference?: (
    targetPos: { x: number; y: number },
    targetDescription?: string
  ) => void;
}

export function useCadCanvasInteractions({
  containerRef,
  allVertices,
  verticesMap,
  activeLevelWalls,
  activeLevelSpaces,
  selectedSymbolId,
  isConnectingConduit,
  pendingConduitStartId,
  sequenceRoutingMode,
  editingConduitRouteId,
  underlaySheet,
  isCalibratingUnderlay,
  onCalibrationCanvasClick,
  isAddingDimension,
  onDimensionCanvasClick,
  isDrawingOverhang,
  onOverhangCanvasClick,
  isMovingSpace,
  onMoveSpaceCanvasClick,
  isSamplingPattern,
  patternSamplingMode,
  positiveExemplarsCount,
  onRotateStencil,
  onPatternStencilPlaced,
  getStencilSnapPoint,
  onAutoPatternSampleAtPoint,
  onPatternSampleBoxCompleted,
  isAdjustingSampleBox,
  provisionalSquareBox,
  onUpdateProvisionalSquareBox,
  detectedPatternMatches,
  isArchitectureLocked,
  isSnapEnabled,
  getPlacingSnapPoint,
  onCanvasClick,
  onCommitConduitWithTerminalReference
}: UseCadCanvasInteractionsParams) {
  const [zoom, setZoom] = useState<number>(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER);
  const [pan, setPan] = useState<{ x: number; y: number }>({ ...CAD_VIEWPORT_CONFIG.DEFAULT_PAN });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const mouseDragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const touchStateRef = useRef<{
    type: 'single' | 'pinch';
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
    pinchDist?: number;
    startZoom?: number;
    midX?: number;
    midY?: number;
  } | null>(null);

  const [hoverWorldPos, setHoverWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverRotationDeg, setHoverRotationDeg] = useState<number>(0);
  const [activeSnapInfo, setActiveSnapInfo] = useState<WallPlacementSnap | null>(null);
  const [isSnappedToCenter, setIsSnappedToCenter] = useState(false);
  const [isSnappedToPatternMatch, setIsSnappedToPatternMatch] = useState(false);
  const [samplingStartWorldPos, setSamplingStartWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [isStencilSnapped, setIsStencilSnapped] = useState(false);

  const justCompletedSamplingRef = useRef(false);
  const activeWaypointDragRef = useRef<ActiveWaypointDragState | null>(null);
  const activeNodeDragRef = useRef<ActiveNodeDragState | null>(null);
  const placementTouchRef = useRef<{
    startX: number;
    startY: number;
    lastClientX: number;
    lastClientY: number;
    moved: boolean;
  } | null>(null);
  const justPlacedSymbolRef = useRef<boolean>(false);
  const isDraggingObjectRef = useRef<boolean>(false);

  const lastDragEndTimeRef = useRef<number>(0);
  const wasDraggingRecently = () =>
    Date.now() - lastDragEndTimeRef.current < CAD_VIEWPORT_CONFIG.DRAG_RECENT_THRESHOLD_MS;
  const wasDraggingRecentlyRef = useRef(wasDraggingRecently);
  useEffect(() => {
    wasDraggingRecentlyRef.current = wasDraggingRecently;
  });

  const [activeAdjustHandle, setActiveAdjustHandle] = useState<AdjustSampleHandle>(null);
  const adjustDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initBox: SampleSquareBox;
  } | null>(null);

  const startAdjustDrag = (handle: AdjustSampleHandle, clientX: number, clientY: number) => {
    if (!provisionalSquareBox) return;
    setActiveAdjustHandle(handle);
    adjustDragStartRef.current = {
      clientX,
      clientY,
      initBox: { ...provisionalSquareBox }
    };
  };

  const handleRecenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const fit = computeFitViewport(allVertices, rect?.width || 400, rect?.height || 600);
    setZoom(fit.zoom);
    setPan(fit.pan);
  };

  // Limpiar punto inicial de muestreo al alternar el modo de muestreo
  const [prevSamplingPatternMode, setPrevSamplingPatternMode] = useState(isSamplingPattern);
  if (isSamplingPattern !== prevSamplingPatternMode) {
    setPrevSamplingPatternMode(isSamplingPattern);
    setSamplingStartWorldPos(null);
  }

  const updateHoverCoordinates = (
    clientX: number,
    clientY: number,
    isShiftPressed: boolean = false
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawWorldPos = {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };

    const snapAllowed = isSnapEnabled && !isShiftPressed;
    const underlaySnapAllowed = snapAllowed && underlaySheet !== null;

    const snapResult = resolveCanvasHoverSnap({
      rawWorldPos,
      selectedSymbolId,
      snapAllowed,
      underlaySnapAllowed,
      detectedPatternMatches,
      getPlacingSnapPoint,
      activeLevelWalls,
      activeLevelSpaces,
      allVertices,
      verticesMap,
      isSamplingPattern,
      positiveExemplarsCount,
      getStencilSnapPoint,
      isMovingSpace
    });

    setHoverWorldPos(snapResult.worldPos);
    setHoverRotationDeg(snapResult.rotationDeg);
    setActiveSnapInfo(snapResult.snapInfo);
    setIsSnappedToCenter(snapResult.isSnappedToCenter);
    setIsSnappedToPatternMatch(snapResult.isSnappedToPatternMatch);
    setIsStencilSnapped(snapResult.isStencilSnapped);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSamplingPattern && e.button === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let wx = (e.clientX - rect.left - pan.x) / zoom;
      let wy = (e.clientY - rect.top - pan.y) / zoom;

      if (patternSamplingMode === 'auto') {
        justCompletedSamplingRef.current = true;
        onAutoPatternSampleAtPoint?.({ x: wx, y: wy });
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
        return;
      }

      if (positiveExemplarsCount > 0 && onPatternStencilPlaced) {
        if (getStencilSnapPoint) {
          const stencilSnap = getStencilSnapPoint({ x: wx, y: wy });
          if (stencilSnap.isSnapped) {
            wx = stencilSnap.snappedPos.x;
            wy = stencilSnap.snappedPos.y;
          }
        }
        justCompletedSamplingRef.current = true;
        onPatternStencilPlaced({ x: wx, y: wy });
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
        return;
      }

      setSamplingStartWorldPos({ x: wx, y: wy });
      return;
    }

    if (e.button === 1 || e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      mouseDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (
      activeAdjustHandle &&
      adjustDragStartRef.current &&
      provisionalSquareBox &&
      onUpdateProvisionalSquareBox
    ) {
      const dx = (e.clientX - adjustDragStartRef.current.clientX) / zoom;
      const dy = (e.clientY - adjustDragStartRef.current.clientY) / zoom;
      onUpdateProvisionalSquareBox(
        computeAdjustedSampleSquareBox(adjustDragStartRef.current.initBox, activeAdjustHandle, dx, dy)
      );
      return;
    }

    if (isDragging) {
      if (mouseDragRef.current) {
        const dist = Math.hypot(
          e.clientX - mouseDragRef.current.startX,
          e.clientY - mouseDragRef.current.startY
        );
        if (dist > 5) mouseDragRef.current.moved = true;
      }
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    updateHoverCoordinates(e.clientX, e.clientY, e.shiftKey);
  };

  const handleMouseUp = () => {
    if (activeAdjustHandle) {
      setActiveAdjustHandle(null);
      adjustDragStartRef.current = null;
      return;
    }

    if (isSamplingPattern && !isAdjustingSampleBox && samplingStartWorldPos && hoverWorldPos) {
      const dist = Math.hypot(
        hoverWorldPos.x - samplingStartWorldPos.x,
        hoverWorldPos.y - samplingStartWorldPos.y
      );
      if (dist >= CAD_VIEWPORT_CONFIG.SAMPLE_BOX_MIN_SIZE_M) {
        justCompletedSamplingRef.current = true;
        onPatternSampleBoxCompleted?.(samplingStartWorldPos, hoverWorldPos);
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
      }
      setSamplingStartWorldPos(null);
      return;
    }

    if (activeNodeDragRef.current) {
      if (activeNodeDragRef.current.moved) {
        lastDragEndTimeRef.current = Date.now();
      }
      activeNodeDragRef.current = null;
      isDraggingObjectRef.current = false;
    }

    if (mouseDragRef.current?.moved) {
      lastDragEndTimeRef.current = Date.now();
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (
      isSamplingPattern &&
      positiveExemplarsCount > 0 &&
      onRotateStencil &&
      (e.shiftKey || e.altKey)
    ) {
      onRotateStencil();
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const next = computeWheelZoomViewport(zoom, pan, e.deltaY, mouseX, mouseY);
      setPan(next.pan);
      setZoom(next.zoom);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDraggingObjectRef.current) return;

    if (isSamplingPattern && e.touches.length === 1 && containerRef.current) {
      const t = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const wx = (t.clientX - rect.left - pan.x) / zoom;
      const wy = (t.clientY - rect.top - pan.y) / zoom;

      if (patternSamplingMode === 'auto') {
        justCompletedSamplingRef.current = true;
        onAutoPatternSampleAtPoint?.({ x: wx, y: wy });
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
        return;
      }

      if (positiveExemplarsCount > 0 && onPatternStencilPlaced) {
        let snapWx = wx;
        let snapWy = wy;
        if (getStencilSnapPoint) {
          const stencilSnap = getStencilSnapPoint({ x: wx, y: wy });
          if (stencilSnap.isSnapped) {
            snapWx = stencilSnap.snappedPos.x;
            snapWy = stencilSnap.snappedPos.y;
          }
        }
        justCompletedSamplingRef.current = true;
        onPatternStencilPlaced({ x: snapWx, y: snapWy });
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
        return;
      }

      setSamplingStartWorldPos({ x: wx, y: wy });
      touchStateRef.current = {
        type: 'single',
        startX: t.clientX,
        startY: t.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: true
      };
      updateHoverCoordinates(t.clientX, t.clientY);
      return;
    }

    if (selectedSymbolId && e.touches.length === 1 && containerRef.current) {
      const t = e.touches[0];
      placementTouchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        lastClientX: t.clientX,
        lastClientY: t.clientY,
        moved: false
      };
      updateHoverCoordinates(t.clientX, t.clientY);
      isDraggingObjectRef.current = true;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStateRef.current = {
        type: 'single',
        startX: t.clientX,
        startY: t.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false
      };
      updateHoverCoordinates(t.clientX, t.clientY);
    } else if (e.touches.length === 2) {
      if (placementTouchRef.current) {
        placementTouchRef.current = null;
        setHoverWorldPos(null);
      }
      isDraggingObjectRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStateRef.current = {
        type: 'pinch',
        startX: (t1.clientX + t2.clientX) / 2,
        startY: (t1.clientY + t2.clientY) / 2,
        panX: pan.x,
        panY: pan.y,
        moved: true,
        pinchDist: dist,
        startZoom: zoom,
        midX: (t1.clientX + t2.clientX) / 2,
        midY: (t1.clientY + t2.clientY) / 2
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (
      activeAdjustHandle &&
      adjustDragStartRef.current &&
      provisionalSquareBox &&
      onUpdateProvisionalSquareBox &&
      e.touches.length === 1
    ) {
      const t = e.touches[0];
      const dx = (t.clientX - adjustDragStartRef.current.clientX) / zoom;
      const dy = (t.clientY - adjustDragStartRef.current.clientY) / zoom;
      onUpdateProvisionalSquareBox(
        computeAdjustedSampleSquareBox(adjustDragStartRef.current.initBox, activeAdjustHandle, dx, dy)
      );
      return;
    }

    if (selectedSymbolId && placementTouchRef.current && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - placementTouchRef.current.startX;
      const dy = t.clientY - placementTouchRef.current.startY;
      if (Math.hypot(dx, dy) > 5) {
        placementTouchRef.current.moved = true;
      }
      placementTouchRef.current.lastClientX = t.clientX;
      placementTouchRef.current.lastClientY = t.clientY;
      updateHoverCoordinates(t.clientX, t.clientY);
      return;
    }

    if (isDraggingObjectRef.current) return;
    if (!touchStateRef.current) return;

    if (touchStateRef.current.type === 'single' && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchStateRef.current.startX;
      const dy = t.clientY - touchStateRef.current.startY;
      if (Math.hypot(dx, dy) > 8) {
        touchStateRef.current.moved = true;
      }

      if (isSamplingPattern && containerRef.current) {
        updateHoverCoordinates(t.clientX, t.clientY);
        return;
      }

      setPan({
        x: touchStateRef.current.panX + dx,
        y: touchStateRef.current.panY + dy
      });
      updateHoverCoordinates(t.clientX, t.clientY);
    } else if (touchStateRef.current.type === 'pinch' && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (
        containerRef.current &&
        touchStateRef.current.midX !== undefined &&
        touchStateRef.current.midY !== undefined
      ) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseCanvasX = touchStateRef.current.midX - rect.left;
        const mouseCanvasY = touchStateRef.current.midY - rect.top;
        const next = computePinchZoomViewport(
          touchStateRef.current.startZoom || CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER,
          { x: touchStateRef.current.panX, y: touchStateRef.current.panY },
          touchStateRef.current.pinchDist || 1,
          newDist,
          mouseCanvasX,
          mouseCanvasY
        );
        setZoom(next.zoom);
        setPan(next.pan);
      }
    }
  };

  const triggerPlacement = (clientX: number, clientY: number) => {
    if (isDragging || !containerRef.current) return;
    if (isSamplingPattern || justCompletedSamplingRef.current) return;
    if (justPlacedSymbolRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const wx = (clientX - rect.left - pan.x) / zoom;
    const wy = (clientY - rect.top - pan.y) / zoom;

    if (isCalibratingUnderlay) {
      onCalibrationCanvasClick?.(Number(wx.toFixed(3)), Number(wy.toFixed(3)));
      return;
    }

    if (isAddingDimension) {
      onDimensionCanvasClick?.(Number(wx.toFixed(3)), Number(wy.toFixed(3)));
      return;
    }

    if (isDrawingOverhang) {
      onOverhangCanvasClick?.(Number(wx.toFixed(3)), Number(wy.toFixed(3)));
      return;
    }

    if (isMovingSpace) {
      const targetX = hoverWorldPos ? hoverWorldPos.x : wx;
      const targetY = hoverWorldPos ? hoverWorldPos.y : wy;
      onMoveSpaceCanvasClick?.(Number(targetX.toFixed(3)), Number(targetY.toFixed(3)));
      return;
    }

    if (isArchitectureLocked && !selectedSymbolId && !isConnectingConduit) {
      return;
    }

    if (!onCanvasClick) return;

    if (!selectedSymbolId) {
      if (editingConduitRouteId) {
        onCanvasClick(Number(wx.toFixed(3)), Number(wy.toFixed(3)));
        return;
      }

      if (isConnectingConduit) {
        if (pendingConduitStartId && sequenceRoutingMode !== 'schematic_arc') {
          onCanvasClick(Number(wx.toFixed(3)), Number(wy.toFixed(3)));
        }
        return;
      }

      onCanvasClick(Number(wx.toFixed(3)), Number(wy.toFixed(3)));
      return;
    }

    const targetWx = hoverWorldPos ? hoverWorldPos.x : wx;
    const targetWy = hoverWorldPos ? hoverWorldPos.y : wy;
    const targetSnap = activeSnapInfo;
    const targetRot = hoverRotationDeg;

    onCanvasClick(
      Number(targetWx.toFixed(3)),
      Number(targetWy.toFixed(3)),
      targetSnap || undefined,
      targetRot
    );
  };

  const triggerPlacementRef = useRef(triggerPlacement);
  useEffect(() => {
    triggerPlacementRef.current = triggerPlacement;
  });

  const handleTouchEnd = (_e: React.TouchEvent) => {
    if (activeWaypointDragRef.current) {
      activeWaypointDragRef.current = null;
    }
    if (activeNodeDragRef.current) {
      if (activeNodeDragRef.current.moved) {
        lastDragEndTimeRef.current = Date.now();
      }
      activeNodeDragRef.current = null;
    }

    if (selectedSymbolId && placementTouchRef.current) {
      const pt = placementTouchRef.current;
      placementTouchRef.current = null;
      isDraggingObjectRef.current = false;

      triggerPlacementRef.current?.(pt.lastClientX, pt.lastClientY);
      setHoverWorldPos(null);

      justPlacedSymbolRef.current = true;
      setTimeout(() => {
        justPlacedSymbolRef.current = false;
      }, 200);
      return;
    }

    isDraggingObjectRef.current = false;

    if (isSamplingPattern && !isAdjustingSampleBox && samplingStartWorldPos && hoverWorldPos) {
      const dist = Math.hypot(
        hoverWorldPos.x - samplingStartWorldPos.x,
        hoverWorldPos.y - samplingStartWorldPos.y
      );
      if (dist >= CAD_VIEWPORT_CONFIG.SAMPLE_BOX_MIN_SIZE_M) {
        justCompletedSamplingRef.current = true;
        onPatternSampleBoxCompleted?.(samplingStartWorldPos, hoverWorldPos);
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
      }
      setSamplingStartWorldPos(null);
      touchStateRef.current = null;
      return;
    }

    if (touchStateRef.current?.moved) {
      lastDragEndTimeRef.current = Date.now();
    }
    touchStateRef.current = null;
  };

  const isInteractionIntercepted = Boolean(
    selectedSymbolId ||
      isConnectingConduit ||
      isCalibratingUnderlay ||
      isAddingDimension ||
      isDrawingOverhang ||
      isMovingSpace
  );
  const isInteractionInterceptedRef = useRef(isInteractionIntercepted);
  useEffect(() => {
    isInteractionInterceptedRef.current = isInteractionIntercepted;
  }, [isInteractionIntercepted]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (wasDraggingRecentlyRef.current()) return;
    if (justPlacedSymbolRef.current) return;
    if (justCompletedSamplingRef.current) {
      justCompletedSamplingRef.current = false;
      return;
    }
    if (mouseDragRef.current?.moved) {
      mouseDragRef.current = null;
      return;
    }
    triggerPlacementRef.current(e.clientX, e.clientY);
  };

  const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (wasDraggingRecentlyRef.current()) return;
    if (isConnectingConduit && pendingConduitStartId && onCommitConduitWithTerminalReference) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;
      onCommitConduitWithTerminalReference({ x: worldX, y: worldY });
    }
  };

  const viewportActionsRef = useRef({ handleRecenter, startAdjustDrag });
  useEffect(() => {
    viewportActionsRef.current = { handleRecenter, startAdjustDrag };
  });
  const handleStableRecenter = useMemo(() => () => viewportActionsRef.current.handleRecenter(), []);
  const handleStableStartAdjustDrag = useMemo(
    () => (handle: AdjustSampleHandle, clientX: number, clientY: number) =>
      viewportActionsRef.current.startAdjustDrag(handle, clientX, clientY),
    []
  );
  const handleZoomIn = useMemo(
    () => () =>
      setZoom((z) =>
        Math.min(
          CAD_VIEWPORT_CONFIG.MAX_ZOOM_PIXELS_PER_METER,
          Number((z * CAD_VIEWPORT_CONFIG.ZOOM_STEP_FACTOR).toFixed(1))
        )
      ),
    []
  );
  const handleZoomOut = useMemo(
    () => () =>
      setZoom((z) =>
        Math.max(
          CAD_VIEWPORT_CONFIG.MIN_ZOOM_PIXELS_PER_METER,
          Number((z / CAD_VIEWPORT_CONFIG.ZOOM_STEP_FACTOR).toFixed(1))
        )
      ),
    []
  );

  return {
    zoom,
    pan,
    hoverWorldPos,
    hoverRotationDeg,
    activeSnapInfo,
    isSnappedToCenter,
    isSnappedToPatternMatch,
    samplingStartWorldPos,
    isStencilSnapped,
    activeWaypointDragRef,
    activeNodeDragRef,
    isDraggingObjectRef,
    lastDragEndTimeRef,
    wasDraggingRecentlyRef,
    triggerPlacementRef,
    isInteractionInterceptedRef,
    handleStableRecenter,
    handleStableStartAdjustDrag,
    handleZoomIn,
    handleZoomOut,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleSvgClick,
    handleSvgDoubleClick
  };
}
