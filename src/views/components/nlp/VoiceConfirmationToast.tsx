/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: VoiceConfirmationToast.tsx
 * Responsabilidad Única:
 * Toast interactivo de confirmación en el borde inferior de la pantalla.
 * Permite confirmar o deshacer la acción ejecutada en 1 toque antes de 3s.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Check, Undo2, Zap, Brain } from 'lucide-react';
import type { PendingConfirmationState } from '../../../viewmodels/useVoiceAssistantViewModel';

interface VoiceConfirmationToastProps {
  pending: PendingConfirmationState | null;
  onConfirm: () => void;
  onDiscard: () => void;
}

export const VoiceConfirmationToast: React.FC<VoiceConfirmationToastProps> = ({
  pending,
  onConfirm,
  onDiscard
}) => {
  if (!pending) return null;

  const isFast = pending.source === 'fast_pattern';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-md animate-slide-up">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md text-slate-100">
        <div className="flex items-center justify-between gap-3">
          {/* Icono e Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isFast
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              {isFast ? <Zap className="h-5 w-5" /> : <Brain className="h-5 w-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">Comando Ejecutado</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {isFast ? '⚡ Instantáneo' : '🧠 IA Local'}
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate">{pending.message}</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDiscard}
              className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
              title="Deshacer acción (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Deshacer</span>
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 transition-colors shadow-sm"
              title="Confirmar"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{pending.autoConfirmSecondsLeft}s</span>
            </button>
          </div>
        </div>

        {/* Barra de progreso de cuenta regresiva */}
        <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
          <div
            className="h-full bg-cyan-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(pending.autoConfirmSecondsLeft / 3) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
