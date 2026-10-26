/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO DE DOMINIO PURO: cadViewportModel.ts
 * Responsabilidad Única (SRP):
 * Fórmulas geométricas puras del viewport CAD (encuadre automático, zoom
 * sobre punto focal, redimensionado de recuadros de muestreo y resolución
 * prioritaria de imantación/snap en el lienzo).
 * Cero dependencias de React o del DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { CAD_VIEWPORT_CONFIG } from '../../config';
import type { Wall, WallPlacementSnap, WallVertex } from './Wall';
import { calculateWallSnap } from './Wall';
import type { Space } from './Space';
import { resolveSpacePolygon, calculatePolygonCentroid } from './Space';
import type { DetectedPatternMatch } from '../underlay/PatternDetector';

export interface ViewportTransform {
  zoom: number;
  pan: { x: number; y: number };
}

export interface SampleSquareBox {
  x: number;
  y: number;
  size: number;
}

export type SampleSquareResizeHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export interface CanvasHoverSnapInput {
  rawWorldPos: { x: number; y: number };
  selectedSymbolId?: string | null;
  snapAllowed: boolean;
  underlaySnapAllowed: boolean;
  detectedPatternMatches?: ReadonlyArray<DetectedPatternMatch>;
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
  activeLevelWalls: ReadonlyArray<Wall>;
  activeLevelSpaces: ReadonlyArray<Space>;
  allVertices: ReadonlyArray<WallVertex>;
  verticesMap: Map<string, WallVertex>;
  isSamplingPattern: boolean;
  positiveExemplarsCount: number;
  getStencilSnapPoint?: (
    worldPos: { x: number; y: number },
    toleranceMeters?: number
  ) => { snappedPos: { x: number; y: number }; isSnapped: boolean };
  isMovingSpace: boolean;
}

export interface CanvasHoverSnapResult {
  worldPos: { x: number; y: number };
  rotationDeg: number;
  snapInfo: WallPlacementSnap | null;
  isSnappedToCenter: boolean;
  isSnappedToPatternMatch: boolean;
  isStencilSnapped: boolean;
}

/**
 * Calcula el zoom y paneo óptimos para encuadrar un conjunto de vértices en el contenedor.
 */
export function computeFitViewport(
  vertices: ReadonlyArray<{ x: number; y: number }>,
  containerWidth: number,
  containerHeight: number
): ViewportTransform {
  if (vertices.length === 0) {
    return {
      zoom: CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER,
      pan: { ...CAD_VIEWPORT_CONFIG.DEFAULT_PAN }
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const w = containerWidth || 400;
  const h = containerHeight || 600;
  const spanX = Math.max(maxX - minX, CAD_VIEWPORT_CONFIG.FIT_MIN_SPAN_METERS);
  const spanY = Math.max(maxY - minY, CAD_VIEWPORT_CONFIG.FIT_MIN_SPAN_METERS);

  const rawZoom = Math.min(
    (w - CAD_VIEWPORT_CONFIG.FIT_PADDING_X_PX) / spanX,
    (h - CAD_VIEWPORT_CONFIG.FIT_PADDING_Y_PX) / spanY
  );
  const fitZoom = Math.min(
    Math.max(rawZoom, CAD_VIEWPORT_CONFIG.FIT_MIN_ZOOM_PIXELS_PER_METER),
    CAD_VIEWPORT_CONFIG.FIT_MAX_ZOOM_PIXELS_PER_METER
  );

  return {
    zoom: fitZoom,
    pan: {
      x: w / 2 - midX * fitZoom,
      y: h / 2 - midY * fitZoom
    }
  };
}

/**
 * Calcula la transformación de zoom y paneo manteniendo fijo el punto bajo el cursor (rueda del mouse).
 */
export function computeWheelZoomViewport(
  currentZoom: number,
  currentPan: { x: number; y: number },
  deltaY: number,
  mouseCanvasX: number,
  mouseCanvasY: number
): ViewportTransform {
  const zoomFactor =
    deltaY < 0
      ? CAD_VIEWPORT_CONFIG.WHEEL_ZOOM_IN_FACTOR
      : CAD_VIEWPORT_CONFIG.WHEEL_ZOOM_OUT_FACTOR;
  const newZoom = Math.min(
    Math.max(currentZoom * zoomFactor, CAD_VIEWPORT_CONFIG.MIN_ZOOM_PIXELS_PER_METER),
    CAD_VIEWPORT_CONFIG.MAX_ZOOM_PIXELS_PER_METER
  );

  return {
    zoom: newZoom,
    pan: {
      x: mouseCanvasX - (mouseCanvasX - currentPan.x) * (newZoom / currentZoom),
      y: mouseCanvasY - (mouseCanvasY - currentPan.y) * (newZoom / currentZoom)
    }
  };
}

/**
 * Calcula la transformación de zoom y paneo durante un gesto táctil de pellizco (pinch-to-zoom).
 */
export function computePinchZoomViewport(
  startZoom: number,
  startPan: { x: number; y: number },
  startDist: number,
  currentDist: number,
  midCanvasX: number,
  midCanvasY: number
): ViewportTransform {
  const safeStartZoom = startZoom || CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER;
  const scaleFactor = currentDist / (startDist || 1);
  const newZoom = Math.min(
    CAD_VIEWPORT_CONFIG.MAX_ZOOM_PIXELS_PER_METER,
    Math.max(CAD_VIEWPORT_CONFIG.MIN_ZOOM_PIXELS_PER_METER, safeStartZoom * scaleFactor)
  );
  const worldX = (midCanvasX - startPan.x) / safeStartZoom;
  const worldY = (midCanvasY - startPan.y) / safeStartZoom;

  return {
    zoom: newZoom,
    pan: {
      x: midCanvasX - worldX * newZoom,
      y: midCanvasY - worldY * newZoom
    }
  };
}

/**
 * Calcula la nueva geometría del recuadro cuadrado de muestreo al arrastrar su cuerpo o cualquiera de sus 4 esquinas.
 */
export function computeAdjustedSampleSquareBox(
  initBox: SampleSquareBox,
  handle: SampleSquareResizeHandle,
  dxWorld: number,
  dyWorld: number,
  minSizeM: number = CAD_VIEWPORT_CONFIG.SAMPLE_BOX_MIN_SIZE_M
): SampleSquareBox {
  if (handle === 'move') {
    return {
      x: Number((initBox.x + dxWorld).toFixed(3)),
      y: Number((initBox.y + dyWorld).toFixed(3)),
      size: initBox.size
    };
  }
  if (handle === 'se') {
    const newSize = Math.max(minSizeM, initBox.size + Math.max(dxWorld, dyWorld));
    return {
      x: initBox.x,
      y: initBox.y,
      size: Number(newSize.toFixed(3))
    };
  }
  if (handle === 'ne') {
    const newSize = Math.max(minSizeM, initBox.size + Math.max(dxWorld, -dyWorld));
    return {
      x: initBox.x,
      y: Number((initBox.y + initBox.size - newSize).toFixed(3)),
      size: Number(newSize.toFixed(3))
    };
  }
  if (handle === 'sw') {
    const newSize = Math.max(minSizeM, initBox.size + Math.max(-dxWorld, dyWorld));
    return {
      x: Number((initBox.x + initBox.size - newSize).toFixed(3)),
      y: initBox.y,
      size: Number(newSize.toFixed(3))
    };
  }
  // 'nw'
  const newSize = Math.max(minSizeM, initBox.size + Math.max(-dxWorld, -dyWorld));
  return {
    x: Number((initBox.x + initBox.size - newSize).toFixed(3)),
    y: Number((initBox.y + initBox.size - newSize).toFixed(3)),
    size: Number(newSize.toFixed(3))
  };
}

/**
 * Resuelve en cascada de prioridades la posición imantada (snap) y orientación del cursor en el lienzo:
 * 1) Símbolo detectado por visión (DetectedPatternMatch)
 * 2) Auto-muestreo asistido de emplazamiento (getPlacingSnapPoint)
 * 3) Acople magnético a paramento de muro (calculateWallSnap)
 * 4) Acople al centroide geométrico del ambiente (calculatePolygonCentroid)
 * 5) Acople de esténcil de muestreo y vértices al mover ambiente.
 */
export function resolveCanvasHoverSnap(input: CanvasHoverSnapInput): CanvasHoverSnapResult {
  let wx = input.rawWorldPos.x;
  let wy = input.rawWorldPos.y;
  let rot = 0;
  let snapInfo: WallPlacementSnap | null = null;
  let snappedCenter = false;
  let snappedPattern = false;
  let isStencilSnapped = false;

  const {
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
  } = input;

  if (selectedSymbolId && snapAllowed) {
    // Prioridad 1: Snap magnético al centroide de un símbolo detectado previamente en el plano
    if (underlaySnapAllowed && detectedPatternMatches && detectedPatternMatches.length > 0) {
      let bestMatch: DetectedPatternMatch | null = null;
      let minD: number = CAD_VIEWPORT_CONFIG.PATTERN_MATCH_SNAP_TOLERANCE_M;
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

    // Prioridad 1.5: Snap guiado por auto-muestreo asistido del primer símbolo emplazado
    if (!snappedPattern && getPlacingSnapPoint && underlaySnapAllowed) {
      const placingSnap = getPlacingSnapPoint({ x: wx, y: wy }, selectedSymbolId, !snapAllowed);
      if (placingSnap.isSnapped) {
        wx = placingSnap.snappedPos.x;
        wy = placingSnap.snappedPos.y;
        rot = placingSnap.rotationDeg;
        snappedPattern = true;
      }
    }

    const isCeilingSymbol =
      selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');

    // Prioridad 2: Acople a pared (si no es de techo ni se acopló a patrón)
    if (!isCeilingSymbol && !snappedPattern) {
      const wallSnap = calculateWallSnap(
        { x: wx, y: wy },
        activeLevelWalls as Wall[],
        verticesMap,
        CAD_VIEWPORT_CONFIG.WALL_PLACEMENT_SNAP_TOLERANCE_M
      );
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

    // Prioridad 3: Acople al centroide de habitación
    if (!snapInfo && !snappedPattern) {
      for (const space of activeLevelSpaces) {
        const poly = resolveSpacePolygon(space, verticesMap);
        if (poly.length >= 3) {
          const centroid = calculatePolygonCentroid(poly);
          if (
            Math.hypot(centroid.x - wx, centroid.y - wy) <
            CAD_VIEWPORT_CONFIG.SPACE_CENTROID_SNAP_TOLERANCE_M
          ) {
            wx = centroid.x;
            wy = centroid.y;
            snappedCenter = true;
            break;
          }
        }
      }
    }
  }

  // Snap magnético para el esténcil rígido al núcleo de tinta o candidatos detectados
  if (isSamplingPattern && positiveExemplarsCount > 0 && getStencilSnapPoint && underlaySnapAllowed) {
    const stencilSnap = getStencilSnapPoint({ x: wx, y: wy });
    if (stencilSnap.isSnapped) {
      wx = stencilSnap.snappedPos.x;
      wy = stencilSnap.snappedPos.y;
      isStencilSnapped = true;
    }
  }

  // Snap magnético a vértices/esquinas existentes al mover un ambiente
  if (isMovingSpace && snapAllowed) {
    let bestVertex: WallVertex | null = null;
    let minD: number = CAD_VIEWPORT_CONFIG.SPACE_MOVE_VERTEX_SNAP_TOLERANCE_M;
    for (const v of allVertices) {
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

  return {
    worldPos: { x: wx, y: wy },
    rotationDeg: rot,
    snapInfo,
    isSnappedToCenter: snappedCenter,
    isSnappedToPatternMatch: snappedPattern,
    isStencilSnapped
  };
}
