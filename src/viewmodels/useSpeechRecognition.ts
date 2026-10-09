/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useSpeechRecognition.ts
 * Responsabilidad Única:
 * Hook reactivo para captura de voz y dictado de campo en componentes React.
 * Conecta la UI con SpeechRecognitionService manteniendo estado reactivo limpio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { speechRecognitionService } from '../services/speechRecognitionService';

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

  const [isSupported] = useState(() => speechRecognitionService.isSupported());
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    speechRecognitionService.getAvailabilityError()
  );

  const onFinalResultRef = useRef(onFinalResult);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    return () => {
      speechRecognitionService.abort();
    };
  }, []);

  const stopListening = useCallback(() => {
    speechRecognitionService.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setErrorMessage(null);
    setTranscript('');
    setInterimTranscript('');

    const started = speechRecognitionService.start(
      {
        onStart: () => {
          setIsListening(true);
          setErrorMessage(null);
        },
        onInterimResult: (interim) => {
          setInterimTranscript(interim);
        },
        onFinalResult: (finalText) => {
          setTranscript(finalText);
          setInterimTranscript('');
          onFinalResultRef.current?.(finalText);
        },
        onError: (err) => {
          setIsListening(false);
          setErrorMessage(err);
        },
        onEnd: () => {
          setIsListening(false);
        }
      },
      lang
    );

    if (!started) {
      setIsListening(false);
    }
  }, [lang]);

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
