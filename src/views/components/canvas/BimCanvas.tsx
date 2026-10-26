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
import { AeaCanvasSymbol } from '../electrical/AeaSymbolIcon';
import { getSymbolById } from '../../../models/electrical/symbolsLib';
import { Plus, Minus, Maximize2, Ruler, Eye, EyeOff, DraftingCompass, ScanSearch, Lock, Unlock } from 'lucide-react';
import { CAD_VIEWPORT_CONFIG } from '../../../config';
import type { UnderlaySheet } from '../../../models/underlay/UnderlaySheet';
import type { DetectedPatternMatch } from '../../../models/underlay/PatternDetector';
import {
  generateRoundedPolylineSvgPath,
  computeOrthogonalConduitPoints
} from '../../../models/electrical/calculations';
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
import type { ActiveNodeDragState, ActiveWaypointDragState } from './layers/layerTypes';

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
  type AdjustHandle = 'nw' | 'ne' | 'se' | 'sw' | 'move' | null;
  const [activeAdjustHandle, setActiveAdjustHandle] = useState<AdjustHandle>(null);
  const adjustDragStartRef = useRef<{ clientX: number; clientY: number; initBox: { x: number; y: number; size: number } } | null>(null);

  const startAdjustDrag = (handle: AdjustHandle, clientX: number, clientY: number) => {
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

          {/* Retícula en cruz CAD extendida para alineación ortogonal precisa (Ejes X e Y infinitos) */}
          {isSamplingPattern && hoverWorldPos && (
            <g pointerEvents="none">
              {/* Eje horizontal infinito */}
              <line
                x1={-100000}
                y1={hoverWorldPos.y * zoom}
                x2={100000}
                y2={hoverWorldPos.y * zoom}
                stroke={isStencilSnapped ? "#10b981" : "#06b6d4"}
                strokeWidth={1}
                strokeDasharray="6 4"
                strokeOpacity={0.6}
              />
              {/* Eje vertical infinito */}
              <line
                x1={hoverWorldPos.x * zoom}
                y1={-100000}
                x2={hoverWorldPos.x * zoom}
                y2={100000}
                stroke={isStencilSnapped ? "#10b981" : "#06b6d4"}
                strokeWidth={1}
                strokeDasharray="6 4"
                strokeOpacity={0.6}
              />
              {/* Retícula central sólida de mira CAD extendida (90px) con anillo de precisión */}
              <circle
                cx={hoverWorldPos.x * zoom}
                cy={hoverWorldPos.y * zoom}
                r={6}
                fill="none"
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={1.5}
              />
              <line
                x1={hoverWorldPos.x * zoom - 45}
                y1={hoverWorldPos.y * zoom}
                x2={hoverWorldPos.x * zoom - 8}
                y2={hoverWorldPos.y * zoom}
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={1.5}
              />
              <line
                x1={hoverWorldPos.x * zoom + 8}
                y1={hoverWorldPos.y * zoom}
                x2={hoverWorldPos.x * zoom + 45}
                y2={hoverWorldPos.y * zoom}
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={1.5}
              />
              <line
                x1={hoverWorldPos.x * zoom}
                y1={hoverWorldPos.y * zoom - 45}
                x2={hoverWorldPos.x * zoom}
                y2={hoverWorldPos.y * zoom - 8}
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={1.5}
              />
              <line
                x1={hoverWorldPos.x * zoom}
                y1={hoverWorldPos.y * zoom + 8}
                x2={hoverWorldPos.x * zoom}
                y2={hoverWorldPos.y * zoom + 45}
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Caja indicadora del objetivo para Auto-muestreo inteligente (1 clic) */}
          {isSamplingPattern && patternSamplingMode === 'auto' && hoverWorldPos && (
            <g pointerEvents="none">
              <rect
                x={(hoverWorldPos.x - (stencilSizeWorld?.width || 0.45) / 2) * zoom}
                y={(hoverWorldPos.y - (stencilSizeWorld?.width || 0.45) / 2) * zoom}
                width={(stencilSizeWorld?.width || 0.45) * zoom}
                height={(stencilSizeWorld?.width || 0.45) * zoom}
                fill="rgba(6, 182, 212, 0.12)"
                stroke="#06b6d4"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                rx={4}
              />
            </g>
          )}

          {/* Recuadro elástico de selección de patrón (Marquesina Muestra #1) */}
          {isSamplingPattern && !isAdjustingSampleBox && (!positiveExemplarsCount || positiveExemplarsCount === 0) && samplingStartWorldPos && hoverWorldPos && (
            <g pointerEvents="none">
              <rect
                x={Math.min(samplingStartWorldPos.x, hoverWorldPos.x) * zoom}
                y={Math.min(samplingStartWorldPos.y, hoverWorldPos.y) * zoom}
                width={Math.abs(hoverWorldPos.x - samplingStartWorldPos.x) * zoom}
                height={Math.abs(hoverWorldPos.y - samplingStartWorldPos.y) * zoom}
                fill="rgba(6, 182, 212, 0.20)"
                stroke="#0891b2"
                strokeWidth={2}
                strokeDasharray="5 3"
                rx={2}
              />
              <text
                x={((samplingStartWorldPos.x + hoverWorldPos.x) / 2) * zoom}
                y={(Math.min(samplingStartWorldPos.y, hoverWorldPos.y) - 0.15) * zoom}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill="#0891b2"
                className="font-mono bg-white select-none"
              >
                🎯 Muestra #1: Enmarcar símbolo base
              </text>
            </g>
          )}

          {/* Recuadro interactivo de ajuste fino para la Muestra #1 (Trazar -> Ajustar -> Confirmar) */}
          {isAdjustingSampleBox && provisionalSquareBox && (() => {
            const boxX = provisionalSquareBox.x * zoom;
            const boxY = provisionalSquareBox.y * zoom;
            const boxW = provisionalSquareBox.size * zoom;
            const boxH = provisionalSquareBox.size * zoom;
            const cx = boxX + boxW / 2;
            const cy = boxY + boxH / 2;

            return (
              <g className="select-none">
                {/* Zona translúcida de fondo movible */}
                <rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  fill="rgba(6, 182, 212, 0.16)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  rx={3}
                  className="cursor-move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAdjustDrag('move', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) {
                      startAdjustDrag('move', e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                />

                {/* Retícula en cruz milimétrica para centrado exacto sobre el símbolo */}
                <line
                  x1={boxX}
                  y1={cy}
                  x2={boxX + boxW}
                  y2={cy}
                  stroke="#0891b2"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.8}
                  pointerEvents="none"
                />
                <line
                  x1={cx}
                  y1={boxY}
                  x2={cx}
                  y2={boxY + boxH}
                  stroke="#0891b2"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.8}
                  pointerEvents="none"
                />
                <circle cx={cx} cy={cy} r={3} fill="#0891b2" pointerEvents="none" />

                {/* Etiqueta superior */}
                <text
                  x={cx}
                  y={boxY - 10}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="bold"
                  fill="#0891b2"
                  className="font-mono bg-white select-none pointer-events-none"
                >
                  🎯 Muestra #1 ({Math.round(provisionalSquareBox.size * 100)} cm) · Ajustá posición y tamaño
                </text>

                {/* Manija NW */}
                <circle
                  cx={boxX}
                  cy={boxY}
                  r={14}
                  fill="transparent"
                  className="cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAdjustDrag('nw', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startAdjustDrag('nw', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                />
                <rect
                  x={boxX - 5}
                  y={boxY - 5}
                  width={10}
                  height={10}
                  fill="#ffffff"
                  stroke="#0891b2"
                  strokeWidth={2}
                  rx={2}
                  pointerEvents="none"
                />

                {/* Manija NE */}
                <circle
                  cx={boxX + boxW}
                  cy={boxY}
                  r={14}
                  fill="transparent"
                  className="cursor-nesw-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAdjustDrag('ne', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startAdjustDrag('ne', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                />
                <rect
                  x={boxX + boxW - 5}
                  y={boxY - 5}
                  width={10}
                  height={10}
                  fill="#ffffff"
                  stroke="#0891b2"
                  strokeWidth={2}
                  rx={2}
                  pointerEvents="none"
                />

                {/* Manija SE */}
                <circle
                  cx={boxX + boxW}
                  cy={boxY + boxH}
                  r={14}
                  fill="transparent"
                  className="cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAdjustDrag('se', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startAdjustDrag('se', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                />
                <rect
                  x={boxX + boxW - 5}
                  y={boxY + boxH - 5}
                  width={10}
                  height={10}
                  fill="#ffffff"
                  stroke="#0891b2"
                  strokeWidth={2}
                  rx={2}
                  pointerEvents="none"
                />

                {/* Manija SW */}
                <circle
                  cx={boxX}
                  cy={boxY + boxH}
                  r={14}
                  fill="transparent"
                  className="cursor-nesw-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAdjustDrag('sw', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startAdjustDrag('sw', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                />
                <rect
                  x={boxX - 5}
                  y={boxY + boxH - 5}
                  width={10}
                  height={10}
                  fill="#ffffff"
                  stroke="#0891b2"
                  strokeWidth={2}
                  rx={2}
                  pointerEvents="none"
                />
              </g>
            );
          })()}

          {/* Esténcil rígido semitransparente asistido por SVD (Muestras #2 en adelante) */}
          {isSamplingPattern && positiveExemplarsCount > 0 && stencilSizeWorld && hoverWorldPos && (
            <g pointerEvents="none">
              {/* Rectángulo rígido centrado en el cursor/hover */}
              <rect
                x={(hoverWorldPos.x - stencilSizeWorld.width / 2) * zoom}
                y={(hoverWorldPos.y - stencilSizeWorld.height / 2) * zoom}
                width={stencilSizeWorld.width * zoom}
                height={stencilSizeWorld.height * zoom}
                fill={isStencilSnapped ? "rgba(16, 185, 129, 0.22)" : "rgba(6, 182, 212, 0.22)"}
                stroke={isStencilSnapped ? "#10b981" : "#06b6d4"}
                strokeWidth={isStencilSnapped ? 2.5 : 2}
                strokeDasharray={isStencilSnapped ? "none" : "6 3"}
                rx={3}
              />
              {/* Retícula en cruz para centrado visual */}
              <line
                x1={(hoverWorldPos.x - 0.25) * zoom}
                y1={hoverWorldPos.y * zoom}
                x2={(hoverWorldPos.x + 0.25) * zoom}
                y2={hoverWorldPos.y * zoom}
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={isStencilSnapped ? 2 : 1.5}
              />
              <line
                x1={hoverWorldPos.x * zoom}
                y1={(hoverWorldPos.y - 0.25) * zoom}
                x2={hoverWorldPos.x * zoom}
                y2={(hoverWorldPos.y + 0.25) * zoom}
                stroke={isStencilSnapped ? "#10b981" : "#0891b2"}
                strokeWidth={isStencilSnapped ? 2 : 1.5}
              />
              {/* Etiqueta flotante con orientación y aviso de snap magnético */}
              <text
                x={hoverWorldPos.x * zoom}
                y={(hoverWorldPos.y - stencilSizeWorld.height / 2 - 0.15) * zoom}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={isStencilSnapped ? "#059669" : "#0891b2"}
                className="font-mono bg-white select-none"
              >
                {isStencilSnapped
                  ? `🎯 Snap fijado al símbolo (${stencilRotationDeg ?? 0}°) · Clic para confirmar`
                  : `🎯 Sello Muestra #${positiveExemplarsCount + 1} (${stencilRotationDeg ?? 0}°) · Clic para estampar`}
              </text>
            </g>
          )}

          {/* Línea elástica interactiva al trazar cotas métricas */}
          {isAddingDimension && dimensionP1 && (
            <g pointerEvents="none">
              {hoverWorldPos && (
                <>
                  <line
                    x1={dimensionP1.x * zoom}
                    y1={dimensionP1.y * zoom}
                    x2={hoverWorldPos.x * zoom}
                    y2={hoverWorldPos.y * zoom}
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={hoverWorldPos.x * zoom}
                    cy={hoverWorldPos.y * zoom}
                    r={5}
                    fill="#2563eb"
                  />
                  <text
                    x={((dimensionP1.x + hoverWorldPos.x) / 2) * zoom}
                    y={((dimensionP1.y + hoverWorldPos.y) / 2) * zoom - 8}
                    textAnchor="middle"
                    fontSize={11}
                    className="font-mono font-bold fill-blue-700 bg-white"
                  >
                    {Math.hypot(hoverWorldPos.x - dimensionP1.x, hoverWorldPos.y - dimensionP1.y).toFixed(2)} m
                  </text>
                </>
              )}
              {/* Punto 1 marcado */}
              <circle
                cx={dimensionP1.x * zoom}
                cy={dimensionP1.y * zoom}
                r={6}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Línea elástica interactiva al trazar línea de alero (2 clics) */}
          {isDrawingOverhang && overhangP1 && (
            <g pointerEvents="none">
              {hoverWorldPos && (
                <>
                  <line
                    x1={overhangP1.x * zoom}
                    y1={overhangP1.y * zoom}
                    x2={hoverWorldPos.x * zoom}
                    y2={hoverWorldPos.y * zoom}
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="8 3 2 3"
                  />
                  <circle
                    cx={hoverWorldPos.x * zoom}
                    cy={hoverWorldPos.y * zoom}
                    r={5}
                    fill="#0284c7"
                  />
                  <text
                    x={((overhangP1.x + hoverWorldPos.x) / 2) * zoom}
                    y={((overhangP1.y + hoverWorldPos.y) / 2) * zoom - 8}
                    textAnchor="middle"
                    fontSize={11}
                    className="font-mono font-bold fill-cyan-700 bg-white"
                  >
                    Arista de Alero ({Math.hypot(hoverWorldPos.x - overhangP1.x, hoverWorldPos.y - overhangP1.y).toFixed(2)} m)
                  </text>
                </>
              )}
              {/* Punto 1 marcado */}
              <circle
                cx={overhangP1.x * zoom}
                cy={overhangP1.y * zoom}
                r={6}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Vista previa elástica y contorno fantasma al mover ambiente (punto base + destino) */}
          {isMovingSpace && movingSpaceId && (() => {
            const movingSpace = project.spaces.find((s) => s.id === movingSpaceId);
            if (!movingSpace) return null;
            const movingPoly = resolveSpacePolygon(movingSpace, verticesMap);
            if (movingPoly.length < 3) return null;

            return (
              <g pointerEvents="none">
                {/* Punto base marcado */}
                {movingBasePoint && (
                  <g>
                    <circle
                      cx={movingBasePoint.x * zoom}
                      cy={movingBasePoint.y * zoom}
                      r={6}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <circle
                      cx={movingBasePoint.x * zoom}
                      cy={movingBasePoint.y * zoom}
                      r={10}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                  </g>
                )}

                {/* Polígono fantasma desplazado hacia el cursor */}
                {movingBasePoint && hoverWorldPos && (() => {
                  const dx = hoverWorldPos.x - movingBasePoint.x;
                  const dy = hoverWorldPos.y - movingBasePoint.y;
                  const ghostPoints = movingPoly
                    .map((p) => `${(p.x + dx) * zoom},${(p.y + dy) * zoom}`)
                    .join(' ');

                  return (
                    <g>
                      {/* Contorno fantasma traslúcido */}
                      <polygon
                        points={ghostPoints}
                        fill="rgba(59, 130, 246, 0.18)"
                        stroke="#2563eb"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                      />

                      {/* Vector elástico desde punto base hasta cursor */}
                      <line
                        x1={movingBasePoint.x * zoom}
                        y1={movingBasePoint.y * zoom}
                        x2={hoverWorldPos.x * zoom}
                        y2={hoverWorldPos.y * zoom}
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                      />

                      {/* Marcador en la posición destino proyectada */}
                      <circle
                        cx={hoverWorldPos.x * zoom}
                        cy={hoverWorldPos.y * zoom}
                        r={5}
                        fill="#1d4ed8"
                      />

                      {/* Rótulo de desplazamiento delta */}
                      <text
                        x={((movingBasePoint.x + hoverWorldPos.x) / 2) * zoom}
                        y={((movingBasePoint.y + hoverWorldPos.y) / 2) * zoom - 8}
                        textAnchor="middle"
                        fontSize={11}
                        className="font-mono font-bold fill-blue-800 bg-white"
                      >
                        ΔX: {dx >= 0 ? '+' : ''}{dx.toFixed(2)}m, ΔY: {dy >= 0 ? '+' : ''}{dy.toFixed(2)}m ({Math.hypot(dx, dy).toFixed(2)}m)
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })()}

          {/* Línea elástica y marcas de calibración métrica del plano de fondo */}
          {isCalibratingUnderlay && calibrationP1 && (
            <g pointerEvents="none">
              {hoverWorldPos && (
                <>
                  <line
                    x1={calibrationP1.x * zoom}
                    y1={calibrationP1.y * zoom}
                    x2={hoverWorldPos.x * zoom}
                    y2={hoverWorldPos.y * zoom}
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                  />
                  <circle
                    cx={hoverWorldPos.x * zoom}
                    cy={hoverWorldPos.y * zoom}
                    r={5}
                    fill="#0284c7"
                  />
                  <text
                    x={((calibrationP1.x + hoverWorldPos.x) / 2) * zoom}
                    y={((calibrationP1.y + hoverWorldPos.y) / 2) * zoom - 8}
                    textAnchor="middle"
                    fontSize={11}
                    className="font-mono font-bold fill-sky-700 bg-white"
                  >
                    {Math.hypot(hoverWorldPos.x - calibrationP1.x, hoverWorldPos.y - calibrationP1.y).toFixed(2)} m
                  </text>
                </>
              )}
              {/* Punto 1 marcado */}
              <circle
                cx={calibrationP1.x * zoom}
                cy={calibrationP1.y * zoom}
                r={6}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Línea o arco elástico interactivo guiando al usuario hacia el segundo extremo */}
          {isConnectingConduit && pendingConduitStartId && hoverWorldPos && (() => {
            const startEl =
              project.electricalElements.find((e) => e.id === pendingConduitStartId) ||
              project.panels?.find((p) => p.id === pendingConduitStartId);
            if (!startEl) return null;
            const p1 = { x: startEl.x * zoom, y: startEl.y * zoom };
            const pEnd = { x: hoverWorldPos.x * zoom, y: hoverWorldPos.y * zoom };
            const waypointsPx = (pendingConduitWaypoints || []).map((wp) => ({
              x: wp.x * zoom,
              y: wp.y * zoom
            }));

            const isArc = sequenceRoutingMode === 'schematic_arc';
            let guidePathD: string;

            if (isArc) {
              const dx = pEnd.x - p1.x;
              const dy = pEnd.y - p1.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 1) return null;
              const normalX = -dy / dist;
              const normalY = dx / dist;
              const curveOffset = Math.min(dist * 0.18, 28);
              const midX = (p1.x + pEnd.x) / 2 + normalX * curveOffset;
              const midY = (p1.y + pEnd.y) / 2 + normalY * curveOffset;
              guidePathD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)}`;
            } else if (sequenceRoutingMode === 'orthogonal' && sequenceRoutingPlane === 'wall') {
              const orthoPoints = computeOrthogonalConduitPoints(p1, pEnd, waypointsPx);
              const filletRadiusPx = Math.min(22, Math.max(8, 14 * (zoom / 40)));
              guidePathD = generateRoundedPolylineSvgPath(orthoPoints, filletRadiusPx);
            } else {
              const allPts = [p1, ...waypointsPx, pEnd];
              guidePathD = `M ${allPts[0].x.toFixed(1)} ${allPts[0].y.toFixed(1)} ` + allPts.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            }

            return (
              <g pointerEvents="none">
                {/* Trazo elástico de la cañería */}
                <path
                  d={guidePathD}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                />
                {/* Marcadores visuales para cada vértice intermedio ya fijado (solo en modos no-arco) */}
                {!isArc && waypointsPx.map((wp, idx) => (
                  <g key={`pending-wp-${idx}`}>
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={5}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.8}
                    />
                    <rect
                      x={wp.x + 6}
                      y={wp.y - 14}
                      width={18}
                      height={12}
                      rx={3}
                      fill="#0f172a"
                      fillOpacity={0.85}
                    />
                    <text
                      x={wp.x + 9}
                      y={wp.y - 5}
                      fontSize={8}
                      fill="#fbbf24"
                      className="font-mono font-bold select-none"
                    >
                      P{idx + 1}
                    </text>
                  </g>
                ))}
                {/* Punto cursor objetivo */}
                <circle
                  cx={pEnd.x}
                  cy={pEnd.y}
                  r={6}
                  fill="#f59e0b"
                  opacity={0.8}
                />
              </g>
            );
          })()}

          {/* Previsualización del elemento eléctrico que sigue al cursor (Ghost preview con snap al centro, a pared o a símbolo detectado) */}
          {selectedSymbolId && hoverWorldPos && (
            <g
              transform={`translate(${hoverWorldPos.x * zoom}, ${hoverWorldPos.y * zoom})`}
              className="pointer-events-none opacity-90"
            >
              <AeaCanvasSymbol
                symbolId={selectedSymbolId}
                zoom={zoom}
                isSelected={true}
                elementLabel={
                  isSnappedToPatternMatch
                    ? 'Símbolo 🎯'
                    : activeSnapInfo
                    ? 'Pared'
                    : isSnappedToCenter
                    ? 'Centro'
                    : undefined
                }
                rotationDeg={hoverRotationDeg}
              />
              {isSnappedToPatternMatch && (
                <circle r={22} fill="none" stroke="#06b6d4" strokeWidth={2.5} strokeDasharray="5 3" />
              )}
              {activeSnapInfo && !isSnappedToPatternMatch && (
                <circle r={18} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="3 3" />
              )}
              {isSnappedToCenter && !isSnappedToPatternMatch && (
                <circle r={26} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 3" />
              )}
            </g>
          )}
        </g>
      </svg>

      {/* Banner / Píldora superior cuando se conecta cañería (visible solo en escritorio) */}
      {isConnectingConduit && isDesktop && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-3.5 pr-2 py-1.5 rounded-full shadow-xl border border-amber-500/50 flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="truncate max-w-[280px] sm:max-w-none">
            {!pendingConduitStartId
              ? '⚡ Trazar Canalización: Tocá la primera boca o tablero'
              : sequenceRoutingMode === 'schematic_arc'
              ? '⚡ 1° Extremo fijado · Tocá la boca o tablero de destino'
              : (pendingConduitWaypoints?.length || 0) === 0
              ? '⚡ 1° Extremo fijado · Clic en plano para quiebre o en boca para cerrar'
              : `⚡ Recorrido (${pendingConduitWaypoints?.length} quiebres) · Clic para sumar quiebre o en boca final`}
          </span>
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            {sequenceRoutingMode !== 'schematic_arc' && (pendingConduitWaypoints?.length || 0) > 0 && onUndoConduitWaypoint && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUndoConduitWaypoint();
                }}
                className="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-600 hover:bg-amber-800 text-amber-300 text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                title="Deshacer último quiebre del recorrido"
              >
                <span>↶ Deshacer</span>
                <span className="bg-amber-800/80 px-1 rounded text-[10px]">{pendingConduitWaypoints?.length}</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextMode = sequenceRoutingMode === 'orthogonal' ? 'schematic_arc' : 'orthogonal';
                setSequenceRoutingMode(nextMode);
                if (nextMode === 'schematic_arc') {
                  onClearConduitWaypoints?.();
                }
              }}
              className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 hover:bg-slate-700 text-amber-300 text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap"
              title="Alternar entre Arco Curvo AEA y Trazado Ortogonal a 90°"
            >
              {sequenceRoutingMode === 'orthogonal' ? '📐 90° Ortogonal' : '⌒ Arco AEA'}
            </button>
            {onCommitConduitWithTerminalReference && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  let targetPos: { x: number; y: number } | null = hoverWorldPos;
                  if (!targetPos && pendingConduitWaypoints && pendingConduitWaypoints.length > 0) {
                    targetPos = pendingConduitWaypoints[pendingConduitWaypoints.length - 1];
                  }
                  if (!targetPos && pendingConduitStartId) {
                    const start = elementsMap.get(pendingConduitStartId);
                    if (start) {
                      targetPos = { x: start.x + 1.0, y: start.y };
                    }
                  }
                  if (targetPos) {
                    onCommitConduitWithTerminalReference(targetPos);
                  }
                }}
                className="px-2 py-0.5 rounded-full bg-sky-950/90 border border-sky-600 hover:bg-sky-800 text-sky-300 text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                title="Rematar cañería en una etiqueta de referencia / pase a montante"
              >
                <span>➔ Rematar Etiqueta</span>
              </button>
            )}
            {onCancelConnectingConduit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelConnectingConduit();
                }}
                className="p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white text-[11px] transition-colors cursor-pointer ml-0.5"
                title="Cancelar conexión de canalización (Esc)"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Banner / Píldora superior durante calibración de plano de fondo */}
      {isCalibratingUnderlay && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-sky-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span>
            {calibrationP1
              ? '📏 1° punto fijado · Tocá el segundo punto de la cota conocida'
              : '📏 Calibrar Escala: Tocá el primer punto de una cota conocida del plano'}
          </span>
          {onCancelCalibration && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelCalibration();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar calibración"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Banner / Píldora superior durante trazado de cota libre */}
      {isAddingDimension && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-blue-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
          <span>
            {dimensionP1
              ? '📐 1° punto fijado · Hacé clic en el segundo punto de la cota'
              : '📐 Trazar Cota: Hacé clic en el primer punto a medir'}
          </span>
          {onCancelAddingDimension && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelAddingDimension();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar trazado de cota"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Banner / Píldora superior durante trazado de alero / techo parcial */}
      {isDrawingOverhang && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-cyan-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>
            {overhangP1
              ? '☂ 1° punto fijado · Hacé clic en el segundo punto de la arista del alero'
              : '☂ Trazar Alero: Hacé clic en el primer punto de la arista del techo'}
          </span>
          {onCancelDrawingOverhang && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelDrawingOverhang();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar trazado de alero"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Banner / Píldora superior durante reubicación de ambiente */}
      {isMovingSpace && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-blue-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
          <span>
            {movingBasePoint
              ? `⚓ Punto Base: (${movingBasePoint.x.toFixed(2)}, ${movingBasePoint.y.toFixed(2)}) m · Clic en el destino para reubicar`
              : '⚓ Mover Ambiente: Clic en el plano para definir el Punto Base'}
          </span>
          {onCancelMovingSpace && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelMovingSpace();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar movimiento (Esc)"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Banner / Píldora superior durante ajuste fino interactivo de Muestra #1 */}
      {isAdjustingSampleBox && provisionalSquareBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-2xl border border-cyan-400/60 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>📐 Ajustá posición y tamaño de la muestra base</span>
          {onConfirmProvisionalSampleBox && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmProvisionalSampleBox();
              }}
              className="ml-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-full shadow transition-colors cursor-pointer flex items-center gap-1"
              title="Confirmar muestra base (Enter)"
            >
              ✓ Confirmar (Enter)
            </button>
          )}
          {onCancelProvisionalSampleBox && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelProvisionalSampleBox();
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] rounded-full border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar ajuste (Esc)"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Banner / Píldora superior durante selección con recuadro para detectar símbolos */}
      {isSamplingPattern && !isAdjustingSampleBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-cyan-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>🎯 Arrastrá un recuadro sobre el símbolo del plano para detectarlo en toda la planta</span>
          {onCancelSamplingPattern && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelSamplingPattern();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar detección"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Botonera flotante CAD (Desktop completa vs Móvil ultra-compacta) */}
      {isDesktop ? (
        <div
          className="absolute top-4 right-4 flex flex-col gap-1.5 z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(CAD_VIEWPORT_CONFIG.MAX_ZOOM_PIXELS_PER_METER, Number((z * CAD_VIEWPORT_CONFIG.ZOOM_STEP_FACTOR).toFixed(1))))}
            className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
            title="Acercar (+)"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(CAD_VIEWPORT_CONFIG.MIN_ZOOM_PIXELS_PER_METER, Number((z / CAD_VIEWPORT_CONFIG.ZOOM_STEP_FACTOR).toFixed(1))))}
            className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
            title="Alejar (-)"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
            title="Recentrar y encuadrar plano"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={toggleDimensions}
            className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
              showDimensions
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/90 text-slate-400 border-slate-200 hover:text-slate-700'
            }`}
            title={showDimensions ? 'Ocultar cotas métricas' : 'Mostrar cotas métricas'}
          >
            <Ruler size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleAddingDimension}
            className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
              isAddingDimension
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
            }`}
            title={isAddingDimension ? 'Cancelar trazado de cota' : 'Trazar cota métrica libre (2 clics)'}
          >
            <DraftingCompass size={16} />
          </button>

          {onToggleLockArchitecture && (
            <button
              type="button"
              onClick={onToggleLockArchitecture}
              className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                isArchitectureLocked
                  ? 'bg-amber-600 text-white border-amber-700 shadow-amber-200 ring-2 ring-amber-400'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
              }`}
              title={
                isArchitectureLocked
                  ? 'Arquitectura bloqueada (clic para desbloquear muros)'
                  : 'Bloquear arquitectura (inmunizar muros contra toques accidentales)'
              }
            >
              {isArchitectureLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
          )}

          {/* Controles de Lámina de Fondo y Snap Analítico (solo si hay plano cargado) */}
          {underlaySheet && (
            <>
              <div className="h-px bg-slate-200 my-0.5" />
              {onToggleSnap && (
                <button
                  type="button"
                  onClick={onToggleSnap}
                  className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                    isSnapEnabled
                      ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200'
                      : 'bg-white/90 text-slate-400 border-slate-200 hover:text-slate-600'
                  }`}
                  title={
                    isSnapEnabled
                      ? 'Snap magnético activado (tecla S para desactivar, o mantener Shift)'
                      : 'Snap magnético desactivado (tecla S para activar)'
                  }
                >
                  <span className="text-sm select-none">🧲</span>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleUnderlayVisibility}
                className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                  underlaySheet.visible
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white/90 text-slate-400 border-slate-200 hover:text-slate-700'
                }`}
                title={underlaySheet.visible ? 'Ocultar plano de fondo' : 'Mostrar plano de fondo'}
              >
                {underlaySheet.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                type="button"
                onClick={onCycleUnderlayOpacity}
                className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all text-[11px] font-mono font-bold"
                title={`Opacidad del plano: ${Math.round(underlaySheet.opacity * 100)}% (clic para cambiar)`}
              >
                {Math.round(underlaySheet.opacity * 100)}%
              </button>
              <button
                type="button"
                onClick={onStartUnderlayCalibration}
                className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                  isCalibratingUnderlay
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
                }`}
                title="Recalibrar escala métrica (2 clics)"
              >
                📏
              </button>
              {onOpenAdjustUnderlay && (
                <button
                  type="button"
                  onClick={onOpenAdjustUnderlay}
                  className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all text-xs font-bold"
                  title="Ajustar plano de fondo (rotar / recortar)"
                >
                  ✂️
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isSamplingPattern) {
                    onCancelSamplingPattern?.();
                  } else {
                    onStartPatternSampling?.();
                  }
                }}
                className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                  isSamplingPattern
                    ? 'bg-cyan-600 text-white border-cyan-700 shadow-cyan-200 ring-2 ring-cyan-400'
                    : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
                }`}
                title={
                  isSamplingPattern
                    ? 'Desactivar detección de patrones'
                    : 'Detectar símbolos similares en plano con autovectores (selección con recuadro)'
                }
              >
                <ScanSearch size={16} />
              </button>
            </>
          )}
        </div>
      ) : (
        /* En Móvil: Barra CAD compacta y ergonómica (Cero invasión visual) */
        <div
          className="absolute top-3 right-3 flex flex-col gap-1.5 z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Botón Recentrar Encuadre */}
          <button
            type="button"
            onClick={handleRecenter}
            className="w-8 h-8 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 transition-all"
            title="Recentrar y encuadrar plano"
          >
            <Maximize2 size={15} />
          </button>

          {/* Botón Bloquear Arquitectura (Vital en móvil para no mover muros por error) */}
          {onToggleLockArchitecture && (
            <button
              type="button"
              onClick={onToggleLockArchitecture}
              className={`w-8 h-8 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                isArchitectureLocked
                  ? 'bg-amber-600 text-white border-amber-700 shadow-amber-200 ring-2 ring-amber-400'
                  : 'bg-white/90 text-slate-700 border-slate-200'
              }`}
              title={isArchitectureLocked ? 'Desbloquear arquitectura' : 'Bloquear arquitectura'}
            >
              {isArchitectureLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          )}

          {/* Trazar cota libre (si está activa la herramienta de cotas) */}
          {isAddingDimension && (
            <button
              type="button"
              onClick={onToggleAddingDimension}
              className="w-8 h-8 bg-blue-600 text-white border border-blue-700 shadow-md rounded-xl flex items-center justify-center active:scale-95 transition-all"
              title="Cancelar cota libre"
            >
              <DraftingCompass size={15} />
            </button>
          )}

          {/* Si hay lámina de fondo: Botón rápido de Snap Magnético */}
          {underlaySheet && onToggleSnap && (
            <button
              type="button"
              onClick={onToggleSnap}
              className={`w-8 h-8 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                isSnapEnabled
                  ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200'
                  : 'bg-white/90 text-slate-400 border-slate-200'
              }`}
              title="Snap magnético"
            >
              <span className="text-xs select-none">🧲</span>
            </button>
          )}
        </div>
      )}

      {/* Aviso móvil superior al tener boca seleccionada (posicionado debajo de la barra de estado) */}
      {selectedSymbolId && !isDesktop && (
        <div className="absolute top-3 left-4 right-14 bg-blue-600/95 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-lg truncate pointer-events-none z-10 animate-in fade-in slide-in-from-top-1">
          📍 Tocá plano o muro para emplazar {getSymbolById(selectedSymbolId)?.label || 'Boca'}
        </div>
      )}

      {/* Indicador de ayuda de escritorio */}
      <div className="hidden lg:flex absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-xs font-mono text-slate-700 pointer-events-none items-center gap-2">
        {selectedSymbolId ? (
          <span className="text-blue-700 font-bold">
            📍 Multi-inserción: Clic para emplazar · Esc para salir · S: Snap {isSnapEnabled ? 'ON' : 'OFF'} (Shift para liberar)
          </span>
        ) : project.vertices.length === 0 ? (
          'Tocá cualquier parte del lienzo para plantar el punto de inicio'
        ) : activeAnchorVertex ? (
          `Anclaje seleccionado: (${activeAnchorVertex.x}, ${activeAnchorVertex.y}) m`
        ) : (
          'Tocá un vértice o esquina para anclar la siguiente pared'
        )}
      </div>
    </div>
  );
};
