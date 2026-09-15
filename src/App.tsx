/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA PRINCIPAL: App.tsx
 * Ensamblador de Vistas del Relevador BIM 2D con Ergonomía Móvil (Thumb Zone).
 * Conecta el lienzo CAD con la botonera inferior de carga continua y anclajes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from './viewmodels/useProjectStore';
import { useSurveyViewModel } from './viewmodels/useSurveyViewModel';
import { BimCanvas } from './views/components/canvas/BimCanvas';
import { TopStatusBar } from './views/components/survey/TopStatusBar';
import { ThumbSurveyDock } from './views/components/survey/ThumbSurveyDock';
import { SurveyActionSheets } from './views/components/survey/SurveyActionSheets';
import { SymbolPalette } from './views/components/electrical/SymbolPalette';
import { ComputoModal } from './views/components/survey/ComputoModal';
import { getSymbolById } from './models/electrical/symbolsLib';

export function App() {
  const {
    project,
    setSelectedEntity,
    addElectricalElement
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
    commitWall,
    handleElectricalElementClick
  } = useSurveyViewModel();

  const [showComputoModal, setShowComputoModal] = useState(false);
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);

  // Escuchar eventos de apertura de modales de acción contextual (Empalme / Abertura)
  useEffect(() => {
    const handleOpenTee = () => setShowTeeModal(true);
    const handleOpenOpening = () => setShowOpeningModal(true);

    window.addEventListener('open-tee-modal', handleOpenTee);
    window.addEventListener('open-opening-modal', handleOpenOpening);

    return () => {
      window.removeEventListener('open-tee-modal', handleOpenTee);
      window.removeEventListener('open-opening-modal', handleOpenOpening);
    };
  }, []);

  // Manejo de clic en el lienzo (colocación de punto inicial o bocas eléctricas)
  const handleCanvasClick = (worldX: number, worldY: number) => {
    if (selectedSymbolId) {
      const symDef = getSymbolById(selectedSymbolId);
      const isCeiling = selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');
      const isWall =
        selectedSymbolId.includes('enchufe') ||
        selectedSymbolId.includes('interruptor') ||
        selectedSymbolId.includes('tablero');

      addElectricalElement({
        id: `el-${Date.now()}`,
        symbolId: selectedSymbolId,
        levelId: project.activeLevelId,
        spaceId: project.spaces[0]?.id || 'espacio-principal',
        placement: isCeiling ? 'ceiling' : isWall ? 'wall' : 'floor',
        x: worldX,
        y: worldY,
        heightZ: isCeiling ? 2.70 : selectedSymbolId.includes('enchufe') ? 0.30 : 1.20,
        label: symDef?.label?.substring(0, 4) || 'Boca'
      });

      setSelectedSymbolId(null);
      return;
    }

    // Si el proyecto no tiene paredes, el primer clic inicia el muro
    if (project.vertices.length === 0) {
      commitWall();
    } else {
      setSelectedEntity(null);
    }
  };

  const previewDist = parseFloat(currentDistanceInput) || 3.50;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 flex flex-col font-sans select-none">
      {/* 1. Barra Superior Pasiva (Lectura de Estado y Cotizador) */}
      <TopStatusBar onViewComputoClick={() => setShowComputoModal(true)} />

      {/* 2. Lienzo Gráfico CAD BIM 2D con Snaps Interactivos y Rayo Láser */}
      <main className="flex-1 w-full h-full pb-48">
        <BimCanvas
          currentDirectionDeg={effectiveAngleDeg}
          previewDistanceM={previewDist}
          onWallClick={(wallId) => setSelectedEntity({ type: 'wall', id: wallId })}
          onOpeningClick={(openingId) => setSelectedEntity({ type: 'opening', id: openingId })}
          onSpaceClick={(spaceId) => setSelectedEntity({ type: 'space', id: spaceId })}
          onElectricalElementClick={handleElectricalElementClick}
          onCanvasClick={handleCanvasClick}
        />
      </main>

      {/* 3. Acciones Contextuales de Paredes (Empalme en T, Aberturas) */}
      <SurveyActionSheets
        showTeeModal={showTeeModal}
        onCloseTeeModal={() => setShowTeeModal(false)}
        showOpeningModal={showOpeningModal}
        onCloseOpeningModal={() => setShowOpeningModal(false)}
      />

      {/* 4. Paleta de Símbolos AEA 90364 Flotante (Sobre la botonera) */}
      <div className="absolute bottom-44 right-4 z-10">
        <SymbolPalette
          selectedSymbolId={selectedSymbolId}
          onSelectSymbol={setSelectedSymbolId}
          isConnectingConduit={isConnectingConduit}
          onToggleConnectConduit={() => setIsConnectingConduit(!isConnectingConduit)}
        />
      </div>

      {/* 5. BOTONERA ERGONÓMICA INFERIOR (ZONA NATURAL DEL PULGAR) */}
      <ThumbSurveyDock
        relativeTurn={relativeTurn}
        onSelectTurn={setRelativeTurn}
        customAngle={customAngleDeg}
        onChangeCustomAngle={setCustomAngleDeg}
        currentDistance={currentDistanceInput}
        onChangeDistance={setCurrentDistanceInput}
        onCommitWall={() => commitWall()}
      />

      {/* 6. Modal de Cómputo Métrico para Cotizador IEBA */}
      <ComputoModal isOpen={showComputoModal} onClose={() => setShowComputoModal(false)} />
    </div>
  );
}

export default App;
