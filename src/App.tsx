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
    deleteElectricalElement
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
          setSelectedEntity(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntity, undoLastWall, deleteWall, deleteOpening, deleteElectricalElement, setSelectedEntity, setSelectedSymbolId]);

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
        heightZ: isCeiling ? ceilingH : selectedSymbolId.includes('enchufe') || selectedSymbolId.includes('toma') ? 0.30 : 1.20,
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
          selectedSymbolId.includes('ts'),
        label,
        attributes: []
      });

      setSelectedEntity({ type: 'electrical_element', id: newElementId });
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
      />

      {/* Modal de Configuración General de Obra y Parámetros AEA */}
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
