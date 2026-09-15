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
import { getWallPolygon, getWallLength, calculateWallSnap } from '../../../models/architecture/Wall';
import { getOpeningJambs } from '../../../models/architecture/Opening';
import { resolveSpacePolygon, calculatePolygonArea, calculatePolygonCentroid } from '../../../models/architecture/Space';
import { AeaCanvasSymbol } from '../electrical/AeaSymbolIcon';

export interface WallPlacementSnap {
  wallId: string;
  wallOffset: number;
  rotationDeg: number;
  side: 'left' | 'right';
}

interface BimCanvasProps {
  currentDirectionDeg: number;
  previewDistanceM: number;
  selectedSymbolId?: string | null;
  onWallClick?: (wallId: string) => void;
  onOpeningClick?: (openingId: string) => void;
  onSpaceClick?: (spaceId: string) => void;
  onElectricalElementClick?: (elementId: string) => void;
  onCanvasClick?: (worldX: number, worldY: number, snapInfo?: WallPlacementSnap) => void;
}

export const BimCanvas: React.FC<BimCanvasProps> = ({
  currentDirectionDeg,
  previewDistanceM,
  selectedSymbolId,
  onWallClick,
  onOpeningClick,
  onSpaceClick,
  onElectricalElementClick,
  onCanvasClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    project,
    selectedEntity,
    setSelectedEntity,
    activeAnchorVertexId,
    setActiveAnchorVertexId
  } = useProjectStore();

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

  // Posición del cursor en coordenadas de mundo (para preview y snap de bocas)
  const [hoverWorldPos, setHoverWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverRotationDeg, setHoverRotationDeg] = useState<number>(0);
  const [activeSnapInfo, setActiveSnapInfo] = useState<WallPlacementSnap | null>(null);
  const [isSnappedToCenter, setIsSnappedToCenter] = useState(false);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);

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

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let wx = (e.clientX - rect.left - pan.x) / zoom;
      let wy = (e.clientY - rect.top - pan.y) / zoom;

      let rot = 0;
      let snapInfo: WallPlacementSnap | null = null;
      let snappedCenter = false;

      if (selectedSymbolId) {
        const isCeilingSymbol = selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');

        // 1. Si no es exclusivamente de techo, intentar acoplar magnéticamente a la pared más cercana
        if (!isCeilingSymbol) {
          const wallsInLevel = project.walls.filter((w) => w.levelId === project.activeLevelId);
          const wallSnap = calculateWallSnap({ x: wx, y: wy }, wallsInLevel, verticesMap, 0.45);
          if (wallSnap) {
            wx = wallSnap.snappedPoint.x;
            wy = wallSnap.snappedPoint.y;
            rot = wallSnap.rotationDeg;
            snapInfo = {
              wallId: wallSnap.wall.id,
              wallOffset: wallSnap.distanceAlongWall,
              rotationDeg: wallSnap.rotationDeg,
              side: wallSnap.side
            };
          }
        }

        // 2. Si no se acopló a pared, chequear snap al centroide de habitación
        if (!snapInfo) {
          for (const space of project.spaces.filter((s) => s.levelId === project.activeLevelId)) {
            const poly = resolveSpacePolygon(space, verticesMap);
            if (poly.length >= 3) {
              const centroid = calculatePolygonCentroid(poly);
              if (Math.hypot(centroid.x - wx, centroid.y - wy) < 0.60) {
                wx = centroid.x;
                wy = centroid.y;
                snappedCenter = true;
                break;
              }
            }
          }
        }
      }

      setHoverWorldPos({ x: wx, y: wy });
      setHoverRotationDeg(rot);
      setActiveSnapInfo(snapInfo);
      setIsSnappedToCenter(snappedCenter);
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

  const triggerPlacement = (clientX: number, clientY: number) => {
    if (isDragging || !onCanvasClick || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let wx = (clientX - rect.left - pan.x) / zoom;
    let wy = (clientY - rect.top - pan.y) / zoom;
    let snapInfo: WallPlacementSnap | null = null;

    if (selectedSymbolId) {
      const isCeilingSymbol = selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');

      if (!isCeilingSymbol) {
        const wallsInLevel = project.walls.filter((w) => w.levelId === project.activeLevelId);
        const wallSnap = calculateWallSnap({ x: wx, y: wy }, wallsInLevel, verticesMap, 0.45);
        if (wallSnap) {
          wx = wallSnap.snappedPoint.x;
          wy = wallSnap.snappedPoint.y;
          snapInfo = {
            wallId: wallSnap.wall.id,
            wallOffset: wallSnap.distanceAlongWall,
            rotationDeg: wallSnap.rotationDeg,
            side: wallSnap.side
          };
        }
      }

      if (!snapInfo) {
        for (const space of project.spaces.filter((s) => s.levelId === project.activeLevelId)) {
          const poly = resolveSpacePolygon(space, verticesMap);
          if (poly.length >= 3) {
            const centroid = calculatePolygonCentroid(poly);
            if (Math.hypot(centroid.x - wx, centroid.y - wy) < 0.60) {
              wx = centroid.x;
              wy = centroid.y;
              break;
            }
          }
        }
      }
    }

    onCanvasClick(Number(wx.toFixed(3)), Number(wy.toFixed(3)), snapInfo || undefined);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    triggerPlacement(e.clientX, e.clientY);
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
              if (selectedSymbolId) {
                // Modo inserción de elemento eléctrico: no bloquear, emplazar boca en el ambiente!
                triggerPlacement(e.clientX, e.clientY);
                return;
              }
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
              {area.toFixed(2)} m² · h: {space.ceilingHeight.toFixed(2)}m
            </text>
          </g>
        );
      });
  }, [project.spaces, project.activeLevelId, verticesMap, zoom, selectedSymbolId, onSpaceClick]);

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
            onMouseEnter={() => setHoveredWallId(wall.id)}
            onMouseLeave={() => setHoveredWallId(null)}
            onClick={(e) => {
              if (selectedSymbolId) {
                // Modo inserción de elemento eléctrico: permitir emplazar sobre el muro!
                triggerPlacement(e.clientX, e.clientY);
                return;
              }
              e.stopPropagation();
              onWallClick?.(wall.id);
            }}
            className="cursor-pointer group"
          >
            {/* 1. Zona táctil y de clic amplia para selección inmediata del muro */}
            <line
              x1={vStart.x * zoom}
              y1={vStart.y * zoom}
              x2={vEnd.x * zoom}
              y2={vEnd.y * zoom}
              stroke="transparent"
              strokeWidth={Math.max(wall.thickness * zoom + 24, 32)}
              pointerEvents="stroke"
            />

            {/* 2. Cuerpo físico del muro */}
            <polygon
              points={pointsStr}
              fill={isSelected ? '#2563eb' : hoveredWallId === wall.id ? '#475569' : '#334155'}
              stroke={isSelected ? '#1d4ed8' : '#1e293b'}
              strokeWidth={isSelected ? 2 : 1}
            />

            {/* 3. Indicador y Grips visuales de selección activa */}
            {isSelected && (
              <>
                <polygon
                  points={pointsStr}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={3}
                  strokeDasharray="6 3"
                />
                <circle
                  cx={vStart.x * zoom}
                  cy={vStart.y * zoom}
                  r={6}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <circle
                  cx={vEnd.x * zoom}
                  cy={vEnd.y * zoom}
                  r={6}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </>
            )}

            {/* 4. Cota métrica al centro del muro */}
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x={-24}
                y={-10}
                width={48}
                height={16}
                rx={4}
                fill="#ffffff"
                fillOpacity={0.95}
                stroke={isSelected ? '#2563eb' : '#cbd5e1'}
                strokeWidth={isSelected ? 1.5 : 0.5}
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
  }, [project.walls, project.activeLevelId, verticesMap, zoom, selectedEntity, selectedSymbolId, onWallClick]);

  // 3. Aberturas con zona de clic amplia y gestión visual
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
            if (selectedSymbolId) {
              triggerPlacement(e.clientX, e.clientY);
              return;
            }
            e.stopPropagation();
            onOpeningClick?.(opening.id);
          }}
          className="cursor-pointer group"
        >
          {/* Zona táctil y de clic amplia para fácil selección en pantalla */}
          <rect
            x={0}
            y={(-wall.thickness * zoom) / 2 - 14}
            width={wPx}
            height={wall.thickness * zoom + 28}
            fill="transparent"
            pointerEvents="all"
          />

          {/* Calado del muro */}
          <rect
            x={0}
            y={(-wall.thickness * zoom) / 2}
            width={wPx}
            height={wall.thickness * zoom}
            fill="#ffffff"
            stroke={isSelected ? '#2563eb' : '#94a3b8'}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />

          {/* Halo de selección activa */}
          {isSelected && (
            <rect
              x={-2}
              y={(-wall.thickness * zoom) / 2 - 4}
              width={wPx + 4}
              height={wall.thickness * zoom + 8}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="4 2"
              rx={3}
            />
          )}

          {opening.type === 'door' && (() => {
            const swing = opening.swing || 'left_in';
            const hingeX = swing.startsWith('left') ? 0 : wPx;
            const targetX = swing.startsWith('left') ? wPx : 0;
            const leafY = swing.endsWith('in') ? -wPx : wPx;
            const sweep = swing === 'left_in' || swing === 'right_out' ? 1 : 0;
            const arcPath = `M ${hingeX} ${leafY} A ${wPx} ${wPx} 0 0 ${sweep} ${targetX} 0`;

            return (
              <>
                <line
                  x1={hingeX}
                  y1={0}
                  x2={hingeX}
                  y2={leafY}
                  stroke={isSelected ? '#2563eb' : '#475569'}
                  strokeWidth={2}
                />
                <path
                  d={arcPath}
                  fill="none"
                  stroke={isSelected ? '#2563eb' : '#94a3b8'}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              </>
            );
          })()}

          {opening.type === 'window' && (
            <>
              <line x1={0} y1={-2} x2={wPx} y2={-2} stroke={isSelected ? '#2563eb' : '#3b82f6'} strokeWidth={2} />
              <line x1={0} y1={2} x2={wPx} y2={2} stroke={isSelected ? '#2563eb' : '#3b82f6'} strokeWidth={2} />
            </>
          )}

          {/* Cota / Identificador flotante al estar seleccionada */}
          {isSelected && (
            <g transform={`translate(${wPx / 2}, ${(-wall.thickness * zoom) / 2 - 16})`}>
              <rect
                x={-28}
                y={-10}
                width={56}
                height={16}
                rx={4}
                fill="#2563eb"
                stroke="#1d4ed8"
                strokeWidth={0.5}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                fontSize={9}
                className="font-mono font-bold fill-white select-none pointer-events-none"
              >
                {opening.type === 'door' ? 'Puerta' : opening.type === 'window' ? 'Ventana' : 'Vano'}{' '}
                {opening.width.toFixed(2)}m
              </text>
            </g>
          )}
        </g>
      );
    });
  }, [project.openings, wallsMap, project.activeLevelId, verticesMap, zoom, selectedEntity, selectedSymbolId, onOpeningClick]);

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
            if (selectedSymbolId) {
              triggerPlacement(e.clientX, e.clientY);
              return;
            }
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
  }, [project.vertices, activeAnchorVertexId, zoom, selectedSymbolId, setActiveAnchorVertexId]);

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

  // 6. Cañerías de enlace entre bocas eléctricas
  const elementsMap = useMemo(() => {
    return new Map(project.electricalElements.map((el) => [el.id, el]));
  }, [project.electricalElements]);

  const renderedConduits = useMemo(() => {
    return project.conduits.map((conduit) => {
      const elFrom = elementsMap.get(conduit.fromElementId);
      const elTo = elementsMap.get(conduit.toElementId);
      if (!elFrom || !elTo) return null;
      if (elFrom.levelId !== project.activeLevelId || elTo.levelId !== project.activeLevelId) return null;

      const p1 = { x: elFrom.x * zoom, y: elFrom.y * zoom };
      const p2 = { x: elTo.x * zoom, y: elTo.y * zoom };

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return null;

      // Curvatura suave ortogonal/arco
      const normalX = -dy / dist;
      const normalY = dx / dist;
      const curveOffset = Math.min(dist * 0.18, 28);
      const midX = (p1.x + p2.x) / 2 + normalX * curveOffset;
      const midY = (p1.y + p2.y) / 2 + normalY * curveOffset;

      const pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;
      const isSelected = selectedEntity?.type === 'conduit' && selectedEntity.id === conduit.id;

      return (
        <g
          key={conduit.id}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEntity({ type: 'conduit', id: conduit.id });
          }}
          className="cursor-pointer group"
        >
          {/* Hit area amplia */}
          <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" />
          {/* Cañería en arco estilo unifilar AEA */}
          <path
            d={pathD}
            fill="none"
            stroke={isSelected ? '#2563eb' : '#ea580c'}
            strokeWidth={isSelected ? 3 : 2}
            strokeDasharray={conduit.material.includes('corrugado') ? '6 3' : 'none'}
            strokeLinecap="round"
          />
          {/* Diámetro de cañería */}
          <text
            x={midX}
            y={midY - 4}
            textAnchor="middle"
            fontSize={9}
            className="font-mono font-bold fill-amber-900 pointer-events-none select-none"
          >
            Ø{conduit.diameterMM}mm
          </text>
        </g>
      );
    });
  }, [project.conduits, project.activeLevelId, elementsMap, zoom, selectedEntity, setSelectedEntity]);

  // 7. Símbolos Eléctricos AEA con visibilidad absoluta y respaldo de contraste (Halo)
  const renderedElements = useMemo(() => {
    return project.electricalElements
      .filter((el) => el.levelId === project.activeLevelId)
      .map((element) => {
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
            <AeaCanvasSymbol
              symbolId={element.symbolId}
              zoom={zoom}
              isSelected={isSelected}
              elementLabel={element.label}
              rotationDeg={element.rotation || 0}
            />
          </g>
        );
      });
  }, [project.electricalElements, project.activeLevelId, zoom, selectedEntity, onElectricalElementClick]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-slate-50 select-none ${
        selectedSymbolId ? 'cursor-cell' : 'cursor-crosshair'
      }`}
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
            <path d={`M ${zoom} 0 L 0 0 0 ${zoom}`} fill="none" stroke="#e2e8f0" strokeWidth={0.75} />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        <g transform={`translate(${pan.x}, ${pan.y})`}>
          {renderedSpaces}
          {renderedWalls}
          {renderedOpenings}
          {renderedPreviewRay}
          {renderedConduits}
          {renderedVertices}
          {renderedElements}

          {/* Previsualización del elemento eléctrico que sigue al cursor (Ghost preview con snap al centro o a pared) */}
          {selectedSymbolId && hoverWorldPos && (
            <g
              transform={`translate(${hoverWorldPos.x * zoom}, ${hoverWorldPos.y * zoom})`}
              className="pointer-events-none opacity-90"
            >
              <AeaCanvasSymbol
                symbolId={selectedSymbolId}
                zoom={zoom}
                isSelected={true}
                elementLabel={activeSnapInfo ? 'Pared' : isSnappedToCenter ? 'Centro' : undefined}
                rotationDeg={hoverRotationDeg}
              />
              {activeSnapInfo && (
                <circle r={18} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="3 3" />
              )}
              {isSnappedToCenter && (
                <circle r={26} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 3" />
              )}
            </g>
          )}
        </g>
      </svg>

      {/* Indicador de ayuda */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-xs font-mono text-slate-700 pointer-events-none flex items-center gap-2">
        {selectedSymbolId ? (
          <span className="text-blue-700 font-bold">
            📍 Modo Eléctrico activo: Hacé clic dentro de cualquier habitación o muro para emplazar la boca {isSnappedToCenter ? '(Centro magnético)' : ''}
          </span>
        ) : project.vertices.length === 0 ? (
          'Tocá cualquier parte del lienzo para plantar el punto de inicio'
        ) : activeAnchorVertex ? (
          `Anclaje seleccionado: (${activeAnchorVertex.x}, ${activeAnchorVertex.y}) m`
        ) : (
          'Tocá un vértice o esquina para anclar la siguiente pared'
        )}
      </div>
    </div>
  );
};
