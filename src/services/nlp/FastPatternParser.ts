/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO NLP: FastPatternParser.ts
 * Responsabilidad Única:
 * Parser determinístico ultra-liviano (Módulo 1A). Procesa frases en español
 * de campo mediante expresiones regulares y reglas de vocabulario técnico,
 * generando un NaturalLanguageIntent en <1 milisegundo con 0 MB de memoria.
 * Si la frase no encaja en patrones conocidos, retorna null para delegar a WebLLM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  NaturalLanguageIntent,
  CreateSpaceIntent,
  PlaceElementIntent,
  ConnectConduitIntent,
  RecordMeasurementIntent,
  RelativeOrientation,
  NlpElementCategory,
  NlpOpeningType
} from './naturalLanguageSchema';

/**
 * Normaliza un texto eliminando tildes, signos de puntuación no numéricos y espacios redundantes.
 */
export function normalizeNlpText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte expresiones numéricas comunes en español hablado a números flotantes.
 * Ejemplos: "cuatro" -> 4, "tres y medio" -> 3.5, "un metro veinte" -> 1.20
 */
export function parseSpanishNumber(raw: string): number | null {
  const text = normalizeNlpText(raw);

  // Expresiones mixtas tipo "uno veinte", "un metro veinte", "1 metro 20"
  const meterMatch = text.match(/^(?:un|1)?\s*(?:metro|m)?\s*(?:con)?\s*(\d+(?:[.,]\d+)?)$/);
  if (meterMatch) {
    const val = parseFloat(meterMatch[1].replace(',', '.'));
    if (!isNaN(val)) return val > 10 ? val / 100 : val;
  }

  const compoundMatch = text.match(/^(?:un|1)\s+(?:metro\s+)?(\d{2})$/);
  if (compoundMatch) {
    return 1 + parseInt(compoundMatch[1], 10) / 100;
  }

  // Palabras directas
  const wordToNum: Record<string, number> = {
    cero: 0,
    medio: 0.5,
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    quince: 15,
    diecinueve: 19,
    veinte: 20,
    veintidos: 22,
    veinticinco: 25,
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50
  };

  const meterWordsMatch = text.match(/^(?:un|1)\s*(?:metro|m)?\s*(?:con\s+)?([a-z]+)$/);
  if (meterWordsMatch) {
    const sub = meterWordsMatch[1];
    const subVal = wordToNum[sub];
    if (subVal !== undefined) {
      return 1 + subVal / 100;
    }
  }

  if (text.includes(' y medio')) {
    const base = text.replace(' y medio', '').trim();
    const baseVal = wordToNum[base] ?? parseFloat(base);
    if (!isNaN(baseVal)) return baseVal + 0.5;
  }

  if (wordToNum[text] !== undefined) return wordToNum[text];

  const parsed = parseFloat(text.replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Intenta parsear la frase en una intención de forma determinística y rápida.
 */
export function parseNaturalLanguageFast(rawText: string): NaturalLanguageIntent | null {
  const text = normalizeNlpText(rawText);
  if (!text) return null;

  // 1. Intentar creación de recinto / ambiente
  const spaceIntent = tryParseCreateSpace(text);
  if (spaceIntent) return spaceIntent;

  // 2. Intentar registro de mediciones de instrumental (muy específico)
  const measureIntent = tryParseRecordMeasurement(text);
  if (measureIntent) return measureIntent;

  // 3. Intentar conexión de cañerías (frases con conectar/unir)
  const conduitIntent = tryParseConnectConduit(text);
  if (conduitIntent) return conduitIntent;

  // 4. Intentar colocación de bocas / tomas / llaves
  const elementIntent = tryParsePlaceElement(text);
  if (elementIntent) return elementIntent;
  if (measureIntent) return measureIntent;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSERS ESPECÍFICOS POR INTENCIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejemplos soportados:
 * - "living comedor de 4 por 6 con puerta en pared norte y ventana en pared sur"
 * - "dormitorio de 3.5x4 pegado a la pared este del living"
 * - "cocina de 2 por 3"
 */
function tryParseCreateSpace(text: string): CreateSpaceIntent | null {
  // Patrón base: [crear/haz/agregar] [nombre_ambiente] de [num] por [num] / [num]x[num]
  const pattern = /(?:crear|haz|hace|hacer|pone|poner|agregar)?\s*(?:un|una)?\s*([a-z0-9\s]+?)\s+de\s+([a-z0-9.,]+|\d+(?:\.\d+)?)\s*(?:por|x)\s*([a-z0-9.,]+|\d+(?:\.\d+)?)(?:\s+(?:metros?|m))?(.*)/i;
  const match = text.match(pattern);
  if (!match) return null;

  const rawName = match[1].trim();
  const rawDim1 = match[2].trim();
  const rawDim2 = match[3].trim();
  const rest = match[4].trim();

  // Descartar si el nombre es una palabra de comando eléctrico (ej: "toma de 20A")
  if (
    rawName.includes('toma') ||
    rawName.includes('enchufe') ||
    rawName.includes('llave') ||
    rawName.includes('cable') ||
    rawName.includes('cano') ||
    rawName.includes('caño') ||
    rawName.includes('circuito')
  ) {
    return null;
  }

  const dim1 = parseSpanishNumber(rawDim1);
  const dim2 = parseSpanishNumber(rawDim2);
  if (!dim1 || !dim2) return null;

  const intent: CreateSpaceIntent = {
    action: 'create_space',
    name: capitalize(rawName),
    dimensions: {
      widthM: dim1,
      lengthM: dim2
    }
  };

  // Detectar categoría sugerida
  if (rawName.includes('living') || rawName.includes('comedor')) intent.category = 'living_comedor';
  else if (rawName.includes('dormitorio') || rawName.includes('pieza') || rawName.includes('habitacion')) intent.category = 'dormitorio';
  else if (rawName.includes('cocina')) intent.category = 'cocina';
  else if (rawName.includes('bano') || rawName.includes('baño') || rawName.includes('toilette')) intent.category = 'bano';
  else if (rawName.includes('pasillo') || rawName.includes('circulacion') || rawName.includes('hall')) intent.category = 'circulacion';
  else if (rawName.includes('balcon') || rawName.includes('terraza')) intent.category = 'balcon';

  // Detectar adosado a otro ambiente (muro compartido)
  const attachedMatch = rest.match(/(?:pegado|adosado|compartiendo|al lado)\s+(?:a|de|al)?\s*(?:la\s+pared\s+([a-z]+))?\s*(?:de|del)?\s*([a-z0-9\s]+)?/);
  if (attachedMatch) {
    const rawWall = attachedMatch[1];
    const rawTarget = attachedMatch[2]?.trim();
    intent.relativeTo = {};
    if (rawWall) intent.relativeTo.sharedWall = parseOrientation(rawWall);
    if (rawTarget) intent.relativeTo.targetSpaceName = rawTarget;
  }

  // Detectar aberturas en la frase complementaria
  const openings = extractOpeningsFromText(rest);
  if (openings.length > 0) {
    intent.openings = openings;
  }

  return intent;
}

/**
 * Ejemplos soportados:
 * - "pone un toma doble a 1.20 en pared derecha circuito 2"
 * - "llave de un punto a 1.10 al lado de la puerta"
 * - "boca de iluminacion centrada en el techo con circuito 1"
 * - "tablero seccional en pared izquierda a 1.50"
 */
function tryParsePlaceElement(text: string): PlaceElementIntent | null {
  const isToma = text.includes('toma') || text.includes('enchufe');
  const isLlave = text.includes('llave') || text.includes('interruptor') || text.includes('pulsador');
  const isTecho = text.includes('techo') || text.includes('centro') || text.includes('cenital') || text.includes('ventilador');
  const isAplique = text.includes('aplique');
  const isTablero = text.includes('tablero') || /\b(tsg|tp|ts)\b/.test(text);
  const isCajaPaso = text.includes('caja de paso') || text.includes('caja de derivacion') || text.includes('caja de pase');

  if (!isToma && !isLlave && !isTecho && !isAplique && !isTablero && !isCajaPaso) {
    return null;
  }

  let elementCategory: NlpElementCategory = 'toma';
  let mountType: 'wall' | 'ceiling' = 'wall';

  if (isTecho) {
    elementCategory = 'iluminacion_techo';
    mountType = 'ceiling';
  } else if (isLlave) {
    elementCategory = 'llave';
  } else if (isAplique) {
    elementCategory = 'aplique_pared';
  } else if (isTablero) {
    elementCategory = 'tablero';
  } else if (isCajaPaso) {
    elementCategory = 'caja_paso';
  }

  const intent: PlaceElementIntent = {
    action: 'place_element',
    elementCategory,
    mountType
  };

  // 1. Detectar cota de altura Z (ej: "a 1.20", "a un metro veinte", "a 0.30")
  const heightMatch = text.match(/(?:a|altura|cota)\s+([0-9.,]+|un\s+metro\s+[0-9a-z]+|medio\s+metro)(?:\s*m|\s*metros)?/);
  if (heightMatch) {
    const rawH = heightMatch[1];
    const parsedH = parseSpanishNumber(rawH);
    if (parsedH !== null) intent.heightZM = parsedH;
  }

  // 2. Detectar orientación de pared (ej: "en pared derecha", "en pared norte", "pared sur")
  const wallMatch = text.match(/(?:en\s+(?:la\s+)?pared|pared)\s+([a-z]+)/);
  if (wallMatch) {
    intent.wallReference = parseOrientation(wallMatch[1]);
  }

  // 3. Detectar circuito (ej: "circuito 2", "circuito iluminacion 1", "c1", "c-2")
  const circuitMatch = text.match(/\b(?:circuito|circ)\s+([0-9a-z_-]+)|\bc-?(\d+)\b/);
  if (circuitMatch) {
    intent.circuitNumber = circuitMatch[1] ?? circuitMatch[2];
  }

  // 4. Detectar centrado en techo / ambiente
  if (text.includes('centrad') || text.includes('en el centro') || text.includes('al medio')) {
    intent.centeredInRoom = true;
  }

  return intent;
}

/**
 * Ejemplos:
 * - "conecta este toma con la boca de techo por losa con caño de 19"
 * - "unir las dos bocas de iluminacion por losa"
 */
function tryParseConnectConduit(text: string): ConnectConduitIntent | null {
  if (!text.includes('conect') && !text.includes('uni') && !text.includes('tirar cano') && !text.includes('tirar caño')) {
    return null;
  }

  const intent: ConnectConduitIntent = {
    action: 'connect_conduit'
  };

  // Plano de ruteo
  if (text.includes('losa') || text.includes('techo') || text.includes('cielorraso')) {
    intent.routingPlane = 'ceiling_slab';
  } else if (text.includes('piso') || text.includes('contrapiso') || text.includes('suelo')) {
    intent.routingPlane = 'floor_slab';
  } else if (text.includes('pared')) {
    intent.routingPlane = 'wall';
  }

  // Diámetro
  const diaMatch = text.match(/(?:cano|caño|diametro|de|ø)\s*([0-9]{2})(?:\s*mm)?/);
  if (diaMatch) {
    intent.diameterMM = parseInt(diaMatch[1], 10);
  }

  // Destino techo
  if (text.includes('boca de techo') || text.includes('al techo')) {
    intent.toElementRef = 'ceiling';
  }

  return intent;
}

/**
 * Ejemplos:
 * - "anota resistencia de puesta a tierra 12 ohms"
 * - "pat 15 ohms"
 * - "tension fase neutro 225 volts"
 */
function tryParseRecordMeasurement(text: string): RecordMeasurementIntent | null {
  const isPat = text.includes('pat') || text.includes('puesta a tierra') || text.includes('jabalina');
  const isVolt = text.includes('tension') || text.includes('volt');
  const isCurrent = text.includes('corriente') || text.includes('amper');

  if (!isPat && !isVolt && !isCurrent) return null;

  // Extraer valor numérico
  const numMatch = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:ohm|ohms|v|volt|volts|a|amper|amperes|amperios)?/);
  if (!numMatch) return null;

  const val = parseFloat(numMatch[1].replace(',', '.'));
  if (isNaN(val)) return null;

  if (isPat) {
    return {
      action: 'record_measurement',
      measurementType: 'pat_resistance',
      value: val,
      unit: 'Ω'
    };
  }

  if (isVolt) {
    return {
      action: 'record_measurement',
      measurementType: 'voltage_fn',
      value: val,
      unit: 'V'
    };
  }

  return {
    action: 'record_measurement',
    measurementType: 'current',
    value: val,
    unit: 'A'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES LINGÜÍSTICAS
// ─────────────────────────────────────────────────────────────────────────────

function parseOrientation(word: string): RelativeOrientation {
  const clean = normalizeNlpText(word);
  if (clean.includes('norte')) return 'norte';
  if (clean.includes('sur')) return 'sur';
  if (clean.includes('este')) return 'este';
  if (clean.includes('oeste')) return 'oeste';
  if (clean.includes('derecha')) return 'derecha';
  if (clean.includes('izquierda')) return 'izquierda';
  if (clean.includes('frente')) return 'frente';
  if (clean.includes('fondo')) return 'fondo';
  return 'norte';
}

function extractOpeningsFromText(text: string): Array<{
  type: NlpOpeningType;
  wall: RelativeOrientation;
  centered?: boolean;
  distanceFromCornerM?: number;
}> {
  const openings: Array<{
    type: NlpOpeningType;
    wall: RelativeOrientation;
    centered?: boolean;
    distanceFromCornerM?: number;
  }> = [];

  // Buscar puertas
  const doorMatches = text.matchAll(/(?:puerta|ingreso|acceso)\s+(?:en\s+(?:la\s+)?pared\s+([a-z]+)|al\s+([a-z]+))/g);
  for (const m of doorMatches) {
    const wallWord = m[1] || m[2];
    if (wallWord) {
      openings.push({
        type: 'door',
        wall: parseOrientation(wallWord),
        centered: text.includes('centrada') || text.includes('al centro')
      });
    }
  }

  // Buscar ventanas
  const winMatches = text.matchAll(/(?:ventana)\s+(?:en\s+(?:la\s+)?pared\s+([a-z]+)|al\s+([a-z]+))/g);
  for (const m of winMatches) {
    const wallWord = m[1] || m[2];
    if (wallWord) {
      openings.push({
        type: 'window',
        wall: parseOrientation(wallWord),
        centered: text.includes('centrada') || text.includes('al centro')
      });
    }
  }

  return openings;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
