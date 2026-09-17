/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: CircuitsModal.tsx (Patrón Estricto MVVM)
 * Modal / Bottom Sheet táctil optimizado para móvil y escritorio.
 * Permite gestionar circuitos eléctricos (crear, editar, borrar, colores y térmicas)
 * con presets de un toque conforme a la reglamentación AEA 90364-771.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { Circuit, CircuitType } from '../../../models/electrical/ElectricalModel';
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
  Edit2
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

export const CircuitsModal: React.FC<CircuitsModalProps> = ({ isOpen, onClose }) => {
  const { project, addCircuit, updateCircuit, deleteCircuit, ensureDefaultCircuits } =
    useProjectStore();

  const [isCreating, setIsCreating] = useState(false);
  const [editingCircuitId, setEditingCircuitId] = useState<string | null>(null);
  const [editingColorCircuitId, setEditingColorCircuitId] = useState<string | null>(null);

  // Formulario de creación / edición
  const [circuitName, setCircuitName] = useState('');
  const [circuitType, setCircuitType] = useState<CircuitType>('IUG');
  const [wireSection, setWireSection] = useState<number>(1.5);
  const [breakerAmperage, setBreakerAmperage] = useState<number>(10);
  const [circuitColor, setCircuitColor] = useState<string>('#2563eb');
  const [panelId, setPanelId] = useState<string>('');
  const [targetPanelId, setTargetPanelId] = useState<string>('');

  if (!isOpen) return null;

  const defaultPanelId = project.panels[0]?.id || 'pan-principal';

  const handleApplyPreset = (preset: (typeof CIRCUIT_PRESETS)[0]) => {
    setCircuitType(preset.type);
    setCircuitName(`C${project.circuits.length + 1} - ${preset.defaultName}`);
    setWireSection(preset.wireMM2);
    setBreakerAmperage(preset.breakerA);
    setCircuitColor(preset.color);
  };

  const handleStartCreate = () => {
    const nextIdx = project.circuits.length + 1;
    setCircuitName(`C${nextIdx} - `);
    setCircuitType('TUG');
    setWireSection(2.5);
    setBreakerAmperage(16);
    setCircuitColor(CIRCUIT_COLOR_PALETTE[(nextIdx - 1) % CIRCUIT_COLOR_PALETTE.length].hex);
    setPanelId(defaultPanelId);
    setTargetPanelId('');
    setIsCreating(true);
    setEditingCircuitId(null);
  };

  const handleSaveNewCircuit = () => {
    if (!circuitName.trim()) return;

    const newCirc: Circuit = {
      id: `circ-${Date.now()}`,
      panelId: panelId || defaultPanelId,
      targetPanelId: (circuitType === 'LP' || circuitType === 'LS') && targetPanelId ? targetPanelId : null,
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
  };

  const handleSaveEdit = (circId: string) => {
    if (!circuitName.trim()) return;
    updateCircuit(circId, {
      name: circuitName.trim(),
      type: circuitType,
      panelId: panelId || defaultPanelId,
      targetPanelId: (circuitType === 'LP' || circuitType === 'LS') && targetPanelId ? targetPanelId : null,
      wireSectionBaseMM2: wireSection,
      breakerAmperageA: breakerAmperage,
      color: circuitColor
    });
    setEditingCircuitId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera Móvil con Indicador de Arrastre */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Circuitos Eléctricos
              </h3>
              <p className="text-[11px] text-slate-500">
                {project.circuits.length} definidos · Tablero: {project.panels[0]?.name || 'Principal'}
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

        {/* Barra de Acciones y Presets */}
        <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">
            Listado ({project.circuits.length})
          </span>
          <button
            type="button"
            onClick={handleStartCreate}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Nuevo Circuito</span>
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
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
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl shadow-sm transition-all"
              >
                Crear Circuitos Estándar (IUG, TUG, TUE)
              </button>
            </div>
          )}

          {/* Formulario de Creación / Edición */}
          {(isCreating || editingCircuitId) && (
            <div className="p-3.5 bg-white border-2 border-blue-500 rounded-2xl space-y-3 shadow-md animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-blue-950">
                  {isCreating ? 'Nuevo Circuito Eléctrico' : 'Modificar Circuito'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingCircuitId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Presets Rápidos de 1 Toque (Solo al crear) */}
              {isCreating && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                    ⚡ Presets de 1 toque (Norma AEA):
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO AEA</label>
                  <select
                    value={circuitType}
                    onChange={(e) => setCircuitType(e.target.value as CircuitType)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    TABLERO ALIMENTADOR
                  </label>
                  <select
                    value={panelId || defaultPanelId}
                    onChange={(e) => setPanelId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {project.panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    {project.panels.length === 0 && (
                      <option value="pan-principal">Tablero Principal (TP)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Si es LP o LS: Selector de Tablero Receptor / Alimentado */}
              {(circuitType === 'LP' || circuitType === 'LS') && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <label className="text-[10px] font-bold text-amber-900 block">
                    ⚡ TABLERO DESTINO / ALIMENTADO POR ESTA LÍNEA:
                  </label>
                  <select
                    value={targetPanelId}
                    onChange={(e) => setTargetPanelId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">(Seleccionar tablero receptor...)</option>
                    {project.panels
                      .filter((p) => p.id !== (panelId || defaultPanelId))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-amber-700">
                    Conecta eléctricamente el tablero cabecera con el subtablero.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    SECCIÓN CONDUCTOR
                  </label>
                  <select
                    value={wireSection}
                    onChange={(e) => setWireSection(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1.5}>1.5 mm² (Mín IUG)</option>
                    <option value={2.5}>2.5 mm² (Mín TUG/TUE)</option>
                    <option value={4.0}>4.0 mm²</option>
                    <option value={6.0}>6.0 mm²</option>
                    <option value={10.0}>10.0 mm²</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    TERMOMAGNÉTICA
                  </label>
                  <select
                    value={breakerAmperage}
                    onChange={(e) => setBreakerAmperage(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={10}>10 A</option>
                    <option value={16}>16 A</option>
                    <option value={20}>20 A</option>
                    <option value={25}>25 A</option>
                    <option value={32}>32 A</option>
                    <option value={40}>40 A</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    COLOR EN PLANO
                  </label>
                  <CircuitColorPicker
                    selectedColor={circuitColor}
                    onChangeColor={setCircuitColor}
                    size="sm"
                  />
                </div>
              </div>

              {/* Botones de Confirmación */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingCircuitId(null);
                  }}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isCreating) {
                      handleSaveNewCircuit();
                    } else if (editingCircuitId) {
                      handleSaveEdit(editingCircuitId);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Check size={14} />
                  <span>{isCreating ? 'Guardar Circuito' : 'Actualizar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Lista de Circuitos Existentes Agrupados por Tablero Cabecera */}
          <div className="space-y-4">
            {project.panels.map((panel) => {
              const panelCircuits = project.circuits.filter(
                (c) => (c.panelId || defaultPanelId) === panel.id
              );
              if (panelCircuits.length === 0 && project.panels.length > 1) return null;

              return (
                <div key={panel.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      🏢 {panel.name} ({panelCircuits.length})
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div className="space-y-2">
                    {panelCircuits.map((circ) => {
                      const bocasCount = project.electricalElements.filter(
                        (e) => e.circuitId === circ.id
                      ).length;
                      const isOverloaded = (circ.type === 'IUG' || circ.type === 'TUG') && bocasCount > 15;
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
        </div>
      </div>
    </div>
  );
};
