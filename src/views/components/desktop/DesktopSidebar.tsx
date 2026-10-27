/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: DesktopSidebar.tsx
 * Panel Lateral para Escritorio (CAD Inspector).
 * Orquestador modular que compone los paneles especializados de:
 * Arquitectura (muros, aberturas, estructura), Ambientes y Red Eléctrica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo } from 'react';
import { Building2, Compass, Zap } from 'lucide-react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { RelativeTurnType } from '../../../viewmodels/useSurveyViewModel';
import type { WallJustification } from '../../../models/architecture/Wall';
import type { SpaceAnchorPreset } from '../../../models/architecture/SpaceMoveEngine';
import { WallSurveyPanel } from './sidebar/WallSurveyPanel';
import { StructuralInspectorPanel } from './sidebar/StructuralInspectorPanel';
import { OpeningInspectorPanel } from './sidebar/OpeningInspectorPanel';
import { WallInspectorPanel } from './sidebar/WallInspectorPanel';
import { BulkWallEditPanel } from '../architecture/BulkWallEditPanel';
import { SpacesTabPanel } from './sidebar/SpacesTabPanel';
import { ElectricalTabPanel } from './sidebar/ElectricalTabPanel';

interface DesktopSidebarProps {
  relativeTurn: RelativeTurnType;
  onSelectTurn: (turn: RelativeTurnType) => void;
  customAngle: number;
  onChangeCustomAngle: (deg: number) => void;
  currentDistance: string;
  onChangeDistance: (val: string) => void;
  onCommitWall: () => void;
  selectedSymbolId: string | null;
  onSelectSymbol: (symbolId: string | null) => void;
  isConnectingConduit: boolean;
  onToggleConnectConduit: () => void;
  onOpenCircuits?: () => void;
  onOpenElectricalReport?: () => void;
  editingConduitRouteId?: string | null;
  onStartEditingConduitRoute?: (conduitId: string) => void;
  onFinishEditingConduitRoute?: () => void;
  onStartRedesigningConduitRoute?: (conduitId: string) => void;
  onUndoEditingConduitWaypoint?: () => void;
  wallJustification?: WallJustification;
  onChangeJustification?: (j: WallJustification) => void;
  onStartDrawingOverhang?: (spaceId: string) => void;
  onStartMovingSpace?: (spaceId: string, initialAnchorPreset?: SpaceAnchorPreset) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  relativeTurn,
  onSelectTurn,
  customAngle,
  onChangeCustomAngle,
  currentDistance,
  onChangeDistance,
  onCommitWall,
  selectedSymbolId,
  onSelectSymbol,
  isConnectingConduit,
  onToggleConnectConduit,
  onOpenCircuits,
  onOpenElectricalReport,
  editingConduitRouteId,
  onStartEditingConduitRoute,
  onFinishEditingConduitRoute,
  onStartRedesigningConduitRoute,
  onUndoEditingConduitWaypoint,
  wallJustification = 'interior',
  onChangeJustification,
  onStartDrawingOverhang,
  onStartMovingSpace
}) => {
  const {
    project,
    activeAnchorVertexId,
    selectedEntity,
    selectedEntities,
    clearSelection,
    batchUpdateWalls,
    batchUpdateWallLengths,
    batchDeleteWalls,
    selectedWallAnchorMode,
    setSelectedWallAnchorMode,
    addOpeningReferenced,
    addBranchWallFromOffset,
    updateWall,
    updateWallLength,
    rotateWall,
    invertWallDirection,
    deleteWall,
    undo,
    redo,
    canUndo,
    canRedo,
    setActiveAnchorVertexId,
    updateOpening,
    deleteOpening,
    updateSpace,
    resizeSpaceOrthogonal,
    autoDetectSpaces,
    addColumn,
    updateColumn,
    deleteColumn,
    addBeam,
    updateBeam,
    deleteBeam,
    setSelectedEntity
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'survey' | 'spaces' | 'electrical'>('survey');
  const [electricalSubTab, setElectricalSubTab] = useState<'network' | 'circuits' | 'panels'>('network');

  // Sincronización automática de pestaña activa según selección en lienzo
  const [prevSelectedEntityKey, setPrevSelectedEntityKey] = useState<string | null>(null);
  const currentSelectedEntityKey = selectedEntity ? `${selectedEntity.type}:${selectedEntity.id}` : null;
  if (currentSelectedEntityKey !== prevSelectedEntityKey) {
    setPrevSelectedEntityKey(currentSelectedEntityKey);
    if (selectedEntity?.type === 'space') {
      setActiveTab('spaces');
    } else if (
      selectedEntity?.type === 'wall' ||
      selectedEntity?.type === 'opening' ||
      selectedEntity?.type === 'column' ||
      selectedEntity?.type === 'beam'
    ) {
      setActiveTab('survey');
    } else if (selectedEntity?.type === 'electrical_element' || selectedEntity?.type === 'conduit') {
      setActiveTab('electrical');
      setElectricalSubTab('network');
    }
  }

  const verticesMap = useMemo(
    () => new Map(project.vertices.map((v) => [v.id, v])),
    [project.vertices]
  );
  const wallsMap = useMemo(
    () => new Map(project.walls.map((w) => [w.id, w])),
    [project.walls]
  );

  const selectedWalls = useMemo(
    () => project.walls.filter((w) => selectedEntities.some((se) => se.type === 'wall' && se.id === w.id)),
    [project.walls, selectedEntities]
  );

  const selectedWall = selectedEntity?.type === 'wall'
    ? project.walls.find((w) => w.id === selectedEntity.id) ?? null
    : null;
  const selectedOpening = selectedEntity?.type === 'opening'
    ? project.openings.find((o) => o.id === selectedEntity.id) ?? null
    : null;
  const selectedColumn = selectedEntity?.type === 'column'
    ? (project.columns || []).find((c) => c.id === selectedEntity.id) ?? null
    : null;
  const selectedBeam = selectedEntity?.type === 'beam'
    ? (project.beams || []).find((b) => b.id === selectedEntity.id) ?? null
    : null;

  const anchorVertex = activeAnchorVertexId
    ? project.vertices.find((v) => v.id === activeAnchorVertexId) ?? null
    : null;

  return (
    <aside className="w-80 h-full bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 select-none">
      {/* Selector de Pestañas Principales */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('survey')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'survey' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Trazado de muros, aberturas y elementos arquitectónicos"
        >
          <Building2 size={15} />
          <span>Arquitectura</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('spaces')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'spaces' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Gestión de ambientes, recintos y superficies"
        >
          <Compass size={15} />
          <span>Ambientes ({project.spaces.filter((s) => s.levelId === project.activeLevelId).length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('electrical')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'electrical' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Bocas, cañerías, circuitos y tableros eléctricos"
        >
          <Zap size={15} />
          <span>Instalaciones</span>
        </button>
      </div>

      {/* Contenido según pestaña activa */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* PESTAÑA 1: ARQUITECTURA / MUROS Y RELEVAMIENTO */}
        {activeTab === 'survey' && (
          <>
            <WallSurveyPanel
              anchorVertex={anchorVertex}
              verticesCount={project.vertices.length}
              currentDistance={currentDistance}
              onChangeDistance={onChangeDistance}
              wallJustification={wallJustification}
              onChangeJustification={onChangeJustification}
              relativeTurn={relativeTurn}
              onSelectTurn={onSelectTurn}
              customAngle={customAngle}
              onChangeCustomAngle={onChangeCustomAngle}
              onCommitWall={onCommitWall}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onQuickAddColumn={() => {
                const anchor = anchorVertex || { x: 0, y: 0 };
                const id = addColumn({
                  levelId: project.activeLevelId,
                  x: anchor.x,
                  y: anchor.y,
                  width: 0.20,
                  depth: 0.20,
                  rotationDeg: 0,
                  shape: 'rectangular',
                  material: 'concrete'
                });
                setSelectedEntity({ type: 'column', id });
              }}
              onQuickAddBeam={() => {
                const anchor = anchorVertex || { x: 0, y: 0 };
                const id = addBeam({
                  levelId: project.activeLevelId,
                  startX: anchor.x,
                  startY: anchor.y,
                  endX: anchor.x + 2.0,
                  endY: anchor.y,
                  width: 0.20,
                  dropHeightM: 0.40
                });
                setSelectedEntity({ type: 'beam', id });
              }}
            />

            {(selectedColumn || selectedBeam) && (
              <StructuralInspectorPanel
                selectedColumn={selectedColumn}
                selectedBeam={selectedBeam}
                onUpdateColumn={updateColumn}
                onDeleteColumn={deleteColumn}
                onUpdateBeam={updateBeam}
                onDeleteBeam={deleteBeam}
                onClearSelection={() => setSelectedEntity(null)}
              />
            )}

            {selectedOpening && (
              <OpeningInspectorPanel
                selectedOpening={selectedOpening}
                wallsMap={wallsMap}
                verticesMap={verticesMap}
                onUpdateOpening={updateOpening}
                onDeleteOpening={deleteOpening}
              />
            )}

            {selectedWalls.length > 1 ? (
              <BulkWallEditPanel
                selectedWalls={selectedWalls}
                verticesMap={verticesMap}
                onBatchUpdate={(updates) => batchUpdateWalls(selectedWalls.map((w) => w.id), updates)}
                onBatchUpdateLength={(targetLen, mode) =>
                  batchUpdateWallLengths(
                    selectedWalls.map((w) => w.id),
                    targetLen,
                    mode
                  )
                }
                onBatchDelete={() => batchDeleteWalls(selectedWalls.map((w) => w.id))}
                onDeselectAll={clearSelection}
              />
            ) : selectedWall ? (
              <WallInspectorPanel
                selectedWall={selectedWall}
                verticesMap={verticesMap}
                allOpenings={project.openings}
                selectedWallAnchorMode={selectedWallAnchorMode}
                onUpdateWall={updateWall}
                onUpdateWallLength={updateWallLength}
                onRotateWall={rotateWall}
                onInvertWallDirection={invertWallDirection}
                onDeleteWall={deleteWall}
                onSetWallAnchorMode={setSelectedWallAnchorMode}
                onSetActiveAnchorVertexId={setActiveAnchorVertexId}
                onAddOpeningReferenced={addOpeningReferenced}
                onDeleteOpening={deleteOpening}
                onAddBranchWallFromOffset={addBranchWallFromOffset}
              />
            ) : null}
          </>
        )}

        {/* PESTAÑA 2: AMBIENTES Y RECINTOS */}
        {activeTab === 'spaces' && (
          <SpacesTabPanel
            activeLevelSpaces={project.spaces.filter((s) => s.levelId === project.activeLevelId)}
            verticesMap={verticesMap}
            wallsMap={wallsMap}
            selectedSpaceId={selectedEntity?.type === 'space' ? selectedEntity.id : null}
            onSelectSpace={(id) => setSelectedEntity({ type: 'space', id })}
            onAutoDetectSpaces={autoDetectSpaces}
            onUpdateSpace={updateSpace}
            onResizeSpaceOrthogonal={resizeSpaceOrthogonal}
            onStartDrawingOverhang={onStartDrawingOverhang}
            onStartMovingSpace={onStartMovingSpace}
          />
        )}

        {/* PESTAÑA 3: INSTALACIONES ELÉCTRICAS */}
        {activeTab === 'electrical' && (
          <ElectricalTabPanel
            electricalSubTab={electricalSubTab}
            onChangeElectricalSubTab={setElectricalSubTab}
            onOpenCircuits={onOpenCircuits}
            onOpenElectricalReport={onOpenElectricalReport}
            selectedSymbolId={selectedSymbolId}
            onSelectSymbol={onSelectSymbol}
            isConnectingConduit={isConnectingConduit}
            onToggleConnectConduit={onToggleConnectConduit}
            editingConduitRouteId={editingConduitRouteId}
            onStartEditingConduitRoute={onStartEditingConduitRoute}
            onFinishEditingConduitRoute={onFinishEditingConduitRoute}
            onStartRedesigningConduitRoute={onStartRedesigningConduitRoute}
            onUndoEditingConduitWaypoint={onUndoEditingConduitWaypoint}
            verticesMap={verticesMap}
          />
        )}
      </div>
    </aside>
  );
};
