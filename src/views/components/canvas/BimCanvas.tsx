/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BimCanvas.tsx
 * Lienzo Gráfico 2D Interactivo para Arquitectura BIM y Red Eléctrica AEA.
 * Orquesta las capas declarativas memoizadas (`React.memo`) consumiendo el
 * ViewModel de gestos y viewport (`useCadCanvasInteractions`).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { WallVertex, Wall, WallPlacementSnap } from '../../../models/architecture/Wall';
import { CAD_CANVAS_PATTERN_STYLES } from '../../../config';
import type { UnderlaySheet } from '../../../models/underlay/UnderlaySheet';
import type { DetectedPatternMatch } from '../../../models/underlay/PatternDetector';
import { useElectricalSequenceStore } from '../../../viewmodels/useElectricalViewModel';
import type { SpatialElectricalNode, ConduitWaypoint } from '../../../models/electrical/ElectricalModel';
import { useWallGripDrag } from '../../../viewmodels/useWallGripDrag';
import { useCadCanvasInteractions } from '../../../viewmodels/useCadCanvasInteractions';
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

  // Mapas y colecciones filtradas por nivel activo
  const verticesMap = useMemo(() => {
    return new Map<string, WallVertex>(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const wallsMap = useMemo(() => {
    return new Map<string, Wall>(project.walls.map((w) => [w.id, w]));
  }, [project.walls]);

  const activeAnchorVertex = activeAnchorVertexId ? verticesMap.get(activeAnchorVertexId) : null;

  const activeLevelSpaces = useMemo(
    () => project.spaces.filter((s) => s.levelId === project.activeLevelId),
    [project.spaces, project.activeLevelId]
  );

  const activeLevelWalls = useMemo(
    () => project.walls.filter((w) => w.levelId === project.activeLevelId),
    [project.walls, project.activeLevelId]
  );

  // Hook de ViewModel para Viewport, Gestos Táctiles/Mouse, Snap en Hover y Emplazamiento
  const {
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
  } = useCadCanvasInteractions({
    containerRef,
    allVertices: project.vertices,
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
  });

  // Hook de ViewModel para Arrastre Interactivo de Extremos de Muros (CAD Smart Grips)
  const {
    activeDrag,
    activeSnapResult,
    isOrthoMode,
    toggleOrthoMode,
    handleGripPointerDown,
    handleGripPointerMove,
    handleGripPointerUp
  } = useWallGripDrag({
    zoom,
    panOffset: pan,
    containerRef
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        toggleOrthoMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOrthoMode]);

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
  }, [isDraggingObjectRef, lastDragEndTimeRef]);

  const isInteractionBlocked = Boolean(
    selectedSymbolId || isConnectingConduit || isCalibratingUnderlay || isAddingDimension
  );
  const activeLevelBeams = useMemo(
    () => (project.beams || []).filter((b) => b.levelId === project.activeLevelId),
    [project.beams, project.activeLevelId]
  );
  const activeLevelColumns = useMemo(
    () => (project.columns || []).filter((c) => c.levelId === project.activeLevelId),
    [project.columns, project.activeLevelId]
  );

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
            <path
              d={`M ${zoom} 0 L 0 0 0 ${zoom}`}
              fill="none"
              stroke={CAD_CANVAS_PATTERN_STYLES.gridStroke}
              strokeWidth={CAD_CANVAS_PATTERN_STYLES.gridStrokeWidth}
            />
          </pattern>
          <pattern
            id="hatch-open-air"
            width={CAD_CANVAS_PATTERN_STYLES.openAirHatchSizePx}
            height={CAD_CANVAS_PATTERN_STYLES.openAirHatchSizePx}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${CAD_CANVAS_PATTERN_STYLES.openAirHatchRotateDeg})`}
          >
            <rect
              width={CAD_CANVAS_PATTERN_STYLES.openAirHatchSizePx}
              height={CAD_CANVAS_PATTERN_STYLES.openAirHatchSizePx}
              fill={CAD_CANVAS_PATTERN_STYLES.openAirHatchFill}
            />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={CAD_CANVAS_PATTERN_STYLES.openAirHatchSizePx}
              stroke={CAD_CANVAS_PATTERN_STYLES.openAirHatchStroke}
              strokeWidth={CAD_CANVAS_PATTERN_STYLES.openAirHatchStrokeWidth}
              strokeOpacity={CAD_CANVAS_PATTERN_STYLES.openAirHatchStrokeOpacity}
            />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        <g transform={`translate(${pan.x}, ${pan.y})`}>
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

          <SpacesLayer
            spaces={activeLevelSpaces}
            verticesMap={verticesMap}
            wallsMap={wallsMap}
            zoom={zoom}
            selectedSpaceId={selectedEntity?.type === 'space' ? selectedEntity.id : null}
            overhangTargetSpaceId={isDrawingOverhang ? overhangSpaceId : null}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onSpaceClick={onSpaceClick}
          />
          <BeamsLayer
            beams={activeLevelBeams}
            zoom={zoom}
            selectedBeamId={selectedEntity?.type === 'beam' ? selectedEntity.id : null}
            onBeamClick={onBeamClick}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionBlocked={isInteractionBlocked}
          />
          <WallsLayer
            walls={activeLevelWalls}
            verticesMap={verticesMap}
            zoom={zoom}
            selectedWallId={selectedEntity?.type === 'wall' ? selectedEntity.id : null}
            showDimensions={showDimensions}
            isArchitectureLocked={isArchitectureLocked}
            activeDragWallId={activeDrag?.wallId ?? null}
            activeDragEnd={activeDrag?.draggedEnd ?? null}
            gripActions={wallGripActions}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onWallClick={onWallClick}
            onWallDoubleClick={onWallDoubleClick}
          />
          <OpeningsLayer
            openings={project.openings}
            wallsMap={wallsMap}
            verticesMap={verticesMap}
            activeLevelId={project.activeLevelId}
            zoom={zoom}
            selectedOpeningId={selectedEntity?.type === 'opening' ? selectedEntity.id : null}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onOpeningClick={onOpeningClick}
          />
          <ColumnsLayer
            columns={activeLevelColumns}
            zoom={zoom}
            selectedColumnId={selectedEntity?.type === 'column' ? selectedEntity.id : null}
            onColumnClick={onColumnClick}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionBlocked={isInteractionBlocked}
          />
          <PreviewRayLayer
            anchorVertex={activeAnchorVertex ?? null}
            distanceM={previewDistanceM}
            directionDeg={currentDirectionDeg}
            zoom={zoom}
          />
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
          <VerticesLayer
            vertices={project.vertices}
            zoom={zoom}
            activeAnchorVertexId={activeAnchorVertexId}
            wasDraggingRecentlyRef={wasDraggingRecentlyRef}
            isInteractionInterceptedRef={isInteractionInterceptedRef}
            triggerPlacementRef={triggerPlacementRef}
            onSelectAnchor={setActiveAnchorVertexId}
          />
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
            <PatternMatchesLayer
              matches={detectedPatternMatches}
              underlaySheet={underlaySheet}
              zoom={zoom}
              onDismiss={onDismissPatternMatch}
            />
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
        isOrthoMode={isOrthoMode}
        onToggleOrtho={toggleOrthoMode}
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
