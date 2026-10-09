/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useVoiceAssistantViewModel.ts
 * Responsabilidad Única:
 * Orquestador reactivo del asistente por voz y texto en lenguaje natural.
 * Conecta la captura de voz (Web Speech API), la extracción semántica híbrida
 * (FastPatternParser / WebLLM) y la ejecución determinística (naturalLanguageTranslator).
 * Gestiona el Toast de confirmación con cuenta regresiva y deshacer en 1 toque.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from './useProjectStore';
import { useSpeechRecognition } from './useSpeechRecognition';
import {
  webLlmService,
  extractNaturalLanguageIntent,
  type WebLlmStatus,
  type WebLlmProgress
} from '../services/nlp/WebLlmExtractor';
import {
  executeNaturalLanguageIntent,
  type NaturalLanguageExecutionResult
} from '../services/nlp/naturalLanguageTranslator';

export interface PendingConfirmationState {
  message: string;
  source: 'fast_pattern' | 'web_llm';
  autoConfirmSecondsLeft: number;
}

export function useVoiceAssistantViewModel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmStatus, setLlmStatus] = useState<WebLlmStatus>(webLlmService.getStatus());
  const [llmProgress, setLlmProgress] = useState<WebLlmProgress>({ text: '', progress: 0 });
  const [lastResult, setLastResult] = useState<NaturalLanguageExecutionResult | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationState | null>(null);

  const timerRef = useRef<any>(null);

  // Escuchar cambios de estado y progreso del modelo local
  useEffect(() => {
    const unsubStatus = webLlmService.onStatusChange(setLlmStatus);
    const unsubProgress = webLlmService.onProgressChange(setLlmProgress);
    return () => {
      unsubStatus();
      unsubProgress();
    };
  }, []);

  // Timer para auto-confirmación en 3 segundos
  useEffect(() => {
    if (!pendingConfirmation) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setPendingConfirmation((prev) => {
        if (!prev) return null;
        if (prev.autoConfirmSecondsLeft <= 1) {
          clearInterval(timerRef.current);
          return null; // Auto-confirmado
        }
        return {
          ...prev,
          autoConfirmSecondsLeft: prev.autoConfirmSecondsLeft - 1
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pendingConfirmation]);

  // Manejo de atajo universal Ctrl+K / Cmd+K para abrir el asistente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsModalOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const executeCommand = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsProcessing(true);
    setLastResult(null);

    try {
      // 1. Extraer intención con orquestador híbrido
      const extraction = await extractNaturalLanguageIntent(trimmed);

      if (!extraction.intent) {
        setLastResult({
          success: false,
          message: 'No se pudo interpretar la intención del comando. Probá con una frase más directa.'
        });
        setIsProcessing(false);
        return;
      }

      // 2. Ejecutar traducción determinística
      const result = executeNaturalLanguageIntent(extraction.intent);
      setLastResult(result);

      if (result.success) {
        // Cerrar modal de dictado si estaba abierto
        setIsModalOpen(false);
        setInputText('');

        // Activar tarjeta Toast de confirmación con 3 segundos
        setPendingConfirmation({
          message: result.message,
          source: extraction.source === 'fast_pattern' ? 'fast_pattern' : 'web_llm',
          autoConfirmSecondsLeft: 3
        });
      }
    } catch (err: any) {
      setLastResult({
        success: false,
        message: `Error al procesar comando: ${err?.message || 'Error desconocido'}`
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Integración de reconocimiento de voz
  const speech = useSpeechRecognition({
    onFinalResult: (finalStr) => {
      setInputText(finalStr);
      executeCommand(finalStr);
    }
  });

  // Detener el micrófono si se cierra el modal
  useEffect(() => {
    if (!isModalOpen && speech.isListening) {
      speech.stopListening();
    }
  }, [isModalOpen, speech.isListening, speech.stopListening]);

  const confirmPending = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const discardPending = useCallback(() => {
    // Revertir la acción ejecutada usando el motor de Undo
    const { canUndo, undo } = useProjectStore.getState();
    if (canUndo) {
      undo();
    }
    setPendingConfirmation(null);
  }, []);

  const initLocalModel = useCallback(async () => {
    await webLlmService.initEngine();
  }, []);

  return {
    isModalOpen,
    setIsModalOpen,
    inputText,
    setInputText,
    isProcessing,
    llmStatus,
    llmProgress,
    lastResult,
    pendingConfirmation,
    speech,
    executeCommand,
    confirmPending,
    discardPending,
    initLocalModel
  };
}
