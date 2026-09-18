/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: UnderlayAdjustModal.tsx (Patrón Estricto MVVM)
 * Modal interactivo para rotación (90°, 180°, 270°) y recorte de láminas
 * de fondo, optimizando memoria, encuadre y velocidad de procesamiento CAD.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  Crop,
  Maximize2,
  X,
  Check,
  Loader2,
  Sliders
} from 'lucide-react';
import type {
  UnderlaySheet,
  CropBoxPx,
  UnderlayRotationAngle
} from '../../../models/underlay/UnderlaySheet';

interface UnderlayAdjustModalProps {
  isOpen: boolean;
  underlaySheet: UnderlaySheet | null;
  isTransforming?: boolean;
  onClose: () => void;
  onApply: (rotationDeg: UnderlayRotationAngle, cropBox?: CropBoxPx) => Promise<void>;
}

export const UnderlayAdjustModal: React.FC<UnderlayAdjustModalProps> = ({
  isOpen,
  underlaySheet,
  isTransforming = false,
  onClose,
  onApply
}) => {
  const [rotationDeg, setRotationDeg] = useState<UnderlayRotationAngle>(0);
  const [cropBox, setCropBox] = useState<CropBoxPx | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reiniciar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setRotationDeg(0);
      setCropBox(null);
      setIsDragging(false);
      setDragStart(null);
    }
  }, [isOpen]);

  // Dimensiones efectivas tras aplicar la rotación
  const effectiveWidth =
    rotationDeg === 90 || rotationDeg === 270
      ? underlaySheet?.heightPx || 1
      : underlaySheet?.widthPx || 1;
  const effectiveHeight =
    rotationDeg === 90 || rotationDeg === 270
      ? underlaySheet?.widthPx || 1
      : underlaySheet?.heightPx || 1;

  /**
   * Rota 90° en sentido horario
   */
  const handleRotateCw = () => {
    setRotationDeg((prev) => {
      const next = ((prev + 90) % 360) as UnderlayRotationAngle;
      return next;
    });
    setCropBox(null); // Reiniciar recorte al cambiar la orientación
  };

  /**
   * Rota 90° en sentido antihorario
   */
  const handleRotateCcw = () => {
    setRotationDeg((prev) => {
      const next = ((prev + 270) % 360) as UnderlayRotationAngle;
      return next;
    });
    setCropBox(null);
  };

  /**
   * Rota 180°
   */
  const handleRotate180 = () => {
    setRotationDeg((prev) => {
      const next = ((prev + 180) % 360) as UnderlayRotationAngle;
      return next;
    });
    setCropBox(null);
  };

  /**
   * Restablece al plano completo sin recorte
   */
  const handleResetCrop = () => {
    setCropBox(null);
  };

  /**
   * Convierte coordenadas de evento táctil o mouse a coordenadas del plano rotado
   */
  const getPlanCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!imgRef.current) return null;
      const rect = imgRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

      return {
        x: Math.round(normX * effectiveWidth),
        y: Math.round(normY * effectiveHeight)
      };
    },
    [effectiveWidth, effectiveHeight]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isTransforming) return;
    const pt = getPlanCoordinates(e.clientX, e.clientY);
    if (!pt) return;

    setIsDragging(true);
    setDragStart(pt);
    setCropBox({ x: pt.x, y: pt.y, width: 0, height: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart) return;
    const pt = getPlanCoordinates(e.clientX, e.clientY);
    if (!pt) return;

    const minX = Math.min(dragStart.x, pt.x);
    const maxX = Math.max(dragStart.x, pt.x);
    const minY = Math.min(dragStart.y, pt.y);
    const maxY = Math.max(dragStart.y, pt.y);

    const w = maxX - minX;
    const h = maxY - minY;

    setCropBox({
      x: minX,
      y: minY,
      width: w,
      height: h
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    // Si el recuadro es insignificante (< 20px), descartarlo
    if (cropBox && (cropBox.width < 20 || cropBox.height < 20)) {
      setCropBox(null);
    }
  };

  const handleConfirm = async () => {
    const validCrop =
      cropBox && cropBox.width >= 20 && cropBox.height >= 20 ? cropBox : undefined;
    await onApply(rotationDeg, validCrop);
  };

  if (!isOpen || !underlaySheet) return null;

  // Cálculo de porcentajes para el recuadro visual de recorte
  const cropOverlayStyle = cropBox
    ? {
        left: `${(cropBox.x / effectiveWidth) * 100}%`,
        top: `${(cropBox.y / effectiveHeight) * 100}%`,
        width: `${(cropBox.width / effectiveWidth) * 100}%`,
        height: `${(cropBox.height / effectiveHeight) * 100}%`
      }
    : null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl max-h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-600 text-white rounded-xl shadow-xs">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                Ajustar Lámina de Fondo
              </h3>
              <p className="text-[11px] text-slate-500">
                Rotar orientación y recortar el área útil de la planta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isTransforming}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Herramientas de Ajuste */}
        <div className="p-3 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRotateCcw}
              disabled={isTransforming}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="Girar 90° en sentido antihorario"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">90° Izq</span>
            </button>
            <button
              type="button"
              onClick={handleRotateCw}
              disabled={isTransforming}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="Girar 90° en sentido horario"
            >
              <RotateCw size={14} />
              <span className="hidden sm:inline">90° Der</span>
            </button>
            <button
              type="button"
              onClick={handleRotate180}
              disabled={isTransforming}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="Invertir 180°"
            >
              <Maximize2 size={14} />
              <span>180°</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {cropBox && (
              <button
                type="button"
                onClick={handleResetCrop}
                disabled={isTransforming}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                Todo el Plano
              </button>
            )}
            <span className="text-[11px] font-mono font-medium text-slate-500 bg-white/70 px-2 py-1 rounded-lg border border-slate-200">
              {rotationDeg > 0 && `${rotationDeg}° · `}
              {cropBox ? `${cropBox.width}×${cropBox.height} px` : `${effectiveWidth}×${effectiveHeight} px`}
            </span>
          </div>
        </div>

        {/* Área Central: Visor Interactivo con Caja de Recorte */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-900/95 overflow-hidden flex items-center justify-center p-4 relative min-h-[280px] sm:min-h-[380px] select-none cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="relative max-w-full max-h-[55vh] flex items-center justify-center pointer-events-none">
            {/* Imagen del plano con rotación CSS */}
            <img
              ref={imgRef}
              src={underlaySheet.imageUrl}
              alt="Plano de fondo"
              style={{
                transform: `rotate(${rotationDeg}deg)`,
                transition: 'transform 0.15s ease-out'
              }}
              className="max-w-full max-h-[55vh] object-contain shadow-2xl rounded-sm"
              draggable={false}
            />

            {/* Recuadro de recorte visual superpuesto */}
            {cropOverlayStyle && (
              <div
                style={cropOverlayStyle}
                className="absolute border-2 border-sky-400 bg-sky-500/20 pointer-events-none rounded-xs shadow-lg"
              >
                <div className="absolute -top-6 left-0 bg-sky-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shadow-xs flex items-center gap-1">
                  <Crop size={11} />
                  <span>Área de recorte</span>
                </div>
                {/* Esquinas / Tiradores visuales */}
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-sky-600 rounded-full" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-sky-600 rounded-full" />
                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-sky-600 rounded-full" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-sky-600 rounded-full" />
              </div>
            )}
          </div>

          {/* Guía inferior cuando no hay recorte */}
          {!cropBox && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-slate-200 text-[11px] px-3 py-1 rounded-full pointer-events-none">
              Arrastrá con el mouse o dedo sobre el plano para recortar
            </div>
          )}
        </div>

        {/* Pie del Modal con Acciones */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {cropBox
              ? 'Se descartarán carátulas y márgenes vacíos para acelerar el relevamiento.'
              : 'Podés conservar todo el plano o recortar la región de la planta.'}
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isTransforming}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isTransforming}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isTransforming ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Aplicar Ajustes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
