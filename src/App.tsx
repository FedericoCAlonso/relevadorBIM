/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA PRINCIPAL: App.tsx
 * Ensamblador de Vistas del Relevador BIM 2D con Adaptación Responsive:
 * - Vista de Escritorio: Panel Lateral CAD Inspector (Muros, Aberturas, Ambientes, Alturas, Eléctrico)
 * - Vista Móvil: Botonera Ergonómica inferior (Zona Natural del Pulgar)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from './viewmodels/useProjectStore';
import { useSurveyViewModel } from './viewmodels/useSurveyViewModel';
import { useMediaQuery } from './viewmodels/useMediaQuery';
import { BimCanvas, type WallPlacementSnap } from './views/components/canvas/BimCanvas';
import { TopStatusBar } from './views/components/survey/TopStatusBar';
import { ThumbSurveyDock } from './views/components/survey/ThumbSurveyDock';
import { DesktopSidebar } from './views/components/desktop/DesktopSidebar';
import { SurveyActionSheets } from './views/components/survey/SurveyActionSheets';
import { SpaceEditModal } from './views/components/survey/SpaceEditModal';
import { ComputoModal } from './views/components/survey/ComputoModal';
import { MainMenuModal } from './views/components/menu/MainMenuModal';
import { ProjectSettingsModal } from './views/components/menu/ProjectSettingsModal';
import { ExportModal } from './views/components/menu/ExportModal';
import { ElectricalElementModal } from './views/components/electrical/ElectricalElementModal';
import { ConduitModal } from './views/components/electrical/ConduitModal';
import { useUnderlaySheetViewModel } from './viewmodels/useUnderlaySheetViewModel';
import { usePatternDetectorViewModel } from './viewmodels/usePatternDetectorViewModel';
import { UnderlayCalibrationModal } from './views/components/underlay/UnderlayCalibrationModal';
import { getSymbolById } from './models/electrical/symbolsLib';
import { resolveSpacePolygon, isPointInPolygon } from './models/architecture/Space';
import { AEA_CALCULATION_CONSTANTS } from './models/electrical/electricalStandards';

export function App() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const {
    project,
    selectedEntity,
    setSelectedEntity,
    addElectricalElement,
    undoLastWall,
    deleteWall,
    deleteOpening,
    deleteElectricalElement,
    deleteConduit,
    deleteDimensionLine
  } = useProjectStore();

  const {
    relativeTurn,
    setRelativeTurn,
    customAngleDeg,
    setCustomAngleDeg,
    effectiveAngleDeg,
    currentDistanceInput,
    setCurrentDistanceInput,
    selectedSymbolId,
    setSelectedSymbolId,
    isConnectingConduit,
    setIsConnectingConduit,
    pendingConduitStartId,
    cancelConduitConnection,
    commitWall,
    handleElectricalElementClick,
    isAddingDimension,
    dimensionP1,
    startAddingDimension,
    cancelAddingDimension,
    handleDimensionCanvasClick
  } = useSurveyViewModel();

  const {
    activeUnderlay,
    isCalibrating: isCalibratingUnderlay,
    calibrationP1,
    showCalibrationModal,
    measuredDistanceWorldM,
    isLoadingFile: isLoadingUnderlayFile,
    errorMessage: underlayErrorMessage,
    setErrorMessage: setUnderlayErrorMessage,
    handleLoadFile: handleLoadUnderlayFile,
    startCalibration: startUnderlayCalibration,
    cancelCalibration: cancelUnderlayCalibration,
    handleCalibrationCanvasClick,
    confirmCalibration: confirmUnderlayCalibration,
    toggleVisibility: toggleUnderlayVisibility,
    cycleOpacity: cycleUnderlayOpacity,
    removeSheet: removeUnderlaySheet
  } = useUnderlaySheetViewModel();

  const {
    isSamplingPattern,
    isAddingSample,
    isDetecting: isDetectingPatterns,
    positiveExemplars,
    negativeExemplars,
    activeMatches: detectedPatternMatches,
    similarityThreshold,
    setSimilarityThreshold,
    startSamplingPattern,
    cancelSamplingPattern,
    executeDetectionFromWorldBox,
    dismissMatch: dismissPatternMatch,
    clearMatches: clearPatternMatches,
    undoLastPositiveExemplar,
    convertMatchesToElectricalElements
  } = usePatternDetectorViewModel();

  const [isArchitectureLocked, setIsArchitectureLocked] = useState(false);
  const [showComputoModal, setShowComputoModal] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showElementModal, setShowElementModal] = useState(false);
  const [showConduitModal, setShowConduitModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);

  // Entidades eléctricas seleccionadas para modales
  const selectedElectricalElement =
    selectedEntity?.type === 'electrical_element'
      ? project.electricalElements.find((e) => e.id === selectedEntity.id)
      : null;
  const selectedConduit =
    selectedEntity?.type === 'conduit' ? project.conduits.find((c) => c.id === selectedEntity.id) : null;

  // Atajos de teclado CAD (Ctrl+Z para deshacer, Escape para deseleccionar, Supr para borrar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoLastWall();
        return;
      }

      if (e.key === 'Escape') {
        if (isConnectingConduit) {
          cancelConduitConnection();
          return;
        }
        if (isCalibratingUnderlay) {
          cancelUnderlayCalibration();
          return;
        }
        if (isAddingDimension) {
          cancelAddingDimension();
          return;
        }
        if (isSamplingPattern) {
          cancelSamplingPattern();
          return;
        }
        if (detectedPatternMatches.length > 0) {
          clearPatternMatches();
          return;
        }
        setSelectedEntity(null);
        setSelectedSymbolId(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEntity) {
          e.preventDefault();
          if (selectedEntity.type === 'wall') deleteWall(selectedEntity.id);
          else if (selectedEntity.type === 'opening') deleteOpening(selectedEntity.id);
          else if (selectedEntity.type === 'electrical_element') deleteElectricalElement(selectedEntity.id);
          else if (selectedEntity.type === 'conduit') deleteConduit(selectedEntity.id);
          else if (selectedEntity.type === 'dimension') deleteDimensionLine(selectedEntity.id);
          setSelectedEntity(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedEntity,
    isConnectingConduit,
    isCalibratingUnderlay,
    isAddingDimension,
    undoLastWall,
    deleteWall,
    deleteOpening,
    deleteElectricalElement,
    deleteConduit,
    deleteDimensionLine,
    cancelConduitConnection,
    cancelUnderlayCalibration,
    cancelAddingDimension,
    setSelectedEntity,
    setSelectedSymbolId
  ]);

  // Escuchar eventos de apertura de modales de acción contextual
  useEffect(() => {
    const handleOpenTee = () => setShowTeeModal(true);
    const handleOpenOpening = () => setShowOpeningModal(true);
    const handleOpenElement = () => setShowElementModal(true);
    const handleOpenConduit = () => setShowConduitModal(true);

    window.addEventListener('open-tee-modal', handleOpenTee);
    window.addEventListener('open-opening-modal', handleOpenOpening);
    window.addEventListener('open-element-edit-modal', handleOpenElement);
    window.addEventListener('open-conduit-edit-modal', handleOpenConduit);

    return () => {
      window.removeEventListener('open-tee-modal', handleOpenTee);
      window.removeEventListener('open-opening-modal', handleOpenOpening);
      window.removeEventListener('open-element-edit-modal', handleOpenElement);
      window.removeEventListener('open-conduit-edit-modal', handleOpenConduit);
    };
  }, []);

  // Manejo de clic en el lienzo (colocación de punto inicial o bocas eléctricas con snap a pared)
  const handleCanvasClick = (worldX: number, worldY: number, snapInfo?: WallPlacementSnap) => {
    if (selectedSymbolId) {
      const symDef = getSymbolById(selectedSymbolId);
      const isCeiling = selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');
      const isWall =
        Boolean(snapInfo?.wallId) ||
        selectedSymbolId.includes('enchufe') ||
        selectedSymbolId.includes('toma') ||
        selectedSymbolId.includes('interruptor') ||
        selectedSymbolId.includes('llave') ||
        selectedSymbolId.includes('tablero') ||
        selectedSymbolId.includes('tp') ||
        selectedSymbolId.includes('ts') ||
        selectedSymbolId.includes('medidor') ||
        selectedSymbolId.includes('caja-pase') ||
        selectedSymbolId.includes('aplique');

      // Buscar si el punto cae dentro de algún ambiente cerrado
      const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
      const containingSpace = project.spaces.find((space) => {
        const poly = resolveSpacePolygon(space, verticesMap);
        return poly.length >= 3 && isPointInPolygon({ x: worldX, y: worldY }, poly);
      });

      const ceilingH = containingSpace ? containingSpace.ceilingHeight : 2.70;
      const count = project.electricalElements.filter((e) => e.symbolId === selectedSymbolId).length + 1;
      const baseLabel = symDef?.label?.split(' ')[0] || 'Boca';
      const label = `${baseLabel} ${count}`;

      // Estimación de potencia según norma AEA
      const powerW =
        selectedSymbolId.includes('toma') || selectedSymbolId.includes('enchufe')
          ? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_TOMA_W
          : selectedSymbolId.includes('techo')
          ? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_CENTRO_LUZ_W
          : selectedSymbolId.includes('aplique')
          ? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_APLIQUE_W
          : 0;

      // Inferir circuito sugerido según el tipo de boca (Norma AEA)
      let defaultCircuitId: string | null = null;
      if (isCeiling || selectedSymbolId.includes('aplique') || selectedSymbolId.includes('llave')) {
        defaultCircuitId = project.circuits.find((c) => c.type === 'IUG')?.id || null;
      } else if (selectedSymbolId.includes('toma') || selectedSymbolId.includes('enchufe')) {
        defaultCircuitId = project.circuits.find((c) => c.type === 'TUG')?.id || null;
      }

      const newElementId = `el-${Date.now()}`;
      addElectricalElement({
        id: newElementId,
        symbolId: selectedSymbolId,
        levelId: project.activeLevelId,
        spaceId: containingSpace?.id || project.spaces[0]?.id || 'espacio-principal',
        placement: isCeiling ? 'ceiling' : isWall ? 'wall' : 'floor',
        x: Number(worldX.toFixed(3)),
        y: Number(worldY.toFixed(3)),
        heightZ: isCeiling
          ? ceilingH
          : selectedSymbolId.includes('tp') || selectedSymbolId.includes('ts') || selectedSymbolId.includes('tablero') || selectedSymbolId.includes('medidor')
          ? 1.40
          : selectedSymbolId.includes('enchufe') || selectedSymbolId.includes('toma')
          ? 0.30
          : 1.20,
        wallId: snapInfo?.wallId || null,
        wallOffset: snapInfo?.wallOffset,
        rotation: snapInfo?.rotationDeg ?? 0,
        side: snapInfo?.side,
        circuitId: defaultCircuitId,
        status: 'proyectado',
        powerW,
        phases: 1,
        isPanel:
          selectedSymbolId.includes('tablero') ||
          selectedSymbolId.includes('tp') ||
          selectedSymbolId.includes('ts') ||
          selectedSymbolId.includes('medidor'),
        label,
        attributes: []
      });

      setSelectedEntity({ type: 'electrical_element', id: newElementId });
      setSelectedSymbolId(null);
      return;
    }

    if (isConnectingConduit) {
      return;
    }

    setSelectedEntity(null);
  };

  const previewDist = parseFloat(currentDistanceInput) || 3.50;

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-100 flex flex-col font-sans select-none">
      {/* 1. Barra Superior (Menú Minimalista, Planta, Cotas y Pantalla Completa) */}
      <TopStatusBar onOpenMenu={() => setShowMainMenu(true)} />

      {/* 2. Cuerpo Principal: Responsive Desktop vs Mobile */}
      <div className="flex-1 w-full h-full flex pt-14 overflow-hidden">
        {/* Panel Lateral CAD Inspector (Visible solo en Escritorio >= 1024px) */}
        {isDesktop && (
          <DesktopSidebar
            relativeTurn={relativeTurn}
            onSelectTurn={setRelativeTurn}
            customAngle={customAngleDeg}
            onChangeCustomAngle={setCustomAngleDeg}
            currentDistance={currentDistanceInput}
            onChangeDistance={setCurrentDistanceInput}
            onCommitWall={() => commitWall()}
            selectedSymbolId={selectedSymbolId}
            onSelectSymbol={setSelectedSymbolId}
            isConnectingConduit={isConnectingConduit}
            onToggleConnectConduit={() => setIsConnectingConduit(!isConnectingConduit)}
          />
        )}

        {/* Lienzo Gráfico CAD 2D */}
        <main className={`flex-1 w-full h-full relative ${isDesktop ? 'pb-0' : 'pb-44'}`}>
          <BimCanvas
            currentDirectionDeg={effectiveAngleDeg}
            previewDistanceM={previewDist}
            selectedSymbolId={selectedSymbolId}
            isConnectingConduit={isConnectingConduit}
            pendingConduitStartId={pendingConduitStartId}
            onCancelConnectingConduit={cancelConduitConnection}
            underlaySheet={activeUnderlay}
            isCalibratingUnderlay={isCalibratingUnderlay}
            calibrationP1={calibrationP1}
            onCalibrationCanvasClick={handleCalibrationCanvasClick}
            onCancelCalibration={cancelUnderlayCalibration}
            onToggleUnderlayVisibility={toggleUnderlayVisibility}
            onCycleUnderlayOpacity={cycleUnderlayOpacity}
            onStartUnderlayCalibration={startUnderlayCalibration}
            isAddingDimension={isAddingDimension}
            dimensionP1={dimensionP1}
            onToggleAddingDimension={() => {
              if (isAddingDimension) cancelAddingDimension();
              else startAddingDimension();
            }}
            onDimensionCanvasClick={handleDimensionCanvasClick}
            onCancelAddingDimension={cancelAddingDimension}
            isSamplingPattern={isSamplingPattern}
            onStartPatternSampling={startSamplingPattern}
            onCancelSamplingPattern={cancelSamplingPattern}
            onPatternSampleBoxCompleted={(p1, p2) => executeDetectionFromWorldBox(p1, p2)}
            detectedPatternMatches={detectedPatternMatches}
            onDismissPatternMatch={dismissPatternMatch}
            onWallClick={(wallId) => setSelectedEntity({ type: 'wall', id: wallId })}
            onOpeningClick={(openingId) => setSelectedEntity({ type: 'opening', id: openingId })}
            onSpaceClick={(spaceId) => {
              setSelectedEntity({ type: 'space', id: spaceId });
              if (!isDesktop) {
                setEditingSpaceId(spaceId);
              }
            }}
            onElectricalElementClick={(elementId) => {
              if (!isConnectingConduit && selectedEntity?.type === 'electrical_element' && selectedEntity.id === elementId) {
                setShowElementModal(true);
              } else {
                handleElectricalElementClick(elementId);
              }
            }}
            onElectricalElementDoubleClick={(elementId) => {
              if (!isConnectingConduit) {
                handleElectricalElementClick(elementId);
                setShowElementModal(true);
              } else {
                handleElectricalElementClick(elementId);
              }
            }}
            onCanvasClick={handleCanvasClick}
            isArchitectureLocked={isArchitectureLocked}
            onToggleLockArchitecture={() => setIsArchitectureLocked((prev) => !prev)}
          />

          {/* Indicador de muestreo de símbolo activo */}
          {isSamplingPattern && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-xl border border-cyan-500/60 flex items-center gap-3 text-xs animate-in fade-in slide-in-from-top-2 pointer-events-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-semibold text-cyan-200">
                {isAddingSample
                  ? 'Dibujá un recuadro sobre otro símbolo para sumar como muestra...'
                  : 'Dibujá un recuadro sobre el símbolo a buscar en el plano...'}
              </span>
              <button
                type="button"
                onClick={cancelSamplingPattern}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-[11px] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Indicador de procesamiento de autovalores en mapa de bits */}
          {isDetectingPatterns && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-xl border border-cyan-500/50 flex items-center gap-2.5 text-xs font-semibold animate-pulse pointer-events-none">
              <span className="text-cyan-400">⏳</span>
              <span>Buscando patrones, autovalores y correlación gráfica...</span>
            </div>
          )}

          {/* Barra interactiva de control cuando hay muestras o patrones activos */}
          {positiveExemplars.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-cyan-500/50 flex flex-wrap items-center justify-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-3 pointer-events-auto max-w-[95vw]">
              {/* Badge de cantidad detectada y ejemplares */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${detectedPatternMatches.length > 0 ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
                <span className="font-bold text-cyan-200 whitespace-nowrap">
                  {detectedPatternMatches.length} {detectedPatternMatches.length === 1 ? 'detectado' : 'detectados'}
                </span>
                {(positiveExemplars.length > 1 || negativeExemplars.length > 0) && (
                  <span className="text-[10px] text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded-md border border-slate-700">
                    {positiveExemplars.length} {positiveExemplars.length === 1 ? 'muestra' : 'muestras'}
                    {negativeExemplars.length > 0 ? ` · ${negativeExemplars.length} desc.` : ''}
                  </span>
                )}
              </div>

              {/* Control deslizante interactivo de Sensibilidad */}
              <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/80">
                <span className="text-[11px] text-slate-300 font-medium whitespace-nowrap">
                  Sensibilidad: <strong className="text-cyan-300">{Math.round(similarityThreshold * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min={40}
                  max={90}
                  step={5}
                  value={Math.round(similarityThreshold * 100)}
                  onChange={(e) => setSimilarityThreshold(Number(e.target.value) / 100)}
                  className="w-16 sm:w-24 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  title={`Sensibilidad de detección: ${Math.round(similarityThreshold * 100)}%`}
                />
              </div>

              {/* Botón para agregar otra muestra (aprendizaje activo) */}
              <button
                type="button"
                onClick={() => startSamplingPattern(true)}
                className={`px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
                  isSamplingPattern && isAddingSample
                    ? 'bg-cyan-700 text-white border-cyan-400 shadow-md ring-1 ring-cyan-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border-cyan-500/40'
                }`}
                title="Seleccionar otra muestra para ampliar el reconocimiento"
              >
                <span>＋ Otra muestra</span>
              </button>

              {/* Botón para deshacer última muestra si se tomó por error */}
              {positiveExemplars.length > 1 && (
                <button
                  type="button"
                  onClick={undoLastPositiveExemplar}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-xl border border-amber-500/40 transition-colors text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                  title="Descartar la última muestra agregada y volver a la muestra anterior"
                >
                  <span>↶ Deshacer muestra</span>
                </button>
              )}

              {/* Botón de emplazamiento masivo */}
              {detectedPatternMatches.length > 0 && selectedSymbolId && (
                <button
                  type="button"
                  onClick={() => {
                    const assignedCircuit = project.circuits[0]?.id || null;
                    convertMatchesToElectricalElements(selectedSymbolId, assignedCircuit);
                  }}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>⚡ Emplazar {detectedPatternMatches.length} bocas</span>
                </button>
              )}

              {detectedPatternMatches.length > 0 && !selectedSymbolId && (
                <span className="text-slate-400 text-[11px] hidden lg:inline">
                  (Elegí un símbolo en la paleta para emplazar)
                </span>
              )}

              <button
                type="button"
                onClick={clearPatternMatches}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors text-[11px] cursor-pointer whitespace-nowrap"
              >
                ✕ Limpiar
              </button>
            </div>
          )}
        </main>
      </div>

      {/* 3. En Móvil: Botonera Ergonómica Inferior en Zona del Pulgar */}
      {!isDesktop && (
        <ThumbSurveyDock
          relativeTurn={relativeTurn}
          onSelectTurn={setRelativeTurn}
          customAngle={customAngleDeg}
          onChangeCustomAngle={setCustomAngleDeg}
          currentDistance={currentDistanceInput}
          onChangeDistance={setCurrentDistanceInput}
          onCommitWall={() => commitWall()}
          selectedSymbolId={selectedSymbolId}
          onSelectSymbol={setSelectedSymbolId}
          isConnectingConduit={isConnectingConduit}
          onToggleConnectConduit={() => setIsConnectingConduit(!isConnectingConduit)}
        />
      )}

      {/* 4. Modales de Empalme en T y Aberturas (para Móvil) */}
      <SurveyActionSheets
        showTeeModal={showTeeModal}
        onCloseTeeModal={() => setShowTeeModal(false)}
        showOpeningModal={showOpeningModal}
        onCloseOpeningModal={() => setShowOpeningModal(false)}
      />

      {/* 5. Modal de Edición de Ambiente (para Móvil: Nombre, Altura h, Superficie) */}
      <SpaceEditModal
        spaceId={editingSpaceId}
        onClose={() => {
          setEditingSpaceId(null);
          setSelectedEntity(null);
        }}
      />

      {/* 6. Modal de Cómputo Métrico / Cotizador IEBA */}
      <ComputoModal isOpen={showComputoModal} onClose={() => setShowComputoModal(false)} />

      {/* Menú Principal Desplegable */}
      <MainMenuModal
        isOpen={showMainMenu}
        onClose={() => setShowMainMenu(false)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenComputo={() => setShowComputoModal(true)}
        hasUnderlay={Boolean(activeUnderlay)}
        onLoadUnderlay={handleLoadUnderlayFile}
        onStartUnderlayCalibration={startUnderlayCalibration}
        onRemoveUnderlay={removeUnderlaySheet}
      />

      {/* Modal de Calibración Métrica de Escala del Plano de Fondo */}
      <UnderlayCalibrationModal
        isOpen={showCalibrationModal}
        initialDistanceM={measuredDistanceWorldM}
        onConfirm={confirmUnderlayCalibration}
        onClose={cancelUnderlayCalibration}
      />

      {/* Overlay de carga al procesar PDF o Imagen */}
      {isLoadingUnderlayFile && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-800">Cargando y procesando plano de fondo...</span>
          </div>
        </div>
      )}

      {/* Notificación de error de plano de fondo */}
      {underlayErrorMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-3">
          <span>{underlayErrorMessage}</span>
          <button
            type="button"
            onClick={() => setUnderlayErrorMessage(null)}
            className="text-white hover:text-red-200 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal de Configuración General de Obra y Catálogo */}
      <ProjectSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Centro de Exportación Unificado (DXF, CSV, JSON, Cotizador) */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onOpenComputo={() => setShowComputoModal(true)}
      />

      {/* 7. Modal de Propiedades de Boca Eléctrica */}
      <ElectricalElementModal
        element={selectedElectricalElement || null}
        isOpen={showElementModal && !!selectedElectricalElement}
        onClose={() => setShowElementModal(false)}
      />

      {/* 8. Modal de Configuración Técnica de Cañería */}
      <ConduitModal
        conduit={selectedConduit || null}
        isOpen={showConduitModal && !!selectedConduit}
        onClose={() => setShowConduitModal(false)}
      />
    </div>
  );
}

export default App;
