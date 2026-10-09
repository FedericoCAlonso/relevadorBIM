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
  PlaceOpeningIntent,
  PlaceElementIntent,
  ConnectConduitIntent,
  RecordMeasurementIntent,
  RelativeOrientation,
  NlpElementCategory,
  NlpOpeningType
} from './naturalLanguageSchema';

/**
 * Normaliza un texto eliminando tildes, signos de puntuación no numéricos y espacios redundantes.
 * Preserva comas decimales convirtiéndolas a punto (ej: "0,2" -> "0.2").
 */
export function normalizeNlpText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/(\d+)\s+(?:coma|punto)\s+(\d+)/g, '$1.$2') // "10 coma 3", "10 punto 3" -> "10.3"
    .replace(/(\d+)\s+con\s+(\d+)/g, '$1.$2') // "10 con 3" -> "10.3", "1 con 20" -> "1.20"
    .replace(/(\d+),(\d+)/g, '$1.$2') // Coma decimal: "0,2" -> "0.2"
    .replace(/\*+/g, ' x ') // Dictado que transcribe * por multiplicación
    .replace(/[¡!¿?]/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ') // Puntos que no sean separador decimal
    .replace(/[,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte expresiones numéricas comunes en español hablado a números flotantes.
 * Ejemplos: "cuatro" -> 4, "tres y medio" -> 3.5, "un metro veinte" -> 1.20, "20cm" -> 0.20, "10.3" -> 10.3
 */
export function parseSpanishNumber(raw: string): number | null {
  const text = normalizeNlpText(raw);
  if (!text) return null;

  // 1. Expresiones explícitas de centímetros: "20cm", "20 cm", "20 centimetros", "80cm"
  const cmMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:cm|centimetros?)\b/);
  if (cmMatch) {
    const val = parseFloat(cmMatch[1]);
    if (!isNaN(val)) return val / 100;
  }

  // 2. Número directo numérico (entero o decimal, con unidad opcional de metros):
  // Ejemplos: "4", "10.3", "0.20", "15", "4 metros", "10.3m", "10.3 mts"
  const directMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:metros?|mts?|m)?$/);
  if (directMatch) {
    const val = parseFloat(directMatch[1]);
    if (!isNaN(val)) return val;
  }

  // 3. Expresiones compuestas de metros + centímetros en dígitos:
  // "1 metro 20", "un metro 20", "2 metros 50", "1 m 20"
  const compoundMeterMatch = text.match(/^(un|uno|\d+)\s*(?:metros?|m|mts?)\s*(?:con\s+)?(\d{1,2})$/);
  if (compoundMeterMatch) {
    const basePart = compoundMeterMatch[1];
    const base = (basePart === 'un' || basePart === 'uno') ? 1 : parseInt(basePart, 10);
    const cmStr = compoundMeterMatch[2];
    const cmVal = parseInt(cmStr, 10) / (cmStr.length === 1 ? 10 : 100);
    return base + cmVal;
  }

  // 4. Par de dígitos coloquiales: "1 20" -> 1.20, "2 50" -> 2.50
  const pairDigitsMatch = text.match(/^([1-9])\s+(\d{2})$/);
  if (pairDigitsMatch) {
    return parseInt(pairDigitsMatch[1], 10) + parseInt(pairDigitsMatch[2], 10) / 100;
  }

  // 5. Catálogo de palabras numéricas en español
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
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    veinte: 20,
    veintiuno: 21,
    veintidos: 22,
    veintitres: 23,
    veinticuatro: 24,
    veinticinco: 25,
    veintiseis: 26,
    veintisiete: 27,
    veintiocho: 28,
    veintinueve: 29,
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50,
    sesenta: 60,
    setenta: 70,
    ochenta: 80,
    noventa: 90,
    cien: 100
  };

  // 6. Palabras de metros + palabras de centímetros: "un metro veinte", "dos metros cincuenta"
  const meterWordsMatch = text.match(/^(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)\s*(?:metros?|m|mts?)\s*(?:con\s+)?([a-z]+)$/);
  if (meterWordsMatch) {
    const baseWord = meterWordsMatch[1];
    const subWord = meterWordsMatch[2];
    const baseVal = wordToNum[baseWord] ?? parseInt(baseWord, 10);
    const subVal = wordToNum[subWord];
    if (baseVal !== undefined && !isNaN(baseVal) && subVal !== undefined) {
      return baseVal + (subVal >= 10 ? subVal / 100 : subVal / 10);
    }
  }

  // 7. Modificadores de fracción: "tres y medio", "un metro y medio", "dos y cuarto"
  if (text.includes(' y medio')) {
    const base = text.replace(' y medio', '').replace(/\s*(?:metros?|mts?|m)\b/g, '').trim();
    const baseVal = wordToNum[base] ?? parseFloat(base);
    if (!isNaN(baseVal)) return baseVal + 0.5;
  }
  if (text.includes(' y cuarto')) {
    const base = text.replace(' y cuarto', '').replace(/\s*(?:metros?|mts?|m)\b/g, '').trim();
    const baseVal = wordToNum[base] ?? parseFloat(base);
    if (!isNaN(baseVal)) return baseVal + 0.25;
  }

  // 8. Decenas compuestas en palabras: "treinta y cinco", "cuarenta y dos"
  const tensMatch = text.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)$/);
  if (tensMatch) {
    const tens = wordToNum[tensMatch[1]];
    const units = wordToNum[tensMatch[2]];
    if (tens !== undefined && units !== undefined) {
      return tens + units;
    }
  }

  // 9. Limpiar unidad final si existe: "4 metros" -> "4", "cuatro metros" -> "cuatro"
  const cleanUnit = text.replace(/\s*(?:metros?|mts?|m)\b/g, '').trim();
  if (wordToNum[cleanUnit] !== undefined) return wordToNum[cleanUnit];
  if (wordToNum[text] !== undefined) return wordToNum[text];

  const parsed = parseFloat(cleanUnit.replace(',', '.'));
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

  // 2. Intentar colocación de aberturas (puertas, ventanas, vanos)
  const openingIntent = tryParsePlaceOpening(text);
  if (openingIntent) return openingIntent;

  // 3. Intentar registro de mediciones de instrumental (muy específico)
  const measureIntent = tryParseRecordMeasurement(text);
  if (measureIntent) return measureIntent;

  // 4. Intentar conexión de cañerías (frases con conectar/unir)
  const conduitIntent = tryParseConnectConduit(text);
  if (conduitIntent) return conduitIntent;

  // 5. Intentar colocación de bocas / tomas / llaves
  const elementIntent = tryParsePlaceElement(text);
  if (elementIntent) return elementIntent;

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
 * - "living de 4 metros por 6 metros"
 * - "living 4x6"
 */
function tryParseCreateSpace(text: string): CreateSpaceIntent | null {
  // Limpiar verbos introductorios comunes
  let clean = text.replace(/^(?:crear|hacer|hace|haz|poner|pone|agregar|dibujar|armar)\s+/i, '');
  clean = clean.replace(/^(?:un|una)\s+/i, '');

  // Patrón base: [nombre_ambiente] [de]? [dim1] [por|x|*] [dim2] [resto]
  const pattern = /^([a-z0-9\s]+?)\s+(?:de\s+)?([a-z0-9.,]+(?:\s*(?:metros?|mts?|m))?)\s*(?:por|x|\*)\s*([a-z0-9.,]+(?:\s*(?:metros?|mts?|m))?)(?:\s*(?:metros?|mts?|m))?(.*)$/i;
  const match = clean.match(pattern);
  if (!match) return null;

  let rawName = match[1].trim();
  const rawDim1 = match[2].trim();
  const rawDim2 = match[3].trim();
  const rest = match[4]?.trim() || '';

  // Detectar adosado a otro ambiente (muro compartido) tanto si vino antes de las dimensiones (en rawName) como si vino después (en rest)
  const attachedPattern = /(?:pegado|adosado|compartiendo|al lado)\s+(?:a|de|al)?\s*(?:la\s+pared\s+([a-z]+)|el\s+muro\s+([a-z]+)|pared\s+([a-z]+)|muro\s+([a-z]+)|al\s+([a-z]+))?\s*(?:de|del)?\s*([a-z0-9\s]+)?/i;

  let attachedMatch = rest.match(attachedPattern);
  if (!attachedMatch) {
    attachedMatch = rawName.match(attachedPattern);
    if (attachedMatch) {
      // Limpiar la cláusula de adosado del nombre del ambiente para que quede limpio (ej: "Balcón")
      rawName = rawName.replace(attachedPattern, '').trim();
    }
  }

  // Descartar si el nombre es una palabra de comando eléctrico o abertura
  if (
    rawName.includes('toma') ||
    rawName.includes('enchufe') ||
    rawName.includes('llave') ||
    rawName.includes('cable') ||
    rawName.includes('cano') ||
    rawName.includes('caño') ||
    rawName.includes('circuito') ||
    rawName.includes('puerta') ||
    rawName.includes('ventana')
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
  if (rawName.includes('living') || rawName.includes('comedor') || rawName.includes('estar') || rawName.includes('sala')) {
    intent.category = 'living_comedor';
  } else if (rawName.includes('dormitorio') || rawName.includes('pieza') || rawName.includes('habitacion')) {
    intent.category = 'dormitorio';
  } else if (rawName.includes('cocina')) {
    intent.category = 'cocina';
  } else if (rawName.includes('bano') || rawName.includes('baño') || rawName.includes('toilette')) {
    intent.category = 'bano';
  } else if (rawName.includes('pasillo') || rawName.includes('circulacion') || rawName.includes('hall')) {
    intent.category = 'circulacion';
  } else if (rawName.includes('balcon') || rawName.includes('terraza')) {
    intent.category = 'balcon';
  }

  if (attachedMatch) {
    const rawWall = attachedMatch[1] || attachedMatch[2] || attachedMatch[3] || attachedMatch[4] || attachedMatch[5];
    const rawTarget = attachedMatch[6]?.trim();
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
 * - "puerta en pared norte a 0.2m de pared este"
 * - "puerta en pared norte a 0,2m de pared este"
 * - "puerta en pared norte a 20cm de pared este"
 * - "puerta centrada en pared norte"
 * - "ventana en pared sur de 1.20 a 0.50 de pared oeste"
 * - "ventana centrada en pared este"
 * - "puerta en pared norte"
 */
function tryParsePlaceOpening(text: string): PlaceOpeningIntent | null {
  const isDoor = /\b(?:puerta|porton|ingreso|acceso)\b/i.test(text);
  const isWindow = /\b(?:ventana|ventanal)\b/i.test(text);
  const isPassage = /\b(?:paso|vano|abertura)\b/i.test(text);

  if (!isDoor && !isWindow && !isPassage) return null;

  const openingType: NlpOpeningType = isDoor ? 'door' : isWindow ? 'window' : 'passage';

  // Referencia de muro anfitrión: "en pared [orientacion]" o "al [orientacion]" o "pared [orientacion]"
  const wallMatch = text.match(/(?:en\s+(?:la\s+)?pared|pared|al|sobre\s+(?:la\s+)?pared)\s+([a-z]+)/i);
  if (!wallMatch) return null;
  const wallReference = parseOrientation(wallMatch[1]);

  // Centrado en el muro
  const isCentered = /\b(?:centrada|centrado|al centro|en el centro|al medio)\b/i.test(text);

  // Distancia a esquina / muro perpendicular:
  // Ej: "a 0.2m de pared este", "a 20cm de pared este", "a 0.2 de la pared este", "a 0.2 de la esquina este"
  let distanceM: number | undefined = undefined;
  let referenceCornerWall: RelativeOrientation | undefined = undefined;

  const distCornerMatch = text.match(/a\s+([0-9.,]+(?:\s*(?:cm|centimetros?|metros?|mts?|m))?|[a-z\s]+?)\s+(?:de\s+(?:la\s+)?(?:pared|muro|esquina(?: con)?|el)?|del)?\s*([a-z]+)$/i);
  if (distCornerMatch) {
    const rawDist = distCornerMatch[1];
    const rawCorner = distCornerMatch[2];
    const parsedDist = parseSpanishNumber(rawDist);
    if (parsedDist !== null) {
      distanceM = parsedDist;
      referenceCornerWall = parseOrientation(rawCorner);
    }
  } else {
    // Distancia sin esquina especificada: "a 0.50m", "a 1 metro", "a 50cm"
    const distOnlyMatch = text.match(/a\s+([0-9.,]+(?:\s*(?:cm|centimetros?|metros?|mts?|m))?|un\s+metro|[a-z]+)(?:\s*(?:del?\s+borde|del?\s+inicio|de\s+la\s+esquina))?/i);
    if (distOnlyMatch) {
      const parsedDist = parseSpanishNumber(distOnlyMatch[1]);
      if (parsedDist !== null && parsedDist < 15) {
        distanceM = parsedDist;
      }
    }
  }

  // Ancho explícito: ej: "de 80cm", "de 0.80", "de 1.20"
  let widthM: number | undefined = undefined;
  const widthMatch = text.match(/(?:de|ancho)\s+([0-9.,]+(?:\s*(?:cm|centimetros?|metros?|mts?|m))?)/i);
  if (widthMatch) {
    const pw = parseSpanishNumber(widthMatch[1]);
    if (pw && pw > 0 && pw < 10) widthM = pw;
  }

  return {
    action: 'place_opening',
    openingType,
    wallReference,
    referenceCornerWall,
    distanceM,
    centered: isCentered,
    widthM
  };
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
  if (clean.includes('oeste')) return 'oeste';
  if (clean.includes('este')) return 'este';
  if (clean.includes('norte')) return 'norte';
  if (clean.includes('sur')) return 'sur';
  if (clean.includes('derecha')) return 'derecha';
  if (clean.includes('izquierda')) return 'izquierda';
  if (clean.includes('frente')) return 'frente';
  if (clean.includes('fondo')) return 'fondo';
  return 'norte';
}

function extractOpeningsFromText(text: string): Array<{
  type: NlpOpeningType;
  wall: RelativeOrientation;
  referenceCornerWall?: RelativeOrientation;
  centered?: boolean;
  distanceFromCornerM?: number;
}> {
  const openings: Array<{
    type: NlpOpeningType;
    wall: RelativeOrientation;
    referenceCornerWall?: RelativeOrientation;
    centered?: boolean;
    distanceFromCornerM?: number;
  }> = [];

  // Buscar puertas: captura puerta [en pared norte | al norte] [detalles...]
  const doorMatches = text.matchAll(/(?:puerta|porton|ingreso|acceso)\s+(?:en\s+(?:la\s+)?pared\s+([a-z]+)|al\s+([a-z]+))(.*?)(?=(?:puerta|ventana|porton|ingreso|acceso|$))/g);
  for (const m of doorMatches) {
    const wallWord = m[1] || m[2];
    const details = m[3] || '';
    if (wallWord) {
      let dist: number | undefined = undefined;
      let corner: RelativeOrientation | undefined = undefined;
      const cornerMatch = details.match(/a\s+([0-9.,]+(?:\s*(?:cm|centimetros?|metros?|mts?|m))?)\s+(?:de\s+(?:la\s+)?(?:pared|muro|esquina(?: con)?|el)?|del)?\s*([a-z]+)/i);
      if (cornerMatch) {
        dist = parseSpanishNumber(cornerMatch[1]) ?? undefined;
        corner = parseOrientation(cornerMatch[2]);
      }
      openings.push({
        type: 'door',
        wall: parseOrientation(wallWord),
        referenceCornerWall: corner,
        distanceFromCornerM: dist,
        centered: details.includes('centrada') || details.includes('al centro') || details.includes('al medio')
      });
    }
  }

  // Buscar ventanas
  const winMatches = text.matchAll(/(?:ventana|ventanal)\s+(?:en\s+(?:la\s+)?pared\s+([a-z]+)|al\s+([a-z]+))(.*?)(?=(?:puerta|ventana|porton|ingreso|acceso|$))/g);
  for (const m of winMatches) {
    const wallWord = m[1] || m[2];
    const details = m[3] || '';
    if (wallWord) {
      let dist: number | undefined = undefined;
      let corner: RelativeOrientation | undefined = undefined;
      const cornerMatch = details.match(/a\s+([0-9.,]+(?:\s*(?:cm|centimetros?|metros?|mts?|m))?)\s+(?:de\s+(?:la\s+)?(?:pared|muro|esquina(?: con)?|el)?|del)?\s*([a-z]+)/i);
      if (cornerMatch) {
        dist = parseSpanishNumber(cornerMatch[1]) ?? undefined;
        corner = parseOrientation(cornerMatch[2]);
      }
      openings.push({
        type: 'window',
        wall: parseOrientation(wallWord),
        referenceCornerWall: corner,
        distanceFromCornerM: dist,
        centered: details.includes('centrada') || details.includes('al centro') || details.includes('al medio')
      });
    }
  }

  return openings;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
