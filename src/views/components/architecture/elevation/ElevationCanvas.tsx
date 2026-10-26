import React, { useRef, useCallback, memo } from 'react';
import { Focus } from 'lucide-react';
import { WALL_ELEVATION_STYLE } from '../../../../models/architecture/wallElevationStyle';
import { WALL_ELEVATION_CONSTANTS, toDrawingY, type ElevationPoint } from '../../../../models/architecture/wallElevation';
import type {
  WallElevation,
  ElevationBox,
  ElevationConduit
} from '../../../../models/architecture/wallElevation';
import type {
  ElevationRouteGrip,
  ElevationSelection,
  ElevationPlacementToolState,
  ElevationPlacementPreview,
  ElevationOpeningPlacementToolState,
  ElevationOpeningPlacementPreview
} from '../../../../viewmodels/useWallElevationViewModel';

interface ElevationCanvasProps {
  elevation: WallElevation;
  displayBoxes: ElevationBox[];
  displayConduits: ElevationConduit[];
  routeGrips: ElevationRouteGrip[];
  guideY: number | null;
  isDragging: boolean;
  isGripDragging: boolean;
  selection: ElevationSelection | null;
  selectedConduit: ElevationConduit | null;
  viewBoxAttribute: string;
  selectBox: (boxId: string) => void;
  selectOpening: (openingId: string) => void;
  selectConduit: (conduitId: string) => void;
  clearSelection: () => void;
  beginBoxDrag: (boxId: string, world: ElevationPoint) => void;
  moveBoxDrag: (world: ElevationPoint) => void;
  endBoxDrag: () => void;
  beginRoutePointDrag: (conduitId: string, pointIndex: number) => void;
  moveRoutePointDrag: (world: ElevationPoint) => void;
  endRoutePointDrag: () => void;
  wheelZoomFactor: (deltaY: number) => number;
  zoomAt: (factor: number, center?: ElevationPoint) => void;
  panBy: (dxM: number, dyM: number) => void;
  fitWall: () => void;
  fit: () => void;
  placementTool: ElevationPlacementToolState | null;
  placementPreview: ElevationPlacementPreview | null;
  commitPlacement: (world: ElevationPoint) => void;
  updatePlacementPreview: (world: ElevationPoint) => void;
  openingPlacementTool: ElevationOpeningPlacementToolState | null;
  openingPlacementPreview: ElevationOpeningPlacementPreview | null;
  commitOpeningPlacement: (world: ElevationPoint) => void;
  updateOpeningPlacementPreview: (world: ElevationPoint) => void;
  isConnectingConduit: boolean;
  conduitSourceBoxId: string | null;
  cancelConduitConnection: () => void;
  handleBoxClickInConnectMode: (boxId: string) => void;
  pointerWorld: { x: number; y: number } | null;
  setPointerWorld: (pt: { x: number; y: number } | null) => void;
}

export const ElevationCanvas: React.FC<ElevationCanvasProps> = memo(({
  elevation,
  displayBoxes,
  displayConduits,
  routeGrips,
  guideY,
  isDragging,
  isGripDragging,
  selection,
  selectedConduit,
  viewBoxAttribute,
  selectBox,
  selectOpening,
  selectConduit,
  clearSelection,
  beginBoxDrag,
  moveBoxDrag,
  endBoxDrag,
  beginRoutePointDrag,
  moveRoutePointDrag,
  endRoutePointDrag,
  wheelZoomFactor,
  zoomAt,
  panBy,
  fitWall,
  fit,
  placementTool,
  placementPreview,
  commitPlacement,
  updatePlacementPreview,
  openingPlacementTool,
  openingPlacementPreview,
  commitOpeningPlacement,
  updateOpeningPlacementPreview,
  isConnectingConduit,
  conduitSourceBoxId,
  cancelConduitConnection,
  handleBoxClickInConnectMode,
  pointerWorld,
  setPointerWorld
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  const touchStateRef = useRef<{
    type: 'single' | 'pinch';
    startX: number;
    startY: number;
    startDist?: number;
    startCenter?: { x: number; y: number };
  } | null>(null);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const worldPt = pt.matrixTransform(inv);
    return { x: worldPt.x, y: worldPt.y };
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const world = clientToWorld(e.clientX, e.clientY);
      if (!world) return;
      const factor = wheelZoomFactor(e.deltaY);
      zoomAt(factor, world);
    },
    [clientToWorld, wheelZoomFactor, zoomAt]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midClientX = (t1.clientX + t2.clientX) / 2;
        const midClientY = (t1.clientY + t2.clientY) / 2;
        const worldCenter = clientToWorld(midClientX, midClientY);
        touchStateRef.current = {
          type: 'pinch',
          startX: midClientX,
          startY: midClientY,
          startDist: dist,
          startCenter: worldCenter ?? undefined
        };
      } else if (e.touches.length === 1 && !isDragging && !isGripDragging) {
        const t = e.touches[0];
        touchStateRef.current = {
          type: 'single',
          startX: t.clientX,
          startY: t.clientY
        };
      }
    },
    [clientToWorld, isDragging, isGripDragging]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (isGripDragging) {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const world = clientToWorld(t.clientX, t.clientY);
          if (world) moveRoutePointDrag(world);
        }
        return;
      }
      if (isDragging) {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const world = clientToWorld(t.clientX, t.clientY);
          if (world) moveBoxDrag(world);
        }
        return;
      }
      if (!touchStateRef.current) return;
      if (e.touches.length === 2 && touchStateRef.current.type === 'pinch') {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const startDist = touchStateRef.current.startDist || currentDist;
        if (startDist > 0 && Math.abs(currentDist - startDist) > 2) {
          const factor = currentDist / startDist;
          zoomAt(factor, touchStateRef.current.startCenter);
          touchStateRef.current.startDist = currentDist;
        }
      } else if (e.touches.length === 1 && touchStateRef.current.type === 'single') {
        const t = e.touches[0];
        const dxPx = t.clientX - touchStateRef.current.startX;
        const dyPx = t.clientY - touchStateRef.current.startY;
        touchStateRef.current.startX = t.clientX;
        touchStateRef.current.startY = t.clientY;
        const svg = svgRef.current;
        if (!svg) return;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const dxM = dxPx / ctm.a;
        const dyM = dyPx / ctm.d;
        panBy(dxM, dyM);
      }
    },
    [isGripDragging, isDragging, clientToWorld, moveRoutePointDrag, moveBoxDrag, zoomAt, panBy]
  );

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = null;
    if (isGripDragging) {
      endRoutePointDrag();
    }
    if (isDragging) {
      endBoxDrag();
    }
  }, [isGripDragging, isDragging, endRoutePointDrag, endBoxDrag]);

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (placementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) commitPlacement(world);
        return;
      }
      if (openingPlacementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) commitOpeningPlacement(world);
        return;
      }
      if (isConnectingConduit) {
        cancelConduitConnection();
        setPointerWorld(null);
        return;
      }
      if (e.pointerType === 'touch') return;
      if (e.target !== svgRef.current && (e.target as Element).id !== 'elevation-backdrop') return;
      clearSelection();
      isPanningRef.current = true;
      panStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [
      placementTool,
      openingPlacementTool,
      isConnectingConduit,
      cancelConduitConnection,
      setPointerWorld,
      clientToWorld,
      commitPlacement,
      commitOpeningPlacement,
      clearSelection
    ]
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isConnectingConduit) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) setPointerWorld(world);
      }
      if (placementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) updatePlacementPreview(world);
        return;
      }
      if (openingPlacementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) updateOpeningPlacementPreview(world);
        return;
      }
      if (isDragging) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) moveBoxDrag(world);
        return;
      }
      if (isGripDragging) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) moveRoutePointDrag(world);
        return;
      }
      if (isPanningRef.current) {
        const svg = svgRef.current;
        if (!svg) return;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const dxPx = e.clientX - panStartRef.current.clientX;
        const dyPx = e.clientY - panStartRef.current.clientY;
        panStartRef.current = { clientX: e.clientX, clientY: e.clientY };
        const dxM = dxPx / ctm.a;
        const dyM = dyPx / ctm.d;
        panBy(dxM, dyM);
      }
    },
    [
      isConnectingConduit,
      setPointerWorld,
      placementTool,
      openingPlacementTool,
      isDragging,
      isGripDragging,
      clientToWorld,
      updatePlacementPreview,
      updateOpeningPlacementPreview,
      moveBoxDrag,
      moveRoutePointDrag,
      panBy
    ]
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isDragging) {
        endBoxDrag();
      }
      if (isGripDragging) {
        endRoutePointDrag();
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        try {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
          // Ignorar si el puntero ya no estaba capturado
        }
      }
    },
    [isDragging, isGripDragging, endBoxDrag, endRoutePointDrag]
  );

  const handleSvgDoubleClick = useCallback(() => {
    fitWall();
  }, [fitWall]);

  return (
    <div className="flex-1 relative min-h-0 overflow-hidden bg-slate-950 flex items-center justify-center touch-none">
      {/* Botonera flotante en lienzo para celular y escritorio */}
      <div className="absolute top-3 left-3 z-20 flex items-center bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-1 gap-1 shadow-lg">
        <button
          type="button"
          onClick={fitWall}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          title="Enfocar muro completo en pantalla"
        >
          <Focus size={13} />
          <span>Ajustar Muro</span>
        </button>
        <button
          type="button"
          onClick={fit}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
          title="Ver cotas generales y cielorraso"
        >
          General
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBoxAttribute}
        preserveAspectRatio="xMidYMid meet"
        style={{ touchAction: 'none' }}
        className={`w-full h-full touch-none ${
          placementTool ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        } outline-none select-none`}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onDoubleClick={handleSvgDoubleClick}
      >
        <defs>
          <pattern id="elevation-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="#1e293b" strokeWidth="0.005" />
          </pattern>
        </defs>

        {/* Fondo de captura de clics y paneo */}
        <rect
          id="elevation-backdrop"
          x={elevation.bounds.x - 30}
          y={elevation.bounds.y - 30}
          width={elevation.bounds.width + 60}
          height={elevation.bounds.height + 60}
          fill="url(#elevation-grid)"
        />

        {/* 1. Línea de Cielorraso o Proyección de Losa */}
        <line
          x1={0}
          y1={elevation.ceilingY}
          x2={elevation.lengthM}
          y2={elevation.ceilingY}
          stroke={WALL_ELEVATION_STYLE.ceilingLine}
          strokeWidth={WALL_ELEVATION_STYLE.strokePx.thin * 0.003}
          strokeDasharray={WALL_ELEVATION_STYLE.dash.ceiling}
        />

        {/* 2. Cuerpo del Muro Desplegado */}
        {(() => {
          const r = elevation.wallRect;
          if (elevation.wallType === 'railing') {
            return (
              <rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={WALL_ELEVATION_STYLE.railing.fill}
                stroke={WALL_ELEVATION_STYLE.railing.stroke}
                strokeWidth={WALL_ELEVATION_STYLE.strokePx.regular * 0.005}
                strokeDasharray={WALL_ELEVATION_STYLE.dash.projected}
              />
            );
          }
          return (
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={WALL_ELEVATION_STYLE.wall.fill}
              stroke={WALL_ELEVATION_STYLE.wall.stroke}
              strokeWidth={WALL_ELEVATION_STYLE.strokePx.regular * 0.005}
            />
          );
        })()}

        {/* 3. Aberturas (Puertas, Ventanas, Vanos) */}
        {elevation.openings.map((op) => {
          const style = WALL_ELEVATION_STYLE.opening[op.type];
          const isSelected = selection?.type === 'opening' && selection.id === op.id;
          return (
            <g
              key={op.id}
              onClick={(e) => {
                e.stopPropagation();
                selectOpening(op.id);
              }}
              className="cursor-pointer group"
            >
              <rect
                x={op.rect.x}
                y={op.rect.y}
                width={op.rect.width}
                height={op.rect.height}
                fill={style.fill}
                stroke={isSelected ? WALL_ELEVATION_STYLE.selection.stroke : style.stroke}
                strokeWidth={
                  isSelected
                    ? WALL_ELEVATION_STYLE.strokePx.heavy * 0.008
                    : WALL_ELEVATION_STYLE.strokePx.regular * 0.005
                }
              />

              {op.type === 'window' && op.sill > 0 && (
                <line
                  x1={op.rect.x}
                  y1={op.rect.y2}
                  x2={op.rect.x2}
                  y2={op.rect.y2}
                  stroke={style.stroke}
                  strokeWidth={WALL_ELEVATION_STYLE.strokePx.regular * 0.005}
                />
              )}

              <text
                x={op.labelAnchor.x}
                y={op.labelAnchor.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                fontWeight="bold"
                fill={style.stroke}
                className="pointer-events-none"
              >
                {op.label || (op.type === 'door' ? 'P' : op.type === 'window' ? 'V' : 'VANO')}
              </text>
            </g>
          );
        })}

        {/* 4. Canalizaciones (Cañerías Físicas a Escala 1:1) */}
        {displayConduits.map((c) => {
          const isSelectedConduit = selection?.type === 'conduit' && selection.id === c.id;
          return (
            <g key={c.id}>
              {c.segments.map((seg, sIdx) => {
                const dStr =
                  c.svgPaths?.[sIdx] ??
                  seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return (
                  <path
                    key={`hit-${sIdx}`}
                    d={dStr}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(c.widthM + 0.08, 0.08)}
                    pointerEvents="stroke"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectConduit(c.id);
                    }}
                  />
                );
              })}

              {c.segments.map((seg, sIdx) => {
                const dStr =
                  c.svgPaths?.[sIdx] ??
                  seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return (
                  <g key={sIdx} className="pointer-events-none">
                    {isSelectedConduit && (
                      <path
                        d={dStr}
                        fill="none"
                        stroke={WALL_ELEVATION_STYLE.selection.halo}
                        strokeWidth={c.widthM + 0.02}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    <path
                      d={dStr}
                      fill="none"
                      stroke={isSelectedConduit ? WALL_ELEVATION_STYLE.selection.stroke : WALL_ELEVATION_STYLE.conduit.outline}
                      strokeWidth={c.widthM + 0.004}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={dStr}
                      fill="none"
                      stroke={c.color}
                      strokeWidth={c.widthM}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Grips interactivos de recorrido cuando hay un conducto seleccionado */}
        {selection?.type === 'conduit' &&
          routeGrips.map((grip) => (
            <g
              key={`grip-${grip.index}`}
              className={grip.isEndpoint ? 'pointer-events-none' : 'cursor-move touch-none'}
              onPointerDown={(e) => {
                if (grip.isEndpoint || !selectedConduit) return;
                e.stopPropagation();
                try {
                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                } catch {
                  // Ignorar si no soporta captura
                }
                beginRoutePointDrag(selectedConduit.id, grip.index);
              }}
              onTouchStart={(e) => {
                if (grip.isEndpoint || !selectedConduit) return;
                e.stopPropagation();
                beginRoutePointDrag(selectedConduit.id, grip.index);
              }}
            >
              <circle
                cx={grip.x}
                cy={grip.y}
                r={grip.isEndpoint ? 0.04 : 0.22}
                fill="transparent"
                pointerEvents={grip.isEndpoint ? 'none' : 'all'}
              />
              {!grip.isEndpoint && (
                <circle
                  cx={grip.x}
                  cy={grip.y}
                  r={isGripDragging ? 0.08 : 0.06}
                  fill={isGripDragging ? '#f59e0b' : '#3b82f6'}
                  fillOpacity={0.25}
                  stroke={isGripDragging ? '#fbbf24' : '#60a5fa'}
                  strokeWidth={0.006}
                  strokeDasharray="0.02 0.015"
                  className="pointer-events-none animate-pulse"
                />
              )}
              <circle
                cx={grip.x}
                cy={grip.y}
                r={grip.isEndpoint ? 0.014 : isGripDragging ? 0.042 : 0.032}
                fill={grip.isEndpoint ? '#64748b' : isGripDragging ? '#d97706' : '#2563eb'}
                stroke="#ffffff"
                strokeWidth={0.006}
                className="pointer-events-none"
              />
              {!grip.isEndpoint && (
                <text
                  x={grip.x}
                  y={grip.y - 0.065}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fontSize={0.075}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={isGripDragging ? '#fbbf24' : '#60a5fa'}
                  stroke="#0f172a"
                  strokeWidth={0.02}
                  paintOrder="stroke"
                  className="pointer-events-none select-none"
                >
                  {grip.z.toFixed(2)}m
                </text>
              )}
            </g>
          ))}

        {/* Línea elástica / Rubberband durante trazado interactivo de conductos */}
        {isConnectingConduit && conduitSourceBoxId && pointerWorld && (() => {
          const src = displayBoxes.find((b) => b.id === conduitSourceBoxId);
          if (!src) return null;
          const srcCenterY = src.rect.y + src.rect.height / 2;
          return (
            <g className="pointer-events-none">
              <line
                x1={src.centerX}
                y1={srcCenterY}
                x2={pointerWorld.x}
                y2={pointerWorld.y}
                stroke="#38bdf8"
                strokeWidth={0.02}
                strokeOpacity={0.4}
                strokeLinecap="round"
              />
              <line
                x1={src.centerX}
                y1={srcCenterY}
                x2={pointerWorld.x}
                y2={pointerWorld.y}
                stroke="#0284c7"
                strokeWidth={0.01}
                strokeDasharray="0.04 0.02"
                strokeLinecap="round"
              />
            </g>
          );
        })()}

        {/* 5. Cajas Eléctricas y Gabinetes a Escala 1:1 */}
        {displayBoxes.map((b) => {
          const isSelected = selection?.type === 'box' && selection.id === b.id;
          const isSourceBox = isConnectingConduit && conduitSourceBoxId === b.id;
          const isConnectTargetCandidate = isConnectingConduit && conduitSourceBoxId !== b.id;
          const paint =
            b.shape === 'cabinet' ? WALL_ELEVATION_STYLE.box.cabinet : WALL_ELEVATION_STYLE.box.default;

          return (
            <g
              key={b.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isConnectingConduit) {
                  handleBoxClickInConnectMode(b.id);
                  return;
                }
                const world = clientToWorld(e.clientX, e.clientY);
                if (world) beginBoxDrag(b.id, world);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isConnectingConduit) {
                  handleBoxClickInConnectMode(b.id);
                  return;
                }
                selectBox(b.id);
              }}
              className={isConnectingConduit ? 'cursor-pointer group' : 'cursor-grab active:cursor-grabbing group'}
            >
              <rect
                x={b.rect.x - 0.08}
                y={b.rect.y - 0.08}
                width={b.rect.width + 0.16}
                height={b.rect.height + 0.16}
                fill="transparent"
                pointerEvents="all"
                className="cursor-pointer"
              />

              {isSourceBox && (
                <rect
                  x={b.rect.x - 0.03}
                  y={b.rect.y - 0.03}
                  width={b.rect.width + 0.06}
                  height={b.rect.height + 0.06}
                  fill="#0284c7"
                  fillOpacity={0.25}
                  stroke="#38bdf8"
                  strokeWidth={0.016}
                  strokeDasharray="0.03 0.015"
                  className="animate-pulse"
                  rx={0.015}
                />
              )}

              {isConnectTargetCandidate && (
                <rect
                  x={b.rect.x - 0.02}
                  y={b.rect.y - 0.02}
                  width={b.rect.width + 0.04}
                  height={b.rect.height + 0.04}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={0.01}
                  strokeDasharray="0.02 0.02"
                  opacity={0.7}
                  rx={0.01}
                />
              )}

              {!isConnectingConduit && isSelected && (
                <rect
                  x={b.rect.x - 0.015}
                  y={b.rect.y - 0.015}
                  width={b.rect.width + 0.03}
                  height={b.rect.height + 0.03}
                  fill="none"
                  stroke={WALL_ELEVATION_STYLE.selection.halo}
                  strokeWidth={0.015}
                  rx={0.01}
                />
              )}

              {b.shape === 'octagon' && b.outline.length > 0 ? (
                <polygon
                  points={b.outline.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={paint.fill}
                  stroke={isSelected ? WALL_ELEVATION_STYLE.selection.stroke : paint.stroke}
                  strokeWidth={
                    isSelected
                      ? WALL_ELEVATION_STYLE.strokePx.heavy * 0.007
                      : WALL_ELEVATION_STYLE.strokePx.regular * 0.005
                  }
                />
              ) : (
                <rect
                  x={b.rect.x}
                  y={b.rect.y}
                  width={b.rect.width}
                  height={b.rect.height}
                  fill={paint.fill}
                  stroke={isSelected ? WALL_ELEVATION_STYLE.selection.stroke : paint.stroke}
                  strokeWidth={
                    isSelected
                      ? WALL_ELEVATION_STYLE.strokePx.heavy * 0.007
                      : WALL_ELEVATION_STYLE.strokePx.regular * 0.005
                  }
                  rx={b.shape === 'cabinet' ? 0.015 : 0.005}
                />
              )}

              {b.knockouts.map((ko, kIdx) => (
                <circle
                  key={kIdx}
                  cx={ko.cx}
                  cy={ko.cy}
                  r={ko.r}
                  fill="none"
                  stroke={WALL_ELEVATION_STYLE.box.knockout}
                  strokeWidth={0.003}
                />
              ))}

              <text
                x={b.labelAnchor.x}
                y={b.labelAnchor.y}
                textAnchor="middle"
                dominantBaseline="alphabetic"
                fontSize={WALL_ELEVATION_CONSTANTS.LABEL_FONT_SIZE_M}
                fontWeight="bold"
                fill={WALL_ELEVATION_STYLE.box.label}
                className="pointer-events-none"
              >
                {b.label || (b.kind === 'panel' ? 'TABLERO' : 'BOCA')}
              </text>
            </g>
          );
        })}

        {/* Previsualización fantasma de colocación interactiva de boca o tablero con snap */}
        {placementPreview &&
          (() => {
            const isPanelPrev =
              placementPreview.symbolId.includes('tablero') ||
              placementPreview.symbolId.includes('tp') ||
              placementPreview.symbolId.includes('ts') ||
              placementPreview.symbolId.includes('medidor');
            const w = isPanelPrev ? 0.30 : 0.10;
            const h = isPanelPrev ? 0.40 : 0.10;
            const y = toDrawingY(placementPreview.z, elevation.drawingHeightM) - h / 2;
            return (
              <g className="pointer-events-none">
                <rect
                  x={placementPreview.x - w / 2}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#38bdf8"
                  strokeWidth={0.006}
                  strokeDasharray="0.02 0.01"
                  rx={isPanelPrev ? 0.015 : 0.005}
                />
                <text
                  x={placementPreview.x}
                  y={y + h / 2 + 0.015}
                  textAnchor="middle"
                  fontSize={0.045}
                  fontWeight="bold"
                  fill="#38bdf8"
                >
                  +{placementPreview.z.toFixed(2)}m
                </text>
              </g>
            );
          })()}

        {/* Previsualización fantasma de inserción de abertura en el muro */}
        {openingPlacementPreview && (
          <g className="pointer-events-none">
            <rect
              x={openingPlacementPreview.xLeft}
              y={toDrawingY(
                openingPlacementPreview.sill + openingPlacementPreview.height,
                elevation.drawingHeightM
              )}
              width={openingPlacementPreview.width}
              height={openingPlacementPreview.height}
              fill="rgba(245, 158, 11, 0.20)"
              stroke="#f59e0b"
              strokeWidth={0.015}
              strokeDasharray="0.04 0.02"
            />
            <rect
              x={openingPlacementPreview.xLeft}
              y={toDrawingY(
                openingPlacementPreview.sill + openingPlacementPreview.height,
                elevation.drawingHeightM
              )}
              width={openingPlacementPreview.width}
              height={0.025}
              fill="#f59e0b"
              opacity={0.8}
            />
            <text
              x={openingPlacementPreview.xLeft + openingPlacementPreview.width / 2}
              y={toDrawingY(
                openingPlacementPreview.sill + openingPlacementPreview.height / 2,
                elevation.drawingHeightM
              )}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={0.065}
              fontWeight="bold"
              fill="#fbbf24"
              fontFamily="sans-serif"
            >
              {openingPlacementPreview.name}
            </text>
            <text
              x={openingPlacementPreview.xLeft + openingPlacementPreview.width / 2}
              y={
                toDrawingY(
                  openingPlacementPreview.sill + openingPlacementPreview.height / 2,
                  elevation.drawingHeightM
                ) + 0.065
              }
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={0.045}
              fontWeight="bold"
              fill="#fde68a"
              fontFamily="monospace"
            >
              {openingPlacementPreview.width.toFixed(2)}m × {openingPlacementPreview.height.toFixed(2)}m (sill: +{openingPlacementPreview.sill.toFixed(2)}m)
            </text>
          </g>
        )}

        {/* 6. Guía Magnética de Altura Reglamentaria AEA Activa en Arrastre */}
        {guideY != null && (
          <g className="pointer-events-none">
            <line
              x1={-0.1}
              y1={guideY}
              x2={elevation.lengthM + 0.1}
              y2={guideY}
              stroke={WALL_ELEVATION_STYLE.guide}
              strokeWidth={0.008}
              strokeDasharray={WALL_ELEVATION_STYLE.dash.guide}
            />
          </g>
        )}

        {/* 7. Línea de Piso Terminado (N.P.T. 0.00) */}
        <g className="pointer-events-none">
          <line
            x1={elevation.floorLine.x1}
            y1={elevation.floorLine.y}
            x2={elevation.floorLine.x2}
            y2={elevation.floorLine.y}
            stroke={WALL_ELEVATION_STYLE.floorLine}
            strokeWidth={WALL_ELEVATION_STYLE.strokePx.heavy * 0.006}
          />
          <text
            x={-0.08}
            y={elevation.floorLine.y + 0.06}
            textAnchor="end"
            fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
            fontWeight="bold"
            fill={WALL_ELEVATION_STYLE.levelMark}
          >
            N.P.T. ±0.00
          </text>
        </g>

        {/* 8. Cotas Altimétricas de Nivel (Eje Izquierdo) */}
        <g className="pointer-events-none">
          {elevation.levelMarks.map((lm, idx) => (
            <g key={idx}>
              <line
                x1={lm.tickX1}
                y1={lm.y}
                x2={lm.tickX2}
                y2={lm.y}
                stroke={WALL_ELEVATION_STYLE.levelMark}
                strokeWidth={0.004}
              />
              <text
                x={lm.textX}
                y={lm.textY}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                fontFamily="monospace"
                fill={WALL_ELEVATION_STYLE.levelMark}
              >
                {lm.label}
              </text>
            </g>
          ))}
        </g>

        {/* 9. Cadena de Cotas Horizontales (Eje Inferior) */}
        <g className="pointer-events-none">
          <line
            x1={0}
            y1={elevation.dimensionLine.y}
            x2={elevation.lengthM}
            y2={elevation.dimensionLine.y}
            stroke={WALL_ELEVATION_STYLE.dimension}
            strokeWidth={0.004}
          />
          {elevation.dimensionChain.map((seg, sIdx) => (
            <g key={sIdx}>
              <line
                x1={seg.x1}
                y1={elevation.dimensionLine.tickY1}
                x2={seg.x1}
                y2={elevation.dimensionLine.tickY2}
                stroke={WALL_ELEVATION_STYLE.dimension}
                strokeWidth={0.004}
              />
              <line
                x1={seg.x2}
                y1={elevation.dimensionLine.tickY1}
                x2={seg.x2}
                y2={elevation.dimensionLine.tickY2}
                stroke={WALL_ELEVATION_STYLE.dimension}
                strokeWidth={0.004}
              />
              <text
                x={seg.cx}
                y={elevation.dimensionLine.textY}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                fontFamily="monospace"
                fontWeight="bold"
                fill={WALL_ELEVATION_STYLE.dimension}
              >
                {seg.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
});
