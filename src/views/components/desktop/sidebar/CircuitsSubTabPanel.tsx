import React, { useState, memo } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import {
  CIRCUIT_TYPE_OPTIONS,
  DEFAULT_CIRCUIT_COLOR,
  CABLE_QUICK_SECTIONS,
  BREAKER_AMPERAGE_PRESETS,
  AEA_MINIMUM_WIRE_SECTIONS_MM2
} from '../../../../config';
import { useProjectStore } from '../../../../viewmodels/useProjectStore';
import type { CircuitType, Panel } from '../../../../models/electrical/ElectricalModel';
import { CircuitColorPicker } from '../../electrical/CircuitColorPicker';

interface CircuitsSubTabPanelProps {
  onOpenCircuits?: () => void;
  onOpenElectricalReport?: () => void;
  onEditPanel?: (panel: Panel) => void;
}

export const CircuitsSubTabPanel: React.FC<CircuitsSubTabPanelProps> = memo(({
  onOpenCircuits,
  onOpenElectricalReport,
  onEditPanel
}) => {
  const {
    project,
    addCircuit,
    updateCircuit,
    deleteCircuit,
    ensureDefaultCircuits
  } = useProjectStore();

  const [isCreatingCircuit, setIsCreatingCircuit] = useState(false);
  const [editingCircuitColorId, setEditingCircuitColorId] = useState<string | null>(null);
  const [newCircuitName, setNewCircuitName] = useState('');
  const [newCircuitType, setNewCircuitType] = useState<CircuitType>('IUG');
  const [newCircuitWire, setNewCircuitWire] = useState(AEA_MINIMUM_WIRE_SECTIONS_MM2.IUG);
  const [newCircuitBreaker, setNewCircuitBreaker] = useState(CIRCUIT_TYPE_OPTIONS[0].defaultBreakerA);
  const [newCircuitColor, setNewCircuitColor] = useState(DEFAULT_CIRCUIT_COLOR);
  const [newCircuitPanelId, setNewCircuitPanelId] = useState('');
  const [newCircuitTargetPanelId, setNewCircuitTargetPanelId] = useState('');

  const handleStartCreateCircuit = (panelId?: string) => {
    setIsCreatingCircuit(true);
    setNewCircuitName(`C${project.circuits.length + 1} - `);
    setNewCircuitPanelId(panelId || project.panels[0]?.id || 'pan-principal');
    setNewCircuitTargetPanelId('');
  };

  const handleSaveNewCircuit = () => {
    if (!newCircuitName.trim()) return;
    const assignedPanelId = newCircuitPanelId || project.panels[0]?.id || 'pan-principal';
    addCircuit({
      id: `circ-${Date.now()}`,
      panelId: assignedPanelId,
      targetPanelId:
        (newCircuitType === 'LP' || newCircuitType === 'LS') && newCircuitTargetPanelId
          ? newCircuitTargetPanelId
          : null,
      name: newCircuitName.trim(),
      type: newCircuitType,
      voltageV: 220,
      wireSectionBaseMM2: newCircuitWire,
      breakerAmperageA: newCircuitBreaker,
      color: newCircuitColor
    });
    setIsCreatingCircuit(false);
    setNewCircuitName('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
          Circuitos por Tablero
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
          {onOpenElectricalReport && (
            <button
              type="button"
              onClick={onOpenElectricalReport}
              className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              title="Ver Memoria de Cálculo y Cuadro de Cargas AEA"
            >
              <Zap size={11} className="text-amber-500" />
              <span>Memoria</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleStartCreateCircuit()}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={12} />
            <span>Nuevo Circuito</span>
          </button>
        </div>
      </div>

      {/* Si no hay circuitos, botón de inicialización rápida */}
      {project.circuits.length === 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-center space-y-2">
          <p className="text-xs font-medium text-blue-900">
            No hay circuitos definidos en este proyecto.
          </p>
          <button
            type="button"
            onClick={ensureDefaultCircuits}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Crear Circuitos Estándar (IUG, TUG, TUE)
          </button>
        </div>
      )}

      {/* Formulario para nuevo circuito */}
      {isCreatingCircuit && (
        <div className="p-3 bg-white border-2 border-blue-500 rounded-2xl space-y-2.5 shadow-md animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-1.5">
            <span className="text-xs font-bold text-blue-950">Nuevo Circuito Eléctrico</span>
            <button
              type="button"
              onClick={() => setIsCreatingCircuit(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">NOMBRE / DESIGNACIÓN</label>
            <input
              type="text"
              value={newCircuitName}
              onChange={(e) => setNewCircuitName(e.target.value)}
              placeholder="Ej: C4 - ACU Climatización"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO AEA</label>
              <select
                value={newCircuitType}
                onChange={(e) => setNewCircuitType(e.target.value as CircuitType)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {CIRCUIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">TABLERO CABECERA</label>
              <select
                value={newCircuitPanelId || project.panels[0]?.id || 'pan-principal'}
                onChange={(e) => setNewCircuitPanelId(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {project.panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Si es Línea Principal o Seccional: selector de tablero receptor alimentado */}
          {(newCircuitType === 'LP' || newCircuitType === 'LS') && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <label className="text-[10px] font-bold text-amber-900 block">
                TABLERO RECEPTOR ALIMENTADO
              </label>
              <select
                value={newCircuitTargetPanelId}
                onChange={(e) => setNewCircuitTargetPanelId(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-950"
              >
                <option value="">(Ninguno / Conexión exterior)</option>
                {project.panels
                  .filter((p) => p.id !== (newCircuitPanelId || project.panels[0]?.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      ↳ {p.name} ({p.type})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">SECCIÓN CABLE</label>
              <select
                value={newCircuitWire}
                onChange={(e) => setNewCircuitWire(parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
              >
                {CABLE_QUICK_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec.toFixed(1)} mm²
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">TERMOMAGNÉTICA</label>
              <select
                value={newCircuitBreaker}
                onChange={(e) => setNewCircuitBreaker(parseInt(e.target.value, 10))}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
              >
                {BREAKER_AMPERAGE_PRESETS.map((amp) => (
                  <option key={amp} value={amp}>
                    {amp} A
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">COLOR EN PLANO</label>
            <CircuitColorPicker
              selectedColor={newCircuitColor}
              onChangeColor={setNewCircuitColor}
              size="sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t">
            <button
              type="button"
              onClick={() => setIsCreatingCircuit(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveNewCircuit}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Guardar Circuito
            </button>
          </div>
        </div>
      )}

      {/* Lista de Circuitos Agrupados por Tablero */}
      <div className="space-y-3">
        {project.panels.map((panel) => {
          const panelCircuits = project.circuits.filter(
            (c) => (c.panelId || project.panels[0]?.id) === panel.id
          );

          return (
            <div key={panel.id} className="space-y-1.5">
              {/* Cabecera del Tablero */}
              <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] font-bold text-slate-800 truncate">
                    🗄️ {panel.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white text-slate-700 border border-slate-200 uppercase">
                    {panel.type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({panelCircuits.length})
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onEditPanel && (
                    <button
                      type="button"
                      onClick={() => onEditPanel(panel)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors cursor-pointer"
                      title="Editar propiedades de este tablero"
                    >
                      ✎ Tablero
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartCreateCircuit(panel.id)}
                    className="px-1.5 py-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                    title="Agregar circuito a este tablero"
                  >
                    ＋ Circuito
                  </button>
                </div>
              </div>

              {panelCircuits.length === 0 && (
                <p className="text-[11px] text-slate-400 italic px-2 py-0.5">
                  Sin circuitos asignados.
                </p>
              )}

              {panelCircuits.map((circ) => {
                const bocasCount = project.electricalElements.filter(
                  (e) => !e.isPanel && !e.isTerminalReference && e.symbolId !== 'sym-terminal-referencia' && e.circuitId === circ.id
                ).length;
                const isOverloaded = (circ.type === 'IUG' || circ.type === 'TUG') && bocasCount > 15;
                const targetPanel = circ.targetPanelId
                  ? project.panels.find((p) => p.id === circ.targetPanelId)
                  : null;

                return (
                  <div
                    key={circ.id}
                    className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl space-y-1.5 shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <button
                          type="button"
                          onClick={() => setEditingCircuitColorId(editingCircuitColorId === circ.id ? null : circ.id)}
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white hover:scale-110 transition-transform cursor-pointer ring-1 ring-slate-300"
                          style={{ backgroundColor: circ.color || DEFAULT_CIRCUIT_COLOR }}
                          title="Cambiar color del circuito en plano"
                        />
                        <span className="font-bold text-xs text-slate-900 truncate">{circ.name}</span>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-700 shrink-0">
                          {circ.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCircuit(circ.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Eliminar circuito"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {targetPanel && (
                      <p className="text-[10px] text-amber-700 font-medium">
                        ↳ Alimenta a: <strong>{targetPanel.name}</strong>
                      </p>
                    )}

                    {editingCircuitColorId === circ.id && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500">Color del circuito en plano:</span>
                          <button
                            type="button"
                            onClick={() => setEditingCircuitColorId(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <CircuitColorPicker
                          selectedColor={circ.color || DEFAULT_CIRCUIT_COLOR}
                          onChangeColor={(color) => {
                            updateCircuit(circ.id, { color });
                          }}
                          size="sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span>
                        TM: <strong>{circ.breakerAmperageA || 16}A</strong> · Cable: <strong>{circ.wireSectionBaseMM2 || 2.5} mm²</strong>
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isOverloaded
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {bocasCount} bocas {isOverloaded && '(>15)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
