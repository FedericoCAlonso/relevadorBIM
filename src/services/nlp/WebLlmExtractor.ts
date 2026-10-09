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

// System prompt técnico especializado en español de obra con Few-Shot Examples canónicos
const SYSTEM_PROMPT = `Eres un asistente de relevamiento electromecánico y arquitectónico de obra para RelevadorBIM.
Tu única tarea es extraer la intención del usuario a partir del texto en español y responder ÚNICAMENTE con un objeto JSON válido según el esquema definido.

Reglas obligatorias:
1. Si el usuario pide crear un ambiente (living, cocina, dormitorio), usa action: "create_space".
2. Si pide colocar una puerta, ventana, vano o abertura en un muro, usa action: "place_opening".
3. Si pide colocar una boca, toma, llave, centro de luz o tablero, usa action: "place_element".
4. Si pide conectar caños o conductos, usa action: "connect_conduit".
5. Si menciona mediciones de PAT, jabalina o tensión, usa action: "record_measurement".
6. No agregues explicaciones, markdown ni texto fuera del JSON.

Ejemplos canónicos:
Usuario: "living de 4 por 10.3"
JSON: {"action":"create_space","name":"Living","dimensions":{"widthM":4,"lengthM":10.3}}

Usuario: "balcón pegado a pared sur de 4.5 por 1"
JSON: {"action":"create_space","name":"Balcon","dimensions":{"widthM":4.5,"lengthM":1},"relativeTo":{"sharedWall":"sur"}}

Usuario: "dormitorio de 3.5x4 pegado a pared este del living"
JSON: {"action":"create_space","name":"Dormitorio","dimensions":{"widthM":3.5,"lengthM":4},"relativeTo":{"sharedWall":"este","targetSpaceName":"Living"}}

Usuario: "puerta en pared norte a 0.2m de pared este"
JSON: {"action":"place_opening","openingType":"door","wallReference":"norte","referenceCornerWall":"este","distanceM":0.2}

Usuario: "ventana centrada en pared sur de 1.20"
JSON: {"action":"place_opening","openingType":"window","wallReference":"sur","centered":true,"widthM":1.2}

Usuario: "pone un toma doble a 1.20 en pared derecha"
JSON: {"action":"place_element","elementCategory":"toma","mountType":"wall","heightZM":1.2,"wallReference":"derecha"}

Usuario: "boca de iluminacion centrada en el techo con circuito 1"
JSON: {"action":"place_element","elementCategory":"iluminacion_techo","mountType":"ceiling","centeredInRoom":true,"circuitNumber":"1"}

Usuario: "conecta este toma con la boca de techo por losa con caño de 19"
JSON: {"action":"connect_conduit","routingPlane":"ceiling_slab","diameterMM":19,"toElementRef":"ceiling"}

Usuario: "medición PAT 12.5 ohms"
JSON: {"action":"record_measurement","measurementType":"pat_resistance","value":12.5,"unit":"Ω"}`;

// JSON Schema completo para XGrammar Constrained Decoding
const INTENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['create_space', 'place_opening', 'place_element', 'connect_conduit', 'record_measurement']
    },
    name: { type: 'string' },
    category: {
      type: 'string',
      enum: ['living_comedor', 'dormitorio', 'cocina', 'bano', 'circulacion', 'balcon', 'otro']
    },
    dimensions: {
      type: 'object',
      properties: {
        widthM: { type: 'number' },
        lengthM: { type: 'number' }
      },
      required: ['widthM', 'lengthM']
    },
    relativeTo: {
      type: 'object',
      properties: {
        sharedWall: {
          type: 'string',
          enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo']
        },
        targetSpaceName: { type: 'string' }
      }
    },
    openingType: {
      type: 'string',
      enum: ['door', 'window', 'passage']
    },
    wallReference: {
      type: 'string',
      enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo']
    },
    referenceCornerWall: {
      type: 'string',
      enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo']
    },
    distanceM: { type: 'number' },
    centered: { type: 'boolean' },
    widthM: { type: 'number' },
    elementCategory: {
      type: 'string',
      enum: ['toma', 'llave', 'iluminacion_techo', 'aplique_pared', 'tablero', 'caja_paso']
    },
    mountType: { type: 'string', enum: ['wall', 'ceiling'] },
    heightZM: { type: 'number' },
    circuitNumber: { type: 'string' },
    centeredInRoom: { type: 'boolean' },
    routingPlane: { type: 'string', enum: ['ceiling_slab', 'floor_slab', 'wall'] },
    diameterMM: { type: 'number' },
    toElementRef: { type: 'string' },
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
 * Orquestador principal de extracción semántica:
 * @param text Frase en lenguaje natural
 * @param forceLlm Si es true, prioriza directamente el modelo WebLLM sobre el parser determinista.
 */
export async function extractNaturalLanguageIntent(
  text: string,
  forceLlm: boolean = false
): Promise<{
  intent: NaturalLanguageIntent | null;
  source: 'fast_pattern' | 'web_llm' | 'none';
}> {
  // Nivel 0: Parser determinístico ultrarrápido (<1ms, 0MB, sin WebGPU) si no se fuerza LLM
  if (!forceLlm) {
    const fastResult = parseNaturalLanguageFast(text);
    if (fastResult) {
      return { intent: fastResult, source: 'fast_pattern' };
    }
  }

  // Nivel 1: Inferencia con modelo local WebLLM on-device
  const isGpuReady = await webLlmService.isWebGpuSupported();
  if (isGpuReady) {
    const llmResult = await webLlmService.extractWithLlm(text);
    if (llmResult) {
      return { intent: llmResult, source: 'web_llm' };
    }
  }

  // Fallback de contingencia si forceLlm falló por WebGPU o timeout
  if (forceLlm) {
    const fallback = parseNaturalLanguageFast(text);
    if (fallback) {
      return { intent: fallback, source: 'fast_pattern' };
    }
  }

  return { intent: null, source: 'none' };
}
