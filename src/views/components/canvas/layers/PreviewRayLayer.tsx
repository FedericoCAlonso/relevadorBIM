/**
 * Capa SVG del rayo láser proyectado desde el anclaje activo.
 */
import React from 'react';
import type { WallVertex } from '../../../../models/architecture/Wall';
import { CAD_STRUCTURE_COLORS as C, CAD_STRUCTURE_METRICS as M } from '../../../../config';

interface PreviewRayLayerProps {
  anchorVertex: WallVertex | null;
  distanceM: number;
  directionDeg: number;
  zoom: number;
}

export const PreviewRayLayer: React.FC<PreviewRayLayerProps> = React.memo(
  ({ anchorVertex, distanceM, directionDeg, zoom }) => {
    if (!anchorVertex || distanceM <= 0) return null;

    const startX = anchorVertex.x * zoom;
    const startY = anchorVertex.y * zoom;
    const rad = (directionDeg * Math.PI) / 180;
    const endX = startX + Math.cos(rad) * distanceM * zoom;
    const endY = startY + Math.sin(rad) * distanceM * zoom;

    return (
      <g pointerEvents="none">
        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={C.previewRay} strokeWidth={2} strokeDasharray="5 4" strokeOpacity={0.8} />
        <circle cx={endX} cy={endY} r={M.previewRayMarkerRadius} fill={C.previewRay} fillOpacity={0.7} />
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - M.previewRayLabelOffsetPx}
          textAnchor="middle"
          fontSize={10}
          className="font-mono font-bold fill-red-600 bg-white"
        >
          {distanceM.toFixed(2)} m
        </text>
      </g>
    );
  }
);
PreviewRayLayer.displayName = 'PreviewRayLayer';
