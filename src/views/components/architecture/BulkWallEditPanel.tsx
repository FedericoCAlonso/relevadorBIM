/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BulkWallEditPanel.tsx (Patrón Estricto MVVM)
 * Responsabilidad Única (SRP):
 * Panel de edición en bloque cuando hay 2 o más paredes seleccionadas.
 * Muestra valores homogéneos o el estado "*Varios*" cuando difieren.
 * Únicamente modifica las magnitudes o propiedades que el usuario altera,
 * preservando todas las demás intactas para cada pared.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, useState } from 'react';
import {
  Layers,
  Ruler,
  Trash2,
  X,
  CheckCircle2
} from 'lucide-react';
import {
  ARCHITECTURAL_WALL_CONFIG,
  WALL_TYPE_OPTIONS,
  WALL_JUSTIFICATION_OPTIONS
} from '../../../config';
import type { Wall, WallVertex, WallType, WallJustification } from '../../../models/architecture/Wall';
import { getWallLength } from '../../../models/architecture/Wall';

export interface BulkWallEditPanelProps {
  selectedWalls: ReadonlyArray<Wall>;
  verticesMap: Map<string, WallVertex>;
  onBatchUpdate: (updates: Partial<Wall>) => void;
  onBatchUpdateLength?: (targetLengthM: number, mode?: 'absolute' | 'delta') => void;
  onBatchDelete: () => void;
  onDeselectAll: () => void;
}

export const BulkWallEditPanel: React.FC<BulkWallEditPanelProps> = React.memo(
  ({
    selectedWalls,
    verticesMap,
    onBatchUpdate,
    onBatchUpdateLength,
    onBatchDelete,
    onDeselectAll
  }) => {
    const [customLength, setCustomLength] = useState('');
    const [customThickness, setCustomThickness] = useState('');
    const [customHeight, setCustomHeight] = useState('');
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

    const showFeedback = (msg: string) => {
      setFeedbackMsg(msg);
      setTimeout(() => setFeedbackMsg(null), 2500);
    };

    // Métricas globales del lote
    const totalLengthM = useMemo(() => {
      return selectedWalls.reduce((acc, w) => acc + getWallLength(w, verticesMap), 0);
    }, [selectedWalls, verticesMap]);

    // Evaluación de homogeneidad / valores mixtos por propiedad
    const commonLength = useMemo(() => {
      if (selectedWalls.length === 0) return null;
      const first = getWallLength(selectedWalls[0], verticesMap);
      const allSame = selectedWalls.every(
        (w) => Math.abs(getWallLength(w, verticesMap) - first) < 0.01
      );
      return allSame ? first : null;
    }, [selectedWalls, verticesMap]);

    const commonThickness = useMemo(() => {
      if (selectedWalls.length === 0) return null;
      const first = selectedWalls[0].thickness;
      const allSame = selectedWalls.every((w) => Math.abs(w.thickness - first) < 0.001);
      return allSame ? first : null;
    }, [selectedWalls]);

    const commonHeight = useMemo(() => {
      if (selectedWalls.length === 0) return null;
      const first = selectedWalls[0].height;
      const allSame = selectedWalls.every((w) => Math.abs(w.height - first) < 0.001);
      return allSame ? first : null;
    }, [selectedWalls]);

    const commonWallType = useMemo(() => {
      if (selectedWalls.length === 0) return null;
      const first = selectedWalls[0].wallType || 'standard';
      const allSame = selectedWalls.every((w) => (w.wallType || 'standard') === first);
      return allSame ? first : null;
    }, [selectedWalls]);

    const commonJustification = useMemo(() => {
      if (selectedWalls.length === 0) return null;
      const first = selectedWalls[0].justification || 'interior';
      const allSame = selectedWalls.every((w) => (w.justification || 'interior') === first);
      return allSame ? first : null;
    }, [selectedWalls]);

    const commonIsBearing = useMemo(() => {
      if (selectedWalls.length === 0) return null;
      const first = Boolean(selectedWalls[0].isBearing);
      const allSame = selectedWalls.every((w) => Boolean(w.isBearing) === first);
      return allSame ? first : null;
    }, [selectedWalls]);

    const handleApplyLength = (len: number, mode: 'absolute' | 'delta' = 'absolute') => {
      if (onBatchUpdateLength) {
        onBatchUpdateLength(len, mode);
        setCustomLength('');
        if (mode === 'delta') {
          const sign = len > 0 ? `+${len.toFixed(2)}` : `${len.toFixed(2)}`;
          showFeedback(`Longitud ajustada (${sign} m) en ${selectedWalls.length} paredes`);
        } else {
          showFeedback(`Longitud fijada a ${len.toFixed(2)} m en ${selectedWalls.length} paredes`);
        }
      }
    };

    const handleApplyThickness = (th: number) => {
      onBatchUpdate({ thickness: th });
      setCustomThickness('');
      showFeedback(`Espesor actualizado a ${th.toFixed(2)} m en ${selectedWalls.length} paredes`);
    };

    const handleApplyHeight = (h: number) => {
      onBatchUpdate({ height: h });
      setCustomHeight('');
      showFeedback(`Altura actualizada a ${h.toFixed(2)} m en ${selectedWalls.length} paredes`);
    };

    const handleApplyWallType = (type: WallType) => {
      onBatchUpdate({ wallType: type });
      showFeedback(`Tipología cambiada a "${type}" en ${selectedWalls.length} paredes`);
    };

    const handleApplyJustification = (just: WallJustification) => {
      onBatchUpdate({ justification: just });
      showFeedback(`Alineación cambiada a "${just}" en ${selectedWalls.length} paredes`);
    };

    const handleApplyBearing = (isBearing: boolean) => {
      onBatchUpdate({ isBearing });
      showFeedback(`Muro portante: ${isBearing ? 'Sí' : 'No'} en ${selectedWalls.length} paredes`);
    };

    return (
      <div className="space-y-3 p-3 bg-white border border-blue-200/80 rounded-2xl shadow-sm text-slate-800">
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-xl">
              <Layers size={16} />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block leading-tight">
                Paredes Seleccionadas ({selectedWalls.length})
              </span>
              <span className="text-[10px] text-slate-500 font-mono block leading-tight">
                {totalLengthM.toFixed(2)} m longitud total acumulada
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onDeselectAll}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Deseleccionar todas las paredes"
          >
            <X size={15} />
          </button>
        </div>

        {/* Notificación de feedback temporal */}
        {feedbackMsg && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold rounded-xl flex items-center gap-1.5 animate-in fade-in duration-150">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span className="truncate">{feedbackMsg}</span>
          </div>
        )}

        {/* 1. LONGITUD / LARGO DE PARED EN BLOQUE */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Ruler size={12} className="text-blue-600" />
              <span>Longitud / Largo de Muro:</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {commonLength !== null ? `${commonLength.toFixed(2)} m` : '*(Varios distintos)*'}
            </span>
          </div>

          {/* Presets absolutos */}
          <div className="grid grid-cols-4 gap-1">
            {[2.0, 3.0, 4.0, 5.0].map((len) => {
              const isSelected = commonLength !== null && Math.abs(commonLength - len) < 0.01;
              return (
                <button
                  key={len}
                  type="button"
                  onClick={() => handleApplyLength(len, 'absolute')}
                  className={`py-1 px-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title={`Fijar largo a ${len.toFixed(2)} m`}
                >
                  {len.toFixed(2)}m
                </button>
              );
            })}
          </div>

          {/* Ajuste relativo (deltas +/-) */}
          <div className="grid grid-cols-4 gap-1">
            {[-0.5, -0.1, 0.1, 0.5].map((delta) => {
              const label = delta > 0 ? `+${delta.toFixed(2)}m` : `${delta.toFixed(2)}m`;
              return (
                <button
                  key={delta}
                  type="button"
                  onClick={() => handleApplyLength(delta, 'delta')}
                  className="py-1 px-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer text-center bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  title={`Ajustar ${label} a cada pared`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Input de longitud fija personalizada */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              type="number"
              step="0.05"
              min="0.10"
              max="50.0"
              value={customLength}
              onChange={(e) => setCustomLength(e.target.value)}
              placeholder={commonLength !== null ? commonLength.toFixed(2) : 'Largo personalizado'}
              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={!customLength || parseFloat(customLength) <= 0}
              onClick={() => {
                const val = parseFloat(customLength);
                if (val > 0) handleApplyLength(val, 'absolute');
              }}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-[11px] font-bold border border-blue-200 transition-colors cursor-pointer"
            >
              Fijar
            </button>
          </div>
        </div>

        {/* 2. ESPESOR DE PARED EN BLOQUE */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Espesor de Muro:</span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {commonThickness !== null ? `${commonThickness.toFixed(2)} m` : '*(Varios distintos)*'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {ARCHITECTURAL_WALL_CONFIG.THICKNESS_PRESETS.map((th) => {
              const isSelected = commonThickness !== null && Math.abs(commonThickness - th) < 0.001;
              return (
                <button
                  key={th}
                  type="button"
                  onClick={() => handleApplyThickness(th)}
                  className={`py-1 px-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {th.toFixed(2)}m
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              type="number"
              step="0.01"
              min="0.05"
              max="1.50"
              value={customThickness}
              onChange={(e) => setCustomThickness(e.target.value)}
              placeholder={commonThickness !== null ? commonThickness.toFixed(2) : 'Espesor personalizado'}
              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={!customThickness || parseFloat(customThickness) <= 0}
              onClick={() => {
                const val = parseFloat(customThickness);
                if (val > 0) handleApplyThickness(val);
              }}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-[11px] font-bold border border-blue-200 transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* 3. ALTURA LIBRE EN BLOQUE */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Altura Libre (h):</span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {commonHeight !== null ? `${commonHeight.toFixed(2)} m` : '*(Varios distintos)*'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {[2.6, 2.7, 2.8, 3.0].map((h) => {
              const isSelected = commonHeight !== null && Math.abs(commonHeight - h) < 0.001;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleApplyHeight(h)}
                  className={`py-1 px-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {h.toFixed(2)}m
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              type="number"
              step="0.05"
              min="0.50"
              max="10.0"
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
              placeholder={commonHeight !== null ? commonHeight.toFixed(2) : 'Altura personalizada'}
              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={!customHeight || parseFloat(customHeight) <= 0}
              onClick={() => {
                const val = parseFloat(customHeight);
                if (val > 0) handleApplyHeight(val);
              }}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-[11px] font-bold border border-blue-200 transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* 4. TIPOLOGÍA DE CERRAMIENTO EN BLOQUE */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Tipología de Cerramiento:</span>
            {commonWallType === null && (
              <span className="text-[10px] font-semibold text-amber-700">*(Tipologías distintas)*</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {WALL_TYPE_OPTIONS.map((opt) => {
              const isSelected = commonWallType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleApplyWallType(opt.id)}
                  className={`px-2 py-1.5 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <span className="text-[11px] truncate">{opt.label}</span>
                  {isSelected && <CheckCircle2 size={12} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. JUSTIFICACIÓN / EJE DE ALINEACIÓN EN BLOQUE */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Justificación / Eje:</span>
            {commonJustification === null && (
              <span className="text-[10px] font-semibold text-amber-700">*(Ejes distintos)*</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {WALL_JUSTIFICATION_OPTIONS.map((opt) => {
              const isSelected = commonJustification === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleApplyJustification(opt.id)}
                  className={`py-1 px-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center truncate ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title={opt.title}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. MURO PORTANTE / ESTRUCTURAL EN BLOQUE */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Carácter Portante:</span>
            {commonIsBearing === null && (
              <span className="text-[10px] font-semibold text-amber-700">*(Estados distintos)*</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleApplyBearing(true)}
              className={`py-1 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center ${
                commonIsBearing === true
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Portante / Medianera
            </button>
            <button
              type="button"
              onClick={() => handleApplyBearing(false)}
              className={`py-1 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center ${
                commonIsBearing === false
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Tabique / Simple
            </button>
          </div>
        </div>

        {/* 7. ELIMINAR PAREDES EN LOTE */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `¿Estás seguro de eliminar las ${selectedWalls.length} paredes seleccionadas junto con sus aberturas asociadas?`
                )
              ) {
                onBatchDelete();
              }
            }}
            className="w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 size={13} className="text-red-600 shrink-0" />
            <span>Eliminar {selectedWalls.length} Paredes Seleccionadas</span>
          </button>
        </div>
      </div>
    );
  }
);

BulkWallEditPanel.displayName = 'BulkWallEditPanel';
