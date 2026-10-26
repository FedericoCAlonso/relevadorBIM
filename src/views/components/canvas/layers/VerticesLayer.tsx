/**
 * Capa SVG de vértices de muro y anclaje activo de medición.
 */
import React from 'react';
import type { WallVertex } from '../../../../models/architecture/Wall';
import { CAD_STRUCTURE_COLORS as C, CAD_STRUCTURE_METRICS as M } from '../../../../config';

interface VerticesLayerProps {
  vertices: WallVertex[];
  zoom: number;
  activeAnchorVertexId: string | null;
  wasDraggingRecentlyRef: React.RefObject<() => boolean>;
  /** Referencia estable: verdadero cuando otra herramienta captura el clic y debe ubicarse un elemento. */
  isInteractionInterceptedRef: React.RefObject<boolean>;
  triggerPlacementRef: React.RefObject<(clientX: number, clientY: number) => void>;
  onSelectAnchor: (vertexId: string) => void;
}

export const VerticesLayer: React.FC<VerticesLayerProps> = React.memo(
  ({ vertices, zoom, activeAnchorVertexId, wasDraggingRecentlyRef, isInteractionInterceptedRef, triggerPlacementRef, onSelectAnchor }) => (
    <>
      {vertices.map((v) => {
        const isAnchor = activeAnchorVertexId === v.id;
        return (
          <g
            key={v.id}
            transform={`translate(${v.x * zoom}, ${v.y * zoom})`}
            onClick={(e) => {
              if (wasDraggingRecentlyRef.current()) return;
              if (isInteractionInterceptedRef.current) {
                triggerPlacementRef.current(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onSelectAnchor(v.id);
            }}
            className="cursor-pointer"
          >
            {/* Halo de anclaje activo */}
            {isAnchor && (
              <circle r={M.anchorHaloRadius} fill={C.anchorHaloFill} stroke={C.anchorHaloStroke} strokeWidth={1.5} strokeDasharray="2 2" />
            )}
            {/* Punto de esquina */}
            <circle
              r={isAnchor ? M.anchorRadius : M.vertexRadius}
              fill={isAnchor ? C.anchorFill : C.vertexFill}
              stroke={C.vertexStroke}
              strokeWidth={1.5}
              className="hover:stroke-blue-400 hover:stroke-[2.5px] transition-colors"
            />
          </g>
        );
      })}
    </>
  )
);
VerticesLayer.displayName = 'VerticesLayer';
