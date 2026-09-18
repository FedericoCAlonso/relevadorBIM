/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: UnderlayCalibrationModal.tsx (Patrón Estricto MVVM)
 * Modal minimalista para calibración métrica en 2 clics de planos de fondo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef } from 'react';
import { Ruler, X, Check } from 'lucide-react';

interface UnderlayCalibrationModalProps {
  isOpen: boolean;
  initialDistanceM?: number;
  onClose: () => void;
  onConfirm: (realDistanceM: number) => void;
}

export const UnderlayCalibrationModal: React.FC<UnderlayCalibrationModalProps> = ({
  isOpen,
  initialDistanceM = 3.50,
  onClose,
  onConfirm
}) => {
  const [distanceInput, setDistanceInput] = useState<string>(initialDistanceM.toFixed(2));
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDistanceInput(initialDistanceM > 0 ? initialDistanceM.toFixed(2) : '3.50');
    }
  }

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(distanceInput);
    if (!isNaN(val) && val > 0) {
      onConfirm(val);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <Ruler size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                Calibrar Escala del Plano
              </h3>
              <p className="text-[11px] text-slate-500">
                Paso 2 de 2: Definir cota real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Distancia real entre los 2 puntos marcados:
            </label>
            <div className="flex items-center bg-slate-100 border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 rounded-2xl px-3.5 py-2 transition-all">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0.05"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
                className="w-full bg-transparent font-mono font-bold text-lg text-slate-800 outline-none"
                placeholder="Ej. 4.20"
                required
              />
              <span className="text-xs font-bold text-slate-400 ml-2">metros</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Tip: Indicá la medida que figura en la cota del plano (ej. 3.00, 4.20, 5.50).
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <Check size={14} />
              <span>Calibrar Plano</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
