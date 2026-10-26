/**
 * Capa SVG de cotas métricas lineales libres en el plano CAD.
 */
import React from 'react';
import type { DimensionLine } from '../../../../models/architecture/DimensionLine';
import {
  DIMENSION_CONSTANTS as C,
  computeDimensionRenderGeometry
} from '../../../../models/architecture/DimensionLine';

interface DimensionsLayerProps {
  dimensions: DimensionLine[];
  showDimensions: boolean;
  zoom: number;
  selectedDimensionId: string | null;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onSelectDimension: (id: string) => void;
  onDeleteDimension: (id: string) => void;
}

export const DimensionsLayer: React.FC<DimensionsLayerProps> = React.memo(
  ({
    dimensions,
    showDimensions,
    zoom,
    selectedDimensionId,
    wasDraggingRecentlyRef,
    isInteractionInterceptedRef,
    triggerPlacementRef,
    onSelectDimension,
    onDeleteDimension
  }) => {
    if (!showDimensions || dimensions.length === 0) return null;

    return (
      <>
        {dimensions.map((dim) => {
          const geom = computeDimensionRenderGeometry(dim, zoom);
          if (!geom) return null;

          const { x1, y1, x2, y2, tickDx, tickDy, midX, midY, textX, textY, angleDeg, labelText } = geom;
          const isSelected = selectedDimensionId === dim.id;
          const strokeColor = isSelected ? C.SELECTED_COLOR : C.DEFAULT_COLOR;

          return (
            <g
              key={dim.id}
              onClick={(e) => {
                if (wasDraggingRecentlyRef.current()) return;
                if (isInteractionInterceptedRef.current) {
                  triggerPlacementRef.current(e.clientX, e.clientY);
                  return;
                }
                e.stopPropagation();
                onSelectDimension(dim.id);
              }}
              className="cursor-pointer group"
            >
              {/* Hit area amplia */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={C.HIT_WIDTH} pointerEvents="stroke" />

              {/* Línea de cota */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={isSelected ? 2.5 : 1.5} />

              {/* Tics arquitectónicos a 45° */}
              <line
                x1={x1 - tickDx}
                y1={y1 - tickDy}
                x2={x1 + tickDx}
                y2={y1 + tickDy}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : 2}
              />
              <line
                x1={x2 - tickDx}
                y1={y2 - tickDy}
                x2={x2 + tickDx}
                y2={y2 + tickDy}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : 2}
              />

              {/* Etiqueta de cota */}
              <g transform={`translate(${textX}, ${textY}) rotate(${angleDeg})`}>
                <rect
                  x="-26"
                  y="-10"
                  width="52"
                  height="20"
                  rx="4"
                  fill={C.LABEL_BG_COLOR}
                  stroke={isSelected ? strokeColor : C.LABEL_BORDER_COLOR}
                  strokeWidth={1}
                  className="shadow-xs"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="bold"
                  fill={strokeColor}
                  className="font-mono select-none pointer-events-none"
                >
                  {labelText}
                </text>
              </g>

              {/* Botón flotante para eliminar la cota si está seleccionada */}
              {isSelected && (
                <g
                  transform={`translate(${midX}, ${midY - 24})`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDimension(dim.id);
                  }}
                  className="cursor-pointer group/dimdel"
                >
                  <circle
                    r={10}
                    fill={C.DELETE_BTN_COLOR}
                    stroke={C.LABEL_BG_COLOR}
                    strokeWidth={1.5}
                    className="transition-colors group-hover/dimdel:fill-red-600 drop-shadow"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="bold"
                    fill={C.LABEL_BG_COLOR}
                    className="select-none font-sans pointer-events-none"
                  >
                    ✕
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
DimensionsLayer.displayName = 'DimensionsLayer';
