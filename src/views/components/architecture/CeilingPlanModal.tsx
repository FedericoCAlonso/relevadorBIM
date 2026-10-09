/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: CeilingPlanModal.tsx
 * Modal CAD Inmersivo para el Plano de Cielorraso Reflejado (RCP).
 * Permite el replanteo milimétrico de bocas cenitales hacia muros perimetrales,
 * selección de materialidad constructiva (losa, yeso, modular) y visualización
 * de bajadas a llaves y tomas de pared.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useCeilingPlanViewModel } from '../../../viewmodels/useCeilingPlanViewModel';
import {
  CEILING_MATERIAL_OPTIONS,
  getCeilingMaterialOption
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
  Cable
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
    zoom,
    panOffset,

    // Comandos
    closeCeilingPlan,
    setSelectedBoxId,
    toggleDimensions,
    toggleWallDrops,
    toggleModularGrid,
    setZoom,
    setPan,
    resetViewport,
    setMaterial,
    addBoxAt,
    centerBox,
    deleteBox
  } = useCeilingPlanViewModel();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false);

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
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = (e.clientX - dragStartRef.current.x) * 0.01;
    const dy = (e.clientY - dragStartRef.current.y) * 0.01;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setPan({ x: panOffset.x + dx, y: panOffset.y + dy });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!ceilingPlanData) return;
    // Si fue arrastre de paneo, ignorar clic
    const world = clientToWorld(e.clientX, e.clientY);
    if (!world) return;

    // Deseleccionar si se hizo clic en zona libre
    setSelectedBoxId(null);
  };

  if (!isOpen || !space || !ceilingPlanData) return null;

  const currentMaterial = getCeilingMaterialOption(ceilingPlanData.material);
  const polygonPoints = ceilingPlanData.polygon.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 select-none animate-in fade-in duration-200">
      {/* ── BARRA SUPERIOR (TOOLBAR MINIMALISTA) ── */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        {/* Identificación del Ambiente */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-slate-100">{space.name}</h2>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                RCP · Cielorraso
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {ceilingPlanData.areaM2.toFixed(2)} m² · h: {space.ceilingHeight.toFixed(2)}m
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2">
          {/* Selector de Materialidad */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMaterialDropdownOpen(!materialDropdownOpen)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Layers size={14} className="text-blue-400" />
              <span>{currentMaterial.shortLabel}</span>
              <ChevronDown size={14} className="text-slate-400" />
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
            <span className="hidden sm:inline">Cotas</span>
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
            <span className="hidden sm:inline">Bajadas</span>
          </button>

          {/* Toggle de Grilla Modular (si aplica) */}
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

          {/* Botón de Centrar Luminaria */}
          <button
            type="button"
            onClick={() => centerBox()}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Colocar boca de iluminación en el centroide exacto"
          >
            <Crosshair size={14} />
            <span className="hidden sm:inline">Centrar Boca</span>
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
      </header>

      {/* ── ÁREA PRINCIPAL DEL LIENZO SVG ── */}
      <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full h-full cursor-crosshair touch-none"
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
            {/* Patrón sutil de hormigón */}
            <pattern id="rcp-slab" width="1.0" height="1.0" patternUnits="userSpaceOnUse">
              <rect width="1.0" height="1.0" fill="#0f172a" />
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

          {/* 4. Bocas Cenitales de Iluminación */}
          {ceilingPlanData.ceilingBoxes.map((box) => {
            const isSelected = selectedBoxId === box.element.id;

            return (
              <g
                key={box.element.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBoxId(box.element.id);
                }}
                className="cursor-pointer"
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
        <div className="absolute right-4 bottom-4 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl shadow-xl z-20">
          <button
            type="button"
            onClick={() => setZoom(zoom * 1.25)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Acercar (Zoom +)"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(zoom * 0.8)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Alejar (Zoom -)"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={resetViewport}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Restablecer Encuadre"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* ── INSPECTOR DE BOCA CENITAL SELECCIONADA ── */}
        {selectedBox && (
          <aside className="absolute left-4 bottom-4 max-w-sm w-full bg-slate-900/95 border border-slate-800 p-4 rounded-3xl shadow-2xl backdrop-blur-md space-y-3 z-20 animate-in slide-in-from-bottom-4 duration-200">
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

            {/* Acciones de Boca */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => deleteBox(selectedBox.element.id)}
                className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Eliminar Boca</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── BARRA INFERIOR / ACCIÓN RÁPIDA (ESPECIALMENTE MÓVIL) ── */}
      <footer className="h-14 border-t border-slate-800 bg-slate-900 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="text-[11px] text-slate-400 font-mono">
          {ceilingPlanData.ceilingBoxes.length} boca(s) en cielorraso ·{' '}
          {ceilingPlanData.wallDrops.length} bajada(s)
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!ceilingPlanData) return;
              const { bounds } = ceilingPlanData;
              addBoxAt({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Agregar Boca</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
