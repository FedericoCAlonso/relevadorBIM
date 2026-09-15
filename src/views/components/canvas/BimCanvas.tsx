/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BimCanvas.tsx
 * Lienzo Gráfico 2D Interactivo para Arquitectura BIM y Red Eléctrica AEA.
 * Muestra puntos de anclaje (vértices/esquinas), proyección de rayo láser
 * en tiempo real, muros continuos con espesor y cotas métricas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useState, useMemo } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { WallVertex, Wall } from '../../../models/architecture/Wall';
import { getWallPolygon, getWallLength } from '../../../models/architecture/Wall';
import { getOpeningJambs } from '../../../models/architecture/Opening';
import { resolveSpacePolygon, calculatePolygonArea, calculatePolygonCentroid } from '../../../models/architecture/Space';
import { getSymbolById } from '../../../models/electrical/symbolsLib';

interface BimCanvasProps {
  currentDirectionDeg: number;
  previewDistanceM: number;
  onWallClick?: (wallId: string) => void;
  onOpeningClick?: (openingId: string) => void;
  onSpaceClick?: (spaceId: string) => void;
  onElectricalElementClick?: (elementId: string) => void;
  onCanvasClick?: (worldX: number, worldY: number) => void;
}

export const BimCanvas: React.FC<BimCanvasProps> = ({
  currentDirectionDeg,
  previewDistanceM,
  onWallClick,
  onOpeningClick,
  onSpaceClick,
  onElectricalElementClick,
  onCanvasClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { project, selectedEntity, activeAnchorVertexId, setActiveAnchorVertexId } = useProjectStore();

  // Escala y transformación de vista (Pan y Zoom)
  const [zoom, setZoom] = useState(60); // 60 píxeles = 1 metro
  const [pan, setPan] = useState({ x: 150, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Mapas de acceso rápido
  const verticesMap = useMemo(() => {
    return new Map<string, WallVertex>(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const wallsMap = useMemo(() => {
    return new Map<string, Wall>(project.walls.map((w) => [w.id, w]));
  }, [project.walls]);

  // Vértice activo de anclaje
  const activeAnchorVertex = activeAnchorVertexId ? verticesMap.get(activeAnchorVertexId) : null;

  // Manejo de Pan y Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 15), 300);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
      });
      setZoom(newZoom);
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) return;
    if (containerRef.current && onCanvasClick) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldX = (screenX - pan.x) / zoom;
      const worldY = (screenY - pan.y) / zoom;
      onCanvasClick(Number(worldX.toFixed(2)), Number(worldY.toFixed(2)));
    }
  };

  // ─── RENDERIZADORES DE CAPAS ─────────────────────────────────────────────

  // 1. Ambientes detectados
  const renderedSpaces = useMemo(() => {
    return project.spaces
      .filter((s) => s.levelId === project.activeLevelId)
      .map((space) => {
        const poly = resolveSpacePolygon(space, verticesMap);
        if (poly.length < 3) return null;

        const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
        const area = calculatePolygonArea(poly);
        const centroid = calculatePolygonCentroid(poly);

        return (
          <g
            key={space.id}
            onClick={(e) => {
              e.stopPropagation();
              onSpaceClick?.(space.id);
            }}
            className="cursor-pointer"
          >
            <polygon points={pointsStr} fill="rgba(241, 245, 249, 0.75)" stroke="none" />
            <text
              x={centroid.x * zoom}
              y={centroid.y * zoom - 6}
              textAnchor="middle"
              className="text-xs font-bold fill-slate-700 pointer-events-none select-none"
              fontSize={12}
            >
              {space.name}
            </text>
            <text
              x={centroid.x * zoom}
              y={centroid.y * zoom + 12}
              textAnchor="middle"
              className="text-[10px] font-mono fill-slate-500 pointer-events-none select-none"
              fontSize={10}
            >
              {area.toFixed(2)} m²
            </text>
          </g>
        );
      });
  }, [project.spaces, project.activeLevelId, verticesMap, zoom, onSpaceClick]);

  // 2. Muros físicos con espesor
  const renderedWalls = useMemo(() => {
    return project.walls
      .filter((w) => w.levelId === project.activeLevelId)
      .map((wall) => {
        const poly = getWallPolygon(wall, verticesMap);
        const vStart = verticesMap.get(wall.startVertexId);
        const vEnd = verticesMap.get(wall.endVertexId);
        if (!poly || !vStart || !vEnd) return null;

        const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
        const lenM = getWallLength(wall, verticesMap);
        const isSelected = selectedEntity?.type === 'wall' && selectedEntity.id === wall.id;

        const midX = ((vStart.x + vEnd.x) / 2) * zoom;
        const midY = ((vStart.y + vEnd.y) / 2) * zoom;

        return (
          <g
            key={wall.id}
            onClick={(e) => {
              e.stopPropagation();
              onWallClick?.(wall.id);
            }}
            className="cursor-pointer group"
          >
            <polygon
              points={pointsStr}
              fill={isSelected ? '#2563eb' : '#334155'}
              stroke={isSelected ? '#1d4ed8' : '#1e293b'}
              strokeWidth={1}
            />
            {/* Cota métrica al centro del muro */}
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x={-24}
                y={-10}
                width={48}
                height={16}
                rx={4}
                fill="#ffffff"
                fillOpacity={0.95}
                stroke="#cbd5e1"
                strokeWidth={0.5}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                fontSize={9}
                className="font-mono font-bold fill-slate-800 select-none pointer-events-none"
              >
                {lenM.toFixed(2)} m
              </text>
            </g>
          </g>
        );
      });
  }, [project.walls, project.activeLevelId, verticesMap, zoom, selectedEntity, onWallClick]);

  // 3. Aberturas
  const renderedOpenings = useMemo(() => {
    return project.openings.map((opening) => {
      const wall = wallsMap.get(opening.wallId);
      if (!wall || wall.levelId !== project.activeLevelId) return null;

      const jambs = getOpeningJambs(opening, wall, verticesMap);
      if (!jambs) return null;

      const isSelected = selectedEntity?.type === 'opening' && selectedEntity.id === opening.id;
      const j1 = { x: jambs.jamb1.x * zoom, y: jambs.jamb1.y * zoom };
      const j2 = { x: jambs.jamb2.x * zoom, y: jambs.jamb2.y * zoom };

      const dx = j2.x - j1.x;
      const dy = j2.y - j1.y;
      const wPx = Math.hypot(dx, dy);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      return (
        <g
          key={opening.id}
          transform={`translate(${j1.x}, ${j1.y}) rotate(${angleDeg})`}
          onClick={(e) => {
            e.stopPropagation();
            onOpeningClick?.(opening.id);
          }}
          className="cursor-pointer"
        >
          {/* Calado del muro */}
          <rect
            x={0}
            y={(-wall.thickness * zoom) / 2}
            width={wPx}
            height={wall.thickness * zoom}
            fill="#ffffff"
            stroke={isSelected ? '#3b82f6' : '#94a3b8'}
            strokeWidth={1.5}
          />
          {opening.type === 'door' && (
            <>
              <line x1={0} y1={0} x2={0} y2={-wPx} stroke="#475569" strokeWidth={2} />
              <path
                d={`M 0 ${-wPx} A ${wPx} ${wPx} 0 0 1 ${wPx} 0`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </>
          )}
          {opening.type === 'window' && (
            <line x1={0} y1={0} x2={wPx} y2={0} stroke="#3b82f6" strokeWidth={2} />
          )}
        </g>
      );
    });
  }, [project.openings, wallsMap, project.activeLevelId, verticesMap, zoom, selectedEntity, onOpeningClick]);

  // 4. Vértices y Puntos de Anclaje (Snaps)
  const renderedVertices = useMemo(() => {
    return project.vertices.map((v) => {
      const isAnchor = activeAnchorVertexId === v.id;
      const pxX = v.x * zoom;
      const pxY = v.y * zoom;

      return (
        <g
          key={v.id}
          transform={`translate(${pxX}, ${pxY})`}
          onClick={(e) => {
            e.stopPropagation();
            setActiveAnchorVertexId(v.id);
          }}
          className="cursor-pointer"
        >
          {/* Halo de anclaje activo */}
          {isAnchor && (
            <circle
              r={12}
              fill="rgba(59, 130, 246, 0.25)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
          )}
          {/* Punto de esquina */}
          <circle
            r={isAnchor ? 6 : 4.5}
            fill={isAnchor ? '#2563eb' : '#64748b'}
            stroke="#ffffff"
            strokeWidth={1.5}
            className="hover:scale-125 transition-transform"
          />
        </g>
      );
    });
  }, [project.vertices, activeAnchorVertexId, zoom, setActiveAnchorVertexId]);

  // 5. Previsualización del rayo láser proyectado desde el anclaje activo
  const renderedPreviewRay = useMemo(() => {
    if (!activeAnchorVertex || previewDistanceM <= 0) return null;

    const startX = activeAnchorVertex.x * zoom;
    const startY = activeAnchorVertex.y * zoom;
    const rad = (currentDirectionDeg * Math.PI) / 180;
    const endX = startX + Math.cos(rad) * previewDistanceM * zoom;
    const endY = startY + Math.sin(rad) * previewDistanceM * zoom;

    return (
      <g pointerEvents="none">
        {/* Rayo láser proyectado */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeOpacity={0.8}
        />
        {/* Marcador de destino */}
        <circle cx={endX} cy={endY} r={5} fill="#ef4444" fillOpacity={0.7} />
        {/* Cota flotante del rayo */}
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - 8}
          textAnchor="middle"
          fontSize={10}
          className="font-mono font-bold fill-red-600 bg-white"
        >
          {previewDistanceM.toFixed(2)} m
        </text>
      </g>
    );
  }, [activeAnchorVertex, previewDistanceM, currentDirectionDeg, zoom]);

  // 6. Símbolos Eléctricos AEA
  const renderedElements = useMemo(() => {
    return project.electricalElements
      .filter((el) => el.levelId === project.activeLevelId)
      .map((element) => {
        const symbolDef = getSymbolById(element.symbolId);
        const pxX = element.x * zoom;
        const pxY = element.y * zoom;
        const isSelected = selectedEntity?.type === 'electrical_element' && selectedEntity.id === element.id;

        return (
          <g
            key={element.id}
            transform={`translate(${pxX}, ${pxY})`}
            onClick={(e) => {
              e.stopPropagation();
              onElectricalElementClick?.(element.id);
            }}
            className="cursor-pointer"
          >
            {isSelected && <circle r={16} fill="rgba(59, 130, 246, 0.3)" />}
            {symbolDef?.svgContent ? (
              <g
                transform="scale(0.8) translate(-10, -10)"
                dangerouslySetInnerHTML={{ __html: symbolDef.svgContent }}
                color={isSelected ? '#2563eb' : '#dc2626'}
              />
            ) : (
              <circle r={8} fill={isSelected ? '#2563eb' : '#dc2626'} stroke="#ffffff" strokeWidth={1.5} />
            )}
            {element.label && (
              <text x={12} y={4} fontSize={9} className="font-bold fill-red-800 select-none pointer-events-none">
                {element.label}
              </text>
            )}
          </g>
        );
      });
  }, [project.electricalElements, project.activeLevelId, zoom, selectedEntity, onElectricalElementClick]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-50 select-none cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg className="w-full h-full" onClick={handleSvgClick}>
        <defs>
          <pattern
            id="grid-pattern"
            width={zoom}
            height={zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % zoom}, ${pan.y % zoom})`}
          >
            <path d={`M ${zoom} 0 L 0 0 0 ${zoom}`} fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        <g transform={`translate(${pan.x}, ${pan.y})`}>
          {renderedSpaces}
          {renderedWalls}
          {renderedOpenings}
          {renderedPreviewRay}
          {renderedVertices}
          {renderedElements}
        </g>
      </svg>

      {/* Indicador de ayuda */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-mono text-slate-700 pointer-events-none">
        {project.vertices.length === 0
          ? 'Tocá cualquier parte del lienzo para plantar el punto de inicio'
          : activeAnchorVertex
          ? `Anclaje seleccionado: (${activeAnchorVertex.x}, ${activeAnchorVertex.y}) m`
          : 'Tocá un vértice o esquina para anclar la siguiente pared'}
      </div>
    </div>
  );
};
