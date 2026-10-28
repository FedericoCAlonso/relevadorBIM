/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO NLP: WebLlmExtractor.ts
 * Responsabilidad Única:
 * Extractor semántico local on-device (Módulo 1B). Ejecuta un LLM liviano
 * (Llama-3.2-1B-Instruct / Qwen) directamente en el navegador con WebLLM y WebGPU,
 * forzando la salida a NaturalLanguageIntent mediante Constrained Decoding
 * (XGrammar / JSON Schema) y contextualizado dinámicamente con el modelo BIM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { parseNaturalLanguageFast } from './FastPatternParser';
import {
  NaturalLanguageIntentSchema,
  type NaturalLanguageIntent,
  type RelativeOrientation
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

export interface NlpModelOption {
  id: string;
  name: string;
  description: string;
  vramMB: number;
  isDefault?: boolean;
}

export const AVAILABLE_NLP_MODELS: readonly NlpModelOption[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B (Recomendado en Español)',
    description: 'Excelente comprensión del español de obra y seguimiento estricto de esquemas (~880 MB VRAM).',
    vramMB: 879,
    isDefault: true
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 1.5B',
    description: 'Mayor capacidad de extracción en instrucciones complejas (~1.6 GB VRAM).',
    vramMB: 1630
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 0.5B (Ultra liviano)',
    description: 'Modelo compacto para dispositivos con memoria WebGPU limitada (~940 MB VRAM).',
    vramMB: 944
  }
];

export const RECOMMENDED_NLP_MODEL = AVAILABLE_NLP_MODELS[0].id;

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTUALIZACIÓN BIM PARA INFERENCIA GROUNDED
// ─────────────────────────────────────────────────────────────────────────────

export interface BimWallSummary {
  id?: string;
  orientation: RelativeOrientation | string;
  lengthM: number;
}

export interface BimSpaceSummary {
  id: string;
  name: string;
  category?: string;
  widthM?: number;
  lengthM?: number;
  walls?: BimWallSummary[];
}

export interface BimContext {
  spaces: BimSpaceSummary[];
  activeSpaceId?: string | null;
  selectedEntity?: {
    type: string;
    id: string;
    name?: string;
  } | null;
}

/**
 * Serializa de forma ultra-compacta el contexto BIM para inyectar en el System Prompt.
 */
export function formatBimContextForPrompt(ctx?: BimContext): string {
  if (!ctx || !ctx.spaces || ctx.spaces.length === 0) {
    return 'Contexto del plano actual: No hay ambientes creados todavía en el plano.';
  }

  const lines: string[] = ['Contexto del plano actual:'];
  for (const sp of ctx.spaces) {
    const isActive = sp.id === ctx.activeSpaceId ? ' [ACTIVO / SELECCIONADO]' : '';
    let wallStr = '';
    if (sp.walls && sp.walls.length > 0) {
      wallStr = ` | Paredes: ${sp.walls.map((w) => `${w.orientation} (${w.lengthM.toFixed(2)}m)`).join(', ')}`;
    }
    const dimStr = sp.widthM && sp.lengthM ? ` (${sp.widthM.toFixed(2)}x${sp.lengthM.toFixed(2)}m)` : '';
    lines.push(`- Ambiente "${sp.name}"${dimStr}${isActive}${wallStr}`);
  }

  if (ctx.selectedEntity) {
    lines.push(
      `- Entidad seleccionada: tipo ${ctx.selectedEntity.type}, id ${ctx.selectedEntity.id}${
        ctx.selectedEntity.name ? ` ("${ctx.selectedEntity.name}")` : ''
      }`
    );
  }

  return lines.join('\n');
}

/**
 * Construye un resumen de contexto BIM a partir del estado de useProjectStore sin mutaciones.
 */
export function buildBimContextFromProject(
  project: {
    spaces: Array<{ id: string; name: string; category?: string; boundaryVertexIds?: string[]; wallIds?: string[] }>;
    walls: Array<{ id: string; startVertexId: string; endVertexId: string }>;
    vertices: Array<{ id: string; x: number; y: number }>;
  },
  activeSpaceId?: string | null,
  selectedEntity?: { type: string; id: string; name?: string } | null
): BimContext {
  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const wallsMap = new Map(project.walls.map((w) => [w.id, w]));

  const spacesSummary: BimSpaceSummary[] = project.spaces.map((sp) => {
    const vertexPoints = (sp.boundaryVertexIds || [])
      .map((id) => verticesMap.get(id))
      .filter(Boolean) as Array<{ x: number; y: number }>;

    let widthM: number | undefined;
    let lengthM: number | undefined;
    let centroid = { x: 0, y: 0 };

    if (vertexPoints.length >= 3) {
      const xs = vertexPoints.map((p) => p.x);
      const ys = vertexPoints.map((p) => p.y);
      centroid = {
        x: xs.reduce((a, b) => a + b, 0) / xs.length,
        y: ys.reduce((a, b) => a + b, 0) / ys.length
      };
      widthM = Math.max(...xs) - Math.min(...xs);
      lengthM = Math.max(...ys) - Math.min(...ys);
    }

    let spaceWalls: Array<{ id: string; startVertexId: string; endVertexId: string }> = [];
    if (sp.wallIds && sp.wallIds.length > 0) {
      spaceWalls = sp.wallIds.map((id) => wallsMap.get(id)).filter(Boolean) as Array<{
        id: string;
        startVertexId: string;
        endVertexId: string;
      }>;
    } else if (sp.boundaryVertexIds && sp.boundaryVertexIds.length > 0) {
      spaceWalls = project.walls.filter(
        (w) => sp.boundaryVertexIds!.includes(w.startVertexId) && sp.boundaryVertexIds!.includes(w.endVertexId)
      );
    }

    const walls: BimWallSummary[] = spaceWalls.map((w) => {
      const v1 = verticesMap.get(w.startVertexId);
      const v2 = verticesMap.get(w.endVertexId);
      const len = v1 && v2 ? Math.hypot(v2.x - v1.x, v2.y - v1.y) : 0;
      const midX = v1 && v2 ? (v1.x + v2.x) / 2 : 0;
      const midY = v1 && v2 ? (v1.y + v2.y) / 2 : 0;
      const dx = midX - centroid.x;
      const dy = midY - centroid.y;
      const orientation = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'este' : 'oeste') : dy > 0 ? 'sur' : 'norte';
      return {
        id: w.id,
        orientation,
        lengthM: Number(len.toFixed(2))
      };
    });

    return {
      id: sp.id,
      name: sp.name,
      category: sp.category,
      widthM: widthM ? Number(widthM.toFixed(2)) : undefined,
      lengthM: lengthM ? Number(lengthM.toFixed(2)) : undefined,
      walls
    };
  });

  return {
    spaces: spacesSummary,
    activeSpaceId: activeSpaceId ?? null,
    selectedEntity: selectedEntity ?? null
  };
}

/**
 * Genera el System Prompt contextualizado para el modelo WebLLM.
 */
export function createDynamicSystemPrompt(context?: BimContext): string {
  const bimContextText = formatBimContextForPrompt(context);

  return `Eres un asistente de relevamiento electromecánico y arquitectónico de obra para RelevadorBIM.
Tu única tarea es extraer la intención del usuario a partir del texto en español y responder ÚNICAMENTE con un objeto JSON válido según el esquema definido.

${bimContextText}

Reglas obligatorias:
1. Si el usuario pide crear o cerrar un ambiente o habitación (living, cocina, dormitorio, pieza, cuarto, baño, etc.):
   - Usa action: "create_space".
   - Mapea widthM al primer valor de dimensión y lengthM al segundo valor.
   - Si indica adosado, pegado o al lado de una pared, usa relativeTo: { sharedWall: "orientacion", targetSpaceName: "NombreAmbiente" }.
   - Si no nombra el ambiente destino pero hay un ambiente activo o un único ambiente en el contexto, úsalo como targetSpaceName.
2. Si pide colocar una puerta, ventana, vano o abertura en un muro:
   - Usa action: "place_opening".
   - openingType: "door" para puertas o accesos, "window" para ventanas o ventanales, "passage" para vanos o aberturas libres.
   - wallReference: la pared anfitriona ("norte", "sur", "este", "oeste", "derecha", "izquierda", "frente", "fondo").
3. Si pide colocar una boca, toma, llave, centro de luz, aplique o tablero:
   - Usa action: "place_element".
   - mountType: "ceiling" para bocas de techo/centro, "wall" para paredes.
   - heightZM: altura de montaje en metros desde el piso (ej: 0.30 para tomas bajos, 1.20 para llaves o tomas sobre mesada, 2.20 para apliques).
4. Si pide conectar caños o conductos, usa action: "connect_conduit".
5. Si menciona mediciones de PAT, jabalina, tensión o corriente, usa action: "record_measurement".
6. Responde EXCLUSIVAMENTE con el objeto JSON sin explicaciones, markdown ni texto fuera del JSON.

Ejemplos canónicos:
Usuario: "living de 4 por 10.3"
JSON: {"action":"create_space","name":"Living","category":"living_comedor","dimensions":{"widthM":4,"lengthM":10.3}}

Usuario: "pieza de 3 por 3.5 pegada a la pared este del living"
JSON: {"action":"create_space","name":"Pieza","category":"dormitorio","dimensions":{"widthM":3,"lengthM":3.5},"relativeTo":{"sharedWall":"este","targetSpaceName":"Living"}}

Usuario: "dormitorio de 3x4 al este"
JSON: {"action":"create_space","name":"Dormitorio","category":"dormitorio","dimensions":{"widthM":3,"lengthM":4},"relativeTo":{"sharedWall":"este"}}

Usuario: "cerrar con tres paredes de 3 por 4 al fondo"
JSON: {"action":"create_space","name":"Ambiente","dimensions":{"widthM":3,"lengthM":4},"relativeTo":{"sharedWall":"fondo"}}

Usuario: "puerta placa de 0.80 en pared norte a 0.2m de pared este"
JSON: {"action":"place_opening","openingType":"door","wallReference":"norte","referenceCornerWall":"este","distanceM":0.2,"widthM":0.8}

Usuario: "ventana de 1.50 centrada en pared sur"
JSON: {"action":"place_opening","openingType":"window","wallReference":"sur","centered":true,"widthM":1.5}

Usuario: "pone un toma doble a 1.20 en pared derecha"
JSON: {"action":"place_element","elementCategory":"toma","mountType":"wall","heightZM":1.2,"wallReference":"derecha"}

Usuario: "boca de iluminacion centrada en el techo con circuito 1"
JSON: {"action":"place_element","elementCategory":"iluminacion_techo","mountType":"ceiling","centeredInRoom":true,"circuitNumber":"1"}

Usuario: "conecta este toma con la boca de techo por losa con caño de 19"
JSON: {"action":"connect_conduit","routingPlane":"ceiling_slab","diameterMM":19,"toElementRef":"ceiling"}

Usuario: "medición PAT 12.5 ohms"
JSON: {"action":"record_measurement","measurementType":"pat_resistance","value":12.5,"unit":"Ω"}`;
}

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
    openings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['door', 'window', 'passage'] },
          wall: { type: 'string', enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo'] },
          referenceCornerWall: { type: 'string', enum: ['norte', 'sur', 'este', 'oeste', 'derecha', 'izquierda', 'frente', 'fondo'] },
          distanceFromCornerM: { type: 'number' },
          centered: { type: 'boolean' },
          widthM: { type: 'number' }
        },
        required: ['type', 'wall']
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
    spaceName: { type: 'string' },
    targetSpaceName: { type: 'string' },
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
  private currentModelId: string | null = null;
  private status: WebLlmStatus = 'idle';
  private statusListeners: Array<(status: WebLlmStatus) => void> = [];
  private progressListeners: Array<(progress: WebLlmProgress) => void> = [];

  public getStatus(): WebLlmStatus {
    return this.status;
  }

  public getCurrentModelId(): string {
    return this.currentModelId || RECOMMENDED_NLP_MODEL;
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
    if (this.engine && this.currentModelId === modelId) return true;

    if (this.engine && this.currentModelId !== modelId) {
      try {
        await this.engine.unload?.();
      } catch {
        // Ignorar error al descargar anterior
      }
      this.engine = null;
    }

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

      this.currentModelId = modelId;
      this.setStatus('ready');
      return true;
    } catch (err) {
      console.error('Error al inicializar WebLLM Engine:', err);
      this.setStatus('error');
      return false;
    }
  }

  /**
   * Ejecuta la inferencia con el modelo local forzando JSON con XGrammar y contexto BIM.
   */
  public async extractWithLlm(
    text: string,
    context?: BimContext,
    modelId: string = RECOMMENDED_NLP_MODEL
  ): Promise<NaturalLanguageIntent | null> {
    if (!this.engine || this.currentModelId !== modelId) {
      const initialized = await this.initEngine(modelId);
      if (!initialized || !this.engine) return null;
    }

    this.setStatus('inferring');
    try {
      const systemPrompt = createDynamicSystemPrompt(context);
      const completion = await this.engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        response_format: {
          type: 'json_object',
          schema: JSON.stringify(INTENT_JSON_SCHEMA)
        },
        temperature: 0.1,
        max_tokens: 300
      });

      this.setStatus('ready');
      const rawJson = completion.choices[0]?.message?.content;
      if (!rawJson) return null;

      let cleanJson = rawJson.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
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
 * @param bimContext Contexto del plano BIM para resolver adosados y ambigüedades.
 * @param modelId Identificador del modelo WebLLM a utilizar.
 */
export async function extractNaturalLanguageIntent(
  text: string,
  forceLlm: boolean = false,
  bimContext?: BimContext,
  modelId: string = RECOMMENDED_NLP_MODEL
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

  // Nivel 1: Inferencia con modelo local WebLLM on-device enriquecido con contexto BIM
  const isGpuReady = await webLlmService.isWebGpuSupported();
  if (isGpuReady) {
    const llmResult = await webLlmService.extractWithLlm(text, bimContext, modelId);
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
