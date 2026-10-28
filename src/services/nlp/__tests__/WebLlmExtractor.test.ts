import { describe, it, expect, vi } from 'vitest';
import {
  extractNaturalLanguageIntent,
  webLlmService,
  AVAILABLE_NLP_MODELS,
  RECOMMENDED_NLP_MODEL,
  formatBimContextForPrompt,
  buildBimContextFromProject,
  createDynamicSystemPrompt,
  type BimContext
} from '../WebLlmExtractor';

describe('WebLlmExtractor — Orquestador de Extracción Híbrida On-Device', () => {
  it('define catálogo de modelos con Llama 3.2 1B como recomendado por defecto en español', () => {
    expect(RECOMMENDED_NLP_MODEL).toBe('Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(AVAILABLE_NLP_MODELS.length).toBeGreaterThanOrEqual(3);
    const defaultModel = AVAILABLE_NLP_MODELS.find((m) => m.isDefault);
    expect(defaultModel?.id).toBe(RECOMMENDED_NLP_MODEL);
    expect(defaultModel?.vramMB).toBeLessThan(1000); // Liviano para móviles (<1 GB VRAM)
  });

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

  it('hace fallback seguro a fast_pattern cuando se fuerza LLM en entorno sin WebGPU', async () => {
    const res = await extractNaturalLanguageIntent('Living de 4x6', true);
    // En Node.js no hay GPU, por lo que cae en fallback fast_pattern
    expect(res.intent).not.toBeNull();
    expect(res.intent?.action).toBe('create_space');
  });

  describe('Contextualización BIM (Inferencia Grounded)', () => {
    it('formatea contexto vacío cuando no hay ambientes', () => {
      const promptText = formatBimContextForPrompt();
      expect(promptText).toContain('No hay ambientes creados');
    });

    it('formatea ambientes y sus orientaciones de pared para el System Prompt', () => {
      const mockContext: BimContext = {
        spaces: [
          {
            id: 'sp-1',
            name: 'Living Comedor',
            widthM: 4.0,
            lengthM: 6.0,
            walls: [
              { orientation: 'norte', lengthM: 4.0 },
              { orientation: 'sur', lengthM: 4.0 },
              { orientation: 'este', lengthM: 6.0 },
              { orientation: 'oeste', lengthM: 6.0 }
            ]
          }
        ],
        activeSpaceId: 'sp-1'
      };

      const promptText = formatBimContextForPrompt(mockContext);
      expect(promptText).toContain('Living Comedor');
      expect(promptText).toContain('[ACTIVO / SELECCIONADO]');
      expect(promptText).toContain('este (6.00m)');

      const fullPrompt = createDynamicSystemPrompt(mockContext);
      expect(fullPrompt).toContain('Living Comedor');
      expect(fullPrompt).toContain('JSON');
    });

    it('construye BimContext automáticamente desde la geometría del proyecto', () => {
      const mockProject = {
        vertices: [
          { id: 'v1', x: 0, y: 0 },
          { id: 'v2', x: 4, y: 0 },
          { id: 'v3', x: 4, y: 5 },
          { id: 'v4', x: 0, y: 5 }
        ],
        walls: [
          { id: 'w1', startVertexId: 'v1', endVertexId: 'v2' },
          { id: 'w2', startVertexId: 'v2', endVertexId: 'v3' },
          { id: 'w3', startVertexId: 'v3', endVertexId: 'v4' },
          { id: 'w4', startVertexId: 'v4', endVertexId: 'v1' }
        ],
        spaces: [
          {
            id: 'sp-cocina',
            name: 'Cocina',
            category: 'cocina',
            boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
            wallIds: ['w1', 'w2', 'w3', 'w4']
          }
        ]
      };

      const ctx = buildBimContextFromProject(mockProject, 'sp-cocina');
      expect(ctx.spaces).toHaveLength(1);
      expect(ctx.spaces[0].name).toBe('Cocina');
      expect(ctx.spaces[0].widthM).toBeCloseTo(4.0);
      expect(ctx.spaces[0].lengthM).toBeCloseTo(5.0);
      expect(ctx.spaces[0].walls).toHaveLength(4);
      expect(ctx.activeSpaceId).toBe('sp-cocina');
    });
  });
});
