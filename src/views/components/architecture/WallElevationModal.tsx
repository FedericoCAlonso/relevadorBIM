/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: WallElevationModal.tsx (Patrón Estricto MVVM)
 * Modal / Visor de Alzado y Corte Longitudinal de Muro (Wall Elevation 2D).
 * Orquestador principal que compone:
 * - Cabecera y herramientas rápidas (ElevationTopBar)
 * - Lienzo CAD 2D interactivo a escala 1:1 (ElevationCanvas)
 * - Barra ergonómica inferior táctil para celular (ElevationMobileDrawer)
 * - Panel lateral de inspección métrica en escritorio (ElevationInspectorSidebar)
 * - Modales de interconexión exterior y cables (ElevationExternalTargetModal, ConduitModal)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useEffect, useState } from 'react';
import { useWallElevationViewModel } from '../../../viewmodels/useWallElevationViewModel';
import { ConduitModal } from '../electrical/ConduitModal';
import { ElevationTopBar } from './elevation/ElevationTopBar';
import { ElevationCanvas } from './elevation/ElevationCanvas';
import { ElevationMobileDrawer } from './elevation/ElevationMobileDrawer';
import { ElevationInspectorSidebar } from './elevation/ElevationInspectorSidebar';
import { ElevationExternalTargetModal } from './elevation/ElevationExternalTargetModal';

export const WallElevationModal: React.FC = () => {
  const {
    isOpen,
    wall,
    face,
    faceOptions,
    elevation,
    displayBoxes,
    displayConduits,
    guideY,
    isDragging,
    isGripDragging,
    selection,
    selectedBox,
    selectedOpening,
    selectedConduit,
    selectedConduitMetric,
    routeGrips,
    conduitPresetOptions,
    heightPresets,
    viewBoxAttribute,
    close,
    setFace,
    selectBox,
    selectOpening,
    selectConduit,
    clearSelection,
    beginBoxDrag,
    moveBoxDrag,
    endBoxDrag,
    cancelBoxDrag,
    setConduitPreset,
    resetConduitRoute,
    beginRoutePointDrag,
    moveRoutePointDrag,
    endRoutePointDrag,
    cancelRoutePointDrag,
    setSelectedBoxX,
    setSelectedBoxZ,
    nudgeSelectedBox,
    rotateSelectedBox,
    setBoxOrientation,
    patchSelectedOpening,
    zoomIn,
    zoomOut,
    zoomAt,
    wheelZoomFactor,
    fit,
    fitWall,
    panBy,
    placementTool,
    placementPreview,
    startPlacement,
    cancelPlacement,
    updatePlacementPreview,
    commitPlacement,
    openingPlacementTool,
    openingPlacementPreview,
    startOpeningPlacement,
    cancelOpeningPlacement,
    updateOpeningPlacementPreview,
    commitOpeningPlacement,
    availablePlacementSymbols,
    availableCircuits,
    cabinetSizePresets,
    setPanelDimensions,
    boxTypes,
    openingTypes,
    setElementBoxType,
    applyOpeningPreset,
    formatConduitSize,
    nudgeSelectedConduitHeight,
    setSelectedConduitHeight,
    deleteConduit,
    deleteSelectedBox,
    deleteSelectedOpening,
    availableExternalTargets,
    connectToExternalElement,
    rawSelectedConduit,
    autoConnectConduits,
    setAutoConnectConduits,
    resetSequence,
    lastPlacedElementId,
    isConnectingConduit,
    conduitSourceBoxId,
    startConduitConnection,
    cancelConduitConnection,
    handleBoxClickInConnectMode
  } = useWallElevationViewModel();

  const [isConduitModalOpen, setIsConduitModalOpen] = useState(false);
  const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);
  const [pointerWorld, setPointerWorld] = useState<{ x: number; y: number } | null>(null);

  const handlersRef = useRef({
    isOpen,
    isConnectingConduit,
    placementTool,
    openingPlacementTool,
    isExternalModalOpen,
    isDragging,
    isGripDragging,
    selectedBox,
    selectedOpening,
    selectedConduit,
    cancelConduitConnection,
    cancelPlacement,
    cancelOpeningPlacement,
    cancelBoxDrag,
    cancelRoutePointDrag,
    deleteSelectedBox,
    deleteSelectedOpening,
    deleteConduit,
    clearSelection,
    close
  });

  useEffect(() => {
    handlersRef.current = {
      isOpen,
      isConnectingConduit,
      placementTool,
      openingPlacementTool,
      isExternalModalOpen,
      isDragging,
      isGripDragging,
      selectedBox,
      selectedOpening,
      selectedConduit,
      cancelConduitConnection,
      cancelPlacement,
      cancelOpeningPlacement,
      cancelBoxDrag,
      cancelRoutePointDrag,
      deleteSelectedBox,
      deleteSelectedOpening,
      deleteConduit,
      clearSelection,
      close
    };
  });

  // Atajos de Teclado Globales (Escape / Delete / Backspace)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      if (e.key === 'Escape') {
        if (h.isConnectingConduit) {
          h.cancelConduitConnection();
          setPointerWorld(null);
        } else if (h.isExternalModalOpen) {
          setIsExternalModalOpen(false);
        } else if (h.placementTool) {
          h.cancelPlacement();
        } else if (h.openingPlacementTool) {
          h.cancelOpeningPlacement();
        } else if (h.isDragging) {
          h.cancelBoxDrag();
        } else if (h.isGripDragging) {
          h.cancelRoutePointDrag();
        } else {
          h.close();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
          return;
        }
        if (h.selectedBox) {
          e.preventDefault();
          h.deleteSelectedBox();
        } else if (h.selectedConduit) {
          e.preventDefault();
          h.deleteConduit(h.selectedConduit.id);
          h.clearSelection();
        } else if (h.selectedOpening) {
          e.preventDefault();
          h.deleteSelectedOpening();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !wall || !elevation) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wall-elevation-title"
      className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-150"
    >
      {/* 1. Cabecera y controles superiores */}
      <ElevationTopBar
        wall={wall}
        elevation={elevation}
        face={face}
        faceOptions={faceOptions}
        setFace={setFace}
        placementTool={placementTool}
        openingPlacementTool={openingPlacementTool}
        autoConnectConduits={autoConnectConduits}
        setAutoConnectConduits={setAutoConnectConduits}
        lastPlacedElementId={lastPlacedElementId}
        resetSequence={resetSequence}
        cancelPlacement={cancelPlacement}
        isConnectingConduit={isConnectingConduit}
        conduitSourceBoxId={conduitSourceBoxId}
        cancelConduitConnection={() => {
          cancelConduitConnection();
          setPointerWorld(null);
        }}
        startConduitConnection={startConduitConnection}
        selectedBox={selectedBox}
        availableCircuits={availableCircuits}
        availablePlacementSymbols={availablePlacementSymbols}
        startPlacement={startPlacement}
        openingTypes={openingTypes}
        startOpeningPlacement={startOpeningPlacement}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        fitWall={fitWall}
        fit={fit}
        close={close}
      />

      {/* 2. Cuerpo: Lienzo CAD + Panel Lateral en escritorio */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-slate-950 relative">
        <ElevationCanvas
          elevation={elevation}
          displayBoxes={displayBoxes}
          displayConduits={displayConduits}
          routeGrips={routeGrips}
          guideY={guideY}
          isDragging={isDragging}
          isGripDragging={isGripDragging}
          selection={selection}
          selectedConduit={selectedConduit}
          viewBoxAttribute={viewBoxAttribute}
          selectBox={selectBox}
          selectOpening={selectOpening}
          selectConduit={selectConduit}
          clearSelection={clearSelection}
          beginBoxDrag={beginBoxDrag}
          moveBoxDrag={moveBoxDrag}
          endBoxDrag={endBoxDrag}
          beginRoutePointDrag={beginRoutePointDrag}
          moveRoutePointDrag={moveRoutePointDrag}
          endRoutePointDrag={endRoutePointDrag}
          wheelZoomFactor={wheelZoomFactor}
          zoomAt={zoomAt}
          panBy={panBy}
          fitWall={fitWall}
          fit={fit}
          placementTool={placementTool}
          placementPreview={placementPreview}
          commitPlacement={commitPlacement}
          updatePlacementPreview={updatePlacementPreview}
          openingPlacementTool={openingPlacementTool}
          openingPlacementPreview={openingPlacementPreview}
          commitOpeningPlacement={commitOpeningPlacement}
          updateOpeningPlacementPreview={updateOpeningPlacementPreview}
          isConnectingConduit={isConnectingConduit}
          conduitSourceBoxId={conduitSourceBoxId}
          cancelConduitConnection={() => {
            cancelConduitConnection();
            setPointerWorld(null);
          }}
          handleBoxClickInConnectMode={handleBoxClickInConnectMode}
          pointerWorld={pointerWorld}
          setPointerWorld={setPointerWorld}
        />

        {/* 3. Panel Lateral para Celulares (Cajón inferior) */}
        <ElevationMobileDrawer
          isConnectingConduit={isConnectingConduit}
          conduitSourceBoxId={conduitSourceBoxId}
          cancelConduitConnection={() => {
            cancelConduitConnection();
            setPointerWorld(null);
          }}
          startConduitConnection={startConduitConnection}
          placementTool={placementTool}
          openingPlacementTool={openingPlacementTool}
          autoConnectConduits={autoConnectConduits}
          setAutoConnectConduits={setAutoConnectConduits}
          cancelPlacement={cancelPlacement}
          cancelOpeningPlacement={cancelOpeningPlacement}
          selectedBox={selectedBox}
          selectedOpening={selectedOpening}
          selectedConduit={selectedConduit}
          rawSelectedConduit={rawSelectedConduit}
          selectedConduitMetric={selectedConduitMetric}
          wall={wall}
          elevation={elevation}
          face={face}
          setFace={setFace}
          clearSelection={clearSelection}
          rotateSelectedBox={rotateSelectedBox}
          setBoxOrientation={setBoxOrientation}
          setElementBoxType={setElementBoxType}
          setPanelDimensions={setPanelDimensions}
          setSelectedBoxX={setSelectedBoxX}
          setSelectedBoxZ={setSelectedBoxZ}
          nudgeSelectedBox={nudgeSelectedBox}
          deleteSelectedBox={deleteSelectedBox}
          patchSelectedOpening={patchSelectedOpening}
          applyOpeningPreset={applyOpeningPreset}
          formatConduitSize={formatConduitSize}
          conduitPresetOptions={conduitPresetOptions}
          setConduitPreset={setConduitPreset}
          resetConduitRoute={resetConduitRoute}
          nudgeSelectedConduitHeight={nudgeSelectedConduitHeight}
          setSelectedConduitHeight={setSelectedConduitHeight}
          deleteConduit={deleteConduit}
          onOpenConduitModal={() => setIsConduitModalOpen(true)}
          onOpenExternalModal={() => setIsExternalModalOpen(true)}
          heightPresets={heightPresets}
          cabinetSizePresets={cabinetSizePresets}
          boxTypes={boxTypes}
          openingTypes={openingTypes}
          availableCircuits={availableCircuits}
          availablePlacementSymbols={availablePlacementSymbols}
          startPlacement={startPlacement}
          startOpeningPlacement={startOpeningPlacement}
        />

        {/* 4. Panel Lateral para Escritorio */}
        <ElevationInspectorSidebar
          wall={wall}
          elevation={elevation}
          face={face}
          selectedBox={selectedBox}
          selectedOpening={selectedOpening}
          selectedConduit={selectedConduit}
          rawSelectedConduit={rawSelectedConduit}
          selectedConduitMetric={selectedConduitMetric}
          conduitPresetOptions={conduitPresetOptions}
          boxTypes={boxTypes}
          cabinetSizePresets={cabinetSizePresets}
          heightPresets={heightPresets}
          openingTypes={openingTypes}
          onClearSelection={clearSelection}
          onToggleFace={() => setFace(face === 'left' ? 'right' : 'left')}
          onStartConduitConnection={startConduitConnection}
          onOpenExternalModal={() => setIsExternalModalOpen(true)}
          onDeleteSelectedBox={deleteSelectedBox}
          onRotateSelectedBox={rotateSelectedBox}
          onSetBoxOrientation={setBoxOrientation}
          onSetElementBoxType={setElementBoxType}
          onSetPanelDimensions={setPanelDimensions}
          onSetSelectedBoxX={setSelectedBoxX}
          onSetSelectedBoxZ={setSelectedBoxZ}
          onNudgeSelectedBox={nudgeSelectedBox}
          onApplyOpeningPreset={applyOpeningPreset}
          onPatchSelectedOpening={patchSelectedOpening}
          onDeleteSelectedOpening={deleteSelectedOpening}
          formatConduitSize={formatConduitSize}
          onSetConduitPreset={setConduitPreset}
          onResetConduitRoute={resetConduitRoute}
          onNudgeSelectedConduitHeight={nudgeSelectedConduitHeight}
          onSetSelectedConduitHeight={setSelectedConduitHeight}
          onOpenConduitModal={() => setIsConduitModalOpen(true)}
          onDeleteConduit={deleteConduit}
        />
      </div>

      {/* 5. Modal para configurar cables y canalización */}
      <ConduitModal
        conduit={rawSelectedConduit}
        isOpen={isConduitModalOpen && Boolean(rawSelectedConduit)}
        onClose={() => setIsConduitModalOpen(false)}
      />

      {/* 6. Modal para conectar con techos / losas u otros tableros */}
      {selectedBox && (
        <ElevationExternalTargetModal
          isOpen={isExternalModalOpen}
          onClose={() => setIsExternalModalOpen(false)}
          selectedBox={selectedBox}
          availableExternalTargets={availableExternalTargets}
          onConnectToExternalElement={connectToExternalElement}
        />
      )}
    </div>
  );
};
