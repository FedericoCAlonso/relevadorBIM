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
  detectPatternMatches,
  PATTERN_DETECTOR_CONSTANTS,
  type BoundingBoxPx,
  type DetectedPatternMatch
} from '../models/underlay/PatternDetector';
import { getUnderlayBinaryMask } from '../services/imageProcessingService';

export function usePatternDetectorViewModel() {
  const { project, addElectricalElement, setSelectedEntity } = useProjectStore();

  const activeLevelId = project.activeLevelId;
  const activeUnderlay = useMemo(() => {
    return project.underlaySheets?.[activeLevelId] || null;
  }, [project.underlaySheets, activeLevelId]);

  // Estados del flujo de detección
  const [isSamplingPattern, setIsSamplingPattern] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [sampleBoxPx, setSampleBoxPx] = useState<BoundingBoxPx | null>(null);
  const [detectedMatches, setDetectedMatches] = useState<DetectedPatternMatch[]>([]);
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(
    PATTERN_DETECTOR_CONSTANTS.DEFAULT_SIMILARITY_THRESHOLD
  );
  const [dismissedMatchIds, setDismissedMatchIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Coincidencias activas (excluyendo las descartadas por el usuario)
   */
  const activeMatches = useMemo(() => {
    return detectedMatches.filter((m) => !dismissedMatchIds.has(m.id) && m.similarityScore >= similarityThreshold);
  }, [detectedMatches, dismissedMatchIds, similarityThreshold]);

  /**
   * Inicia el modo de muestreo rectangular
   */
  const startSamplingPattern = useCallback(() => {
    if (!activeUnderlay) return;
    setIsSamplingPattern(true);
    setErrorMessage(null);
  }, [activeUnderlay]);

  /**
   * Cancela el modo de muestreo
   */
  const cancelSamplingPattern = useCallback(() => {
    setIsSamplingPattern(false);
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
        return;
      }

      setIsDetecting(true);
      setIsSamplingPattern(false);
      setSampleBoxPx(boxPx);
      setDismissedMatchIds(new Set());
      setErrorMessage(null);

      try {
        const { width, height, mask } = await getUnderlayBinaryMask(
          activeUnderlay.id,
          activeUnderlay.imageUrl
        );

        const matches = detectPatternMatches(
          mask,
          width,
          height,
          boxPx,
          scale,
          { x: originX, y: originY },
          0.60 // Umbral base para almacenar candidatos
        );

        setDetectedMatches(matches);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al procesar el plano para detección de patrones.');
      } finally {
        setIsDetecting(false);
      }
    },
    [activeUnderlay]
  );

  /**
   * Descarta un falso positivo individual con un clic
   */
  const dismissMatch = useCallback((matchId: string) => {
    setDismissedMatchIds((prev) => {
      const next = new Set(prev);
      next.add(matchId);
      return next;
    });
  }, []);

  /**
   * Limpia todas las coincidencias encontradas
   */
  const clearMatches = useCallback(() => {
    setDetectedMatches([]);
    setSampleBoxPx(null);
    setDismissedMatchIds(new Set());
  }, []);

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
    isDetecting,
    sampleBoxPx,
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
    convertMatchesToElectricalElements,
    getClosestSnapMatch
  };
}
