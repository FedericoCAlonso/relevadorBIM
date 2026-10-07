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
  buildWallElevation,
  computeNodeMoveFromElevation,
  computeOpeningUpdateFromElevation,
  getDefaultElevationFace,
  getFaceSpaceId,
  placeElevationBox,
  snapElevationHeight,
  toDrawingY,
  WALL_ELEVATION_CONSTANTS,
  type ElevationBox,
  type ElevationFace,
  type NodeElevationMove,
  type OpeningElevationPatch,
  type WallElevation
} from '../models/architecture/wallElevation';
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
import { AEA_HEIGHT_PRESETS, type HeightPresetOption } from '../models/electrical/electricalStandards';

export type ElevationSelection = { type: 'box'; id: string } | { type: 'opening'; id: string };

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
  const setProjectSelection = useProjectStore((s) => s.setSelectedEntity);

  const target = useWallElevationStore((s) => s.target);
  const selection = useWallElevationStore((s) => s.selection);
  const setSelection = useWallElevationStore((s) => s.setSelection);
  const closeElevation = useWallElevationStore((s) => s.closeElevation);
  const setFace = useWallElevationStore((s) => s.setFace);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [viewport, setViewport] = useState<ViewportOverride | null>(null);

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

  const guideY = drag?.guideZ != null && elevation ? toDrawingY(drag.guideZ, elevation.drawingHeightM) : null;

  // ─── Edición numérica del elemento seleccionado ───
  const selectedBox = selection?.type === 'box' ? (displayBoxes.find((b) => b.id === selection.id) ?? null) : null;
  const selectedOpening =
    selection?.type === 'opening' ? (elevation?.openings.find((o) => o.id === selection.id) ?? null) : null;

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
    guideY,
    isDragging: drag !== null,
    selection,
    selectedBox,
    selectedOpening,
    heightPresets,
    viewBox,
    viewBoxAttribute: viewBox ? viewBoxToAttribute(viewBox) : '',
    close: closeElevation,
    setFace,
    selectBox,
    selectOpening,
    clearSelection,
    beginBoxDrag,
    moveBoxDrag,
    endBoxDrag,
    cancelBoxDrag,
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
    panBy
  };
}
