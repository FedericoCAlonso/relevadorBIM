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
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import {
  getSpaceSurfaceKind,
  getSpaceSurfaceStyle,
  getSpaceInfoLabel,
  getPolygonBounds
} from '../../../../models/architecture/spaceRenderModel';
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
}

const toPoints = (poly: ReadonlyArray<{ x: number; y: number }>, zoom: number): string =>
  poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');

export const SpacesLayer: React.FC<SpacesLayerProps> = React.memo(
  ({ spaces, verticesMap, wallsMap, zoom, selectedSpaceId, overhangTargetSpaceId, wasDraggingRecentlyRef, isInteractionInterceptedRef, triggerPlacementRef, onSpaceClick }) => (
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

            <text x={centroid.x * zoom} y={centroid.y * zoom - 6} textAnchor="middle" className="text-xs font-bold fill-slate-700 pointer-events-none select-none" fontSize={12}>
              {space.name}
            </text>
            <text x={centroid.x * zoom} y={centroid.y * zoom + 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-500 pointer-events-none select-none" fontSize={10}>
              {getSpaceInfoLabel(space, kind, area, partialProjection)}
            </text>
          </g>
        );
      })}
    </>
  )
);
SpacesLayer.displayName = 'SpacesLayer';
