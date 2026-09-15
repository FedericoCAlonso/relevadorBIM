/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA PRINCIPAL: App.tsx
 * Ensamblador de Vistas del Relevador BIM 2D y Red Eléctrica AEA 90364.
 * Arquitectura MVVM desacoplada con lienzo CAD y controles de obra.
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
    activeSpaceId,
    setSelectedEntity,
    createInitialRoom,
    addOpening,
    addElectricalElement
  } = useProjectStore();

  const {
    activeTool,
    setActiveTool,
    selectedSymbolId,
    setSelectedSymbolId,
    handleElectricalElementClick
  } = useSurveyViewModel();

  const [showInitialRoomModal, setShowInitialRoomModal] = useState(false);
  const [showComputoModal, setShowComputoModal] = useState(false);

  // Inicializar con un ambiente demostrativo si el proyecto está en blanco
  useEffect(() => {
    if (project.walls.length === 0) {
      createInitialRoom({
        name: 'Living Comedor',
        width: 4.50,
        length: 5.00,
        wallThickness: 0.15
      });
    }
  }, []);

  // Agregar una puerta por defecto sobre el muro este una vez creado el ambiente
  useEffect(() => {
    if (project.walls.length === 4 && project.openings.length === 0) {
      const eastWall = project.walls[1]; // Muro lateral derecho
      if (eastWall) {
        addOpening({
          id: `open-${Date.now()}`,
          wallId: eastWall.id,
          type: 'door',
          width: 0.80,
          height: 2.05,
          sill: 0.0,
          distanceAlongWall: 1.20,
          swing: 'left_in',
          label: 'P1'
        });
      }
    }
  }, [project.walls.length]);

  // Manejo de clic sobre el lienzo
  const handleCanvasClick = (worldX: number, worldY: number) => {
    // Si hay un símbolo seleccionado en la paleta, colocarlo en esa coordenada
    if (selectedSymbolId) {
      const symDef = getSymbolById(selectedSymbolId);
      const isCeiling = selectedSymbolId.includes('techo') || selectedSymbolId.includes('ventilador');
      const isWall = selectedSymbolId.includes('enchufe') || selectedSymbolId.includes('interruptor') || selectedSymbolId.includes('tablero');

      addElectricalElement({
        id: `el-${Date.now()}`,
        symbolId: selectedSymbolId,
        levelId: project.activeLevelId,
        spaceId: activeSpaceId || project.spaces[0]?.id || 'default-space',
        placement: isCeiling ? 'ceiling' : isWall ? 'wall' : 'floor',
        x: worldX,
        y: worldY,
        heightZ: isCeiling ? 2.70 : selectedSymbolId.includes('enchufe') ? 0.30 : 1.20,
        label: symDef?.label?.substring(0, 4) || 'Boca'
      });

      // Resetear símbolo para permitir selección normal
      setSelectedSymbolId(null);
    } else {
      setSelectedEntity(null);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 flex flex-col font-sans">
      {/* 1. Barra de Herramientas y Distanciómetro Láser */}
      <QuickMeasureBar
        onAddRoomClick={() => setShowInitialRoomModal(true)}
        onViewComputoClick={() => setShowComputoModal(true)}
      />

      {/* 2. Lienzo Gráfico CAD BIM 2D */}
      <main className="flex-1 w-full h-full">
        <BimCanvas
          onWallClick={(wallId) => setSelectedEntity({ type: 'wall', id: wallId })}
          onOpeningClick={(openingId) => setSelectedEntity({ type: 'opening', id: openingId })}
          onSpaceClick={(spaceId) => setSelectedEntity({ type: 'space', id: spaceId })}
          onElectricalElementClick={handleElectricalElementClick}
          onCanvasClick={handleCanvasClick}
        />
      </main>

      {/* 3. Diálogos Contextuales de Relevamiento (Acople por Jamba, Empalme en T) */}
      <SurveyActionSheets
        showInitialRoomModal={showInitialRoomModal}
        onCloseInitialRoomModal={() => setShowInitialRoomModal(false)}
      />

      {/* 4. Paleta de Símbolos AEA 90364 */}
      <SymbolPalette
        selectedSymbolId={selectedSymbolId}
        onSelectSymbol={setSelectedSymbolId}
        isConnectingConduit={activeTool === 'connect_conduit'}
        onToggleConnectConduit={() =>
          setActiveTool(activeTool === 'connect_conduit' ? 'select' : 'connect_conduit')
        }
      />

      {/* 5. Modal de Cómputo Métrico / Cotizador IEBA */}
      <ComputoModal
        isOpen={showComputoModal}
        onClose={() => setShowComputoModal(false)}
      />
    </div>
  );
}

export default App;
