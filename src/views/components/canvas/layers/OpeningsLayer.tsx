/**
 * Capa SVG de aberturas (puertas, ventanas y vanos) hospedadas en muros.
 */
import React from 'react';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import { getWallSideOffsets } from '../../../../models/architecture/Wall';
import type { Opening } from '../../../../models/architecture/Opening';
import { getOpeningJambs, getDoorSwingGeometry } from '../../../../models/architecture/Opening';
import { CAD_OPENING_STYLES as S } from '../../../../config';

interface OpeningsLayerProps {
  openings: Opening[];
  wallsMap: Map<string, Wall>;
  verticesMap: Map<string, WallVertex>;
  activeLevelId: string;
  zoom: number;
  selectedOpeningId: string | null;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onOpeningClick?: (id: string) => void;
}

const OPENING_TYPE_LABEL: Record<Opening['type'], string> = {
  door: 'Puerta',
  window: 'Ventana',
  passage: 'Vano'
};

export const OpeningsLayer: React.FC<OpeningsLayerProps> = React.memo(
  ({ openings, wallsMap, verticesMap, activeLevelId, zoom, selectedOpeningId, wasDraggingRecentlyRef, isInteractionInterceptedRef, triggerPlacementRef, onOpeningClick }) => (
    <>
      {openings.map((opening) => {
        const wall = wallsMap.get(opening.wallId);
        if (!wall || wall.levelId !== activeLevelId) return null;

        const jambs = getOpeningJambs(opening, wall, verticesMap);
        if (!jambs) return null;

        const isSelected = selectedOpeningId === opening.id;
        const j1 = { x: jambs.jamb1.x * zoom, y: jambs.jamb1.y * zoom };
        const j2 = { x: jambs.jamb2.x * zoom, y: jambs.jamb2.y * zoom };
        const dx = j2.x - j1.x;
        const dy = j2.y - j1.y;
        const wPx = Math.hypot(dx, dy);
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

        const { leftOffset, rightOffset } = getWallSideOffsets(wall);
        const yLeftPx = leftOffset * zoom;
        const yRightPx = rightOffset * zoom;
        const yMinPx = Math.min(yLeftPx, yRightPx);
        const yMaxPx = Math.max(yLeftPx, yRightPx);
        const wallThickPx = Math.abs(yMaxPx - yMinPx);
        const midY = (yMinPx + yMaxPx) / 2;

        return (
          <g
            key={opening.id}
            transform={`translate(${j1.x}, ${j1.y}) rotate(${angleDeg})`}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionInterceptedRef.current) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onOpeningClick?.(opening.id);
            }}
            className="cursor-pointer group"
          >
            {/* Zona táctil y de clic amplia para fácil selección en pantalla */}
            <rect x={0} y={yMinPx - S.hitAreaPaddingPx} width={wPx} height={wallThickPx + 2 * S.hitAreaPaddingPx} fill="transparent" pointerEvents="all" />

            {/* Calado del muro de cara a cara física */}
            <rect
              x={0}
              y={yMinPx}
              width={wPx}
              height={wallThickPx}
              fill={S.wallCutFill}
              stroke={isSelected ? S.selected : S.cutStroke}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />

            {/* Jambas físicas que cortan el muro a los lados */}
            <line x1={0} y1={yMinPx} x2={0} y2={yMaxPx} stroke={isSelected ? S.selected : S.jambStroke} strokeWidth={1.5} />
            <line x1={wPx} y1={yMinPx} x2={wPx} y2={yMaxPx} stroke={isSelected ? S.selected : S.jambStroke} strokeWidth={1.5} />

            {/* Halo de selección activa */}
            {isSelected && (
              <rect
                x={-S.selectionHaloPaddingPx / 2}
                y={yMinPx - S.selectionHaloPaddingPx}
                width={wPx + S.selectionHaloPaddingPx}
                height={wallThickPx + 2 * S.selectionHaloPaddingPx}
                fill="none"
                stroke={S.selected}
                strokeWidth={2}
                strokeDasharray="4 2"
                rx={3}
              />
            )}

            {opening.type === 'door' &&
              (() => {
                const g = getDoorSwingGeometry(opening.swing || 'left_in', wPx, yLeftPx, yRightPx);
                return (
                  <>
                    <line x1={g.hingeX} y1={g.hingeY} x2={g.hingeX} y2={g.leafY} stroke={isSelected ? S.selected : S.doorLeaf} strokeWidth={2} />
                    <path d={g.arcPath} fill="none" stroke={isSelected ? S.selected : S.doorArc} strokeWidth={1.5} strokeDasharray="3 3" />
                  </>
                );
              })()}

            {opening.type === 'window' && (
              <>
                {/* Antepecho exterior e interior de cara a cara */}
                <line x1={0} y1={yMinPx} x2={wPx} y2={yMinPx} stroke={isSelected ? S.selected : S.windowSill} strokeWidth={1.5} />
                <line x1={0} y1={yMaxPx} x2={wPx} y2={yMaxPx} stroke={isSelected ? S.selected : S.windowSill} strokeWidth={1.5} />
                {/* Vidrio central */}
                <line x1={0} y1={midY} x2={wPx} y2={midY} stroke={isSelected ? S.selected : S.windowGlass} strokeWidth={2} />
              </>
            )}

            {/* Cota / Identificador flotante al estar seleccionada */}
            {isSelected && (
              <g transform={`translate(${wPx / 2}, ${yMinPx - S.labelOffsetPx})`}>
                <rect x={-28} y={-10} width={56} height={16} rx={4} fill={S.selected} stroke={S.selectedDark} strokeWidth={0.5} />
                <text x={0} y={2} textAnchor="middle" fontSize={9} className="font-mono font-bold fill-white select-none pointer-events-none">
                  {OPENING_TYPE_LABEL[opening.type]} {opening.width.toFixed(2)}m
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  )
);
OpeningsLayer.displayName = 'OpeningsLayer';
