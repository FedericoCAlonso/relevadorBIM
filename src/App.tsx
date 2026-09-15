/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA PRINCIPAL: App.tsx
 * Ensamblador de Vistas del Relevador BIM 2D y Red Eléctrica AEA 90364.
 * Flujo de Relevamiento Directo por Puntos de Referencia y Rumbo Ortogonal.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from './viewmodels/useProjectStore';
import { useSurveyViewModel } from './viewmodels/useSurveyViewModel';
import { BimCanvas } from './views/components/canvas/BimCanvas';
import { QuickMeasureBar } from './views/components/survey/QuickMeasureBar';
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
    currentDirection,
    setCurrentDirection,
    currentDistanceInput,
    setCurrentDistanceInput,
    selectedSymbolId,
    setSelectedSymbolId,
    isConnectingConduit,
    setIsConnectingConduit,
    commitWallFromAnchor,
    handleElectricalElementClick
  } = useSurveyViewModel();

  const [showComputoModal, setShowComputoModal] = useState(false);
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);

  // Escuchar eventos de apertura de modales de acción contextual
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

  // Manejo de clic sobre el lienzo (colocación de punto inicial o bocas eléctricas)
  const handleCanvasClick = (worldX: number, worldY: number) => {
    // Si hay un símbolo eléctrico seleccionado en la paleta, colocarlo
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

    // Si el proyecto no tiene paredes, el primer clic establece el punto cero inicial
    if (project.vertices.length === 0) {
      // Inicia un muro desde la coordenada clickeada
      commitWallFromAnchor();
    } else {
      setSelectedEntity(null);
    }
  };

  const previewDist = parseFloat(currentDistanceInput) || 3.50;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 flex flex-col font-sans">
      {/* 1. Barra de Rumbo Ortogonal y Medición Láser */}
      <QuickMeasureBar
        currentDirection={currentDirection}
        onSelectDirection={setCurrentDirection}
        currentDistance={currentDistanceInput}
        onChangeDistance={setCurrentDistanceInput}
        onCommitWall={() => commitWallFromAnchor()}
        onViewComputoClick={() => setShowComputoModal(true)}
      />

      {/* 2. Lienzo Gráfico CAD BIM 2D con Snaps y Rayo Láser */}
      <main className="flex-1 w-full h-full">
        <BimCanvas
          currentDirectionDeg={currentDirection}
          previewDistanceM={previewDist}
          onWallClick={(wallId) => setSelectedEntity({ type: 'wall', id: wallId })}
          onOpeningClick={(openingId) => setSelectedEntity({ type: 'opening', id: openingId })}
          onSpaceClick={(spaceId) => setSelectedEntity({ type: 'space', id: spaceId })}
          onElectricalElementClick={handleElectricalElementClick}
          onCanvasClick={handleCanvasClick}
        />
      </main>

      {/* 3. Acciones Contextuales de Paredes (Empalme en T, Abertura) */}
      <SurveyActionSheets
        showTeeModal={showTeeModal}
        onCloseTeeModal={() => setShowTeeModal(false)}
        showOpeningModal={showOpeningModal}
        onCloseOpeningModal={() => setShowOpeningModal(false)}
      />

      {/* 4. Paleta de Símbolos AEA 90364 */}
      <SymbolPalette
        selectedSymbolId={selectedSymbolId}
        onSelectSymbol={setSelectedSymbolId}
        isConnectingConduit={isConnectingConduit}
        onToggleConnectConduit={() => setIsConnectingConduit(!isConnectingConduit)}
      />

      {/* 5. Cómputo Métrico / Cotizador IEBA */}
      <ComputoModal isOpen={showComputoModal} onClose={() => setShowComputoModal(false)} />
    </div>
  );
}

export default App;
