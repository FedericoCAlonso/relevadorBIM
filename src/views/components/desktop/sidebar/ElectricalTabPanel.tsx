import React, { useState, memo } from 'react';
import { Network, Server, GitFork, Zap } from 'lucide-react';
import { useProjectStore } from '../../../../viewmodels/useProjectStore';
import type { WallVertex } from '../../../../models/architecture/Wall';
import type { Panel } from '../../../../models/electrical/ElectricalModel';
import { SYMBOL_CATEGORIES, getSymbolsByCategory } from '../../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from '../../electrical/AeaSymbolIcon';
import { BulkEditPanel } from '../../electrical/BulkEditPanel';
import { CircuitsSubTabPanel } from './CircuitsSubTabPanel';
import { PanelsSubTabPanel } from './PanelsSubTabPanel';
import { ConduitInspectorPanel } from './ConduitInspectorPanel';
import { ElectricalElementInspectorPanel } from './ElectricalElementInspectorPanel';

interface ElectricalTabPanelProps {
  electricalSubTab: 'network' | 'circuits' | 'panels';
  onChangeElectricalSubTab: (tab: 'network' | 'circuits' | 'panels') => void;
  onOpenCircuits?: () => void;
  onOpenElectricalReport?: () => void;
  selectedSymbolId: string | null;
  onSelectSymbol: (symbolId: string | null) => void;
  isConnectingConduit: boolean;
  onToggleConnectConduit: () => void;
  editingConduitRouteId?: string | null;
  onStartEditingConduitRoute?: (conduitId: string) => void;
  onFinishEditingConduitRoute?: () => void;
  onStartRedesigningConduitRoute?: (conduitId: string) => void;
  onUndoEditingConduitWaypoint?: () => void;
  verticesMap: Map<string, WallVertex>;
}

export const ElectricalTabPanel: React.FC<ElectricalTabPanelProps> = memo(({
  electricalSubTab,
  onChangeElectricalSubTab,
  onOpenCircuits,
  onOpenElectricalReport,
  selectedSymbolId,
  onSelectSymbol,
  isConnectingConduit,
  onToggleConnectConduit,
  editingConduitRouteId,
  onStartEditingConduitRoute,
  onFinishEditingConduitRoute,
  onStartRedesigningConduitRoute,
  onUndoEditingConduitWaypoint,
  verticesMap
}) => {
  const { project, selectedEntity, selectedEntities } = useProjectStore();
  const [activeCategory, setActiveCategory] = useState<string>('iluminacion');
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);

  const selectedElectricalElement =
    selectedEntity?.type === 'electrical_element'
      ? project.electricalElements.find((e) => e.id === selectedEntity.id)
      : null;

  const selectedConduit =
    selectedEntity?.type === 'conduit'
      ? project.conduits.find((c) => c.id === selectedEntity.id)
      : null;

  const symbols = getSymbolsByCategory(activeCategory);

  const handleEditPanelFromCircuits = (panel: Panel) => {
    setEditingPanelId(panel.id);
    onChangeElectricalSubTab('panels');
  };

  return (
    <div className="space-y-3">
      {/* Sub-selector de instalaciones */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl text-xs">
        <button
          type="button"
          onClick={() => onChangeElectricalSubTab('network')}
          className={`py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            electricalSubTab === 'network'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Network size={13} className="text-blue-600" />
          <span>Bocas y Red</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeElectricalSubTab('circuits')}
          className={`py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            electricalSubTab === 'circuits'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitFork size={13} className="text-blue-600" />
          <span>Circuitos ({project.circuits.length})</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeElectricalSubTab('panels')}
          className={`py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            electricalSubTab === 'panels'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Server size={13} className="text-blue-600" />
          <span>Tableros ({project.panels.length})</span>
        </button>
      </div>

      {/* Sub-Pestaña: Circuitos */}
      {electricalSubTab === 'circuits' && (
        <CircuitsSubTabPanel
          onOpenCircuits={onOpenCircuits}
          onOpenElectricalReport={onOpenElectricalReport}
          onEditPanel={handleEditPanelFromCircuits}
        />
      )}

      {/* Sub-Pestaña: Tableros */}
      {electricalSubTab === 'panels' && (
        <PanelsSubTabPanel
          onOpenCircuits={onOpenCircuits}
          editingPanelId={editingPanelId}
          onSetEditingPanelId={setEditingPanelId}
          onAddCircuitForPanel={() => onChangeElectricalSubTab('circuits')}
        />
      )}

      {/* Sub-Pestaña: Bocas y Red */}
      {electricalSubTab === 'network' && (
        <div className="space-y-3">
          {/* Edición en Lote */}
          {selectedEntities.length > 1 && (
            <BulkEditPanel />
          )}

          {/* Inspector de Cañería */}
          {selectedEntities.length <= 1 && selectedConduit && (
            <ConduitInspectorPanel
              selectedConduit={selectedConduit}
              editingConduitRouteId={editingConduitRouteId}
              onStartEditingConduitRoute={onStartEditingConduitRoute}
              onFinishEditingConduitRoute={onFinishEditingConduitRoute}
              onStartRedesigningConduitRoute={onStartRedesigningConduitRoute}
              onUndoEditingConduitWaypoint={onUndoEditingConduitWaypoint}
            />
          )}

          {/* Inspector de Boca */}
          {selectedEntities.length <= 1 && selectedElectricalElement && (
            <ElectricalElementInspectorPanel
              selectedElectricalElement={selectedElectricalElement}
              verticesMap={verticesMap}
            />
          )}

          {/* Banner de ayuda si no hay selección */}
          {!selectedElectricalElement && !selectedConduit && selectedEntities.length <= 1 && (
            <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-500">
              Tocá una boca o una cañería en el plano para editar sus características, o elegí un símbolo abajo para emplazar.
            </div>
          )}

          {/* Trazar Cañería */}
          <button
            type="button"
            onClick={onToggleConnectConduit}
            className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isConnectingConduit
                ? 'bg-amber-600 border-amber-700 text-white animate-pulse shadow-md'
                : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100 shadow-xs'
            }`}
          >
            <Zap size={16} className={isConnectingConduit ? 'text-white' : 'text-amber-600'} />
            <span>{isConnectingConduit ? 'Tocá 2 bocas en el plano para unirlas' : 'Trazar Cañería entre Bocas'}</span>
          </button>

          {/* Categorías de Símbolos */}
          <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
            {SYMBOL_CATEGORIES.slice(0, 4).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                  activeCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Grilla de Símbolos AEA */}
          <div className="grid grid-cols-3 gap-2">
            {symbols.map((sym) => {
              const isSelected = selectedSymbolId === sym.id;
              return (
                <button
                  key={sym.id}
                  type="button"
                  onClick={() => onSelectSymbol(isSelected ? null : sym.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <AeaSymbolIcon symbolId={sym.id} size={28} />
                  <span className="text-[9px] font-medium text-slate-700 mt-1.5 truncate w-full text-center">
                    {sym.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
