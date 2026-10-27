/**
 * Capa SVG de muros físicos con espesor, esquinas en inglete, grips de arrastre y cotas.
 * El estado de hover es local a la capa para no re-renderizar el lienzo completo.
 */
import React, { useState } from 'react';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import { getWallPolygon, getWallLength } from '../../../../models/architecture/Wall';
import { computeResolvedWallPolygons } from '../../../../models/architecture/WallCornerEngine';
import { getWallBodyStyle, getWallTypologyLabel } from '../../../../models/architecture/wallRenderModel';
import { CAD_WALL_STYLES as W } from '../../../../config';
import type { ActiveWallDragState } from '../../../../viewmodels/useWallGripDrag';

/** Acciones de arrastre de extremos; deben tener identidad estable entre renders. */
export interface WallGripActions {
  onGripDown: (e: React.PointerEvent, wallId: string, end: 'start' | 'end', vertexId: string) => void;
  onGripMove: (e: React.PointerEvent) => void;
  onGripRelease: (e: React.PointerEvent) => void;
}

export interface WallsLayerProps {
  walls: Wall[];
  verticesMap: Map<string, WallVertex>;
  zoom: number;
  selectedWallId: string | null;
  selectedWallIds?: ReadonlySet<string>;
  selectedWallAnchorMode?: 'start' | 'end' | 'center';
  showDimensions: boolean;
  isArchitectureLocked: boolean;
  activeDrag?: ActiveWallDragState | null;
  activeDragWallId: string | null;
  activeDragEnd: 'start' | 'end' | null;
  gripActions: WallGripActions;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onWallClick?: (id: string, e: React.MouseEvent) => void;
  onWallDoubleClick?: (id: string) => void;
}

interface WallGripProps {
  x: number;
  y: number;
  end: 'start' | 'end';
  wallId: string;
  vertexId: string;
  isDragged: boolean;
  isAnchor: boolean;
  isLocked: boolean;
  actions: WallGripActions;
}

const WallGrip: React.FC<WallGripProps> = ({
  x,
  y,
  end,
  wallId,
  vertexId,
  isDragged,
  isAnchor,
  isLocked,
  actions
}) => {
  const accent = isDragged ? W.gripActive : isAnchor ? '#2563eb' : '#059669';
  const group = end === 'start' ? 'group/grip-start' : 'group/grip-end';
  const hover = end === 'start' ? 'group-hover/grip-start:scale-125' : 'group-hover/grip-end:scale-125';
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const hitRadius = isTouchDevice ? W.gripTouchHitRadiusPx : W.gripHitRadiusPx;

  return (
    <g
      className={`${isLocked ? 'cursor-not-allowed' : 'cursor-move'} ${group}`}
      onPointerDown={(e) => !isLocked && actions.onGripDown(e, wallId, end, vertexId)}
      onPointerMove={(e) => !isLocked && actions.onGripMove(e)}
      onPointerUp={(e) => !isLocked && actions.onGripRelease(e)}
      onPointerCancel={(e) => !isLocked && actions.onGripRelease(e)}
    >
      {/* Hitbox táctil ergonómica amplia */}
      <circle cx={x} cy={y} r={hitRadius} fill="transparent" pointerEvents="all" />

      {/* Halo exterior de anclaje fijo */}
      {isAnchor && (
        <circle
          cx={x}
          cy={y}
          r={W.gripHaloRadiusPx + 4}
          fill="none"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          className="pointer-events-none animate-pulse"
        />
      )}

      {/* Halo visual exterior */}
      <circle
        cx={x}
        cy={y}
        r={W.gripHaloRadiusPx}
        fill={W.gripFill}
        stroke={accent}
        strokeWidth={isAnchor ? 3 : 2}
        className={`drop-shadow pointer-events-none ${hover} transition-transform`}
      />

      {/* Núcleo central */}
      <circle cx={x} cy={y} r={W.gripCoreRadiusPx} fill={accent} className="pointer-events-none" />

      {/* Insignia indicadora de rol de nodo (Fijo vs Móvil) */}
      {!isDragged && (
        <g transform={`translate(${x}, ${y - 17})`} className="pointer-events-none select-none">
          <rect
            x={isAnchor ? -18 : -20}
            y={-8}
            width={isAnchor ? 36 : 40}
            height={16}
            rx={4}
            fill={isAnchor ? '#1e3a8a' : '#065f46'}
            fillOpacity={0.92}
            stroke={isAnchor ? '#60a5fa' : '#34d399'}
            strokeWidth={1}
            className="drop-shadow-sm"
          />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fontWeight="bold"
            fontFamily="monospace"
            fill="#ffffff"
          >
            {isAnchor ? '🔒 Fijo' : '↔ Móvil'}
          </text>
        </g>
      )}
    </g>
  );
};

export const WallsLayer: React.FC<WallsLayerProps> = React.memo(
  ({
    walls,
    verticesMap,
    zoom,
    selectedWallId,
    selectedWallIds,
    selectedWallAnchorMode,
    showDimensions,
    isArchitectureLocked,
    activeDrag,
    activeDragWallId,
    activeDragEnd,
    gripActions,
    wasDraggingRecentlyRef,
    isInteractionInterceptedRef,
    triggerPlacementRef,
    onWallClick,
    onWallDoubleClick
  }) => {
    const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
    const resolvedPolys = computeResolvedWallPolygons(walls, verticesMap);

    return (
      <>
        {walls.map((wall) => {
          const poly = resolvedPolys.get(wall.id) || getWallPolygon(wall, verticesMap);
          const vStart = verticesMap.get(wall.startVertexId);
          const vEnd = verticesMap.get(wall.endVertexId);
          if (!poly || !vStart || !vEnd) return null;

          const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
          const lenM = getWallLength(wall, verticesMap);
          const isSelected = selectedWallIds ? selectedWallIds.has(wall.id) : selectedWallId === wall.id;
          const isSingleWallSelected = (selectedWallIds ? selectedWallIds.size === 1 : Boolean(selectedWallId)) && isSelected;
          const midX = ((vStart.x + vEnd.x) / 2) * zoom;
          const midY = ((vStart.y + vEnd.y) / 2) * zoom;
          const body = getWallBodyStyle(wall, isSelected, hoveredWallId === wall.id);
          const typologyLabel = getWallTypologyLabel(wall);
          const draggedEnd = activeDragWallId === wall.id ? activeDragEnd : null;

          return (
            <g
              key={wall.id}
              onMouseEnter={() => setHoveredWallId(wall.id)}
              onMouseLeave={() => setHoveredWallId(null)}
              onClick={(e) => {
                if (wasDraggingRecentlyRef.current()) return;
                if (isInteractionInterceptedRef.current) {
                  // Modo inserción de elemento eléctrico o conexión de cañerías / mover espacio
                  triggerPlacementRef.current(e.clientX, e.clientY);
                  return;
                }
                e.stopPropagation();
                onWallClick?.(wall.id, e);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onWallDoubleClick?.(wall.id);
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
                strokeWidth={Math.max(wall.thickness * zoom + W.hitAreaPaddingPx, W.hitAreaMinWidthPx)}
                pointerEvents="stroke"
              />

              {/* 2. Cuerpo físico del muro */}
              <polygon points={pointsStr} fill={body.fill} stroke={body.stroke} strokeWidth={body.strokeWidth} strokeDasharray={body.strokeDasharray} />
              {typologyLabel && (
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  className="fill-white font-mono font-bold pointer-events-none select-none drop-shadow"
                >
                  {typologyLabel}
                </text>
              )}

              {/* 3. Indicador y Grips interactivos de selección activa */}
              {isSelected && (
                <>
                  <polygon points={pointsStr} fill="none" stroke={W.selected.outline} strokeWidth={3} strokeDasharray="6 3" />
                  {isSingleWallSelected && (
                    <>
                      <WallGrip
                        x={vStart.x * zoom}
                        y={vStart.y * zoom}
                        end="start"
                        wallId={wall.id}
                        vertexId={vStart.id}
                        isDragged={draggedEnd === 'start'}
                        isAnchor={selectedWallAnchorMode !== 'end'}
                        isLocked={isArchitectureLocked}
                        actions={gripActions}
                      />
                      <WallGrip
                        x={vEnd.x * zoom}
                        y={vEnd.y * zoom}
                        end="end"
                        wallId={wall.id}
                        vertexId={vEnd.id}
                        isDragged={draggedEnd === 'end'}
                        isAnchor={selectedWallAnchorMode === 'end'}
                        isLocked={isArchitectureLocked}
                        actions={gripActions}
                      />
                    </>
                  )}
                  {selectedWallIds && selectedWallIds.size > 1 && (
                    <g transform={`translate(${midX}, ${midY - 14})`}>
                      <circle r={8} fill="#2563eb" stroke="#ffffff" strokeWidth={1.5} className="drop-shadow" />
                      <path d="M-3 0 L-1 2 L3 -2" fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
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
                    fill={W.dimensionBackground}
                    fillOpacity={0.95}
                    stroke={isSelected ? W.gripStroke : W.dimensionStroke}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                  />
                  <text x={0} y={2} textAnchor="middle" fontSize={9} className="font-mono font-bold fill-slate-800 select-none pointer-events-none">
                    {lenM.toFixed(2)} m
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 5. Overlay ergonómico de arrastre táctil (Touch Reticle, Stem & Mini-HUD) */}
        {activeDrag && activeDrag.pointerType === 'touch' && activeDrag.currentPointWorld && (
          <g className="pointer-events-none select-none">
            <line
              x1={activeDrag.currentPointWorld.x * zoom}
              y1={activeDrag.currentPointWorld.y * zoom + W.gripTouchElevationOffsetPx}
              x2={activeDrag.currentPointWorld.x * zoom}
              y2={activeDrag.currentPointWorld.y * zoom}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <circle
              cx={activeDrag.currentPointWorld.x * zoom}
              cy={activeDrag.currentPointWorld.y * zoom + W.gripTouchElevationOffsetPx}
              r={16}
              fill="#3b82f6"
              fillOpacity={0.12}
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <circle
              cx={activeDrag.currentPointWorld.x * zoom}
              cy={activeDrag.currentPointWorld.y * zoom}
              r={15}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="5 3"
            />
            <line
              x1={activeDrag.currentPointWorld.x * zoom - 8}
              y1={activeDrag.currentPointWorld.y * zoom}
              x2={activeDrag.currentPointWorld.x * zoom + 8}
              y2={activeDrag.currentPointWorld.y * zoom}
              stroke="#2563eb"
              strokeWidth={1.5}
            />
            <line
              x1={activeDrag.currentPointWorld.x * zoom}
              y1={activeDrag.currentPointWorld.y * zoom - 8}
              x2={activeDrag.currentPointWorld.x * zoom}
              y2={activeDrag.currentPointWorld.y * zoom + 8}
              stroke="#2563eb"
              strokeWidth={1.5}
            />
            <g transform={`translate(${activeDrag.currentPointWorld.x * zoom}, ${activeDrag.currentPointWorld.y * zoom - 24})`}>
              <rect
                x={-55}
                y={-11}
                width={110}
                height={22}
                rx={6}
                fill="#0f172a"
                fillOpacity={0.94}
                stroke="#38bdf8"
                strokeWidth={1}
              />
              <text
                x={0}
                y={1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
                fill="#ffffff"
              >
                {activeDrag.currentLengthM !== undefined ? `${activeDrag.currentLengthM.toFixed(2)}m` : ''}
                {activeDrag.snapLabel ? ` · ${activeDrag.snapLabel}` : ` · ${activeDrag.currentAngleDeg?.toFixed(0)}°`}
              </text>
            </g>
          </g>
        )}
      </>
    );
  }
);
WallsLayer.displayName = 'WallsLayer';
