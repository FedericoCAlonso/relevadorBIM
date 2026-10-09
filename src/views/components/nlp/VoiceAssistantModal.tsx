/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: VoiceAssistantModal.tsx
 * Responsabilidad Única:
 * Modal y Drawer de dictado por voz y comandos en lenguaje natural.
 * Principio de Cero Ruido Contextual y Progressive Disclosure.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Sparkles, Loader2, Cpu } from 'lucide-react';
import type { UseSpeechRecognitionReturn } from '../../../viewmodels/useSpeechRecognition';
import type { WebLlmStatus, WebLlmProgress } from '../../../services/nlp/WebLlmExtractor';
import type { NaturalLanguageExecutionResult } from '../../../services/nlp/naturalLanguageTranslator';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputText: string;
  setInputText: (text: string) => void;
  isProcessing: boolean;
  llmStatus: WebLlmStatus;
  llmProgress: WebLlmProgress;
  lastResult: NaturalLanguageExecutionResult | null;
  speech: UseSpeechRecognitionReturn;
  onExecute: (text: string) => void;
  onInitLocalModel: () => void;
}

const QUICK_SUGGESTIONS = [
  'Living comedor de 4 por 6',
  'Dormitorio de 3.5x4 pegado a pared este',
  'Poné un toma doble a 1.20 en pared derecha',
  'Boca de techo centrada con circuito 1',
  'Conectar este toma con la boca de techo por losa',
  'Medición PAT 12.5 ohms'
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  inputText,
  setInputText,
  isProcessing,
  llmStatus,
  llmProgress,
  lastResult,
  speech,
  onExecute,
  onInitLocalModel
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onExecute(inputText);
    }
  };

  const handleMicToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
    } else {
      speech.startListening();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Asistente de Relevamiento</h2>
              <p className="text-xs text-slate-400">Dictado o texto en lenguaje natural de obra</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Zona Central: Micrófono y Ondas */}
        <div className="my-6 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={handleMicToggle}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all shadow-lg ${
              speech.isListening
                ? 'border-rose-500 bg-rose-600/30 text-rose-400 shadow-rose-500/30 animate-pulse'
                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:scale-105'
            }`}
            title={speech.isListening ? 'Detener micrófono' : 'Iniciar dictado por voz'}
          >
            {speech.isListening ? <Mic className="h-9 w-9" /> : <MicOff className="h-9 w-9" />}
          </button>

          <p className="mt-3 text-xs font-medium text-slate-300">
            {speech.isListening ? '🎙 Escuchando... Hablá ahora' : 'Tocá el micrófono para dictar'}
          </p>

          {speech.interimTranscript && (
            <p className="mt-2 text-xs italic text-cyan-300/80 animate-fade-in max-w-sm text-center">
              "{speech.interimTranscript}..."
            </p>
          )}

          {speech.errorMessage && (
            <p className="mt-2 text-xs text-rose-400 text-center">{speech.errorMessage}</p>
          )}
        </div>

        {/* Formulario de Entrada */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ej: Living de 4x6 con puerta al frente..."
            disabled={isProcessing}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 transition-colors"
            title="Enviar comando (Enter)"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {/* Feedback de Error si no se interpretó */}
        {lastResult && !lastResult.success && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
            {lastResult.message}
          </div>
        )}

        {/* Sugerencias Rápidas */}
        <div className="mt-4">
          <p className="text-[11px] font-medium text-slate-400 mb-2">Comandos frecuentes de ejemplo:</p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {QUICK_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(sug);
                  onExecute(sug);
                }}
                disabled={isProcessing}
                className="rounded-lg border border-slate-800 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-300 transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Footer: Estado del Motor Local */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              {llmStatus === 'ready'
                ? 'IA Local lista (Qwen 0.5B)'
                : llmStatus === 'downloading'
                ? `Descargando IA local (${Math.round(llmProgress.progress * 100)}%)`
                : 'Motor instantáneo activo (<1ms)'}
            </span>
          </div>

          {llmStatus === 'idle' && (
            <button
              type="button"
              onClick={onInitLocalModel}
              className="text-cyan-400 hover:underline hover:text-cyan-300"
            >
              Habilitar IA Local Offline
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
