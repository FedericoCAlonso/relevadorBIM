/**
 * Capa SVG de tableros eléctricos autónomos (distribuidores de circuitos) en planta.
 */
import React from 'react';
import type { Panel, Circuit } from '../../../../models/electrical/ElectricalModel';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import { calculateWallSnap } from '../../../../models/architecture/Wall';
import { resolvePanelSymbolId } from '../../../../models/electrical/electricalCanvasModel';
import { AeaCanvasSymbol } from '../../electrical/AeaSymbolIcon';
import { CAD_ELECTRICAL_STYLES as S } from '../../../../config';
import type { ActiveNodeDragState } from './layerTypes';

interface PanelsLayerProps {
  panels: Panel[];
  circuits: Circuit[];
  walls: Wall[];
  verticesMap: Map<string, WallVertex>;
  zoom: number;
  selectedPanelIds: ReadonlySet<string>;
  pendingConduitStartId: string | null;
  isConnectingConduit: boolean;
  isCalibratingUnderlay: boolean;
  isAddingDimension: boolean;
  isSnapEnabled: boolean;
  isNodeDragBlocked: boolean;
  activeNodeDragRef: React.RefObject<ActiveNodeDragState | null>;
  isDraggingObjectRef: React.RefObject<boolean>;
  lastDragEndTimeRef: React.RefObject<number>;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onUpdatePanel: (panelId: string, updates: Partial<Panel>) => void;
  onSelectPanelAfterDrag: (panelId: string) => void;
  onElectricalElementClick?: (id: string, shiftKey?: boolean) => void;
  onElectricalElementDoubleClick?: (id: string) => void;
  onPanelClick?: (id: string, shiftKey?: boolean) => void;
  onPanelDoubleClick?: (id: string) => void;
}

export const PanelsLayer: React.FC<PanelsLayerProps> = React.memo(
  ({
    panels,
    circuits,
    walls,
    verticesMap,
    zoom,
    selectedPanelIds,
    pendingConduitStartId,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    isSnapEnabled,
    isNodeDragBlocked,
    activeNodeDragRef,
    isDraggingObjectRef,
    lastDragEndTimeRef,
    wasDraggingRecentlyRef,
    isInteractionInterceptedRef,
    triggerPlacementRef,
    onUpdatePanel,
    onSelectPanelAfterDrag,
    onElectricalElementClick,
    onElectricalElementDoubleClick,
    onPanelClick,
    onPanelDoubleClick
  }) => (
    <>
      {panels.map((panel) => {
        const pxX = panel.x * zoom;
        const pxY = panel.y * zoom;
        const isSelected = selectedPanelIds.has(panel.id);
        const isPendingStart = pendingConduitStartId === panel.id;
        const panelCircuitsCount = circuits.filter((c) => c.panelId === panel.id).length;
        const symbolId = resolvePanelSymbolId(panel);

        return (
          <g
            key={panel.id}
            transform={`translate(${pxX}, ${pxY})`}
            className={`touch-none ${isSelected ? 'cursor-move' : 'cursor-pointer'}`}
            onPointerDown={(e) => {
              if (isNodeDragBlocked) return;
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              e.stopPropagation();
              isDraggingObjectRef.current = true;
              try {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
              } catch {
                // Fallback
              }
              activeNodeDragRef.current = {
                kind: 'panel',
                id: panel.id,
                startX: e.clientX,
                startY: e.clientY,
                origX: panel.x,
                origY: panel.y,
                origRotation: 0,
                moved: false
              };
            }}
            onPointerMove={(e) => {
              if (activeNodeDragRef.current && activeNodeDragRef.current.id === panel.id) {
                e.stopPropagation();
                const drag = activeNodeDragRef.current;
                const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
                if (dist > S.dragMoveThresholdPx) drag.moved = true;
                const dxWorld = (e.clientX - drag.startX) / zoom;
                const dyWorld = (e.clientY - drag.startY) / zoom;
                let candX = Number((drag.origX + dxWorld).toFixed(3));
                let candY = Number((drag.origY + dyWorld).toFixed(3));

                if (isSnapEnabled && !e.shiftKey) {
                  const wallSnap = calculateWallSnap(
                    { x: candX, y: candY },
                    walls,
                    verticesMap,
                    S.panelSnapToleranceM
                  );
                  if (wallSnap) {
                    candX = Number(wallSnap.snappedPoint.x.toFixed(3));
                    candY = Number(wallSnap.snappedPoint.y.toFixed(3));
                  }
                }

                onUpdatePanel(panel.id, { x: candX, y: candY });
              }
            }}
            onPointerUp={(e) => {
              if (activeNodeDragRef.current && activeNodeDragRef.current.id === panel.id) {
                e.stopPropagation();
                try {
                  (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
                const drag = activeNodeDragRef.current;
                if (drag.moved) {
                  lastDragEndTimeRef.current = Date.now();
                  onSelectPanelAfterDrag(panel.id);
                }
                activeNodeDragRef.current = null;
                isDraggingObjectRef.current = false;
              }
            }}
            onPointerCancel={(e) => {
              if (activeNodeDragRef.current && activeNodeDragRef.current.id === panel.id) {
                try {
                  (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
                activeNodeDragRef.current = null;
                isDraggingObjectRef.current = false;
              }
            }}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionInterceptedRef.current && !isConnectingConduit) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              if (isConnectingConduit) {
                onElectricalElementClick?.(panel.id);
              } else if (onPanelClick) {
                onPanelClick(panel.id, e.shiftKey);
              } else {
                onElectricalElementClick?.(panel.id, e.shiftKey);
              }
            }}
            onDoubleClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              if (isConnectingConduit) {
                onElectricalElementClick?.(panel.id);
              } else if (onPanelDoubleClick) {
                onPanelDoubleClick(panel.id);
              } else {
                onElectricalElementDoubleClick?.(panel.id);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Hitbox táctil ampliada para arrastre de tablero en pantalla táctil */}
            <circle
              r={isSelected ? S.panelHitRadiusSelectedPx : S.panelHitRadiusDefaultPx}
              fill="transparent"
              pointerEvents="all"
              className={isSelected ? 'cursor-move' : 'cursor-pointer'}
            />
            {isSelected && (
              <circle
                r={S.panelSelectionHaloRadiusPx}
                fill="none"
                stroke={S.panelSelectionStroke}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                className="pointer-events-none opacity-80"
              />
            )}
            {/* Halo pulsante ámbar para el primer extremo de conexión de cañería */}
            {isPendingStart && (
              <g pointerEvents="none">
                <circle
                  r={S.panelSelectionHaloRadiusPx}
                  fill={S.panelPendingFill}
                  stroke={S.panelSelectionStroke}
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />
                <g transform="translate(0, -42)">
                  <rect
                    x="-48"
                    y="-10"
                    width={96}
                    height={20}
                    rx="10"
                    fill={S.panelPendingBadgeFill}
                    className="shadow-md"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={S.white}
                    fontSize="9"
                    fontWeight="bold"
                    className="font-sans select-none"
                  >
                    ⚡ Tablero Origen
                  </text>
                </g>
              </g>
            )}

            <AeaCanvasSymbol
              symbolId={symbolId}
              zoom={zoom}
              isSelected={isSelected || isPendingStart}
              elementLabel={panel.name}
              circuitLabel={`${panelCircuitsCount} circ`}
              formattedLabel={`${panel.name} (${panelCircuitsCount} C)`}
              rotationDeg={panel.rotation || 0}
            />

            {/* Botón contextual flotante al seleccionar el tablero */}
            {isSelected && !isConnectingConduit && (
              <g
                transform="translate(0, -38)"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPanelDoubleClick) {
                    onPanelDoubleClick(panel.id);
                  } else {
                    onElectricalElementDoubleClick?.(panel.id);
                  }
                }}
                className="cursor-pointer group"
              >
                <rect
                  x="-62"
                  y="-11"
                  width={124}
                  height="22"
                  rx="11"
                  fill={S.panelActionBadgeFill}
                  stroke={S.panelActionBadgeStroke}
                  strokeWidth="1.5"
                  className="shadow-md group-hover:fill-amber-600 transition-colors"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill={S.white}
                  fontSize="10"
                  fontWeight="bold"
                  className="select-none font-sans pointer-events-none"
                >
                  ⚙️ Ficha Distribuidor
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  )
);
PanelsLayer.displayName = 'PanelsLayer';
