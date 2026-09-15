/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BimCanvas.tsx
 * Lienzo Gráfico 2D Interactivo para Arquitectura BIM y Red Eléctrica AEA.
 * Renderiza muros continuos con espesor, aberturas con giros, cotas métricas
 * y símbolos electromecánicos con soporte para zoom, pan y touch.
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
  onWallClick?: (wallId: string) => void;
  onOpeningClick?: (openingId: string) => void;
  onSpaceClick?: (spaceId: string) => void;
  onElectricalElementClick?: (elementId: string) => void;
  onCanvasClick?: (worldX: number, worldY: number) => void;
}

export const BimCanvas: React.FC<BimCanvasProps> = ({
  onWallClick,
  onOpeningClick,
  onSpaceClick,
  onElectricalElementClick,
  onCanvasClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { project, selectedEntity } = useProjectStore();

  // Escala y transformación de vista (Pan y Zoom)
  const [zoom, setZoom] = useState(60); // 60 píxeles = 1 metro
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Mapas rápidos de acceso por ID
  const verticesMap = useMemo(() => {
    return new Map<string, WallVertex>(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const wallsMap = useMemo(() => {
    return new Map<string, Wall>(project.walls.map((w) => [w.id, w]));
  }, [project.walls]);

  // Manejo de eventos de Mouse / Touch para Pan y Zoom
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

    // Zoom centrado en la posición del cursor
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

  // Conversión de coordenadas de Pantalla a Mundo en Metros
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

  // ─── RENDERIZADORES AUXILIARES ──────────────────────────────────────────

  // 1. Ambientes (Espacios interiores con sombreado y etiquetas)
  const renderedSpaces = useMemo(() => {
    return project.spaces
      .filter((s) => s.levelId === project.activeLevelId)
      .map((space) => {
        const poly = resolveSpacePolygon(space, verticesMap);
        if (poly.length < 3) return null;

        const pointsStr = poly.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
        const area = calculatePolygonArea(poly);
        const centroid = calculatePolygonCentroid(poly);
        const isSelected = selectedEntity?.type === 'space' && selectedEntity.id === space.id;

        return (
          <g
            key={space.id}
            onClick={(e) => {
              e.stopPropagation();
              onSpaceClick?.(space.id);
            }}
            className="cursor-pointer"
          >
            <polygon
              points={pointsStr}
              fill={isSelected ? 'rgba(59, 130, 246, 0.20)' : 'rgba(243, 244, 246, 0.65)'}
              stroke="none"
            />
            {/* Etiqueta de nombre y área centrada */}
            <text
              x={centroid.x * zoom}
              y={centroid.y * zoom - 8}
              textAnchor="middle"
              className="text-xs font-semibold fill-gray-700 pointer-events-none select-none"
              fontSize={12}
            >
              {space.name}
            </text>
            <text
              x={centroid.x * zoom}
              y={centroid.y * zoom + 10}
              textAnchor="middle"
              className="text-[10px] font-medium fill-gray-500 pointer-events-none select-none"
              fontSize={10}
            >
              {area.toFixed(2)} m²
            </text>
          </g>
        );
      });
  }, [project.spaces, project.activeLevelId, verticesMap, zoom, selectedEntity, onSpaceClick]);

  // 2. Muros con Espesor Real
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
              fill={isSelected ? '#3b82f6' : '#374151'}
              stroke={isSelected ? '#1d4ed8' : '#1f2937'}
              strokeWidth={1}
            />
            {/* Cota de longitud del muro */}
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x={-24}
                y={-10}
                width={48}
                height={16}
                rx={4}
                fill="#ffffff"
                fillOpacity={0.9}
                stroke="#d1d5db"
                strokeWidth={0.5}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                fontSize={9}
                className="font-bold fill-gray-800 select-none pointer-events-none"
              >
                {lenM.toFixed(2)} m
              </text>
            </g>
          </g>
        );
      });
  }, [project.walls, project.activeLevelId, verticesMap, zoom, selectedEntity, onWallClick]);

  // 3. Aberturas (Puertas, Ventanas y Vanos)
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
          {/* Vano blanco que perfora el muro */}
          <rect
            x={0}
            y={(-wall.thickness * zoom) / 2}
            width={wPx}
            height={wall.thickness * zoom}
            fill="#ffffff"
            stroke={isSelected ? '#3b82f6' : '#9ca3af'}
            strokeWidth={1.5}
          />

          {opening.type === 'door' && (
            <>
              {/* Hoja de la puerta abierta a 90° */}
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={-wPx}
                stroke={isSelected ? '#2563eb' : '#4b5563'}
                strokeWidth={2}
              />
              {/* Arco de batiente CAD */}
              <path
                d={`M 0 ${-wPx} A ${wPx} ${wPx} 0 0 1 ${wPx} 0`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#9ca3af'}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </>
          )}

          {opening.type === 'window' && (
            <>
              {/* Tres líneas de carpintería de ventana */}
              <line x1={0} y1={-2} x2={wPx} y2={-2} stroke="#4b5563" strokeWidth={1} />
              <line x1={0} y1={2} x2={wPx} y2={2} stroke="#4b5563" strokeWidth={1} />
              <line x1={0} y1={0} x2={wPx} y2={0} stroke="#3b82f6" strokeWidth={1.5} />
            </>
          )}
        </g>
      );
    });
  }, [project.openings, wallsMap, project.activeLevelId, verticesMap, zoom, selectedEntity, onOpeningClick]);

  // 4. Cañerías Electromecánicas (Conduits)
  const renderedConduits = useMemo(() => {
    const elMap = new Map(project.electricalElements.map((e) => [e.id, e]));

    return project.conduits.map((conduit) => {
      const fromEl = elMap.get(conduit.fromElementId);
      const toEl = elMap.get(conduit.toElementId);
      if (!fromEl || !toEl) return null;

      const p1 = { x: fromEl.x * zoom, y: fromEl.y * zoom };
      const p2 = { x: toEl.x * zoom, y: toEl.y * zoom };

      // Curva suave tipo CAD entre bocas
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const curveOffset = Math.min(len * 0.15, 20);
      const nx = -dy / (len || 1);
      const ny = dx / (len || 1);

      const cx = mx + nx * curveOffset;
      const cy = my + ny * curveOffset;

      return (
        <g key={conduit.id}>
          <path
            d={`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`}
            fill="none"
            stroke="#b45309"
            strokeWidth={2}
            strokeDasharray={conduit.isVerticalRiser ? '4 4' : undefined}
          />
        </g>
      );
    });
  }, [project.conduits, project.electricalElements, zoom]);

  // 5. Símbolos Eléctricos AEA
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
            {/* Halo de selección */}
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
              <text
                x={12}
                y={4}
                fontSize={9}
                className="font-bold fill-red-800 select-none pointer-events-none"
              >
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
      <svg
        className="w-full h-full"
        onClick={handleSvgClick}
      >
        <defs>
          {/* Cuadrícula métrica 1m x 1m */}
          <pattern
            id="grid-pattern"
            width={zoom}
            height={zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % zoom}, ${pan.y % zoom})`}
          >
            <path
              d={`M ${zoom} 0 L 0 0 0 ${zoom}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.75"
            />
          </pattern>
        </defs>

        {/* Fondo con retícula */}
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        {/* Capa principal con zoom y pan */}
        <g transform={`translate(${pan.x}, ${pan.y})`}>
          {renderedSpaces}
          {renderedWalls}
          {renderedOpenings}
          {renderedConduits}
          {renderedElements}
        </g>
      </svg>

      {/* Indicador de Escala en Pantalla */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-mono text-slate-700 pointer-events-none">
        Zoom: {Math.round(zoom)} px/m · 1:50 CAD
      </div>
    </div>
  );
};
