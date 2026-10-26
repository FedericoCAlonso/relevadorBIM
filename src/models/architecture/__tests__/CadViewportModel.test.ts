import { describe, it, expect } from 'vitest';
import {
  computeFitViewport,
  computeWheelZoomViewport,
  computePinchZoomViewport,
  computeAdjustedSampleSquareBox,
  resolveCanvasHoverSnap
} from '../cadViewportModel';
import { CAD_VIEWPORT_CONFIG } from '../../../config';
import type { Wall, WallVertex } from '../Wall';
import type { Space } from '../Space';

describe('cadViewportModel — Geometría pura de Viewport e Imantación del Lienzo', () => {
  it('retorna el viewport por defecto cuando no hay vértices en computeFitViewport', () => {
    const vp = computeFitViewport([], 800, 600);
    expect(vp.zoom).toBe(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER);
    expect(vp.pan).toEqual(CAD_VIEWPORT_CONFIG.DEFAULT_PAN);
  });

  it('encuadra y centra un conjunto de vértices dentro de los límites de zoom permitidos', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 }
    ];
    const vp = computeFitViewport(vertices, 1060, 720);
    expect(vp.zoom).toBeGreaterThanOrEqual(CAD_VIEWPORT_CONFIG.FIT_MIN_ZOOM_PIXELS_PER_METER);
    expect(vp.zoom).toBeLessThanOrEqual(CAD_VIEWPORT_CONFIG.FIT_MAX_ZOOM_PIXELS_PER_METER);
    // El centroide (5, 2.5) proyectado a pantalla debe coincidir con (530, 360)
    expect(5 * vp.zoom + vp.pan.x).toBeCloseTo(530, 4);
    expect(2.5 * vp.zoom + vp.pan.y).toBeCloseTo(360, 4);
  });

  it('preserva las coordenadas de mundo bajo el cursor durante computeWheelZoomViewport', () => {
    const currentZoom = 60;
    const currentPan = { x: 120, y: 180 };
    const mouseX = 300;
    const mouseY = 240;
    const worldXBefore = (mouseX - currentPan.x) / currentZoom;
    const worldYBefore = (mouseY - currentPan.y) / currentZoom;

    const next = computeWheelZoomViewport(currentZoom, currentPan, -100, mouseX, mouseY);
    expect(next.zoom).toBeGreaterThan(currentZoom);

    const worldXAfter = (mouseX - next.pan.x) / next.zoom;
    const worldYAfter = (mouseY - next.pan.y) / next.zoom;
    expect(worldXAfter).toBeCloseTo(worldXBefore, 6);
    expect(worldYAfter).toBeCloseTo(worldYBefore, 6);
  });

  it('calcula zoom por pellizco táctil manteniendo fijo el punto medio en computePinchZoomViewport', () => {
    const next = computePinchZoomViewport(60, { x: 100, y: 100 }, 100, 150, 220, 220);
    expect(next.zoom).toBeCloseTo(90, 5);
    // El punto de mundo en (220, 220) era (2, 2); con zoom 90 debe quedar en 220 - 180 = 40
    expect(next.pan.x).toBeCloseTo(40, 5);
    expect(next.pan.y).toBeCloseTo(40, 5);
  });

  it('desplaza y redimensiona el recuadro cuadrado de muestreo desde sus 5 manipuladores', () => {
    const init = { x: 2, y: 3, size: 1 };
    expect(computeAdjustedSampleSquareBox(init, 'move', 0.5, -0.25)).toEqual({
      x: 2.5,
      y: 2.75,
      size: 1
    });
    expect(computeAdjustedSampleSquareBox(init, 'se', 0.4, 0.2)).toEqual({
      x: 2,
      y: 3,
      size: 1.4
    });
    expect(computeAdjustedSampleSquareBox(init, 'nw', -0.5, -0.5)).toEqual({
      x: 1.5,
      y: 2.5,
      size: 1.5
    });
    // Respeta tamaño mínimo
    expect(computeAdjustedSampleSquareBox(init, 'se', -5, -5).size).toBe(
      CAD_VIEWPORT_CONFIG.SAMPLE_BOX_MIN_SIZE_M
    );
  });

  it('resuelve la cascada de prioridades de snap en resolveCanvasHoverSnap (muro y centroide)', () => {
    const v1: WallVertex = { id: 'v1', x: 0, y: 0 };
    const v2: WallVertex = { id: 'v2', x: 4, y: 0 };
    const v3: WallVertex = { id: 'v3', x: 4, y: 4 };
    const v4: WallVertex = { id: 'v4', x: 0, y: 4 };
    const verticesMap = new Map<string, WallVertex>([
      ['v1', v1],
      ['v2', v2],
      ['v3', v3],
      ['v4', v4]
    ]);
    const wall: Wall = {
      id: 'w1',
      startVertexId: 'v1',
      endVertexId: 'v2',
      thickness: 0.15,
      height: 2.8,
      levelId: 'level_1'
    };
    const space: Space = {
      id: 's1',
      name: 'Dormitorio',
      category: 'dormitorio',
      levelId: 'level_1',
      ceilingHeight: 2.7,
      floorElevation: 0,
      boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
      wallIds: ['w1']
    };

    // 1. Símbolo de pared cerca del muro w1 -> acopla a muro
    const wallSnapRes = resolveCanvasHoverSnap({
      rawWorldPos: { x: 2, y: 0.2 },
      selectedSymbolId: 'toma_doble',
      snapAllowed: true,
      underlaySnapAllowed: false,
      activeLevelWalls: [wall],
      activeLevelSpaces: [space],
      allVertices: [v1, v2, v3, v4],
      verticesMap,
      isSamplingPattern: false,
      positiveExemplarsCount: 0,
      isMovingSpace: false
    });
    expect(wallSnapRes.snapInfo?.wallId).toBe('w1');
    expect(wallSnapRes.isSnappedToCenter).toBe(false);

    // 2. Símbolo de techo cerca del centroide (2, 2) -> ignora pared y acopla al centroide
    const centerSnapRes = resolveCanvasHoverSnap({
      rawWorldPos: { x: 2.1, y: 1.9 },
      selectedSymbolId: 'boca_techo',
      snapAllowed: true,
      underlaySnapAllowed: false,
      activeLevelWalls: [wall],
      activeLevelSpaces: [space],
      allVertices: [v1, v2, v3, v4],
      verticesMap,
      isSamplingPattern: false,
      positiveExemplarsCount: 0,
      isMovingSpace: false
    });
    expect(centerSnapRes.isSnappedToCenter).toBe(true);
    expect(centerSnapRes.worldPos).toEqual({ x: 2, y: 2 });
  });
});
