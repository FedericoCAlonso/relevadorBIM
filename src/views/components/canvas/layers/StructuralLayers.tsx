/**
 * Capas SVG de elementos estructurales: vigas salientes y columnas.
 */
import React from 'react';
import type { StructuralBeam, StructuralColumn } from '../../../../models/architecture/StructuralElement';
import { getBeamPolygon, getColumnPolygon } from '../../../../models/architecture/StructuralElement';
import { CAD_STRUCTURE_COLORS as C, CAD_STRUCTURE_METRICS as M } from '../../../../config';
import type { LayerInteractionGuards } from './layerTypes';

interface BeamsLayerProps extends LayerInteractionGuards {
  beams: StructuralBeam[];
  zoom: number;
  selectedBeamId: string | null;
  onBeamClick?: (id: string) => void;
}

export const BeamsLayer: React.FC<BeamsLayerProps> = React.memo(
  ({ beams, zoom, selectedBeamId, onBeamClick, wasDraggingRecentlyRef, isInteractionBlocked }) => (
    <>
      {beams.map((beam) => {
        const poly = getBeamPolygon(beam);
        if (poly.length < 4) return null;
        const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
        const isSelected = selectedBeamId === beam.id;
        const midX = ((beam.startX + beam.endX) / 2) * zoom;
        const midY = ((beam.startY + beam.endY) / 2) * zoom;

        return (
          <g
            key={beam.id}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionBlocked) return;
              e.stopPropagation();
              onBeamClick?.(beam.id);
            }}
            className="cursor-pointer group"
          >
            <polygon
              points={pointsStr}
              fill={isSelected ? C.beamFillSelected : C.beamFill}
              stroke={isSelected ? C.beamStrokeSelected : C.beamStroke}
              strokeWidth={isSelected ? 2 : 1}
              strokeDasharray="6 3"
            />
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              className="fill-slate-600 font-mono font-bold pointer-events-none select-none"
            >
              V {Math.round(beam.width * 100)}x{Math.round(beam.dropHeightM * 100)}
            </text>
          </g>
        );
      })}
    </>
  )
);
BeamsLayer.displayName = 'BeamsLayer';

interface ColumnsLayerProps extends LayerInteractionGuards {
  columns: StructuralColumn[];
  zoom: number;
  selectedColumnId: string | null;
  onColumnClick?: (id: string) => void;
}

export const ColumnsLayer: React.FC<ColumnsLayerProps> = React.memo(
  ({ columns, zoom, selectedColumnId, onColumnClick, wasDraggingRecentlyRef, isInteractionBlocked }) => (
    <>
      {columns.map((col) => {
        const isSelected = selectedColumnId === col.id;
        const cx = col.x * zoom;
        const cy = col.y * zoom;
        const fill = isSelected ? C.columnFillSelected : C.columnFill;
        const stroke = isSelected ? C.columnStrokeSelected : C.columnStroke;
        const diagonalStroke = isSelected ? C.columnStrokeSelected : C.columnDiagonal;

        return (
          <g
            key={col.id}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionBlocked) return;
              e.stopPropagation();
              onColumnClick?.(col.id);
            }}
            className="cursor-pointer group"
          >
            {col.shape === 'circular' ? (
              <>
                <circle cx={cx} cy={cy} r={(col.width / 2) * zoom} fill={fill} stroke={stroke} strokeWidth={1.5} />
                <line x1={cx - M.columnCrossHalfSize} y1={cy} x2={cx + M.columnCrossHalfSize} y2={cy} stroke={C.columnCrossHair} strokeWidth={1} className="pointer-events-none select-none" />
                <line x1={cx} y1={cy - M.columnCrossHalfSize} x2={cx} y2={cy + M.columnCrossHalfSize} stroke={C.columnCrossHair} strokeWidth={1} className="pointer-events-none select-none" />
              </>
            ) : (
              (() => {
                const poly = getColumnPolygon(col);
                const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
                return (
                  <>
                    <polygon points={pointsStr} fill={fill} stroke={stroke} strokeWidth={1.5} />
                    <line x1={poly[0].x * zoom} y1={poly[0].y * zoom} x2={poly[2].x * zoom} y2={poly[2].y * zoom} stroke={diagonalStroke} strokeWidth={1} className="pointer-events-none select-none opacity-60" />
                    <line x1={poly[1].x * zoom} y1={poly[1].y * zoom} x2={poly[3].x * zoom} y2={poly[3].y * zoom} stroke={diagonalStroke} strokeWidth={1} className="pointer-events-none select-none opacity-60" />
                  </>
                );
              })()
            )}
            {isSelected && (
              <text
                x={cx}
                y={cy - (col.depth / 2) * zoom - M.columnLabelOffsetPx}
                textAnchor="middle"
                fontSize={9}
                className="fill-blue-600 font-mono font-bold pointer-events-none select-none"
              >
                Col {Math.round(col.width * 100)}x{Math.round(col.depth * 100)}
              </text>
            )}
          </g>
        );
      })}
    </>
  )
);
ColumnsLayer.displayName = 'ColumnsLayer';
