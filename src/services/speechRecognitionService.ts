/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: speechRecognitionService.ts
 * Responsabilidad Única:
 * Driver de captura de voz para Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Gestiona el ciclo de vida por sesión, verificación de contexto seguro (HTTPS)
 * y traducción de errores a mensajes claros en español.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onInterimResult?: (interim: string) => void;
  onFinalResult?: (finalText: string) => void;
  onError?: (errorMsg: string) => void;
  onEnd?: () => void;
}

export class SpeechRecognitionService {
  private activeRecognition: any = null;

  /**
   * Verifica si el navegador actual soporta la Web Speech API nativa.
   */
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Verifica si el entorno actual cumple con los requisitos de contexto seguro (HTTPS o localhost).
   */
  public isSecureContext(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }

  /**
   * Diagnostica por qué el micrófono no está disponible si es el caso.
   */
  public getAvailabilityError(): string | null {
    if (!this.isSupported()) {
      return 'Este navegador no soporta reconocimiento de voz nativo (Web Speech API). Probá en Google Chrome, Edge o Safari, o ingresá comandos escribiendo en el campo de texto.';
    }
    if (!this.isSecureContext()) {
      return 'El acceso al micrófono requiere una conexión segura (HTTPS). Podés ingresar los comandos escribiendo en el campo de texto.';
    }
    return null;
  }

  /**
   * Inicia una sesión de reconocimiento de voz.
   */
  public start(callbacks: SpeechRecognitionCallbacks, lang: string = 'es-AR'): boolean {
    if (typeof window === 'undefined') return false;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      callbacks.onError?.(
        'Este navegador no soporta reconocimiento de voz nativo (Web Speech API). Usá Chrome, Edge o Safari, o ingresá comandos por texto.'
      );
      return false;
    }

    if (!this.isSecureContext()) {
      callbacks.onError?.(
        'El acceso al micrófono requiere conexión segura (HTTPS). Podés ingresar los comandos escribiendo abajo.'
      );
      return false;
    }

    // Abortar sesión previa si existía para evitar estados inválidos
    this.abort();

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        callbacks.onStart?.();
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
          callbacks.onFinalResult?.(finalStr.trim());
        } else if (interimStr) {
          callbacks.onInterimResult?.(interimStr);
        }
      };

      recognition.onerror = (event: any) => {
        this.activeRecognition = null;

        switch (event.error) {
          case 'not-allowed':
            callbacks.onError?.(
              'Permiso de micrófono denegado. Habilitá el acceso al micrófono en los permisos de tu navegador.'
            );
            break;
          case 'no-speech':
            callbacks.onError?.(
              'No se detectó audio. Tocá el micrófono e intentá hablar más cerca.'
            );
            break;
          case 'audio-capture':
            callbacks.onError?.(
              'No se detectó ningún micrófono conectado a este dispositivo.'
            );
            break;
          case 'network':
            callbacks.onError?.(
              'Error de red con el servicio de voz de Google. Verificá tu conexión a internet o usá el campo de texto.'
            );
            break;
          case 'aborted':
            // Detenido por el usuario
            break;
          default:
            callbacks.onError?.(`Error de micrófono: ${event.error}`);
            break;
        }
      };

      recognition.onend = () => {
        this.activeRecognition = null;
        callbacks.onEnd?.();
      };

      this.activeRecognition = recognition;
      recognition.start();
      return true;
    } catch (err: any) {
      this.activeRecognition = null;
      callbacks.onError?.(`No se pudo iniciar el micrófono: ${err?.message || 'Error desconocido'}`);
      return false;
    }
  }

  /**
   * Detiene suavemente la sesión de escucha activa.
   */
  public stop(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch {
        // Ignorar
      }
      this.activeRecognition = null;
    }
  }

  /**
   * Aborta inmediatamente la sesión activa sin esperar resultados.
   */
  public abort(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.abort();
      } catch {
        // Ignorar
      }
      this.activeRecognition = null;
    }
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
