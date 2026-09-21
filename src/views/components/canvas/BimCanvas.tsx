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
import { getWallPolygon, getWallLength, calculateWallSnap } from '../../../models/architecture/Wall';
import { getOpeningJambs } from '../../../models/architecture/Opening';
import { resolveSpacePolygon, calculatePolygonArea, calculatePolygonCentroid } from '../../../models/architecture/Space';
import { AeaCanvasSymbol } from '../electrical/AeaSymbolIcon';
import { Plus, Minus, Maximize2, Ruler, Eye, EyeOff, DraftingCompass, ScanSearch, Lock, Unlock } from 'lucide-react';
import type { UnderlaySheet } from '../../../models/underlay/UnderlaySheet';
import { DIMENSION_CONSTANTS, formatDimensionText } from '../../../models/architecture/DimensionLine';
import type { DetectedPatternMatch } from '../../../models/underlay/PatternDetector';
import {
  generateRoundedPolylineSvgPath,
  computeOrthogonalConduitPoints,
  getConduitVerticalTransitions,
  formatElementLabel,
  calculateConduitRealLength
} from '../../../models/electrical/calculations';
import { useElectricalSequenceStore } from '../../../viewmodels/useElectricalViewModel';
import type { SpatialElectricalNode, ConduitWaypoint } from '../../../models/electrical/ElectricalModel';

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
  onOpeningClick?: (openingId: string) => void;
  onSpaceClick?: (spaceId: string) => void;
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
  onOpeningClick,
  onSpaceClick,
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
    labelDisplayMode
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
  const [zoom, setZoom] = useState(60); // 60 píxeles = 1 metro
  const [pan, setPan] = useState({ x: 150, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const justCompletedSamplingRef = useRef(false);
  const activeWaypointDragRef = useRef<{
    conduitId: string;
    wpIndex: number;
    startX: number;
    startY: number;
    origWpX: number;
    origWpY: number;
    moved: boolean;
  } | null>(null);
  const isDraggingObjectRef = useRef<boolean>(false);

  // Control para evitar clics espurios al finalizar un gesto de arrastre o paneo
  const lastDragEndTimeRef = useRef<number>(0);
  const wasDraggingRecently = () => Date.now() - lastDragEndTimeRef.current < 200;
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
      setPan({ x: 150, y: 150 });
      setZoom(60);
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

  const handleTouchEnd = () => {
    if (activeWaypointDragRef.current) {
      activeWaypointDragRef.current = null;
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

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (wasDraggingRecentlyRef.current()) return;
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

  // 1. Ambientes detectados
  const renderedSpaces = useMemo(() => {
    return project.spaces
      .filter((s) => s.levelId === project.activeLevelId)
      .map((space) => {
        const poly = resolveSpacePolygon(space, verticesMap);
        if (poly.length < 3) return null;

        const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
        const area = calculatePolygonArea(poly);
        const centroid = calculatePolygonCentroid(poly);

        return (
          <g
            key={space.id}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onSpaceClick?.(space.id);
            }}
            className="cursor-pointer"
          >
            <polygon points={pointsStr} fill="rgba(241, 245, 249, 0.75)" stroke="none" />
            <text
              x={centroid.x * zoom}
              y={centroid.y * zoom - 6}
              textAnchor="middle"
              className="text-xs font-bold fill-slate-700 pointer-events-none select-none"
              fontSize={12}
            >
              {space.name}
            </text>
            <text
              x={centroid.x * zoom}
              y={centroid.y * zoom + 12}
              textAnchor="middle"
              className="text-[10px] font-mono fill-slate-500 pointer-events-none select-none"
              fontSize={10}
            >
              {area.toFixed(2)} m² · h: {space.ceilingHeight.toFixed(2)}m
            </text>
          </g>
        );
      });
  }, [
    project.spaces,
    project.activeLevelId,
    verticesMap,
    zoom,
    selectedSymbolId,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    onSpaceClick
  ]);

  // 2. Muros físicos con espesor
  const renderedWalls = useMemo(() => {
    return project.walls
      .filter((w) => w.levelId === project.activeLevelId)
      .map((wall) => {
        const poly = getWallPolygon(wall, verticesMap);
        const vStart = verticesMap.get(wall.startVertexId);
        const vEnd = verticesMap.get(wall.endVertexId);
        if (!poly || !vStart || !vEnd) return null;

        const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
        const lenM = getWallLength(wall, verticesMap);
        const isSelected = selectedEntity?.type === 'wall' && selectedEntity.id === wall.id;

        const midX = ((vStart.x + vEnd.x) / 2) * zoom;
        const midY = ((vStart.y + vEnd.y) / 2) * zoom;

        return (
          <g
            key={wall.id}
            onMouseEnter={() => setHoveredWallId(wall.id)}
            onMouseLeave={() => setHoveredWallId(null)}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension) {
                // Modo inserción de elemento eléctrico o conexión de cañerías
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onWallClick?.(wall.id);
            }}
            className="cursor-pointer group"
          >
            {/* 1. Zona táctil y de clic amplia para selección inmediata del muro */}
            <line
              x1={vStart.x * zoom}
              y1={vStart.y * zoom}
              x2={vEnd.x * zoom}
              y2={vEnd.y * zoom}
              stroke="transparent"
              strokeWidth={Math.max(wall.thickness * zoom + 24, 32)}
              pointerEvents="stroke"
            />

            {/* 2. Cuerpo físico del muro */}
            <polygon
              points={pointsStr}
              fill={isSelected ? '#2563eb' : hoveredWallId === wall.id ? '#475569' : '#334155'}
              stroke={isSelected ? '#1d4ed8' : '#1e293b'}
              strokeWidth={isSelected ? 2 : 1}
            />

            {/* 3. Indicador y Grips visuales de selección activa */}
            {isSelected && (
              <>
                <polygon
                  points={pointsStr}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={3}
                  strokeDasharray="6 3"
                />
                <circle
                  cx={vStart.x * zoom}
                  cy={vStart.y * zoom}
                  r={6}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <circle
                  cx={vEnd.x * zoom}
                  cy={vEnd.y * zoom}
                  r={6}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </>
            )}

            {/* 4. Cota métrica al centro del muro */}
            {(showDimensions || isSelected) && (
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x={-24}
                  y={-10}
                  width={48}
                  height={16}
                  rx={4}
                  fill="#ffffff"
                  fillOpacity={0.95}
                  stroke={isSelected ? '#2563eb' : '#cbd5e1'}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                />
                <text
                  x={0}
                  y={2}
                  textAnchor="middle"
                  fontSize={9}
                  className="font-mono font-bold fill-slate-800 select-none pointer-events-none"
                >
                  {lenM.toFixed(2)} m
                </text>
              </g>
            )}
          </g>
        );
      });
  }, [
    project.walls,
    project.activeLevelId,
    verticesMap,
    zoom,
    selectedEntity,
    selectedSymbolId,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    showDimensions,
    hoveredWallId,
    onWallClick
  ]);

  // 3. Aberturas con zona de clic amplia y gestión visual
  const renderedOpenings = useMemo(() => {
    return project.openings.map((opening) => {
      const wall = wallsMap.get(opening.wallId);
      if (!wall || wall.levelId !== project.activeLevelId) return null;

      const jambs = getOpeningJambs(opening, wall, verticesMap);
      if (!jambs) return null;

      const isSelected = selectedEntity?.type === 'opening' && selectedEntity.id === opening.id;
      const j1 = { x: jambs.jamb1.x * zoom, y: jambs.jamb1.y * zoom };
      const j2 = { x: jambs.jamb2.x * zoom, y: jambs.jamb2.y * zoom };

      const dx = j2.x - j1.x;
      const dy = j2.y - j1.y;
      const wPx = Math.hypot(dx, dy);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      return (
        <g
          key={opening.id}
          transform={`translate(${j1.x}, ${j1.y}) rotate(${angleDeg})`}
          onClick={(e) => {
            if (wasDraggingRecentlyRef.current()) return;
            if (selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension) {
              triggerPlacementRef.current(e.clientX, e.clientY);
              return;
            }
            e.stopPropagation();
            onOpeningClick?.(opening.id);
          }}
          className="cursor-pointer group"
        >
          {/* Zona táctil y de clic amplia para fácil selección en pantalla */}
          <rect
            x={0}
            y={(-wall.thickness * zoom) / 2 - 14}
            width={wPx}
            height={wall.thickness * zoom + 28}
            fill="transparent"
            pointerEvents="all"
          />

          {/* Calado del muro */}
          <rect
            x={0}
            y={(-wall.thickness * zoom) / 2}
            width={wPx}
            height={wall.thickness * zoom}
            fill="#ffffff"
            stroke={isSelected ? '#2563eb' : '#94a3b8'}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />

          {/* Halo de selección activa */}
          {isSelected && (
            <rect
              x={-2}
              y={(-wall.thickness * zoom) / 2 - 4}
              width={wPx + 4}
              height={wall.thickness * zoom + 8}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="4 2"
              rx={3}
            />
          )}

          {opening.type === 'door' && (() => {
            const swing = opening.swing || 'left_in';
            const hingeX = swing.startsWith('left') ? 0 : wPx;
            const targetX = swing.startsWith('left') ? wPx : 0;
            const leafY = swing.endsWith('in') ? -wPx : wPx;
            const sweep = swing === 'left_in' || swing === 'right_out' ? 1 : 0;
            const arcPath = `M ${hingeX} ${leafY} A ${wPx} ${wPx} 0 0 ${sweep} ${targetX} 0`;

            return (
              <>
                <line
                  x1={hingeX}
                  y1={0}
                  x2={hingeX}
                  y2={leafY}
                  stroke={isSelected ? '#2563eb' : '#475569'}
                  strokeWidth={2}
                />
                <path
                  d={arcPath}
                  fill="none"
                  stroke={isSelected ? '#2563eb' : '#94a3b8'}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              </>
            );
          })()}

          {opening.type === 'window' && (
            <>
              <line x1={0} y1={-2} x2={wPx} y2={-2} stroke={isSelected ? '#2563eb' : '#3b82f6'} strokeWidth={2} />
              <line x1={0} y1={2} x2={wPx} y2={2} stroke={isSelected ? '#2563eb' : '#3b82f6'} strokeWidth={2} />
            </>
          )}

          {/* Cota / Identificador flotante al estar seleccionada */}
          {isSelected && (
            <g transform={`translate(${wPx / 2}, ${(-wall.thickness * zoom) / 2 - 16})`}>
              <rect
                x={-28}
                y={-10}
                width={56}
                height={16}
                rx={4}
                fill="#2563eb"
                stroke="#1d4ed8"
                strokeWidth={0.5}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                fontSize={9}
                className="font-mono font-bold fill-white select-none pointer-events-none"
              >
                {opening.type === 'door' ? 'Puerta' : opening.type === 'window' ? 'Ventana' : 'Vano'}{' '}
                {opening.width.toFixed(2)}m
              </text>
            </g>
          )}
        </g>
      );
    });
  }, [project.openings, wallsMap, project.activeLevelId, verticesMap, zoom, selectedEntity, selectedSymbolId, isConnectingConduit, isCalibratingUnderlay, isAddingDimension, onOpeningClick]);

  // 4. Vértices y Puntos de Anclaje (Snaps)
  const renderedVertices = useMemo(() => {
    return project.vertices.map((v) => {
      const isAnchor = activeAnchorVertexId === v.id;
      const pxX = v.x * zoom;
      const pxY = v.y * zoom;

      return (
        <g
          key={v.id}
          transform={`translate(${pxX}, ${pxY})`}
          onClick={(e) => {
            if (wasDraggingRecentlyRef.current()) return;
            if (selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension) {
              triggerPlacementRef.current(e.clientX, e.clientY);
              return;
            }
            e.stopPropagation();
            setActiveAnchorVertexId(v.id);
          }}
          className="cursor-pointer"
        >
          {/* Halo de anclaje activo */}
          {isAnchor && (
            <circle
              r={12}
              fill="rgba(59, 130, 246, 0.25)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
          )}
          {/* Punto de esquina */}
          <circle
            r={isAnchor ? 6 : 4.5}
            fill={isAnchor ? '#2563eb' : '#64748b'}
            stroke="#ffffff"
            strokeWidth={1.5}
            className="hover:stroke-blue-400 hover:stroke-[2.5px] transition-colors"
          />
        </g>
      );
    });
  }, [project.vertices, activeAnchorVertexId, zoom, selectedSymbolId, isConnectingConduit, isCalibratingUnderlay, isAddingDimension, setActiveAnchorVertexId]);

  // 5. Previsualización del rayo láser proyectado desde el anclaje activo
  const renderedPreviewRay = useMemo(() => {
    if (!activeAnchorVertex || previewDistanceM <= 0) return null;

    const startX = activeAnchorVertex.x * zoom;
    const startY = activeAnchorVertex.y * zoom;
    const rad = (currentDirectionDeg * Math.PI) / 180;
    const endX = startX + Math.cos(rad) * previewDistanceM * zoom;
    const endY = startY + Math.sin(rad) * previewDistanceM * zoom;

    return (
      <g pointerEvents="none">
        {/* Rayo láser proyectado */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeOpacity={0.8}
        />
        {/* Marcador de destino */}
        <circle cx={endX} cy={endY} r={5} fill="#ef4444" fillOpacity={0.7} />
        {/* Cota flotante del rayo */}
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - 8}
          textAnchor="middle"
          fontSize={10}
          className="font-mono font-bold fill-red-600 bg-white"
        >
          {previewDistanceM.toFixed(2)} m
        </text>
      </g>
    );
  }, [activeAnchorVertex, previewDistanceM, currentDirectionDeg, zoom]);

  // 6. Cañerías de enlace entre bocas eléctricas y tableros distribuidores
  const elementsMap = useMemo(() => {
    const map = new Map<string, SpatialElectricalNode>();
    project.electricalElements.forEach((el) => map.set(el.id, el));
    (project.panels || []).forEach((pan) => map.set(pan.id, pan));
    return map;
  }, [project.electricalElements, project.panels]);

  const renderedConduits = useMemo(() => {
    return project.conduits.map((conduit) => {
      const elFrom = elementsMap.get(conduit.fromElementId);
      const elTo = elementsMap.get(conduit.toElementId);
      if (!elFrom || !elTo) return null;
      if (elFrom.levelId !== project.activeLevelId || elTo.levelId !== project.activeLevelId) return null;

      const p1 = { x: elFrom.x * zoom, y: elFrom.y * zoom };
      const p2 = { x: elTo.x * zoom, y: elTo.y * zoom };

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return null;

      const routingPlane = conduit.routingPlane || 'wall';
      const isSlabOrFloor = routingPlane === 'ceiling_slab' || routingPlane === 'floor_slab';
      const isSchematicArc = conduit.routingMode === 'schematic_arc';
      let pathD: string;
      let midX: number;
      let midY: number;

      const waypointsPx = conduit.waypoints?.map((wp) => ({
        x: wp.x * zoom,
        y: wp.y * zoom
      }));

      if (isSchematicArc) {
        // Curvatura suave arco esquemático tradicional AEA (el modo arco no admite waypoints)
        const normalX = -dy / dist;
        const normalY = dx / dist;
        const curveOffset = Math.min(dist * 0.18, 28);
        midX = (p1.x + p2.x) / 2 + normalX * curveOffset;
        midY = (p1.y + p2.y) / 2 + normalY * curveOffset;
        pathD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      } else if (isSlabOrFloor) {
        // En losa o contrapiso: trazo directo / diagonal entre extremos o waypoints
        const pts = [p1, ...(waypointsPx || []), p2];
        pathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} ` + pts.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const midIdx = Math.max(1, Math.floor(pts.length / 2));
        midX = (pts[midIdx - 1].x + pts[midIdx].x) / 2;
        midY = (pts[midIdx - 1].y + pts[midIdx].y) / 2;
      } else {
        // Ortogonal por pared con curvas técnicas redondeadas a 90°
        const orthoPoints = computeOrthogonalConduitPoints(p1, p2, waypointsPx);
        const filletRadiusPx = Math.min(22, Math.max(8, 14 * (zoom / 40)));
        pathD = generateRoundedPolylineSvgPath(orthoPoints, filletRadiusPx);

        const midSegmentIdx = Math.max(1, Math.floor(orthoPoints.length / 2));
        const pSegA = orthoPoints[midSegmentIdx - 1];
        const pSegB = orthoPoints[midSegmentIdx];
        midX = (pSegA.x + pSegB.x) / 2;
        midY = (pSegA.y + pSegB.y) / 2;
      }

      const isSelected = selectedEntityMap.get('conduit')?.has(conduit.id) || false;

      // Color del circuito asignado o anaranjado por defecto
      const assignedCircuitId = conduit.circuitId || conduit.circuitIds?.[0];
      const circ = assignedCircuitId ? project.circuits.find((c) => c.id === assignedCircuitId) : null;
      const strokeColor = isSelected ? '#2563eb' : circ?.color || '#ea580c';
      const planeGlyph = routingPlane === 'ceiling_slab' ? '☁' : routingPlane === 'floor_slab' ? '👣' : '🧱';
      const labelText = circ
        ? `${circ.name.split(' ')[0]} · Ø${conduit.diameterMM}mm`
        : conduit.label || `Ø${conduit.diameterMM}mm`;

      // Verificación de desnivel vertical (subidas ▲ y bajadas ▼ según AEA y vía de tendido)
      const space = project.spaces.find((s) => s.id === elFrom.spaceId || s.id === elTo.spaceId);
      const ceilingH = space ? space.ceilingHeight : 2.70;
      const vertTrans = getConduitVerticalTransitions(elFrom.heightZ, elTo.heightZ, 0.30, routingPlane, ceilingH);

      return (
        <g
          key={conduit.id}
          onClick={(e) => {
            if (wasDraggingRecentlyRef.current()) return;
            if (isConnectingConduit || isCalibratingUnderlay || isAddingDimension) {
              triggerPlacementRef.current(e.clientX, e.clientY);
              return;
            }
            e.stopPropagation();
            toggleSelectEntity({ type: 'conduit', id: conduit.id }, e.shiftKey);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="cursor-pointer group"
        >
          {/* Hit area amplia */}
          <path d={pathD} fill="none" stroke="transparent" strokeWidth={18} pointerEvents="stroke" />
          {/* Cañería continua con esquinas redondeadas, arco o diagonal de losa */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={isSelected ? 3.5 : conduit.material.includes('bandeja') ? 3.0 : 2.2}
            strokeDasharray={conduit.material.includes('corrugado') ? '6 3' : conduit.material.includes('bandeja') ? '5 2' : 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Diámetro, vía de tendido y circuito de la cañería */}
          <text
            x={midX}
            y={midY - 5}
            textAnchor="middle"
            fontSize={9}
            fill={isSelected ? '#1d4ed8' : strokeColor}
            className="font-mono font-bold pointer-events-none select-none"
          >
            {planeGlyph} {labelText}
          </text>

          {/* Indicador de cota vertical en ORIGEN (subida o bajada hacia losa/piso) */}
          {vertTrans.hasTransition && vertTrans.glyphTextFrom && (
            <g transform={`translate(${p1.x + 8}, ${p1.y + (vertTrans.fromType === 'bajada' ? 12 : -8)})`} className="pointer-events-none">
              <rect
                x={-2}
                y={-8}
                width={vertTrans.glyphTextFrom.length * 5.6 + 6}
                height={11}
                rx={2.5}
                fill="#0f172a"
                fillOpacity={0.85}
              />
              <text
                x={1}
                y={0.5}
                fontSize={7.5}
                fill={vertTrans.fromType === 'bajada' ? '#38bdf8' : '#fbbf24'}
                className="font-mono font-bold select-none"
              >
                {vertTrans.glyphTextFrom}
              </text>
            </g>
          )}

          {/* Indicador de cota vertical en DESTINO (bajada o subida desde losa/piso) */}
          {vertTrans.hasTransition && vertTrans.glyphTextTo && (
            <g transform={`translate(${p2.x + 8}, ${p2.y + (vertTrans.toType === 'bajada' ? 12 : -8)})`} className="pointer-events-none">
              <rect
                x={-2}
                y={-8}
                width={vertTrans.glyphTextTo.length * 5.6 + 6}
                height={11}
                rx={2.5}
                fill="#0f172a"
                fillOpacity={0.85}
              />
              <text
                x={1}
                y={0.5}
                fontSize={7.5}
                fill={vertTrans.toType === 'bajada' ? '#38bdf8' : '#fbbf24'}
                className="font-mono font-bold select-none"
              >
                {vertTrans.glyphTextTo}
              </text>
            </g>
          )}

          {/* Indicador de Montante Vertical / Pase de losa restante */}
          {(conduit.isRiserTerminal || (typeof conduit.additionalLengthM === 'number' && conduit.additionalLengthM > 0)) && (
            <g transform={`translate(${p2.x + 8}, ${p2.y + 22})`} className="pointer-events-none">
              <rect
                x={-2}
                y={-8}
                width={Math.max(60, ((conduit.targetDescription || '').length + 10) * 5.5)}
                height={12}
                rx={3}
                fill="#b45309"
                fillOpacity={0.9}
              />
              <text
                x={1}
                y={0.5}
                fontSize={7.5}
                fill="#ffffff"
                className="font-mono font-bold select-none"
              >
                ⌖ +{(conduit.additionalLengthM || 0).toFixed(2)}m {conduit.targetDescription ? `· ${conduit.targetDescription}` : ''}
              </text>
            </g>
          )}

          {/* Marcadores de Quiebres Interactivos (Waypoints) cuando la canalización está seleccionada o en edición */}
          {(isSelected || editingConduitRouteId === conduit.id) &&
            conduit.routingMode !== 'schematic_arc' &&
            waypointsPx &&
            waypointsPx.length > 0 && (
              <g className="conduit-waypoints-handles">
                {waypointsPx.map((wp, idx) => (
                  <g key={`wp-handle-${conduit.id}-${idx}`}>
                    <g
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        isDraggingObjectRef.current = true;
                        try {
                          (e.currentTarget as Element).setPointerCapture(e.pointerId);
                        } catch {
                          // Fallback
                        }
                        activeWaypointDragRef.current = {
                          conduitId: conduit.id,
                          wpIndex: idx,
                          startX: e.clientX,
                          startY: e.clientY,
                          origWpX: conduit.waypoints![idx].x,
                          origWpY: conduit.waypoints![idx].y,
                          moved: false
                        };
                      }}
                      onPointerMove={(e) => {
                        if (activeWaypointDragRef.current && activeWaypointDragRef.current.wpIndex === idx) {
                          e.stopPropagation();
                          const drag = activeWaypointDragRef.current;
                          const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
                          if (dist > 3) drag.moved = true;
                          const dxWorld = (e.clientX - drag.startX) / zoom;
                          const dyWorld = (e.clientY - drag.startY) / zoom;
                          const candX = Number((drag.origWpX + dxWorld).toFixed(3));
                          const candY = Number((drag.origWpY + dyWorld).toFixed(3));
                          onUpdateConduitWaypoint?.(conduit.id, idx, {
                            x: candX,
                            y: candY
                          });
                        }
                      }}
                      onPointerUp={(e) => {
                        if (activeWaypointDragRef.current && activeWaypointDragRef.current.wpIndex === idx) {
                          e.stopPropagation();
                          try {
                            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                          } catch {
                            // Ignore
                          }
                          activeWaypointDragRef.current = null;
                          isDraggingObjectRef.current = false;
                        }
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        isDraggingObjectRef.current = true;
                        if (e.touches.length === 1) {
                          const t = e.touches[0];
                          activeWaypointDragRef.current = {
                            conduitId: conduit.id,
                            wpIndex: idx,
                            startX: t.clientX,
                            startY: t.clientY,
                            origWpX: conduit.waypoints![idx].x,
                            origWpY: conduit.waypoints![idx].y,
                            moved: false
                          };
                        }
                      }}
                      onTouchMove={(e) => {
                        if (
                          activeWaypointDragRef.current &&
                          activeWaypointDragRef.current.wpIndex === idx &&
                          e.touches.length === 1
                        ) {
                          e.stopPropagation();
                          const t = e.touches[0];
                          const drag = activeWaypointDragRef.current;
                          const dist = Math.hypot(t.clientX - drag.startX, t.clientY - drag.startY);
                          if (dist > 3) drag.moved = true;
                          const dxWorld = (t.clientX - drag.startX) / zoom;
                          const dyWorld = (t.clientY - drag.startY) / zoom;
                          const candX = Number((drag.origWpX + dxWorld).toFixed(3));
                          const candY = Number((drag.origWpY + dyWorld).toFixed(3));
                          onUpdateConduitWaypoint?.(conduit.id, idx, {
                            x: candX,
                            y: candY
                          });
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        activeWaypointDragRef.current = null;
                        isDraggingObjectRef.current = false;
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveConduitWaypoint?.(conduit.id, idx);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onRemoveConduitWaypoint?.(conduit.id, idx);
                      }}
                      className="cursor-move"
                    >
                      {/* Diana táctil amplia de 36px de diámetro invisible (sin rebote ni jitter) */}
                      <circle cx={wp.x} cy={wp.y} r={18} fill="transparent" />
                      <circle
                        cx={wp.x}
                        cy={wp.y}
                        r={13}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        className="pointer-events-none"
                      />
                      <circle
                        cx={wp.x}
                        cy={wp.y}
                        r={9}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth={2}
                        className="hover:stroke-amber-300 hover:stroke-[3px] transition-colors pointer-events-none"
                      />
                      <text
                        x={wp.x}
                        y={wp.y + 3}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#ffffff"
                        className="font-mono font-bold select-none pointer-events-none"
                      >
                        P{idx + 1}
                      </text>
                    </g>
                  </g>
                ))}
              </g>
            )}
        </g>
      );
    });
  }, [
    project.conduits,
    project.circuits,
    project.spaces,
    project.activeLevelId,
    elementsMap,
    zoom,
    selectedEntityMap,
    isConnectingConduit,
    editingConduitRouteId,
    isCalibratingUnderlay,
    isAddingDimension,
    toggleSelectEntity,
    onUpdateConduitWaypoint,
    onRemoveConduitWaypoint
  ]);

  // 7. Símbolos Eléctricos AEA con visibilidad absoluta y área de impacto táctil
  const renderedElements = useMemo(() => {
    return project.electricalElements
      .filter((el) => el.levelId === project.activeLevelId)
      .map((element) => {
        const pxX = element.x * zoom;
        const pxY = element.y * zoom;
        const isSelected = selectedEntityMap.get('electrical_element')?.has(element.id) || false;
        const isPendingStart = pendingConduitStartId === element.id;
        const circ = element.circuitId ? project.circuits.find((c) => c.id === element.circuitId) : null;
        const panel = circ ? project.panels.find((p) => p.id === circ.panelId) : project.panels[0] || null;
        const circuitLabel = circ ? circ.name.split(' ')[0] : undefined;
        const formattedLabel = formatElementLabel({
          elementLabel: element.label,
          circuit: circ,
          panel,
          mode: labelDisplayMode
        });

        return (
          <g
            key={element.id}
            transform={`translate(${pxX}, ${pxY})`}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onElectricalElementClick?.(element.id, e.shiftKey);
            }}
            onDoubleClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onElectricalElementDoubleClick?.(element.id);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="cursor-pointer"
          >

            {/* Halo pulsante ámbar para el primer extremo de conexión de cañería */}
            {isPendingStart && (
              <g pointerEvents="none">
                <circle
                  r={32}
                  fill="rgba(245, 158, 11, 0.22)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />
                <circle
                  r={44}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.6}
                />
                <g transform="translate(0, -38)">
                  <rect
                    x="-42"
                    y="-10"
                    width={84}
                    height={20}
                    rx="10"
                    fill="#d97706"
                    className="shadow-md"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    className="font-sans select-none"
                  >
                    ⚡ Inicio Cañería
                  </text>
                </g>
              </g>
            )}

            <AeaCanvasSymbol
              symbolId={element.symbolId}
              zoom={zoom}
              isSelected={isSelected || isPendingStart}
              elementLabel={element.label}
              circuitLabel={circuitLabel}
              formattedLabel={formattedLabel}
              returnRef={element.returnRef}
              rotationDeg={element.rotation || 0}
            />

            {/* Ficha técnica flotante para etiquetas / remates de caño */}
            {(element.isTerminalReference || element.symbolId === 'sym-terminal-referencia') && (() => {
              const connectedConduit = project.conduits.find(
                (c) => c.fromElementId === element.id || c.toElementId === element.id
              );
              const otherId = connectedConduit
                ? connectedConduit.fromElementId === element.id
                  ? connectedConduit.toElementId
                  : connectedConduit.fromElementId
                : null;
              const otherEl = otherId ? elementsMap.get(otherId) : null;
              const levelsMap = new Map(project.levels.map((l) => [l.id, l]));
              const autoLen = otherEl
                ? calculateConduitRealLength({
                    fromElement: element,
                    toElement: otherEl,
                    levelsMap
                  })
                : 0;
              const totalLen =
                (connectedConduit?.manualLengthM || autoLen) +
                (connectedConduit?.additionalLengthM || element.additionalLengthM || 0);
              const diam = connectedConduit?.diameterMM || 19;
              const conductorsCount = connectedConduit?.conductors?.length || 0;
              const condDesc =
                conductorsCount > 0
                  ? `${conductorsCount}x${connectedConduit?.conductors[0]?.sectionMM2 || 2.5}mm²`
                  : '';
              const targetText =
                element.targetDescription ||
                connectedConduit?.targetDescription ||
                'A Tablero';

              const boxWidth = Math.max(120, targetText.length * 6.5 + 24);

              return (
                <g transform="translate(14, -14)" pointerEvents="none" className="select-none font-sans">
                  <rect
                    x="0"
                    y="-9"
                    width={boxWidth}
                    height={30}
                    rx="6"
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                    className="shadow-md"
                  />
                  <text x="6" y="3.5" fill="#38bdf8" fontSize="9.5" fontWeight="bold">
                    ➔ {targetText}
                  </text>
                  <text x="6" y="15" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                    Ø{diam}mm · L={totalLen.toFixed(1)}m {condDesc ? `· ${condDesc}` : ''}
                  </text>
                </g>
              );
            })()}

            {/* Si está seleccionado y NO estamos enlazando cañerías, botón contextual flotante */}
            {isSelected && !isConnectingConduit && (
              <g
                transform="translate(0, -36)"
                onClick={(e) => {
                  e.stopPropagation();
                  onElectricalElementDoubleClick?.(element.id);
                }}
                className="cursor-pointer group"
              >
                <rect
                  x="-52"
                  y="-11"
                  width="104"
                  height="22"
                  rx="11"
                  fill="#0f172a"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  className="shadow-md group-hover:fill-blue-600 transition-colors"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  className="select-none font-sans pointer-events-none"
                >
                  ⚙️ Ficha / Medir
                </text>
              </g>
            )}
          </g>
        );
      });
  }, [
    project.electricalElements,
    project.circuits,
    project.panels,
    project.levels,
    project.conduits,
    elementsMap,
    labelDisplayMode,
    project.activeLevelId,
    zoom,
    selectedEntityMap,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    pendingConduitStartId,
    onElectricalElementClick,
    onElectricalElementDoubleClick
  ]);

  // 7b. Tableros Eléctricos Autónomos (Distribuidores de Circuitos)
  const renderedPanels = useMemo(() => {
    return (project.panels || [])
      .filter((panel) => panel.isPlaced && panel.levelId === project.activeLevelId)
      .map((panel) => {
        const pxX = panel.x * zoom;
        const pxY = panel.y * zoom;
        const isSelected = selectedEntityMap.get('panel')?.has(panel.id) || false;
        const isPendingStart = pendingConduitStartId === panel.id;
        const panelCircuits = project.circuits.filter((c) => c.panelId === panel.id);
        const symbolId =
          panel.symbolId ||
          (panel.type === 'principal' ? 'sym-planta-tablero-principal' : 'sym-planta-tablero-seccional');

        return (
          <g
            key={panel.id}
            transform={`translate(${pxX}, ${pxY})`}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              if (isConnectingConduit) {
                onElectricalElementClick?.(panel.id);
              } else if (onPanelClick) {
                onPanelClick(panel.id, e.shiftKey);
              } else {
                onElectricalElementClick?.(panel.id, e.shiftKey);
              }
            }}
            onDoubleClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              if (isConnectingConduit) {
                onElectricalElementClick?.(panel.id);
              } else if (onPanelDoubleClick) {
                onPanelDoubleClick(panel.id);
              } else {
                onElectricalElementDoubleClick?.(panel.id);
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="cursor-pointer"
          >
            {/* Halo pulsante ámbar para el primer extremo de conexión de cañería */}
            {isPendingStart && (
              <g pointerEvents="none">
                <circle
                  r={36}
                  fill="rgba(245, 158, 11, 0.25)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />
                <g transform="translate(0, -42)">
                  <rect
                    x="-48"
                    y="-10"
                    width={96}
                    height={20}
                    rx="10"
                    fill="#d97706"
                    className="shadow-md"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    className="font-sans select-none"
                  >
                    ⚡ Tablero Origen
                  </text>
                </g>
              </g>
            )}

            <AeaCanvasSymbol
              symbolId={symbolId}
              zoom={zoom}
              isSelected={isSelected || isPendingStart}
              elementLabel={panel.name}
              circuitLabel={`${panelCircuits.length} circ`}
              formattedLabel={`${panel.name} (${panelCircuits.length} C)`}
              rotationDeg={panel.rotation || 0}
            />

            {/* Botón contextual flotante al seleccionar el tablero */}
            {isSelected && !isConnectingConduit && (
              <g
                transform="translate(0, -38)"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPanelDoubleClick) {
                    onPanelDoubleClick(panel.id);
                  } else {
                    onElectricalElementDoubleClick?.(panel.id);
                  }
                }}
                className="cursor-pointer group"
              >
                <rect
                  x="-62"
                  y="-11"
                  width={124}
                  height="22"
                  rx="11"
                  fill="#0f172a"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  className="shadow-md group-hover:fill-amber-600 transition-colors"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  className="select-none font-sans pointer-events-none"
                >
                  ⚙️ Ficha Distribuidor
                </text>
              </g>
            )}
          </g>
        );
      });
  }, [
    project.panels,
    project.circuits,
    project.activeLevelId,
    zoom,
    selectedEntityMap,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    pendingConduitStartId,
    onElectricalElementClick,
    onElectricalElementDoubleClick,
    onPanelClick,
    onPanelDoubleClick
  ]);

  // 8. Cotas Métricas Libres en el Plano CAD
  const renderedDimensions = useMemo(() => {
    if (!showDimensions || !project.dimensions) return null;

    return project.dimensions
      .filter((dim) => dim.levelId === project.activeLevelId)
      .map((dim) => {
        const x1 = dim.p1.x * zoom;
        const y1 = dim.p1.y * zoom;
        const x2 = dim.p2.x * zoom;
        const y2 = dim.p2.y * zoom;
        const dist = Math.hypot(dim.p2.x - dim.p1.x, dim.p2.y - dim.p1.y);
        if (dist < 0.05) return null;

        const isSelected = selectedEntity?.type === 'dimension' && selectedEntity.id === dim.id;
        const strokeColor = isSelected ? DIMENSION_CONSTANTS.SELECTED_COLOR : DIMENSION_CONSTANTS.DEFAULT_COLOR;

        const angleRad = Math.atan2(y2 - y1, x2 - x1);
        const tickAngleRad = angleRad + Math.PI / 4;
        const tickDx = Math.cos(tickAngleRad) * 5;
        const tickDy = Math.sin(tickAngleRad) * 5;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const normX = -(y2 - y1) / (dist * zoom);
        const normY = (x2 - x1) / (dist * zoom);
        const textX = midX + normX * 8;
        const textY = midY + normY * 8;

        let angleDeg = (angleRad * 180) / Math.PI;
        if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

        const labelText = formatDimensionText(dist, dim.label);

        return (
          <g
            key={dim.id}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              setSelectedEntity({ type: 'dimension', id: dim.id });
            }}
            className="cursor-pointer group"
          >
            {/* Hit area amplia */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={18} pointerEvents="stroke" />

            {/* Línea de cota */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />

            {/* Tics arquitectónicos a 45° */}
            <line
              x1={x1 - tickDx}
              y1={y1 - tickDy}
              x2={x1 + tickDx}
              y2={y1 + tickDy}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 2}
            />
            <line
              x1={x2 - tickDx}
              y1={y2 - tickDy}
              x2={x2 + tickDx}
              y2={y2 + tickDy}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 2}
            />

            {/* Etiqueta de cota */}
            <g transform={`translate(${textX}, ${textY}) rotate(${angleDeg})`}>
              <rect
                x="-26"
                y="-10"
                width="52"
                height="20"
                rx="4"
                fill="#ffffff"
                stroke={isSelected ? strokeColor : '#cbd5e1'}
                strokeWidth={1}
                className="shadow-xs"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill={strokeColor}
                className="font-mono select-none pointer-events-none"
              >
                {labelText}
              </text>
            </g>

            {/* Botón flotante para eliminar la cota si está seleccionada */}
            {isSelected && (
              <g
                transform={`translate(${midX}, ${midY - 24})`}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteDimensionLine(dim.id);
                }}
                className="cursor-pointer group/dimdel"
              >
                <circle r={10} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} className="transition-colors group-hover/dimdel:fill-red-600 drop-shadow" />
                <text x="0" y="3.5" textAnchor="middle" fontSize={10} fontWeight="bold" fill="#ffffff" className="select-none font-sans pointer-events-none">
                  ✕
                </text>
              </g>
            )}
          </g>
        );
      });
  }, [
    project.dimensions,
    project.activeLevelId,
    showDimensions,
    selectedEntity,
    zoom,
    selectedSymbolId,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    setSelectedEntity,
    deleteDimensionLine
  ]);

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

          {renderedSpaces}
          {renderedWalls}
          {renderedOpenings}
          {renderedPreviewRay}
          {renderedConduits}
          {renderedVertices}
          {renderedElements}
          {renderedPanels}
          {renderedDimensions}

          {/* Símbolos detectados por autovalores sobre el mapa de bits */}
          {detectedPatternMatches && detectedPatternMatches.length > 0 && underlaySheet && (
            <g>
              {detectedPatternMatches.map((m) => {
                const boxX = (underlaySheet.originWorldX + m.boxPx.x * underlaySheet.scaleMetersPerPx) * zoom;
                const boxY = (underlaySheet.originWorldY + m.boxPx.y * underlaySheet.scaleMetersPerPx) * zoom;
                const boxW = m.boxPx.width * underlaySheet.scaleMetersPerPx * zoom;
                const boxH = m.boxPx.height * underlaySheet.scaleMetersPerPx * zoom;
                const cx = m.worldPos.x * zoom;
                const cy = m.worldPos.y * zoom;

                return (
                  <g key={m.id} className="group">
                    {/* Recuadro de coincidencia */}
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxW}
                      height={boxH}
                      fill="rgba(6, 182, 212, 0.12)"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      rx={3}
                      className="transition-colors group-hover:fill-cyan-500/25 group-hover:stroke-cyan-600"
                    />
                    {/* Centroide magnético con mira */}
                    <circle cx={cx} cy={cy} r={3.5} fill="#0891b2" stroke="#ffffff" strokeWidth={1} />
                    <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#0891b2" strokeWidth={1} />
                    <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#0891b2" strokeWidth={1} />

                    {/* Porcentaje de similitud */}
                    <text
                      x={boxX + boxW / 2}
                      y={boxY + boxH + 9}
                      textAnchor="middle"
                      fontSize={7.5}
                      fontWeight="bold"
                      fill="#06b6d4"
                      className="select-none font-mono drop-shadow pointer-events-none"
                    >
                      {Math.round(m.similarityScore * 100)}%
                    </text>

                    {/* Botón descartar falso positivo con amplia zona de impacto táctil */}
                    <g
                      transform={`translate(${boxX + boxW}, ${boxY})`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissPatternMatch?.(m.id);
                      }}
                      className="cursor-pointer group/dismiss"
                    >
                      <title>Descartar falso positivo y aprender del rechazo</title>
                      {/* Zona invisible amplia de impacto para mouse y dedos táctiles (36px de diámetro) */}
                      <circle r={18} fill="transparent" />
                      {/* Círculo visual rojo de cierre inmóvil bajo el cursor */}
                      <circle
                        r={8}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        className="transition-colors group-hover/dismiss:fill-red-600 drop-shadow"
                      />
                      <text
                        x="0"
                        y="2.5"
                        textAnchor="middle"
                        fontSize={8}
                        fontWeight="bold"
                        fill="#ffffff"
                        className="select-none font-sans pointer-events-none"
                      >
                        ✕
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
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

      {/* Botonera flotante CAD (Zoom In / Out / Recentrar / Cotas / Lámina de Fondo) */}
      <div
        className="absolute top-4 right-4 flex flex-col gap-1.5 z-10"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(300, Number((z * 1.25).toFixed(1))))}
          className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
          title="Acercar (+)"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(15, Number((z / 1.25).toFixed(1))))}
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
            {/* Conmutador de Snap Magnético ON / OFF (Tecla S) */}
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

      {/* Aviso móvil superior al tener boca seleccionada */}
      {selectedSymbolId && (
        <div className="lg:hidden absolute top-4 left-4 right-16 bg-blue-600/95 backdrop-blur-md text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg truncate pointer-events-none">
          📍 Tocá plano o muro para emplazar la boca
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
