/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useWallElevationViewModel.ts
 * Orquesta la Vista de Alzado de Muro: apertura/cierre, cara observada,
 * selección, arrastre con imán de alturas, edición numérica y encuadre.
 * Toda escritura al proyecto pasa por useProjectStore (bidireccional con la planta).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useProjectStore } from './useProjectStore';
import type { Opening } from '../models/architecture/Opening';
import type { Wall } from '../models/architecture/Wall';
import {
  alongWallToScreenX,
  screenXToAlongWall,
  buildWallElevation,
  computeNodeMoveFromElevation,
  computeOpeningUpdateFromElevation,
  getDefaultElevationFace,
  getFaceSpaceId,
  placeElevationBox,
  snapElevationHeight,
  toDrawingY,
  getWallAxisFrame,
  WALL_ELEVATION_CONSTANTS,
  type ElevationBox,
  type ElevationConduit,
  type ElevationFace,
  type ElevationPoint,
  type NodeElevationMove,
  type OpeningElevationPatch,
  type WallElevation
} from '../models/architecture/wallElevation';
import {
  buildPresetElevationRoute,
  elevationRouteToPlanWaypoints,
  moveRoutePoint,
  CONDUIT_ROUTE_PRESET_OPTIONS
} from '../models/architecture/conduitElevationRoute';
import {
  getConduitLengthBreakdown,
  type ConduitLengthBreakdown
} from '../models/electrical/conduitMetrics';
import type {
  ConduitRoutePreset,
  ConduitElevationPoint,
  SpatialElectricalNode
} from '../models/electrical/ElectricalModel';
import {
  ELEVATION_VIEWPORT_CONSTANTS,
  fitViewBox,
  fitWallViewBox,
  panViewBox,
  viewBoxCenter,
  viewBoxToAttribute,
  zoomViewBox,
  type ElevationViewBox
} from '../models/architecture/elevationViewport';
import {
  AEA_HEIGHT_PRESETS,
  CABINET_SIZE_PRESETS,
  type HeightPresetOption,
  type CabinetSizePreset
} from '../models/electrical/electricalStandards';
import { computeNewNodeFromElevation } from '../models/architecture/elevationPlacement';
import { placeElectricalElementInStore } from './useElectricalViewModel';
import { getPlantaSymbols, type ElectricalSymbolDefinition } from '../models/electrical/symbolsLib';

export type { CabinetSizePreset };

export type ElevationSelection =
  | { type: 'box'; id: string }
  | { type: 'opening'; id: string }
  | { type: 'conduit'; id: string };

export interface ElevationRouteGrip {
  index: number;
  x: number;
  y: number;
  u: number;
  z: number;
  isEndpoint: boolean;
}

export interface ElevationPlacementToolState {
  symbolId: string;
  circuitId?: string | null;
}

export interface ElevationPlacementPreview {
  x: number;
  z: number;
  guideZ: number | null;
  symbolId: string;
}

interface WallElevationStoreState {
  target: { wallId: string; face: ElevationFace } | null;
  selection: ElevationSelection | null;
  openElevation: (wallId: string, face?: ElevationFace) => void;
  closeElevation: () => void;
  setFace: (face: ElevationFace) => void;
  setSelection: (selection: ElevationSelection | null) => void;
}

export const useWallElevationStore = create<WallElevationStoreState>((set) => ({
  target: null,
  selection: null,
  openElevation: (wallId, face) => {
    const wall = useProjectStore.getState().project.walls.find((w) => w.id === wallId);
    if (!wall) return;
    set({ target: { wallId, face: face ?? getDefaultElevationFace(wall) }, selection: null });
  },
  closeElevation: () => set({ target: null, selection: null }),
  setFace: (face) => set((s) => (s.target ? { target: { ...s.target, face }, selection: null } : s)),
  setSelection: (selection) => set({ selection })
}));

export interface ElevationFaceOption {
  face: ElevationFace;
  label: string;
}

export interface ElevationPointerPoint {
  x: number;
  y: number;
}

interface DragState {
  id: string;
  offsetX: number;
  offsetZ: number;
  move: NodeElevationMove;
  guideZ: number | null;
  moved: boolean;
}

interface RouteGripDragState {
  conduitId: string;
  pointIndex: number;
  points: ConduitElevationPoint[];
  guideZ: number | null;
  moved: boolean;
}

interface ViewportOverride {
  key: string;
  viewBox: ElevationViewBox;
}

const FACE_FALLBACK_LABEL: Record<ElevationFace, string> = {
  left: 'Cara izquierda',
  right: 'Cara derecha'
};

export function useWallElevationViewModel() {
  const project = useProjectStore((s) => s.project);
  const updateElectricalElement = useProjectStore((s) => s.updateElectricalElement);
  const updatePanel = useProjectStore((s) => s.updatePanel);
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const updateConduit = useProjectStore((s) => s.updateConduit);
  const setProjectSelection = useProjectStore((s) => s.setSelectedEntity);

  const target = useWallElevationStore((s) => s.target);
  const selection = useWallElevationStore((s) => s.selection);
  const setSelection = useWallElevationStore((s) => s.setSelection);
  const closeElevation = useWallElevationStore((s) => s.closeElevation);
  const setFace = useWallElevationStore((s) => s.setFace);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [gripDrag, setGripDrag] = useState<RouteGripDragState | null>(null);
  const [placementTool, setPlacementTool] = useState<ElevationPlacementToolState | null>(null);
  const [placementPreview, setPlacementPreview] = useState<ElevationPlacementPreview | null>(null);
  const [viewport, setViewport] = useState<ViewportOverride | null>(null);

  const levelsMap = useMemo(() => new Map(project.levels.map((l) => [l.id, l])), [project.levels]);
  const nodesMap = useMemo(() => {
    const map = new Map<string, SpatialElectricalNode>();
    project.electricalElements.forEach((e) => map.set(e.id, e));
    (project.panels || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [project.electricalElements, project.panels]);

  const wall: Wall | null = useMemo(
    () => (target ? (project.walls.find((w) => w.id === target.wallId) ?? null) : null),
    [project.walls, target]
  );

  const verticesMap = useMemo(() => new Map(project.vertices.map((v) => [v.id, v])), [project.vertices]);

  const elevation: WallElevation | null = useMemo(() => {
    if (!wall || !target) return null;
    return buildWallElevation({
      wall,
      vertices: verticesMap,
      face: target.face,
      openings: project.openings,
      elements: project.electricalElements,
      panels: project.panels,
      conduits: project.conduits,
      circuits: project.circuits,
      spaces: project.spaces,
      catalog: project.materialCatalog
    });
  }, [wall, target, verticesMap, project]);

  // ─── Encuadre (se reinicia solo al cambiar de muro/cara, sin efectos) ───
  const viewportKey = target ? `${target.wallId}:${target.face}` : '';
  const viewBox: ElevationViewBox | null = elevation
    ? viewport?.key === viewportKey
      ? viewport.viewBox
      : fitViewBox(elevation.bounds)
    : null;

  const applyViewBox = useCallback(
    (next: ElevationViewBox) => setViewport({ key: viewportKey, viewBox: next }),
    [viewportKey]
  );

  const zoomAt = useCallback(
    (factor: number, focus?: ElevationPointerPoint) => {
      if (!elevation || !viewBox) return;
      applyViewBox(zoomViewBox(viewBox, factor, focus ?? viewBoxCenter(viewBox), elevation.bounds));
    },
    [elevation, viewBox, applyViewBox]
  );
  const zoomIn = useCallback(() => zoomAt(ELEVATION_VIEWPORT_CONSTANTS.ZOOM_STEP), [zoomAt]);
  const zoomOut = useCallback(() => zoomAt(1 / ELEVATION_VIEWPORT_CONSTANTS.ZOOM_STEP), [zoomAt]);
  const fit = useCallback(() => setViewport(null), []);
  const fitWall = useCallback(() => {
    if (!elevation) return;
    applyViewBox(fitWallViewBox(elevation.lengthM, elevation.wallHeightM, elevation.drawingHeightM));
  }, [elevation, applyViewBox]);
  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (viewBox) applyViewBox(panViewBox(viewBox, dx, dy));
    },
    [viewBox, applyViewBox]
  );
  const wheelZoomFactor = useCallback(
    (deltaY: number) => ELEVATION_VIEWPORT_CONSTANTS.WHEEL_ZOOM_BASE ** -deltaY,
    []
  );

  // ─── Selección sincronizada con la planta ───
  const selectBox = useCallback(
    (id: string) => {
      const box = elevation?.boxes.find((b) => b.id === id);
      if (!box) return;
      setSelection({ type: 'box', id });
      setProjectSelection({ type: box.kind, id });
    },
    [elevation, setSelection, setProjectSelection]
  );
  const selectOpening = useCallback(
    (id: string) => {
      setSelection({ type: 'opening', id });
      setProjectSelection({ type: 'opening', id });
    },
    [setSelection, setProjectSelection]
  );
  const selectConduit = useCallback(
    (id: string) => {
      const conduit = elevation?.conduits.find((c) => c.id === id);
      if (!conduit) return;
      setSelection({ type: 'conduit', id });
      setProjectSelection({ type: 'conduit', id });
    },
    [elevation, setSelection, setProjectSelection]
  );
  const clearSelection = useCallback(() => setSelection(null), [setSelection]);

  // ─── Escritura de cajas/tableros hacia la planta ───
  const nodeFor = useCallback(
    (box: ElevationBox) =>
      box.kind === 'panel'
        ? project.panels.find((p) => p.id === box.id)
        : project.electricalElements.find((e) => e.id === box.id),
    [project.panels, project.electricalElements]
  );

  const computeMove = useCallback(
    (box: ElevationBox, targetX: number, targetZ: number): NodeElevationMove | null => {
      const node = nodeFor(box);
      if (!node || !wall || !target) return null;
      return computeNodeMoveFromElevation({
        node,
        wall,
        vertices: verticesMap,
        face: target.face,
        boxWidthM: box.width,
        boxHeightM: box.height,
        targetX,
        targetZ
      });
    },
    [nodeFor, wall, target, verticesMap]
  );

  const commitMove = useCallback(
    (box: ElevationBox, move: NodeElevationMove) => {
      if (box.kind === 'panel') updatePanel(box.id, move);
      else updateElectricalElement(box.id, move);
    },
    [updatePanel, updateElectricalElement]
  );

  // ─── Arrastre con imán a alturas AEA ───
  const beginBoxDrag = useCallback(
    (id: string, point: ElevationPointerPoint) => {
      if (!elevation) return;
      const box = elevation.boxes.find((b) => b.id === id);
      if (!box) return;
      selectBox(id);
      const pointerZ = elevation.drawingHeightM - point.y;
      const move = computeMove(box, box.centerX, box.centerZ);
      if (!move) return;
      setDrag({
        id,
        offsetX: box.centerX - point.x,
        offsetZ: box.centerZ - pointerZ,
        move,
        guideZ: null,
        moved: false
      });
    },
    [elevation, selectBox, computeMove]
  );

  const moveBoxDrag = useCallback(
    (point: ElevationPointerPoint) => {
      if (!drag || !elevation) return;
      const box = elevation.boxes.find((b) => b.id === drag.id);
      if (!box) return;
      const rawZ = elevation.drawingHeightM - point.y + drag.offsetZ;
      const snapped = snapElevationHeight(rawZ, elevation.wallHeightM);
      const rawX = point.x + drag.offsetX;
      const step = WALL_ELEVATION_CONSTANTS.DRAG_STEP_M;
      const move = computeMove(box, Math.round(rawX / step) * step, snapped.z);
      if (!move) return;
      setDrag({ ...drag, move, guideZ: snapped.guideZ, moved: true });
    },
    [drag, elevation, computeMove]
  );

  const endBoxDrag = useCallback(() => {
    if (drag?.moved && elevation) {
      const box = elevation.boxes.find((b) => b.id === drag.id);
      if (box) commitMove(box, drag.move);
    }
    setDrag(null);
  }, [drag, elevation, commitMove]);

  const cancelBoxDrag = useCallback(() => setDrag(null), []);

  // Cajas a dibujar: la que se arrastra se muestra en su posición provisoria.
  const displayBoxes: ElevationBox[] = useMemo(() => {
    if (!elevation) return [];
    if (!drag) return elevation.boxes;
    return elevation.boxes.map((b) => {
      if (b.id !== drag.id || !target) return b;
      const centerX = alongWallToScreenX(drag.move.wallOffset, elevation.lengthM, target.face);
      return placeElevationBox(b, centerX, drag.move.heightZ, elevation.drawingHeightM);
    });
  }, [elevation, drag, target]);

  // Conductos a dibujar: el que se arrastra se muestra en su posición provisoria.
  const displayConduits: ElevationConduit[] = useMemo(() => {
    if (!elevation || !target) return [];
    if (!gripDrag) return elevation.conduits;
    return elevation.conduits.map((c) => {
      if (c.id !== gripDrag.conduitId) return c;
      const seg: ElevationPoint[] = gripDrag.points.map((p) => ({
        x: alongWallToScreenX(p.u, elevation.lengthM, target.face),
        y: toDrawingY(p.z, elevation.drawingHeightM)
      }));
      return { ...c, segments: [seg] };
    });
  }, [elevation, target, gripDrag]);

  const guideZ = drag?.guideZ ?? gripDrag?.guideZ ?? placementPreview?.guideZ ?? null;
  const guideY = guideZ != null && elevation ? toDrawingY(guideZ, elevation.drawingHeightM) : null;

  // ─── Inserción interactiva de nuevas bocas y tableros desde el alzado ───
  const startPlacement = useCallback(
    (symbolId: string, circuitId?: string | null) => {
      setSelection(null);
      setPlacementTool({ symbolId, circuitId });
      setPlacementPreview(null);
    },
    [setSelection]
  );

  const cancelPlacement = useCallback(() => {
    setPlacementTool(null);
    setPlacementPreview(null);
  }, []);

  const updatePlacementPreview = useCallback(
    (point: ElevationPointerPoint) => {
      if (!placementTool || !elevation || !wall || !target) return;
      const rawZ = elevation.drawingHeightM - point.y;
      const snapped = snapElevationHeight(rawZ, elevation.wallHeightM);
      const step = WALL_ELEVATION_CONSTANTS.DRAG_STEP_M;
      const snappedX = Math.round(point.x / step) * step;

      setPlacementPreview({
        x: snappedX,
        z: snapped.z,
        guideZ: snapped.guideZ,
        symbolId: placementTool.symbolId
      });
    },
    [placementTool, elevation, wall, target]
  );

  const commitPlacement = useCallback(
    (point: ElevationPointerPoint) => {
      if (!placementTool || !elevation || !wall || !target) return;
      const rawZ = elevation.drawingHeightM - point.y;
      const snapped = snapElevationHeight(rawZ, elevation.wallHeightM);
      const step = WALL_ELEVATION_CONSTANTS.DRAG_STEP_M;
      const snappedX = Math.round(point.x / step) * step;

      const placement = computeNewNodeFromElevation({
        wall,
        vertices: verticesMap,
        face: target.face,
        targetX: snappedX,
        targetZ: snapped.z
      });
      if (!placement) return;

      const isPanel =
        placementTool.symbolId.includes('tablero') ||
        placementTool.symbolId.includes('tp') ||
        placementTool.symbolId.includes('ts') ||
        placementTool.symbolId.includes('medidor');

      const placedNode = placeElectricalElementInStore({
        worldX: placement.x,
        worldY: placement.y,
        symbolId: placementTool.symbolId,
        snapInfo: {
          wallId: wall.id,
          wallOffset: placement.wallOffset,
          side: placement.side,
          rotationDeg: placement.rotationDeg
        },
        rotationDeg: placement.rotationDeg,
        overrideCircuitId: placementTool.circuitId,
        overrideHeightZ: placement.heightZ
      });

      setSelection({ type: 'box', id: placedNode.id });
      setProjectSelection({ type: isPanel ? 'panel' : 'electrical_element', id: placedNode.id });
      setPlacementPreview(null);
      setPlacementTool(null);
    },
    [placementTool, elevation, wall, target, verticesMap, setSelection, setProjectSelection]
  );

  const availablePlacementSymbols: ElectricalSymbolDefinition[] = useMemo(() => {
    return getPlantaSymbols().filter(
      (s) =>
        s.id !== 'sym-planta-boca-techo' &&
        s.id !== 'sym-terminal-referencia' &&
        s.id !== 'sym-planta-montante'
    );
  }, []);

  const availableCircuits = useMemo(() => project.circuits, [project.circuits]);

  // ─── Edición numérica y selección ───
  const selectedBox = selection?.type === 'box' ? (displayBoxes.find((b) => b.id === selection.id) ?? null) : null;
  const selectedOpening =
    selection?.type === 'opening' ? (elevation?.openings.find((o) => o.id === selection.id) ?? null) : null;
  const selectedConduit =
    selection?.type === 'conduit' ? (displayConduits.find((c) => c.id === selection.id) ?? null) : null;

  const selectedConduitMetric: ConduitLengthBreakdown | null = useMemo(() => {
    if (!selectedConduit || !elevation) return null;
    const cond = project.conduits.find((c) => c.id === selectedConduit.id);
    if (!cond) return null;
    const fromEl = nodesMap.get(cond.fromElementId);
    const toEl = nodesMap.get(cond.toElementId);
    if (!fromEl || !toEl) return null;
    return getConduitLengthBreakdown({
      fromElement: fromEl,
      toElement: toEl,
      levelsMap,
      routingPlane: cond.routingPlane,
      waypoints: cond.waypoints,
      elevationRoute: cond.elevationRoute,
      ceilingHeightM: elevation.ceilingZ
    });
  }, [selectedConduit, elevation, project.conduits, nodesMap, levelsMap]);

  const routeGrips: ElevationRouteGrip[] = useMemo(() => {
    if (!selectedConduit || !elevation || !target) return [];
    const points =
      gripDrag && gripDrag.conduitId === selectedConduit.id
        ? gripDrag.points
        : selectedConduit.elevationRoute?.points;
    if (!points || points.length === 0) return [];

    return points.map((p, idx) => ({
      index: idx,
      x: alongWallToScreenX(p.u, elevation.lengthM, target.face),
      y: toDrawingY(p.z, elevation.drawingHeightM),
      u: p.u,
      z: p.z,
      isEndpoint: idx === 0 || idx === points.length - 1
    }));
  }, [selectedConduit, elevation, target, gripDrag]);

  const setConduitPreset = useCallback(
    (id: string, preset: ConduitRoutePreset) => {
      if (!wall || !elevation || !target) return;
      const cond = project.conduits.find((c) => c.id === id);
      if (!cond) return;
      const fromBox = elevation.boxes.find((b) => b.id === cond.fromElementId);
      const toBox = elevation.boxes.find((b) => b.id === cond.toElementId);
      if (!fromBox && !toBox) return;

      const b1 = fromBox ?? toBox!;
      const b2 = toBox ?? fromBox!;
      const fromU = screenXToAlongWall(b1.centerX, elevation.lengthM, target.face);
      const toU = screenXToAlongWall(b2.centerX, elevation.lengthM, target.face);

      const route = buildPresetElevationRoute({
        wallId: wall.id,
        fromU,
        fromZ: b1.centerZ,
        toU,
        toZ: b2.centerZ,
        preset,
        ceilingZ: elevation.ceilingZ,
        wallHeightM: elevation.wallHeightM
      });

      const frame = getWallAxisFrame(wall, verticesMap);
      const planWaypoints = frame ? elevationRouteToPlanWaypoints(route.points, frame) : undefined;
      const routingPlane =
        preset === 'ceiling_exit' ? 'ceiling_slab' : preset === 'floor_exit' ? 'floor_slab' : 'wall';

      updateConduit(id, {
        elevationRoute: route,
        routingPlane,
        waypoints: planWaypoints
      });
    },
    [wall, elevation, target, project.conduits, verticesMap, updateConduit]
  );

  const resetConduitRoute = useCallback(
    (id: string) => {
      updateConduit(id, {
        elevationRoute: undefined,
        waypoints: undefined
      });
    },
    [updateConduit]
  );

  const beginRoutePointDrag = useCallback(
    (conduitId: string, pointIndex: number) => {
      if (!elevation || !target || !wall) return;
      const cond = project.conduits.find((c) => c.id === conduitId);
      if (!cond) return;

      let points = cond.elevationRoute?.points;
      if (!points || points.length === 0) {
        const fromBox = elevation.boxes.find((b) => b.id === cond.fromElementId);
        const toBox = elevation.boxes.find((b) => b.id === cond.toElementId);
        if (!fromBox || !toBox) return;
        const fromU = screenXToAlongWall(fromBox.centerX, elevation.lengthM, target.face);
        const toU = screenXToAlongWall(toBox.centerX, elevation.lengthM, target.face);
        const isAdj = Math.abs(fromBox.centerX - toBox.centerX) <= 0.30;
        const initialPreset: ConduitRoutePreset = isAdj ? 'direct' : 'top_bridge';
        const initialRoute = buildPresetElevationRoute({
          wallId: wall.id,
          fromU,
          fromZ: fromBox.centerZ,
          toU,
          toZ: toBox.centerZ,
          preset: initialPreset,
          ceilingZ: elevation.ceilingZ,
          wallHeightM: elevation.wallHeightM
        });
        points = initialRoute.points;
      }

      setGripDrag({
        conduitId,
        pointIndex,
        points,
        guideZ: null,
        moved: false
      });
    },
    [elevation, target, wall, project.conduits]
  );

  const moveRoutePointDrag = useCallback(
    (point: ElevationPointerPoint) => {
      if (!gripDrag || !elevation || !target || !wall) return;
      const rawU = screenXToAlongWall(point.x, elevation.lengthM, target.face);
      const rawZ = elevation.drawingHeightM - point.y;
      const snapped = snapElevationHeight(rawZ, elevation.wallHeightM);
      const newPoints = moveRoutePoint({
        points: gripDrag.points,
        index: gripDrag.pointIndex,
        targetU: rawU,
        targetZ: snapped.z,
        wallLengthM: elevation.lengthM,
        wallHeightM: elevation.wallHeightM
      });
      setGripDrag({ ...gripDrag, points: newPoints, guideZ: snapped.guideZ, moved: true });
    },
    [gripDrag, elevation, target, wall]
  );

  const endRoutePointDrag = useCallback(() => {
    if (gripDrag?.moved && wall && elevation) {
      const frame = getWallAxisFrame(wall, verticesMap);
      const planWaypoints = frame ? elevationRouteToPlanWaypoints(gripDrag.points, frame) : undefined;
      updateConduit(gripDrag.conduitId, {
        elevationRoute: {
          wallId: wall.id,
          preset: 'custom',
          points: gripDrag.points
        },
        waypoints: planWaypoints
      });
    }
    setGripDrag(null);
  }, [gripDrag, wall, elevation, verticesMap, updateConduit]);

  const cancelRoutePointDrag = useCallback(() => setGripDrag(null), []);

  const setSelectedBoxX = useCallback(
    (xFromLeftM: number) => {
      const box = elevation?.boxes.find((b) => b.id === selectedBox?.id);
      if (!box || !Number.isFinite(xFromLeftM)) return;
      const move = computeMove(box, xFromLeftM, box.centerZ);
      if (move) commitMove(box, move);
    },
    [elevation, selectedBox, computeMove, commitMove]
  );

  const setSelectedBoxZ = useCallback(
    (z: number) => {
      const box = elevation?.boxes.find((b) => b.id === selectedBox?.id);
      if (!box || !Number.isFinite(z)) return;
      const move = computeMove(box, box.centerX, z);
      if (move) commitMove(box, move);
    },
    [elevation, selectedBox, computeMove, commitMove]
  );

  const nudgeSelectedBox = useCallback(
    (dxM: number, dzM: number) => {
      const box = elevation?.boxes.find((b) => b.id === selectedBox?.id);
      if (!box) return;
      const move = computeMove(box, box.centerX + dxM, box.centerZ + dzM);
      if (move) commitMove(box, move);
    },
    [elevation, selectedBox, computeMove, commitMove]
  );

  const rotateSelectedBox = useCallback(() => {
    if (!selectedBox) return;
    const nextOrientation: 'vertical' | 'horizontal' =
      selectedBox.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const nextDeg = nextOrientation === 'horizontal' ? 90 : 0;
    if (selectedBox.kind === 'panel') {
      updatePanel(selectedBox.id, {
        boxOrientation: nextOrientation,
        boxRotationDeg: nextDeg
      });
    } else {
      updateElectricalElement(selectedBox.id, {
        boxOrientation: nextOrientation,
        boxRotationDeg: nextDeg
      });
    }
  }, [selectedBox, updatePanel, updateElectricalElement]);

  const setBoxOrientation = useCallback(
    (orientation: 'vertical' | 'horizontal') => {
      if (!selectedBox) return;
      const deg = orientation === 'horizontal' ? 90 : 0;
      if (selectedBox.kind === 'panel') {
        updatePanel(selectedBox.id, {
          boxOrientation: orientation,
          boxRotationDeg: deg
        });
      } else {
        updateElectricalElement(selectedBox.id, {
          boxOrientation: orientation,
          boxRotationDeg: deg
        });
      }
    },
    [selectedBox, updatePanel, updateElectricalElement]
  );

  const patchSelectedOpening = useCallback(
    (patch: OpeningElevationPatch) => {
      if (!wall || !target || !selectedOpening) return;
      const opening: Opening | undefined = project.openings.find((o) => o.id === selectedOpening.id);
      if (!opening) return;
      updateOpening(
        opening.id,
        computeOpeningUpdateFromElevation({
          opening,
          wallLengthM: elevation?.lengthM ?? 0,
          wallHeightM: wall.height,
          face: target.face,
          patch
        })
      );
    },
    [wall, target, selectedOpening, project.openings, elevation, updateOpening]
  );

  const setPanelDimensions = useCallback(
    (
      panelId: string,
      dimensions: { widthMM?: number; heightMM?: number; depthMM?: number; dinModules?: number }
    ) => {
      updatePanel(panelId, dimensions);
    },
    [updatePanel]
  );

  // ─── Catálogos expuestos a la vista ───
  const heightPresets: readonly HeightPresetOption[] = useMemo(
    () => AEA_HEIGHT_PRESETS.filter((p) => elevation !== null && p.meters <= elevation.wallHeightM),
    [elevation]
  );

  const faceOptions: ElevationFaceOption[] = useMemo(() => {
    if (!wall) return [];
    return (['left', 'right'] as const).map((face) => {
      const spaceId = getFaceSpaceId(wall, face);
      const space = spaceId ? project.spaces.find((s) => s.id === spaceId) : undefined;
      return { face, label: space?.name ?? FACE_FALLBACK_LABEL[face] };
    });
  }, [wall, project.spaces]);

  return {
    isOpen: target !== null && elevation !== null,
    wall,
    face: target?.face ?? null,
    faceOptions,
    elevation,
    displayBoxes,
    displayConduits,
    guideY,
    isDragging: drag !== null,
    isGripDragging: gripDrag !== null,
    selection,
    selectedBox,
    selectedOpening,
    selectedConduit,
    selectedConduitMetric,
    routeGrips,
    conduitPresetOptions: CONDUIT_ROUTE_PRESET_OPTIONS,
    heightPresets,
    viewBox,
    viewBoxAttribute: viewBox ? viewBoxToAttribute(viewBox) : '',
    close: closeElevation,
    setFace,
    selectBox,
    selectOpening,
    selectConduit,
    clearSelection,
    beginBoxDrag,
    moveBoxDrag,
    endBoxDrag,
    cancelBoxDrag,
    setConduitPreset,
    resetConduitRoute,
    beginRoutePointDrag,
    moveRoutePointDrag,
    endRoutePointDrag,
    cancelRoutePointDrag,
    setSelectedBoxX,
    setSelectedBoxZ,
    nudgeSelectedBox,
    patchSelectedOpening,
    zoomIn,
    zoomOut,
    zoomAt,
    wheelZoomFactor,
    fit,
    fitWall,
    rotateSelectedBox,
    setBoxOrientation,
    panBy,
    placementTool,
    placementPreview,
    startPlacement,
    cancelPlacement,
    updatePlacementPreview,
    commitPlacement,
    availablePlacementSymbols,
    availableCircuits,
    cabinetSizePresets: CABINET_SIZE_PRESETS,
    setPanelDimensions
  };
}
