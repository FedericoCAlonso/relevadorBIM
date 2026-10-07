/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: WallElevationModal.tsx (Patrón Estricto MVVM)
 * Modal / Visor de Alzado y Corte Longitudinal de Muro (Wall Elevation 2D).
 *
 * Muestra el paramento desplegado a escala física 1:1:
 * - Muro físico con su longitud y altura (estándar, bajo o baranda).
 * - Aberturas (puertas, ventanas, vanos) con antepecho y dintel.
 * - Cajas y gabinetes a escala real con troqueles y etiquetas.
 * - Cañerías y bajadas desde losa o subidas desde contrapiso.
 * - Cotas de nivel altimétricas reglamentarias (NPT +0.00, +0.30, +1.10, +2.80).
 * - Cotas lineales acumuladas a esquinas y vanos.
 * - Arrastre interactivo de cajas con snap magnético a presets de altura AEA.
 * - Edición bidireccional inmediata sincronizada con la planta CAD.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  useWallElevationViewModel
} from '../../../viewmodels/useWallElevationViewModel';
import { WALL_ELEVATION_STYLE } from '../../../models/architecture/wallElevationStyle';
import { WALL_ELEVATION_CONSTANTS } from '../../../models/architecture/wallElevation';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Ruler,
  Layers,
  ArrowLeftRight,
  MoveHorizontal,
  MoveVertical,
  DoorOpen,
  Info
} from 'lucide-react';

export const WallElevationModal: React.FC = () => {
  const {
    isOpen,
    wall,
    face,
    faceOptions,
    elevation,
    displayBoxes,
    guideY,
    isDragging,
    selection,
    selectedBox,
    selectedOpening,
    heightPresets,
    viewBoxAttribute,
    close,
    setFace,
    selectBox,
    selectOpening,
    clearSelection,
    beginBoxDrag,
    moveBoxDrag,
    endBoxDrag,
    cancelBoxDrag,
    setSelectedBoxX,
    setSelectedBoxZ,
    nudgeSelectedBox,
    patchSelectedOpening,
    zoomIn,
    zoomOut,
    zoomAt,
    wheelZoomFactor,
    fit,
    panBy
  } = useWallElevationViewModel();

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDragging) {
          cancelBoxDrag();
        } else {
          close();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDragging, cancelBoxDrag, close]);

  // Transforma coordenadas de pantalla a coordenadas del dibujo (metros)
  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const worldPt = pt.matrixTransform(inv);
    return { x: worldPt.x, y: worldPt.y };
  }, []);

  // Manejo de rueda de mouse (Zoom centrado en cursor)
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const world = clientToWorld(e.clientX, e.clientY);
      if (!world) return;
      const factor = wheelZoomFactor(e.deltaY);
      zoomAt(factor, world);
    },
    [clientToWorld, wheelZoomFactor, zoomAt]
  );

  // Paneo sobre el fondo del lienzo SVG
  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.target !== svgRef.current && (e.target as Element).id !== 'elevation-backdrop') return;
      clearSelection();
      isPanningRef.current = true;
      panStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [clearSelection]
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isDragging) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) moveBoxDrag(world);
        return;
      }
      if (isPanningRef.current) {
        const svg = svgRef.current;
        if (!svg) return;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const dxPx = e.clientX - panStartRef.current.clientX;
        const dyPx = e.clientY - panStartRef.current.clientY;
        panStartRef.current = { clientX: e.clientX, clientY: e.clientY };
        // Convertir delta px a delta metros
        const dxM = dxPx / ctm.a;
        const dyM = dyPx / ctm.d;
        panBy(dxM, dyM);
      }
    },
    [isDragging, clientToWorld, moveBoxDrag, panBy]
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isDragging) {
        endBoxDrag();
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        try {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
          // Ignorar si el puntero ya no estaba capturado
        }
      }
    },
    [isDragging, endBoxDrag]
  );

  if (!isOpen || !wall || !elevation) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wall-elevation-title"
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col select-none animate-in fade-in duration-150"
    >
      {/* ─── BARRA SUPERIOR / CABECERA ─── */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
            <Ruler size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="wall-elevation-title" className="font-bold text-sm text-slate-100 truncate">
                Alzado de Muro
              </h2>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                ID: {wall.id.slice(-6)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              L: {elevation.lengthM.toFixed(2)} m · H: {elevation.wallHeightM.toFixed(2)} m
              {elevation.ceilingZ !== elevation.wallHeightM && ` · Cielorraso: ${elevation.ceilingZ.toFixed(2)} m`}
            </p>
          </div>
        </div>

        {/* Selector de Paramento (Cara Interior vs Exterior) */}
        <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 gap-1 text-xs font-semibold">
          {faceOptions.map((opt) => (
            <button
              key={opt.face}
              type="button"
              onClick={() => setFace(opt.face)}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                face === opt.face
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Layers size={13} />
              <span className="max-w-[140px] truncate">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Controles de Vista y Botón Cerrar */}
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5">
            <button
              type="button"
              onClick={zoomIn}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Acercar (+)"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Alejar (-)"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={fit}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Ajustar encuadre (Fit)"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={close}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
            title="Cerrar alzado (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* ─── CUERPO PRINCIPAL (LIENZO CAD + PANEL DE INSPECCIÓN) ─── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-slate-950">
        {/* Lienzo SVG CAD 2D */}
        <div className="flex-1 relative min-h-0 overflow-hidden bg-slate-900/60 flex items-center justify-center">
          <svg
            ref={svgRef}
            viewBox={viewBoxAttribute}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
            onWheel={handleWheel}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
          >
            <defs>
              <pattern id="elevation-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
                <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="#1e293b" strokeWidth="0.005" />
              </pattern>
            </defs>

            {/* Fondo de captura de clics y paneo */}
            <rect
              id="elevation-backdrop"
              x={elevation.bounds.x - 20}
              y={elevation.bounds.y - 20}
              width={elevation.bounds.width + 40}
              height={elevation.bounds.height + 40}
              fill="url(#elevation-grid)"
            />

            {/* 1. Línea de Cielorraso o Proyección de Losa */}
            <line
              x1={0}
              y1={elevation.ceilingY}
              x2={elevation.lengthM}
              y2={elevation.ceilingY}
              stroke={WALL_ELEVATION_STYLE.ceilingLine}
              strokeWidth={WALL_ELEVATION_STYLE.strokePx.thin * 0.003}
              strokeDasharray={WALL_ELEVATION_STYLE.dash.ceiling}
            />

            {/* 2. Cuerpo del Muro Desplegado */}
            {(() => {
              const r = elevation.wallRect;
              if (elevation.wallType === 'railing') {
                return (
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.width}
                    height={r.height}
                    fill={WALL_ELEVATION_STYLE.railing.fill}
                    stroke={WALL_ELEVATION_STYLE.railing.stroke}
                    strokeWidth={WALL_ELEVATION_STYLE.strokePx.regular * 0.005}
                    strokeDasharray={WALL_ELEVATION_STYLE.dash.projected}
                  />
                );
              }
              return (
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={WALL_ELEVATION_STYLE.wall.fill}
                  stroke={WALL_ELEVATION_STYLE.wall.stroke}
                  strokeWidth={WALL_ELEVATION_STYLE.strokePx.regular * 0.005}
                />
              );
            })()}

            {/* 3. Aberturas (Puertas, Ventanas, Vanos) */}
            {elevation.openings.map((op) => {
              const style = WALL_ELEVATION_STYLE.opening[op.type];
              const isSelected = selection?.type === 'opening' && selection.id === op.id;
              return (
                <g
                  key={op.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectOpening(op.id);
                  }}
                  className="cursor-pointer group"
                >
                  <rect
                    x={op.rect.x}
                    y={op.rect.y}
                    width={op.rect.width}
                    height={op.rect.height}
                    fill={style.fill}
                    stroke={isSelected ? WALL_ELEVATION_STYLE.selection.stroke : style.stroke}
                    strokeWidth={
                      isSelected
                        ? WALL_ELEVATION_STYLE.strokePx.heavy * 0.008
                        : WALL_ELEVATION_STYLE.strokePx.regular * 0.005
                    }
                  />

                  {/* Antepecho marcado si es ventana con sill > 0 */}
                  {op.type === 'window' && op.sill > 0 && (
                    <line
                      x1={op.rect.x}
                      y1={op.rect.y2}
                      x2={op.rect.x2}
                      y2={op.rect.y2}
                      stroke={style.stroke}
                      strokeWidth={WALL_ELEVATION_STYLE.strokePx.regular * 0.005}
                    />
                  )}

                  {/* Rótulo de la Abertura */}
                  <text
                    x={op.labelAnchor.x}
                    y={op.labelAnchor.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                    fontWeight="bold"
                    fill={style.stroke}
                    className="pointer-events-none"
                  >
                    {op.label || (op.type === 'door' ? 'P' : op.type === 'window' ? 'V' : 'VANO')}
                  </text>
                </g>
              );
            })}

            {/* 4. Canalizaciones (Cañerías Físicas a Escala 1:1) */}
            {elevation.conduits.map((c) => {
              const dStr = c.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <g key={c.id} className="pointer-events-none">
                  {/* Borde exterior */}
                  <path
                    d={dStr}
                    fill="none"
                    stroke={WALL_ELEVATION_STYLE.conduit.outline}
                    strokeWidth={c.widthM + 0.004}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Núcleo coloreado según tecnología o circuito */}
                  <path
                    d={dStr}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={c.widthM}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* 5. Cajas Eléctricas y Gabinetes a Escala 1:1 */}
            {displayBoxes.map((b) => {
              const isSelected = selection?.type === 'box' && selection.id === b.id;
              const paint =
                b.shape === 'cabinet' ? WALL_ELEVATION_STYLE.box.cabinet : WALL_ELEVATION_STYLE.box.default;

              return (
                <g
                  key={b.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const world = clientToWorld(e.clientX, e.clientY);
                    if (world) beginBoxDrag(b.id, world);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectBox(b.id);
                  }}
                  className="cursor-grab active:cursor-grabbing group"
                >
                  {/* Halo de selección */}
                  {isSelected && (
                    <rect
                      x={b.rect.x - 0.015}
                      y={b.rect.y - 0.015}
                      width={b.rect.width + 0.03}
                      height={b.rect.height + 0.03}
                      fill="none"
                      stroke={WALL_ELEVATION_STYLE.selection.halo}
                      strokeWidth={0.015}
                      rx={0.01}
                    />
                  )}

                  {/* Contorno físico de la caja */}
                  {b.shape === 'octagon' && b.outline.length > 0 ? (
                    <polygon
                      points={b.outline.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill={paint.fill}
                      stroke={isSelected ? WALL_ELEVATION_STYLE.selection.stroke : paint.stroke}
                      strokeWidth={
                        isSelected
                          ? WALL_ELEVATION_STYLE.strokePx.heavy * 0.007
                          : WALL_ELEVATION_STYLE.strokePx.regular * 0.005
                      }
                    />
                  ) : (
                    <rect
                      x={b.rect.x}
                      y={b.rect.y}
                      width={b.rect.width}
                      height={b.rect.height}
                      fill={paint.fill}
                      stroke={isSelected ? WALL_ELEVATION_STYLE.selection.stroke : paint.stroke}
                      strokeWidth={
                        isSelected
                          ? WALL_ELEVATION_STYLE.strokePx.heavy * 0.007
                          : WALL_ELEVATION_STYLE.strokePx.regular * 0.005
                      }
                      rx={b.shape === 'cabinet' ? 0.015 : 0.005}
                    />
                  )}

                  {/* Troqueles de entrada de cañería */}
                  {b.knockouts.map((ko, kIdx) => (
                    <circle
                      key={kIdx}
                      cx={ko.cx}
                      cy={ko.cy}
                      r={ko.r}
                      fill="none"
                      stroke={WALL_ELEVATION_STYLE.box.knockout}
                      strokeWidth={0.003}
                    />
                  ))}

                  {/* Rótulo de la Caja sobre el elemento */}
                  <text
                    x={b.labelAnchor.x}
                    y={b.labelAnchor.y}
                    textAnchor="middle"
                    dominantBaseline="alphabetic"
                    fontSize={WALL_ELEVATION_CONSTANTS.LABEL_FONT_SIZE_M}
                    fontWeight="bold"
                    fill={WALL_ELEVATION_STYLE.box.label}
                    className="pointer-events-none"
                  >
                    {b.label || (b.kind === 'panel' ? 'TABLERO' : 'BOCA')}
                  </text>
                </g>
              );
            })}

            {/* 6. Guía Magnética de Altura Reglamentaria AEA Activa en Arrastre */}
            {guideY != null && (
              <g className="pointer-events-none">
                <line
                  x1={-0.1}
                  y1={guideY}
                  x2={elevation.lengthM + 0.1}
                  y2={guideY}
                  stroke={WALL_ELEVATION_STYLE.guide}
                  strokeWidth={0.008}
                  strokeDasharray={WALL_ELEVATION_STYLE.dash.guide}
                />
              </g>
            )}

            {/* 7. Línea de Piso Terminado (N.P.T. 0.00) */}
            <g className="pointer-events-none">
              <line
                x1={elevation.floorLine.x1}
                y1={elevation.floorLine.y}
                x2={elevation.floorLine.x2}
                y2={elevation.floorLine.y}
                stroke={WALL_ELEVATION_STYLE.floorLine}
                strokeWidth={WALL_ELEVATION_STYLE.strokePx.heavy * 0.006}
              />
              <text
                x={-0.08}
                y={elevation.floorLine.y + 0.06}
                textAnchor="end"
                fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                fontWeight="bold"
                fill={WALL_ELEVATION_STYLE.levelMark}
              >
                N.P.T. ±0.00
              </text>
            </g>

            {/* 8. Cotas Altimétricas de Nivel (Eje Izquierdo) */}
            <g className="pointer-events-none">
              {elevation.levelMarks.map((lm, idx) => (
                <g key={idx}>
                  <line
                    x1={lm.tickX1}
                    y1={lm.y}
                    x2={lm.tickX2}
                    y2={lm.y}
                    stroke={WALL_ELEVATION_STYLE.levelMark}
                    strokeWidth={0.004}
                  />
                  <text
                    x={lm.textX}
                    y={lm.textY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                    fontFamily="monospace"
                    fill={WALL_ELEVATION_STYLE.levelMark}
                  >
                    {lm.label}
                  </text>
                </g>
              ))}
            </g>

            {/* 9. Cadena de Cotas Horizontales (Eje Inferior) */}
            <g className="pointer-events-none">
              {/* Línea base continua de cota */}
              <line
                x1={0}
                y1={elevation.dimensionLine.y}
                x2={elevation.lengthM}
                y2={elevation.dimensionLine.y}
                stroke={WALL_ELEVATION_STYLE.dimension}
                strokeWidth={0.004}
              />
              {/* Tics y textos parciales de cota */}
              {elevation.dimensionChain.map((seg, sIdx) => (
                <g key={sIdx}>
                  {/* Tic inicial */}
                  <line
                    x1={seg.x1}
                    y1={elevation.dimensionLine.tickY1}
                    x2={seg.x1}
                    y2={elevation.dimensionLine.tickY2}
                    stroke={WALL_ELEVATION_STYLE.dimension}
                    strokeWidth={0.004}
                  />
                  {/* Tic final */}
                  <line
                    x1={seg.x2}
                    y1={elevation.dimensionLine.tickY1}
                    x2={seg.x2}
                    y2={elevation.dimensionLine.tickY2}
                    stroke={WALL_ELEVATION_STYLE.dimension}
                    strokeWidth={0.004}
                  />
                  {/* Rótulo de distancia en metros */}
                  <text
                    x={seg.cx}
                    y={elevation.dimensionLine.textY}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fontSize={WALL_ELEVATION_CONSTANTS.ANNOTATION_FONT_SIZE_M}
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill={WALL_ELEVATION_STYLE.dimension}
                  >
                    {seg.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* ─── PANEL LATERAL / DRAWER DE INSPECCIÓN DE ALZADO ─── */}
        <aside className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 overflow-y-auto text-slate-200">
          {/* CASO A: Caja o Gabinete Seleccionado */}
          {selectedBox ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-100">
                      {selectedBox.kind === 'panel' ? 'Tablero Eléctrico' : 'Caja de Instalación'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {selectedBox.label || selectedBox.id.slice(-6)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors text-[10px]"
                >
                  Deseleccionar
                </button>
              </div>

              {/* Datos físicos de catálogo */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-2.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Tipo de Contenedor:</span>
                  <span className="font-medium text-slate-200 text-[11px] truncate max-w-[140px]">
                    {selectedBox.boxTypeName || selectedBox.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Dimensiones Reales:</span>
                  <span className="font-mono text-slate-200 text-[11px]">{selectedBox.sizeLabel}</span>
                </div>
              </div>

              {/* Posición Métrica: X desde esquina y Altura Z */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <MoveHorizontal size={13} className="text-blue-400" />
                      Distancia a Esquina Izquierda (X)
                    </span>
                    <span className="font-mono text-blue-400">{selectedBox.centerX.toFixed(2)} m</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={elevation.lengthM}
                      value={selectedBox.centerX.toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isNaN(val)) setSelectedBoxX(val);
                      }}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(-0.05, 0)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300"
                    >
                      -5cm
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(0.05, 0)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300"
                    >
                      +5cm
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <MoveVertical size={13} className="text-blue-400" />
                      Altura de Montaje sobre NPT (Z)
                    </span>
                    <span className="font-mono text-blue-400">{selectedBox.centerZ.toFixed(2)} m</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={elevation.wallHeightM}
                      value={selectedBox.centerZ.toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isNaN(val)) setSelectedBoxZ(val);
                      }}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(0, -0.05)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300"
                    >
                      -5cm
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(0, 0.05)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300"
                    >
                      +5cm
                    </button>
                  </div>
                </div>
              </div>

              {/* Presets Rápidos de Altura según AEA */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                  Presets de Altura Reglamentaria AEA
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {heightPresets.map((hp) => {
                    const isCurrent = Math.abs(selectedBox.centerZ - hp.meters) < 0.02;
                    return (
                      <button
                        key={hp.id}
                        type="button"
                        onClick={() => setSelectedBoxZ(hp.meters)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-colors flex items-center justify-between ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span className="truncate">{hp.label}</span>
                        <span className="font-mono text-[10px] opacity-80">{hp.meters.toFixed(2)}m</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : selectedOpening ? (
            /* CASO B: Abertura Seleccionada */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-600/30 text-amber-400 rounded-lg">
                    <DoorOpen size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-100">
                      {selectedOpening.type === 'door'
                        ? 'Puerta'
                        : selectedOpening.type === 'window'
                        ? 'Ventana'
                        : 'Vano Libre'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {selectedOpening.label || selectedOpening.id.slice(-6)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors text-[10px]"
                >
                  Deseleccionar
                </button>
              </div>

              {/* Ancho del Vano */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Ancho Libre del Vano</span>
                  <span className="font-mono text-amber-400">{selectedOpening.width.toFixed(2)} m</span>
                </div>
                <input
                  type="number"
                  step={0.05}
                  min={0.3}
                  value={selectedOpening.width.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) patchSelectedOpening({ width: val });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Altura del Vano */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Altura del Vano (Dintel)</span>
                  <span className="font-mono text-amber-400">{selectedOpening.height.toFixed(2)} m</span>
                </div>
                <input
                  type="number"
                  step={0.05}
                  min={0.3}
                  value={selectedOpening.height.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) patchSelectedOpening({ height: val });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Antepecho */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Antepecho sobre NPT</span>
                  <span className="font-mono text-amber-400">{selectedOpening.sill.toFixed(2)} m</span>
                </div>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={selectedOpening.sill.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) patchSelectedOpening({ sill: val });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            /* CASO C: Información General del Muro y Leyenda */
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="font-bold text-xs text-slate-100 mb-0.5">Paramento en Inspección</h3>
                <p className="text-[11px] text-slate-400">
                  Seleccioná o arrastrá cualquier caja en la vista para reubicarla métricamente.
                </p>
              </div>

              {/* Tarjeta de métricas del muro */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Longitud total:</span>
                  <span className="font-bold font-mono text-slate-100">{elevation.lengthM.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Altura constructiva:</span>
                  <span className="font-bold font-mono text-slate-100">{elevation.wallHeightM.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Espesor:</span>
                  <span className="font-bold font-mono text-slate-100">{wall.thickness.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cajas en esta cara:</span>
                  <span className="font-bold font-mono text-blue-400">{elevation.boxes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Aberturas:</span>
                  <span className="font-bold font-mono text-amber-400">{elevation.openings.length}</span>
                </div>
              </div>

              {/* Tips interactivos */}
              <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 text-[11px] text-blue-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-200">
                  <Info size={14} />
                  <span>Edición Interactiva</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                  <li>Arrastrá cajas para desplazarlas; se imantan a alturas AEA (0.30m, 1.10m, 2.20m).</li>
                  <li>Usá la rueda del mouse o los botones superiores para hacer zoom y paneo libre.</li>
                  <li>Los cambios en este alzado impactan de inmediato en la planta y en el cómputo métrico.</li>
                </ul>
              </div>

              {/* Botón rápido para alternar cara */}
              <button
                type="button"
                onClick={() => setFace(face === 'left' ? 'right' : 'left')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeftRight size={14} />
                <span>Ver Cara Opuesta</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
