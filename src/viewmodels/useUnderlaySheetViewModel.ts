/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useUnderlaySheetViewModel.ts (Patrón Estricto MVVM)
 * Orquestación del estado reactivo para láminas de fondo y calibración métrica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from './useProjectStore';
import { createUnderlaySheetFromFile } from '../services/underlaySheetService';
import {
  calculateUnderlayScale,
  UNDERLAY_CONSTANTS,
  type UnderlaySheet
} from '../models/underlay/UnderlaySheet';

export function useUnderlaySheetViewModel() {
  const { project, setUnderlaySheet, updateUnderlaySheet, removeUnderlaySheet } = useProjectStore();

  const activeLevelId = project.activeLevelId;
  const activeUnderlay = useMemo<UnderlaySheet | null>(() => {
    return project.underlaySheets?.[activeLevelId] || null;
  }, [project.underlaySheets, activeLevelId]);

  // Estados del flujo de calibración
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationP1, setCalibrationP1] = useState<{ x: number; y: number } | null>(null);
  const [calibrationP2, setCalibrationP2] = useState<{ x: number; y: number } | null>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Carga una imagen o PDF como lámina de fondo del nivel activo
   */
  const handleLoadFile = useCallback(
    async (file: File) => {
      try {
        setIsLoadingFile(true);
        setErrorMessage(null);
        const sheet = await createUnderlaySheetFromFile(file, activeLevelId);
        setUnderlaySheet(activeLevelId, sheet);
        // Iniciar inmediatamente la calibración para que el plano quede en escala real
        setIsCalibrating(true);
        setCalibrationP1(null);
        setCalibrationP2(null);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al procesar el archivo del plano.');
      } finally {
        setIsLoadingFile(false);
      }
    },
    [activeLevelId, setUnderlaySheet]
  );

  /**
   * Inicia el modo de calibración en 2 clics
   */
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    setCalibrationP1(null);
    setCalibrationP2(null);
    setShowCalibrationModal(false);
  }, []);

  /**
   * Cancela el modo de calibración
   */
  const cancelCalibration = useCallback(() => {
    setIsCalibrating(false);
    setCalibrationP1(null);
    setCalibrationP2(null);
    setShowCalibrationModal(false);
  }, []);

  /**
   * Procesa los clics en el lienzo durante el modo de calibración
   */
  const handleCalibrationCanvasClick = useCallback(
    (worldX: number, worldY: number) => {
      if (!isCalibrating) return;

      if (!calibrationP1) {
        setCalibrationP1({ x: worldX, y: worldY });
      } else {
        setCalibrationP2({ x: worldX, y: worldY });
        setShowCalibrationModal(true);
      }
    },
    [isCalibrating, calibrationP1]
  );

  /**
   * Distancia preliminar calculada entre los dos puntos marcados
   */
  const measuredDistanceWorldM = useMemo(() => {
    if (!calibrationP1 || !calibrationP2) return 3.50;
    const dx = calibrationP2.x - calibrationP1.x;
    const dy = calibrationP2.y - calibrationP1.y;
    return Number(Math.hypot(dx, dy).toFixed(2));
  }, [calibrationP1, calibrationP2]);

  /**
   * Confirma la distancia real ingresada y actualiza la escala de la lámina
   */
  const confirmCalibration = useCallback(
    (realDistanceM: number) => {
      if (!activeUnderlay || !calibrationP1 || !calibrationP2) return;

      try {
        const newScale = calculateUnderlayScale(
          calibrationP1,
          calibrationP2,
          realDistanceM,
          activeUnderlay.scaleMetersPerPx
        );

        updateUnderlaySheet(activeLevelId, {
          scaleMetersPerPx: newScale,
          isCalibrated: true
        });

        setIsCalibrating(false);
        setCalibrationP1(null);
        setCalibrationP2(null);
        setShowCalibrationModal(false);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al calibrar la escala.');
      }
    },
    [activeUnderlay, activeLevelId, calibrationP1, calibrationP2, updateUnderlaySheet]
  );

  /**
   * Alterna la visibilidad del plano de fondo
   */
  const toggleVisibility = useCallback(() => {
    if (!activeUnderlay) return;
    updateUnderlaySheet(activeLevelId, { visible: !activeUnderlay.visible });
  }, [activeUnderlay, activeLevelId, updateUnderlaySheet]);

  /**
   * Cicla la opacidad entre los valores predefinidos (30%, 65%, 95%)
   */
  const cycleOpacity = useCallback(() => {
    if (!activeUnderlay) return;
    const presets = UNDERLAY_CONSTANTS.OPACITY_PRESETS;
    const currentIndex = presets.findIndex((p) => Math.abs(p - activeUnderlay.opacity) < 0.1);
    const nextIndex = (currentIndex + 1) % presets.length;
    updateUnderlaySheet(activeLevelId, { opacity: presets[nextIndex] });
  }, [activeUnderlay, activeLevelId, updateUnderlaySheet]);

  /**
   * Elimina la lámina de fondo del nivel activo
   */
  const removeSheet = useCallback(() => {
    removeUnderlaySheet(activeLevelId);
    cancelCalibration();
  }, [activeLevelId, removeUnderlaySheet, cancelCalibration]);

  return {
    activeUnderlay,
    isCalibrating,
    calibrationP1,
    calibrationP2,
    showCalibrationModal,
    measuredDistanceWorldM,
    isLoadingFile,
    errorMessage,
    setErrorMessage,
    handleLoadFile,
    startCalibration,
    cancelCalibration,
    handleCalibrationCanvasClick,
    confirmCalibration,
    toggleVisibility,
    cycleOpacity,
    removeSheet
  };
}
