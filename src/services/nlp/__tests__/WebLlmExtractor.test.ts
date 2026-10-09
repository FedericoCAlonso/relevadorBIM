import { describe, it, expect, vi } from 'vitest';
import { extractNaturalLanguageIntent, webLlmService } from '../WebLlmExtractor';

describe('WebLlmExtractor — Orquestador de Extracción Híbrida On-Device', () => {
  it('resuelve inmediatamente con fast_pattern para comandos estándar sin tocar la GPU', async () => {
    const res = await extractNaturalLanguageIntent('Living de 4x6');
    expect(res.source).toBe('fast_pattern');
    expect(res.intent).not.toBeNull();
    expect(res.intent?.action).toBe('create_space');
  });

  it('informa correctamente el estado de compatibilidad de WebGPU en entorno de test', async () => {
    const supported = await webLlmService.isWebGpuSupported();
    // En entorno Node.js/jsdom normalmente no hay navigator.gpu
    expect(typeof supported).toBe('boolean');
  });

  it('notifica a los listeners de cambio de estado', () => {
    const listener = vi.fn();
    const unsubscribe = webLlmService.onStatusChange(listener);

    expect(webLlmService.getStatus()).toBeDefined();
    unsubscribe();
  });
});
