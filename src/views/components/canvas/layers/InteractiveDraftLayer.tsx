/**
 * Capa SVG de trazos elásticos interactivos y previsualización en curso:
 * cota libre, arista de alero, reubicación de ambiente, calibración de plano,
 * guía de conexión de cañería y previsualización fantasma del símbolo en el cursor.
 */
import React from 'react';
import type { Space } from '../../../../models/architecture/Space';
import { resolveSpacePolygon } from '../../../../models/architecture/Space';
import type { WallVertex, WallPlacementSnap } from '../../../../models/architecture/Wall';
import type {
  SpatialElectricalNode,
  ConduitRoutingMode,
  ConduitRoutingPlane
} from '../../../../models/electrical/ElectricalModel';
import { computeConduitCanvasPath } from '../../../../models/electrical/electricalCanvasModel';
import { AeaCanvasSymbol } from '../../electrical/AeaSymbolIcon';
import { CAD_INTERACTION_OVERLAY_STYLES as S } from '../../../../config';

interface InteractiveDraftLayerProps {
  zoom: number;
  hoverWorldPos: { x: number; y: number } | null;
  hoverRotationDeg: number;
  isAddingDimension: boolean;
  dimensionP1: { x: number; y: number } | null;
  isDrawingOverhang: boolean;
  overhangP1: { x: number; y: number } | null;
  isMovingSpace: boolean;
  movingSpace: Space | null;
  movingBasePoint: { x: number; y: number } | null;
  verticesMap: Map<string, WallVertex>;
  isCalibratingUnderlay: boolean;
  calibrationP1: { x: number; y: number } | null;
  isConnectingConduit: boolean;
  pendingConduitStartNode: SpatialElectricalNode | null;
  pendingConduitWaypoints: ReadonlyArray<{ x: number; y: number }>;
  sequenceRoutingMode: ConduitRoutingMode;
  sequenceRoutingPlane: ConduitRoutingPlane;
  selectedSymbolId: string | null | undefined;
  activeSnapInfo: WallPlacementSnap | null;
  isSnappedToCenter: boolean;
  isSnappedToPatternMatch: boolean;
}

export const InteractiveDraftLayer: React.FC<InteractiveDraftLayerProps> = React.memo(
  ({
    zoom,
    hoverWorldPos,
    hoverRotationDeg,
    isAddingDimension,
    dimensionP1,
    isDrawingOverhang,
    overhangP1,
    isMovingSpace,
    movingSpace,
    movingBasePoint,
    verticesMap,
    isCalibratingUnderlay,
    calibrationP1,
    isConnectingConduit,
    pendingConduitStartNode,
    pendingConduitWaypoints,
    sequenceRoutingMode,
    sequenceRoutingPlane,
    selectedSymbolId,
    activeSnapInfo,
    isSnappedToCenter,
    isSnappedToPatternMatch
  }) => (
    <>
      {/* 1. Línea elástica interactiva al trazar cotas métricas */}
      {isAddingDimension && dimensionP1 && (
        <g pointerEvents="none">
          {hoverWorldPos && (
            <>
              <line
                x1={dimensionP1.x * zoom}
                y1={dimensionP1.y * zoom}
                x2={hoverWorldPos.x * zoom}
                y2={hoverWorldPos.y * zoom}
                stroke={S.dimensionDraftStroke}
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <circle cx={hoverWorldPos.x * zoom} cy={hoverWorldPos.y * zoom} r={5} fill={S.dimensionDraftStroke} />
              <text
                x={((dimensionP1.x + hoverWorldPos.x) / 2) * zoom}
                y={((dimensionP1.y + hoverWorldPos.y) / 2) * zoom - 8}
                textAnchor="middle"
                fontSize={11}
                className="font-mono font-bold fill-blue-700 bg-white"
              >
                {Math.hypot(hoverWorldPos.x - dimensionP1.x, hoverWorldPos.y - dimensionP1.y).toFixed(2)} m
              </text>
            </>
          )}
          <circle
            cx={dimensionP1.x * zoom}
            cy={dimensionP1.y * zoom}
            r={6}
            fill={S.dimensionDraftStroke}
            stroke={S.white}
            strokeWidth={2}
          />
        </g>
      )}

      {/* 2. Línea elástica interactiva al trazar línea de alero (2 clics) */}
      {isDrawingOverhang && overhangP1 && (
        <g pointerEvents="none">
          {hoverWorldPos && (
            <>
              <line
                x1={overhangP1.x * zoom}
                y1={overhangP1.y * zoom}
                x2={hoverWorldPos.x * zoom}
                y2={hoverWorldPos.y * zoom}
                stroke={S.overhangDraftStroke}
                strokeWidth={2}
                strokeDasharray="8 3 2 3"
              />
              <circle cx={hoverWorldPos.x * zoom} cy={hoverWorldPos.y * zoom} r={5} fill={S.overhangDraftStroke} />
              <text
                x={((overhangP1.x + hoverWorldPos.x) / 2) * zoom}
                y={((overhangP1.y + hoverWorldPos.y) / 2) * zoom - 8}
                textAnchor="middle"
                fontSize={11}
                className="font-mono font-bold fill-cyan-700 bg-white"
              >
                Arista de Alero ({Math.hypot(hoverWorldPos.x - overhangP1.x, hoverWorldPos.y - overhangP1.y).toFixed(2)} m)
              </text>
            </>
          )}
          <circle
            cx={overhangP1.x * zoom}
            cy={overhangP1.y * zoom}
            r={6}
            fill={S.overhangDraftStroke}
            stroke={S.white}
            strokeWidth={2}
          />
        </g>
      )}

      {/* 3. Vista previa elástica y contorno fantasma al mover ambiente */}
      {isMovingSpace &&
        movingSpace &&
        (() => {
          const movingPoly = resolveSpacePolygon(movingSpace, verticesMap);
          if (movingPoly.length < 3) return null;

          return (
            <g pointerEvents="none">
              {movingBasePoint && (
                <g>
                  <circle
                    cx={movingBasePoint.x * zoom}
                    cy={movingBasePoint.y * zoom}
                    r={6}
                    fill={S.spaceMoveStroke}
                    stroke={S.white}
                    strokeWidth={2}
                  />
                  <circle
                    cx={movingBasePoint.x * zoom}
                    cy={movingBasePoint.y * zoom}
                    r={10}
                    fill="none"
                    stroke={S.spaceMoveStroke}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                </g>
              )}

              {movingBasePoint &&
                hoverWorldPos &&
                (() => {
                  const dx = hoverWorldPos.x - movingBasePoint.x;
                  const dy = hoverWorldPos.y - movingBasePoint.y;
                  const ghostPoints = movingPoly
                    .map((p) => `${(p.x + dx) * zoom},${(p.y + dy) * zoom}`)
                    .join(' ');

                  return (
                    <g>
                      <polygon
                        points={ghostPoints}
                        fill={S.spaceMoveGhostFill}
                        stroke={S.spaceMoveStroke}
                        strokeWidth={2}
                        strokeDasharray="6 3"
                      />
                      <line
                        x1={movingBasePoint.x * zoom}
                        y1={movingBasePoint.y * zoom}
                        x2={hoverWorldPos.x * zoom}
                        y2={hoverWorldPos.y * zoom}
                        stroke={S.spaceMoveStroke}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                      />
                      <circle cx={hoverWorldPos.x * zoom} cy={hoverWorldPos.y * zoom} r={5} fill={S.spaceMoveTargetFill} />
                      <text
                        x={((movingBasePoint.x + hoverWorldPos.x) / 2) * zoom}
                        y={((movingBasePoint.y + hoverWorldPos.y) / 2) * zoom - 8}
                        textAnchor="middle"
                        fontSize={11}
                        className="font-mono font-bold fill-blue-800 bg-white"
                      >
                        ΔX: {dx >= 0 ? '+' : ''}
                        {dx.toFixed(2)}m, ΔY: {dy >= 0 ? '+' : ''}
                        {dy.toFixed(2)}m ({Math.hypot(dx, dy).toFixed(2)}m)
                      </text>
                    </g>
                  );
                })()}
            </g>
          );
        })()}

      {/* 4. Línea elástica y marcas de calibración métrica del plano de fondo */}
      {isCalibratingUnderlay && calibrationP1 && (
        <g pointerEvents="none">
          {hoverWorldPos && (
            <>
              <line
                x1={calibrationP1.x * zoom}
                y1={calibrationP1.y * zoom}
                x2={hoverWorldPos.x * zoom}
                y2={hoverWorldPos.y * zoom}
                stroke={S.calibrationDraftStroke}
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
              <circle cx={hoverWorldPos.x * zoom} cy={hoverWorldPos.y * zoom} r={5} fill={S.calibrationDraftStroke} />
              <text
                x={((calibrationP1.x + hoverWorldPos.x) / 2) * zoom}
                y={((calibrationP1.y + hoverWorldPos.y) / 2) * zoom - 8}
                textAnchor="middle"
                fontSize={11}
                className="font-mono font-bold fill-sky-700 bg-white"
              >
                {Math.hypot(hoverWorldPos.x - calibrationP1.x, hoverWorldPos.y - calibrationP1.y).toFixed(2)} m
              </text>
            </>
          )}
          <circle
            cx={calibrationP1.x * zoom}
            cy={calibrationP1.y * zoom}
            r={6}
            fill={S.calibrationDraftStroke}
            stroke={S.white}
            strokeWidth={2}
          />
        </g>
      )}

      {/* 5. Línea o arco elástico interactivo guiando al segundo extremo de cañería */}
      {isConnectingConduit &&
        pendingConduitStartNode &&
        hoverWorldPos &&
        (() => {
          const p1 = { x: pendingConduitStartNode.x * zoom, y: pendingConduitStartNode.y * zoom };
          const pEnd = { x: hoverWorldPos.x * zoom, y: hoverWorldPos.y * zoom };
          const pathInfo = computeConduitCanvasPath({
            p1,
            p2: pEnd,
            conduit: {
              routingMode: sequenceRoutingMode,
              routingPlane: sequenceRoutingPlane,
              waypoints: pendingConduitWaypoints.map((wp) => ({ x: wp.x, y: wp.y }))
            },
            zoom
          });
          if (!pathInfo) return null;

          const isArc = sequenceRoutingMode === 'schematic_arc';
          const waypointsPx = pathInfo.waypointsPx || [];

          return (
            <g pointerEvents="none">
              <path
                d={pathInfo.pathD}
                fill="none"
                stroke={S.conduitDraftStroke}
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
              {!isArc &&
                waypointsPx.map((wp, idx) => (
                  <g key={`pending-wp-${idx}`}>
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={5}
                      fill={S.conduitDraftStroke}
                      stroke={S.white}
                      strokeWidth={1.8}
                    />
                    <rect
                      x={wp.x + 6}
                      y={wp.y - 14}
                      width={18}
                      height={12}
                      rx={3}
                      fill={S.conduitWaypointBadgeFill}
                      fillOpacity={0.85}
                    />
                    <text
                      x={wp.x + 9}
                      y={wp.y - 5}
                      fontSize={8}
                      fill={S.conduitWaypointTextFill}
                      className="font-mono font-bold select-none"
                    >
                      P{idx + 1}
                    </text>
                  </g>
                ))}
              <circle cx={pEnd.x} cy={pEnd.y} r={6} fill={S.conduitDraftStroke} opacity={0.8} />
            </g>
          );
        })()}

      {/* 6. Previsualización fantasma del elemento eléctrico que sigue al cursor */}
      {selectedSymbolId && hoverWorldPos && (
        <g
          transform={`translate(${hoverWorldPos.x * zoom}, ${hoverWorldPos.y * zoom})`}
          className="pointer-events-none opacity-90"
        >
          <AeaCanvasSymbol
            symbolId={selectedSymbolId}
            zoom={zoom}
            isSelected={true}
            elementLabel={
              isSnappedToPatternMatch
                ? 'Símbolo 🎯'
                : activeSnapInfo
                ? 'Pared'
                : isSnappedToCenter
                ? 'Centro'
                : undefined
            }
            rotationDeg={hoverRotationDeg}
          />
          {isSnappedToPatternMatch && (
            <circle r={22} fill="none" stroke={S.ghostSnapPatternStroke} strokeWidth={2.5} strokeDasharray="5 3" />
          )}
          {activeSnapInfo && !isSnappedToPatternMatch && (
            <circle r={18} fill="none" stroke={S.ghostSnapWallStroke} strokeWidth={1.5} strokeDasharray="3 3" />
          )}
          {isSnappedToCenter && !isSnappedToPatternMatch && (
            <circle r={26} fill="none" stroke={S.ghostSnapWallStroke} strokeWidth={2} strokeDasharray="4 3" />
          )}
        </g>
      )}
    </>
  )
);
InteractiveDraftLayer.displayName = 'InteractiveDraftLayer';
