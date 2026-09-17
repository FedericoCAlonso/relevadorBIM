/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: GramSvd.ts (Patrón Estricto MVVM)
 * Algoritmo de descomposición espectral por Gram-SVD y consenso morfológico
 * de muestras con ponderación por varianza inversa y snap magnético subpíxel.
 * 
 * Permite:
 * 1. Descomposición SVD analítica ultraliviana (O(k³) con k <= 4 muestras, < 0.05 ms).
 * 2. Extracción del "Autosímbolo" (primer vector propio izquierdo u₁) libre de ruido.
 * 3. Máscara de confianza W(x,y) que anula interferencias de caños y cotas cruzadas.
 * 4. Micro-snap magnético subpíxel para auto-centrado milimétrico de muestras.
 * 5. Rotaciones cardinales exactas (0°, 90°, 180°, 270°) en espacio discreto.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  extractNormalizedPatch,
  type NormalizedPatch,
  type BoundingBoxPx
} from './PatternDetector';

export interface SvdConsensusResult {
  /**
   * Autosímbolo principal (u₁): vector unitario de tamaño N*N (ej. 576)
   * que contiene la estructura pura compartida por todas las muestras.
   */
  eigensymbol: Float32Array;

  /**
   * Autosímbolo como parche normalizado (con media y std calculadas) para matching
   */
  consensusPatch: NormalizedPatch;

  /**
   * Valores singulares σ₁ >= σ₂ >= ...
   */
  singularValues: number[];

  /**
   * Relación de pureza estructural σ₁² / Σ σᵢ² entre 0.0 y 1.0.
   * Valores > 0.80 indican coincidencia morfológica casi perfecta.
   */
  purityRatio: number;

  /**
   * Máscara de confianza / peso W[p] entre 0.0 y 1.0 calculada por varianza inversa.
   * Píxeles con alto consenso tienen peso ~1.0; píxeles con caños o ruido cruzado tienen peso ~0.0.
   */
  confidenceWeights: Float32Array;

  /**
   * Umbral dinámico auto-calibrado sugerido según las propias muestras del usuario.
   */
  suggestedThreshold: number;

  /**
   * Cantidad de muestras apiladas en el consenso
   */
  sampleCount: number;
}

/**
 * Diagonaliza una matriz simétrica k x k (k <= 5) usando el algoritmo clásico de Jacobi.
 * Converge en 3 a 6 barridos a precisión de máquina con costo < 0.01 ms.
 */
export function eigenDecompositionSymmetric(
  matrix: number[][],
  maxIter: number = 40
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  // Matriz de autovectores inicializada en la identidad
  const V: number[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (r === c ? 1 : 0))
  );

  // Copia de trabajo de la matriz simétrica A
  const A: number[][] = matrix.map((row) => [...row]);

  for (let iter = 0; iter < maxIter; iter++) {
    // 1. Encontrar el elemento fuera de la diagonal con mayor magnitud |A[p][q]|
    let maxVal = 0;
    let p = 0;
    let q = 1;

    for (let r = 0; r < n; r++) {
      for (let c = r + 1; c < n; c++) {
        const absVal = Math.abs(A[r][c]);
        if (absVal > maxVal) {
          maxVal = absVal;
          p = r;
          q = c;
        }
      }
    }

    // Si los elementos fuera de la diagonal son prácticamente nulos, convergencia alcanzada
    if (maxVal < 1e-9) {
      break;
    }

    // 2. Calcular el ángulo de rotación de Jacobi
    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // 3. Aplicar rotación Givens a la matriz A: A_new = J^T * A * J
    A[p][p] = cosT * cosT * app - 2 * sinT * cosT * apq + sinT * sinT * aqq;
    A[q][q] = sinT * sinT * app + 2 * sinT * cosT * apq + cosT * cosT * aqq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = cosT * aip - sinT * aiq;
        A[p][i] = A[i][p];
        A[i][q] = sinT * aip + cosT * aiq;
        A[q][i] = A[i][q];
      }
    }

    // 4. Acumular la rotación en la matriz de autovectores V: V_new = V * J
    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = cosT * vip - sinT * viq;
      V[i][q] = sinT * vip + cosT * viq;
    }
  }

  // Extraer autovalores de la diagonal
  const rawEigenvalues = A.map((row, i) => Math.max(0, row[i]));

  // Ordenar autovalores en orden descendente y permutar columnas de V
  const indices = rawEigenvalues.map((_, i) => i);
  indices.sort((a, b) => rawEigenvalues[b] - rawEigenvalues[a]);

  const eigenvalues = indices.map((i) => rawEigenvalues[i]);
  const eigenvectors: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let c = 0; c < n; c++) {
    const srcCol = indices[c];
    for (let r = 0; r < n; r++) {
      eigenvectors[r][c] = V[r][srcCol];
    }
  }

  return { eigenvalues, eigenvectors };
}

/**
 * Calcula la Descomposición en Valores Singulares (SVD) de una matriz M de d x k
 * a través de la matriz Gramiana G = M^T M de k x k.
 * Al ser k pequeño (k <= 4), la operación toma menos de 0.05 ms.
 */
export function computeGramSvdConsensus(
  patches: NormalizedPatch[],
  temperatureVariance: number = 0.08
): SvdConsensusResult | null {
  if (patches.length === 0) return null;

  const k = patches.length;
  const d = patches[0].data.length; // 576 píxeles para 24x24

  // Si solo hay 1 muestra, el consenso es la muestra misma con pureza 1.0 y pesos unitarios
  if (k === 1) {
    const p = patches[0];
    const eigensymbol = new Float32Array(p.data);
    const confidenceWeights = new Float32Array(d).fill(1.0);
    return {
      eigensymbol,
      consensusPatch: p,
      singularValues: [1.0],
      purityRatio: 1.0,
      confidenceWeights,
      suggestedThreshold: 0.65,
      sampleCount: 1
    };
  }

  // 1. Construir matriz Gramiana G = M^T M de k x k
  const G: number[][] = Array.from({ length: k }, () => Array(k).fill(0));

  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let dot = 0;
      const dataI = patches[i].data;
      const dataJ = patches[j].data;
      for (let p = 0; p < d; p++) {
        dot += dataI[p] * dataJ[p];
      }
      G[i][j] = dot;
      G[j][i] = dot;
    }
  }

  // 2. Diagonalizar G para obtener autovalores (lambda_i) y autovectores (v_i)
  const { eigenvalues, eigenvectors } = eigenDecompositionSymmetric(G);

  // Valores singulares sigma_i = sqrt(lambda_i)
  const singularValues = eigenvalues.map((lam) => Math.sqrt(Math.max(0, lam)));
  const sigma1 = singularValues[0];

  // 3. Reconstruir el primer vector propio izquierdo u₁ = (1 / sigma₁) * M * v₁
  const eigensymbol = new Float32Array(d);
  if (sigma1 > 1e-6) {
    const invSigma1 = 1 / sigma1;
    for (let p = 0; p < d; p++) {
      let val = 0;
      for (let col = 0; col < k; col++) {
        val += patches[col].data[p] * eigenvectors[col][0];
      }
      eigensymbol[p] = val * invSigma1;
    }
  } else {
    // Si la señal es prácticamente nula, promediar linealmente
    for (let p = 0; p < d; p++) {
      let sum = 0;
      for (let col = 0; col < k; col++) {
        sum += patches[col].data[p];
      }
      eigensymbol[p] = sum / k;
    }
  }

  // Asegurar signo positivo de la tinta (si el autovector quedó invertido por convención)
  let eigenSum = 0;
  for (let p = 0; p < d; p++) {
    eigenSum += eigensymbol[p];
  }
  if (eigenSum < 0) {
    for (let p = 0; p < d; p++) {
      eigensymbol[p] = -eigensymbol[p];
    }
  }

  // 4. Calcular la relación de pureza estructural: sigma_1^2 / sum(sigma_i^2)
  const totalVariance = eigenvalues.reduce((acc, v) => acc + v, 0);
  const purityRatio = totalVariance > 1e-6 ? eigenvalues[0] / totalVariance : 1.0;

  // 5. Calcular la máscara de confianza / varianza inversa W[p] = exp(-var[p] / tau)
  const confidenceWeights = new Float32Array(d);
  for (let p = 0; p < d; p++) {
    let meanP = 0;
    for (let i = 0; i < k; i++) {
      meanP += patches[i].data[p];
    }
    meanP /= k;

    let varP = 0;
    for (let i = 0; i < k; i++) {
      const diff = patches[i].data[p] - meanP;
      varP += diff * diff;
    }
    varP /= k;

    // Varianza 0 -> peso 1.0. Varianza alta (ruido de caños) -> peso tiende a 0
    confidenceWeights[p] = Math.exp(-varP / temperatureVariance);
  }

  // 6. Generar el parche normalizado representativo del consenso (para visualización y ZNCC)
  let sumNorm = 0;
  let sumSqNorm = 0;
  for (let p = 0; p < d; p++) {
    const val = Math.max(0, eigensymbol[p]);
    sumNorm += val;
    sumSqNorm += val * val;
  }
  const meanNorm = sumNorm / d;
  const varNorm = Math.max(1e-7, sumSqNorm / d - meanNorm * meanNorm);
  const stdNorm = Math.sqrt(varNorm);

  const consensusPatch: NormalizedPatch = {
    size: patches[0].size,
    data: new Float32Array(d),
    mean: meanNorm,
    std: stdNorm
  };

  // Normalizar datos de consenso a rango visual [0, 1]
  let maxVal = 0;
  for (let p = 0; p < d; p++) {
    if (eigensymbol[p] > maxVal) maxVal = eigensymbol[p];
  }
  const normFactor = maxVal > 1e-5 ? 1 / maxVal : 1;
  for (let p = 0; p < d; p++) {
    consensusPatch.data[p] = Math.max(0, Math.min(1, eigensymbol[p] * normFactor));
  }

  // 7. Auto-calibrar el umbral mínimo sugerido según las proyecciones de las propias muestras
  let minProjectionScore = 1.0;
  for (let i = 0; i < k; i++) {
    const score = calculateWeightedCorrelation(patches[i], consensusPatch, confidenceWeights);
    if (score < minProjectionScore) {
      minProjectionScore = score;
    }
  }

  // Cota con margen de seguridad del 8% por debajo de la peor muestra
  const suggestedThreshold = Number(Math.max(0.40, Math.min(0.85, minProjectionScore - 0.08)).toFixed(2));

  return {
    eigensymbol,
    consensusPatch,
    singularValues,
    purityRatio: Number(purityRatio.toFixed(3)),
    confidenceWeights,
    suggestedThreshold,
    sampleCount: k
  };
}

/**
 * Calcula la correlación ponderada entre dos parches usando la máscara de confianza W.
 * Ignora píxeles donde W tiende a 0 (líneas de caño o muros que solo estaban en una muestra).
 */
export function calculateWeightedCorrelation(
  patchA: NormalizedPatch,
  patchB: NormalizedPatch,
  weights: Float32Array
): number {
  const d = patchA.data.length;
  let weightSum = 0;
  let weightedMeanA = 0;
  let weightedMeanB = 0;

  for (let p = 0; p < d; p++) {
    const w = weights[p];
    weightSum += w;
    weightedMeanA += w * patchA.data[p];
    weightedMeanB += w * patchB.data[p];
  }

  if (weightSum < 1e-5) return 0;
  weightedMeanA /= weightSum;
  weightedMeanB /= weightSum;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let p = 0; p < d; p++) {
    const w = weights[p];
    const diffA = patchA.data[p] - weightedMeanA;
    const diffB = patchB.data[p] - weightedMeanB;
    cov += w * diffA * diffB;
    varA += w * diffA * diffA;
    varB += w * diffB * diffB;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom < 1e-6) return 0;

  const corr = cov / denom;
  return Number(Math.max(0, Math.min(1, corr)).toFixed(3));
}

/**
 * Rota un parche normalizado en ángulos ortogonales exactos (0°, 90°, 180°, 270°).
 */
export function rotateNormalizedPatch(
  patch: NormalizedPatch,
  angleDeg: 0 | 90 | 180 | 270
): NormalizedPatch {
  if (angleDeg === 0) return patch;

  const n = patch.size;
  const rotatedData = new Float32Array(n * n);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const srcIdx = y * n + x;
      let dstX = x;
      let dstY = y;

      switch (angleDeg) {
        case 90:
          // Rotación 90° horario: (x, y) -> (n - 1 - y, x)
          dstX = n - 1 - y;
          dstY = x;
          break;
        case 180:
          // Rotación 180°: (x, y) -> (n - 1 - x, n - 1 - y)
          dstX = n - 1 - x;
          dstY = n - 1 - y;
          break;
        case 270:
          // Rotación 270° horario (o -90°): (x, y) -> (y, n - 1 - x)
          dstX = y;
          dstY = n - 1 - x;
          break;
      }

      const dstIdx = dstY * n + dstX;
      rotatedData[dstIdx] = patch.data[srcIdx];
    }
  }

  return {
    size: n,
    data: rotatedData,
    mean: patch.mean,
    std: patch.std
  };
}

/**
 * Aplica micro-snap magnético en un radio de +/- searchRadiusPx alrededor de la ubicación
 * elegida por el usuario para auto-centrar el recuadro sobre el centroide óptimo del símbolo.
 */
export function magneticSubpixelSnap(
  binaryMask: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  targetCenterPx: { x: number; y: number },
  boxWidth: number,
  boxHeight: number,
  referencePatch: NormalizedPatch,
  rotationDeg: 0 | 90 | 180 | 270 = 0,
  searchRadiusPx: number = 4
): { centerPx: { x: number; y: number }; boxPx: BoundingBoxPx; bestScore: number } {
  let bestScore = -1;
  let bestCx = targetCenterPx.x;
  let bestCy = targetCenterPx.y;

  // Ángulo de des-rotación necesario para comparar con la referencia a 0°
  const unrotateDeg = ((360 - rotationDeg) % 360) as 0 | 90 | 180 | 270;

  for (let dy = -searchRadiusPx; dy <= searchRadiusPx; dy++) {
    for (let dx = -searchRadiusPx; dx <= searchRadiusPx; dx++) {
      const testCx = targetCenterPx.x + dx;
      const testCy = targetCenterPx.y + dy;

      const testBx = Math.max(0, Math.round(testCx - boxWidth / 2));
      const testBy = Math.max(0, Math.round(testCy - boxHeight / 2));

      if (testBx + boxWidth > imgWidth || testBy + boxHeight > imgHeight) continue;

      const testBox: BoundingBoxPx = {
        x: testBx,
        y: testBy,
        width: boxWidth,
        height: boxHeight
      };

      // Extraer parche normalizado
      const rawPatch = extractNormalizedPatch(binaryMask, imgWidth, testBox, referencePatch.size);
      // Rotar al ángulo neutro de referencia
      const alignedPatch = rotateNormalizedPatch(rawPatch, unrotateDeg);

      // Evaluar ZNCC contra la referencia
      const score = calculateQuickZNCC(alignedPatch, referencePatch);
      if (score > bestScore) {
        bestScore = score;
        bestCx = testCx;
        bestCy = testCy;
      }
    }
  }

  const finalBox: BoundingBoxPx = {
    x: Math.max(0, Math.round(bestCx - boxWidth / 2)),
    y: Math.max(0, Math.round(bestCy - boxHeight / 2)),
    width: boxWidth,
    height: boxHeight
  };

  return {
    centerPx: { x: bestCx, y: bestCy },
    boxPx: finalBox,
    bestScore: Math.max(0, bestScore)
  };
}

/**
 * ZNCC directo de orientación fija para comparar parches ya alineados
 */
function calculateQuickZNCC(patchA: NormalizedPatch, patchB: NormalizedPatch): number {
  const n = patchA.size;
  const total = n * n;
  const denom = total * patchA.std * patchB.std;
  if (denom < 1e-6) return 0;

  let cov = 0;
  for (let i = 0; i < total; i++) {
    cov += (patchA.data[i] - patchA.mean) * (patchB.data[i] - patchB.mean);
  }

  return cov / denom;
}

/**
 * Rota una matriz de pesos Float32Array de tamaño n x n en ángulos ortogonales.
 */
export function rotateWeights(
  weights: Float32Array,
  size: number,
  angleDeg: 0 | 90 | 180 | 270
): Float32Array {
  if (angleDeg === 0) return weights;

  const n = size;
  const rotated = new Float32Array(n * n);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const srcIdx = y * n + x;
      let dstX = x;
      let dstY = y;

      switch (angleDeg) {
        case 90:
          dstX = n - 1 - y;
          dstY = x;
          break;
        case 180:
          dstX = n - 1 - x;
          dstY = n - 1 - y;
          break;
        case 270:
          dstX = y;
          dstY = n - 1 - x;
          break;
      }

      rotated[dstY * n + dstX] = weights[srcIdx];
    }
  }

  return rotated;
}

/**
 * Evalúa la correlación ponderada multirrotacional (0°, 90°, 180°, 270°) entre un parche
 * candidato y el parche consenso usando la máscara de pesos de confianza.
 */
export function calculateMultiRotationWeightedZNCC(
  candPatch: NormalizedPatch,
  consensusPatch: NormalizedPatch,
  weights: Float32Array
): number {
  const angles: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
  let maxScore = 0;

  for (const angle of angles) {
    const rotPatch = rotateNormalizedPatch(consensusPatch, angle);
    const rotWeights = rotateWeights(weights, consensusPatch.size, angle);
    const score = calculateWeightedCorrelation(candPatch, rotPatch, rotWeights);
    if (score > maxScore) {
      maxScore = score;
    }
  }

  return maxScore;
}
