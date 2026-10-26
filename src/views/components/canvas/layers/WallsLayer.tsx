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

/** Acciones de arrastre de extremos; deben tener identidad estable entre renders. */
export interface WallGripActions {
  onGripDown: (e: React.PointerEvent, wallId: string, end: 'start' | 'end', vertexId: string) => void;
  onGripMove: (e: React.PointerEvent) => void;
  onGripRelease: (e: React.PointerEvent) => void;
}

interface WallsLayerProps {
  walls: Wall[];
  verticesMap: Map<string, WallVertex>;
  zoom: number;
  selectedWallId: string | null;
  showDimensions: boolean;
  isArchitectureLocked: boolean;
  activeDragWallId: string | null;
  activeDragEnd: 'start' | 'end' | null;
  gripActions: WallGripActions;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onWallClick?: (id: string) => void;
  onWallDoubleClick?: (id: string) => void;
}

interface WallGripProps {
  x: number;
  y: number;
  end: 'start' | 'end';
  wallId: string;
  vertexId: string;
  isDragged: boolean;
  isLocked: boolean;
  actions: WallGripActions;
}

const WallGrip: React.FC<WallGripProps> = ({ x, y, end, wallId, vertexId, isDragged, isLocked, actions }) => {
  const accent = isDragged ? W.gripActive : W.gripStroke;
  const group = end === 'start' ? 'group/grip-start' : 'group/grip-end';
  const hover = end === 'start' ? 'group-hover/grip-start:scale-125' : 'group-hover/grip-end:scale-125';
  return (
    <g
      className={`${isLocked ? 'cursor-not-allowed' : 'cursor-move'} ${group}`}
      onPointerDown={(e) => !isLocked && actions.onGripDown(e, wallId, end, vertexId)}
      onPointerMove={(e) => !isLocked && actions.onGripMove(e)}
      onPointerUp={(e) => !isLocked && actions.onGripRelease(e)}
      onPointerCancel={(e) => !isLocked && actions.onGripRelease(e)}
    >
      {/* Hitbox táctil ergonómica invisible */}
      <circle cx={x} cy={y} r={W.gripHitRadiusPx} fill="transparent" pointerEvents="all" />
      {/* Halo visual exterior */}
      <circle
        cx={x}
        cy={y}
        r={W.gripHaloRadiusPx}
        fill={W.gripFill}
        stroke={accent}
        strokeWidth={2.5}
        className={`drop-shadow pointer-events-none ${hover} transition-transform`}
      />
      {/* Núcleo central */}
      <circle cx={x} cy={y} r={W.gripCoreRadiusPx} fill={accent} className="pointer-events-none" />
    </g>
  );
};

export const WallsLayer: React.FC<WallsLayerProps> = React.memo(
  ({ walls, verticesMap, zoom, selectedWallId, showDimensions, isArchitectureLocked, activeDragWallId, activeDragEnd, gripActions, wasDraggingRecentlyRef, isInteractionInterceptedRef, triggerPlacementRef, onWallClick, onWallDoubleClick }) => {
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
          const isSelected = selectedWallId === wall.id;
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
                onWallClick?.(wall.id);
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

              {/* 3. Indicador y Grips interactivos de selección activa (CAD Smart Grips) */}
              {isSelected && (
                <>
                  <polygon points={pointsStr} fill="none" stroke={W.selected.outline} strokeWidth={3} strokeDasharray="6 3" />
                  <WallGrip x={vStart.x * zoom} y={vStart.y * zoom} end="start" wallId={wall.id} vertexId={vStart.id} isDragged={draggedEnd === 'start'} isLocked={isArchitectureLocked} actions={gripActions} />
                  <WallGrip x={vEnd.x * zoom} y={vEnd.y * zoom} end="end" wallId={wall.id} vertexId={vEnd.id} isDragged={draggedEnd === 'end'} isLocked={isArchitectureLocked} actions={gripActions} />
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
      </>
    );
  }
);
WallsLayer.displayName = 'WallsLayer';
