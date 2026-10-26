/**
 * Capa SVG de símbolos eléctricos AEA (bocas, llaves, tomas y referencias de remate) en planta.
 */
import React from 'react';
import type {
  ElectricalElement,
  Circuit,
  Panel,
  Conduit,
  SpatialElectricalNode,
  LabelDisplayMode
} from '../../../../models/electrical/ElectricalModel';
import type { Level } from '../../../../models/architecture/Level';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import { calculateWallSnap } from '../../../../models/architecture/Wall';
import { formatElementLabel } from '../../../../models/electrical/elementLabelling';
import {
  isCeilingSymbol,
  computeTerminalReferenceBadge
} from '../../../../models/electrical/electricalCanvasModel';
import { AeaCanvasSymbol } from '../../electrical/AeaSymbolIcon';
import { CAD_ELECTRICAL_STYLES as S } from '../../../../config';
import type { ActiveNodeDragState } from './layerTypes';

interface ElectricalElementsLayerProps {
  elements: ElectricalElement[];
  circuits: Circuit[];
  panels: Panel[];
  conduits: Conduit[];
  elementsMap: Map<string, SpatialElectricalNode>;
  levelsMap: Map<string, Level>;
  walls: Wall[];
  verticesMap: Map<string, WallVertex>;
  labelDisplayMode: LabelDisplayMode;
  zoom: number;
  selectedElementIds: ReadonlySet<string>;
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
  onUpdateElement: (id: string, updates: Partial<ElectricalElement>) => void;
  onSelectElementAfterDrag: (id: string) => void;
  onElectricalElementClick?: (id: string, shiftKey?: boolean) => void;
  onElectricalElementDoubleClick?: (id: string) => void;
}

export const ElectricalElementsLayer: React.FC<ElectricalElementsLayerProps> = React.memo(
  ({
    elements,
    circuits,
    panels,
    conduits,
    elementsMap,
    levelsMap,
    walls,
    verticesMap,
    labelDisplayMode,
    zoom,
    selectedElementIds,
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
    onUpdateElement,
    onSelectElementAfterDrag,
    onElectricalElementClick,
    onElectricalElementDoubleClick
  }) => (
    <>
      {elements.map((element) => {
        const pxX = element.x * zoom;
        const pxY = element.y * zoom;
        const isSelected = selectedElementIds.has(element.id);
        const isPendingStart = pendingConduitStartId === element.id;
        const circ = element.circuitId ? circuits.find((c) => c.id === element.circuitId) : null;
        const panel = circ ? panels.find((p) => p.id === circ.panelId) : panels[0] || null;
        const circuitLabel = circ ? circ.name.split(' ')[0] : undefined;
        const formattedLabel = formatElementLabel({
          elementLabel: element.label,
          circuit: circ,
          panel,
          mode: labelDisplayMode
        });

        const isTerminalRef = Boolean(
          element.isTerminalReference || element.symbolId === 'sym-terminal-referencia'
        );

        const cursorClass = isSelected
          ? 'cursor-move'
          : isTerminalRef
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-pointer';

        return (
          <g
            key={element.id}
            transform={`translate(${pxX}, ${pxY})`}
            className={`touch-none ${cursorClass}`}
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
                kind: 'element',
                id: element.id,
                startX: e.clientX,
                startY: e.clientY,
                origX: element.x,
                origY: element.y,
                origRotation: element.rotation || 0,
                moved: false
              };
            }}
            onPointerMove={(e) => {
              if (activeNodeDragRef.current && activeNodeDragRef.current.id === element.id) {
                e.stopPropagation();
                const drag = activeNodeDragRef.current;
                const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
                if (dist > S.dragMoveThresholdPx) drag.moved = true;
                const dxWorld = (e.clientX - drag.startX) / zoom;
                const dyWorld = (e.clientY - drag.startY) / zoom;
                let candX = Number((drag.origX + dxWorld).toFixed(3));
                let candY = Number((drag.origY + dyWorld).toFixed(3));
                let candRot = drag.origRotation;

                if (!isCeilingSymbol(element.symbolId) && isSnapEnabled && !e.shiftKey) {
                  const wallSnap = calculateWallSnap(
                    { x: candX, y: candY },
                    walls,
                    verticesMap,
                    S.elementSnapToleranceM
                  );
                  if (wallSnap) {
                    candX = Number(wallSnap.snappedPoint.x.toFixed(3));
                    candY = Number(wallSnap.snappedPoint.y.toFixed(3));
                    candRot = wallSnap.rotationDeg;
                  }
                }

                onUpdateElement(element.id, {
                  x: candX,
                  y: candY,
                  rotation: candRot
                });
              }
            }}
            onPointerUp={(e) => {
              if (activeNodeDragRef.current && activeNodeDragRef.current.id === element.id) {
                e.stopPropagation();
                try {
                  (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
                const drag = activeNodeDragRef.current;
                if (drag.moved) {
                  lastDragEndTimeRef.current = Date.now();
                  onSelectElementAfterDrag(element.id);
                }
                activeNodeDragRef.current = null;
                isDraggingObjectRef.current = false;
              }
            }}
            onPointerCancel={(e) => {
              if (activeNodeDragRef.current && activeNodeDragRef.current.id === element.id) {
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
              if (isInteractionInterceptedRef.current) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onElectricalElementClick?.(element.id, e.shiftKey);
            }}
            onDoubleClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isCalibratingUnderlay || isAddingDimension) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onElectricalElementDoubleClick?.(element.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Hitbox táctil ampliada para arrastre ergonómico en pantalla táctil */}
            <circle
              r={isSelected ? S.elementHitRadiusSelectedPx : S.elementHitRadiusDefaultPx}
              fill="transparent"
              pointerEvents="all"
              className={isSelected ? 'cursor-move' : 'cursor-pointer'}
            />
            {isSelected && (
              <circle
                r={S.elementSelectionHaloRadiusPx}
                fill="none"
                stroke={S.elementSelectionStroke}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                className="pointer-events-none opacity-80"
              />
            )}

            {/* Halo pulsante ámbar para el primer extremo de conexión de cañería */}
            {isPendingStart && (
              <g pointerEvents="none">
                <circle
                  r={32}
                  fill={S.elementPendingFill}
                  stroke={S.elementPendingStroke}
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />
                <circle
                  r={S.elementHitRadiusSelectedPx}
                  fill="none"
                  stroke={S.elementPendingStroke}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.6}
                />
                <g transform="translate(0, -38)">
                  <rect
                    x="-42"
                    y="-10"
                    width={84}
                    height={20}
                    rx="10"
                    fill={S.elementPendingBadgeFill}
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
                    ⚡ Inicio Cañería
                  </text>
                </g>
              </g>
            )}

            <AeaCanvasSymbol
              symbolId={element.symbolId}
              zoom={zoom}
              isSelected={isSelected || isPendingStart}
              elementLabel={element.label}
              circuitLabel={circuitLabel}
              formattedLabel={formattedLabel}
              returnRef={element.returnRef}
              rotationDeg={element.rotation || 0}
            />

            {/* Ficha técnica flotante para etiquetas / remates de caño */}
            {isTerminalRef &&
              (() => {
                const badge = computeTerminalReferenceBadge({
                  element,
                  conduits,
                  elementsMap,
                  levelsMap
                });
                return (
                  <g
                    transform="translate(14, -14)"
                    pointerEvents="all"
                    className="select-none font-sans cursor-grab active:cursor-grabbing"
                  >
                    <title>Arrastrar para mover referencia técnica. Doble clic para editar.</title>
                    <rect
                      x="0"
                      y="-9"
                      width={badge.boxWidthPx}
                      height={30}
                      rx="6"
                      fill={S.terminalBoxFill}
                      stroke={S.terminalBoxStroke}
                      strokeWidth="1.2"
                      className="shadow-md"
                    />
                    <text x="6" y="3.5" fill={S.terminalTargetText} fontSize="9.5" fontWeight="bold">
                      ➔ {badge.targetText}
                    </text>
                    <text x="6" y="15" fill={S.terminalSpecText} fontSize="8" fontFamily="monospace">
                      {badge.specText}
                    </text>
                  </g>
                );
              })()}

            {/* Si está seleccionado y NO estamos enlazando cañerías, botón contextual flotante */}
            {isSelected && !isConnectingConduit && (
              <g
                transform="translate(0, -36)"
                onClick={(e) => {
                  e.stopPropagation();
                  onElectricalElementDoubleClick?.(element.id);
                }}
                className="cursor-pointer group"
              >
                <rect
                  x="-52"
                  y="-11"
                  width="104"
                  height="22"
                  rx="11"
                  fill={S.elementActionBadgeFill}
                  stroke={S.elementActionBadgeStroke}
                  strokeWidth="1.5"
                  className="shadow-md group-hover:fill-blue-600 transition-colors"
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
                  ⚙️ Ficha / Medir
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  )
);
ElectricalElementsLayer.displayName = 'ElectricalElementsLayer';
