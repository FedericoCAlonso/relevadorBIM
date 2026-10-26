/**
 * Capa SVG de guías inteligentes y feedback de imantado durante el arrastre de extremos de muro.
 */
import React from 'react';
import type { ActiveWallDragState } from '../../../../viewmodels/useWallGripDrag';
import type { WallSnapResult } from '../../../../models/architecture/WallSnapEngine';
import { CAD_OVERLAY_COLORS as C } from '../../../../config';

interface SmartGuidesLayerProps {
  activeDrag: ActiveWallDragState | null;
  activeSnapResult: WallSnapResult | null;
  zoom: number;
}

const guideColor = (type: string): string =>
  type === 'polar_ray' ? C.guidePolarRay : type === 'wall_axis' ? C.guideWallAxis : C.guideDefault;

export const SmartGuidesLayer: React.FC<SmartGuidesLayerProps> = React.memo(
  ({ activeDrag, activeSnapResult, zoom }) => {
    if (!activeDrag || !activeSnapResult) return null;

    const fx = activeDrag.fixedVertexPos.x * zoom;
    const fy = activeDrag.fixedVertexPos.y * zoom;
    const spX = activeSnapResult.snappedPoint.x * zoom;
    const spY = activeSnapResult.snappedPoint.y * zoom;
    const mx = (fx + spX) / 2;
    const my = (fy + spY) / 2;

    const lenM =
      activeSnapResult.lengthM ??
      Math.hypot(
        activeSnapResult.snappedPoint.x - activeDrag.fixedVertexPos.x,
        activeSnapResult.snappedPoint.y - activeDrag.fixedVertexPos.y
      );
    const angleDeg = activeSnapResult.angleDeg;
    const { targetType } = activeSnapResult;

    const label =
      angleDeg !== undefined
        ? `L = ${lenM.toFixed(2)} m (${angleDeg.toFixed(0)}°)`
        : `L = ${lenM.toFixed(2)} m`;

    return (
      <g className="cad-smart-guides-overlay" pointerEvents="none">
        {/* 1. Rayo elástico directriz entre vértice fijo y punto de arrastre */}
        <line x1={fx} y1={fy} x2={spX} y2={spY} stroke={C.rubberBand} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.8} />

        {/* 2. Líneas Guías Inteligentes (Smart Guides) */}
        {activeSnapResult.guides.map((g, idx) => {
          const x1 = g.from.x * zoom;
          const y1 = g.from.y * zoom;
          const x2 = g.to.x * zoom;
          const y2 = g.to.y * zoom;
          const strokeColor = guideColor(g.type);

          return (
            <g key={`guide-${idx}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.85} />
              {g.label && (
                <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 - 8})`}>
                  <rect x={-28} y={-9} width={56} height={16} rx={3} fill={C.labelBackground} fillOpacity={0.92} stroke={strokeColor} strokeWidth={1} />
                  <text x={0} y={3} textAnchor="middle" fontSize={9} fontWeight="bold" fill={strokeColor} className="font-mono select-none">
                    {g.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 3. Indicador de Objetivo Imantado (Target Snap Point) */}
        {targetType === 'vertex' && (
          <g transform={`translate(${spX}, ${spY})`}>
            <circle r={14} fill={C.snapVertexFill} stroke={C.snapVertex} strokeWidth={1.5} strokeDasharray="3 2" />
            <rect x={-7} y={-7} width={14} height={14} fill={C.snapVertex} stroke={C.white} strokeWidth={2} rx={2} />
            <g transform="translate(0, -18)">
              <rect x={-45} y={-10} width={90} height={18} rx={4} fill={C.snapVertexBadge} fillOpacity={0.94} stroke={C.snapVertex} strokeWidth={1} />
              <text x={0} y={3} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill={C.snapVertexBadgeText} className="font-mono select-none">
                Fusión de Esquina
              </text>
            </g>
          </g>
        )}

        {targetType === 'wall_slide' && (
          <g transform={`translate(${spX}, ${spY})`}>
            <circle r={13} fill={C.snapWallFill} stroke={C.snapWall} strokeWidth={2} />
            <circle r={4.5} fill={C.snapWall} stroke={C.white} strokeWidth={1.5} />
            <line x1={-8} y1={0} x2={8} y2={0} stroke={C.snapWall} strokeWidth={1.5} />
            <line x1={0} y1={-8} x2={0} y2={8} stroke={C.snapWall} strokeWidth={1.5} />
            <g transform="translate(0, -18)">
              <rect x={-42} y={-10} width={84} height={18} rx={4} fill={C.snapWallBadge} fillOpacity={0.94} stroke={C.snapWall} strokeWidth={1} />
              <text x={0} y={3} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill={C.snapWallBadgeText} className="font-mono select-none">
                Empalme en T
              </text>
            </g>
          </g>
        )}

        {targetType === 'smart_guide' && (
          <g transform={`translate(${spX}, ${spY})`}>
            <polygon points="0,-8 8,0 0,8 -8,0" fill={C.guideDefault} stroke={C.white} strokeWidth={1.5} />
          </g>
        )}

        {targetType === 'polar_angle' && (
          <g transform={`translate(${spX}, ${spY})`}>
            <circle r={7} fill="none" stroke={C.guidePolarRay} strokeWidth={2} />
            <circle r={2.5} fill={C.guidePolarRay} />
          </g>
        )}

        {/* 4. Badge Flotante con Cota Dinámica y Ángulo */}
        <g transform={`translate(${mx}, ${my - 16})`}>
          <rect x={-50} y={-11} width={100} height={22} rx={5} fill={C.badgeBackground} fillOpacity={0.94} stroke={C.rubberBand} strokeWidth={1.5} className="shadow-md" />
          <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight="bold" fill={C.badgeText} className="font-mono select-none">
            {label}
          </text>
        </g>
      </g>
    );
  }
);
SmartGuidesLayer.displayName = 'SmartGuidesLayer';
