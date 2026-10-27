/**
 * Capa SVG de ambientes detectados: superficie, resaltados, proyección de alero y rótulos.
 */
import React from 'react';
import type { Space } from '../../../../models/architecture/Space';
import {
  resolveSpacePolygon,
  calculatePolygonArea,
  calculatePolygonCentroid,
  computeCeilingProjection
} from '../../../../models/architecture/Space';
import { getSpaceOrthogonalDimensions } from '../../../../models/architecture/SpaceOrthogonalResize';
import { calculateSpaceWallReferences } from '../../../../models/architecture/spaceWallReference';
import { useWallElevationStore } from '../../../../viewmodels/useWallElevationViewModel';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import {
  getSpaceSurfaceKind,
  getSpaceSurfaceStyle,
  getSpaceInfoLabel,
  getPolygonBounds
} from '../../../../models/architecture/spaceRenderModel';
import type { SpaceAnchorPreset } from '../../../../models/architecture/SpaceMoveEngine';
import { ARCHITECTURAL_SPACE_STYLES, CAD_SPACE_OVERLAY_COLORS as C } from '../../../../config';

interface SpacesLayerProps {
  spaces: Space[];
  verticesMap: Map<string, WallVertex>;
  wallsMap: Map<string, Wall>;
  zoom: number;
  selectedSpaceId: string | null;
  /** Ambiente sobre el que se está trazando un alero, o null si no hay trazado activo. */
  overhangTargetSpaceId: string | null;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onSpaceClick?: (id: string) => void;
  onResizeSpaceOrthogonal?: (params: {
    spaceId: string;
    axis: 'width' | 'length';
    newDimensionM: number;
    direction?: 'positive' | 'negative' | 'center';
  }) => void;
  onStartMovingSpace?: (spaceId: string, initialAnchorPreset?: SpaceAnchorPreset) => void;
  onDeleteSpace?: (spaceId: string) => void;
}

const toPoints = (poly: ReadonlyArray<{ x: number; y: number }>, zoom: number): string =>
  poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');

export const SpacesLayer: React.FC<SpacesLayerProps> = React.memo(
  ({
    spaces,
    verticesMap,
    wallsMap,
    zoom,
    selectedSpaceId,
    overhangTargetSpaceId,
    wasDraggingRecentlyRef,
    isInteractionInterceptedRef,
    triggerPlacementRef,
    onSpaceClick,
    onResizeSpaceOrthogonal,
    onStartMovingSpace,
    onDeleteSpace
  }) => (
    <>
      {spaces.map((space) => {
        const poly = resolveSpacePolygon(space, verticesMap);
        if (poly.length < 3) return null;

        const pointsStr = toPoints(poly, zoom);
        const area = calculatePolygonArea(poly);
        const centroid = calculatePolygonCentroid(poly);
        const kind = getSpaceSurfaceKind(space);
        const isVoid = kind === 'void';
        const isSemi = kind === 'semi_covered';
        const surface = getSpaceSurfaceStyle(kind, space.color);

        const projection =
          isSemi && space.ceilingProjection?.mode === 'alero'
            ? computeCeilingProjection(space, verticesMap, wallsMap)
            : null;
        const isPartialSemi = Boolean(
          isSemi && projection?.isPartial && projection.coveredPolygon && projection.coveredPolygon.length >= 3
        );
        const partialProjection = isPartialSemi ? projection : null;

        const bounds = isVoid ? getPolygonBounds(poly) : null;
        const isSelected = selectedSpaceId === space.id;
        const isDrawingTarget = overhangTargetSpaceId === space.id;
        const line = projection?.projectionLine;
        const lineMidX = line ? ((line[0].x + line[1].x) / 2) * zoom : 0;
        const lineMidY = line ? ((line[0].y + line[1].y) / 2) * zoom : 0;
        const SEMI = ARCHITECTURAL_SPACE_STYLES.SEMI_COVERED;

        return (
          <g
            key={space.id}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionInterceptedRef.current) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onSpaceClick?.(space.id);
            }}
            className="cursor-pointer"
          >
            {/* 1. Relleno y Tramas de Superficie */}
            {partialProjection ? (
              <>
                {/* Porción bajo alero (semicubierta) */}
                <polygon points={toPoints(partialProjection.coveredPolygon!, zoom)} fill={space.color || SEMI.fillUnderRoof} stroke="none" />
                {/* Porción descubierta remanente (trama arquitectónica de patio) */}
                {partialProjection.uncoveredPolygon && partialProjection.uncoveredPolygon.length >= 3 && (
                  <polygon points={toPoints(partialProjection.uncoveredPolygon, zoom)} fill={SEMI.fillUncovered} stroke="none" />
                )}
                {/* Contorno perimetral semicubierto */}
                <polygon points={pointsStr} fill="none" stroke={SEMI.stroke} strokeWidth={SEMI.strokeWidth} strokeDasharray={SEMI.strokeDasharray} />
              </>
            ) : (
              <polygon
                points={pointsStr}
                fill={surface.fill}
                stroke={surface.stroke}
                strokeWidth={surface.strokeWidth}
                strokeDasharray={surface.strokeDasharray}
              />
            )}

            {/* Resaltado de selección activa del ambiente */}
            {isSelected && (
              <polygon points={pointsStr} fill="none" stroke={C.selection} strokeWidth={2} strokeDasharray="6 4" className="pointer-events-none" />
            )}

            {/* Resaltado durante trazado interactivo de alero */}
            {isDrawingTarget && (
              <polygon points={pointsStr} fill="none" stroke={C.overhangDrawing} strokeWidth={2.5} strokeDasharray="6 3" className="pointer-events-none animate-pulse" />
            )}

            {/* Cruz diagonal reglamentaria para vacíos de losa / patio de aire y luz */}
            {bounds && (
              <g className="pointer-events-none select-none opacity-40">
                <line x1={bounds.minX * zoom} y1={bounds.minY * zoom} x2={bounds.maxX * zoom} y2={bounds.maxY * zoom} stroke={C.voidCross} strokeWidth={1} />
                <line x1={bounds.minX * zoom} y1={bounds.maxY * zoom} x2={bounds.maxX * zoom} y2={bounds.minY * zoom} stroke={C.voidCross} strokeWidth={1} />
              </g>
            )}

            {/* Línea de proyección técnica de alero / voladizo (-- - -- - --) */}
            {projection && line && (
              <g className="pointer-events-none select-none">
                <line
                  x1={line[0].x * zoom}
                  y1={line[0].y * zoom}
                  x2={line[1].x * zoom}
                  y2={line[1].y * zoom}
                  stroke={SEMI.lineStroke}
                  strokeWidth={SEMI.strokeWidth}
                  strokeDasharray={SEMI.lineDasharray}
                />
                <rect x={lineMidX - 65} y={lineMidY - 15} width={130} height={14} rx={3} fill={C.projectionLabelBackground} stroke={C.projectionLabelStroke} strokeWidth={0.5} />
                <text x={lineMidX} y={lineMidY - 4} textAnchor="middle" fontSize={9} fill={C.projectionLabelText} fontWeight="bold" className="font-mono select-none">
                  Proy. Alero ({projection.coveredAreaM2.toFixed(2)} m²)
                </text>
                {/* Grip de punto medio visible al seleccionar */}
                {isSelected && <circle cx={lineMidX} cy={lineMidY} r={5} fill={C.projectionGripFill} stroke={C.projectionGripStroke} strokeWidth={1.5} />}
              </g>
            )}

            {/* Badges de Referencia a Paredes (Pared A, Pared B...) - Solo visibles al seleccionar el ambiente */}
            {isSelected && (() => {
              const wallRefs = calculateSpaceWallReferences(space, verticesMap, Array.from(wallsMap.values()));
              return (
                <g className="space-wall-badges select-none">
                  {wallRefs.map((ref) => {
                    const bx = ref.badgePosition.x * zoom;
                    const by = ref.badgePosition.y * zoom;
                    const mx = ref.midPoint.x * zoom;
                    const my = ref.midPoint.y * zoom;

                    return (
                      <g
                        key={ref.letter}
                        className="cursor-pointer group/wall-badge"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ref.wallId) {
                            useWallElevationStore.getState().openElevation(ref.wallId);
                          }
                        }}
                      >
                        <title>{`${ref.fullName} (${ref.compassOrientation} · ${ref.lengthM.toFixed(2)} m)${ref.wallId ? ' · Clic para ver alzado' : ''}`}</title>

                        {/* Línea conectora punteada entre la pared y el badge flotante */}
                        <line
                          x1={mx}
                          y1={my}
                          x2={bx}
                          y2={by}
                          stroke={C.wallBadgeStroke}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                          opacity={0.6}
                          className="pointer-events-none"
                        />

                        {/* Círculo del Badge */}
                        <circle
                          cx={bx}
                          cy={by}
                          r={10}
                          fill={C.wallBadgeFill}
                          stroke={C.wallBadgeStroke}
                          strokeWidth={1.5}
                          className="drop-shadow-xs group-hover/wall-badge:fill-blue-600 transition-colors"
                        />

                        {/* Letra identificadora (A, B, C...) */}
                        <text
                          x={bx}
                          y={by + 3.5}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          className="font-mono fill-blue-700 group-hover/wall-badge:fill-white transition-colors pointer-events-none"
                        >
                          {ref.letter}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* Manijas interactivas de Push-Pull Ortogonal (4 caras: Oeste, Este, Norte, Sur) */}
            {isSelected && !isDrawingTarget && onResizeSpaceOrthogonal && (() => {
              const dims = getSpaceOrthogonalDimensions(space, verticesMap);
              if (dims.widthM < 0.5 || dims.lengthM < 0.5) return null;

              const midX = ((dims.minX + dims.maxX) / 2) * zoom;
              const midY = ((dims.minY + dims.maxY) / 2) * zoom;
              const westX = dims.minX * zoom;
              const eastX = dims.maxX * zoom;
              const northY = dims.minY * zoom;
              const southY = dims.maxY * zoom;

              const handles = [
                {
                  id: 'west',
                  cx: westX,
                  cy: midY,
                  axis: 'width' as const,
                  direction: 'negative' as const,
                  name: 'Oeste (←)',
                  currentM: dims.widthM
                },
                {
                  id: 'east',
                  cx: eastX,
                  cy: midY,
                  axis: 'width' as const,
                  direction: 'positive' as const,
                  name: 'Este (→)',
                  currentM: dims.widthM
                },
                {
                  id: 'north',
                  cx: midX,
                  cy: northY,
                  axis: 'length' as const,
                  direction: 'negative' as const,
                  name: 'Norte (↑)',
                  currentM: dims.lengthM
                },
                {
                  id: 'south',
                  cx: midX,
                  cy: southY,
                  axis: 'length' as const,
                  direction: 'positive' as const,
                  name: 'Sur (↓)',
                  currentM: dims.lengthM
                }
              ];

              return (
                <g className="space-push-handles select-none">
                  {handles.map((h) => (
                    <g
                      key={h.id}
                      transform={`translate(${h.cx}, ${h.cy})`}
                      className="cursor-pointer"
                    >
                      {/* Píldora de fondo */}
                      <rect
                        x={-20}
                        y={-10}
                        width={40}
                        height={20}
                        rx={10}
                        fill={C.pushHandlePillFill}
                        stroke={C.pushHandlePillStroke}
                        strokeWidth={1.5}
                        className="drop-shadow-xs"
                      />

                      {/* Botón Reducir (-) */}
                      <g
                        onClick={(e) => {
                          e.stopPropagation();
                          onResizeSpaceOrthogonal({
                            spaceId: space.id,
                            axis: h.axis,
                            newDimensionM: Math.max(0.5, Number((h.currentM - 0.1).toFixed(2))),
                            direction: h.direction
                          });
                        }}
                        className="group/btn-minus"
                      >
                        <title>{`Reducir pared ${h.name} en 10 cm (-0.10m)`}</title>
                        <circle
                          cx={-9}
                          cy={0}
                          r={7.5}
                          fill={C.pushHandleMinusFill}
                          stroke={C.pushHandleMinusStroke}
                          strokeWidth={1}
                          className="group-hover/btn-minus:fill-slate-200 transition-colors"
                        />
                        <text
                          x={-9}
                          y={3}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          fill={C.pushHandleMinusText}
                          className="pointer-events-none font-mono"
                        >
                          −
                        </text>
                      </g>

                      {/* Botón Aumentar (+) */}
                      <g
                        onClick={(e) => {
                          e.stopPropagation();
                          onResizeSpaceOrthogonal({
                            spaceId: space.id,
                            axis: h.axis,
                            newDimensionM: Number((h.currentM + 0.1).toFixed(2)),
                            direction: h.direction
                          });
                        }}
                        className="group/btn-plus"
                      >
                        <title>{`Extender pared ${h.name} en 10 cm (+0.10m)`}</title>
                        <circle
                          cx={9}
                          cy={0}
                          r={7.5}
                          fill={C.pushHandlePlusFill}
                          stroke={C.pushHandlePlusStroke}
                          strokeWidth={1}
                          className="group-hover/btn-plus:fill-blue-700 transition-colors"
                        />
                        <text
                          x={9}
                          y={3}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          fill={C.pushHandlePlusText}
                          className="pointer-events-none font-mono"
                        >
                          +
                        </text>
                      </g>
                    </g>
                  ))}
                </g>
              );
            })()}

            <text x={centroid.x * zoom} y={centroid.y * zoom - 6} textAnchor="middle" className="text-xs font-bold fill-slate-700 pointer-events-none select-none" fontSize={12}>
              {space.name}
            </text>
            <text x={centroid.x * zoom} y={centroid.y * zoom + 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-500 pointer-events-none select-none" fontSize={10}>
              {getSpaceInfoLabel(space, kind, area, partialProjection)}
            </text>

            {/* Pastilla contextual de acciones rápidas (Mover / Borrar) al seleccionar ambiente */}
            {isSelected && !isDrawingTarget && (
              <g
                transform={`translate(${centroid.x * zoom}, ${centroid.y * zoom - 28})`}
                className="select-none cursor-pointer"
              >
                {onStartMovingSpace && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartMovingSpace(space.id, 'center');
                    }}
                    className="group/move-btn"
                  >
                    <rect
                      x={onDeleteSpace ? -48 : -24}
                      y={-10}
                      width={44}
                      height={20}
                      rx={6}
                      fill={C.actionMoveFill}
                      className="drop-shadow-xs hover:opacity-90 transition-opacity"
                    />
                    <text
                      x={onDeleteSpace ? -26 : -2}
                      y={4}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="bold"
                      fill={C.actionMoveText}
                      className="font-sans pointer-events-none"
                    >
                      Mover
                    </text>
                  </g>
                )}

                {onDeleteSpace && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`¿Eliminar ambiente "${space.name}"? Los muros compartidos se preservarán intactos.`)) {
                        onDeleteSpace(space.id);
                      }
                    }}
                    className="group/del-btn"
                  >
                    <rect
                      x={onStartMovingSpace ? 4 : -22}
                      y={-10}
                      width={44}
                      height={20}
                      rx={6}
                      fill={C.actionDeleteFill}
                      className="drop-shadow-xs hover:opacity-90 transition-opacity"
                    />
                    <text
                      x={onStartMovingSpace ? 26 : 0}
                      y={4}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="bold"
                      fill={C.actionDeleteText}
                      className="font-sans pointer-events-none"
                    >
                      Borrar
                    </text>
                  </g>
                )}
              </g>
            )}
          </g>
        );
      })}
    </>
  )
);
SpacesLayer.displayName = 'SpacesLayer';
