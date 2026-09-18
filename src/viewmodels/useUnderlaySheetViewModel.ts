/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useUnderlaySheetViewModel.ts (Patrón Estricto MVVM)
 * Orquestación del estado reactivo para láminas de fondo y calibración métrica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from './useProjectStore';
import {
  createUnderlaySheetFromFile,
  transformUnderlayImage
} from '../services/underlaySheetService';
import { clearUnderlayMaskCache } from '../services/imageProcessingService';
import {
  calculateUnderlayScale,
  calculateCroppedOrigin,
  calculateRotatedOrigin,
  UNDERLAY_CONSTANTS,
  type UnderlaySheet,
  type CropBoxPx,
  type UnderlayRotationAngle
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

  // Estados del flujo de ajuste (rotación y recorte)
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);

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
    setShowAdjustModal(false);
  }, [activeLevelId, removeUnderlaySheet, cancelCalibration]);

  /**
   * Abre el modal interactivo de rotación y recorte
   */
  const openAdjustModal = useCallback(() => {
    setShowAdjustModal(true);
  }, []);

  /**
   * Cierra el modal de rotación y recorte
   */
  const closeAdjustModal = useCallback(() => {
    setShowAdjustModal(false);
  }, []);

  /**
   * Aplica rotación (90°, 180°, 270°) y/o recorte a la lámina de fondo,
   * preservando la alineación métrica de los elementos ya relevados.
   */
  const applyAdjustments = useCallback(
    async (rotationDeg: UnderlayRotationAngle = 0, cropBox?: CropBoxPx) => {
      if (!activeUnderlay) return;

      try {
        setIsTransforming(true);
        setErrorMessage(null);

        const transformed = await transformUnderlayImage(
          activeUnderlay.imageUrl,
          rotationDeg,
          cropBox
        );

        let originX = activeUnderlay.originWorldX;
        let originY = activeUnderlay.originWorldY;

        // 1. Si hubo rotación, calcular nuevo origen conservando el centro geométrico
        if (rotationDeg !== 0) {
          const rotOrigin = calculateRotatedOrigin(
            { x: originX, y: originY },
            activeUnderlay.widthPx,
            activeUnderlay.heightPx,
            rotationDeg,
            activeUnderlay.scaleMetersPerPx
          );
          originX = rotOrigin.x;
          originY = rotOrigin.y;
        }

        // 2. Si hubo recorte, desplazar el origen relativo a las coordenadas de corte
        if (cropBox && cropBox.width > 0 && cropBox.height > 0) {
          const cropOrigin = calculateCroppedOrigin(
            { x: originX, y: originY },
            cropBox,
            activeUnderlay.scaleMetersPerPx
          );
          originX = cropOrigin.x;
          originY = cropOrigin.y;
        }

        // Limpiar caché de máscaras binarias del analizador de patrones
        clearUnderlayMaskCache(activeUnderlay.id);

        updateUnderlaySheet(activeLevelId, {
          imageUrl: transformed.dataUrl,
          widthPx: transformed.widthPx,
          heightPx: transformed.heightPx,
          originWorldX: originX,
          originWorldY: originY
        });

        setShowAdjustModal(false);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al aplicar rotación o recorte al plano.');
      } finally {
        setIsTransforming(false);
      }
    },
    [activeUnderlay, activeLevelId, updateUnderlaySheet]
  );

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
    removeSheet,
    showAdjustModal,
    isTransforming,
    openAdjustModal,
    closeAdjustModal,
    applyAdjustments
  };
}
