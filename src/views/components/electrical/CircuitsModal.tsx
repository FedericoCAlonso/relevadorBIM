/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: CircuitsModal.tsx (Patrón Estricto MVVM)
 * Modal / Bottom Sheet táctil optimizado para móvil y escritorio.
 * Permite gestionar Circuitos y Tableros Eléctricos:
 * 1. Pestaña Circuitos: crear, editar, borrar, colores, térmicas y presets AEA.
 * 2. Pestaña Tableros: crear nuevos tableros (TP, TS, TS-PA, T-FM), editarlos,
 *    configurar termomagnéticas y diferenciales de cabecera, y borrarlos con reasignación segura.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { Circuit, CircuitType, Panel } from '../../../models/electrical/ElectricalModel';
import { CircuitColorPicker } from './CircuitColorPicker';
import {
  CIRCUIT_COLOR_PALETTE,
  AEA_CALCULATION_CONSTANTS
} from '../../../models/electrical/electricalStandards';
import {
  Layers,
  Plus,
  Trash2,
  X,
  Zap,
  Check,
  Edit2,
  Server,
  ArrowRight
} from 'lucide-react';

interface CircuitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CIRCUIT_PRESETS: Array<{
  type: CircuitType;
  label: string;
  defaultName: string;
  wireMM2: number;
  breakerA: number;
  color: string;
  desc: string;
}> = [
  {
    type: 'IUG',
    label: 'IUG',
    defaultName: 'Iluminación Uso General',
    wireMM2: 1.5,
    breakerA: 10,
    color: '#2563eb',
    desc: 'Iluminación fija (máx 15 bocas)'
  },
  {
    type: 'TUG',
    label: 'TUG',
    defaultName: 'Tomas Uso General',
    wireMM2: 2.5,
    breakerA: 16,
    color: '#ea580c',
    desc: 'Tomacorrientes estándar 10A (máx 15 bocas)'
  },
  {
    type: 'TUE',
    label: 'TUE',
    defaultName: 'Tomas Especiales',
    wireMM2: 2.5,
    breakerA: 20,
    color: '#16a34a',
    desc: 'Tomacorrientes 20A / Intemperie'
  },
  {
    type: 'ACU',
    label: 'ACU',
    defaultName: 'Climatización / Aire',
    wireMM2: 4.0,
    breakerA: 20,
    color: '#0891b2',
    desc: 'Alimentación individual aire acondicionado'
  },
  {
    type: 'FM',
    label: 'FM',
    defaultName: 'Fuerza Motriz / Bombas',
    wireMM2: 4.0,
    breakerA: 25,
    color: '#8b5cf6',
    desc: 'Bombas elevadoras, portones y motores'
  },
  {
    type: 'LP',
    label: 'LP',
    defaultName: 'Línea Principal (Alimentador)',
    wireMM2: 6.0,
    breakerA: 32,
    color: '#b91c1c',
    desc: 'Alimentación troncal de tablero'
  },
  {
    type: 'LS',
    label: 'LS',
    defaultName: 'Línea Seccional (Subtablero)',
    wireMM2: 4.0,
    breakerA: 25,
    color: '#c2410c',
    desc: 'Alimentación seccional entre tableros'
  },
  {
    type: 'OTRO',
    label: 'OTRO',
    defaultName: 'Circuito Especial',
    wireMM2: 2.5,
    breakerA: 16,
    color: '#475569',
    desc: 'Circuito de uso específico'
  }
];

const PANEL_PRESETS: Array<{
  label: string;
  name: string;
  type: 'principal' | 'seccional' | 'auxiliar';
  isThreePhase: boolean;
  breakerA: number;
  diffA: number;
  desc: string;
}> = [
  {
    label: 'TP Mono 32A',
    name: 'Tablero Principal (TP)',
    type: 'principal',
    isThreePhase: false,
    breakerA: 32,
    diffA: 40,
    desc: 'Tablero principal cabecera monofásico 220V'
  },
  {
    label: 'TP Trifásico 40A',
    name: 'Tablero Principal (TP)',
    type: 'principal',
    isThreePhase: true,
    breakerA: 40,
    diffA: 40,
    desc: 'Tablero principal cabecera trifásico 380V'
  },
  {
    label: 'TS Seccional 25A',
    name: 'Tablero Seccional (TS)',
    type: 'seccional',
    isThreePhase: false,
    breakerA: 25,
    diffA: 25,
    desc: 'Subtablero seccional interior'
  },
  {
    label: 'TS Planta Alta',
    name: 'Tablero Seccional Planta Alta (TS-PA)',
    type: 'seccional',
    isThreePhase: false,
    breakerA: 25,
    diffA: 25,
    desc: 'Subtablero seccional para nivel superior'
  },
  {
    label: 'T-FM Bombas',
    name: 'Tablero Fuerza Motriz (T-FM)',
    type: 'auxiliar',
    isThreePhase: true,
    breakerA: 25,
    diffA: 40,
    desc: 'Tablero de bombas y motores trifásicos'
  }
];

export const CircuitsModal: React.FC<CircuitsModalProps> = ({ isOpen, onClose }) => {
  const {
    project,
    addCircuit,
    updateCircuit,
    deleteCircuit,
    ensureDefaultCircuits,
    addPanel,
    updatePanel,
    deletePanel
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'circuits' | 'panels'>('circuits');

  // Estado formulario Circuitos
  const [isCreating, setIsCreating] = useState(false);
  const [editingCircuitId, setEditingCircuitId] = useState<string | null>(null);
  const [editingColorCircuitId, setEditingColorCircuitId] = useState<string | null>(null);
  const [circuitName, setCircuitName] = useState('');
  const [circuitType, setCircuitType] = useState<CircuitType>('IUG');
  const [wireSection, setWireSection] = useState<number>(1.5);
  const [breakerAmperage, setBreakerAmperage] = useState<number>(10);
  const [circuitColor, setCircuitColor] = useState<string>('#2563eb');
  const [panelId, setPanelId] = useState<string>('');
  const [targetPanelId, setTargetPanelId] = useState<string>('');

  // Estado formulario Tableros
  const [isCreatingPanel, setIsCreatingPanel] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [panelName, setPanelName] = useState('');
  const [panelType, setPanelType] = useState<'principal' | 'seccional' | 'auxiliar'>('seccional');
  const [panelIsThreePhase, setPanelIsThreePhase] = useState(false);
  const [panelBreakerA, setPanelBreakerA] = useState<number>(25);
  const [panelDiffA, setPanelDiffA] = useState<number>(25);

  if (!isOpen) return null;

  const defaultPanelId = project.panels[0]?.id || 'pan-principal';

  // ─── ACCIONES DE CIRCUITOS ───
  const handleApplyPreset = (preset: (typeof CIRCUIT_PRESETS)[0]) => {
    setCircuitType(preset.type);
    setCircuitName(`C${project.circuits.length + 1} - ${preset.defaultName}`);
    setWireSection(preset.wireMM2);
    setBreakerAmperage(preset.breakerA);
    setCircuitColor(preset.color);
  };

  const handleStartCreate = (preferredPanelId?: string) => {
    const nextIdx = project.circuits.length + 1;
    setCircuitName(`C${nextIdx} - `);
    setCircuitType('TUG');
    setWireSection(2.5);
    setBreakerAmperage(16);
    setCircuitColor(CIRCUIT_COLOR_PALETTE[(nextIdx - 1) % CIRCUIT_COLOR_PALETTE.length].hex);
    setPanelId(preferredPanelId || defaultPanelId);
    setTargetPanelId('');
    setIsCreating(true);
    setEditingCircuitId(null);
    setActiveTab('circuits');
  };

  const handleSaveNewCircuit = () => {
    if (!circuitName.trim()) return;

    const newCirc: Circuit = {
      id: `circ-${Date.now()}`,
      panelId: panelId || defaultPanelId,
      targetPanelId:
        (circuitType === 'LP' || circuitType === 'LS') && targetPanelId ? targetPanelId : null,
      name: circuitName.trim(),
      type: circuitType,
      voltageV: AEA_CALCULATION_CONSTANTS.VOLTAGE_SINGLE_PHASE_V,
      wireSectionBaseMM2: wireSection,
      breakerAmperageA: breakerAmperage,
      color: circuitColor
    };

    addCircuit(newCirc);
    setIsCreating(false);
    setCircuitName('');
  };

  const handleStartEdit = (circ: Circuit) => {
    setEditingCircuitId(circ.id);
    setCircuitName(circ.name);
    setCircuitType(circ.type);
    setWireSection(circ.wireSectionBaseMM2 || 2.5);
    setBreakerAmperage(circ.breakerAmperageA || 16);
    setCircuitColor(circ.color || '#2563eb');
    setPanelId(circ.panelId || defaultPanelId);
    setTargetPanelId(circ.targetPanelId || '');
    setIsCreating(false);
    setActiveTab('circuits');
  };

  const handleSaveEdit = (circId: string) => {
    if (!circuitName.trim()) return;
    updateCircuit(circId, {
      name: circuitName.trim(),
      type: circuitType,
      panelId: panelId || defaultPanelId,
      targetPanelId:
        (circuitType === 'LP' || circuitType === 'LS') && targetPanelId ? targetPanelId : null,
      wireSectionBaseMM2: wireSection,
      breakerAmperageA: breakerAmperage,
      color: circuitColor
    });
    setEditingCircuitId(null);
  };

  // ─── ACCIONES DE TABLEROS ───
  const handleStartCreatePanel = (suggestedType: 'principal' | 'seccional' | 'auxiliar' = 'seccional') => {
    const nextIdx = project.panels.length;
    const isPrincipal = suggestedType === 'principal';
    setPanelName(isPrincipal ? 'Tablero Principal (TP)' : `Tablero Seccional ${nextIdx} (TS${nextIdx})`);
    setPanelType(suggestedType);
    setPanelIsThreePhase(false);
    setPanelBreakerA(isPrincipal ? 32 : 25);
    setPanelDiffA(isPrincipal ? 40 : 25);
    setIsCreatingPanel(true);
    setEditingPanelId(null);
    setActiveTab('panels');
  };

  const handleApplyPanelPreset = (preset: (typeof PANEL_PRESETS)[0]) => {
    setPanelName(preset.name);
    setPanelType(preset.type);
    setPanelIsThreePhase(preset.isThreePhase);
    setPanelBreakerA(preset.breakerA);
    setPanelDiffA(preset.diffA);
  };

  const handleSaveNewPanel = () => {
    if (!panelName.trim()) return;
    const newPanel: Panel = {
      id: `pan-${Date.now()}`,
      name: panelName.trim(),
      type: panelType,
      levelId: project.activeLevelId || project.levels[0]?.id || 'level-1',
      spaceId: 'espacio-principal',
      elementId: '',
      isThreePhase: panelIsThreePhase,
      mainBreakerAmperageA: panelBreakerA,
      mainDifferentialAmperageA: panelDiffA
    };
    addPanel(newPanel);
    setIsCreatingPanel(false);
    setPanelName('');
  };

  const handleStartEditPanel = (p: Panel) => {
    setEditingPanelId(p.id);
    setPanelName(p.name);
    setPanelType(p.type);
    setPanelIsThreePhase(p.isThreePhase);
    setPanelBreakerA(p.mainBreakerAmperageA || 25);
    setPanelDiffA(p.mainDifferentialAmperageA || 25);
    setIsCreatingPanel(false);
    setActiveTab('panels');
  };

  const handleSaveEditPanel = (pId: string) => {
    if (!panelName.trim()) return;
    updatePanel(pId, {
      name: panelName.trim(),
      type: panelType,
      isThreePhase: panelIsThreePhase,
      mainBreakerAmperageA: panelBreakerA,
      mainDifferentialAmperageA: panelDiffA
    });
    setEditingPanelId(null);
  };

  const handleDeletePanel = (pId: string) => {
    if (project.panels.length <= 1) {
      alert('No se puede eliminar el único tablero del proyecto. Debe existir al menos un tablero principal.');
      return;
    }
    const toDelete = project.panels.find((p) => p.id === pId);
    const affectedCircuits = project.circuits.filter((c) => c.panelId === pId);
    const msg =
      affectedCircuits.length > 0
        ? `¿Eliminar "${toDelete?.name || 'este tablero'}"? Sus ${affectedCircuits.length} circuitos se reasignarán automáticamente al tablero principal restante.`
        : `¿Eliminar "${toDelete?.name || 'este tablero'}"?`;

    if (window.confirm(msg)) {
      deletePanel(pId);
      if (editingPanelId === pId) {
        setEditingPanelId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Tirador táctil visual para móvil */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 shrink-0 sm:hidden" />

        {/* Cabecera Principal */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Circuitos y Tableros
              </h3>
              <p className="text-[11px] text-slate-500">
                {project.circuits.length} circuitos · {project.panels.length} {project.panels.length === 1 ? 'tablero' : 'tableros'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pestañas Táctiles: [ ⚡ Circuitos ] vs [ 🗄️ Tableros ] */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100/90 border-b border-slate-200 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('circuits')}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'circuits'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap size={14} className={activeTab === 'circuits' ? 'text-blue-600' : 'text-slate-400'} />
            <span>Circuitos ({project.circuits.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('panels')}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'panels'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server size={14} className={activeTab === 'panels' ? 'text-blue-600' : 'text-slate-400'} />
            <span>Tableros ({project.panels.length})</span>
          </button>
        </div>

        {/* Barra de Acciones Superior según pestaña activa */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">
            {activeTab === 'circuits'
              ? `Listado por Tablero (${project.circuits.length})`
              : `Tableros del Proyecto (${project.panels.length})`}
          </span>
          {activeTab === 'circuits' ? (
            <button
              type="button"
              onClick={() => handleStartCreate()}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Nuevo Circuito</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStartCreatePanel()}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Nuevo Tablero</span>
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CONTENIDO SCROLLEABLE                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs pb-8">
          {/* ───────────────────────────────────────────────────────────── */}
          {/* PESTAÑA 1: GESTIÓN DE TABLEROS                                */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'panels' && (
            <>
              {/* Formulario de Crear o Editar Tablero */}
              {(isCreatingPanel || editingPanelId) && (
                <div className="p-4 bg-slate-50 border-2 border-blue-200 rounded-2xl space-y-3 shadow-sm animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Server size={14} className="text-blue-600" />
                      {isCreatingPanel ? 'Nuevo Tablero' : 'Modificar Tablero'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingPanel(false);
                        setEditingPanelId(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Presets de Tablero de un toque */}
                  {isCreatingPanel && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 block">
                        PRESETS RECOMENDADOS (1 TOQUE):
                      </span>
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                        {PANEL_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleApplyPanelPreset(preset)}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-[11px] font-semibold text-slate-700 whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
                            title={preset.desc}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nombre / Designación del Tablero */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      NOMBRE / DESIGNACIÓN
                    </label>
                    <input
                      type="text"
                      value={panelName}
                      onChange={(e) => setPanelName(e.target.value)}
                      placeholder="Ej: Tablero Seccional Planta Alta (TS-PA)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Tipo de Tablero y Suministro */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        TIPO DE TABLERO
                      </label>
                      <select
                        value={panelType}
                        onChange={(e) => setPanelType(e.target.value as any)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="principal">Principal (Cabecera TP)</option>
                        <option value="seccional">Seccional (Subtablero TS)</option>
                        <option value="auxiliar">Auxiliar / Bombas</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        RED DE ALIMENTACIÓN
                      </label>
                      <select
                        value={panelIsThreePhase ? '380' : '220'}
                        onChange={(e) => setPanelIsThreePhase(e.target.value === '380')}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="220">Monofásico (220 V)</option>
                        <option value="380">Trifásico (380 V + N)</option>
                      </select>
                    </div>
                  </div>

                  {/* Protecciones de Cabecera: Termomagnética e Interruptor Diferencial */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        TERMOMAGNÉTICA CABECERA
                      </label>
                      <select
                        value={panelBreakerA}
                        onChange={(e) => setPanelBreakerA(Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[16, 20, 25, 32, 40, 50, 63].map((amp) => (
                          <option key={amp} value={amp}>
                            {amp} A (Curva C)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        DISYUNTOR CABECERA
                      </label>
                      <select
                        value={panelDiffA}
                        onChange={(e) => setPanelDiffA(Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[25, 40, 63].map((amp) => (
                          <option key={amp} value={amp}>
                            {amp} A / 30 mA
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Botones Guardar / Cancelar */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingPanel(false);
                        setEditingPanelId(null);
                      }}
                      className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCreatingPanel) handleSaveNewPanel();
                        else if (editingPanelId) handleSaveEditPanel(editingPanelId);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Check size={14} />
                      <span>{isCreatingPanel ? 'Guardar Tablero' : 'Actualizar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Tarjetas de Tableros */}
              <div className="space-y-3">
                {project.panels.map((p) => {
                  const circuitsFed = project.circuits.filter((c) => c.panelId === p.id);
                  const totalBocas = project.electricalElements.filter((e) =>
                    circuitsFed.some((c) => c.id === e.circuitId)
                  ).length;

                  // Verificar si este tablero es alimentado por una LS desde otro tablero
                  const feederCircuit = project.circuits.find(
                    (c) => c.targetPanelId === p.id && (c.type === 'LP' || c.type === 'LS')
                  );
                  const feederPanel = feederCircuit
                    ? project.panels.find((parent) => parent.id === feederCircuit.panelId)
                    : null;

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all"
                    >
                      {/* Fila 1: Nombre, Badges y Botones */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 leading-tight">
                              🗄️ {p.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                p.type === 'principal'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : p.type === 'seccional'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}
                            >
                              {p.type}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {p.isThreePhase ? '⚡⚡⚡ Trifásico (380V)' : '⚡ Monofásico (220V)'}
                            </span>
                          </div>

                          {feederCircuit && feederPanel && (
                            <p className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                              <ArrowRight size={12} />
                              Alimentado por {feederCircuit.name} desde {feederPanel.name}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditPanel(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar tablero"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={project.panels.length <= 1}
                            onClick={() => handleDeletePanel(p.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 rounded-lg transition-colors cursor-pointer"
                            title={
                              project.panels.length <= 1
                                ? 'No se puede eliminar el único tablero del proyecto'
                                : 'Eliminar tablero (reasigna sus circuitos al principal)'
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Fila 2: Protecciones de Cabecera y Métricas */}
                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-mono">
                          <span>
                            TM: <strong>{p.mainBreakerAmperageA || 32}A</strong>
                          </span>
                          <span>·</span>
                          <span>
                            ID: <strong>{p.mainDifferentialAmperageA || 40}A/30mA</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700 font-semibold text-[10px]">
                            {circuitsFed.length} {circuitsFed.length === 1 ? 'circuito' : 'circuitos'} ({totalBocas} bocas)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartCreate(p.id)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            ＋ Circuito
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* PESTAÑA 2: GESTIÓN DE CIRCUITOS                               */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'circuits' && (
            <>
              {/* Si no hay circuitos, botón de inicialización rápida */}
              {project.circuits.length === 0 && !isCreating && (
                <div className="p-6 bg-blue-50/80 border-2 border-dashed border-blue-200 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl mx-auto flex items-center justify-center">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-950 text-sm">No hay circuitos en este proyecto</h4>
                    <p className="text-xs text-blue-700 mt-1 max-w-xs mx-auto">
                      Podés inicializar los circuitos estándar de vivienda (IUG, TUG y TUE) con un solo toque.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={ensureDefaultCircuits}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus size={16} />
                    <span>Cargar Circuitos Estándar AEA</span>
                  </button>
                </div>
              )}

              {/* Formulario de Crear o Editar Circuito */}
              {(isCreating || editingCircuitId) && (
                <div className="p-4 bg-slate-50 border-2 border-blue-200 rounded-2xl space-y-3 shadow-sm animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Zap size={14} className="text-blue-600" />
                      {isCreating ? 'Nuevo Circuito Eléctrico' : 'Modificar Circuito'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingCircuitId(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Presets Rápidos AEA */}
                  {isCreating && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 block">
                        PRESETS AEA REGLAMENTARIOS (1 TOQUE):
                      </span>
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                        {CIRCUIT_PRESETS.map((preset) => (
                          <button
                            key={preset.type}
                            type="button"
                            onClick={() => handleApplyPreset(preset)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all ${
                              circuitType === preset.type
                                ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-100'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                            title={preset.desc}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nombre / Designación */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      NOMBRE / DESIGNACIÓN
                    </label>
                    <input
                      type="text"
                      value={circuitName}
                      onChange={(e) => setCircuitName(e.target.value)}
                      placeholder="Ej: C4 - ACU Climatización"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO AEA</label>
                      <select
                        value={circuitType}
                        onChange={(e) => setCircuitType(e.target.value as CircuitType)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="IUG">IUG (Iluminación General)</option>
                        <option value="IUE">IUE (Iluminación Especial)</option>
                        <option value="TUG">TUG (Tomas Generales)</option>
                        <option value="TUE">TUE (Tomas Especiales)</option>
                        <option value="ACU">ACU (Alimentación Clima)</option>
                        <option value="FM">FM (Fuerza Motriz / Bombas)</option>
                        <option value="LP">LP (Línea Principal Alimentador)</option>
                        <option value="LS">LS (Línea Seccional Subtablero)</option>
                        <option value="OTRO">OTRO (Uso Específico)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-500">
                          TABLERO CABECERA
                        </label>
                        <button
                          type="button"
                          onClick={() => handleStartCreatePanel('seccional')}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                          title="Crear nuevo tablero seccional"
                        >
                          ＋ Tablero
                        </button>
                      </div>
                      <select
                        value={panelId || defaultPanelId}
                        onChange={(e) => setPanelId(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {project.panels.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Si es Línea Principal (LP) o Seccional (LS): Selector de Tablero Alimentado */}
                  {(circuitType === 'LP' || circuitType === 'LS') && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-amber-900 block">
                          TABLERO RECEPTOR ALIMENTADO (OPCIONAL)
                        </label>
                        <button
                          type="button"
                          onClick={() => handleStartCreatePanel('seccional')}
                          className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline"
                        >
                          ＋ Crear Subtablero
                        </button>
                      </div>
                      <select
                        value={targetPanelId}
                        onChange={(e) => setTargetPanelId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">(Ninguno / Conexión a montante exterior)</option>
                        {project.panels
                          .filter((p) => p.id !== (panelId || defaultPanelId))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              ↳ {p.name} ({p.type})
                            </option>
                          ))}
                      </select>
                      <p className="text-[10px] text-amber-700">
                        Designa qué subtablero recibe la energía de esta línea troncal.
                      </p>
                    </div>
                  )}

                  {/* Sección de Conductor y Térmica */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        SECCIÓN CABLE
                      </label>
                      <select
                        value={wireSection}
                        onChange={(e) => setWireSection(Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[1.5, 2.5, 4.0, 6.0, 10.0, 16.0].map((sec) => (
                          <option key={sec} value={sec}>
                            {sec} mm²
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        TERMOMAGNÉTICA
                      </label>
                      <select
                        value={breakerAmperage}
                        onChange={(e) => setBreakerAmperage(Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[10, 16, 20, 25, 32, 40, 50, 63].map((amp) => (
                          <option key={amp} value={amp}>
                            {amp} A
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selector de Color */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 block">
                      COLOR DE IDENTIFICACIÓN EN PLANO
                    </label>
                    <CircuitColorPicker
                      selectedColor={circuitColor}
                      onChangeColor={setCircuitColor}
                      size="sm"
                    />
                  </div>

                  {/* Botones Guardar / Cancelar */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingCircuitId(null);
                      }}
                      className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCreating) handleSaveNewCircuit();
                        else if (editingCircuitId) handleSaveEdit(editingCircuitId);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Check size={14} />
                      <span>{isCreating ? 'Guardar Circuito' : 'Actualizar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Circuitos Agrupados por Tablero Cabecera */}
              <div className="space-y-4">
                {project.panels.map((panel) => {
                  const panelCircuits = project.circuits.filter(
                    (c) => (c.panelId || defaultPanelId) === panel.id
                  );

                  return (
                    <div key={panel.id} className="space-y-2">
                      {/* Cabecera del Tablero */}
                      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            🗄️ {panel.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                            {panelCircuits.length} {panelCircuits.length === 1 ? 'circuito' : 'circuitos'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditPanel(panel)}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Editar este tablero"
                          >
                            ✎ Tablero
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartCreate(panel.id)}
                            className="px-2 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Agregar circuito en este tablero"
                          >
                            ＋ Circuito
                          </button>
                        </div>
                      </div>

                      {panelCircuits.length === 0 && (
                        <p className="text-[11px] text-slate-400 italic px-3 py-1">
                          No hay circuitos definidos en este tablero.
                        </p>
                      )}

                      <div className="space-y-2">
                        {panelCircuits.map((circ) => {
                          const bocasCount = project.electricalElements.filter(
                            (e) => e.circuitId === circ.id
                          ).length;
                          const isOverloaded =
                            (circ.type === 'IUG' || circ.type === 'TUG') && bocasCount > 15;
                          const isEditingThis = editingCircuitId === circ.id;
                          if (isEditingThis) return null;

                          const targetPanel = circ.targetPanelId
                            ? project.panels.find((p) => p.id === circ.targetPanelId)
                            : null;

                          const conduitsLengthM = project.conduits
                            .filter((c) => c.circuitId === circ.id || c.circuitIds?.includes(circ.id))
                            .reduce((acc, c) => acc + (c.manualLengthM || 0), 0);

                          return (
                            <div
                              key={circ.id}
                              className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2 shadow-xs transition-all"
                            >
                              {/* Fila Principal: Color, Nombre y Botones */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 truncate">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingColorCircuitId(
                                        editingColorCircuitId === circ.id ? null : circ.id
                                      )
                                    }
                                    className="w-4 h-4 rounded-full shrink-0 shadow-xs border border-white hover:scale-110 active:scale-95 transition-transform cursor-pointer ring-1 ring-slate-300"
                                    style={{ backgroundColor: circ.color || '#2563eb' }}
                                    title="Toca para cambiar color en plano"
                                  />
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {circ.name}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                      circ.type === 'LP' || circ.type === 'LS'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {circ.type}
                                  </span>
                                  {targetPanel && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold truncate">
                                      ↳ Alimenta a: {targetPanel.name}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(circ)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Modificar circuito"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        bocasCount > 0 &&
                                        !window.confirm(
                                          `El circuito ${circ.name} tiene ${bocasCount} bocas asignadas. ¿Deseas eliminarlo y dejar las bocas sin circuito?`
                                        )
                                      ) {
                                        return;
                                      }
                                      deleteCircuit(circ.id);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar circuito"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Selector de Color Desplegable */}
                              {editingColorCircuitId === circ.id && (
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 animate-in fade-in duration-100">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500">
                                      Color asignado en el plano CAD:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingColorCircuitId(null)}
                                      className="text-[10px] text-slate-400 hover:text-slate-600"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <CircuitColorPicker
                                    selectedColor={circ.color || '#2563eb'}
                                    onChangeColor={(color) => {
                                      updateCircuit(circ.id, { color });
                                    }}
                                    size="sm"
                                  />
                                </div>
                              )}

                              {/* Fila de Datos Técnicos y Carga */}
                              <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span>
                                    Térmica: <strong>{circ.breakerAmperageA || 16}A</strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    Cable: <strong>{circ.wireSectionBaseMM2 || 2.5} mm²</strong>
                                  </span>
                                  {conduitsLengthM > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        <strong>{conduitsLengthM.toFixed(1)}</strong> m caño
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      isOverloaded
                                        ? 'bg-red-100 text-red-700 font-bold'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                    title={
                                      isOverloaded
                                        ? 'Supera las 15 bocas reglamentarias AEA'
                                        : undefined
                                    }
                                  >
                                    {bocasCount} bocas {isOverloaded && '⚠️'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
