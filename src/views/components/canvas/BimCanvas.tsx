/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BimCanvas.tsx
 * Lienzo Gráfico 2D Interactivo para Arquitectura BIM y Red Eléctrica AEA.
 * Muestra puntos de anclaje (vértices/esquinas), proyección de rayo láser
 * en tiempo real, muros continuos con espesor y cotas métricas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { WallVertex, Wall, WallPlacementSnap } from '../../../models/architecture/Wall';
import { calculateWallSnap } from '../../../models/architecture/Wall';
import { resolveSpacePolygon, calculatePolygonCentroid } from '../../../models/architecture/Space';

import { CAD_VIEWPORT_CONFIG } from '../../../config';
import type { UnderlaySheet } from '../../../models/underlay/UnderlaySheet';
import type { DetectedPatternMatch } from '../../../models/underlay/PatternDetector';
import { useElectricalSequenceStore } from '../../../viewmodels/useElectricalViewModel';
import type { SpatialElectricalNode, ConduitWaypoint } from '../../../models/electrical/ElectricalModel';
import { useWallGripDrag } from '../../../viewmodels/useWallGripDrag';
import { SmartGuidesLayer } from './layers/SmartGuidesLayer';
import { PatternMatchesLayer } from './layers/PatternMatchesLayer';
import { BeamsLayer, ColumnsLayer } from './layers/StructuralLayers';
import { WallsLayer, type WallGripActions } from './layers/WallsLayer';
import { SpacesLayer } from './layers/SpacesLayer';
import { OpeningsLayer } from './layers/OpeningsLayer';
import { VerticesLayer } from './layers/VerticesLayer';
import { PreviewRayLayer } from './layers/PreviewRayLayer';
import { ConduitsLayer } from './layers/ConduitsLayer';
import { ElectricalElementsLayer } from './layers/ElectricalElementsLayer';
import { PanelsLayer } from './layers/PanelsLayer';
import { DimensionsLayer } from './layers/DimensionsLayer';
import { PatternSamplingOverlayLayer } from './layers/PatternSamplingOverlayLayer';
import { InteractiveDraftLayer } from './layers/InteractiveDraftLayer';
import { CanvasModeBanners } from './layers/CanvasModeBanners';
import { CanvasFloatingControls } from './layers/CanvasFloatingControls';
import type {
  ActiveNodeDragState,
  ActiveWaypointDragState,
  AdjustSampleHandle
} from './layers/layerTypes';

export type { WallPlacementSnap };

interface BimCanvasProps {
  currentDirectionDeg: number;
  previewDistanceM: number;
  selectedSymbolId?: string | null;
  isConnectingConduit?: boolean;
  pendingConduitStartId?: string | null;
  pendingConduitWaypoints?: Array<{ x: number; y: number }>;
  onUndoConduitWaypoint?: () => void;
  onClearConduitWaypoints?: () => void;
  onCancelConnectingConduit?: () => void;
  onCommitConduitWithTerminalReference?: (targetPos: { x: number; y: number }, targetDescription?: string) => void;
  isDesktop?: boolean;
  editingConduitRouteId?: string | null;
  onUpdateConduitWaypoint?: (conduitId: string, index: number, patch: Partial<ConduitWaypoint>) => void;
  onRemoveConduitWaypoint?: (conduitId: string, index: number) => void;
  underlaySheet?: UnderlaySheet | null;
  isCalibratingUnderlay?: boolean;
  calibrationP1?: { x: number; y: number } | null;
  onCalibrationCanvasClick?: (worldX: number, worldY: number) => void;
  onCancelCalibration?: () => void;
  onToggleUnderlayVisibility?: () => void;
  onCycleUnderlayOpacity?: () => void;
  onStartUnderlayCalibration?: () => void;
  onOpenAdjustUnderlay?: () => void;
  isAddingDimension?: boolean;
  dimensionP1?: { x: number; y: number } | null;
  onToggleAddingDimension?: () => void;
  onDimensionCanvasClick?: (worldX: number, worldY: number) => void;
  onCancelAddingDimension?: () => void;
  isDrawingOverhang?: boolean;
  overhangSpaceId?: string | null;
  overhangP1?: { x: number; y: number } | null;
  onOverhangCanvasClick?: (worldX: number, worldY: number) => void;
  onCancelDrawingOverhang?: () => void;
  isMovingSpace?: boolean;
  movingSpaceId?: string | null;
  movingBasePoint?: { x: number; y: number } | null;
  onMoveSpaceCanvasClick?: (worldX: number, worldY: number) => void;
  onCancelMovingSpace?: () => void;
  isSamplingPattern?: boolean;
  positiveExemplarsCount?: number;
  stencilSizeWorld?: { width: number; height: number } | null;
  stencilRotationDeg?: 0 | 90 | 180 | 270;
  onRotateStencil?: () => void;
  onPatternStencilPlaced?: (centerWorld: { x: number; y: number }) => void;
  getStencilSnapPoint?: (
    worldPos: { x: number; y: number },
    toleranceMeters?: number
  ) => { snappedPos: { x: number; y: number }; isSnapped: boolean };
  onStartPatternSampling?: () => void;
  onCancelSamplingPattern?: () => void;
  onPatternSampleBoxCompleted?: (p1: { x: number; y: number }, p2: { x: number; y: number }) => void;
  isAdjustingSampleBox?: boolean;
  provisionalSquareBox?: { x: number; y: number; size: number } | null;
  onUpdateProvisionalSquareBox?: (box: { x: number; y: number; size: number }) => void;
  onConfirmProvisionalSampleBox?: () => void;
  onCancelProvisionalSampleBox?: () => void;
  detectedPatternMatches?: DetectedPatternMatch[];
  onDismissPatternMatch?: (matchId: string) => void;
  onWallClick?: (wallId: string) => void;
  onWallDoubleClick?: (wallId: string) => void;
  onOpeningClick?: (openingId: string) => void;
  onSpaceClick?: (spaceId: string) => void;
  onColumnClick?: (columnId: string) => void;
  onBeamClick?: (beamId: string) => void;
  onElectricalElementClick?: (elementId: string, isMultiSelect?: boolean) => void;
  onElectricalElementDoubleClick?: (elementId: string) => void;
  onPanelClick?: (panelId: string, isMultiSelect?: boolean) => void;
  onPanelDoubleClick?: (panelId: string) => void;
  onCanvasClick?: (worldX: number, worldY: number, snapInfo?: WallPlacementSnap, rotationDeg?: number) => void;
  isArchitectureLocked?: boolean;
  onToggleLockArchitecture?: () => void;
  isSnapEnabled?: boolean;
  onToggleSnap?: () => void;
  patternSamplingMode?: 'auto' | 'box';
  onAutoPatternSampleAtPoint?: (worldPos: { x: number; y: number }) => void;
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
}

export const BimCanvas: React.FC<BimCanvasProps> = ({
  currentDirectionDeg,
  previewDistanceM,
  selectedSymbolId,
  isConnectingConduit = false,
  pendingConduitStartId = null,
  pendingConduitWaypoints = [],
  onUndoConduitWaypoint,
  onClearConduitWaypoints,
  onCancelConnectingConduit,
  onCommitConduitWithTerminalReference,
  isDesktop = true,
  editingConduitRouteId = null,
  onUpdateConduitWaypoint,
  onRemoveConduitWaypoint,
  underlaySheet = null,
  isCalibratingUnderlay = false,
  calibrationP1 = null,
  onCalibrationCanvasClick,
  onCancelCalibration,
  onToggleUnderlayVisibility,
  onCycleUnderlayOpacity,
  onStartUnderlayCalibration,
  onOpenAdjustUnderlay,
  isAddingDimension = false,
  dimensionP1 = null,
  onToggleAddingDimension,
  onDimensionCanvasClick,
  onCancelAddingDimension,
  isDrawingOverhang = false,
  overhangSpaceId = null,
  overhangP1 = null,
  onOverhangCanvasClick,
  onCancelDrawingOverhang,
  isMovingSpace = false,
  movingSpaceId = null,
  movingBasePoint = null,
  onMoveSpaceCanvasClick,
  onCancelMovingSpace,
  isSamplingPattern = false,
  positiveExemplarsCount = 0,
  stencilSizeWorld = null,
  stencilRotationDeg = 0,
  onRotateStencil,
  onPatternStencilPlaced,
  getStencilSnapPoint,
  onStartPatternSampling,
  onCancelSamplingPattern,
  onPatternSampleBoxCompleted,
  isAdjustingSampleBox = false,
  provisionalSquareBox = null,
  onUpdateProvisionalSquareBox,
  onConfirmProvisionalSampleBox,
  onCancelProvisionalSampleBox,
  detectedPatternMatches = [],
  onDismissPatternMatch,
  onWallClick,
  onWallDoubleClick,
  onOpeningClick,
  onSpaceClick,
  onColumnClick,
  onBeamClick,
  onElectricalElementClick,
  onElectricalElementDoubleClick,
  onPanelClick,
  onPanelDoubleClick,
  onCanvasClick,
  isArchitectureLocked = false,
  onToggleLockArchitecture,
  isSnapEnabled = true,
  onToggleSnap,
  getPlacingSnapPoint,
  patternSamplingMode = 'auto',
  onAutoPatternSampleAtPoint
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    project,
    selectedEntity,
    selectedEntities,
    setSelectedEntity,
    toggleSelectEntity,
    activeAnchorVertexId,
    setActiveAnchorVertexId,
    showDimensions,
    toggleDimensions,
    deleteDimensionLine,
    labelDisplayMode,
    updateElectricalElement,
    updatePanel
  } = useProjectStore();

  const selectedEntityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const se of selectedEntities) {
      let set = map.get(se.type);
      if (!set) {
        set = new Set();
        map.set(se.type, set);
      }
      set.add(se.id);
    }
    return map;
  }, [selectedEntities]);

  const sequenceRoutingMode = useElectricalSequenceStore((s) => s.sequenceRoutingMode);
  const sequenceRoutingPlane = useElectricalSequenceStore((s) => s.sequenceRoutingPlane);
  const setSequenceRoutingMode = useElectricalSequenceStore((s) => s.setSequenceRoutingMode);

  // Escala y transformación de vista (Pan y Zoom)
  const [zoom, setZoom] = useState<number>(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER);
  const [pan, setPan] = useState<{ x: number; y: number }>({ ...CAD_VIEWPORT_CONFIG.DEFAULT_PAN });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hook de ViewModel para Arrastre Interactivo de Extremos de Muros (CAD Smart Grips)
  const {
    activeDrag,
    activeSnapResult,
    handleGripPointerDown,
    handleGripPointerMove,
    handleGripPointerUp
  } = useWallGripDrag({
    zoom,
    panOffset: pan,
    containerRef
  });

  // Refs para control de arrastre y toques (evitar que un paneo dispare un click accidental)
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

  // Mapas de acceso rápido
  const verticesMap = useMemo(() => {
    return new Map<string, WallVertex>(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const wallsMap = useMemo(() => {
    return new Map<string, Wall>(project.walls.map((w) => [w.id, w]));
  }, [project.walls]);

  // Vértice activo de anclaje
  const activeAnchorVertex = activeAnchorVertexId ? verticesMap.get(activeAnchorVertexId) : null;

  // Posición del cursor en coordenadas de mundo (para preview y snap de bocas)
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

  // Control para evitar clics espurios al finalizar un gesto de arrastre o paneo
  const lastDragEndTimeRef = useRef<number>(0);
  const wasDraggingRecently = () => Date.now() - lastDragEndTimeRef.current < CAD_VIEWPORT_CONFIG.DRAG_RECENT_THRESHOLD_MS;
  const wasDraggingRecentlyRef = useRef(wasDraggingRecently);
  useEffect(() => {
    wasDraggingRecentlyRef.current = wasDraggingRecently;
  });

  // Estados locales para arrastre y redimensión del recuadro provisional de Muestra #1
  const [activeAdjustHandle, setActiveAdjustHandle] = useState<AdjustSampleHandle>(null);
  const adjustDragStartRef = useRef<{ clientX: number; clientY: number; initBox: { x: number; y: number; size: number } } | null>(null);

  const startAdjustDrag = (handle: AdjustSampleHandle, clientX: number, clientY: number) => {
    if (!provisionalSquareBox) return;
    setActiveAdjustHandle(handle);
    adjustDragStartRef.current = {
      clientX,
      clientY,
      initBox: { ...provisionalSquareBox }
    };
  };

  // Recentrar y encuadrar todo el plano
  const handleRecenter = () => {
    if (project.vertices.length === 0) {
      setPan(CAD_VIEWPORT_CONFIG.DEFAULT_PAN);
      setZoom(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER);
      return;
    }
    const xs = project.vertices.map((v) => v.x);
    const ys = project.vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width || 400;
      const h = rect.height || 600;
      const spanX = Math.max(maxX - minX, 1.5);
      const spanY = Math.max(maxY - minY, 1.5);
      const fitZoom = Math.min(Math.max(Math.min((w - 60) / spanX, (h - 220) / spanY), 20), 120);
      setZoom(fitZoom);
      setPan({
        x: w / 2 - midX * fitZoom,
        y: h / 2 - midY * fitZoom
      });
    }
  };

  // Limpiar punto inicial de muestreo al alternar el modo de muestreo
  const [prevSamplingPatternMode, setPrevSamplingPatternMode] = useState(isSamplingPattern);
  if (isSamplingPattern !== prevSamplingPatternMode) {
    setPrevSamplingPatternMode(isSamplingPattern);
    setSamplingStartWorldPos(null);
  }

  // Cálculo de coordenadas de cursor y acople magnético (snap)
  const updateHoverCoordinates = (clientX: number, clientY: number, isShiftPressed: boolean = false) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let wx = (clientX - rect.left - pan.x) / zoom;
    let wy = (clientY - rect.top - pan.y) / zoom;

    let rot = 0;
    let snapInfo: WallPlacementSnap | null = null;
    let snappedCenter = false;
    let snappedPattern = false;

    // El snap magnético se activa únicamente si está habilitado globalmente y no se mantiene Shift presionado
    const snapAllowed = isSnapEnabled && !isShiftPressed;
    // Las asistencias de snap analítico sobre mapa de bits requieren estrictamente un plano cargado
    const underlaySnapAllowed = snapAllowed && underlaySheet !== null;

    if (selectedSymbolId && snapAllowed) {
      // 0. Prioridad 1: Snap magnético al centroide de un símbolo detectado previamente en el plano
      if (underlaySnapAllowed && detectedPatternMatches && detectedPatternMatches.length > 0) {
        let bestMatch: DetectedPatternMatch | null = null;
        let minD = 0.50; // 50 cm de tolerancia de atracción magnética
        for (const m of detectedPatternMatches) {
          const d = Math.hypot(m.worldPos.x - wx, m.worldPos.y - wy);
          if (d < minD) {
            minD = d;
            bestMatch = m;
          }
        }
        if (bestMatch) {
          wx = bestMatch.worldPos.x;
          wy = bestMatch.worldPos.y;
          rot = bestMatch.orientationDeg;
          snappedPattern = true;
        }
      }

      // 0.1 Prioridad 1.5: Snap guiado por auto-muestreo asistido del primer símbolo emplazado (Smart Assisted Placement)
      if (!snappedPattern && getPlacingSnapPoint && underlaySnapAllowed) {
        const placingSnap = getPlacingSnapPoint({ x: wx, y: wy }, selectedSymbolId, !snapAllowed);
        if (placingSnap.isSnapped) {
          wx = placingSnap.snappedPos.x;
          wy = placingSnap.snappedPos.y;
          rot = placingSnap.rotationDeg;
          snappedPattern = true;
        }
      }

      const isCeilingSymbol = selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');

      // 1. Si no es exclusivamente de techo ni se acopló a símbolo detectado, acoplar a pared
      if (!isCeilingSymbol && !snappedPattern) {
        const wallsInLevel = project.walls.filter((w) => w.levelId === project.activeLevelId);
        const wallSnap = calculateWallSnap({ x: wx, y: wy }, wallsInLevel, verticesMap, 0.45);
        if (wallSnap) {
          wx = wallSnap.snappedPoint.x;
          wy = wallSnap.snappedPoint.y;
          rot = wallSnap.rotationDeg;
          snapInfo = {
            wallId: wallSnap.wall.id,
            wallOffset: wallSnap.distanceAlongWall,
            rotationDeg: wallSnap.rotationDeg,
            side: wallSnap.side
          };
        }
      }

      // 2. Si no se acopló a pared ni a símbolo detectado, chequear snap al centroide de habitación
      if (!snapInfo && !snappedPattern) {
        for (const space of project.spaces.filter((s) => s.levelId === project.activeLevelId)) {
          const poly = resolveSpacePolygon(space, verticesMap);
          if (poly.length >= 3) {
            const centroid = calculatePolygonCentroid(poly);
            if (Math.hypot(centroid.x - wx, centroid.y - wy) < 0.60) {
              wx = centroid.x;
              wy = centroid.y;
              snappedCenter = true;
              break;
            }
          }
        }
      }
    }

    // 3. Snap magnético para el esténcil rígido al núcleo de tinta o candidatos detectados
    if (isSamplingPattern && positiveExemplarsCount > 0 && getStencilSnapPoint && underlaySnapAllowed) {
      const stencilSnap = getStencilSnapPoint({ x: wx, y: wy });
      if (stencilSnap.isSnapped) {
        wx = stencilSnap.snappedPos.x;
        wy = stencilSnap.snappedPos.y;
        setIsStencilSnapped(true);
      } else {
        setIsStencilSnapped(false);
      }
    } else {
      setIsStencilSnapped(false);
    }

    // 4. Snap magnético a vértices/esquinas existentes al mover un ambiente
    if (isMovingSpace && snapAllowed) {
      let bestVertex: WallVertex | null = null;
      let minD = 0.35;
      for (const v of project.vertices) {
        const d = Math.hypot(v.x - wx, v.y - wy);
        if (d < minD) {
          minD = d;
          bestVertex = v;
        }
      }
      if (bestVertex) {
        wx = bestVertex.x;
        wy = bestVertex.y;
      }
    }

    setHoverWorldPos({ x: wx, y: wy });
    setHoverRotationDeg(rot);
    setActiveSnapInfo(snapInfo);
    setIsSnappedToCenter(snappedCenter);
    setIsSnappedToPatternMatch(snappedPattern);
  };

  // Manejo de Pan y Zoom con Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSamplingPattern && e.button === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let wx = (e.clientX - rect.left - pan.x) / zoom;
      let wy = (e.clientY - rect.top - pan.y) / zoom;

      // Si estamos en modo auto-muestreo inteligente (1 solo clic, centrado por baricentro)
      if (patternSamplingMode === 'auto') {
        justCompletedSamplingRef.current = true;
        onAutoPatternSampleAtPoint?.({ x: wx, y: wy });
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
        return;
      }

      // Si estamos en modo esténcil rígido (muestras adicionales con tamaño fijo)
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
    if (activeAdjustHandle && adjustDragStartRef.current && provisionalSquareBox && onUpdateProvisionalSquareBox) {
      const dx = (e.clientX - adjustDragStartRef.current.clientX) / zoom;
      const dy = (e.clientY - adjustDragStartRef.current.clientY) / zoom;
      const init = adjustDragStartRef.current.initBox;

      if (activeAdjustHandle === 'move') {
        onUpdateProvisionalSquareBox({
          x: Number((init.x + dx).toFixed(3)),
          y: Number((init.y + dy).toFixed(3)),
          size: init.size
        });
      } else if (activeAdjustHandle === 'se') {
        const newSize = Math.max(0.10, init.size + Math.max(dx, dy));
        onUpdateProvisionalSquareBox({
          x: init.x,
          y: init.y,
          size: Number(newSize.toFixed(3))
        });
      } else if (activeAdjustHandle === 'ne') {
        const newSize = Math.max(0.10, init.size + Math.max(dx, -dy));
        onUpdateProvisionalSquareBox({
          x: init.x,
          y: Number((init.y + init.size - newSize).toFixed(3)),
          size: Number(newSize.toFixed(3))
        });
      } else if (activeAdjustHandle === 'sw') {
        const newSize = Math.max(0.10, init.size + Math.max(-dx, dy));
        onUpdateProvisionalSquareBox({
          x: Number((init.x + init.size - newSize).toFixed(3)),
          y: init.y,
          size: Number(newSize.toFixed(3))
        });
      } else if (activeAdjustHandle === 'nw') {
        const newSize = Math.max(0.10, init.size + Math.max(-dx, -dy));
        onUpdateProvisionalSquareBox({
          x: Number((init.x + init.size - newSize).toFixed(3)),
          y: Number((init.y + init.size - newSize).toFixed(3)),
          size: Number(newSize.toFixed(3))
        });
      }
      return;
    }

    if (isDragging) {
      if (mouseDragRef.current) {
        const dist = Math.hypot(e.clientX - mouseDragRef.current.startX, e.clientY - mouseDragRef.current.startY);
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
      const dist = Math.hypot(hoverWorldPos.x - samplingStartWorldPos.x, hoverWorldPos.y - samplingStartWorldPos.y);
      if (dist >= 0.10) {
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

    // Rueda con Shift o Alt en modo esténcil rota 90° el sello
    if (isSamplingPattern && positiveExemplarsCount > 0 && onRotateStencil && (e.shiftKey || e.altKey)) {
      onRotateStencil();
      return;
    }

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 15), 300);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
      });
      setZoom(newZoom);
    }
  };

  // Manejo Táctil Móvil: Paneo con 1 dedo y Pellizco (Pinch-to-zoom) con 2 dedos
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDraggingObjectRef.current) return;

    if (isSamplingPattern && e.touches.length === 1 && containerRef.current) {
      const t = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const wx = (t.clientX - rect.left - pan.x) / zoom;
      const wy = (t.clientY - rect.top - pan.y) / zoom;

      // Si estamos en modo auto-muestreo inteligente en móvil (1 toque, centrado por baricentro)
      if (patternSamplingMode === 'auto') {
        justCompletedSamplingRef.current = true;
        onAutoPatternSampleAtPoint?.({ x: wx, y: wy });
        setTimeout(() => {
          justCompletedSamplingRef.current = false;
        }, 150);
        return;
      }

      // Si estamos en modo esténcil rígido en móvil
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

    // Si estamos en modo emplazamiento de símbolo eléctrico y el usuario toca con 1 dedo
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
    if (activeAdjustHandle && adjustDragStartRef.current && provisionalSquareBox && onUpdateProvisionalSquareBox && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = (t.clientX - adjustDragStartRef.current.clientX) / zoom;
      const dy = (t.clientY - adjustDragStartRef.current.clientY) / zoom;
      const init = adjustDragStartRef.current.initBox;

      if (activeAdjustHandle === 'move') {
        onUpdateProvisionalSquareBox({
          x: Number((init.x + dx).toFixed(3)),
          y: Number((init.y + dy).toFixed(3)),
          size: init.size
        });
      } else if (activeAdjustHandle === 'se') {
        const newSize = Math.max(0.10, init.size + Math.max(dx, dy));
        onUpdateProvisionalSquareBox({
          x: init.x,
          y: init.y,
          size: Number(newSize.toFixed(3))
        });
      } else if (activeAdjustHandle === 'ne') {
        const newSize = Math.max(0.10, init.size + Math.max(dx, -dy));
        onUpdateProvisionalSquareBox({
          x: init.x,
          y: Number((init.y + init.size - newSize).toFixed(3)),
          size: Number(newSize.toFixed(3))
        });
      } else if (activeAdjustHandle === 'sw') {
        const newSize = Math.max(0.10, init.size + Math.max(-dx, dy));
        onUpdateProvisionalSquareBox({
          x: Number((init.x + init.size - newSize).toFixed(3)),
          y: init.y,
          size: Number(newSize.toFixed(3))
        });
      } else if (activeAdjustHandle === 'nw') {
        const newSize = Math.max(0.10, init.size + Math.max(-dx, -dy));
        onUpdateProvisionalSquareBox({
          x: Number((init.x + init.size - newSize).toFixed(3)),
          y: Number((init.y + init.size - newSize).toFixed(3)),
          size: Number(newSize.toFixed(3))
        });
      }
      return;
    }

    // Si estamos en modo de emplazamiento de símbolo eléctrico (previsualización y arrastre táctil sin mover la vista)
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
      const scaleFactor = newDist / (touchStateRef.current.pinchDist || 1);
      const newZoom = Math.min(300, Math.max(15, (touchStateRef.current.startZoom || 60) * scaleFactor));

      if (containerRef.current && touchStateRef.current.midX !== undefined && touchStateRef.current.midY !== undefined) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseCanvasX = touchStateRef.current.midX - rect.left;
        const mouseCanvasY = touchStateRef.current.midY - rect.top;
        const worldX = (mouseCanvasX - touchStateRef.current.panX) / (touchStateRef.current.startZoom || 60);
        const worldY = (mouseCanvasY - touchStateRef.current.panY) / (touchStateRef.current.startZoom || 60);

        setZoom(newZoom);
        setPan({
          x: mouseCanvasX - worldX * newZoom,
          y: mouseCanvasY - worldY * newZoom
        });
      }
    }
  };

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

    // Al soltar el dedo en modo emplazamiento, fijar la boca en el punto de snap actual
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
      const dist = Math.hypot(hoverWorldPos.x - samplingStartWorldPos.x, hoverWorldPos.y - samplingStartWorldPos.y);
      if (dist >= 0.10) {
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

  const triggerPlacement = (clientX: number, clientY: number) => {
    if (isDragging || !containerRef.current) return;
    if (isSamplingPattern || justCompletedSamplingRef.current) return;
    if (justPlacedSymbolRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let wx = (clientX - rect.left - pan.x) / zoom;
    let wy = (clientY - rect.top - pan.y) / zoom;

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

    // Si la arquitectura está bloqueada y no se está emplazando una boca ni conectando cañería, ignorar clics de fondo
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

    // Emplazamiento continuo de símbolo eléctrico (Multi-stamp asistido)
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

  // ─── RENDERIZADORES DE CAPAS ─────────────────────────────────────────────

  const activeLevelSpaces = useMemo(() => project.spaces.filter((s) => s.levelId === project.activeLevelId), [project.spaces, project.activeLevelId]);

  const activeLevelWalls = useMemo(() => project.walls.filter((w) => w.levelId === project.activeLevelId), [project.walls, project.activeLevelId]);

  // Acciones de grips con identidad estable: delegan en la última versión de los handlers vía ref.
  const gripHandlersRef = useRef({ handleGripPointerDown, handleGripPointerMove, handleGripPointerUp });
  useEffect(() => {
    gripHandlersRef.current = { handleGripPointerDown, handleGripPointerMove, handleGripPointerUp };
  });
  const wallGripActions = useMemo<WallGripActions>(() => {
    const finishDrag = (e: React.PointerEvent) => {
      gripHandlersRef.current.handleGripPointerUp(e);
      lastDragEndTimeRef.current = Date.now();
      isDraggingObjectRef.current = false;
    };
    return {
      onGripDown: (e, wallId, end, vertexId) => {
        isDraggingObjectRef.current = true;
        gripHandlersRef.current.handleGripPointerDown(e, wallId, end, vertexId);
      },
      onGripMove: (e) => gripHandlersRef.current.handleGripPointerMove(e),
      onGripRelease: finishDrag
    };
  }, []);

  const isInteractionBlocked = Boolean(selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension);
  const activeLevelBeams = useMemo(() => (project.beams || []).filter((b) => b.levelId === project.activeLevelId), [project.beams, project.activeLevelId]);
  const activeLevelColumns = useMemo(() => (project.columns || []).filter((c) => c.levelId === project.activeLevelId), [project.columns, project.activeLevelId]);

  // 6. Cañerías de enlace entre bocas eléctricas y tableros distribuidores
  const elementsMap = useMemo(() => {
    const map = new Map<string, SpatialElectricalNode>();
    project.electricalElements.forEach((el) => map.set(el.id, el));
    (project.panels || []).forEach((pan) => map.set(pan.id, pan));
    return map;
  }, [project.electricalElements, project.panels]);

  const levelsMap = useMemo(() => {
    return new Map(project.levels.map((l) => [l.id, l]));
  }, [project.levels]);

  const isNodeDragBlocked = Boolean(
    selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension || isSamplingPattern
  );
  const activeLevelElements = useMemo(
    () => project.electricalElements.filter((el) => el.levelId === project.activeLevelId),
    [project.electricalElements, project.activeLevelId]
  );
  const activeLevelPanels = useMemo(
    () => (project.panels || []).filter((panel) => panel.isPlaced && panel.levelId === project.activeLevelId),
    [project.panels, project.activeLevelId]
  );
  const emptyIdSet = useMemo(() => new Set<string>(), []);
  const selectedConduitIds = selectedEntityMap.get('conduit') ?? emptyIdSet;
  const selectedElementIds = selectedEntityMap.get('electrical_element') ?? emptyIdSet;
  const selectedPanelIds = selectedEntityMap.get('panel') ?? emptyIdSet;

  const electricalActionsRef = useRef({ toggleSelectEntity, setSelectedEntity });
  useEffect(() => {
    electricalActionsRef.current = { toggleSelectEntity, setSelectedEntity };
  });
  const handleToggleSelectConduit = useMemo(
    () => (conduitId: string, shiftKey: boolean) =>
      electricalActionsRef.current.toggleSelectEntity({ type: 'conduit', id: conduitId }, shiftKey),
    []
  );
  const handleSelectElementAfterDrag = useMemo(
    () => (elementId: string) =>
      electricalActionsRef.current.setSelectedEntity({ type: 'electrical_element', id: elementId }),
    []
  );
  const handleSelectPanelAfterDrag = useMemo(
    () => (panelId: string) =>
      electricalActionsRef.current.setSelectedEntity({ type: 'panel', id: panelId }),
    []
  );

  const activeLevelDimensions = useMemo(
    () => (project.dimensions || []).filter((dim) => dim.levelId === project.activeLevelId),
    [project.dimensions, project.activeLevelId]
  );
  const handleSelectDimension = useMemo(
    () => (dimId: string) =>
      electricalActionsRef.current.setSelectedEntity({ type: 'dimension', id: dimId }),
    []
  );

  const movingSpace = useMemo(
    () => (isMovingSpace && movingSpaceId ? project.spaces.find((s) => s.id === movingSpaceId) ?? null : null),
    [isMovingSpace, movingSpaceId, project.spaces]
  );
  const pendingConduitStartNode = useMemo(
    () => (pendingConduitStartId ? elementsMap.get(pendingConduitStartId) ?? null : null),
    [pendingConduitStartId, elementsMap]
  );

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

  // 3.1. Capa visual de guías inteligentes (Smart Guides), imantación y cotas dinámicas durante arrastre de muro
  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-slate-50 select-none touch-none ${
        selectedSymbolId ? 'cursor-cell' : 'cursor-crosshair'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerMove={(e) => {
        if (activeDrag) {
          handleGripPointerMove(e);
        }
      }}
      onPointerUp={(e) => {
        if (activeDrag) {
          handleGripPointerUp(e);
          lastDragEndTimeRef.current = Date.now();
          isDraggingObjectRef.current = false;
        }
      }}
    >
      <svg className="w-full h-full" onClick={handleSvgClick} onDoubleClick={handleSvgDoubleClick}>
        <defs>
          <pattern
            id="grid-pattern"
            width={zoom}
            height={zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % zoom}, ${pan.y % zoom})`}
          >
            <path d={`M ${zoom} 0 L 0 0 0 ${zoom}`} fill="none" stroke="#e2e8f0" strokeWidth={0.75} />
          </pattern>
          <pattern
            id="hatch-open-air"
            width={14}
            height={14}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={14} height={14} fill="rgba(254, 252, 232, 0.45)" />
            <line x1={0} y1={0} x2={0} y2={14} stroke="#d97706" strokeWidth={1.2} strokeOpacity={0.35} />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        <g transform={`translate(${pan.x}, ${pan.y})`}>
          {/* Lámina de plano de fondo (Underlay Sheet) */}
          {underlaySheet && underlaySheet.visible && (
            <image
              href={underlaySheet.imageUrl}
              x={underlaySheet.originWorldX * zoom}
              y={underlaySheet.originWorldY * zoom}
              width={underlaySheet.widthPx * underlaySheet.scaleMetersPerPx * zoom}
              height={underlaySheet.heightPx * underlaySheet.scaleMetersPerPx * zoom}
              opacity={underlaySheet.opacity}
              preserveAspectRatio="none"
              className="pointer-events-none select-none"
            />
          )}

          <SpacesLayer spaces={activeLevelSpaces} verticesMap={verticesMap} wallsMap={wallsMap} zoom={zoom} selectedSpaceId={selectedEntity?.type === 'space' ? selectedEntity.id : null} overhangTargetSpaceId={isDrawingOverhang ? overhangSpaceId : null} wasDraggingRecentlyRef={wasDraggingRecentlyRef} isInteractionInterceptedRef={isInteractionInterceptedRef} triggerPlacementRef={triggerPlacementRef} onSpaceClick={onSpaceClick} />
          <BeamsLayer beams={activeLevelBeams} zoom={zoom} selectedBeamId={selectedEntity?.type === 'beam' ? selectedEntity.id : null} onBeamClick={onBeamClick} wasDraggingRecentlyRef={wasDraggingRecentlyRef} isInteractionBlocked={isInteractionBlocked} />
          <WallsLayer walls={activeLevelWalls} verticesMap={verticesMap} zoom={zoom} selectedWallId={selectedEntity?.type === 'wall' ? selectedEntity.id : null} showDimensions={showDimensions} isArchitectureLocked={isArchitectureLocked} activeDragWallId={activeDrag?.wallId ?? null} activeDragEnd={activeDrag?.draggedEnd ?? null} gripActions={wallGripActions} wasDraggingRecentlyRef={wasDraggingRecentlyRef} isInteractionInterceptedRef={isInteractionInterceptedRef} triggerPlacementRef={triggerPlacementRef} onWallClick={onWallClick} onWallDoubleClick={onWallDoubleClick} />
          <OpeningsLayer openings={project.openings} wallsMap={wallsMap} verticesMap={verticesMap} activeLevelId={project.activeLevelId} zoom={zoom} selectedOpeningId={selectedEntity?.type === 'opening' ? selectedEntity.id : null} wasDraggingRecentlyRef={wasDraggingRecentlyRef} isInteractionInterceptedRef={isInteractionInterceptedRef} triggerPlacementRef={triggerPlacementRef} onOpeningClick={onOpeningClick} />
          <ColumnsLayer columns={activeLevelColumns} zoom={zoom} selectedColumnId={selectedEntity?.type === 'column' ? selectedEntity.id : null} onColumnClick={onColumnClick} wasDraggingRecentlyRef={wasDraggingRecentlyRef} isInteractionBlocked={isInteractionBlocked} />
          <PreviewRayLayer anchorVertex={activeAnchorVertex ?? null} distanceM={previewDistanceM} directionDeg={currentDirectionDeg} zoom={zoom} />
          <ConduitsLayer
            conduits={project.conduits}
            circuits={project.circuits}
            spaces={project.spaces}
            elementsMap={elementsMap}
            activeLevelId={project.activeLevelId}
            zoom={zoom}
            selectedConduitIds={selectedConduitIds}
            editingConduitRouteId={editingConduitRouteId}
            activeWaypointDragRef={activeWaypointDragRef}
            isDraggingObjectRef={isDraggingObjectRef}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onToggleSelectConduit={handleToggleSelectConduit}
            onUpdateConduitWaypoint={onUpdateConduitWaypoint}
            onRemoveConduitWaypoint={onRemoveConduitWaypoint}
          />
          <VerticesLayer vertices={project.vertices} zoom={zoom} activeAnchorVertexId={activeAnchorVertexId} wasDraggingRecentlyRef={wasDraggingRecentlyRef} isInteractionInterceptedRef={isInteractionInterceptedRef} triggerPlacementRef={triggerPlacementRef} onSelectAnchor={setActiveAnchorVertexId} />
          <ElectricalElementsLayer
            elements={activeLevelElements}
            circuits={project.circuits}
            panels={project.panels}
            conduits={project.conduits}
            elementsMap={elementsMap}
            levelsMap={levelsMap}
            walls={activeLevelWalls}
            verticesMap={verticesMap}
            labelDisplayMode={labelDisplayMode}
            zoom={zoom}
            selectedElementIds={selectedElementIds}
            pendingConduitStartId={pendingConduitStartId}
            isConnectingConduit={isConnectingConduit}
            isCalibratingUnderlay={isCalibratingUnderlay}
            isAddingDimension={isAddingDimension}
            isSnapEnabled={isSnapEnabled}
            isNodeDragBlocked={isNodeDragBlocked}
            activeNodeDragRef={activeNodeDragRef}
            isDraggingObjectRef={isDraggingObjectRef}
            lastDragEndTimeRef={lastDragEndTimeRef}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onUpdateElement={updateElectricalElement}
            onSelectElementAfterDrag={handleSelectElementAfterDrag}
            onElectricalElementClick={onElectricalElementClick}
            onElectricalElementDoubleClick={onElectricalElementDoubleClick}
          />
          <PanelsLayer
            panels={activeLevelPanels}
            circuits={project.circuits}
            walls={activeLevelWalls}
            verticesMap={verticesMap}
            zoom={zoom}
            selectedPanelIds={selectedPanelIds}
            pendingConduitStartId={pendingConduitStartId}
            isConnectingConduit={isConnectingConduit}
            isCalibratingUnderlay={isCalibratingUnderlay}
            isAddingDimension={isAddingDimension}
            isSnapEnabled={isSnapEnabled}
            isNodeDragBlocked={isNodeDragBlocked}
            activeNodeDragRef={activeNodeDragRef}
            isDraggingObjectRef={isDraggingObjectRef}
            lastDragEndTimeRef={lastDragEndTimeRef}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onUpdatePanel={updatePanel}
            onSelectPanelAfterDrag={handleSelectPanelAfterDrag}
            onElectricalElementClick={onElectricalElementClick}
            onElectricalElementDoubleClick={onElectricalElementDoubleClick}
            onPanelClick={onPanelClick}
            onPanelDoubleClick={onPanelDoubleClick}
          />
          <DimensionsLayer
            dimensions={activeLevelDimensions}
            showDimensions={showDimensions}
            zoom={zoom}
            selectedDimensionId={selectedEntity?.type === 'dimension' ? selectedEntity.id : null}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onSelectDimension={handleSelectDimension}
            onDeleteDimension={deleteDimensionLine}
          />
          <SmartGuidesLayer activeDrag={activeDrag} activeSnapResult={activeSnapResult} zoom={zoom} />

          {detectedPatternMatches.length > 0 && underlaySheet && (
            <PatternMatchesLayer matches={detectedPatternMatches} underlaySheet={underlaySheet} zoom={zoom} onDismiss={onDismissPatternMatch} />
          )}

          <PatternSamplingOverlayLayer
            isSamplingPattern={isSamplingPattern}
            isAdjustingSampleBox={isAdjustingSampleBox}
            patternSamplingMode={patternSamplingMode}
            positiveExemplarsCount={positiveExemplarsCount}
            stencilSizeWorld={stencilSizeWorld}
            stencilRotationDeg={stencilRotationDeg}
            isStencilSnapped={isStencilSnapped}
            hoverWorldPos={hoverWorldPos}
            samplingStartWorldPos={samplingStartWorldPos}
            provisionalSquareBox={provisionalSquareBox}
            zoom={zoom}
            onStartAdjustDrag={handleStableStartAdjustDrag}
          />

          <InteractiveDraftLayer
            zoom={zoom}
            hoverWorldPos={hoverWorldPos}
            hoverRotationDeg={hoverRotationDeg}
            isAddingDimension={isAddingDimension}
            dimensionP1={dimensionP1}
            isDrawingOverhang={isDrawingOverhang}
            overhangP1={overhangP1}
            isMovingSpace={isMovingSpace}
            movingSpace={movingSpace}
            movingBasePoint={movingBasePoint}
            verticesMap={verticesMap}
            isCalibratingUnderlay={isCalibratingUnderlay}
            calibrationP1={calibrationP1}
            isConnectingConduit={isConnectingConduit}
            pendingConduitStartNode={pendingConduitStartNode}
            pendingConduitWaypoints={pendingConduitWaypoints}
            sequenceRoutingMode={sequenceRoutingMode}
            sequenceRoutingPlane={sequenceRoutingPlane}
            selectedSymbolId={selectedSymbolId}
            activeSnapInfo={activeSnapInfo}
            isSnappedToCenter={isSnappedToCenter}
            isSnappedToPatternMatch={isSnappedToPatternMatch}
          />
        </g>
      </svg>

      <CanvasModeBanners
        isDesktop={isDesktop}
        isConnectingConduit={isConnectingConduit}
        pendingConduitStartId={pendingConduitStartId}
        pendingConduitWaypoints={pendingConduitWaypoints}
        sequenceRoutingMode={sequenceRoutingMode}
        hoverWorldPos={hoverWorldPos}
        elementsMap={elementsMap}
        onUndoConduitWaypoint={onUndoConduitWaypoint}
        onClearConduitWaypoints={onClearConduitWaypoints}
        onSetSequenceRoutingMode={setSequenceRoutingMode}
        onCommitConduitWithTerminalReference={onCommitConduitWithTerminalReference}
        onCancelConnectingConduit={onCancelConnectingConduit}
        isCalibratingUnderlay={isCalibratingUnderlay}
        calibrationP1={calibrationP1}
        onCancelCalibration={onCancelCalibration}
        isAddingDimension={isAddingDimension}
        dimensionP1={dimensionP1}
        onCancelAddingDimension={onCancelAddingDimension}
        isDrawingOverhang={isDrawingOverhang}
        overhangP1={overhangP1}
        onCancelDrawingOverhang={onCancelDrawingOverhang}
        isMovingSpace={isMovingSpace}
        movingBasePoint={movingBasePoint}
        onCancelMovingSpace={onCancelMovingSpace}
        isAdjustingSampleBox={isAdjustingSampleBox}
        hasProvisionalSquareBox={Boolean(provisionalSquareBox)}
        onConfirmProvisionalSampleBox={onConfirmProvisionalSampleBox}
        onCancelProvisionalSampleBox={onCancelProvisionalSampleBox}
        isSamplingPattern={isSamplingPattern}
        onCancelSamplingPattern={onCancelSamplingPattern}
      />

      <CanvasFloatingControls
        isDesktop={isDesktop}
        showDimensions={showDimensions}
        isAddingDimension={isAddingDimension}
        isArchitectureLocked={isArchitectureLocked}
        isSnapEnabled={isSnapEnabled}
        isCalibratingUnderlay={isCalibratingUnderlay}
        isSamplingPattern={isSamplingPattern}
        underlaySheet={underlaySheet}
        selectedSymbolId={selectedSymbolId}
        verticesCount={project.vertices.length}
        activeAnchorVertex={activeAnchorVertex}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRecenter={handleStableRecenter}
        onToggleDimensions={toggleDimensions}
        onToggleAddingDimension={onToggleAddingDimension}
        onToggleLockArchitecture={onToggleLockArchitecture}
        onToggleSnap={onToggleSnap}
        onToggleUnderlayVisibility={onToggleUnderlayVisibility}
        onCycleUnderlayOpacity={onCycleUnderlayOpacity}
        onStartUnderlayCalibration={onStartUnderlayCalibration}
        onOpenAdjustUnderlay={onOpenAdjustUnderlay}
        onStartPatternSampling={onStartPatternSampling}
        onCancelSamplingPattern={onCancelSamplingPattern}
      />
    </div>
  );
};
