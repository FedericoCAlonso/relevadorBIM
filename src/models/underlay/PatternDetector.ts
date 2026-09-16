/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: PatternDetector.ts (Patrón Estricto MVVM)
 * Detección de patrones geométricos y símbolos de planos en mapas de bits
 * mediante Autovalores/Autovectores e invariantes de momentos de inercia 2D.
 * Invariante a rotaciones (0°, 90°, 180°, 270° y ángulos arbitrarios).
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

export interface DetectedPatternMatch {
  id: string;
  boxPx: BoundingBoxPx;
  centerPx: { x: number; y: number };
  worldPos: { x: number; y: number }; // Coordenadas métricas en el proyecto
  orientationDeg: number;             // Orientación deducida por el autovector principal
  similarityScore: number;            // Coincidencia entre 0.0 y 1.0
  isDismissed?: boolean;
}

export const PATTERN_DETECTOR_CONSTANTS = {
  DEFAULT_SIMILARITY_THRESHOLD: 0.72,
  LUMINANCE_THRESHOLD: 180, // Píxeles con luminancia menor a 180 se consideran trazo/tinta
  MIN_BLOB_PIXELS: 8,
  MAX_BLOB_DIMENSION_FACTOR: 2.5,
  MIN_BLOB_DIMENSION_FACTOR: 0.4,
  NMS_DISTANCE_RATIO: 0.6, // Supresión de no-máximos
  SNAP_TOLERANCE_METERS: 0.40 // Tolerancia de atracción magnética al cursor en metros
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
  // Traza T y discriminante Delta
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

  // Ponderación exponencial de distancia geométrica
  const weightedDistance = 1.2 * errL1 + 1.2 * errL2 + 0.6 * errEcc + 0.5 * errFill;
  const score = Math.exp(-weightedDistance);

  return Number(Math.max(0, Math.min(1, score)).toFixed(3));
}

/**
 * Extrae recuadros de componentes conexas (blobs) candidatos cuyo tamaño sea
 * consistente con el símbolo objetivo.
 */
export function extractCandidateBlobs(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  targetBox: BoundingBoxPx
): BoundingBoxPx[] {
  const minDim = Math.min(targetBox.width, targetBox.height);
  const maxDim = Math.max(targetBox.width, targetBox.height);

  const minSize = Math.max(6, Math.floor(minDim * PATTERN_DETECTOR_CONSTANTS.MIN_BLOB_DIMENSION_FACTOR));
  const maxSize = Math.ceil(maxDim * PATTERN_DETECTOR_CONSTANTS.MAX_BLOB_DIMENSION_FACTOR);

  const visited = new Uint8Array(width * height);
  const candidates: BoundingBoxPx[] = [];

  // Pila para BFS rápido sin recursión
  const stackX = new Int32Array(maxSize * maxSize * 4);
  const stackY = new Int32Array(maxSize * maxSize * 4);

  const stepX = Math.max(1, Math.floor(minSize / 4));
  const stepY = Math.max(1, Math.floor(minSize / 4));

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

        // Si excede el tamaño máximo (ej. muro largo continuo), abortar exploración
        if (maxBx - minBx > maxSize || maxBy - minBy > maxSize) {
          isTooLarge = true;
          break;
        }

        // Vecinos 4-conectados
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
 * Aplica Supresión de No-Máximos (NMS) para eliminar recuadros duplicados
 */
export function applyNonMaximumSuppression(
  matches: DetectedPatternMatch[],
  minDistancePx: number
): DetectedPatternMatch[] {
  // Ordenar de mayor a menor coincidencia
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
 * Pipeline completo de Detección de Patrones por Autovalores
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
  // 1. Calcular momentos y firma espectral de autovalores del símbolo muestra
  const targetMoments = calculateImageMoments(binaryMask, imgWidth, sampleBox);
  const targetSignature = calculateEigenSignature(targetMoments, sampleBox.width, sampleBox.height);

  if (!targetSignature) {
    return [];
  }

  // 2. Extraer candidatos conexos en todo el plano
  const candidateBlobs = extractCandidateBlobs(binaryMask, imgWidth, imgHeight, sampleBox);

  const rawMatches: DetectedPatternMatch[] = [];
  const targetRadiusPx = Math.max(sampleBox.width, sampleBox.height) / 2;

  // 3. Evaluar cada candidato con la firma de autovalores invariante
  for (let i = 0; i < candidateBlobs.length; i++) {
    const blob = candidateBlobs[i];
    // Evaluar la ventana del tamaño del símbolo centrada en el blob
    const centerX = blob.x + blob.width / 2;
    const centerY = blob.y + blob.height / 2;
    const testBox: BoundingBoxPx = {
      x: Math.max(0, centerX - sampleBox.width / 2),
      y: Math.max(0, centerY - sampleBox.height / 2),
      width: sampleBox.width,
      height: sampleBox.height
    };

    const candMoments = calculateImageMoments(binaryMask, imgWidth, testBox);
    const candSignature = calculateEigenSignature(candMoments, testBox.width, testBox.height);

    if (candSignature) {
      const score = compareEigenSignatures(targetSignature, candSignature);
      if (score >= similarityThreshold) {
        const centerPx = candSignature.centroid;
        const worldPos = {
          x: Number((originWorld.x + centerPx.x * scaleMetersPerPx).toFixed(3)),
          y: Number((originWorld.y + centerPx.y * scaleMetersPerPx).toFixed(3))
        };

        rawMatches.push({
          id: `match-${rawMatches.length + 1}-${Math.round(centerPx.x)}_${Math.round(centerPx.y)}`,
          boxPx: testBox,
          centerPx,
          worldPos,
          orientationDeg: candSignature.orientationDeg,
          similarityScore: score
        });
      }
    }
  }

  // 4. Supresión de No-Máximos
  const minSeparationPx = targetRadiusPx * PATTERN_DETECTOR_CONSTANTS.NMS_DISTANCE_RATIO;
  return applyNonMaximumSuppression(rawMatches, minSeparationPx);
}
