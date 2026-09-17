/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: usePatternDetectorViewModel.ts (Patrón Estricto MVVM)
 * Orquestador reactivo para detección semiautomática de símbolos por autovalores,
 * snap magnético centrado y emplazamiento masivo de bocas eléctricas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from './useProjectStore';
import {
  detectPatternMatchesWithExemplars,
  createPatternExemplar,
  calculateImageMoments,
  calculateEigenSignature,
  extractNormalizedPatch,
  PATTERN_DETECTOR_CONSTANTS,
  type BoundingBoxPx,
  type DetectedPatternMatch,
  type PatternExemplar
} from '../models/underlay/PatternDetector';
import {
  computeGramSvdConsensus,
  magneticSubpixelSnap,
  rotateNormalizedPatch,
  type SvdConsensusResult
} from '../models/underlay/GramSvd';
import { getUnderlayBinaryMask } from '../services/imageProcessingService';

export function usePatternDetectorViewModel() {
  const { project, addElectricalElement, setSelectedEntity } = useProjectStore();

  const activeLevelId = project.activeLevelId;
  const activeUnderlay = useMemo(() => {
    return project.underlaySheets?.[activeLevelId] || null;
  }, [project.underlaySheets, activeLevelId]);

  // Estados del flujo de detección y aprendizaje activo
  const [isSamplingPattern, setIsSamplingPattern] = useState(false);
  const [isAddingSample, setIsAddingSample] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [sampleBoxPx, setSampleBoxPx] = useState<BoundingBoxPx | null>(null);
  const [positiveExemplars, setPositiveExemplars] = useState<PatternExemplar[]>([]);
  const [negativeExemplars, setNegativeExemplars] = useState<PatternExemplar[]>([]);
  const [detectedMatches, setDetectedMatches] = useState<DetectedPatternMatch[]>([]);
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(
    PATTERN_DETECTOR_CONSTANTS.DEFAULT_SIMILARITY_THRESHOLD
  );
  const [dismissedMatchIds, setDismissedMatchIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stencilRotationDeg, setStencilRotationDeg] = useState<0 | 90 | 180 | 270>(0);

  /**
   * Coincidencias activas (excluyendo las descartadas por el usuario y filtradas por umbral)
   */
  const activeMatches = useMemo(() => {
    return detectedMatches.filter(
      (m) => !dismissedMatchIds.has(m.id) && m.similarityScore >= similarityThreshold
    );
  }, [detectedMatches, dismissedMatchIds, similarityThreshold]);

  /**
   * Dimensiones métricas del esténcil rígido en mundo (anchura y altura en metros)
   * calculadas a partir de la primera muestra y adaptadas según la rotación de 90°.
   */
  const stencilSizeWorld = useMemo(() => {
    if (positiveExemplars.length === 0 || !activeUnderlay) return null;
    const baseBox = positiveExemplars[0].boxPx;
    const scale = activeUnderlay.scaleMetersPerPx;
    const isRotated90 = stencilRotationDeg === 90 || stencilRotationDeg === 270;
    return {
      width: (isRotated90 ? baseBox.height : baseBox.width) * scale,
      height: (isRotated90 ? baseBox.width : baseBox.height) * scale
    };
  }, [positiveExemplars, activeUnderlay, stencilRotationDeg]);

  /**
   * Consenso espectral SVD acumulado a partir de 2 o más muestras positivas.
   */
  const svdConsensus = useMemo<SvdConsensusResult | null>(() => {
    if (positiveExemplars.length >= 2) {
      return computeGramSvdConsensus(positiveExemplars.map((e) => e.patch));
    }
    return null;
  }, [positiveExemplars]);

  /**
   * Conmuta la rotación del esténcil rígido en pasos de 90° (0° -> 90° -> 180° -> 270° -> 0°)
   */
  const cycleStencilRotation = useCallback(() => {
    setStencilRotationDeg((prev) => {
      if (prev === 0) return 90;
      if (prev === 90) return 180;
      if (prev === 180) return 270;
      return 0;
    });
  }, []);

  /**
   * Inicia el modo de muestreo rectangular (para primera muestra o muestras adicionales)
   */
  const startSamplingPattern = useCallback((isAdditional: boolean = false) => {
    if (!activeUnderlay) return;
    setIsSamplingPattern(true);
    setIsAddingSample(isAdditional);
    setErrorMessage(null);
  }, [activeUnderlay]);

  /**
   * Cancela el modo de muestreo
   */
  const cancelSamplingPattern = useCallback(() => {
    setIsSamplingPattern(false);
    setIsAddingSample(false);
    setErrorMessage(null);
  }, []);

  /**
   * Ejecuta la detección tras seleccionar un recuadro en coordenadas de mundo métricas
   */
  const executeDetectionFromWorldBox = useCallback(
    async (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      if (!activeUnderlay) return;

      const minWx = Math.min(p1.x, p2.x);
      const maxWx = Math.max(p1.x, p2.x);
      const minWy = Math.min(p1.y, p2.y);
      const maxWy = Math.max(p1.y, p2.y);

      const scale = activeUnderlay.scaleMetersPerPx;
      const originX = activeUnderlay.originWorldX;
      const originY = activeUnderlay.originWorldY;

      const boxPx: BoundingBoxPx = {
        x: Math.round((minWx - originX) / scale),
        y: Math.round((minWy - originY) / scale),
        width: Math.round((maxWx - minWx) / scale),
        height: Math.round((maxWy - minWy) / scale)
      };

      // Descartar selecciones accidentales minúsculas
      if (boxPx.width < 6 || boxPx.height < 6) {
        setIsSamplingPattern(false);
        setIsAddingSample(false);
        return;
      }

      setIsDetecting(true);
      setIsSamplingPattern(false);
      setSampleBoxPx(boxPx);
      setErrorMessage(null);

      try {
        const { width, height, mask } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        const newExemplar = createPatternExemplar(mask, width, boxPx, false);
        if (!newExemplar) {
          throw new Error('La región seleccionada no contiene suficiente tinta negra para extraer un símbolo.');
        }

        const nextPositives = isAddingSample ? [...positiveExemplars, newExemplar] : [newExemplar];
        const nextNegatives = isAddingSample ? negativeExemplars : [];

        setPositiveExemplars(nextPositives);
        if (!isAddingSample) {
          setNegativeExemplars([]);
          setDismissedMatchIds(new Set());
        } else {
          // Si este nuevo ejemplar estaba previamente en la lista de descartados, rehabilitarlo
          const newMatchId = `match-${Math.round(newExemplar.signature.centroid.x)}_${Math.round(newExemplar.signature.centroid.y)}`;
          setDismissedMatchIds((prev) => {
            if (!prev.has(newMatchId)) return prev;
            const next = new Set(prev);
            next.delete(newMatchId);
            return next;
          });
        }

        const matches = detectPatternMatchesWithExemplars(
          mask,
          width,
          height,
          nextPositives,
          nextNegatives,
          scale,
          { x: originX, y: originY },
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD
        );

        setDetectedMatches(matches);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al procesar el plano para detección de patrones.');
      } finally {
        setIsDetecting(false);
        setIsAddingSample(false);
      }
    },
    [activeUnderlay, isAddingSample, positiveExemplars, negativeExemplars]
  );

  /**
   * Estampa una nueva muestra positiva mediante el esténcil rígido asistido por
   * micro-snap magnético subpíxel y rotación cardinal exacta.
   */
  const executeStencilPlacement = useCallback(
    async (centerWorld: { x: number; y: number }) => {
      if (!activeUnderlay || positiveExemplars.length === 0) return;

      setIsDetecting(true);
      setIsSamplingPattern(false);
      setIsAddingSample(false);
      setErrorMessage(null);

      try {
        const scale = activeUnderlay.scaleMetersPerPx;
        const originX = activeUnderlay.originWorldX;
        const originY = activeUnderlay.originWorldY;

        const baseBox = positiveExemplars[0].boxPx;
        const isRotated90 = stencilRotationDeg === 90 || stencilRotationDeg === 270;
        const targetBoxWidth = isRotated90 ? baseBox.height : baseBox.width;
        const targetBoxHeight = isRotated90 ? baseBox.width : baseBox.height;

        const centerPx = {
          x: Math.round((centerWorld.x - originX) / scale),
          y: Math.round((centerWorld.y - originY) / scale)
        };

        const { width, height, mask } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        // 1. Auto-centrado milimétrico por micro-snap magnético
        const snapResult = magneticSubpixelSnap(
          mask,
          width,
          height,
          centerPx,
          targetBoxWidth,
          targetBoxHeight,
          positiveExemplars[0].patch,
          stencilRotationDeg,
          4
        );

        // 2. Extraer parche y rotar a la orientación de referencia neutra (0°)
        const rawPatch = extractNormalizedPatch(mask, width, snapResult.boxPx);
        const unrotateDeg = ((360 - stencilRotationDeg) % 360) as 0 | 90 | 180 | 270;
        const alignedPatch = rotateNormalizedPatch(rawPatch, unrotateDeg);

        // 3. Obtener firma espectral
        const moments = calculateImageMoments(mask, width, snapResult.boxPx);
        const signature =
          calculateEigenSignature(moments, snapResult.boxPx.width, snapResult.boxPx.height) ||
          positiveExemplars[0].signature;

        const newExemplar: PatternExemplar = {
          id: `ex-${Date.now()}-${Math.round(snapResult.boxPx.x)}_${Math.round(snapResult.boxPx.y)}`,
          boxPx: snapResult.boxPx,
          signature,
          patch: alignedPatch,
          isNegative: false
        };

        const nextPositives = [...positiveExemplars, newExemplar];
        setPositiveExemplars(nextPositives);

        // Si SVD sugiere un umbral ajustado, sincronizarlo
        const consensus = computeGramSvdConsensus(nextPositives.map((e) => e.patch));
        if (consensus?.suggestedThreshold) {
          setSimilarityThreshold(consensus.suggestedThreshold);
        }

        const matches = detectPatternMatchesWithExemplars(
          mask,
          width,
          height,
          nextPositives,
          negativeExemplars,
          scale,
          { x: originX, y: originY },
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD
        );

        setDetectedMatches(matches);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al procesar la nueva muestra con el esténcil.');
      } finally {
        setIsDetecting(false);
      }
    },
    [activeUnderlay, positiveExemplars, stencilRotationDeg, negativeExemplars]
  );

  /**
   * Limpia todas las coincidencias y ejemplares aprendidos
   */
  const clearMatches = useCallback(() => {
    setDetectedMatches([]);
    setSampleBoxPx(null);
    setPositiveExemplars([]);
    setNegativeExemplars([]);
    setDismissedMatchIds(new Set());
    setIsAddingSample(false);
    setStencilRotationDeg(0);
  }, []);

  /**
   * Descarta un falso positivo individual con un clic, aprendiendo del rechazo
   * como ejemplar negativo para penalizar y eliminar patrones similares en todo el plano.
   */
  const dismissMatch = useCallback(
    async (matchId: string) => {
      // 1. Quitar de inmediato de la vista reactiva
      setDismissedMatchIds((prev) => {
        const next = new Set(prev);
        next.add(matchId);
        return next;
      });

      // 2. Extraer ejemplar negativo y re-penalizar matches en segundo plano
      const targetMatch = detectedMatches.find((m) => m.id === matchId);
      if (!targetMatch || !activeUnderlay) return;

      // Si el match descartado coincide con la ubicación de un ejemplar positivo, removerlo de los positivos
      const nextPositives = positiveExemplars.filter(
        (pos) =>
          Math.hypot(
            pos.signature.centroid.x - targetMatch.centerPx.x,
            pos.signature.centroid.y - targetMatch.centerPx.y
          ) >= 5
      );

      if (nextPositives.length === 0 && positiveExemplars.length > 0) {
        clearMatches();
        return;
      }

      if (nextPositives.length !== positiveExemplars.length) {
        setPositiveExemplars(nextPositives);
      }

      try {
        const { width, height, mask } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        const negExemplar = createPatternExemplar(mask, width, targetMatch.boxPx, true);
        if (negExemplar) {
          const nextNegatives = [...negativeExemplars, negExemplar];
          setNegativeExemplars(nextNegatives);

          if (nextPositives.length > 0) {
            const updatedMatches = detectPatternMatchesWithExemplars(
              mask,
              width,
              height,
              nextPositives,
              nextNegatives,
              activeUnderlay.scaleMetersPerPx,
              { x: activeUnderlay.originWorldX, y: activeUnderlay.originWorldY },
              PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD
            );
            setDetectedMatches(updatedMatches);
          }
        }
      } catch (err) {
        console.error('Error al registrar ejemplar negativo:', err);
      }
    },
    [detectedMatches, activeUnderlay, negativeExemplars, positiveExemplars, clearMatches]
  );

  /**
   * Deshace / elimina la última muestra positiva agregada (útil si el usuario se equivocó)
   */
  const undoLastPositiveExemplar = useCallback(async () => {
    if (positiveExemplars.length <= 1) {
      clearMatches();
      return;
    }

    const nextPositives = positiveExemplars.slice(0, -1);
    setPositiveExemplars(nextPositives);

    if (activeUnderlay) {
      setIsDetecting(true);
      try {
        const { width, height, mask } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );
        const updatedMatches = detectPatternMatchesWithExemplars(
          mask,
          width,
          height,
          nextPositives,
          negativeExemplars,
          activeUnderlay.scaleMetersPerPx,
          { x: activeUnderlay.originWorldX, y: activeUnderlay.originWorldY },
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD
        );
        setDetectedMatches(updatedMatches);
      } catch (err) {
        console.error('Error al deshacer última muestra:', err);
      } finally {
        setIsDetecting(false);
      }
    }
  }, [positiveExemplars, negativeExemplars, activeUnderlay, clearMatches]);

  /**
   * Emplaza masivamente bocas eléctricas en todos los centros detectados
   */
  const convertMatchesToElectricalElements = useCallback(
    (symbolId: string, circuitId: string | null = null) => {
      if (activeMatches.length === 0) return 0;

      let count = 0;
      let lastId: string | null = null;

      for (const match of activeMatches) {
        const isCeiling = symbolId.includes('techo') || symbolId.includes('ventilador');
        const isWall = symbolId.includes('aplique') || symbolId.includes('toma') || symbolId.includes('enchufe') || symbolId.includes('llave');
        const newId = `el-auto-${Date.now()}-${count + 1}`;
        addElectricalElement({
          id: newId,
          levelId: activeLevelId,
          spaceId: project.spaces[0]?.id || 'espacio-principal',
          placement: isCeiling ? 'ceiling' : isWall ? 'wall' : 'floor',
          x: match.worldPos.x,
          y: match.worldPos.y,
          heightZ: isCeiling ? 2.60 : 1.20,
          rotation: match.orientationDeg,
          symbolId,
          circuitId,
          status: 'proyectado',
          label: '',
          attributes: []
        });
        lastId = newId;
        count++;
      }

      if (lastId) {
        setSelectedEntity({ type: 'electrical_element', id: lastId });
      }

      clearMatches();
      return count;
    },
    [activeMatches, activeLevelId, addElectricalElement, setSelectedEntity, clearMatches]
  );

  /**
   * Verifica si una coordenada de cursor se encuentra cerca del centroide de algún
   * símbolo detectado para aplicar atracción magnética (Snap centrado).
   */
  const getClosestSnapMatch = useCallback(
    (
      worldX: number,
      worldY: number,
      toleranceMeters: number = PATTERN_DETECTOR_CONSTANTS.SNAP_TOLERANCE_METERS
    ): DetectedPatternMatch | null => {
      if (activeMatches.length === 0) return null;

      let bestMatch: DetectedPatternMatch | null = null;
      let minDistance = toleranceMeters;

      for (const match of activeMatches) {
        const dist = Math.hypot(match.worldPos.x - worldX, match.worldPos.y - worldY);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = match;
        }
      }

      return bestMatch;
    },
    [activeMatches]
  );

  return {
    activeUnderlay,
    isSamplingPattern,
    isAddingSample,
    isDetecting,
    sampleBoxPx,
    positiveExemplars,
    negativeExemplars,
    detectedMatches,
    activeMatches,
    similarityThreshold,
    setSimilarityThreshold,
    errorMessage,
    startSamplingPattern,
    cancelSamplingPattern,
    executeDetectionFromWorldBox,
    dismissMatch,
    clearMatches,
    undoLastPositiveExemplar,
    convertMatchesToElectricalElements,
    getClosestSnapMatch,
    // Esténcil rígido y SVD
    stencilRotationDeg,
    setStencilRotationDeg,
    cycleStencilRotation,
    stencilSizeWorld,
    svdConsensus,
    executeStencilPlacement
  };
}
