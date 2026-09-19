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
  type PatternExemplar,
  type NormalizedPatch
} from '../models/underlay/PatternDetector';
import {
  computeGramSvdConsensus,
  findTemplateCorrelationSnap,
  type SvdConsensusResult
} from '../models/underlay/GramSvd';
import { alignPatchEccEuclidean } from '../models/underlay/EccAlignment';
import { extractDominantLabColor } from '../models/underlay/ColorLab';
import { getUnderlayBinaryMask, getCachedUnderlayBinaryMask } from '../services/imageProcessingService';

export interface PlacingTemplate {
  symbolId: string;
  patch: NormalizedPatch;
  boxSizePx: number;
  worldSizeM: number;
}

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

  // Modo de muestreo de patrones: 'auto' (1 clic con centrado por baricentro) o 'box' (recuadro manual con ajuste)
  const [samplingMode, setSamplingMode] = useState<'auto' | 'box'>('auto');

  // Control global de Snap Magnético (ON / OFF)
  const [isSnapEnabled, setIsSnapEnabled] = useState<boolean>(true);

  // Plantilla de muestreo asistido al insertar el primer símbolo (Smart Assisted Placement)
  const [activePlacingTemplate, setActivePlacingTemplate] = useState<PlacingTemplate | null>(null);

  // Estados para la fase de encuadre/ajuste interactivo fino de la Muestra #1
  const [isAdjustingSampleBox, setIsAdjustingSampleBox] = useState(false);
  const [provisionalSquareBox, setProvisionalSquareBox] = useState<{ x: number; y: number; size: number } | null>(null);

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
   * calculadas a partir de la primera muestra en caja cuadrada canónica.
   */
  const stencilSizeWorld = useMemo(() => {
    if (positiveExemplars.length === 0 || !activeUnderlay) return null;
    const baseBox = positiveExemplars[0].boxPx;
    const scale = activeUnderlay.scaleMetersPerPx;
    const sizeMeters = Math.max(baseBox.width, baseBox.height) * scale;
    return {
      width: sizeMeters,
      height: sizeMeters
    };
  }, [positiveExemplars, activeUnderlay]);

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
    setIsAdjustingSampleBox(false);
    setProvisionalSquareBox(null);
    setErrorMessage(null);
  }, [activeUnderlay]);

  /**
   * Cancela el modo de muestreo o la fase de ajuste
   */
  const cancelSamplingPattern = useCallback(() => {
    setIsSamplingPattern(false);
    setIsAddingSample(false);
    setIsAdjustingSampleBox(false);
    setProvisionalSquareBox(null);
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
        const { width, height, mask, rgbaData } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        const newExemplar = createPatternExemplar(mask, width, boxPx, false, height, rgbaData);

        if (!newExemplar) {
          throw new Error('La región seleccionada no contiene suficiente trazo de tinta o color para extraer un símbolo.');
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
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD,
          rgbaData
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
   * Ejecuta el auto-muestreo inteligente de un símbolo con 1 solo clic en el plano (Modo Auto).
   * Auto-centra el recuadro sobre el baricentro de tinta/color de la región y extrae
   * la muestra positiva ejecutando la búsqueda de patrones de inmediato.
   */
  const executeAutoSampleAtPoint = useCallback(
    async (worldPos: { x: number; y: number }, sampleSizeM: number = 0.45) => {
      if (!activeUnderlay) return;

      setIsDetecting(true);
      setIsSamplingPattern(false);
      setErrorMessage(null);

      try {
        const { width, height, mask, rgbaData } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );
        const scale = activeUnderlay.scaleMetersPerPx;
        const originX = activeUnderlay.originWorldX;
        const originY = activeUnderlay.originWorldY;

        // Si ya hay muestras previas, preservar exactamente el tamaño del primer ejemplar
        const sizeMeters = positiveExemplars.length > 0 && stencilSizeWorld
          ? stencilSizeWorld.width
          : sampleSizeM;
        const boxSizePx = Math.max(16, Math.min(96, Math.round(sizeMeters / scale)));

        const centerPx = {
          x: Math.round((worldPos.x - originX) / scale),
          y: Math.round((worldPos.y - originY) / scale)
        };

        const roughBox: BoundingBoxPx = {
          x: Math.max(0, Math.round(centerPx.x - boxSizePx / 2)),
          y: Math.max(0, Math.round(centerPx.y - boxSizePx / 2)),
          width: boxSizePx,
          height: boxSizePx
        };

        // Auto-centrado por baricentro de momentos de tinta/color
        const moments = calculateImageMoments(mask, width, roughBox);
        let finalBox = roughBox;
        if (moments && moments.m00 >= 4) {
          const cx = Math.round(moments.m10 / moments.m00);
          const cy = Math.round(moments.m01 / moments.m00);
          finalBox = {
            x: Math.max(0, Math.round(cx - boxSizePx / 2)),
            y: Math.max(0, Math.round(cy - boxSizePx / 2)),
            width: boxSizePx,
            height: boxSizePx
          };
        }

        const newExemplar = createPatternExemplar(mask, width, finalBox, false, height, rgbaData);

        if (!newExemplar) {
          throw new Error('No se detectó suficiente trazo o símbolo en el punto clickeado. Intentá hacer clic más cerca del centro del símbolo.');
        }

        const nextPositives = isAddingSample ? [...positiveExemplars, newExemplar] : [newExemplar];
        const nextNegatives = isAddingSample ? negativeExemplars : [];

        setPositiveExemplars(nextPositives);
        setSampleBoxPx(newExemplar.boxPx);

        if (!isAddingSample) {
          setNegativeExemplars([]);
          setDismissedMatchIds(new Set());
        } else {
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
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD,
          rgbaData
        );

        setDetectedMatches(matches);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al auto-muestrear el símbolo.');
      } finally {
        setIsDetecting(false);
        setIsAddingSample(false);
      }
    },
    [activeUnderlay, isAddingSample, positiveExemplars, negativeExemplars, stencilSizeWorld]
  );

  /**
   * Maneja la finalización del trazado de recuadro en el lienzo.
   * Si es la Muestra #1, abre la fase interactiva de ajuste fino con caja cuadrada canónica.
   */
  const handleSampleBoxDrawn = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      const minWx = Math.min(p1.x, p2.x);
      const maxWx = Math.max(p1.x, p2.x);
      const minWy = Math.min(p1.y, p2.y);
      const maxWy = Math.max(p1.y, p2.y);
      const w = maxWx - minWx;
      const h = maxWy - minWy;

      if (w < 0.05 || h < 0.05) return;

      const size = Math.max(w, h);
      const cx = (minWx + maxWx) / 2;
      const cy = (minWy + maxWy) / 2;

      // Para la Muestra #1, entrar en fase de encuadre y ajuste interactivo fino
      if (positiveExemplars.length === 0) {
        setProvisionalSquareBox({
          x: Number((cx - size / 2).toFixed(3)),
          y: Number((cy - size / 2).toFixed(3)),
          size: Number(size.toFixed(3))
        });
        setIsAdjustingSampleBox(true);
        return;
      }

      // Muestras adicionales (si no se usó el esténcil)
      executeDetectionFromWorldBox(p1, p2);
    },
    [positiveExemplars.length, executeDetectionFromWorldBox]
  );

  /**
   * Confirma la muestra provisional ajustada interactivamente por el usuario
   */
  const confirmProvisionalSampleBox = useCallback(() => {
    if (!provisionalSquareBox) return;
    const p1 = { x: provisionalSquareBox.x, y: provisionalSquareBox.y };
    const p2 = {
      x: provisionalSquareBox.x + provisionalSquareBox.size,
      y: provisionalSquareBox.y + provisionalSquareBox.size
    };
    setIsAdjustingSampleBox(false);
    setProvisionalSquareBox(null);
    executeDetectionFromWorldBox(p1, p2);
  }, [provisionalSquareBox, executeDetectionFromWorldBox]);

  /**
   * Cancela el ajuste de la muestra provisional y permite redibujar libremente
   */
  const cancelProvisionalSampleBox = useCallback(() => {
    setIsAdjustingSampleBox(false);
    setProvisionalSquareBox(null);
  }, []);

  /**
   * Estampa una nueva muestra positiva mediante el esténcil rígido asistido por
   * acople de forma visual (Shape-Aware Snap) y rotación cardinal exacta.
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
        const targetBoxSize = Math.max(baseBox.width, baseBox.height);

        const centerPx = {
          x: Math.round((centerWorld.x - originX) / scale),
          y: Math.round((centerWorld.y - originY) / scale)
        };

        const { width, height, mask, rgbaData } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        // 1. Auto-centrado magnético inteligente guiado por la plantilla visual del símbolo (Shape-Aware Snap)
        const templateSnap = findTemplateCorrelationSnap(
          mask,
          width,
          height,
          centerPx,
          { width: targetBoxSize, height: targetBoxSize },
          positiveExemplars[0].patch,
          stencilRotationDeg,
          Math.max(16, Math.round(PATTERN_DETECTOR_CONSTANTS.SNAP_TOLERANCE_METERS / scale)),
          0.40
        );
        const coarseCenter = templateSnap.isSnapped ? templateSnap.snappedCenterPx : centerPx;

        // 2. Alineación fina continua euclídea por ECC (SE(2)) e interpolación bilineal
        const initialAngleRad = (stencilRotationDeg * Math.PI) / 180;
        const eccResult = alignPatchEccEuclidean(
          mask,
          width,
          height,
          coarseCenter,
          { width: targetBoxSize, height: targetBoxSize },
          positiveExemplars[0].patch,
          initialAngleRad,
          { rgbaData }
        );

        const refinedBox: BoundingBoxPx = {
          x: Math.round(eccResult.refinedCenterPx.x - targetBoxSize / 2),
          y: Math.round(eccResult.refinedCenterPx.y - targetBoxSize / 2),
          width: targetBoxSize,
          height: targetBoxSize
        };

        // 3. Obtener firma espectral sobre el recuadro refinado
        const moments = calculateImageMoments(mask, width, refinedBox);
        const signature =
          calculateEigenSignature(moments, refinedBox.width, refinedBox.height) ||
          positiveExemplars[0].signature;

        const dominantLab = rgbaData
          ? extractDominantLabColor(rgbaData, width, refinedBox, mask)
          : undefined;

        const newExemplar: PatternExemplar = {
          id: `ex-${Date.now()}-${Math.round(eccResult.refinedCenterPx.x)}_${Math.round(eccResult.refinedCenterPx.y)}`,
          boxPx: refinedBox,
          signature,
          patch: eccResult.alignedPatch,
          dominantLab: dominantLab || positiveExemplars[0].dominantLab,
          isNegative: false
        };

        const nextPositives = [...positiveExemplars, newExemplar];
        setPositiveExemplars(nextPositives);

        const matches = detectPatternMatchesWithExemplars(
          mask,
          width,
          height,
          nextPositives,
          negativeExemplars,
          scale,
          { x: originX, y: originY },
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD,
          rgbaData
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
    setActivePlacingTemplate(null);
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
        const { width, height, mask, rgbaData } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        const negExemplar = createPatternExemplar(mask, width, targetMatch.boxPx, true, height, rgbaData);
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
              PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD,
              rgbaData
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
        const { width, height, mask, rgbaData } = await getUnderlayBinaryMask(
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
          PATTERN_DETECTOR_CONSTANTS.CANDIDATE_SEARCH_THRESHOLD,
          rgbaData
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
    [activeMatches, activeLevelId, addElectricalElement, setSelectedEntity, clearMatches, project.spaces]
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
      const candidates = detectedMatches.length > 0 ? detectedMatches : activeMatches;
      if (candidates.length === 0) return null;

      let bestMatch: DetectedPatternMatch | null = null;
      let minDistance = toleranceMeters;

      for (const match of candidates) {
        const dist = Math.hypot(match.worldPos.x - worldX, match.worldPos.y - worldY);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = match;
        }
      }

      return bestMatch;
    },
    [detectedMatches, activeMatches]
  );

  /**
   * Alterna el estado del snap magnético (ON / OFF)
   */
  const toggleSnap = useCallback(() => {
    setIsSnapEnabled((prev) => !prev);
  }, []);

  /**
   * Resetea la plantilla de emplazamiento asistido
   */
  const resetPlacingTemplate = useCallback(() => {
    setActivePlacingTemplate(null);
  }, []);

  /**
   * Captura automáticamente una plantilla normalizada cuadrada alrededor del primer
   * punto de emplazamiento de una boca eléctrica (Smart Assisted Placement).
   */
  const capturePlacingTemplate = useCallback(
    async (symbolId: string, worldPos: { x: number; y: number }, sampleSizeM: number = 0.45) => {
      if (!activeUnderlay) return;
      try {
        const { width, mask, rgbaData } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );
        const scale = activeUnderlay.scaleMetersPerPx;
        const originX = activeUnderlay.originWorldX;
        const originY = activeUnderlay.originWorldY;

        const sizeMeters = stencilSizeWorld?.width || sampleSizeM;
        const boxSizePx = Math.max(16, Math.min(64, Math.round(sizeMeters / scale)));

        const centerPx = {
          x: Math.round((worldPos.x - originX) / scale),
          y: Math.round((worldPos.y - originY) / scale)
        };

        const roughBox: BoundingBoxPx = {
          x: Math.max(0, Math.round(centerPx.x - boxSizePx / 2)),
          y: Math.max(0, Math.round(centerPx.y - boxSizePx / 2)),
          width: boxSizePx,
          height: boxSizePx
        };

        const moments = calculateImageMoments(mask, width, roughBox);
        let finalBox = roughBox;
        if (moments && moments.m00 >= 4) {
          const cx = Math.round(moments.m10 / moments.m00);
          const cy = Math.round(moments.m01 / moments.m00);
          finalBox = {
            x: Math.max(0, Math.round(cx - boxSizePx / 2)),
            y: Math.max(0, Math.round(cy - boxSizePx / 2)),
            width: boxSizePx,
            height: boxSizePx
          };
        }

        const patch = extractNormalizedPatch(mask, width, finalBox, PATTERN_DETECTOR_CONSTANTS.PATCH_SIZE, rgbaData);
        setActivePlacingTemplate({
          symbolId,
          patch,
          boxSizePx,
          worldSizeM: sizeMeters
        });
      } catch (err) {
        console.warn('No se pudo auto-muestrear plantilla de inserción asistida:', err);
      }
    },
    [activeUnderlay, stencilSizeWorld]
  );

  /**
   * Calcula el acople magnético asistido en tiempo real guiado por la plantilla
   * del primer símbolo emplazado (con soporte multi-rotación a 0°, 90°, 180°, 270°).
   */
  const getPlacingSnapPoint = useCallback(
    (
      worldPos: { x: number; y: number },
      symbolId?: string,
      isShiftBypassed: boolean = false
    ): {
      snappedPos: { x: number; y: number };
      isSnapped: boolean;
      rotationDeg: 0 | 90 | 180 | 270;
      score: number;
    } => {
      if (!isSnapEnabled || isShiftBypassed || !activePlacingTemplate || !activeUnderlay) {
        return { snappedPos: worldPos, isSnapped: false, rotationDeg: 0, score: 0 };
      }

      if (symbolId && symbolId !== activePlacingTemplate.symbolId) {
        return { snappedPos: worldPos, isSnapped: false, rotationDeg: 0, score: 0 };
      }

      const cached = getCachedUnderlayBinaryMask(activeUnderlay.id);
      if (!cached) {
        return { snappedPos: worldPos, isSnapped: false, rotationDeg: 0, score: 0 };
      }

      const scale = activeUnderlay.scaleMetersPerPx;
      const originX = activeUnderlay.originWorldX;
      const originY = activeUnderlay.originWorldY;

      const centerPx = {
        x: Math.round((worldPos.x - originX) / scale),
        y: Math.round((worldPos.y - originY) / scale)
      };

      const boxSizePx = activePlacingTemplate.boxSizePx;
      const searchRadiusPx = Math.max(12, Math.min(32, Math.round(PATTERN_DETECTOR_CONSTANTS.SNAP_TOLERANCE_METERS / scale)));

      const snap = findTemplateCorrelationSnap(
        cached.mask,
        cached.width,
        cached.height,
        centerPx,
        { width: boxSizePx, height: boxSizePx },
        activePlacingTemplate.patch,
        0,
        searchRadiusPx,
        0.45,
        true
      );

      if (snap.isSnapped) {
        return {
          snappedPos: {
            x: Number((originX + snap.snappedCenterPx.x * scale).toFixed(3)),
            y: Number((originY + snap.snappedCenterPx.y * scale).toFixed(3))
          },
          isSnapped: true,
          rotationDeg: snap.snappedRotationDeg,
          score: snap.score
        };
      }

      return { snappedPos: worldPos, isSnapped: false, rotationDeg: 0, score: snap.score };
    },
    [isSnapEnabled, activePlacingTemplate, activeUnderlay]
  );

  /**
   * Calcula el punto de acople magnético para el esténcil rígido en tiempo real.
   * Prioridad 1: Candidatos detectados cercanos.
   * Prioridad 2: Centroide de masa de tinta negra de la lámina en memoria caché.
   */
  const getStencilSnapPoint = useCallback(
    (
      worldPos: { x: number; y: number },
      toleranceMeters: number = PATTERN_DETECTOR_CONSTANTS.SNAP_TOLERANCE_METERS
    ): { snappedPos: { x: number; y: number }; isSnapped: boolean } => {
      if (!isSnapEnabled) {
        return { snappedPos: worldPos, isSnapped: false };
      }

      // 1. Primero intentar snap a cualquier candidato detectado
      const match = getClosestSnapMatch(worldPos.x, worldPos.y, toleranceMeters);
      if (match) {
        return { snappedPos: match.worldPos, isSnapped: true };
      }

      // 2. Si no hay match previo pero hay máscara binaria en caché, snap guiado por forma visual del símbolo
      if (activeUnderlay && positiveExemplars.length > 0) {
        const cached = getCachedUnderlayBinaryMask(activeUnderlay.id);
        if (cached) {
          const scale = activeUnderlay.scaleMetersPerPx;
          const originX = activeUnderlay.originWorldX;
          const originY = activeUnderlay.originWorldY;
          const centerPx = {
            x: Math.round((worldPos.x - originX) / scale),
            y: Math.round((worldPos.y - originY) / scale)
          };
          const baseBox = positiveExemplars[0].boxPx;
          const targetBoxSize = Math.max(baseBox.width, baseBox.height);

          const snap = findTemplateCorrelationSnap(
            cached.mask,
            cached.width,
            cached.height,
            centerPx,
            { width: targetBoxSize, height: targetBoxSize },
            positiveExemplars[0].patch,
            stencilRotationDeg,
            Math.max(16, Math.round(toleranceMeters / scale)),
            0.45
          );

          if (snap.isSnapped) {
            return {
              snappedPos: {
                x: Number((originX + snap.snappedCenterPx.x * scale).toFixed(3)),
                y: Number((originY + snap.snappedCenterPx.y * scale).toFixed(3))
              },
              isSnapped: true
            };
          }
        }
      }

      return { snappedPos: worldPos, isSnapped: false };
    },
    [isSnapEnabled, getClosestSnapMatch, activeUnderlay, positiveExemplars, stencilRotationDeg]
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
    handleSampleBoxDrawn,
    executeDetectionFromWorldBox,
    // Ajuste interactivo fino de la Muestra #1
    isAdjustingSampleBox,
    provisionalSquareBox,
    setProvisionalSquareBox,
    confirmProvisionalSampleBox,
    cancelProvisionalSampleBox,
    dismissMatch,
    clearMatches,
    undoLastPositiveExemplar,
    convertMatchesToElectricalElements,
    getClosestSnapMatch,
    getStencilSnapPoint,
    // Esténcil rígido y SVD
    stencilRotationDeg,
    setStencilRotationDeg,
    cycleStencilRotation,
    stencilSizeWorld,
    svdConsensus,
    executeStencilPlacement,
    // Control de Snap y Muestreo Asistido
    isSnapEnabled,
    setIsSnapEnabled,
    toggleSnap,
    activePlacingTemplate,
    capturePlacingTemplate,
    resetPlacingTemplate,
    getPlacingSnapPoint,
    // Modo de muestreo (Auto vs Recuadro)
    samplingMode,
    setSamplingMode,
    executeAutoSampleAtPoint
  };
}
