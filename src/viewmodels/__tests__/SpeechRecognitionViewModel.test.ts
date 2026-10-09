import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechRecognitionService } from '../../services/speechRecognitionService';

describe('SpeechRecognitionService — Driver Web Speech API', () => {
  let service: SpeechRecognitionService;

  beforeEach(() => {
    service = new SpeechRecognitionService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('detecta correctamente cuando no hay soporte en el navegador', () => {
    (globalThis as any).window = {
      location: { protocol: 'https:', hostname: 'localhost' }
    };

    expect(service.isSupported()).toBe(false);
    expect(service.getAvailabilityError()).toContain('no soporta reconocimiento de voz nativo');

    const onError = vi.fn();
    const started = service.start({ onError });

    expect(started).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('no soporta reconocimiento de voz nativo')
    );
  });

  it('detecta falta de contexto seguro (HTTP en IP externa)', () => {
    (globalThis as any).window = {
      location: { protocol: 'http:', hostname: '192.168.1.50' },
      webkitSpeechRecognition: class MockSpeech {}
    };

    expect(service.isSupported()).toBe(true);
    expect(service.isSecureContext()).toBe(false);
    expect(service.getAvailabilityError()).toContain('requiere una conexión segura (HTTPS)');

    const onError = vi.fn();
    const started = service.start({ onError });

    expect(started).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('requiere conexión segura (HTTPS)')
    );
  });

  it('inicia sesión, emite transcripciones finales y gestiona ciclo de vida', () => {
    const mockStart = vi.fn();
    const mockStop = vi.fn();
    let instanceHolder: any = null;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = true;
      lang = 'es-AR';
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onresult: ((e: any) => void) | null = null;

      start() {
        mockStart();
        instanceHolder = this;
        this.onstart?.();
      }
      stop() {
        mockStop();
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }

    (globalThis as any).window = {
      location: { protocol: 'https:', hostname: 'relevadorbim.com' },
      webkitSpeechRecognition: MockSpeechRecognition
    };

    expect(service.isSupported()).toBe(true);
    expect(service.isSecureContext()).toBe(true);
    expect(service.getAvailabilityError()).toBeNull();

    const onStart = vi.fn();
    const onFinalResult = vi.fn();
    const onEnd = vi.fn();

    const started = service.start({ onStart, onFinalResult, onEnd });
    expect(started).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);

    // Simular recepción de texto
    instanceHolder.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'living de 4 por 6' }], { isFinal: true })
      ]
    });

    expect(onFinalResult).toHaveBeenCalledWith('living de 4 por 6');

    // Detener
    service.stop();
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('traduce errores de permiso denegado, red y sin voz a mensajes amigables en español', () => {
    let instanceHolder: any = null;

    class MockSpeechRecognition {
      onstart: any = null;
      onerror: any = null;
      onend: any = null;

      start() {
        instanceHolder = this;
        this.onstart?.();
      }
      abort() {}
    }

    (globalThis as any).window = {
      location: { protocol: 'https:', hostname: 'localhost' },
      SpeechRecognition: MockSpeechRecognition
    };

    const onError = vi.fn();
    service.start({ onError });

    // Permiso denegado
    instanceHolder.onerror({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('Permiso de micrófono denegado')
    );

    // Error de red
    service.start({ onError });
    instanceHolder.onerror({ error: 'network' });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('Error de red con el servicio de voz')
    );

    // No speech
    service.start({ onError });
    instanceHolder.onerror({ error: 'no-speech' });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('No se detectó audio')
    );
  });
});
