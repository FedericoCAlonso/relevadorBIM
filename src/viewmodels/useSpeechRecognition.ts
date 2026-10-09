/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useSpeechRecognition.ts
 * Responsabilidad Única:
 * Hook reactivo para captura de voz y dictado de campo mediante la
 * Web Speech API nativa del navegador (SpeechRecognition / webkitSpeechRecognition).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(options?: {
  lang?: string;
  onFinalResult?: (finalText: string) => void;
}): UseSpeechRecognitionReturn {
  const { lang = 'es-AR', onFinalResult } = options ?? {};

  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onFinalResultRef = useRef(onFinalResult);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalStr += item[0].transcript;
          } else {
            interimStr += item[0].transcript;
          }
        }

        if (finalStr) {
          const trimmed = finalStr.trim();
          setTranscript(trimmed);
          setInterimTranscript('');
          onFinalResultRef.current?.(trimmed);
        } else {
          setInterimTranscript(interimStr);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setErrorMessage(`Error de micrófono: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignorar error al desmontar
        }
      }
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setErrorMessage(null);
    setTranscript('');
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
    } catch {
      // Si ya estaba activo, reiniciar
      recognitionRef.current.stop();
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch (e: any) {
          setErrorMessage(e?.message || 'No se pudo iniciar el micrófono');
        }
      }, 100);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Ignorar si ya estaba detenido
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript
  };
}
