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
 * - Rotación de cajas (0° vertical / 90° horizontal) con cambio de dimensiones reales.
 * - Modo responsivo para celulares con gestos multitáctiles (pinch zoom y pan),
 *   botones de encuadre al muro y cajón de inspección ergonómico inferior.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  useWallElevationViewModel
} from '../../../viewmodels/useWallElevationViewModel';
import { WALL_ELEVATION_STYLE } from '../../../models/architecture/wallElevationStyle';
import { WALL_ELEVATION_CONSTANTS, toDrawingY } from '../../../models/architecture/wallElevation';
import {
  X,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Ruler,
  Layers,
  ArrowLeftRight,
  MoveHorizontal,
  MoveVertical,
  DoorOpen,
  Info,
  RotateCw,
  Focus,
  Zap,
  Cable,
  Trash2
} from 'lucide-react';
import { ConduitModal } from '../electrical/ConduitModal';

export const WallElevationModal: React.FC = () => {
  const {
    isOpen,
    wall,
    face,
    faceOptions,
    elevation,
    displayBoxes,
    displayConduits,
    guideY,
    isDragging,
    isGripDragging,
    selection,
    selectedBox,
    selectedOpening,
    selectedConduit,
    selectedConduitMetric,
    routeGrips,
    conduitPresetOptions,
    heightPresets,
    viewBoxAttribute,
    close,
    setFace,
    selectBox,
    selectOpening,
    selectConduit,
    clearSelection,
    beginBoxDrag,
    moveBoxDrag,
    endBoxDrag,
    cancelBoxDrag,
    setConduitPreset,
    resetConduitRoute,
    beginRoutePointDrag,
    moveRoutePointDrag,
    endRoutePointDrag,
    cancelRoutePointDrag,
    setSelectedBoxX,
    setSelectedBoxZ,
    nudgeSelectedBox,
    rotateSelectedBox,
    setBoxOrientation,
    patchSelectedOpening,
    zoomIn,
    zoomOut,
    zoomAt,
    wheelZoomFactor,
    fit,
    fitWall,
    panBy,
    placementTool,
    placementPreview,
    startPlacement,
    cancelPlacement,
    updatePlacementPreview,
    commitPlacement,
    openingPlacementTool,
    openingPlacementPreview,
    startOpeningPlacement,
    cancelOpeningPlacement,
    updateOpeningPlacementPreview,
    commitOpeningPlacement,
    availablePlacementSymbols,
    availableCircuits,
    cabinetSizePresets,
    setPanelDimensions,
    boxTypes,
    openingTypes,
    setElementBoxType,
    applyOpeningPreset,
    formatConduitSize,
    nudgeSelectedConduitHeight,
    setSelectedConduitHeight,
    deleteConduit,
    rawSelectedConduit,
    autoConnectConduits,
    setAutoConnectConduits,
    resetSequence,
    lastPlacedElementId,
    isConnectingConduit,
    conduitSourceBoxId,
    startConduitConnection,
    cancelConduitConnection,
    handleBoxClickInConnectMode
  } = useWallElevationViewModel();

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Estado y referencias para gestos multitáctiles en pantallas móviles (Pinch-to-zoom y pan táctil)
  const touchStateRef = useRef<{
    type: 'single' | 'pinch';
    startX: number;
    startY: number;
    startDist?: number;
    startCenter?: { x: number; y: number };
  } | null>(null);

  const [isPlacementMenuOpen, setIsPlacementMenuOpen] = useState(false);
  const [isOpeningPlacementMenuOpen, setIsOpeningPlacementMenuOpen] = useState(false);
  const [isConduitModalOpen, setIsConduitModalOpen] = useState(false);
  const [placementCircuitId, setPlacementCircuitId] = useState<string | null>(null);
  const [pointerWorld, setPointerWorld] = useState<{ x: number; y: number } | null>(null);
  const [mobileSheetMode, setMobileSheetMode] = useState<'none' | 'add_box' | 'add_opening' | 'info'>('none');
  const [boxCategoryTab, setBoxCategoryTab] = useState<'tomas' | 'llaves' | 'tableros' | 'paso' | 'apliques'>('tomas');
  const [openingCategoryTab, setOpeningCategoryTab] = useState<'door' | 'window' | 'passage'>('door');

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConnectingConduit) {
          cancelConduitConnection();
          setPointerWorld(null);
        } else if (placementTool) {
          cancelPlacement();
        } else if (openingPlacementTool) {
          cancelOpeningPlacement();
        } else if (isPlacementMenuOpen) {
          setIsPlacementMenuOpen(false);
        } else if (isOpeningPlacementMenuOpen) {
          setIsOpeningPlacementMenuOpen(false);
        } else if (mobileSheetMode !== 'none') {
          setMobileSheetMode('none');
        } else if (isDragging) {
          cancelBoxDrag();
        } else if (isGripDragging) {
          cancelRoutePointDrag();
        } else {
          close();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isConnectingConduit,
    cancelConduitConnection,
    placementTool,
    openingPlacementTool,
    isPlacementMenuOpen,
    isOpeningPlacementMenuOpen,
    mobileSheetMode,
    isDragging,
    isGripDragging,
    cancelPlacement,
    cancelOpeningPlacement,
    cancelBoxDrag,
    cancelRoutePointDrag,
    close
  ]);

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

  // Gestos táctiles nativos para celulares (1 dedo = pan / drag; 2 dedos = pinch to zoom)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midClientX = (t1.clientX + t2.clientX) / 2;
        const midClientY = (t1.clientY + t2.clientY) / 2;
        const worldCenter = clientToWorld(midClientX, midClientY);
        touchStateRef.current = {
          type: 'pinch',
          startX: midClientX,
          startY: midClientY,
          startDist: dist,
          startCenter: worldCenter ?? undefined
        };
      } else if (e.touches.length === 1 && !isDragging && !isGripDragging) {
        const t = e.touches[0];
        touchStateRef.current = {
          type: 'single',
          startX: t.clientX,
          startY: t.clientY
        };
      }
    },
    [clientToWorld, isDragging, isGripDragging]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (isGripDragging) {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const world = clientToWorld(t.clientX, t.clientY);
          if (world) moveRoutePointDrag(world);
        }
        return;
      }
      if (isDragging) {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const world = clientToWorld(t.clientX, t.clientY);
          if (world) moveBoxDrag(world);
        }
        return;
      }
      if (!touchStateRef.current) return;
      if (e.touches.length === 2 && touchStateRef.current.type === 'pinch') {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const startDist = touchStateRef.current.startDist || currentDist;
        if (startDist > 0 && Math.abs(currentDist - startDist) > 2) {
          const factor = currentDist / startDist;
          zoomAt(factor, touchStateRef.current.startCenter);
          touchStateRef.current.startDist = currentDist;
        }
      } else if (e.touches.length === 1 && touchStateRef.current.type === 'single') {
        const t = e.touches[0];
        const dxPx = t.clientX - touchStateRef.current.startX;
        const dyPx = t.clientY - touchStateRef.current.startY;
        touchStateRef.current.startX = t.clientX;
        touchStateRef.current.startY = t.clientY;
        const svg = svgRef.current;
        if (!svg) return;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const dxM = dxPx / ctm.a;
        const dyM = dyPx / ctm.d;
        panBy(dxM, dyM);
      }
    },
    [isGripDragging, isDragging, clientToWorld, moveRoutePointDrag, moveBoxDrag, zoomAt, panBy]
  );

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = null;
    if (isGripDragging) {
      endRoutePointDrag();
    }
    if (isDragging) {
      endBoxDrag();
    }
  }, [isGripDragging, isDragging, endRoutePointDrag, endBoxDrag]);

  // Paneo sobre el fondo del lienzo SVG (con Mouse / Pointer)
  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (placementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) commitPlacement(world);
        return;
      }
      if (openingPlacementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) commitOpeningPlacement(world);
        return;
      }
      if (isConnectingConduit) {
        cancelConduitConnection();
        setPointerWorld(null);
        return;
      }
      if (e.pointerType === 'touch') return;
      if (e.target !== svgRef.current && (e.target as Element).id !== 'elevation-backdrop') return;
      clearSelection();
      isPanningRef.current = true;
      panStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [
      placementTool,
      openingPlacementTool,
      isConnectingConduit,
      cancelConduitConnection,
      clientToWorld,
      commitPlacement,
      commitOpeningPlacement,
      clearSelection
    ]
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isConnectingConduit) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) setPointerWorld(world);
      }
      if (placementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) updatePlacementPreview(world);
        return;
      }
      if (openingPlacementTool) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) updateOpeningPlacementPreview(world);
        return;
      }
      if (isDragging) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) moveBoxDrag(world);
        return;
      }
      if (isGripDragging) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) moveRoutePointDrag(world);
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
    [
      isConnectingConduit,
      placementTool,
      openingPlacementTool,
      isDragging,
      isGripDragging,
      clientToWorld,
      updatePlacementPreview,
      updateOpeningPlacementPreview,
      moveBoxDrag,
      moveRoutePointDrag,
      panBy
    ]
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isDragging) {
        endBoxDrag();
      }
      if (isGripDragging) {
        endRoutePointDrag();
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
    [isDragging, isGripDragging, endBoxDrag, endRoutePointDrag]
  );

  const handleSvgDoubleClick = useCallback(() => {
    fitWall();
  }, [fitWall]);

  if (!isOpen || !wall || !elevation) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wall-elevation-title"
      className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-150"
    >
      {/* ─── BARRA SUPERIOR / CABECERA ─── */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 text-white shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
            <Ruler size={16} className="sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 id="wall-elevation-title" className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                Alzado de Muro
              </h2>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1 py-0.5 rounded border border-slate-700 shrink-0">
                {wall.id.slice(-6)}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              L: {elevation.lengthM.toFixed(2)}m · H: {elevation.wallHeightM.toFixed(2)}m
              {elevation.ceilingZ !== elevation.wallHeightM && ` · Cielorraso: ${elevation.ceilingZ.toFixed(2)}m`}
            </p>
          </div>
        </div>

        {/* Selector de Paramento */}
        {/* Móvil: botón compacto toggle */}
        <button
          type="button"
          onClick={() => setFace(face === 'left' ? 'right' : 'left')}
          className="sm:hidden px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
          title="Alternar cara opuesta"
        >
          <Layers size={13} className="text-blue-400" />
          <span className="truncate max-w-[80px]">{face === 'left' ? 'Cara Izq.' : 'Cara Der.'}</span>
        </button>

        {/* Escritorio: selector expandido con 2 opciones */}
        <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5 sm:p-1 gap-1 text-[11px] sm:text-xs font-semibold shrink-0">
          {faceOptions.map((opt) => (
            <button
              key={opt.face}
              type="button"
              onClick={() => setFace(opt.face)}
              className={`px-2 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 ${
                face === opt.face
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Layers size={12} className="sm:w-[13px] sm:h-[13px]" />
              <span className="max-w-[70px] sm:max-w-[140px] truncate">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Indicador de Colocación Activa en Cabecera */}
        {(placementTool || openingPlacementTool) && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-bold shrink-0">
            <span className="truncate max-w-[90px] sm:max-w-none">
              {placementTool ? 'Colocando boca...' : 'Colocando vano...'}
            </span>
            {placementTool && (
              <button
                type="button"
                onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors border ${
                  autoConnectConduits
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
                title={
                  autoConnectConduits
                    ? 'Conectar cajas consecutivas con cañería (activo)'
                    : 'Colocar cajas aisladas sin cañería'
                }
              >
                <Cable size={11} />
                <span>{autoConnectConduits ? 'Cañería: Sí' : 'Cañería: No'}</span>
              </button>
            )}
            {placementTool && autoConnectConduits && lastPlacedElementId && (
              <button
                type="button"
                onClick={resetSequence}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                title="Desvincular boca previa (inicia nueva secuencia limpia)"
              >
                Desvincular
              </button>
            )}
            <button
              type="button"
              onClick={cancelPlacement}
              className="p-1 hover:bg-amber-500/30 rounded-lg text-amber-200 transition-colors"
              title="Cancelar colocación (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Indicador de Trazado de Conducto Activo en Cabecera */}
        {isConnectingConduit && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-xl text-[11px] font-bold shrink-0 animate-in fade-in">
            <Cable size={12} className="animate-pulse text-cyan-300" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              {!conduitSourceBoxId ? 'Trazar cañería: 1. Elegí origen' : 'Trazar cañería: 2. Elegí destino'}
            </span>
            <button
              type="button"
              onClick={() => {
                cancelConduitConnection();
                setPointerWorld(null);
              }}
              className="p-1 hover:bg-blue-500/30 rounded-lg text-blue-200 transition-colors"
              title="Cancelar trazado (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Botones de Colocación para Escritorio */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {/* Botón Desktop ☍ Conectar */}
          {!placementTool && !openingPlacementTool && (
            <button
              type="button"
              onClick={() => {
                if (isConnectingConduit) {
                  cancelConduitConnection();
                  setPointerWorld(null);
                } else {
                  startConduitConnection(selectedBox?.id);
                }
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${
                isConnectingConduit
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-blue-600/80 hover:bg-blue-600 text-blue-100 hover:text-white border border-blue-500/30'
              }`}
              title="Trazar cañería entre dos cajas en este muro"
            >
              <Cable size={14} />
              <span>☍ Conectar</span>
            </button>
          )}

          {/* Botón Desktop + Boca */}
          {!placementTool && !openingPlacementTool && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsPlacementMenuOpen((v) => !v);
                  setIsOpeningPlacementMenuOpen(false);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  isPlacementMenuOpen
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-600/80 hover:bg-emerald-600 text-emerald-100 hover:text-white border border-emerald-500/30'
                }`}
                title="Agregar nueva boca o tablero en este muro"
              >
                <Plus size={14} />
                <span>+ Boca</span>
              </button>

              {isPlacementMenuOpen && (
                <div className="absolute top-full mt-2 right-0 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-50 text-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-100">Agregar elemento en muro</span>
                    <button
                      type="button"
                      onClick={() => setIsPlacementMenuOpen(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>

                    <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Circuito asignado:
                    </label>
                    <select
                      value={placementCircuitId ?? ''}
                      onChange={(e) => setPlacementCircuitId(e.target.value ? e.target.value : null)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Por defecto / Automático</option>
                      {availableCircuits.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                    <div className="flex items-center gap-2">
                      <Cable size={14} className={autoConnectConduits ? 'text-blue-400' : 'text-slate-500'} />
                      <div>
                        <span className="font-semibold text-slate-200 block text-[11px]">Conectar con cañería</span>
                        <span className="text-[9px] text-slate-400 block">
                          {autoConnectConduits ? 'Enlaza con boca previa' : 'Cajas independientes'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        autoConnectConduits ? 'bg-blue-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                          autoConnectConduits ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Seleccionar tipo de elemento:
                    </label>
                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                      {availablePlacementSymbols.map((sym) => (
                        <button
                          key={sym.id}
                          type="button"
                          onClick={() => {
                            startPlacement(sym.id, placementCircuitId);
                            setIsPlacementMenuOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs bg-slate-800/60 hover:bg-emerald-600 hover:text-white border border-slate-700/60 transition-colors flex items-center justify-between group"
                        >
                          <span className="font-semibold truncate">{sym.label}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-700/80 group-hover:bg-emerald-700 text-slate-300 group-hover:text-white shrink-0 ml-1">
                            {sym.id.includes('tp') || sym.id.includes('ts') || sym.id.includes('medidor')
                              ? 'Tablero'
                              : sym.id.includes('toma')
                              ? 'Toma'
                              : sym.id.includes('llave')
                              ? 'Llave'
                              : 'Boca'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón Desktop + Abertura */}
          {!placementTool && !openingPlacementTool && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpeningPlacementMenuOpen((v) => !v);
                  setIsPlacementMenuOpen(false);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  isOpeningPlacementMenuOpen
                    ? 'bg-amber-500 text-slate-900 font-extrabold'
                    : 'bg-amber-600/80 hover:bg-amber-600 text-amber-100 hover:text-white border border-amber-500/30'
                }`}
                title="Agregar nueva puerta, ventana o vano en este muro"
              >
                <DoorOpen size={14} />
                <span>+ Abertura</span>
              </button>

              {isOpeningPlacementMenuOpen && (
                <div className="absolute top-full mt-2 right-0 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-50 text-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-100">Agregar abertura en muro</span>
                    <button
                      type="button"
                      onClick={() => setIsOpeningPlacementMenuOpen(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-slate-800 p-0.5 rounded-xl text-[11px] font-semibold text-center">
                    {(['door', 'window', 'passage'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setOpeningCategoryTab(cat)}
                        className={`py-1 rounded-lg transition-colors ${
                          openingCategoryTab === cat
                            ? 'bg-amber-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'door' ? 'Puertas' : cat === 'window' ? 'Ventanas' : 'Vanos'}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {openingTypes
                      .filter((p) => p.type === openingCategoryTab)
                      .map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            startOpeningPlacement(preset.id);
                            setIsOpeningPlacementMenuOpen(false);
                          }}
                          className="w-full text-left p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 hover:border-amber-500/50 transition-all group flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                              {preset.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {preset.width.toFixed(2)}m × {preset.height.toFixed(2)}m
                              {preset.sill > 0 ? ` · Antepecho +${preset.sill.toFixed(2)}m` : ' · NPT 0.00m'}
                            </div>
                          </div>
                          <Plus size={14} className="text-slate-400 group-hover:text-amber-400 shrink-0" />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles de Vista y Botón Cerrar */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5">
            <button
              type="button"
              onClick={zoomIn}
              className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Acercar"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Alejar"
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              onClick={fitWall}
              className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 border border-blue-500/30"
              title="Enfocar alzado del muro al ancho de pantalla"
            >
              <Focus size={13} />
              <span>Muro</span>
            </button>
            <button
              type="button"
              onClick={fit}
              className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Ajustar encuadre general (Fit)"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={close}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-0.5"
            title="Cerrar alzado (Esc)"
          >
            <X size={18} className="sm:w-[20px] sm:h-[20px]" />
          </button>
        </div>
      </header>

      {/* ─── CUERPO PRINCIPAL (LIENZO CAD + PANEL DE INSPECCIÓN) ─── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-slate-950 relative">
        {/* Lienzo SVG CAD 2D */}
        <div className="flex-1 relative min-h-0 overflow-hidden bg-slate-950 flex items-center justify-center touch-none">
          {/* Botonera flotante en lienzo para celular y escritorio */}
          <div className="absolute top-3 left-3 z-20 flex items-center bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-1 gap-1 shadow-lg">
            <button
              type="button"
              onClick={fitWall}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Enfocar muro completo en pantalla"
            >
              <Focus size={13} />
              <span>Ajustar Muro</span>
            </button>
            <button
              type="button"
              onClick={fit}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-[11px] font-semibold transition-all"
              title="Ver cotas generales y cielorraso"
            >
              General
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={viewBoxAttribute}
            preserveAspectRatio="xMidYMid meet"
            style={{ touchAction: 'none' }}
            className={`w-full h-full touch-none ${
              placementTool ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            } outline-none select-none`}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onDoubleClick={handleSvgDoubleClick}
          >
            <defs>
              <pattern id="elevation-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
                <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="#1e293b" strokeWidth="0.005" />
              </pattern>
            </defs>

            {/* Fondo de captura de clics y paneo */}
            <rect
              id="elevation-backdrop"
              x={elevation.bounds.x - 30}
              y={elevation.bounds.y - 30}
              width={elevation.bounds.width + 60}
              height={elevation.bounds.height + 60}
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
            {displayConduits.map((c) => {
              const isSelectedConduit = selection?.type === 'conduit' && selection.id === c.id;
              return (
                <g key={c.id}>
                  {/* Hitbox táctil invisible para toque fácil en celular y mouse */}
                  {c.segments.map((seg, sIdx) => {
                    const dStr =
                      c.svgPaths?.[sIdx] ??
                      seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    return (
                      <path
                        key={`hit-${sIdx}`}
                        d={dStr}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(c.widthM + 0.08, 0.08)}
                        pointerEvents="stroke"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectConduit(c.id);
                        }}
                      />
                    );
                  })}

                  {/* Renderizado visual de canalización (Curvas conformadas reglamentarias para caños) */}
                  {c.segments.map((seg, sIdx) => {
                    const dStr =
                      c.svgPaths?.[sIdx] ??
                      seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    return (
                      <g key={sIdx} className="pointer-events-none">
                        {/* Halo de selección */}
                        {isSelectedConduit && (
                          <path
                            d={dStr}
                            fill="none"
                            stroke={WALL_ELEVATION_STYLE.selection.halo}
                            strokeWidth={c.widthM + 0.02}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {/* Borde exterior */}
                        <path
                          d={dStr}
                          fill="none"
                          stroke={isSelectedConduit ? WALL_ELEVATION_STYLE.selection.stroke : WALL_ELEVATION_STYLE.conduit.outline}
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
                </g>
              );
            })}

            {/* Grips interactivos de recorrido cuando hay un conducto seleccionado */}
            {selection?.type === 'conduit' &&
              routeGrips.map((grip) => (
                <g
                  key={`grip-${grip.index}`}
                  className={grip.isEndpoint ? 'pointer-events-none' : 'cursor-move touch-none'}
                  onPointerDown={(e) => {
                    if (grip.isEndpoint || !selectedConduit) return;
                    e.stopPropagation();
                    try {
                      (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    } catch {
                      // Ignorar si el navegador no soporta captura en SVG
                    }
                    beginRoutePointDrag(selectedConduit.id, grip.index);
                  }}
                  onTouchStart={(e) => {
                    if (grip.isEndpoint || !selectedConduit) return;
                    e.stopPropagation();
                    beginRoutePointDrag(selectedConduit.id, grip.index);
                  }}
                >
                  {/* Hitbox ultra-generosa para operación con pulgar en celulares (r=0.22m) */}
                  <circle
                    cx={grip.x}
                    cy={grip.y}
                    r={grip.isEndpoint ? 0.04 : 0.22}
                    fill="transparent"
                    pointerEvents={grip.isEndpoint ? 'none' : 'all'}
                  />
                  {/* Anillo halo exterior pulsante para nodos intermedios arrastrables */}
                  {!grip.isEndpoint && (
                    <circle
                      cx={grip.x}
                      cy={grip.y}
                      r={isGripDragging ? 0.08 : 0.06}
                      fill={isGripDragging ? '#f59e0b' : '#3b82f6'}
                      fillOpacity={0.25}
                      stroke={isGripDragging ? '#fbbf24' : '#60a5fa'}
                      strokeWidth={0.006}
                      strokeDasharray="0.02 0.015"
                      className="pointer-events-none animate-pulse"
                    />
                  )}
                  {/* Núcleo visual del grip */}
                  <circle
                    cx={grip.x}
                    cy={grip.y}
                    r={grip.isEndpoint ? 0.014 : isGripDragging ? 0.042 : 0.032}
                    fill={grip.isEndpoint ? '#64748b' : isGripDragging ? '#d97706' : '#2563eb'}
                    stroke="#ffffff"
                    strokeWidth={0.006}
                    className="pointer-events-none"
                  />
                  {/* Etiqueta flotante de cota en tiempo real sobre el nodo */}
                  {!grip.isEndpoint && (
                    <text
                      x={grip.x}
                      y={grip.y - 0.065}
                      textAnchor="middle"
                      dominantBaseline="auto"
                      fontSize={0.075}
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={isGripDragging ? '#fbbf24' : '#60a5fa'}
                      stroke="#0f172a"
                      strokeWidth={0.02}
                      paintOrder="stroke"
                      className="pointer-events-none select-none"
                    >
                      {grip.z.toFixed(2)}m
                    </text>
                  )}
                </g>
              ))}

            {/* 4.5. Línea elástica / Rubberband durante trazado interactivo de conductos */}
            {isConnectingConduit && conduitSourceBoxId && pointerWorld && (() => {
              const src = displayBoxes.find((b) => b.id === conduitSourceBoxId);
              if (!src) return null;
              const srcCenterY = src.rect.y + src.rect.height / 2;
              return (
                <g className="pointer-events-none">
                  <line
                    x1={src.centerX}
                    y1={srcCenterY}
                    x2={pointerWorld.x}
                    y2={pointerWorld.y}
                    stroke="#38bdf8"
                    strokeWidth={0.02}
                    strokeOpacity={0.4}
                    strokeLinecap="round"
                  />
                  <line
                    x1={src.centerX}
                    y1={srcCenterY}
                    x2={pointerWorld.x}
                    y2={pointerWorld.y}
                    stroke="#0284c7"
                    strokeWidth={0.01}
                    strokeDasharray="0.04 0.02"
                    strokeLinecap="round"
                  />
                </g>
              );
            })()}

            {/* 5. Cajas Eléctricas y Gabinetes a Escala 1:1 */}
            {displayBoxes.map((b) => {
              const isSelected = selection?.type === 'box' && selection.id === b.id;
              const isSourceBox = isConnectingConduit && conduitSourceBoxId === b.id;
              const isConnectTargetCandidate = isConnectingConduit && conduitSourceBoxId !== b.id;
              const paint =
                b.shape === 'cabinet' ? WALL_ELEVATION_STYLE.box.cabinet : WALL_ELEVATION_STYLE.box.default;

              return (
                <g
                  key={b.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (isConnectingConduit) {
                      handleBoxClickInConnectMode(b.id);
                      return;
                    }
                    const world = clientToWorld(e.clientX, e.clientY);
                    if (world) beginBoxDrag(b.id, world);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isConnectingConduit) {
                      handleBoxClickInConnectMode(b.id);
                      return;
                    }
                    selectBox(b.id);
                  }}
                  className={isConnectingConduit ? 'cursor-pointer group' : 'cursor-grab active:cursor-grabbing group'}
                >
                  {/* Hitbox táctil invisible ampliada para toque cómodo con el dedo en celular */}
                  <rect
                    x={b.rect.x - 0.08}
                    y={b.rect.y - 0.08}
                    width={b.rect.width + 0.16}
                    height={b.rect.height + 0.16}
                    fill="transparent"
                    pointerEvents="all"
                    className="cursor-pointer"
                  />

                  {/* Halo de caja origen de conexión activa (pulsante cyan) */}
                  {isSourceBox && (
                    <rect
                      x={b.rect.x - 0.03}
                      y={b.rect.y - 0.03}
                      width={b.rect.width + 0.06}
                      height={b.rect.height + 0.06}
                      fill="#0284c7"
                      fillOpacity={0.25}
                      stroke="#38bdf8"
                      strokeWidth={0.016}
                      strokeDasharray="0.03 0.015"
                      className="animate-pulse"
                      rx={0.015}
                    />
                  )}

                  {/* Halo indicador de destino conectable */}
                  {isConnectTargetCandidate && (
                    <rect
                      x={b.rect.x - 0.02}
                      y={b.rect.y - 0.02}
                      width={b.rect.width + 0.04}
                      height={b.rect.height + 0.04}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={0.01}
                      strokeDasharray="0.02 0.02"
                      opacity={0.7}
                      rx={0.01}
                    />
                  )}

                  {/* Halo de selección */}
                  {!isConnectingConduit && isSelected && (
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

            {/* Previsualización fantasma de colocación interactiva de boca o tablero con snap */}
            {placementPreview &&
              (() => {
                const isPanelPrev =
                  placementPreview.symbolId.includes('tablero') ||
                  placementPreview.symbolId.includes('tp') ||
                  placementPreview.symbolId.includes('ts') ||
                  placementPreview.symbolId.includes('medidor');
                const w = isPanelPrev ? 0.30 : 0.10;
                const h = isPanelPrev ? 0.40 : 0.10;
                const y = toDrawingY(placementPreview.z, elevation.drawingHeightM) - h / 2;
                return (
                  <g className="pointer-events-none">
                    <rect
                      x={placementPreview.x - w / 2}
                      y={y}
                      width={w}
                      height={h}
                      fill="rgba(56, 189, 248, 0.25)"
                      stroke="#38bdf8"
                      strokeWidth={0.006}
                      strokeDasharray="0.02 0.01"
                      rx={isPanelPrev ? 0.015 : 0.005}
                    />
                    <text
                      x={placementPreview.x}
                      y={y + h / 2 + 0.015}
                      textAnchor="middle"
                      fontSize={0.045}
                      fontWeight="bold"
                      fill="#38bdf8"
                    >
                      +{placementPreview.z.toFixed(2)}m
                    </text>
                  </g>
                );
              })()}

            {/* Previsualización fantasma de inserción de abertura en el muro */}
            {openingPlacementPreview && (
              <g className="pointer-events-none">
                <rect
                  x={openingPlacementPreview.xLeft}
                  y={toDrawingY(
                    openingPlacementPreview.sill + openingPlacementPreview.height,
                    elevation.drawingHeightM
                  )}
                  width={openingPlacementPreview.width}
                  height={openingPlacementPreview.height}
                  fill="rgba(245, 158, 11, 0.20)"
                  stroke="#f59e0b"
                  strokeWidth={0.015}
                  strokeDasharray="0.04 0.02"
                />
                <rect
                  x={openingPlacementPreview.xLeft}
                  y={toDrawingY(
                    openingPlacementPreview.sill + openingPlacementPreview.height,
                    elevation.drawingHeightM
                  )}
                  width={openingPlacementPreview.width}
                  height={0.025}
                  fill="#f59e0b"
                  opacity={0.8}
                />
                <text
                  x={openingPlacementPreview.xLeft + openingPlacementPreview.width / 2}
                  y={toDrawingY(
                    openingPlacementPreview.sill + openingPlacementPreview.height / 2,
                    elevation.drawingHeightM
                  )}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={0.065}
                  fontWeight="bold"
                  fill="#fbbf24"
                  fontFamily="sans-serif"
                >
                  {openingPlacementPreview.name}
                </text>
                <text
                  x={openingPlacementPreview.xLeft + openingPlacementPreview.width / 2}
                  y={
                    toDrawingY(
                      openingPlacementPreview.sill + openingPlacementPreview.height / 2,
                      elevation.drawingHeightM
                    ) + 0.065
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={0.045}
                  fontWeight="bold"
                  fill="#fde68a"
                  fontFamily="monospace"
                >
                  {openingPlacementPreview.width.toFixed(2)}m × {openingPlacementPreview.height.toFixed(2)}m (sill: +{openingPlacementPreview.sill.toFixed(2)}m)
                </text>
              </g>
            )}

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

        {/* ─── CAJÓN INFERIOR PARA CELULARES (COMPACTO Y ERGONÓMICO) ─── */}
        <div className="lg:hidden shrink-0 bg-slate-900 border-t border-slate-800 text-slate-200">
          {isConnectingConduit ? (
            <div className="p-3 bg-blue-950/80 border-t border-blue-500/40 text-blue-200 flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg shrink-0 animate-pulse">
                  <Cable size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {!conduitSourceBoxId ? 'Trazar Cañería: Paso 1' : 'Trazar Cañería: Paso 2'}
                  </div>
                  <div className="text-[10px] text-blue-300 truncate">
                    {!conduitSourceBoxId
                      ? 'Tocá la caja de origen en la pared'
                      : 'Tocá la caja de destino para unir con caño'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  cancelConduitConnection();
                  setPointerWorld(null);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0"
              >
                <X size={14} />
                <span>Cancelar</span>
              </button>
            </div>
          ) : placementTool ? (
            <div className="p-3 bg-emerald-950/70 border-t border-emerald-500/40 text-emerald-200 flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg shrink-0 animate-pulse">
                  <Zap size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Colocando en muro
                  </div>
                  <div className="text-[10px] text-emerald-300 truncate">
                    Tocá la pared para ubicar · Snap a cotas AEA
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition-colors ${
                    autoConnectConduits
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                  title={autoConnectConduits ? 'Conectar cañería: Sí' : 'Conectar cañería: No'}
                >
                  <Cable size={12} />
                  <span>{autoConnectConduits ? 'Cañería: Sí' : 'Cañería: No'}</span>
                </button>
                <button
                  type="button"
                  onClick={cancelPlacement}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0"
                >
                  <X size={14} />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          ) : openingPlacementTool ? (
            <div className="p-3 bg-amber-950/70 border-t border-amber-500/40 text-amber-200 flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 animate-pulse">
                  <DoorOpen size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Colocando abertura
                  </div>
                  <div className="text-[10px] text-amber-300 truncate">
                    Tocá la pared para ubicar el vano
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelOpeningPlacement}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0"
              >
                <X size={14} />
                <span>Cancelar</span>
              </button>
            </div>
          ) : selectedBox ? (
            <div className="p-3 space-y-2.5 max-h-[46vh] overflow-y-auto">
              {/* Cabecera de la caja seleccionada con botón Rotar 90° inmediato */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 bg-blue-600/30 text-blue-400 rounded-lg shrink-0">
                    <Layers size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-slate-100 truncate">
                        {selectedBox.kind === 'panel' ? 'Tablero' : 'Caja'}
                      </h4>
                      <span className="font-mono text-[10px] text-blue-400">
                        {selectedBox.label || selectedBox.id.slice(-6)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block">
                      {selectedBox.sizeLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startConduitConnection(selectedBox.id)}
                    className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform"
                    title="Trazar cañería desde esta caja a otra"
                  >
                    <Cable size={13} />
                    <span>Conectar</span>
                  </button>
                  <button
                    type="button"
                    onClick={rotateSelectedBox}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform"
                    title="Rotar caja 90°"
                  >
                    <RotateCw size={13} />
                    <span>Rotar 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Botones de Orientación Rápida */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setBoxOrientation('vertical')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    selectedBox.orientation === 'vertical'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  ↕ Vertical (5×10)
                </button>
                <button
                  type="button"
                  onClick={() => setBoxOrientation('horizontal')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    selectedBox.orientation === 'horizontal'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  ↔ Horizontal (10×5)
                </button>
              </div>

              {/* Selector de Tipo de Caja Física (Catálogo) */}
              {selectedBox.kind !== 'panel' && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span>TIPO DE CAJA FÍSICA</span>
                    <span className="font-mono text-cyan-300 font-bold">{selectedBox.sizeLabel}</span>
                  </div>
                  <select
                    value={selectedBox.boxTypeId || ''}
                    onChange={(e) => setElementBoxType(selectedBox.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">Por defecto ({selectedBox.category})</option>
                    {boxTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name} ({bt.widthMM ?? '?'}×{bt.heightMM ?? '?'} mm)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Edición paramétrica de dimensiones del Tablero */}
              {selectedBox.kind === 'panel' && (
                <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      Gabinete DIN:
                    </span>
                    {selectedBox.dinModules ? (
                      <span className="font-mono text-[10px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/50 font-bold">
                        {selectedBox.dinModules} Módulos
                      </span>
                    ) : null}
                  </div>

                  {/* Presets rápidos */}
                  <div className="grid grid-cols-4 gap-1">
                    {cabinetSizePresets.map((pre) => {
                      const isCurrent =
                        Math.abs(selectedBox.widthMM - pre.widthMM) < 20 &&
                        Math.abs(selectedBox.heightMM - pre.heightMM) < 20;
                      return (
                        <button
                          key={pre.id}
                          type="button"
                          onClick={() =>
                            setPanelDimensions(selectedBox.id, {
                              widthMM: pre.widthMM,
                              heightMM: pre.heightMM,
                              depthMM: pre.depthMM,
                              dinModules: pre.dinModules
                            })
                          }
                          className={`px-1 py-1 rounded text-[10px] font-bold border transition-colors truncate ${
                            isCurrent
                              ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                          }`}
                          title={`${pre.label} (${pre.widthMM}x${pre.heightMM}mm)`}
                        >
                          {pre.label.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inputs milimétricos */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                        Ancho (mm):
                      </label>
                      <input
                        type="number"
                        step={10}
                        min={100}
                        max={1200}
                        value={selectedBox.widthMM}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val >= 50) {
                            setPanelDimensions(selectedBox.id, { widthMM: val });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                        Alto (mm):
                      </label>
                      <input
                        type="number"
                        step={10}
                        min={100}
                        max={2000}
                        value={selectedBox.heightMM}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val >= 50) {
                            setPanelDimensions(selectedBox.id, { heightMM: val });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Controles de posición Z (Altura) y X (Distancia) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Altura Z */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span>ALTURA (Z)</span>
                    <span className="font-mono text-blue-400 font-bold">{selectedBox.centerZ.toFixed(2)}m</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(0, -0.05)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0"
                    >
                      -5
                    </button>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(0, 0.05)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Distancia X */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span>ESQUINA (X)</span>
                    <span className="font-mono text-blue-400 font-bold">{selectedBox.centerX.toFixed(2)}m</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(-0.05, 0)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0"
                    >
                      -5
                    </button>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => nudgeSelectedBox(0.05, 0)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0"
                    >
                      +5
                    </button>
                  </div>
                </div>
              </div>

              {/* Presets Rápidos AEA en tira horizontal deslizable */}
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">PRESETS REGLAMENTARIOS AEA:</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {heightPresets.map((hp) => {
                    const isCurrent = Math.abs(selectedBox.centerZ - hp.meters) < 0.02;
                    return (
                      <button
                        key={hp.id}
                        type="button"
                        onClick={() => setSelectedBoxZ(hp.meters)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                          isCurrent
                            ? 'bg-blue-600 text-white border-blue-500 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {hp.meters.toFixed(2)}m · {hp.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : selectedOpening ? (
            <div className="p-3 space-y-2 max-h-[44vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-amber-600/30 text-amber-400 rounded-lg">
                    <DoorOpen size={14} />
                  </div>
                  <h4 className="font-bold text-xs text-slate-100">
                    {selectedOpening.type === 'door' ? 'Puerta' : selectedOpening.type === 'window' ? 'Ventana' : 'Vano'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1 text-slate-400 hover:text-white rounded-lg text-xs"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Ancho</span>
                  <input
                    type="number"
                    step={0.05}
                    value={selectedOpening.width.toFixed(2)}
                    onChange={(e) => patchSelectedOpening({ width: parseFloat(e.target.value) || selectedOpening.width })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-center text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Alto</span>
                  <input
                    type="number"
                    step={0.05}
                    value={selectedOpening.height.toFixed(2)}
                    onChange={(e) => patchSelectedOpening({ height: parseFloat(e.target.value) || selectedOpening.height })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-center text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Antepecho</span>
                  <input
                    type="number"
                    step={0.05}
                    value={selectedOpening.sill.toFixed(2)}
                    onChange={(e) => patchSelectedOpening({ sill: parseFloat(e.target.value) || selectedOpening.sill })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-center text-xs text-white"
                  />
                </div>
              </div>

              {/* Presets Rápidos de Carpintería */}
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">PRESETS DE CARPINTERÍA:</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {openingTypes
                    .filter((p) => p.type === selectedOpening.type)
                    .map((preset) => {
                      const isCurrent =
                        Math.abs(selectedOpening.width - preset.width) < 0.02 &&
                        Math.abs(selectedOpening.height - preset.height) < 0.02 &&
                        Math.abs(selectedOpening.sill - preset.sill) < 0.02;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyOpeningPreset(preset.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                            isCurrent
                              ? 'bg-amber-600 text-white border-amber-500 font-bold shadow-sm'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : selectedConduit ? (
            /* Barra móvil de canalización seleccionada */
            <div className="p-3 space-y-2 max-h-[44vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-cyan-600/30 text-cyan-400 rounded-lg">
                    <Zap size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-100">
                      Canalización {formatConduitSize(selectedConduit.material, selectedConduit.diameterMM)}
                    </h4>
                    <span className="text-[10px] text-cyan-300 font-mono">
                      {selectedConduitMetric ? `${selectedConduitMetric.totalLengthM.toFixed(2)} m` : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1 text-slate-400 hover:text-white rounded-lg text-xs"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Presets en tira deslizable */}
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">PRESET DE TRAZADO:</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {conduitPresetOptions.map((opt) => {
                    const isCurrent = selectedConduit.elevationRoute?.preset === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConduitPreset(selectedConduit.id, opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                          isCurrent
                            ? 'bg-blue-600 text-white border-blue-500 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  {selectedConduit.elevationRoute && (
                    <button
                      type="button"
                      onClick={() => resetConduitRoute(selectedConduit.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                    >
                      Restablecer
                    </button>
                  )}
                </div>
              </div>

              {/* Controles táctiles de ajuste fino de altura de cañería */}
              {(() => {
                const intermediatePoint = selectedConduit.elevationRoute?.points?.find(
                  (_, idx, arr) => idx > 0 && idx < arr.length - 1
                );
                const conduitZ = intermediatePoint?.z;
                return (
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span>ALTURA DE CAÑERÍA (Z):</span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {conduitZ != null ? `${conduitZ.toFixed(2)} m` : 'En puente / auto'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => nudgeSelectedConduitHeight(-0.10)}
                        className="py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-mono font-bold transition-transform text-center"
                        title="Bajar tramo horizontal 10 cm"
                      >
                        ▼ -10 cm
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeSelectedConduitHeight(0.10)}
                        className="py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-mono font-bold transition-transform text-center"
                        title="Subir tramo horizontal 10 cm"
                      >
                        ▲ +10 cm
                      </button>
                    </div>
                    {/* Presets de altura AEA rápidos para caños */}
                    <div className="flex gap-1 overflow-x-auto pt-0.5">
                      {[
                        { label: '0.30m Zócalo', z: 0.30 },
                        { label: '1.10m Medio', z: 1.10 },
                        { label: '2.20m Dintel', z: 2.20 },
                        ...(elevation.ceilingZ
                          ? [{ label: `${elevation.ceilingZ.toFixed(2)}m Losa`, z: elevation.ceilingZ }]
                          : [])
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setSelectedConduitHeight(preset.z)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors border ${
                            conduitZ != null && Math.abs(conduitZ - preset.z) < 0.03
                              ? 'bg-cyan-600 text-white border-cyan-400 font-bold'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      💡 Tocá y arrastrá los nodos azules en la pared o usá estos botones.
                    </p>
                  </div>
                );
              })()}

              {/* Resumen de conductores en la cañería */}
              {rawSelectedConduit?.conductors && rawSelectedConduit.conductors.length > 0 && (
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>CONDUCTORES ({rawSelectedConduit.conductors.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rawSelectedConduit.conductors.map((c, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 bg-slate-900 border border-slate-700 text-slate-200"
                      >
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                        {c.sectionMM2} mm² {c.role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones principales de cañería: Configurar cables y Eliminar */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsConduitModalOpen(true)}
                  className="py-2 px-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform"
                >
                  <Cable size={14} />
                  <span>Configurar Cables</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteConduit(selectedConduit.id)}
                  className="py-2 px-2.5 bg-rose-600/20 hover:bg-rose-600 active:scale-95 text-rose-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-500/40 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Eliminar Caño</span>
                </button>
              </div>
            </div>
          ) : (
            /* Barra móvil cuando no hay nada seleccionado: botones ergonómicos para el pulgar */
            <div className="p-2 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobileSheetMode('add_box')}
                  className="w-full py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-emerald-500/40 transition-transform"
                >
                  <Plus size={14} />
                  <span>+ Boca</span>
                </button>
                <button
                  type="button"
                  onClick={() => startConduitConnection()}
                  className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-blue-500/40 transition-transform"
                >
                  <Cable size={14} />
                  <span>☍ Conectar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSheetMode('add_opening')}
                  className="w-full py-2.5 px-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-amber-500/40 transition-transform"
                >
                  <DoorOpen size={14} />
                  <span>+ Vano</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-slate-200">Muro {wall.id.slice(-6)}</span>
                  <span className="text-slate-400 text-[11px] truncate">
                    {elevation.lengthM.toFixed(2)}m × {elevation.wallHeightM.toFixed(2)}m · {elevation.boxes.length} bocas
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFace(face === 'left' ? 'right' : 'left')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 flex items-center gap-1"
                    title="Alternar cara opuesta"
                  >
                    <ArrowLeftRight size={12} />
                    <span>Cara</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSheetMode('info')}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Info size={12} />
                    <span>Info</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── BOTTOM SHEET MÓVIL DESLIZANTE PARA AGREGAR ELEMENTOS O VER INFO ─── */}
        {mobileSheetMode !== 'none' && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
            {/* Fondo oscurecido con cierre al tocar */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobileSheetMode('none')}
            />

            {/* Contenedor del Bottom Sheet */}
            <div className="relative bg-slate-900 border-t border-slate-700 rounded-t-3xl shadow-2xl p-4 max-h-[85vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-200 pb-safe">
              {/* Manija táctil de arrastre visual */}
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

              {/* MODO A: Agregar Boca o Tablero */}
              {mobileSheetMode === 'add_box' && (
                <div className="flex flex-col min-h-0 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                        <Plus size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Agregar Boca o Tablero</h3>
                        <p className="text-[11px] text-slate-400">Elegí el elemento a colocar en este muro</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileSheetMode('none')}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Selector de circuito */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Circuito asignado:
                    </label>
                    <select
                      value={placementCircuitId ?? ''}
                      onChange={(e) => setPlacementCircuitId(e.target.value ? e.target.value : null)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Por defecto / Automático</option>
                      {availableCircuits.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle para auto-conectar cañería */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                    <div className="flex items-center gap-2">
                      <Cable size={16} className={autoConnectConduits ? 'text-blue-400' : 'text-slate-500'} />
                      <div>
                        <span className="font-semibold text-slate-200 block text-xs">Conectar con cañería</span>
                        <span className="text-[10px] text-slate-400 block">
                          {autoConnectConduits ? 'Enlaza con la boca previa' : 'Colocar cajas aisladas sin cañería'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        autoConnectConduits ? 'bg-blue-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                          autoConnectConduits ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Pestañas de categorías de bocas */}
                  <div className="grid grid-cols-5 gap-1 bg-slate-800/80 p-1 rounded-xl text-[11px] font-semibold text-center shrink-0">
                    {(
                      [
                        { id: 'tomas', label: 'Tomas' },
                        { id: 'llaves', label: 'Llaves' },
                        { id: 'tableros', label: 'Tableros' },
                        { id: 'paso', label: 'Paso' },
                        { id: 'apliques', label: 'Luces' }
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBoxCategoryTab(tab.id)}
                        className={`py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-colors truncate ${
                          boxCategoryTab === tab.id
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Lista táctil de símbolos según tab */}
                  <div className="overflow-y-auto max-h-[46vh] space-y-1.5 pr-1">
                    {availablePlacementSymbols
                      .filter((s) => {
                        if (boxCategoryTab === 'tableros')
                          return s.categoria === 'tableros' || s.id.includes('tp') || s.id.includes('ts') || s.id.includes('medidor');
                        if (boxCategoryTab === 'tomas')
                          return s.categoria === 'tomacorrientes' || s.id.includes('toma');
                        if (boxCategoryTab === 'paso')
                          return s.categoria === 'cajas_pase' || s.id.includes('paso') || s.id.includes('derivacion');
                        if (boxCategoryTab === 'llaves')
                          return s.id.includes('llave') || s.id.includes('efecto') || s.id.includes('pulsador') || s.id.includes('combinacion');
                        return (
                          s.id.includes('aplique') ||
                          s.id.includes('brazo') ||
                          (!s.id.includes('tp') &&
                            !s.id.includes('ts') &&
                            !s.id.includes('medidor') &&
                            !s.id.includes('toma') &&
                            !s.id.includes('paso') &&
                            !s.id.includes('derivacion') &&
                            !s.id.includes('llave') &&
                            !s.id.includes('efecto') &&
                            !s.id.includes('pulsador') &&
                            !s.id.includes('combinacion'))
                        );
                      })
                      .map((sym) => (
                        <button
                          key={sym.id}
                          type="button"
                          onClick={() => {
                            startPlacement(sym.id, placementCircuitId);
                            setMobileSheetMode('none');
                          }}
                          className="w-full text-left p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-[0.98] border border-slate-700/70 hover:border-emerald-500/60 transition-all flex items-center justify-between group shadow-sm"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 truncate">
                              {sym.label}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {sym.id}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-700 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white shrink-0 transition-colors">
                            Colocar ➔
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* MODO B: Agregar Abertura */}
              {mobileSheetMode === 'add_opening' && (
                <div className="flex flex-col min-h-0 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                        <DoorOpen size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Agregar Abertura</h3>
                        <p className="text-[11px] text-slate-400">Seleccioná carpintería estándar o vano libre</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileSheetMode('none')}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Pestañas de categorías de aberturas */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold text-center shrink-0">
                    {(
                      [
                        { id: 'door', label: 'Puertas' },
                        { id: 'window', label: 'Ventanas' },
                        { id: 'passage', label: 'Vanos' }
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setOpeningCategoryTab(tab.id)}
                        className={`py-1.5 rounded-lg transition-colors font-bold ${
                          openingCategoryTab === tab.id
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Lista táctil de presets de aberturas */}
                  <div className="overflow-y-auto max-h-[46vh] space-y-1.5 pr-1">
                    {openingTypes
                      .filter((p) => p.type === openingCategoryTab)
                      .map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            startOpeningPlacement(preset.id);
                            setMobileSheetMode('none');
                          }}
                          className="w-full text-left p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-[0.98] border border-slate-700/70 hover:border-amber-500/60 transition-all flex items-center justify-between group shadow-sm"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                              {preset.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {preset.width.toFixed(2)}m × {preset.height.toFixed(2)}m
                              {preset.sill > 0 ? ` · Antep: ${preset.sill.toFixed(2)}m` : ' · Sin antepecho'}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-700 group-hover:bg-amber-600 text-slate-300 group-hover:text-white shrink-0 transition-colors">
                            Colocar ➔
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* MODO C: Info y Tips de Pantalla */}
              {mobileSheetMode === 'info' && (
                <div className="flex flex-col min-h-0 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                        <Info size={16} />
                      </div>
                      <h3 className="text-sm font-bold text-white">Información del Muro y Tips</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileSheetMode('none')}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                      <span className="text-slate-400 block text-[10px]">Longitud</span>
                      <span className="font-bold font-mono text-sm text-slate-100">{elevation.lengthM.toFixed(2)} m</span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                      <span className="text-slate-400 block text-[10px]">Altura Muro</span>
                      <span className="font-bold font-mono text-sm text-slate-100">{elevation.wallHeightM.toFixed(2)} m</span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                      <span className="text-slate-400 block text-[10px]">Cielorraso</span>
                      <span className="font-bold font-mono text-sm text-slate-100">{elevation.ceilingZ.toFixed(2)} m</span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                      <span className="text-slate-400 block text-[10px]">Espesor</span>
                      <span className="font-bold font-mono text-sm text-slate-100">{wall.thickness.toFixed(2)} m</span>
                    </div>
                  </div>

                  <div className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-3 text-xs text-blue-200 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-blue-300">
                      <span>💡 Gestos y Operación Táctil</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                      <li><strong>Zoom:</strong> Pellizcá la pantalla con 2 dedos o doble toque rápido para encuadrar.</li>
                      <li><strong>Desplazar:</strong> Arrastrá cualquier caja con el dedo para cambiar su posición. Se imanta automáticamente a las alturas AEA (+0.30m, +1.10m, +2.20m).</li>
                      <li><strong>Rotar:</strong> Tocá la caja y usá el botón &quot;Rotar 90°&quot; para pasar de formato rectangular vertical a horizontal.</li>
                      <li><strong>Canalizaciones:</strong> Tocá una cañería para elegir su trazado (Directo, Por Pared, Curva Superior).</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── PANEL LATERAL DE INSPECCIÓN DE ALZADO (SOLO ESCRITORIO LG+) ─── */}
        <aside className="hidden lg:block w-80 bg-slate-900 border-l border-slate-800 p-4 space-y-4 overflow-y-auto text-slate-200 shrink-0">
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

              {/* Acción rápida: Trazar cañería desde esta caja */}
              <button
                type="button"
                onClick={() => startConduitConnection(selectedBox.id)}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform"
                title="Trazar cañería desde esta caja a otra caja en el muro"
              >
                <Cable size={14} />
                <span>☍ Trazar Cañería desde esta Caja</span>
              </button>

              {/* Orientación y Rotación de Caja */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Orientación de Caja:</span>
                  <button
                    type="button"
                    onClick={rotateSelectedBox}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform"
                    title="Girar 90° (Vertical ↔ Horizontal)"
                  >
                    <RotateCw size={12} />
                    <span>Rotar 90°</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBoxOrientation('vertical')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-center ${
                      selectedBox.orientation === 'vertical'
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    ↕ Vertical
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoxOrientation('horizontal')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-center ${
                      selectedBox.orientation === 'horizontal'
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    ↔ Horizontal
                  </button>
                </div>
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

              {/* Selector de Tipo de Caja Física (Catálogo) */}
              {selectedBox.kind !== 'panel' && (
                <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
                  <label className="text-[11px] text-slate-300 font-bold block">
                    Caja Física en Pared (Catálogo):
                  </label>
                  <select
                    value={selectedBox.boxTypeId || ''}
                    onChange={(e) => setElementBoxType(selectedBox.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">Por defecto ({selectedBox.category})</option>
                    {boxTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name} ({bt.widthMM ?? '?'}×{bt.heightMM ?? '?'} mm)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Edición paramétrica de dimensiones del Tablero */}
              {selectedBox.kind === 'panel' && (
                <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      Gabinete DIN:
                    </span>
                    {selectedBox.dinModules ? (
                      <span className="font-mono text-[10px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/50 font-bold">
                        {selectedBox.dinModules} Módulos
                      </span>
                    ) : null}
                  </div>

                  {/* Presets rápidos */}
                  <div className="grid grid-cols-4 gap-1">
                    {cabinetSizePresets.map((pre) => {
                      const isCurrent =
                        Math.abs(selectedBox.widthMM - pre.widthMM) < 20 &&
                        Math.abs(selectedBox.heightMM - pre.heightMM) < 20;
                      return (
                        <button
                          key={pre.id}
                          type="button"
                          onClick={() =>
                            setPanelDimensions(selectedBox.id, {
                              widthMM: pre.widthMM,
                              heightMM: pre.heightMM,
                              depthMM: pre.depthMM,
                              dinModules: pre.dinModules
                            })
                          }
                          className={`px-1 py-1 rounded text-[10px] font-bold border transition-colors truncate ${
                            isCurrent
                              ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                          }`}
                          title={`${pre.label} (${pre.widthMM}x${pre.heightMM}mm)`}
                        >
                          {pre.label.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inputs milimétricos */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                        Ancho (mm):
                      </label>
                      <input
                        type="number"
                        step={10}
                        min={100}
                        max={1200}
                        value={selectedBox.widthMM}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val >= 50) {
                            setPanelDimensions(selectedBox.id, { widthMM: val });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                        Alto (mm):
                      </label>
                      <input
                        type="number"
                        step={10}
                        min={100}
                        max={2000}
                        value={selectedBox.heightMM}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val >= 50) {
                            setPanelDimensions(selectedBox.id, { heightMM: val });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

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

              {/* Selector de Presets de Carpintería */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                  Presets de Carpintería de Proyecto
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                  {openingTypes
                    .filter((p) => p.type === selectedOpening.type)
                    .map((preset) => {
                      const isCurrent =
                        Math.abs(selectedOpening.width - preset.width) < 0.02 &&
                        Math.abs(selectedOpening.height - preset.height) < 0.02 &&
                        Math.abs(selectedOpening.sill - preset.sill) < 0.02;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyOpeningPreset(preset.id)}
                          className={`p-1.5 rounded-lg text-left text-xs transition-colors border ${
                            isCurrent
                              ? 'bg-amber-600/30 text-amber-200 border-amber-500 font-bold'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                          title={preset.description}
                        >
                          <div className="font-semibold text-[11px] truncate">{preset.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {preset.width.toFixed(2)}×{preset.height.toFixed(2)}m
                            {preset.sill > 0 ? ` (s:${preset.sill.toFixed(2)})` : ''}
                          </div>
                        </button>
                      );
                    })}
                </div>
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
          ) : selectedConduit ? (
            /* CASO C: Canalización Seleccionada */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-cyan-600/30 text-cyan-400 rounded-lg">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-100">
                      Canalización {formatConduitSize(selectedConduit.material, selectedConduit.diameterMM)}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {selectedConduit.label || selectedConduit.id.slice(-6)}
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

              {/* Métrica calculada objetiva */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block">
                  Cómputo Métrico:
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-200">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Longitud total:</span>
                    <span className="font-bold font-mono text-cyan-300">
                      {selectedConduitMetric ? `${selectedConduitMetric.totalLengthM.toFixed(2)} m` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Desglose:</span>
                    <span className="text-[11px] font-mono text-slate-300">
                      {selectedConduitMetric
                        ? `${selectedConduitMetric.distPlantaHorizontal.toFixed(2)}m H + ${selectedConduitMetric.dzLocal.toFixed(2)}m V`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Presets de trazado */}
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                  Trazado en Alzado:
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {conduitPresetOptions.map((opt) => {
                    const isCurrent = selectedConduit.elevationRoute?.preset === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConduitPreset(selectedConduit.id, opt.id)}
                        className={`p-2 rounded-xl text-left text-xs transition-all border ${
                          isCurrent
                            ? 'bg-blue-600/30 text-blue-200 border-blue-500 font-semibold'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-bold text-[11px]">{opt.label}</div>
                        <div className="text-[10px] text-slate-400">{opt.description}</div>
                      </button>
                    );
                  })}
                </div>
                {selectedConduit.elevationRoute && (
                  <button
                    type="button"
                    onClick={() => resetConduitRoute(selectedConduit.id)}
                    className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[11px] transition-colors border border-slate-700 mt-2"
                  >
                    Restablecer trazado automático
                  </button>
                )}
              </div>

              {/* Ajuste métrico de altura de cañería */}
              {(() => {
                const intermediatePoint = selectedConduit.elevationRoute?.points?.find(
                  (_, idx, arr) => idx > 0 && idx < arr.length - 1
                );
                const conduitZ = intermediatePoint?.z;
                return (
                  <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider">
                        Altura Tramo Horizontal (Z):
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {conduitZ != null ? `${conduitZ.toFixed(2)} m` : 'Variable'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => nudgeSelectedConduitHeight(-0.10)}
                        className="py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-bold transition-all text-center"
                        title="Bajar tramo horizontal 10 cm"
                      >
                        ▼ -10 cm
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeSelectedConduitHeight(0.10)}
                        className="py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-bold transition-all text-center"
                        title="Subir tramo horizontal 10 cm"
                      >
                        ▲ +10 cm
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1">
                      {[
                        { label: '0.30m Zócalo', z: 0.30 },
                        { label: '1.10m Llaves', z: 1.10 },
                        { label: '2.20m Dintel', z: 2.20 },
                        ...(elevation.ceilingZ
                          ? [{ label: `${elevation.ceilingZ.toFixed(2)}m Losa`, z: elevation.ceilingZ }]
                          : [])
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setSelectedConduitHeight(preset.z)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors border text-center truncate ${
                            conduitZ != null && Math.abs(conduitZ - preset.z) < 0.03
                              ? 'bg-cyan-600 text-white border-cyan-400 font-bold'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-[11px] text-slate-400">
                💡 Arrastrá los puntos azules sobre la cañería para desplazar la altura del puente o quiebres ortogonales.
              </div>

              {/* Conductores instalados en la cañería */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-400 text-[11px] uppercase tracking-wider">
                    Conductores ({rawSelectedConduit?.conductors?.length || 0}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsConduitModalOpen(true)}
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                  >
                    <Cable size={13} />
                    <span>Configurar</span>
                  </button>
                </div>
                {rawSelectedConduit?.conductors && rawSelectedConduit.conductors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {rawSelectedConduit.conductors.map((c, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-slate-200"
                      >
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                        {c.sectionMM2} mm² {c.role}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Sin conductores asignados. Hacé clic en "Configurar" para agregar cables.
                  </p>
                )}
              </div>

              {/* Botones de acción principales */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConduitModalOpen(true)}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Cable size={15} />
                  <span>Configurar Cables y Material...</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteConduit(selectedConduit.id)}
                  className="w-full py-2 px-3 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/40 transition-colors"
                >
                  <Trash2 size={15} />
                  <span>Eliminar Tramo de Cañería</span>
                </button>
              </div>
            </div>
          ) : (
            /* CASO D: Información General del Muro y Leyenda */
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="font-bold text-xs text-slate-100 mb-0.5">Paramento en Inspección</h3>
                <p className="text-[11px] text-slate-400">
                  Seleccioná o arrastrá cualquier caja en la vista para reubicarla métricamente o rotarla.
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
                  <li>Rotá cualquier caja 90° entre vertical y apaisada/horizontal.</li>
                  <li>Usá pellizco táctil con 2 dedos o la rueda del mouse para hacer zoom libre.</li>
                  <li>Los cambios impactan de inmediato en la planta y en el cómputo métrico.</li>
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

      {/* Modal para configurar cables, secciones y tecnología de la canalización */}
      <ConduitModal
        conduit={rawSelectedConduit}
        isOpen={isConduitModalOpen && Boolean(rawSelectedConduit)}
        onClose={() => setIsConduitModalOpen(false)}
      />
    </div>
  );
};
