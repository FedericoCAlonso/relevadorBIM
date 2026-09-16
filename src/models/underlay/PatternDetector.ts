/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: PatternDetector.ts (Patrón Estricto MVVM)
 * Motor de detección de grafismos y símbolos técnicos sobre mapas de bits.
 * Combina:
 * 1. Auto-ceñido de muestra a píxeles de tinta (Tight Bounding Box).
 * 2. Apertura morfológica para desconectar cañerías y muros de los símbolos.
 * 3. Firma espectral de autovalores de 2do orden (invariantes a rotación).
 * 4. Correlación Cruzada Normalizada (ZNCC) multirrotacional a 0°, 90°, 180°, 270°.
 * 5. Aprendizaje activo con múltiples muestras positivas y descarte de negativos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface BoundingBoxPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageMoments {
  m00: number; // Área / masa (cantidad de píxeles oscuros)
  m10: number;
  m01: number;
  mu20: number; // Momento central de 2do orden XX
  mu02: number; // Momento central de 2do orden YY
  mu11: number; // Momento central de 2do orden XY
}

export interface EigenSignature {
  centroid: { x: number; y: number };
  eigenvalues: [number, number]; // [lambda1, lambda2] mayor a menor (invariantes a rotación)
  eccentricity: number;         // Relación de alargamiento entre ejes
  trace: number;                // lambda1 + lambda2 (Primer invariante de Hu)
  orientationRad: number;       // Ángulo del autovector principal
  orientationDeg: number;       // Ángulo en grados (-90 a 90)
  fillRatio: number;            // m00 / (width * height)
  pixelCount: number;           // m00
}

export interface NormalizedPatch {
  size: number;
  data: Float32Array; // Valores de densidad normalizados entre 0 y 1
  mean: number;
  std: number;
}

export interface PatternExemplar {
  id: string;
  boxPx: BoundingBoxPx;
  signature: EigenSignature;
  patch: NormalizedPatch;
  isNegative?: boolean;
}

export interface DetectedPatternMatch {
  id: string;
  boxPx: BoundingBoxPx;
  centerPx: { x: number; y: number };
  worldPos: { x: number; y: number }; // Coordenadas métricas en el proyecto
  orientationDeg: number;             // Orientación deducida por el autovector principal
  similarityScore: number;            // Coincidencia discriminada entre 0.0 y 1.0
  isDismissed?: boolean;
}

export const PATTERN_DETECTOR_CONSTANTS = {
  DEFAULT_SIMILARITY_THRESHOLD: 0.65,
  CANDIDATE_SEARCH_THRESHOLD: 0.35, // Umbral mínimo para conservar candidatos en memoria
  LUMINANCE_THRESHOLD: 180, // Umbral para considerar un píxel como trazo (tinta negra/gris)
  MIN_BLOB_PIXELS: 4,
  PATCH_SIZE: 24, // Malla de 24x24 para correlación fina
  MAX_BLOB_DIMENSION_FACTOR: 2.5,
  MIN_BLOB_DIMENSION_FACTOR: 0.4,
  NMS_DISTANCE_RATIO: 0.5, // Supresión de no-máximos
  SNAP_TOLERANCE_METERS: 0.40, // Tolerancia magnética al cursor en metros
  NEGATIVE_PENALTY_WEIGHT: 0.75 // Ponderación de rechazo a falsos positivos
} as const;

/**
 * Convierte un búfer de píxeles RGBA (ImageData) en una máscara binaria (1 = trazo oscuro, 0 = fondo blanco)
 */
export function binarizeImageData(
  rgbaData: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  luminanceThreshold: number = PATTERN_DETECTOR_CONSTANTS.LUMINANCE_THRESHOLD
): Uint8Array {
  const totalPixels = width * height;
  const binary = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const r = rgbaData[i * 4];
    const g = rgbaData[i * 4 + 1];
    const b = rgbaData[i * 4 + 2];
    const a = rgbaData[i * 4 + 3];

    // Píxel transparente o muy claro se considera fondo
    if (a < 50) {
      binary[i] = 0;
      continue;
    }

    // Luminancia estándar ITU-R BT.601
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    binary[i] = lum < luminanceThreshold ? 1 : 0;
  }

  return binary;
}

/**
 * Auto-ajusta el recuadro seleccionado por el usuario a la caja mínima envolvente
 * de tinta negra (Tight Bounding Box), eliminando bordes blancos asimétricos.
 */
export function tightenBoundingBox(
  binaryMask: Uint8Array,
  imgWidth: number,
  box: BoundingBoxPx
): BoundingBoxPx {
  const startX = Math.max(0, Math.floor(box.x));
  const endX = Math.min(imgWidth, Math.ceil(box.x + box.width));
  const startY = Math.max(0, Math.floor(box.y));
  const endY = Math.ceil(box.y + box.height);

  let minX = endX;
  let maxX = startX;
  let minY = endY;
  let maxY = startY;
  let foundPixel = false;

  for (let y = startY; y < endY; y++) {
    const rowOffset = y * imgWidth;
    for (let x = startX; x < endX; x++) {
      if (binaryMask[rowOffset + x] === 1) {
        foundPixel = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!foundPixel || maxX <= minX || maxY <= minY) {
    return box;
  }

  // Margen de 1 píxel para preservar extremos de trazos
  const pad = 1;
  const bx = Math.max(0, minX - pad);
  const by = Math.max(0, minY - pad);
  const bw = maxX - minX + 1 + pad * 2;
  const bh = maxY - minY + 1 + pad * 2;

  return { x: bx, y: by, width: bw, height: bh };
}

/**
 * Calcula la imagen integral (Summed-Area Table) para consultas O(1) de densidad de trazos
 */
export function computeIntegralImage(
  binaryMask: Uint8Array,
  width: number,
  height: number
): Int32Array {
  const stride = width + 1;
  const integral = new Int32Array(stride * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const rowOffset = y * width;
    const intRowOffset = (y + 1) * stride;
    const prevIntRowOffset = y * stride;

    for (let x = 0; x < width; x++) {
      rowSum += binaryMask[rowOffset + x];
      integral[intRowOffset + x + 1] = integral[prevIntRowOffset + x + 1] + rowSum;
    }
  }

  return integral;
}

/**
 * Consulta la suma de píxeles activos en un rectángulo en O(1) usando la imagen integral
 */
export function queryIntegralSum(
  integral: Int32Array,
  stride: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return (
    integral[y2 * stride + x2] -
    integral[y1 * stride + x2] -
    integral[y2 * stride + x1] +
    integral[y1 * stride + x1]
  );
}

/**
 * Calcula los momentos geométricos centrales de una región o máscara binaria
 */
export function calculateImageMoments(
  binaryMask: Uint8Array,
  imgWidth: number,
  box: BoundingBoxPx
): ImageMoments {
  let m00 = 0;
  let m10 = 0;
  let m01 = 0;

  const startX = Math.max(0, Math.floor(box.x));
  const endX = Math.min(imgWidth, Math.floor(box.x + box.width));
  const startY = Math.max(0, Math.floor(box.y));
  const endY = Math.floor(box.y + box.height);

  // 1er paso: momentos de orden 0 y 1 para hallar el centroide (xBar, yBar)
  for (let y = startY; y < endY; y++) {
    const rowOffset = y * imgWidth;
    for (let x = startX; x < endX; x++) {
      if (binaryMask[rowOffset + x] === 1) {
        m00++;
        m10 += x;
        m01 += y;
      }
    }
  }

  if (m00 === 0) {
    return { m00: 0, m10: 0, m01: 0, mu20: 0, mu02: 0, mu11: 0 };
  }

  const xBar = m10 / m00;
  const yBar = m01 / m00;

  // 2do paso: momentos centrales de 2do orden
  let mu20 = 0;
  let mu02 = 0;
  let mu11 = 0;

  for (let y = startY; y < endY; y++) {
    const rowOffset = y * imgWidth;
    const dy = y - yBar;
    for (let x = startX; x < endX; x++) {
      if (binaryMask[rowOffset + x] === 1) {
        const dx = x - xBar;
        mu20 += dx * dx;
        mu02 += dy * dy;
        mu11 += dx * dy;
      }
    }
  }

  return { m00, m10, m01, mu20, mu02, mu11 };
}

/**
 * Obtiene la firma espectral de autovalores y autovectores (invariantes a rotación)
 */
export function calculateEigenSignature(
  moments: ImageMoments,
  boxWidth: number,
  boxHeight: number
): EigenSignature | null {
  if (moments.m00 < PATTERN_DETECTOR_CONSTANTS.MIN_BLOB_PIXELS) {
    return null;
  }

  const centroid = {
    x: moments.m10 / moments.m00,
    y: moments.m01 / moments.m00
  };

  // Normalización de escala invariante: eta_pq = mu_pq / (m00^2)
  const normFactor = moments.m00 * moments.m00;
  const eta20 = moments.mu20 / normFactor;
  const eta02 = moments.mu02 / normFactor;
  const eta11 = moments.mu11 / normFactor;

  // Matriz de inercia / covarianza 2D:
  // [ eta20  eta11 ]
  // [ eta11  eta02 ]
  const trace = eta20 + eta02;
  const diff = eta20 - eta02;
  const delta = Math.sqrt(Math.max(0, diff * diff + 4 * eta11 * eta11));

  // Autovalores (lambda1 >= lambda2)
  const lambda1 = (trace + delta) / 2;
  const lambda2 = Math.max(0, (trace - delta) / 2);

  // Excentricidad geométrica
  const eccentricity = lambda1 > 0 ? Math.sqrt(Math.max(0, 1 - lambda2 / lambda1)) : 0;

  // Ángulo del autovector principal
  const orientationRad = 0.5 * Math.atan2(2 * eta11, diff);
  const orientationDeg = Number(((orientationRad * 180) / Math.PI).toFixed(1));

  const boxArea = Math.max(1, boxWidth * boxHeight);
  const fillRatio = moments.m00 / boxArea;

  return {
    centroid,
    eigenvalues: [lambda1, lambda2],
    eccentricity,
    trace,
    orientationRad,
    orientationDeg,
    fillRatio,
    pixelCount: moments.m00
  };
}

/**
 * Extrae un parche re-muestreado a una cuadrícula canónica (ej. 24x24)
 * calculando la media y desviación estándar para la Correlación Cruzada Normalizada (ZNCC).
 */
export function extractNormalizedPatch(
  binaryMask: Uint8Array,
  imgWidth: number,
  box: BoundingBoxPx,
  patchSize: number = PATTERN_DETECTOR_CONSTANTS.PATCH_SIZE
): NormalizedPatch {
  const data = new Float32Array(patchSize * patchSize);
  const stepX = box.width / patchSize;
  const stepY = box.height / patchSize;

  let sum = 0;
  let sumSq = 0;

  for (let py = 0; py < patchSize; py++) {
    const srcY = Math.floor(box.y + py * stepY);
    const rowOffset = srcY * imgWidth;
    for (let px = 0; px < patchSize; px++) {
      const srcX = Math.floor(box.x + px * stepX);
      const val = srcX >= 0 && srcX < imgWidth && srcY >= 0 ? binaryMask[rowOffset + srcX] : 0;
      const idx = py * patchSize + px;
      data[idx] = val;
      sum += val;
      sumSq += val * val;
    }
  }

  const n = patchSize * patchSize;
  const mean = sum / n;
  const variance = Math.max(1e-7, sumSq / n - mean * mean);
  const std = Math.sqrt(variance);

  return { size: patchSize, data, mean, std };
}

/**
 * Calcula la Correlación Cruzada Normalizada (ZNCC) entre dos parches,
 * evaluando las 4 orientaciones cardinales (0°, 90°, 180°, 270°) y retornando
 * la máxima coincidencia visual en el rango [0.0, 1.0].
 * Correlaciones negativas o nulas indican patrones disímiles y retornan 0.0.
 */
export function calculateMultiRotationZNCC(
  patchA: NormalizedPatch,
  patchB: NormalizedPatch
): number {
  const n = patchA.size;
  const total = n * n;
  const denom = total * patchA.std * patchB.std;
  if (denom < 1e-6) return 0;

  let maxCorr = -1;

  // 4 Rotaciones ortogonales de la plantilla B: 0°, 90°, 180°, 270°
  const rotOffsets = [
    // 0°: (x, y) -> (x, y)
    (px: number, py: number) => py * n + px,
    // 90°: (x, y) -> (y, n - 1 - x)
    (px: number, py: number) => px * n + (n - 1 - py),
    // 180°: (x, y) -> (n - 1 - x, n - 1 - y)
    (px: number, py: number) => (n - 1 - py) * n + (n - 1 - px),
    // 270°: (x, y) -> (n - 1 - y, x)
    (px: number, py: number) => (n - 1 - px) * n + py
  ];

  for (let r = 0; r < 4; r++) {
    const getIdxB = rotOffsets[r];
    let cov = 0;

    for (let py = 0; py < n; py++) {
      for (let px = 0; px < n; px++) {
        const idxA = py * n + px;
        const idxB = getIdxB(px, py);
        cov += (patchA.data[idxA] - patchA.mean) * (patchB.data[idxB] - patchB.mean);
      }
    }

    const corr = cov / denom;
    if (corr > maxCorr) {
      maxCorr = corr;
    }
  }

  // Normalizar correlación estricta [0, 1]: corr <= 0 indica incompatibilidad gráfica total
  return Number(Math.max(0, Math.min(1, maxCorr)).toFixed(3));
}

/**
 * Compara dos firmas espectrales de autovalores.
 * Retorna un puntaje de similitud entre 0.0 y 1.0 (invariante a rotación).
 */
export function compareEigenSignatures(target: EigenSignature, candidate: EigenSignature): number {
  const eps = 1e-7;

  // Error relativo en los autovalores invariantes
  const errL1 = Math.abs(candidate.eigenvalues[0] - target.eigenvalues[0]) / Math.max(target.eigenvalues[0], eps);
  const errL2 = Math.abs(candidate.eigenvalues[1] - target.eigenvalues[1]) / Math.max(target.eigenvalues[1], eps);

  // Error en la excentricidad / elongación
  const errEcc = Math.abs(candidate.eccentricity - target.eccentricity);

  // Error en la relación de llenado de píxeles
  const errFill = Math.abs(candidate.fillRatio - target.fillRatio) / Math.max(target.fillRatio, eps);

  const weightedDistance = 1.0 * errL1 + 1.0 * errL2 + 0.6 * errEcc + 0.5 * errFill;
  const score = Math.exp(-weightedDistance);

  return Number(Math.max(0, Math.min(1, score)).toFixed(3));
}

/**
 * Calcula la similitud combinada de un candidato con un ejemplar:
 * 35% Autovalores espectrales + 65% Verificación gráfica fina ZNCC.
 */
export function calculateExemplarSimilarity(
  candSignature: EigenSignature,
  candPatch: NormalizedPatch,
  exemplar: PatternExemplar
): number {
  const eigenScore = compareEigenSignatures(exemplar.signature, candSignature);
  const znccScore = calculateMultiRotationZNCC(candPatch, exemplar.patch);

  // Fusión discriminante
  return Number((0.35 * eigenScore + 0.65 * znccScore).toFixed(3));
}

/**
 * Extrae recuadros de componentes conexas (blobs) candidatos directamente
 * sobre la máscara binaria sin erosión destructiva para preservar trazos finos.
 */
export function extractCandidateBlobs(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  targetBox: BoundingBoxPx
): BoundingBoxPx[] {
  const minDim = Math.min(targetBox.width, targetBox.height);
  const maxDim = Math.max(targetBox.width, targetBox.height);

  const minSize = Math.max(3, Math.floor(minDim * PATTERN_DETECTOR_CONSTANTS.MIN_BLOB_DIMENSION_FACTOR));
  const maxSize = Math.ceil(maxDim * PATTERN_DETECTOR_CONSTANTS.MAX_BLOB_DIMENSION_FACTOR);

  const visited = new Uint8Array(width * height);
  const candidates: BoundingBoxPx[] = [];

  const stackX = new Int32Array(maxSize * maxSize * 4);
  const stackY = new Int32Array(maxSize * maxSize * 4);

  const stepX = Math.max(1, Math.floor(minSize / 3));
  const stepY = Math.max(1, Math.floor(minSize / 3));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = y * width + x;
      if (binaryMask[idx] === 0 || visited[idx] === 1) continue;

      let minBx = x;
      let maxBx = x;
      let minBy = y;
      let maxBy = y;
      let count = 0;
      let isTooLarge = false;

      let stackPtr = 0;
      stackX[stackPtr] = x;
      stackY[stackPtr] = y;
      stackPtr++;
      visited[idx] = 1;

      while (stackPtr > 0) {
        stackPtr--;
        const currX = stackX[stackPtr];
        const currY = stackY[stackPtr];
        count++;

        if (currX < minBx) minBx = currX;
        if (currX > maxBx) maxBx = currX;
        if (currY < minBy) minBy = currY;
        if (currY > maxBy) maxBy = currY;

        if (maxBx - minBx > maxSize || maxBy - minBy > maxSize) {
          isTooLarge = true;
          break;
        }

        const neighbors = [
          [currX + 1, currY],
          [currX - 1, currY],
          [currX, currY + 1],
          [currX, currY - 1]
        ];

        for (let i = 0; i < 4; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (binaryMask[nIdx] === 1 && visited[nIdx] === 0) {
              visited[nIdx] = 1;
              if (stackPtr < stackX.length - 1) {
                stackX[stackPtr] = nx;
                stackY[stackPtr] = ny;
                stackPtr++;
              }
            }
          }
        }
      }

      if (!isTooLarge && count >= PATTERN_DETECTOR_CONSTANTS.MIN_BLOB_PIXELS) {
        const bw = maxBx - minBx + 1;
        const bh = maxBy - minBy + 1;
        if (bw >= minSize && bh >= minSize && bw <= maxSize && bh <= maxSize) {
          candidates.push({
            x: minBx,
            y: minBy,
            width: bw,
            height: bh
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Extrae candidatos por densidad de tinta usando imagen integral.
 * Permite detectar símbolos aunque estén físicamente conectados a muros o cañerías.
 */
export function extractDensityCandidates(
  integral: Int32Array,
  width: number,
  height: number,
  targetBox: BoundingBoxPx,
  expectedPixelCount: number
): BoundingBoxPx[] {
  const stride = width + 1;
  const w = Math.round(targetBox.width);
  const h = Math.round(targetBox.height);
  const stepX = Math.max(3, Math.floor(w / 3));
  const stepY = Math.max(3, Math.floor(h / 3));

  const minDensity = Math.max(PATTERN_DETECTOR_CONSTANTS.MIN_BLOB_PIXELS, Math.floor(expectedPixelCount * 0.35));
  const maxDensity = Math.ceil(expectedPixelCount * 3.0);

  const candidates: BoundingBoxPx[] = [];

  for (let y = 0; y <= height - h; y += stepY) {
    for (let x = 0; x <= width - w; x += stepX) {
      const sum = queryIntegralSum(integral, stride, x, y, x + w, y + h);
      if (sum >= minDensity && sum <= maxDensity) {
        candidates.push({ x, y, width: w, height: h });
      }
    }
  }

  return candidates;
}

/**
 * Aplica Supresión de No-Máximos (NMS) para eliminar recuadros duplicados
 */
export function applyNonMaximumSuppression(
  matches: DetectedPatternMatch[],
  minDistancePx: number
): DetectedPatternMatch[] {
  const sorted = [...matches].sort((a, b) => b.similarityScore - a.similarityScore);
  const selected: DetectedPatternMatch[] = [];

  for (const candidate of sorted) {
    const tooClose = selected.some((s) => {
      const dx = candidate.centerPx.x - s.centerPx.x;
      const dy = candidate.centerPx.y - s.centerPx.y;
      return Math.hypot(dx, dy) < minDistancePx;
    });

    if (!tooClose) {
      selected.push(candidate);
    }
  }

  return selected;
}

/**
 * Crea un ejemplar a partir de una caja de muestra en la máscara binaria original
 */
export function createPatternExemplar(
  binaryMask: Uint8Array,
  imgWidth: number,
  box: BoundingBoxPx,
  isNegative: boolean = false
): PatternExemplar | null {
  const tightBox = tightenBoundingBox(binaryMask, imgWidth, box);
  const moments = calculateImageMoments(binaryMask, imgWidth, tightBox);
  const signature = calculateEigenSignature(moments, tightBox.width, tightBox.height);
  if (!signature) return null;

  const patch = extractNormalizedPatch(binaryMask, imgWidth, tightBox);
  return {
    id: `ex-${Date.now()}-${Math.round(tightBox.x)}_${Math.round(tightBox.y)}`,
    boxPx: tightBox,
    signature,
    patch,
    isNegative
  };
}

/**
 * Pipeline de Detección de Patrones con Aprendizaje Activo (Muestras Positivas y Negativas)
 */
export function detectPatternMatchesWithExemplars(
  binaryMask: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  positiveExemplars: PatternExemplar[],
  negativeExemplars: PatternExemplar[],
  scaleMetersPerPx: number,
  originWorld: { x: number; y: number },
  similarityThreshold: number = PATTERN_DETECTOR_CONSTANTS.DEFAULT_SIMILARITY_THRESHOLD
): DetectedPatternMatch[] {
  if (positiveExemplars.length === 0) return [];

  // Usar las dimensiones y densidad promedio de los ejemplares positivos
  const avgWidth =
    positiveExemplars.reduce((acc, ex) => acc + ex.boxPx.width, 0) / positiveExemplars.length;
  const avgHeight =
    positiveExemplars.reduce((acc, ex) => acc + ex.boxPx.height, 0) / positiveExemplars.length;
  const avgPixelCount =
    positiveExemplars.reduce((acc, ex) => acc + ex.signature.pixelCount, 0) / positiveExemplars.length;

  const referenceBox: BoundingBoxPx = {
    x: 0,
    y: 0,
    width: avgWidth,
    height: avgHeight
  };

  // 1. Extraer candidatos por componentes conexas directamente en la máscara binaria
  const blobCandidates = extractCandidateBlobs(binaryMask, imgWidth, imgHeight, referenceBox);

  // 2. Extraer candidatos por densidad con imagen integral (para símbolos conectados a muros o cañerías)
  const integral = computeIntegralImage(binaryMask, imgWidth, imgHeight);
  const densityCandidates = extractDensityCandidates(
    integral,
    imgWidth,
    imgHeight,
    referenceBox,
    avgPixelCount
  );

  const candidateBlobs = [...blobCandidates, ...densityCandidates];
  const rawMatches: DetectedPatternMatch[] = [];
  const targetRadiusPx = Math.max(avgWidth, avgHeight) / 2;

  // 3. Inyectar ejemplares positivos como candidatos semilla garantizados (Ground Truth)
  // con similitud máxima (1.0). Al someterse a NMS con ordenamiento por score,
  // prevalecen sobre cualquier candidato heurístico ruidoso o desplazado en esa misma ubicación.
  for (const posEx of positiveExemplars) {
    const centerPx = posEx.signature.centroid;
    const worldPos = {
      x: Number((originWorld.x + centerPx.x * scaleMetersPerPx).toFixed(3)),
      y: Number((originWorld.y + centerPx.y * scaleMetersPerPx).toFixed(3))
    };

    const seedBox: BoundingBoxPx = {
      x: Math.max(0, Math.round(centerPx.x - avgWidth / 2)),
      y: Math.max(0, Math.round(centerPx.y - avgHeight / 2)),
      width: avgWidth,
      height: avgHeight
    };

    rawMatches.push({
      id: `match-${Math.round(centerPx.x)}_${Math.round(centerPx.y)}`,
      boxPx: seedBox,
      centerPx,
      worldPos,
      orientationDeg: posEx.signature.orientationDeg,
      similarityScore: 1.0
    });
  }

  // 4. Evaluar cada candidato heurístico contra ejemplares positivos y penalizar con negativos
  for (let i = 0; i < candidateBlobs.length; i++) {
    const blob = candidateBlobs[i];
    const centerX = blob.x + blob.width / 2;
    const centerY = blob.y + blob.height / 2;

    const testBox: BoundingBoxPx = {
      x: Math.max(0, centerX - avgWidth / 2),
      y: Math.max(0, centerY - avgHeight / 2),
      width: avgWidth,
      height: avgHeight
    };

    // Evaluamos en la máscara binaria original y aplicamos 1 paso de Mean-Shift
    // para centrar el recuadro exactamente sobre el centroide de tinta del grafismo
    const initialMoments = calculateImageMoments(binaryMask, imgWidth, testBox);
    if (initialMoments.m00 < PATTERN_DETECTOR_CONSTANTS.MIN_BLOB_PIXELS) continue;

    const refinedCenterX = initialMoments.m10 / initialMoments.m00;
    const refinedCenterY = initialMoments.m01 / initialMoments.m00;

    const centeredBox: BoundingBoxPx = {
      x: Math.max(0, Math.round(refinedCenterX - avgWidth / 2)),
      y: Math.max(0, Math.round(refinedCenterY - avgHeight / 2)),
      width: avgWidth,
      height: avgHeight
    };

    const candMoments = calculateImageMoments(binaryMask, imgWidth, centeredBox);
    const candSignature = calculateEigenSignature(candMoments, centeredBox.width, centeredBox.height);

    if (candSignature) {
      const candPatch = extractNormalizedPatch(binaryMask, imgWidth, centeredBox);

      // Similitud máxima con las muestras positivas
      let maxPositiveScore = 0;
      for (const posEx of positiveExemplars) {
        const score = calculateExemplarSimilarity(candSignature, candPatch, posEx);
        if (score > maxPositiveScore) {
          maxPositiveScore = score;
        }
      }

      // Penalización con las muestras negativas (falsos positivos descartados)
      let maxNegativePen = 0;
      for (const negEx of negativeExemplars) {
        const pen = calculateExemplarSimilarity(candSignature, candPatch, negEx);
        if (pen > maxNegativePen) {
          maxNegativePen = pen;
        }
      }

      // Puntaje discriminante final: penaliza fuertemente falsos positivos
      const finalScore = Number(
        Math.max(
          0,
          maxPositiveScore - PATTERN_DETECTOR_CONSTANTS.NEGATIVE_PENALTY_WEIGHT * maxNegativePen
        ).toFixed(3)
      );

      if (finalScore >= similarityThreshold) {
        const centerPx = candSignature.centroid;
        const worldPos = {
          x: Number((originWorld.x + centerPx.x * scaleMetersPerPx).toFixed(3)),
          y: Number((originWorld.y + centerPx.y * scaleMetersPerPx).toFixed(3))
        };

        rawMatches.push({
          id: `match-${Math.round(centerPx.x)}_${Math.round(centerPx.y)}`,
          boxPx: centeredBox,
          centerPx,
          worldPos,
          orientationDeg: candSignature.orientationDeg,
          similarityScore: finalScore
        });
      }
    }
  }

  // 4. Supresión de no-máximos
  const minSeparationPx = targetRadiusPx * PATTERN_DETECTOR_CONSTANTS.NMS_DISTANCE_RATIO;
  return applyNonMaximumSuppression(rawMatches, minSeparationPx);
}

/**
 * Función de conveniencia para mantener compatibilidad directa
 */
export function detectPatternMatches(
  binaryMask: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  sampleBox: BoundingBoxPx,
  scaleMetersPerPx: number,
  originWorld: { x: number; y: number },
  similarityThreshold: number = PATTERN_DETECTOR_CONSTANTS.DEFAULT_SIMILARITY_THRESHOLD
): DetectedPatternMatch[] {
  const exemplar = createPatternExemplar(binaryMask, imgWidth, sampleBox, false);
  if (!exemplar) return [];

  return detectPatternMatchesWithExemplars(
    binaryMask,
    imgWidth,
    imgHeight,
    [exemplar],
    [],
    scaleMetersPerPx,
    originWorld,
    similarityThreshold
  );
}
