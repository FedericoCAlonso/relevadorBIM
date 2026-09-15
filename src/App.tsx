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
import { BimCanvas } from './views/components/canvas/BimCanvas';
import { TopStatusBar } from './views/components/survey/TopStatusBar';
import { ThumbSurveyDock } from './views/components/survey/ThumbSurveyDock';
import { DesktopSidebar } from './views/components/desktop/DesktopSidebar';
import { SurveyActionSheets } from './views/components/survey/SurveyActionSheets';
import { SpaceEditModal } from './views/components/survey/SpaceEditModal';
import { SymbolPalette } from './views/components/electrical/SymbolPalette';
import { ComputoModal } from './views/components/survey/ComputoModal';
import { getSymbolById } from './models/electrical/symbolsLib';

export function App() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

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
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);

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

    if (project.vertices.length === 0) {
      commitWall();
    } else {
      setSelectedEntity(null);
    }
  };

  const previewDist = parseFloat(currentDistanceInput) || 3.50;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 flex flex-col font-sans select-none">
      {/* 1. Barra Superior (Nombre, Planta, Acceso al Cotizador) */}
      <TopStatusBar onViewComputoClick={() => setShowComputoModal(true)} />

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
        <main className={`flex-1 w-full h-full relative ${isDesktop ? 'pb-0' : 'pb-48'}`}>
          <BimCanvas
            currentDirectionDeg={effectiveAngleDeg}
            previewDistanceM={previewDist}
            onWallClick={(wallId) => setSelectedEntity({ type: 'wall', id: wallId })}
            onOpeningClick={(openingId) => setSelectedEntity({ type: 'opening', id: openingId })}
            onSpaceClick={(spaceId) => {
              setSelectedEntity({ type: 'space', id: spaceId });
              if (!isDesktop) {
                setEditingSpaceId(spaceId);
              }
            }}
            onElectricalElementClick={handleElectricalElementClick}
            onCanvasClick={handleCanvasClick}
          />

          {/* En Móvil: Paleta Flotante sobre la botonera */}
          {!isDesktop && (
            <div className="absolute bottom-44 right-4 z-10">
              <SymbolPalette
                selectedSymbolId={selectedSymbolId}
                onSelectSymbol={setSelectedSymbolId}
                isConnectingConduit={isConnectingConduit}
                onToggleConnectConduit={() => setIsConnectingConduit(!isConnectingConduit)}
              />
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
    </div>
  );
}

export default App;
