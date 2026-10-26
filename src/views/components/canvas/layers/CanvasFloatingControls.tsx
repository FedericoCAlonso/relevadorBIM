/**
 * Botonera flotante CAD (completa en escritorio, compacta en móvil),
 * aviso móvil de emplazamiento y barra inferior de ayuda contextual.
 */
import React from 'react';
import {
  Plus,
  Minus,
  Maximize2,
  Ruler,
  Eye,
  EyeOff,
  DraftingCompass,
  ScanSearch,
  Lock,
  Unlock
} from 'lucide-react';
import type { UnderlaySheet } from '../../../../models/underlay/UnderlaySheet';
import type { WallVertex } from '../../../../models/architecture/Wall';
import { getSymbolById } from '../../../../models/electrical/symbolsLib';

interface CanvasFloatingControlsProps {
  isDesktop: boolean;
  showDimensions: boolean;
  isAddingDimension: boolean;
  isArchitectureLocked: boolean;
  isSnapEnabled: boolean;
  isCalibratingUnderlay: boolean;
  isSamplingPattern: boolean;
  underlaySheet: UnderlaySheet | null;
  selectedSymbolId: string | null | undefined;
  verticesCount: number;
  activeAnchorVertex: WallVertex | null | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onToggleDimensions: () => void;
  isOrthoMode?: boolean;
  onToggleOrtho?: () => void;
  onToggleAddingDimension?: () => void;
  onToggleLockArchitecture?: () => void;
  onToggleSnap?: () => void;
  onToggleUnderlayVisibility?: () => void;
  onCycleUnderlayOpacity?: () => void;
  onStartUnderlayCalibration?: () => void;
  onOpenAdjustUnderlay?: () => void;
  onStartPatternSampling?: () => void;
  onCancelSamplingPattern?: () => void;
}

export const CanvasFloatingControls: React.FC<CanvasFloatingControlsProps> = React.memo(
  ({
    isDesktop,
    showDimensions,
    isAddingDimension,
    isArchitectureLocked,
    isSnapEnabled,
    isCalibratingUnderlay,
    isSamplingPattern,
    underlaySheet,
    selectedSymbolId,
    verticesCount,
    activeAnchorVertex,
    onZoomIn,
    onZoomOut,
    onRecenter,
    onToggleDimensions,
    isOrthoMode = false,
    onToggleOrtho,
    onToggleAddingDimension,
    onToggleLockArchitecture,
    onToggleSnap,
    onToggleUnderlayVisibility,
    onCycleUnderlayOpacity,
    onStartUnderlayCalibration,
    onOpenAdjustUnderlay,
    onStartPatternSampling,
    onCancelSamplingPattern
  }) => (
    <>
      {isDesktop ? (
        <div
          className="absolute top-4 right-4 flex flex-col gap-1.5 z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onZoomIn}
            className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
            title="Acercar (+)"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
            title="Alejar (-)"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            onClick={onRecenter}
            className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
            title="Recentrar y encuadrar plano"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleDimensions}
            className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
              showDimensions
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/90 text-slate-400 border-slate-200 hover:text-slate-700'
            }`}
            title={showDimensions ? 'Ocultar cotas métricas' : 'Mostrar cotas métricas'}
          >
            <Ruler size={16} />
          </button>
          {onToggleOrtho && (
            <button
              type="button"
              onClick={onToggleOrtho}
              className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all text-xs font-bold ${
                isOrthoMode
                  ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200 ring-2 ring-blue-400'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
              }`}
              title={isOrthoMode ? 'Modo Ortogonal ACTIVO (⟂ F8 / Shift)' : 'Activar Modo Ortogonal (⟂ F8 / Shift)'}
            >
              ⟂
            </button>
          )}
          <button
            type="button"
            onClick={onToggleAddingDimension}
            className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
              isAddingDimension
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
            }`}
            title={isAddingDimension ? 'Cancelar trazado de cota' : 'Trazar cota métrica libre (2 clics)'}
          >
            <DraftingCompass size={16} />
          </button>

          {onToggleLockArchitecture && (
            <button
              type="button"
              onClick={onToggleLockArchitecture}
              className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                isArchitectureLocked
                  ? 'bg-amber-600 text-white border-amber-700 shadow-amber-200 ring-2 ring-amber-400'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
              }`}
              title={
                isArchitectureLocked
                  ? 'Arquitectura bloqueada (clic para desbloquear muros)'
                  : 'Bloquear arquitectura (inmunizar muros contra toques accidentales)'
              }
            >
              {isArchitectureLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
          )}

          {underlaySheet && (
            <>
              <div className="h-px bg-slate-200 my-0.5" />
              {onToggleSnap && (
                <button
                  type="button"
                  onClick={onToggleSnap}
                  className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                    isSnapEnabled
                      ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200'
                      : 'bg-white/90 text-slate-400 border-slate-200 hover:text-slate-600'
                  }`}
                  title={
                    isSnapEnabled
                      ? 'Snap magnético activado (tecla S para desactivar, o mantener Shift)'
                      : 'Snap magnético desactivado (tecla S para activar)'
                  }
                >
                  <span className="text-sm select-none">🧲</span>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleUnderlayVisibility}
                className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                  underlaySheet.visible
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white/90 text-slate-400 border-slate-200 hover:text-slate-700'
                }`}
                title={underlaySheet.visible ? 'Ocultar plano de fondo' : 'Mostrar plano de fondo'}
              >
                {underlaySheet.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                type="button"
                onClick={onCycleUnderlayOpacity}
                className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all text-[11px] font-mono font-bold"
                title={`Opacidad del plano: ${Math.round(underlaySheet.opacity * 100)}% (clic para cambiar)`}
              >
                {Math.round(underlaySheet.opacity * 100)}%
              </button>
              <button
                type="button"
                onClick={onStartUnderlayCalibration}
                className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                  isCalibratingUnderlay
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
                }`}
                title="Recalibrar escala métrica (2 clics)"
              >
                📏
              </button>
              {onOpenAdjustUnderlay && (
                <button
                  type="button"
                  onClick={onOpenAdjustUnderlay}
                  className="w-9 h-9 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all text-xs font-bold"
                  title="Ajustar plano de fondo (rotar / recortar)"
                >
                  ✂️
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isSamplingPattern) {
                    onCancelSamplingPattern?.();
                  } else {
                    onStartPatternSampling?.();
                  }
                }}
                className={`w-9 h-9 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                  isSamplingPattern
                    ? 'bg-cyan-600 text-white border-cyan-700 shadow-cyan-200 ring-2 ring-cyan-400'
                    : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
                }`}
                title={
                  isSamplingPattern
                    ? 'Desactivar detección de patrones'
                    : 'Detectar símbolos similares en plano con autovectores (selección con recuadro)'
                }
              >
                <ScanSearch size={16} />
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          className="absolute top-3 right-3 flex flex-col gap-1.5 z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onRecenter}
            className="w-8 h-8 bg-white/90 backdrop-blur-md shadow-md rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 transition-all"
            title="Recentrar y encuadrar plano"
          >
            <Maximize2 size={15} />
          </button>

          {onToggleLockArchitecture && (
            <button
              type="button"
              onClick={onToggleLockArchitecture}
              className={`w-8 h-8 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                isArchitectureLocked
                  ? 'bg-amber-600 text-white border-amber-700 shadow-amber-200 ring-2 ring-amber-400'
                  : 'bg-white/90 text-slate-700 border-slate-200'
              }`}
              title={isArchitectureLocked ? 'Desbloquear arquitectura' : 'Bloquear arquitectura'}
            >
              {isArchitectureLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          )}

          {onToggleOrtho && (
            <button
              type="button"
              onClick={onToggleOrtho}
              className={`w-8 h-8 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all text-xs font-bold ${
                isOrthoMode
                  ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200 ring-2 ring-blue-400'
                  : 'bg-white/90 text-slate-700 border-slate-200'
              }`}
              title={isOrthoMode ? 'Modo Ortogonal ACTIVO (⟂)' : 'Modo Ortogonal (⟂)'}
            >
              ⟂
            </button>
          )}

          {isAddingDimension && (
            <button
              type="button"
              onClick={onToggleAddingDimension}
              className="w-8 h-8 bg-blue-600 text-white border border-blue-700 shadow-md rounded-xl flex items-center justify-center active:scale-95 transition-all"
              title="Cancelar cota libre"
            >
              <DraftingCompass size={15} />
            </button>
          )}

          {underlaySheet && onToggleSnap && (
            <button
              type="button"
              onClick={onToggleSnap}
              className={`w-8 h-8 backdrop-blur-md shadow-md rounded-xl border flex items-center justify-center active:scale-95 transition-all ${
                isSnapEnabled
                  ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200'
                  : 'bg-white/90 text-slate-400 border-slate-200'
              }`}
              title="Snap magnético"
            >
              <span className="text-xs select-none">🧲</span>
            </button>
          )}
        </div>
      )}

      {/* Aviso móvil superior al tener boca seleccionada */}
      {selectedSymbolId && !isDesktop && (
        <div className="absolute top-3 left-4 right-14 bg-blue-600/95 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-lg truncate pointer-events-none z-10 animate-in fade-in slide-in-from-top-1">
          📍 Tocá plano o muro para emplazar {getSymbolById(selectedSymbolId)?.label || 'Boca'}
        </div>
      )}

      {/* Indicador de ayuda de escritorio */}
      <div className="hidden lg:flex absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-xs font-mono text-slate-700 pointer-events-none items-center gap-2">
        {selectedSymbolId ? (
          <span className="text-blue-700 font-bold">
            📍 Multi-inserción: Clic para emplazar · Esc para salir · S: Snap {isSnapEnabled ? 'ON' : 'OFF'} (Shift para liberar)
          </span>
        ) : verticesCount === 0 ? (
          'Tocá cualquier parte del lienzo para plantar el punto de inicio'
        ) : activeAnchorVertex ? (
          `Anclaje seleccionado: (${activeAnchorVertex.x}, ${activeAnchorVertex.y}) m`
        ) : (
          'Tocá un vértice o esquina para anclar la siguiente pared'
        )}
      </div>
    </>
  )
);
CanvasFloatingControls.displayName = 'CanvasFloatingControls';
