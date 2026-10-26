import React, { useState, memo } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import {
  PANEL_TYPE_OPTIONS,
  AEA_GRID_CONSTANTS,
  BREAKER_AMPERAGE_PRESETS
} from '../../../../config';
import { useProjectStore } from '../../../../viewmodels/useProjectStore';
import type { Panel, PanelType } from '../../../../models/electrical/ElectricalModel';
import { countPanelBocas } from '../../../../models/electrical/electricalBranch';

interface PanelFormProps {
  panel?: Panel | null;
  defaultName: string;
  onCancel: () => void;
  onSave: (data: {
    name: string;
    type: PanelType;
    isThreePhase: boolean;
    breakerA: number;
    diffA: number;
  }) => void;
}

const PanelForm: React.FC<PanelFormProps> = ({
  panel,
  defaultName,
  onCancel,
  onSave
}) => {
  const [panelName, setPanelName] = useState(panel ? panel.name : defaultName);
  const [panelType, setPanelType] = useState<PanelType>(panel ? panel.type : 'seccional');
  const [panelIsThreePhase, setPanelIsThreePhase] = useState<boolean>(panel?.isThreePhase ?? false);
  const [panelBreakerA, setPanelBreakerA] = useState<number>(panel?.mainBreakerAmperageA || 25);
  const [panelDiffA, setPanelDiffA] = useState<number>(panel?.mainDifferentialAmperageA || 25);

  const handleSubmit = () => {
    if (!panelName.trim()) return;
    onSave({
      name: panelName.trim(),
      type: panelType,
      isThreePhase: panelIsThreePhase,
      breakerA: panelBreakerA,
      diffA: panelDiffA
    });
  };

  return (
    <div className="p-3 bg-white border-2 border-blue-500 rounded-2xl space-y-2.5 shadow-md animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b pb-1.5">
        <span className="text-xs font-bold text-blue-950">
          {panel ? 'Modificar Tablero' : 'Nuevo Tablero'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-500 block mb-1">NOMBRE / DESIGNACIÓN</label>
        <input
          type="text"
          value={panelName}
          onChange={(e) => setPanelName(e.target.value)}
          placeholder="Ej: Tablero Seccional Planta Alta (TS-PA)"
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO</label>
          <select
            value={panelType}
            onChange={(e) => setPanelType(e.target.value as PanelType)}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
          >
            {PANEL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">RED</label>
          <select
            value={panelIsThreePhase ? String(AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_THREE_PHASE) : String(AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_SINGLE_PHASE)}
            onChange={(e) => setPanelIsThreePhase(e.target.value === String(AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_THREE_PHASE))}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
          >
            <option value={String(AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_SINGLE_PHASE)}>
              Monofásico ({AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_SINGLE_PHASE}V)
            </option>
            <option value={String(AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_THREE_PHASE)}>
              Trifásico ({AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_THREE_PHASE}V)
            </option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">TERMOMAGNÉTICA CABECERA</label>
          <select
            value={panelBreakerA}
            onChange={(e) => setPanelBreakerA(parseInt(e.target.value, 10))}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
          >
            {BREAKER_AMPERAGE_PRESETS.map((amp) => (
              <option key={amp} value={amp}>{amp} A</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1">DISYUNTOR DIFERENCIAL</label>
          <select
            value={panelDiffA}
            onChange={(e) => setPanelDiffA(parseInt(e.target.value, 10))}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
          >
            {BREAKER_AMPERAGE_PRESETS.map((amp) => (
              <option key={amp} value={amp}>{amp} A</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
        >
          {panel ? 'Actualizar' : 'Guardar Tablero'}
        </button>
      </div>
    </div>
  );
};

interface PanelsSubTabPanelProps {
  onOpenCircuits?: () => void;
  onAddCircuitForPanel?: (panelId: string) => void;
  editingPanelId?: string | null;
  onSetEditingPanelId?: (id: string | null) => void;
}

export const PanelsSubTabPanel: React.FC<PanelsSubTabPanelProps> = memo(({
  onOpenCircuits,
  onAddCircuitForPanel,
  editingPanelId: externalEditingPanelId,
  onSetEditingPanelId
}) => {
  const {
    project,
    addPanel,
    updatePanel,
    deletePanel
  } = useProjectStore();

  const [isCreatingPanel, setIsCreatingPanel] = useState(false);
  const [internalEditingPanelId, setInternalEditingPanelId] = useState<string | null>(null);
  const editingPanelId = externalEditingPanelId !== undefined ? externalEditingPanelId : internalEditingPanelId;

  const setEditingId = (id: string | null) => {
    if (onSetEditingPanelId) {
      onSetEditingPanelId(id);
    } else {
      setInternalEditingPanelId(id);
    }
  };

  const editingPanel = editingPanelId ? project.panels.find((p) => p.id === editingPanelId) ?? null : null;

  const handleStartCreatePanel = () => {
    setIsCreatingPanel(true);
    setEditingId(null);
  };

  const handleSavePanel = (data: {
    name: string;
    type: PanelType;
    isThreePhase: boolean;
    breakerA: number;
    diffA: number;
  }) => {
    if (isCreatingPanel) {
      addPanel({
        id: `pan-${Date.now()}`,
        name: data.name,
        type: data.type,
        levelId: project.activeLevelId || project.levels[0]?.id || 'level-1',
        spaceId: 'espacio-principal',
        x: 0,
        y: 0,
        heightZ: 1.40,
        isPlaced: false,
        symbolId: data.type === 'principal' ? 'sym-planta-tablero-principal' : 'sym-planta-tablero-seccional',
        isThreePhase: data.isThreePhase,
        mainBreakerAmperageA: data.breakerA,
        mainDifferentialAmperageA: data.diffA,
        hasEarthBar: true,
        incomings: [
          {
            id: `inc-${Date.now()}-1`,
            sourceType: data.type === 'principal' ? 'grid_meter' : 'upstream_panel',
            name: data.type === 'principal' ? 'Acometida Red (Distribuidora)' : 'Alimentador Seccional',
            voltageV: data.isThreePhase ? 380 : 220,
            phases: data.isThreePhase ? 3 : 1,
            mainBreakerAmperageA: data.breakerA,
            mainDifferentialAmperageA: data.diffA,
            isDefaultActive: true
          }
        ]
      });
    } else if (editingPanelId) {
      updatePanel(editingPanelId, {
        name: data.name,
        type: data.type,
        isThreePhase: data.isThreePhase,
        mainBreakerAmperageA: data.breakerA,
        mainDifferentialAmperageA: data.diffA
      });
    }
    setIsCreatingPanel(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
          Tableros Eléctricos ({project.panels.length})
        </span>
        <div className="flex items-center gap-1">
          {onOpenCircuits && (
            <button
              type="button"
              onClick={onOpenCircuits}
              className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Abrir ventana modal completa de Circuitos y Tableros"
            >
              ⛶ Extendido
            </button>
          )}
          <button
            type="button"
            onClick={handleStartCreatePanel}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={12} />
            <span>Nuevo Tablero</span>
          </button>
        </div>
      </div>

      {/* Formulario Crear / Editar Tablero */}
      {(isCreatingPanel || editingPanel) && (
        <PanelForm
          key={editingPanel ? editingPanel.id : 'new-panel'}
          panel={editingPanel}
          defaultName={`Tablero Seccional ${project.panels.length} (TS${project.panels.length})`}
          onCancel={() => {
            setIsCreatingPanel(false);
            setEditingId(null);
          }}
          onSave={handleSavePanel}
        />
      )}

      {/* Lista de Tableros en Escritorio */}
      <div className="space-y-2">
        {project.panels.map((p) => {
          const circuitsFed = project.circuits.filter((c) => c.panelId === p.id);
          const totalBocas = countPanelBocas(p.id, project.electricalElements, project.circuits, project.conduits);
          const feederCircuit = project.circuits.find(
            (c) => c.targetPanelId === p.id && (c.type === 'LP' || c.type === 'LS')
          );
          const feederPanel = feederCircuit
            ? project.panels.find((parent) => parent.id === feederCircuit.panelId)
            : null;

          return (
            <div
              key={p.id}
              className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2 shadow-xs transition-all"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="space-y-0.5 truncate">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-900">
                      🗄️ {p.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        p.type === 'principal'
                          ? 'bg-blue-100 text-blue-800'
                          : p.type === 'seccional'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {p.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {p.isThreePhase ? '380V' : '220V'}
                    </span>
                  </div>
                  {feederCircuit && feederPanel && (
                    <p className="text-[10px] text-amber-700">
                      ↳ Alimentado por {feederCircuit.name} desde {feederPanel.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id);
                      setIsCreatingPanel(false);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                    title="Editar propiedades de este tablero"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={project.panels.length <= 1}
                    onClick={() => {
                      if (project.panels.length <= 1) {
                        alert('No se puede eliminar el único tablero principal del proyecto.');
                        return;
                      }
                      if (window.confirm(`¿Eliminar tablero "${p.name}"? Sus circuitos se reasignarán al tablero principal.`)) {
                        deletePanel(p.id);
                        if (editingPanelId === p.id) setEditingId(null);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400 rounded cursor-pointer"
                    title={
                      project.panels.length <= 1
                        ? 'No se puede eliminar el único tablero'
                        : 'Eliminar tablero'
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-100 font-mono">
                <span className="text-slate-500 font-sans">
                  {p.type === 'principal' ? 'Cabecera de Instalación' : 'Subtablero Seccional'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                    {circuitsFed.length} circ ({totalBocas} bocas)
                  </span>
                  {onAddCircuitForPanel && (
                    <button
                      type="button"
                      onClick={() => onAddCircuitForPanel(p.id)}
                      className="font-bold text-blue-600 hover:underline cursor-pointer font-sans"
                    >
                      ＋ Circ
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
