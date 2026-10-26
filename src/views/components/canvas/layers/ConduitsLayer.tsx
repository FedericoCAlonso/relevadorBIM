/**
 * Capa SVG de canalizaciones eléctricas en planta: trazados, cotas verticales de subida/bajada y waypoints.
 */
import React from 'react';
import type {
  Conduit,
  Circuit,
  SpatialElectricalNode,
  ConduitWaypoint
} from '../../../../models/electrical/ElectricalModel';
import type { Space } from '../../../../models/architecture/Space';
import { getConduitVerticalTransitions } from '../../../../models/electrical/conduitMetrics';
import {
  computeConduitCanvasPath,
  resolveConduitVisualSpec
} from '../../../../models/electrical/electricalCanvasModel';
import { ARCHITECTURAL_SPACE_CONFIG, CAD_ELECTRICAL_STYLES as S } from '../../../../config';
import type { ActiveWaypointDragState } from './layerTypes';

interface ConduitsLayerProps {
  conduits: Conduit[];
  circuits: Circuit[];
  spaces: Space[];
  elementsMap: Map<string, SpatialElectricalNode>;
  activeLevelId: string;
  zoom: number;
  selectedConduitIds: ReadonlySet<string>;
  editingConduitRouteId: string | null;
  activeWaypointDragRef: React.RefObject<ActiveWaypointDragState | null>;
  isDraggingObjectRef: React.RefObject<boolean>;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onToggleSelectConduit: (conduitId: string, shiftKey: boolean) => void;
  onUpdateConduitWaypoint?: (conduitId: string, wpIndex: number, wp: ConduitWaypoint) => void;
  onRemoveConduitWaypoint?: (conduitId: string, wpIndex: number) => void;
}

export const ConduitsLayer: React.FC<ConduitsLayerProps> = React.memo(
  ({
    conduits,
    circuits,
    spaces,
    elementsMap,
    activeLevelId,
    zoom,
    selectedConduitIds,
    editingConduitRouteId,
    activeWaypointDragRef,
    isDraggingObjectRef,
    wasDraggingRecentlyRef,
    isInteractionInterceptedRef,
    triggerPlacementRef,
    onToggleSelectConduit,
    onUpdateConduitWaypoint,
    onRemoveConduitWaypoint
  }) => (
    <>
      {conduits.map((conduit) => {
        const elFrom = elementsMap.get(conduit.fromElementId);
        const elTo = elementsMap.get(conduit.toElementId);
        if (!elFrom || !elTo) return null;
        if (elFrom.levelId !== activeLevelId || elTo.levelId !== activeLevelId) return null;

        const p1 = { x: elFrom.x * zoom, y: elFrom.y * zoom };
        const p2 = { x: elTo.x * zoom, y: elTo.y * zoom };
        const pathInfo = computeConduitCanvasPath({ p1, p2, conduit, zoom });
        if (!pathInfo) return null;

        const { pathD, midX, midY, waypointsPx } = pathInfo;
        const isSelected = selectedConduitIds.has(conduit.id);
        const visual = resolveConduitVisualSpec(conduit, circuits, isSelected);
        const routingPlane = conduit.routingPlane || 'wall';

        const space = spaces.find((s) => s.id === elFrom.spaceId || s.id === elTo.spaceId);
        const ceilingH = space
          ? space.ceilingHeight
          : ARCHITECTURAL_SPACE_CONFIG.DEFAULT_CEILING_HEIGHT_M;
        const vertTrans = getConduitVerticalTransitions(
          elFrom.heightZ,
          elTo.heightZ,
          0.30,
          routingPlane,
          ceilingH
        );

        return (
          <g
            key={conduit.id}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionInterceptedRef.current) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onToggleSelectConduit(conduit.id, e.shiftKey);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="cursor-pointer group"
          >
            {/* Hit area amplia */}
            <path d={pathD} fill="none" stroke="transparent" strokeWidth={S.conduitHitWidthPx} pointerEvents="stroke" />
            {/* Cañería continua con esquinas redondeadas, arco o diagonal de losa */}
            <path
              d={pathD}
              fill="none"
              stroke={visual.strokeColor}
              strokeWidth={visual.strokeWidth}
              strokeDasharray={visual.strokeDasharray}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Diámetro, vía de tendido y circuito de la cañería */}
            <text
              x={midX}
              y={midY - 5}
              textAnchor="middle"
              fontSize={9}
              fill={visual.labelColor}
              className="font-mono font-bold pointer-events-none select-none"
            >
              {visual.planeGlyph} {visual.labelText}
            </text>

            {/* Indicador de cota vertical en ORIGEN */}
            {vertTrans.hasTransition && vertTrans.glyphTextFrom && (
              <g
                transform={`translate(${p1.x + 8}, ${p1.y + (vertTrans.fromType === 'bajada' ? 12 : -8)})`}
                className="pointer-events-none"
              >
                <rect
                  x={-2}
                  y={-8}
                  width={vertTrans.glyphTextFrom.length * 5.6 + 6}
                  height={11}
                  rx={2.5}
                  fill={S.transitionBadgeFill}
                  fillOpacity={0.85}
                />
                <text
                  x={1}
                  y={0.5}
                  fontSize={7.5}
                  fill={vertTrans.fromType === 'bajada' ? S.transitionDownText : S.transitionUpText}
                  className="font-mono font-bold select-none"
                >
                  {vertTrans.glyphTextFrom}
                </text>
              </g>
            )}

            {/* Indicador de cota vertical en DESTINO */}
            {vertTrans.hasTransition && vertTrans.glyphTextTo && (
              <g
                transform={`translate(${p2.x + 8}, ${p2.y + (vertTrans.toType === 'bajada' ? 12 : -8)})`}
                className="pointer-events-none"
              >
                <rect
                  x={-2}
                  y={-8}
                  width={vertTrans.glyphTextTo.length * 5.6 + 6}
                  height={11}
                  rx={2.5}
                  fill={S.transitionBadgeFill}
                  fillOpacity={0.85}
                />
                <text
                  x={1}
                  y={0.5}
                  fontSize={7.5}
                  fill={vertTrans.toType === 'bajada' ? S.transitionDownText : S.transitionUpText}
                  className="font-mono font-bold select-none"
                >
                  {vertTrans.glyphTextTo}
                </text>
              </g>
            )}

            {/* Indicador de Montante Vertical / Pase de losa restante */}
            {(conduit.isRiserTerminal ||
              (typeof conduit.additionalLengthM === 'number' && conduit.additionalLengthM > 0)) && (
              <g transform={`translate(${p2.x + 8}, ${p2.y + 22})`} className="pointer-events-none">
                <rect
                  x={-2}
                  y={-8}
                  width={Math.max(60, ((conduit.targetDescription || '').length + 10) * 5.5)}
                  height={12}
                  rx={3}
                  fill={S.riserBadgeFill}
                  fillOpacity={0.9}
                />
                <text
                  x={1}
                  y={0.5}
                  fontSize={7.5}
                  fill={S.white}
                  className="font-mono font-bold select-none"
                >
                  ⌖ +{(conduit.additionalLengthM || 0).toFixed(2)}m{' '}
                  {conduit.targetDescription ? `· ${conduit.targetDescription}` : ''}
                </text>
              </g>
            )}

            {/* Marcadores de Quiebres Interactivos (Waypoints) */}
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
                            if (dist > S.dragMoveThresholdPx) drag.moved = true;
                            const dxWorld = (e.clientX - drag.startX) / zoom;
                            const dyWorld = (e.clientY - drag.startY) / zoom;
                            const candX = Number((drag.origWpX + dxWorld).toFixed(3));
                            const candY = Number((drag.origWpY + dyWorld).toFixed(3));
                            onUpdateConduitWaypoint?.(conduit.id, idx, { x: candX, y: candY });
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
                            if (dist > S.dragMoveThresholdPx) drag.moved = true;
                            const dxWorld = (t.clientX - drag.startX) / zoom;
                            const dyWorld = (t.clientY - drag.startY) / zoom;
                            const candX = Number((drag.origWpX + dxWorld).toFixed(3));
                            const candY = Number((drag.origWpY + dyWorld).toFixed(3));
                            onUpdateConduitWaypoint?.(conduit.id, idx, { x: candX, y: candY });
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
                        {/* Diana táctil amplia de 36px de diámetro invisible */}
                        <circle cx={wp.x} cy={wp.y} r={S.waypointHitRadiusPx} fill="transparent" />
                        <circle
                          cx={wp.x}
                          cy={wp.y}
                          r={S.waypointHaloRadiusPx}
                          fill="none"
                          stroke={S.waypointAccent}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          className="pointer-events-none"
                        />
                        <circle
                          cx={wp.x}
                          cy={wp.y}
                          r={S.waypointCoreRadiusPx}
                          fill={S.waypointAccent}
                          stroke={S.white}
                          strokeWidth={2}
                          className="hover:stroke-amber-300 hover:stroke-[3px] transition-colors pointer-events-none"
                        />
                        <text
                          x={wp.x}
                          y={wp.y + 3}
                          textAnchor="middle"
                          fontSize={8}
                          fill={S.white}
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
      })}
    </>
  )
);
ConduitsLayer.displayName = 'ConduitsLayer';
