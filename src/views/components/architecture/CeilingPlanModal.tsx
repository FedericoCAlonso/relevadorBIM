/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: CeilingPlanModal.tsx
 * Modal CAD Inmersivo para el Plano de Cielorraso Reflejado (RCP).
 * Permite el replanteo milimétrico de bocas cenitales hacia muros perimetrales,
 * distribución uniforme y simétrica de múltiples luminarias (1, 2, 3, 4, 6 o grilla NxM),
 * arrastre directo e interactivo de bocas, selección de materialidad constructiva y
 * visualización responsiva adaptada a pantallas móviles y de escritorio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useCeilingPlanViewModel } from '../../../viewmodels/useCeilingPlanViewModel';
import {
  CEILING_MATERIAL_OPTIONS,
  getCeilingMaterialOption,
  CEILING_DISTRIBUTION_PRESETS,
  type CeilingDistributionPresetType
} from '../../../models/architecture/ceilingPlan';
import {
  X,
  Building2,
  Ruler,
  Crosshair,
  Grid,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  ChevronDown,
  Cable,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export const CeilingPlanModal: React.FC = () => {
  const {
    isOpen,
    space,
    ceilingPlanData,
    selectedBoxId,
    selectedBox,
    showDimensions,
    showWallDrops,
    showModularGrid,
    isPlaceMode,
    zoom,
    panOffset,

    // Comandos
    closeCeilingPlan,
    setSelectedBoxId,
    toggleDimensions,
    toggleWallDrops,
    toggleModularGrid,
    setPlaceMode,
    togglePlaceMode,
    setZoom,
    setPan,
    resetViewport,
    setMaterial,
    addBoxAt,
    applyDistributionPreset,
    applyCustomGridDistribution,
    deleteBox,
    moveBox
  } = useCeilingPlanViewModel();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingCanvasRef = useRef(false);
  const dragCanvasStartRef = useRef({ x: 0, y: 0 });

  // Arrastre interactivo de bocas
  const isDraggingBoxRef = useRef(false);
  const [draggedBoxId, setDraggedBoxId] = useState<string | null>(null);
  const dragBoxStartRef = useRef<{ x: number; y: number } | null>(null);

  // Estados de modales y menús
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distPreset, setDistPreset] = useState<CeilingDistributionPresetType>('4_grid');
  const [distributionMode, setDistributionMode] = useState<'preset' | 'custom'>('preset');
  const [customCols, setCustomCols] = useState(2);
  const [customRows, setCustomRows] = useState(2);
  const [replaceExisting, setReplaceExisting] = useState(true);

  // Dimensiones del ViewBox SVG
  const viewBox = useMemo(() => {
    if (!ceilingPlanData) return '0 0 100 100';
    const { bounds } = ceilingPlanData;
    const padding = Math.max(1.0, Math.max(bounds.width, bounds.height) * 0.25);
    const vbX = bounds.minX - padding - panOffset.x;
    const vbY = bounds.minY - padding - panOffset.y;
    const vbW = (bounds.width + padding * 2) / zoom;
    const vbH = (bounds.height + padding * 2) / zoom;
    return `${vbX} ${vbY} ${vbW} ${vbH}`;
  }, [ceilingPlanData, panOffset, zoom]);

  // Conversión de evento del puntero a coordenadas del mundo SVG en metros
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!svgRef.current) return null;
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svgRef.current.getScreenCTM();
      if (!ctm) return null;
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (isDraggingBoxRef.current) return;
    isDraggingCanvasRef.current = true;
    dragCanvasStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Si se está arrastrando una boca
    if (isDraggingBoxRef.current && draggedBoxId) {
      const world = clientToWorld(e.clientX, e.clientY);
      if (world && dragBoxStartRef.current) {
        const newX = Number((world.x - dragBoxStartRef.current.x).toFixed(2));
        const newY = Number((world.y - dragBoxStartRef.current.y).toFixed(2));
        moveBox(draggedBoxId, { x: newX, y: newY });
      }
      return;
    }

    // Si se está paneando el lienzo
    if (!isDraggingCanvasRef.current) return;
    const dx = (e.clientX - dragCanvasStartRef.current.x) * 0.01;
    const dy = (e.clientY - dragCanvasStartRef.current.y) * 0.01;
    dragCanvasStartRef.current = { x: e.clientX, y: e.clientY };
    setPan({ x: panOffset.x + dx, y: panOffset.y + dy });
  };

  const handlePointerUp = () => {
    if (isDraggingBoxRef.current) {
      isDraggingBoxRef.current = false;
      setDraggedBoxId(null);
      dragBoxStartRef.current = null;
      return;
    }
    isDraggingCanvasRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!ceilingPlanData) return;
    const world = clientToWorld(e.clientX, e.clientY);
    if (!world) return;

    if (isPlaceMode) {
      addBoxAt({ x: Number(world.x.toFixed(2)), y: Number(world.y.toFixed(2)) });
      return;
    }

    // Deseleccionar si se hizo clic en zona libre
    setSelectedBoxId(null);
  };

  if (!isOpen || !space || !ceilingPlanData) return null;

  const currentMaterial = getCeilingMaterialOption(ceilingPlanData.material);
  const polygonPoints = ceilingPlanData.polygon.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="fixed inset-0 w-full h-full max-w-full max-h-full overflow-hidden z-50 flex flex-col bg-slate-950 text-slate-100 select-none animate-in fade-in duration-200">
      {/* ── BARRA SUPERIOR (TOOLBAR MINIMALISTA RESPONSIVE) ── */}
      <header className="h-14 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-20">
        {/* Identificación del Ambiente */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl shrink-0">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <h2 className="font-bold text-xs sm:text-sm text-slate-100 truncate max-w-[120px] sm:max-w-[200px]">
                {space.name}
              </h2>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full border border-slate-700 shrink-0">
                RCP
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
              {ceilingPlanData.areaM2.toFixed(2)} m² · h: {space.ceilingHeight.toFixed(2)}m
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera (Desktop) */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Selector de Materialidad */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMaterialDropdownOpen(!materialDropdownOpen)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers size={13} className="text-blue-400 shrink-0" />
              <span>{currentMaterial.shortLabel}</span>
              <ChevronDown size={12} className="text-slate-400 shrink-0" />
            </button>

            {materialDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Materialidad Constructiva
                </div>
                {CEILING_MATERIAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMaterial(opt.id);
                      setMaterialDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      ceilingPlanData.material === opt.id
                        ? 'bg-blue-600/20 text-blue-400 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] text-slate-500 font-normal">{opt.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle de Cotas de Replanteo */}
          <button
            type="button"
            onClick={toggleDimensions}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showDimensions
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Alternar cotas ortogonales de replanteo a muros"
          >
            <Ruler size={14} />
            <span>Cotas</span>
          </button>

          {/* Toggle de Bajadas a Muro */}
          <button
            type="button"
            onClick={toggleWallDrops}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showWallDrops
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Alternar bajadas a llaves y tomas de pared"
          >
            <Cable size={14} />
            <span>Bajadas</span>
          </button>

          {/* Toggle de Grilla Modular */}
          <button
            type="button"
            onClick={toggleModularGrid}
            className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showModularGrid
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Alternar trama modular 60x60"
          >
            <Grid size={15} />
          </button>

          {/* Botón Cerrar */}
          <button
            type="button"
            onClick={closeCeilingPlan}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Acciones de Cabecera (Mobile Compacta - Cero Desborde) */}
        <div className="flex sm:hidden items-center gap-1.5 shrink-0">
          {/* Toggle Cotas */}
          <button
            type="button"
            onClick={toggleDimensions}
            className={`p-2 rounded-xl text-xs border transition-all cursor-pointer ${
              showDimensions
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Cotas de replanteo"
          >
            <Ruler size={15} />
          </button>

          {/* Menú de Opciones en Móvil (Material, Bajadas, Grilla) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMobileOptionsOpen(!mobileOptionsOpen)}
              className={`p-2 rounded-xl text-xs border transition-all cursor-pointer ${
                mobileOptionsOpen
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Más opciones de cielorraso"
            >
              <SlidersHorizontal size={15} />
            </button>
            {mobileOptionsOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">Opciones de Plano</div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      toggleWallDrops();
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      showWallDrops ? 'bg-cyan-600/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Cable size={13} /> Bajadas a Muro</span>
                    <span>{showWallDrops ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleModularGrid();
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      showModularGrid ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Grid size={13} /> Grilla 60x60</span>
                    <span>{showModularGrid ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
                <div className="border-t border-slate-800 pt-1.5">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-0.5 uppercase">Material Cielorraso</div>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {CEILING_MATERIAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setMaterial(opt.id);
                          setMobileOptionsOpen(false);
                        }}
                        className={`w-full px-2 py-1 rounded text-left text-xs ${
                          ceilingPlanData.material === opt.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botón Cerrar */}
          <button
            type="button"
            onClick={closeCeilingPlan}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── ÁREA PRINCIPAL DEL LIENZO SVG ── */}
      <div className="flex-1 w-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
        {/* Banner de Modo Colocación si está activo */}
        {isPlaceMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xl flex items-center gap-2 z-20 animate-in fade-in">
            <span>📍 Modo Colocar: Tocá el cielorraso para agregar una boca</span>
            <button
              type="button"
              onClick={() => setPlaceMode(false)}
              className="p-0.5 hover:bg-blue-700 rounded-full text-white/80 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={`w-full h-full touch-none select-none ${isPlaceMode ? 'cursor-crosshair' : 'cursor-default'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleCanvasClick}
        >
          <defs>
            {/* Trama Modular de 60x60 cm */}
            <pattern id="rcp-grid-60" width="0.60" height="0.60" patternUnits="userSpaceOnUse">
              <rect width="0.60" height="0.60" fill="none" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="0.015" />
            </pattern>
          </defs>

          {/* 1. Fondo del Cielorraso */}
          <polygon
            points={polygonPoints}
            fill={
              ceilingPlanData.material === 'modular_desmontable'
                ? 'url(#rcp-grid-60)'
                : '#0f172a'
            }
            stroke="#475569"
            strokeWidth="0.12"
            strokeLinejoin="round"
          />

          {/* Trama modular superpuesta si está activada */}
          {showModularGrid && ceilingPlanData.material !== 'modular_desmontable' && (
            <polygon points={polygonPoints} fill="url(#rcp-grid-60)" opacity="0.6" />
          )}

          {/* 2. Bajadas Perimetrales a Muro (Llaves de luz y tomas) */}
          {showWallDrops &&
            ceilingPlanData.wallDrops.map((drop) => (
              <g key={drop.element.id} className="pointer-events-none select-none">
                <circle
                  cx={drop.wallPos.x}
                  cy={drop.wallPos.y}
                  r={0.12}
                  fill={drop.isSwitch ? '#06b6d4' : '#64748b'}
                  stroke="#ffffff"
                  strokeWidth={0.03}
                />
                <text
                  x={drop.wallPos.x}
                  y={drop.wallPos.y - 0.18}
                  textAnchor="middle"
                  fontSize="0.16"
                  fontWeight="bold"
                  fill={drop.isSwitch ? '#22d3ee' : '#94a3b8'}
                  className="font-mono select-none"
                >
                  {drop.isSwitch ? 'Bajada Llave' : 'Bajada Toma'}
                </text>
              </g>
            ))}

          {/* 3. Cotas Ortogonales de Replanteo a Muros */}
          {ceilingPlanData.ceilingBoxes.map((box) => {
            const isSelected = selectedBoxId === box.element.id;
            const shouldRenderDims = showDimensions || isSelected;
            if (!shouldRenderDims) return null;

            const { rays, primaryX, primaryY } = box.settingOut;

            return (
              <g key={`dims-${box.element.id}`} className="pointer-events-none select-none">
                {rays.map((ray) => {
                  const isPrimary = ray === primaryX || ray === primaryY;
                  if (!isSelected && !isPrimary) return null; // Solo cotas primarias si no está seleccionado

                  return (
                    <g key={ray.direction}>
                      {/* Línea de Cota punteada */}
                      <line
                        x1={ray.boxPoint.x}
                        y1={ray.boxPoint.y}
                        x2={ray.wallPoint.x}
                        y2={ray.wallPoint.y}
                        stroke={isPrimary ? '#38bdf8' : '#64748b'}
                        strokeWidth={isPrimary ? 0.025 : 0.015}
                        strokeDasharray={isPrimary ? undefined : '0.06 0.04'}
                      />

                      {/* Marca perpendicular en el muro */}
                      <circle
                        cx={ray.wallPoint.x}
                        cy={ray.wallPoint.y}
                        r={0.04}
                        fill={isPrimary ? '#38bdf8' : '#64748b'}
                      />

                      {/* Pastilla con Cota Numérica */}
                      <g
                        transform={`translate(${(ray.boxPoint.x + ray.wallPoint.x) / 2}, ${
                          (ray.boxPoint.y + ray.wallPoint.y) / 2
                        })`}
                      >
                        <rect
                          x={-0.30}
                          y={-0.12}
                          width={0.60}
                          height={0.24}
                          rx={0.06}
                          fill={isPrimary ? '#0284c7' : '#1e293b'}
                          stroke={isPrimary ? '#38bdf8' : '#475569'}
                          strokeWidth={0.015}
                        />
                        <text
                          x={0}
                          y={0.06}
                          textAnchor="middle"
                          fontSize="0.14"
                          fontWeight="bold"
                          fill="#ffffff"
                          className="font-mono select-none"
                        >
                          {ray.distanceM.toFixed(2)}m
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* 4. Bocas Cenitales de Iluminación (Interactiva con arrastre) */}
          {ceilingPlanData.ceilingBoxes.map((box) => {
            const isSelected = selectedBoxId === box.element.id;

            return (
              <g
                key={box.element.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedBoxId(box.element.id);
                  const world = clientToWorld(e.clientX, e.clientY);
                  if (world) {
                    isDraggingBoxRef.current = true;
                    setDraggedBoxId(box.element.id);
                    dragBoxStartRef.current = { x: world.x - box.element.x, y: world.y - box.element.y };
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  }
                }}
                className="cursor-move"
              >
                {/* Halo de Selección */}
                {isSelected && (
                  <circle
                    cx={box.element.x}
                    cy={box.element.y}
                    r={0.42}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={0.04}
                    strokeDasharray="0.08 0.06"
                    className="animate-pulse"
                  />
                )}

                {/* Símbolo de Boca de Techo (Octógono / Círculo reglamentario) */}
                <circle
                  cx={box.element.x}
                  cy={box.element.y}
                  r={0.25}
                  fill={isSelected ? '#0284c7' : '#1e293b'}
                  stroke={isSelected ? '#38bdf8' : '#fbbf24'}
                  strokeWidth={0.04}
                />
                {/* Cruz central de iluminación */}
                <line
                  x1={box.element.x - 0.16}
                  y1={box.element.y}
                  x2={box.element.x + 0.16}
                  y2={box.element.y}
                  stroke={isSelected ? '#ffffff' : '#fbbf24'}
                  strokeWidth={0.03}
                />
                <line
                  x1={box.element.x}
                  y1={box.element.y - 0.16}
                  x2={box.element.x}
                  y2={box.element.y + 0.16}
                  stroke={isSelected ? '#ffffff' : '#fbbf24'}
                  strokeWidth={0.03}
                />

                {/* Etiqueta de la Boca */}
                <text
                  x={box.element.x}
                  y={box.element.y + 0.45}
                  textAnchor="middle"
                  fontSize="0.16"
                  fontWeight="bold"
                  fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                  className="font-mono select-none"
                >
                  Boca Cenital
                </text>
              </g>
            );
          })}
        </svg>

        {/* ── CONTROLES DE ZOOM / PAN FLOTANTES ── */}
        <div className="absolute right-3 bottom-4 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800 p-1 sm:p-1.5 rounded-2xl shadow-xl z-20">
          <button
            type="button"
            onClick={() => setZoom(zoom * 1.25)}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Acercar (Zoom +)"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(zoom * 0.8)}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Alejar (Zoom -)"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={resetViewport}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Restablecer Encuadre"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* ── INSPECTOR DE BOCA CENITAL SELECCIONADA ── */}
        {selectedBox && (
          <aside className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-sm sm:w-full max-h-[48vh] overflow-y-auto bg-slate-900/95 border border-slate-800 p-3.5 sm:p-4 rounded-3xl shadow-2xl backdrop-blur-md space-y-2.5 sm:space-y-3 z-20 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <Crosshair size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-100">Boca de Techo Seleccionada</h4>
                  <p className="text-[10px] font-mono text-slate-400">
                    X: {selectedBox.element.x.toFixed(2)}m · Y: {selectedBox.element.y.toFixed(2)}m
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBoxId(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Desglose de Cotas de Replanteo a Muros */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80">
              {selectedBox.settingOut.rays.map((ray) => {
                const isPrimary =
                  ray === selectedBox.settingOut.primaryX ||
                  ray === selectedBox.settingOut.primaryY;

                const labelMap = {
                  left: 'Pared Izquierda',
                  right: 'Pared Derecha',
                  top: 'Pared Norte / Sup',
                  bottom: 'Pared Sur / Inf'
                };

                return (
                  <div key={ray.direction} className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 uppercase block font-sans">
                      {labelMap[ray.direction]}
                    </span>
                    <span className={`font-bold ${isPrimary ? 'text-sky-400' : 'text-slate-300'}`}>
                      {ray.distanceM.toFixed(2)} m
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Ajuste fino de posición (Nudge) */}
            <div className="flex items-center justify-between text-[11px] bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-400">Ajuste ±10cm:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBox(selectedBox.element.id, { x: selectedBox.element.x - 0.10, y: selectedBox.element.y })}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  title="Mover 10cm a la izquierda"
                >
                  <ArrowLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBox(selectedBox.element.id, { x: selectedBox.element.x + 0.10, y: selectedBox.element.y })}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  title="Mover 10cm a la derecha"
                >
                  <ArrowRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBox(selectedBox.element.id, { x: selectedBox.element.x, y: selectedBox.element.y - 0.10 })}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  title="Mover 10cm arriba"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBox(selectedBox.element.id, { x: selectedBox.element.x, y: selectedBox.element.y + 0.10 })}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  title="Mover 10cm abajo"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            </div>

            {/* Acciones de Boca */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const { bounds } = ceilingPlanData;
                  moveBox(selectedBox.element.id, {
                    x: (bounds.minX + bounds.maxX) / 2,
                    y: (bounds.minY + bounds.maxY) / 2
                  });
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Centrar esta boca en el ambiente"
              >
                <Crosshair size={13} />
                <span>Centrar</span>
              </button>
              <button
                type="button"
                onClick={() => deleteBox(selectedBox.element.id)}
                className="flex-1 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Eliminar</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── BARRA INFERIOR / ACCIÓN RÁPIDA (ESPECIALMENTE MÓVIL) ── */}
      <footer className="h-14 border-t border-slate-800 bg-slate-900 px-3 sm:px-4 flex items-center justify-between shrink-0 z-20">
        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[140px] sm:max-w-none">
          {ceilingPlanData.ceilingBoxes.length} boca(s)
          <span className="hidden sm:inline"> en cielorraso · {ceilingPlanData.wallDrops.length} bajada(s)</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón Distribuir Bocas */}
          <button
            type="button"
            onClick={() => setShowDistributionModal(true)}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 shadow-md transition-all cursor-pointer"
            title="Distribuir múltiples bocas simétrica y uniformemente en el cielorraso"
          >
            <Grid size={14} />
            <span>Distribuir</span>
          </button>

          {/* Botón Colocar / Agregar Boca Libre */}
          <button
            type="button"
            onClick={() => {
              togglePlaceMode();
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 shadow-md transition-all cursor-pointer ${
              isPlaceMode
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            title={isPlaceMode ? 'Cancelar modo colocación' : 'Tocar para colocar boca libre en el cielorraso'}
          >
            <Plus size={15} />
            <span>{isPlaceMode ? 'Ubicando...' : 'Agregar'}</span>
          </button>
        </div>
      </footer>

      {/* ── MODAL / BOTTOM SHEET DE DISTRIBUCIÓN DE BOCAS ── */}
      {showDistributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                  <Grid size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Distribuir Bocas de Iluminación</h3>
                  <p className="text-[11px] text-slate-400">
                    {space.name} · {ceilingPlanData.areaM2.toFixed(2)} m²
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDistributionModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Selector de Modo: Presets vs Personalizado */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setDistributionMode('preset')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  distributionMode === 'preset'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Distribución Rápida
              </button>
              <button
                type="button"
                onClick={() => setDistributionMode('custom')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  distributionMode === 'custom'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Matriz Personalizada
              </button>
            </div>

            {/* Opciones de Presets */}
            {distributionMode === 'preset' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cantidad y Esquema
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CEILING_DISTRIBUTION_PRESETS.map((preset) => {
                    const isSelected = distPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setDistPreset(preset.id)}
                        className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{preset.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {preset.count} {preset.count === 1 ? 'boca' : 'bocas'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modo Matriz Personalizada */}
            {distributionMode === 'custom' && (
              <div className="space-y-3 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Configurar Filas y Columnas</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 block">Columnas (Eje X)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomCols(Math.max(1, customCols - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-sm text-center flex-1">{customCols}</span>
                      <button
                        type="button"
                        onClick={() => setCustomCols(Math.min(8, customCols + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 block">Filas (Eje Y)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomRows(Math.max(1, customRows - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-sm text-center flex-1">{customRows}</span>
                      <button
                        type="button"
                        onClick={() => setCustomRows(Math.min(8, customRows + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-400 font-mono text-center pt-1">
                  Total a generar: {customCols * customRows} bocas equidistantes
                </p>
              </div>
            )}

            {/* Opción Reemplazar Existentes */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="rcp-replace-existing"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="rcp-replace-existing" className="text-xs text-slate-300 cursor-pointer">
                Reemplazar bocas actuales del ambiente ({ceilingPlanData.ceilingBoxes.length} existentes)
              </label>
            </div>

            {/* Botones de Acción */}
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDistributionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (distributionMode === 'preset') {
                    applyDistributionPreset(distPreset, replaceExisting);
                  } else {
                    applyCustomGridDistribution(customCols, customRows, replaceExisting);
                  }
                  setShowDistributionModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow-lg"
              >
                Aplicar Distribución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
