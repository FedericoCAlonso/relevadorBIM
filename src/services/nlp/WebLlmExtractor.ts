/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO NLP: WebLlmExtractor.ts
 * Responsabilidad Única:
 * Extractor semántico local on-device (Módulo 1B). Ejecuta un LLM liviano
 * (Qwen2.5-0.5B-Instruct) directamente en el navegador con WebLLM y WebGPU,
 * forzando la salida a NaturalLanguageIntent mediante Constrained Decoding
 * (XGrammar / JSON Schema).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { parseNaturalLanguageFast } from './FastPatternParser';
import {
  NaturalLanguageIntentSchema,
  type NaturalLanguageIntent
} from './naturalLanguageSchema';

export type WebLlmStatus =
  | 'idle'
  | 'checking_support'
  | 'unsupported'
  | 'downloading'
  | 'ready'
  | 'inferring'
  | 'error';

export interface WebLlmProgress {
  text: string;
  progress: number; // 0 a 1
}

export const RECOMMENDED_NLP_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

// System prompt técnico especializado en español de obra
const SYSTEM_PROMPT = `Eres un asistente de relevamiento electromecánico y arquitectónico de obra para RelevadorBIM.
Tu única tarea es extraer la intención del usuario a partir del texto en español y responder ÚNICAMENTE con un objeto JSON válido según el esquema definido.

Reglas obligatorias:
1. Si el usuario pide crear un ambiente (living, cocina, dormitorio), usa action: "create_space".
2. Si pide colocar una puerta, ventana, vano o abertura en un muro, usa action: "place_opening".
3. Si pide colocar una boca, toma, llave, centro de luz o tablero, usa action: "place_element".
4. Si pide conectar caños o conductos, usa action: "connect_conduit".
5. Si menciona mediciones de PAT, jabalina o tensión, usa action: "record_measurement".
6. No agregues explicaciones, markdown ni texto fuera del JSON.`;

// JSON Schema derivado para XGrammar
const INTENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['create_space', 'place_opening', 'place_element', 'connect_conduit', 'record_measurement']
    },
    openingType: {
      type: 'string',
      enum: ['door', 'window', 'passage']
    },
    referenceCornerWall: {
      type: 'string',
      enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo']
    },
    distanceM: { type: 'number' },
    centered: { type: 'boolean' },
    name: { type: 'string' },
    dimensions: {
      type: 'object',
      properties: {
        widthM: { type: 'number' },
        lengthM: { type: 'number' }
      }
    },
    elementCategory: {
      type: 'string',
      enum: ['toma', 'llave', 'iluminacion_techo', 'aplique_pared', 'tablero', 'caja_paso']
    },
    mountType: { type: 'string', enum: ['wall', 'ceiling'] },
    heightZM: { type: 'number' },
    circuitNumber: { type: 'string' },
    wallReference: {
      type: 'string',
      enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo']
    },
    routingPlane: { type: 'string', enum: ['ceiling_slab', 'floor_slab', 'wall'] },
    diameterMM: { type: 'number' },
    measurementType: {
      type: 'string',
      enum: ['pat_resistance', 'voltage_fn', 'voltage_ft', 'voltage_nt', 'insulation', 'current']
    },
    value: { type: 'number' },
    unit: { type: 'string' }
  },
  required: ['action']
};

class WebLlmService {
  private engine: any = null;
  private status: WebLlmStatus = 'idle';
  private statusListeners: Array<(status: WebLlmStatus) => void> = [];
  private progressListeners: Array<(progress: WebLlmProgress) => void> = [];

  public getStatus(): WebLlmStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: WebLlmStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  public onProgressChange(listener: (progress: WebLlmProgress) => void): () => void {
    this.progressListeners.push(listener);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: WebLlmStatus) {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private setProgress(progress: WebLlmProgress) {
    this.progressListeners.forEach((l) => l(progress));
  }

  /**
   * Verifica compatibilidad de WebGPU en el navegador actual.
   */
  public async isWebGpuSupported(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Inicializa y descarga el modelo WebLLM en la caché local del navegador (IndexedDB).
   */
  public async initEngine(modelId: string = RECOMMENDED_NLP_MODEL): Promise<boolean> {
    if (this.engine) return true;

    this.setStatus('checking_support');
    const supported = await this.isWebGpuSupported();
    if (!supported) {
      this.setStatus('unsupported');
      return false;
    }

    this.setStatus('downloading');
    try {
      // Importación dinámica para no penalizar bundles en dispositivos sin WebGPU
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          this.setProgress({
            text: report.text,
            progress: report.progress
          });
        }
      });

      this.setStatus('ready');
      return true;
    } catch (err) {
      console.error('Error al inicializar WebLLM Engine:', err);
      this.setStatus('error');
      return false;
    }
  }

  /**
   * Ejecuta la inferencia con el modelo local forzando JSON con XGrammar.
   */
  public async extractWithLlm(text: string): Promise<NaturalLanguageIntent | null> {
    if (!this.engine) {
      const initialized = await this.initEngine();
      if (!initialized || !this.engine) return null;
    }

    this.setStatus('inferring');
    try {
      const completion = await this.engine.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        response_format: {
          type: 'json_object',
          schema: JSON.stringify(INTENT_JSON_SCHEMA)
        },
        temperature: 0.1,
        max_tokens: 256
      });

      this.setStatus('ready');
      const rawJson = completion.choices[0]?.message?.content;
      if (!rawJson) return null;

      const parsed = JSON.parse(rawJson);
      const validation = NaturalLanguageIntentSchema.safeParse(parsed);
      return validation.success ? validation.data : null;
    } catch (err) {
      console.error('Error durante inferencia WebLLM:', err);
      this.setStatus('error');
      return null;
    }
  }
}

export const webLlmService = new WebLlmService();

/**
 * Orquestador principal de extracción híbrida:
 * 1. Primero intenta con FastPatternParser (<1ms, 0MB, sin WebGPU).
 * 2. Si no encaja, recurre al modelo on-device WebLLM con XGrammar.
 */
export async function extractNaturalLanguageIntent(text: string): Promise<{
  intent: NaturalLanguageIntent | null;
  source: 'fast_pattern' | 'web_llm' | 'none';
}> {
  // Nivel 0: Parser determinístico ultrarrápido
  const fastResult = parseNaturalLanguageFast(text);
  if (fastResult) {
    return { intent: fastResult, source: 'fast_pattern' };
  }

  // Nivel 1: Inferencia con modelo local WebLLM
  const isGpuReady = await webLlmService.isWebGpuSupported();
  if (isGpuReady) {
    const llmResult = await webLlmService.extractWithLlm(text);
    if (llmResult) {
      return { intent: llmResult, source: 'web_llm' };
    }
  }

  return { intent: null, source: 'none' };
}
