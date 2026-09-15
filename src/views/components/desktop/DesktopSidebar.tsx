/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: DesktopSidebar.tsx
 * Panel Lateral para Escritorio (CAD Inspector).
 * Optimizado para pantallas grandes con ratón y teclado:
 * trazo de muros, gestión de aberturas, nombres de ambientes y alturas de techo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { RelativeTurnType } from '../../../viewmodels/useSurveyViewModel';
import { getWallLength } from '../../../models/architecture/Wall';
import { calculatePolygonArea, resolveSpacePolygon } from '../../../models/architecture/Space';
import { SYMBOL_CATEGORIES, getSymbolsByCategory, getSymbolById } from '../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from '../electrical/AeaSymbolIcon';
import type { OpeningType, OpeningSwing } from '../../../models/architecture/Opening';
import { calculateConduitRealLength, calculateConduitOccupancyFactor } from '../../../models/electrical/calculations';
import type { CircuitType, ConduitMaterial, ConductorRole } from '../../../models/electrical/ElectricalModel';
import {
  Compass,
  Plus,
  Trash2,
  Building2,
  Zap,
  RotateCw,
  RotateCcw,
  MoveUp,
  Ruler,
  DoorOpen,
  ArrowLeftRight,
  ArrowUpDown,
  Undo2,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Cable,
  Layers
} from 'lucide-react';

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
  onToggleConnectConduit
}) => {
  const {
    project,
    activeAnchorVertexId,
    selectedEntity,
    addOpeningReferenced,
    addBranchWallFromOffset,
    updateWall,
    updateWallLength,
    rotateWall,
    invertWallDirection,
    deleteWall,
    undoLastWall,
    setActiveAnchorVertexId,
    updateOpening,
    deleteOpening,
    updateSpace,
    autoDetectSpaces,
    updateElectricalElement,
    deleteElectricalElement,
    updateConduit,
    deleteConduit,
    addCircuit,
    deleteCircuit,
    ensureDefaultCircuits
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'survey' | 'spaces' | 'electrical'>('survey');
  const [activeCategory, setActiveCategory] = useState<string>('iluminacion');

  // Sub-pestaña para gestión eléctrica: "Red y Bocas" o "Circuitos y Tableros"
  const [electricalSubTab, setElectricalSubTab] = useState<'network' | 'circuits'>('network');
  const [isCreatingCircuit, setIsCreatingCircuit] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState('');
  const [newCircuitType, setNewCircuitType] = useState<CircuitType>('IUG');
  const [newCircuitWire, setNewCircuitWire] = useState(1.5);
  const [newCircuitBreaker, setNewCircuitBreaker] = useState(10);
  const [newCircuitColor, setNewCircuitColor] = useState('#2563eb');

  // Cambiar pestaña automáticamente cuando el usuario toca un elemento en el lienzo
  useEffect(() => {
    if (selectedEntity?.type === 'space') {
      setActiveTab('spaces');
    } else if (selectedEntity?.type === 'wall' || selectedEntity?.type === 'opening') {
      setActiveTab('survey');
    } else if (selectedEntity?.type === 'electrical_element' || selectedEntity?.type === 'conduit') {
      setActiveTab('electrical');
      setElectricalSubTab('network');
    }
  }, [selectedEntity]);

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const wallsMap = new Map(project.walls.map((w) => [w.id, w]));
  const levelsMap = new Map(project.levels.map((l) => [l.id, l]));

  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;
  const selectedElectricalElement =
    selectedEntity?.type === 'electrical_element'
      ? project.electricalElements.find((e) => e.id === selectedEntity.id)
      : null;
  const selectedConduit =
    selectedEntity?.type === 'conduit' ? project.conduits.find((c) => c.id === selectedEntity.id) : null;

  // Estado rápido para inserción de abertura en escritorio
  const [openingOffset, setOpeningOffset] = useState('0.60');
  const [openingWidth, setOpeningWidth] = useState('0.80');
  const [openingType, setOpeningType] = useState<'door' | 'window' | 'passage'>('door');

  const handleSelectOpeningType = (type: 'door' | 'window' | 'passage') => {
    setOpeningType(type);
    if (type === 'door') setOpeningWidth('0.80');
    else if (type === 'window') setOpeningWidth('1.20');
    else if (type === 'passage') setOpeningWidth('0.90');
  };

  // Estado rápido para empalme en T en escritorio
  const [teeOffset, setTeeOffset] = useState('1.50');
  const [teeLength, setTeeLength] = useState('2.50');
  const [teeSide, setTeeSide] = useState<'left' | 'right'>('left');

  const symbols = getSymbolsByCategory(activeCategory);

  const anchorVertex = activeAnchorVertexId
    ? project.vertices.find((v) => v.id === activeAnchorVertexId)
    : null;

  return (
    <aside className="w-80 h-full bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 select-none">
      {/* Selector de Pestañas Principales */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('survey')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
            activeTab === 'survey' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Compass size={15} />
          <span>Muros & Vano</span>
        </button>

        <button
          onClick={() => setActiveTab('spaces')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
            activeTab === 'spaces' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 size={15} />
          <span>Ambientes ({project.spaces.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('electrical')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
            activeTab === 'electrical' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap size={15} />
          <span>Eléctrico</span>
        </button>
      </div>

      {/* Contenido según pestaña activa */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* ════════════ PESTAÑA 1: MUROS Y RELEVAMIENTO ════════════ */}
        {activeTab === 'survey' && (
          <>
            {/* Anclaje y Trazo Continuo */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-500">Punto de Anclaje:</span>
                <span className="font-mono font-bold text-slate-800">
                  {anchorVertex
                    ? `(${anchorVertex.x.toFixed(2)}, ${anchorVertex.y.toFixed(2)}) m`
                    : project.vertices.length === 0
                    ? 'Origen (0, 0)'
                    : 'Seleccioná un vértice'}
                </span>
              </div>

              {/* Entrada de Largo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">LONGITUD DE PARED</label>
                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500">
                  <Ruler size={14} className="text-blue-500 mr-1.5" />
                  <input
                    type="number"
                    step="0.05"
                    value={currentDistance}
                    onChange={(e) => onChangeDistance(e.target.value)}
                    className="w-full font-mono font-bold text-base text-slate-900 focus:outline-none"
                    placeholder="3.50"
                  />
                  <span className="font-mono text-xs text-slate-400">m</span>
                </div>
              </div>

              {/* Giros Relativos */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">GIRO RELATIVO</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectTurn('right')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold border transition-all ${
                      relativeTurn === 'right'
                        ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RotateCw size={13} />
                    <span>↷ Der</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectTurn('left')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold border transition-all ${
                      relativeTurn === 'left'
                        ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RotateCcw size={13} />
                    <span>↶ Izq</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectTurn('straight')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold border transition-all ${
                      relativeTurn === 'straight'
                        ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <MoveUp size={13} />
                    <span>↑ Recto</span>
                  </button>
                </div>

                {/* Entrada de ángulo libre */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Ángulo libre / Falsa escuadra:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={customAngle}
                      onChange={(e) => {
                        onChangeCustomAngle(parseFloat(e.target.value) || 0);
                        onSelectTurn('custom');
                      }}
                      className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-center text-slate-800"
                    />
                    <span className="font-mono font-bold">°</span>
                  </div>
                </div>
              </div>

              {/* Botón Principal: Agregar Muro */}
              <button
                type="button"
                onClick={onCommitWall}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Plus size={16} />
                <span>+ AGREGAR PARED (Enter)</span>
              </button>

              {/* Deshacer Última Pared */}
              <button
                type="button"
                onClick={undoLastWall}
                disabled={project.walls.length === 0}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                title="Deshacer la última pared trazada (Ctrl+Z)"
              >
                <Undo2 size={14} />
                <span>Deshacer Última Pared</span>
              </button>
            </div>

            {/* Inspector de Abertura Seleccionada (Gestión total: Tipo, Ancho, Posición, Sentido de Apertura) */}
            {selectedOpening && (() => {
              const hostWall = wallsMap.get(selectedOpening.wallId);
              const hostWallLength = hostWall ? getWallLength(hostWall, verticesMap) : 10;
              const maxDist = Math.max(0, hostWallLength - selectedOpening.width);

              const handleAdjustDist = (delta: number) => {
                const newDist = Math.max(
                  0,
                  Math.min(maxDist, Number((selectedOpening.distanceAlongWall + delta).toFixed(2)))
                );
                updateOpening(selectedOpening.id, { distanceAlongWall: newDist });
              };

              const handleAdjustWidth = (newW: number) => {
                const clampedW = Math.max(
                  0.40,
                  Math.min(hostWallLength - selectedOpening.distanceAlongWall, newW)
                );
                updateOpening(selectedOpening.id, { width: Number(clampedW.toFixed(2)) });
              };

              const handleToggleHinge = () => {
                // Invertir mano izquierda <-> derecha
                const cur = selectedOpening.swing || 'left_in';
                const nextSwing: OpeningSwing =
                  cur === 'left_in'
                    ? 'right_in'
                    : cur === 'right_in'
                    ? 'left_in'
                    : cur === 'left_out'
                    ? 'right_out'
                    : 'left_out';
                updateOpening(selectedOpening.id, { swing: nextSwing });
              };

              const handleToggleDirection = () => {
                // Invertir hacia adentro <-> hacia afuera
                const cur = selectedOpening.swing || 'left_in';
                const nextSwing: OpeningSwing =
                  cur === 'left_in'
                    ? 'left_out'
                    : cur === 'left_out'
                    ? 'left_in'
                    : cur === 'right_in'
                    ? 'right_out'
                    : 'right_in';
                updateOpening(selectedOpening.id, { swing: nextSwing });
              };

              return (
                <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800">
                        <DoorOpen size={16} />
                      </div>
                      <div>
                        <span className="font-bold text-amber-950 block text-xs">
                          {selectedOpening.type === 'door'
                            ? 'Puerta'
                            : selectedOpening.type === 'window'
                            ? 'Ventana'
                            : 'Vano Libre'}
                        </span>
                        <span className="text-[10px] text-amber-700">Muro: {hostWallLength.toFixed(2)}m</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteOpening(selectedOpening.id)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Eliminar abertura"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* 1. Selector de Tipo */}
                  <div>
                    <label className="text-[10px] font-bold text-amber-900 block mb-1">TIPO DE ABERTURA</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['door', 'window', 'passage'] as OpeningType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const updates: Partial<typeof selectedOpening> = { type: t };
                            if (t === 'window' && (!selectedOpening.sill || selectedOpening.sill === 0)) {
                              updates.sill = 0.90;
                            }
                            updateOpening(selectedOpening.id, updates);
                          }}
                          className={`py-1.5 rounded-lg font-semibold text-[11px] border transition-all ${
                            selectedOpening.type === t
                              ? 'bg-amber-600 border-amber-700 text-white shadow-sm'
                              : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-100/50'
                          }`}
                        >
                          {t === 'door' ? 'Puerta' : t === 'window' ? 'Ventana' : 'Vano'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Ancho del Vano */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-amber-900">ANCHO DEL VANO</label>
                      <span className="font-mono text-xs font-bold text-amber-950">
                        {selectedOpening.width.toFixed(2)} m
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.05"
                        min="0.40"
                        max={hostWallLength}
                        value={selectedOpening.width}
                        onChange={(e) => handleAdjustWidth(parseFloat(e.target.value) || 0.80)}
                        className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs"
                      />
                      <div className="flex-1 flex gap-1">
                        {[0.70, 0.80, 0.90, 1.20, 1.50].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => handleAdjustWidth(w)}
                            className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                              Math.abs(selectedOpening.width - w) < 0.01
                                ? 'bg-amber-700 text-white border-amber-800 font-bold'
                                : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-100/60'
                            }`}
                          >
                            {w.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. Posición a lo largo del Muro */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-amber-900">DISTANCIA A ESQUINA</label>
                      <span className="font-mono text-xs font-bold text-amber-950">
                        {selectedOpening.distanceAlongWall.toFixed(2)} m
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAdjustDist(-0.10)}
                        className="px-1.5 py-1 bg-white border border-amber-300 rounded text-[10px] font-mono hover:bg-amber-100"
                        title="Mover -10cm"
                      >
                        -10c
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustDist(-0.05)}
                        className="px-1.5 py-1 bg-white border border-amber-300 rounded text-[10px] font-mono hover:bg-amber-100"
                        title="Mover -5cm"
                      >
                        -5c
                      </button>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max={maxDist}
                        value={selectedOpening.distanceAlongWall}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateOpening(selectedOpening.id, {
                            distanceAlongWall: Math.max(0, Math.min(maxDist, val))
                          });
                        }}
                        className="flex-1 px-1 py-1 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdjustDist(0.05)}
                        className="px-1.5 py-1 bg-white border border-amber-300 rounded text-[10px] font-mono hover:bg-amber-100"
                        title="Mover +5cm"
                      >
                        +5c
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustDist(0.10)}
                        className="px-1.5 py-1 bg-white border border-amber-300 rounded text-[10px] font-mono hover:bg-amber-100"
                        title="Mover +10cm"
                      >
                        +10c
                      </button>
                    </div>
                  </div>

                  {/* 4. Sentido de Apertura (Solo si es Puerta) */}
                  {selectedOpening.type === 'door' && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-amber-900">SENTIDO DE APERTURA</label>
                        <span className="text-[10px] font-mono font-bold text-amber-800">
                          {selectedOpening.swing?.includes('left') ? 'Izq' : 'Der'} ·{' '}
                          {selectedOpening.swing?.includes('out') ? 'Afuera' : 'Adentro'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={handleToggleHinge}
                          className="flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-semibold text-amber-900 transition-colors"
                        >
                          <ArrowLeftRight size={13} />
                          <span>Invertir Mano</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleDirection}
                          className="flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-semibold text-amber-900 transition-colors"
                        >
                          <ArrowUpDown size={13} />
                          <span>Invertir Sentido</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {(['left_in', 'right_in', 'left_out', 'right_out'] as OpeningSwing[]).map((sw) => (
                          <button
                            key={sw}
                            type="button"
                            onClick={() => updateOpening(selectedOpening.id, { swing: sw })}
                            className={`py-1 rounded text-[9px] font-semibold border ${
                              (selectedOpening.swing || 'left_in') === sw
                                ? 'bg-amber-700 text-white border-amber-800'
                                : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            {sw === 'left_in'
                              ? 'Izq/Ad'
                              : sw === 'right_in'
                              ? 'Der/Ad'
                              : sw === 'left_out'
                              ? 'Izq/Af'
                              : 'Der/Af'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Altura de Antepecho (Solo si es Ventana) */}
                  {selectedOpening.type === 'window' && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-amber-900">ANTEPECHO (Sill)</label>
                        <span className="text-[10px] font-mono font-bold text-amber-800">
                          {selectedOpening.sill?.toFixed(2) || '0.90'} m
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.05"
                          value={selectedOpening.sill || 0.90}
                          onChange={(e) =>
                            updateOpening(selectedOpening.id, {
                              sill: parseFloat(e.target.value) || 0.90
                            })
                          }
                          className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs"
                        />
                        <div className="flex-1 flex gap-1">
                          {[0.80, 0.90, 1.00, 1.10].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateOpening(selectedOpening.id, { sill: s })}
                              className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                                Math.abs((selectedOpening.sill || 0.90) - s) < 0.01
                                  ? 'bg-amber-700 text-white border-amber-800 font-bold'
                                  : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              {s.toFixed(2)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Inspector de Muro Seleccionado (Gestión Total de Pared) */}
            {selectedWall ? (
              <div className="bg-slate-50 border-2 border-blue-400 rounded-2xl p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                      <Ruler size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Muro Seleccionado</span>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {selectedWall.id.slice(-6)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWall(selectedWall.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar muro"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* 1. Longitud / Largo del Muro con Steppers */}
                {(() => {
                  const wallLen = getWallLength(selectedWall, verticesMap);
                  const handleDeltaLen = (delta: number) => {
                    const next = Math.max(0.20, Number((wallLen + delta).toFixed(2)));
                    updateWallLength(selectedWall.id, next);
                  };

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-600">LONGITUD DEL MURO</label>
                        <span className="font-mono text-xs font-bold text-blue-900">
                          {wallLen.toFixed(2)} m
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeltaLen(-0.50)}
                          className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-700"
                          title="-50cm"
                        >
                          -50c
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeltaLen(-0.10)}
                          className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-700"
                          title="-10cm"
                        >
                          -10c
                        </button>
                        <input
                          type="number"
                          step="0.05"
                          min="0.20"
                          value={Number(wallLen.toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val && val > 0) updateWallLength(selectedWall.id, val);
                          }}
                          className="flex-1 px-1.5 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-center text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeltaLen(0.10)}
                          className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-700"
                          title="+10cm"
                        >
                          +10c
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeltaLen(0.50)}
                          className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-700"
                          title="+50cm"
                        >
                          +50c
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Espesor del Muro */}
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">ESPESOR DEL MURO</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.10, 0.15, 0.20, 0.30].map((th) => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => updateWall(selectedWall.id, { thickness: th })}
                        className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                          Math.abs(selectedWall.thickness - th) < 0.01
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {Math.round(th * 100)} cm
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Rotación y Orientación del Muro */}
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">GIRO Y SENTIDO</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => rotateWall(selectedWall.id, -90)}
                      className="flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      title="Girar pared 90° antihorario"
                    >
                      <RotateCcw size={13} />
                      <span>-90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateWall(selectedWall.id, 90)}
                      className="flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      title="Girar pared 90° horario"
                    >
                      <RotateCw size={13} />
                      <span>+90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => invertWallDirection(selectedWall.id)}
                      className="flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      title="Invertir dirección inicio <-> fin"
                    >
                      <ArrowLeftRight size={13} />
                      <span>Invertir</span>
                    </button>
                  </div>
                </div>

                {/* 4. Continuar Trazado (Fijar Extremo como Anclaje Activo) */}
                <button
                  type="button"
                  onClick={() => setActiveAnchorVertexId(selectedWall.endVertexId)}
                  className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MapPin size={14} />
                  <span>Fijar extremo como Punto de Inicio</span>
                </button>

                {/* Inserción Rápida de Aberturas */}
                <div className="pt-2 border-t border-blue-100 space-y-2">
                  <span className="font-bold text-slate-700 block">+ Insertar Abertura en este Muro</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectOpeningType('door')}
                      className={`flex-1 py-1 rounded-lg border font-semibold ${
                        openingType === 'door' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      Puerta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectOpeningType('window')}
                      className={`flex-1 py-1 rounded-lg border font-semibold ${
                        openingType === 'window' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      Ventana
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectOpeningType('passage')}
                      className={`flex-1 py-1 rounded-lg border font-semibold ${
                        openingType === 'passage' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      Vano
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Dist. a esquina</label>
                      <input
                        type="number"
                        step="0.05"
                        value={openingOffset}
                        onChange={(e) => setOpeningOffset(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Ancho vano</label>
                      <input
                        type="number"
                        step="0.05"
                        value={openingWidth}
                        onChange={(e) => setOpeningWidth(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      addOpeningReferenced({
                        hostWallId: selectedWall.id,
                        referenceVertexId: selectedWall.startVertexId,
                        offsetToJambM: parseFloat(openingOffset) || 0,
                        widthM: parseFloat(openingWidth) || 0,
                        type: openingType
                      });
                    }}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                  >
                    Emplazar {openingType === 'door' ? 'Puerta' : openingType === 'window' ? 'Ventana' : 'Vano'}
                  </button>

                  {/* Lista de aberturas existentes en este muro */}
                  {(() => {
                    const wallOpenings = project.openings.filter((o) => o.wallId === selectedWall.id);
                    if (wallOpenings.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-blue-100 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 block">
                          Aberturas en este muro ({wallOpenings.length}):
                        </span>
                        <div className="space-y-1">
                          {wallOpenings.map((op) => (
                            <div
                              key={op.id}
                              className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded-lg text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <DoorOpen size={13} className="text-blue-500" />
                                <span className="font-semibold text-slate-700">
                                  {op.type === 'door' ? 'Puerta' : op.type === 'window' ? 'Ventana' : 'Vano'}{' '}
                                  {op.width.toFixed(2)}m
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  @{op.distanceAlongWall.toFixed(2)}m
                                </span>
                              </div>
                              <button
                                onClick={() => deleteOpening(op.id)}
                                className="p-1 text-red-500 hover:text-red-700 rounded"
                                title="Eliminar abertura"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Empalme en T */}
                <div className="pt-2 border-t border-blue-100 space-y-2">
                  <span className="font-bold text-slate-700 block">+ Empalme en T</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Desde esquina</label>
                      <input
                        type="number"
                        step="0.1"
                        value={teeOffset}
                        onChange={(e) => setTeeOffset(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Largo rama</label>
                      <input
                        type="number"
                        step="0.1"
                        value={teeLength}
                        onChange={(e) => setTeeLength(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Lado de bifurcación de la T */}
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Lado de salida</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setTeeSide('left')}
                        className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                          teeSide === 'left' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        Izquierda
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeeSide('right')}
                        className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                          teeSide === 'right' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        Derecha
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      addBranchWallFromOffset({
                        hostWallId: selectedWall.id,
                        referenceVertexId: selectedWall.startVertexId,
                        offsetM: parseFloat(teeOffset) || 0,
                        branchLengthM: parseFloat(teeLength) || 0,
                        side: teeSide
                      });
                    }}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm"
                  >
                    Generar Pared en T
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-slate-400">
                Tocá cualquier muro en el plano para agregar puertas, ventanas o empalmes en T.
              </div>
            )}
          </>
        )}

        {/* ════════════ PESTAÑA 2: AMBIENTES Y ALTURAS DE TECHO ════════════ */}
        {activeTab === 'spaces' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Ambientes del Nivel</span>
                <span className="text-[10px] text-slate-500 block">Identificación y alturas de techo</span>
              </div>
              <button
                onClick={autoDetectSpaces}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-semibold transition-colors"
              >
                Actualizar
              </button>
            </div>

            {project.spaces.length === 0 ? (
              <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-slate-400 space-y-1">
                <Building2 size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="font-medium text-xs text-slate-600">No hay ambientes detectados</p>
                <p className="text-[11px]">Cerrá un circuito de 3 o más paredes para generar un ambiente automáticamente.</p>
              </div>
            ) : (
              project.spaces.map((space, idx) => {
                const poly = resolveSpacePolygon(space, verticesMap);
                const area = poly.length >= 3 ? calculatePolygonArea(poly) : 0;
                const volume = area * space.ceilingHeight;
                const isSelected = selectedEntity?.type === 'space' && selectedEntity.id === space.id;

                const roomSuggestions = ['Living', 'Comedor', 'Cocina', 'Dormitorio 1', 'Dormitorio 2', 'Baño', 'Pasillo', 'Lavadero', 'Balcón'];
                const heightPresets = [2.60, 2.70, 2.80, 3.00];

                return (
                  <div
                    key={space.id}
                    className={`rounded-2xl p-3 space-y-2.5 transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-2 border-blue-500 shadow-sm'
                        : 'bg-slate-50 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Cabecera del Ambiente */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                        Ambiente {idx + 1}
                      </span>
                      <div className="text-[11px] font-mono font-bold text-slate-700">
                        {area.toFixed(2)} m² · {volume.toFixed(2)} m³
                      </div>
                    </div>

                    {/* Input de Nombre */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">NOMBRE DEL AMBIENTE</label>
                      <input
                        type="text"
                        value={space.name}
                        onChange={(e) => updateSpace(space.id, { name: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Living Comedor"
                      />
                    </div>

                    {/* Pastillas de nombres sugeridos */}
                    <div className="flex flex-wrap gap-1">
                      {roomSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => updateSpace(space.id, { name: sug })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                            space.name === sug
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>

                    {/* Altura de Cielorraso / Techo */}
                    <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600">Altura de Techo (h):</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.05"
                            value={space.ceilingHeight}
                            onChange={(e) =>
                              updateSpace(space.id, { ceilingHeight: parseFloat(e.target.value) || 2.70 })
                            }
                            className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="font-mono text-xs text-slate-400">m</span>
                        </div>
                      </div>

                      {/* Pastillas de Alturas Predefinidas */}
                      <div className="flex gap-1 justify-end">
                        {heightPresets.map((hp) => (
                          <button
                            key={hp}
                            type="button"
                            onClick={() => updateSpace(space.id, { ceilingHeight: hp })}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                              Math.abs(space.ceilingHeight - hp) < 0.01
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {hp.toFixed(2)}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════ PESTAÑA 3: RED ELÉCTRICA AEA (INSPIRADO EN TRAZA) ════════════ */}
        {activeTab === 'electrical' && (
          <div className="space-y-3.5">
            {/* Selector de sub-pestaña: Red y Bocas vs Gestor de Circuitos */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setElectricalSubTab('network')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  electricalSubTab === 'network'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap size={14} className="text-amber-500" />
                <span>Bocas y Red</span>
              </button>
              <button
                type="button"
                onClick={() => setElectricalSubTab('circuits')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  electricalSubTab === 'circuits'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={14} className="text-blue-600" />
                <span>Circuitos ({project.circuits.length})</span>
              </button>
            </div>

            {/* ─── SUB-PESTAÑA 1: GESTOR DE CIRCUITOS Y TABLEROS ─── */}
            {electricalSubTab === 'circuits' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Circuitos AEA 90364-771
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCircuit(true);
                      setNewCircuitName(`C${project.circuits.length + 1} - `);
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                  >
                    <Plus size={12} />
                    <span>Nuevo Circuito</span>
                  </button>
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
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
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
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
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
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO</label>
                        <select
                          value={newCircuitType}
                          onChange={(e) => setNewCircuitType(e.target.value as CircuitType)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                        >
                          <option value="IUG">IUG (Iluminación Uso Gral)</option>
                          <option value="IUE">IUE (Iluminación Especial)</option>
                          <option value="TUG">TUG (Tomas Uso Gral)</option>
                          <option value="TUE">TUE (Tomas Especiales)</option>
                          <option value="ACU">ACU (Alimentador / Aire)</option>
                          <option value="FM">FM (Fuerza Motriz)</option>
                          <option value="OTRO">OTRO</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">SECCIÓN CABLE</label>
                        <select
                          value={newCircuitWire}
                          onChange={(e) => setNewCircuitWire(parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                        >
                          <option value={1.5}>1.5 mm²</option>
                          <option value={2.5}>2.5 mm²</option>
                          <option value={4.0}>4.0 mm²</option>
                          <option value={6.0}>6.0 mm²</option>
                          <option value={10.0}>10.0 mm²</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">TERMOMAGNÉTICA</label>
                        <select
                          value={newCircuitBreaker}
                          onChange={(e) => setNewCircuitBreaker(parseInt(e.target.value, 10))}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                        >
                          <option value={10}>10 A</option>
                          <option value={16}>16 A</option>
                          <option value={20}>20 A</option>
                          <option value={25}>25 A</option>
                          <option value={32}>32 A</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">COLOR EN PLANO</label>
                        <div className="flex gap-1 items-center h-8">
                          {['#2563eb', '#ea580c', '#16a34a', '#8b5cf6', '#dc2626', '#0891b2'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewCircuitColor(c)}
                              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                newCircuitColor === c ? 'scale-110 border-slate-900 ring-2 ring-blue-300' : 'border-white hover:scale-105'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t">
                      <button
                        type="button"
                        onClick={() => setIsCreatingCircuit(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCircuitName.trim()) return;
                          addCircuit({
                            id: `circ-${Date.now()}`,
                            panelId: project.panels[0]?.id || 'pan-principal',
                            name: newCircuitName.trim(),
                            type: newCircuitType,
                            voltageV: 220,
                            wireSectionBaseMM2: newCircuitWire,
                            breakerAmperageA: newCircuitBreaker,
                            color: newCircuitColor
                          });
                          setIsCreatingCircuit(false);
                          setNewCircuitName('');
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Guardar Circuito
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de circuitos existentes */}
                <div className="space-y-2">
                  {project.circuits.map((circ) => {
                    const bocasCount = project.electricalElements.filter((e) => e.circuitId === circ.id).length;
                    const isOverloaded = (circ.type === 'IUG' || circ.type === 'TUG') && bocasCount > 15;

                    return (
                      <div
                        key={circ.id}
                        className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-1.5 shadow-xs transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: circ.color || '#2563eb' }}
                            />
                            <span className="font-bold text-xs text-slate-900">{circ.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteCircuit(circ.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                            title="Eliminar circuito"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                          <span>
                            Termomagnética: <strong>{circ.breakerAmperageA || 16}A</strong> · Cable: <strong>{circ.wireSectionBaseMM2 || 2.5} mm²</strong>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isOverloaded
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {bocasCount} bocas {isOverloaded ? '(>15 AEA)' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── SUB-PESTAÑA 2: INSPECTOR DE ELEMENTO / CAÑERÍA Y RED ─── */}
            {electricalSubTab === 'network' && (
              <div className="space-y-3">
                {/* 1. INSPECTOR DE CAÑERÍA SELECCIONADA */}
                {selectedConduit && (() => {
                  const elFrom = project.electricalElements.find((e) => e.id === selectedConduit.fromElementId);
                  const elTo = project.electricalElements.find((e) => e.id === selectedConduit.toElementId);
                  const autoLengthM = elFrom && elTo ? calculateConduitRealLength({ fromElement: elFrom, toElement: elTo, levelsMap }) : 0;
                  const effectiveLengthM = selectedConduit.manualLengthM || autoLengthM;
                  const occupancy = calculateConduitOccupancyFactor({
                    conduitDiameterMM: selectedConduit.diameterMM,
                    conductors: selectedConduit.conductors
                  });

                  return (
                    <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-3.5 space-y-3 shadow-sm animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-amber-500 text-white rounded-xl shadow-xs">
                            <Cable size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-amber-950 block text-xs">
                              Cañería: {elFrom?.label || 'Boca 1'} ➔ {elTo?.label || 'Boca 2'}
                            </span>
                            <span className="text-[10px] font-mono text-amber-800">
                              Largo: {effectiveLengthM.toFixed(2)} m {selectedConduit.manualLengthM ? '(Manual)' : '(3D AEA)'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteConduit(selectedConduit.id)}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Eliminar tramo de cañería"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Diámetro de Cañería */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-amber-950">DIÁMETRO DEL CAÑO (EXTERIOR)</label>
                          <span className="font-mono text-xs font-bold text-amber-900">
                            Ø{selectedConduit.diameterMM} mm
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[19, 22, 25, 32].map((diam) => (
                            <button
                              key={diam}
                              type="button"
                              onClick={() => updateConduit(selectedConduit.id, { diameterMM: diam })}
                              className={`py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${
                                selectedConduit.diameterMM === diam
                                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                                  : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100/60'
                              }`}
                            >
                              Ø{diam}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Material de la Cañería */}
                      <div>
                        <label className="text-[10px] font-bold text-amber-950 block mb-1">MATERIAL DE LA CAÑERÍA</label>
                        <select
                          value={selectedConduit.material}
                          onChange={(e) => updateConduit(selectedConduit.id, { material: e.target.value as ConduitMaterial })}
                          className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="corrugado_blanco">Corrugado Blanco (Liviano)</option>
                          <option value="corrugado_ignifugo">Corrugado Ignífugo (Semipesado)</option>
                          <option value="cano_rigido_pvc">Caño Rígido PVC</option>
                          <option value="cano_acero">Caño de Acero Semipesado</option>
                          <option value="bandeja">Bandeja Portacables</option>
                        </select>
                      </div>

                      {/* Factor de Ocupación AEA 90364-771 (Máx 35%) */}
                      <div className="p-2.5 bg-white border border-amber-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            {occupancy.isCompliant ? (
                              <CheckCircle2 size={14} className="text-emerald-600" />
                            ) : (
                              <AlertTriangle size={14} className="text-red-600" />
                            )}
                            Ocupación AEA:
                          </span>
                          <span className={`font-mono font-bold ${occupancy.isCompliant ? 'text-emerald-700' : 'text-red-700'}`}>
                            {occupancy.occupancyPercent}% / 35.0%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-300 ${
                              occupancy.isCompliant ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                            }`}
                            style={{ width: `${Math.min(100, (occupancy.occupancyPercent / 35) * 100)}%` }}
                          />
                        </div>
                        {!occupancy.isCompliant && (
                          <p className="text-[10px] font-bold text-red-600">
                            ⚠️ Cañería saturada según Norma AEA 90364-771. Aumentar a Ø{selectedConduit.diameterMM < 22 ? '22' : '25'}mm.
                          </p>
                        )}
                      </div>

                      {/* Asignación de Circuitos que pasan por este tramo */}
                      <div>
                        <label className="text-[10px] font-bold text-amber-950 block mb-1">
                          CIRCUITOS EN ESTE TRAMO (MULTICIRCUITO TRAZA)
                        </label>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {project.circuits.map((c) => {
                            const isIncluded = (selectedConduit.circuitIds || [selectedConduit.circuitId]).includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={`flex items-center justify-between p-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                                  isIncluded
                                    ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold'
                                    : 'bg-white border-amber-200/80 text-slate-700 hover:bg-amber-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isIncluded}
                                    onChange={(e) => {
                                      const currentIds = selectedConduit.circuitIds || (selectedConduit.circuitId ? [selectedConduit.circuitId] : []);
                                      let newIds: string[];
                                      if (e.target.checked) {
                                        newIds = Array.from(new Set([...currentIds, c.id]));
                                      } else {
                                        newIds = currentIds.filter((id) => id !== c.id);
                                      }
                                      updateConduit(selectedConduit.id, {
                                        circuitIds: newIds,
                                        circuitId: newIds[0] || null
                                      });
                                    }}
                                    className="rounded text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color || '#2563eb' }} />
                                  <span>{c.name}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500">{c.wireSectionBaseMM2}mm²</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Desglose de Conductores en la Cañería */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-amber-950">
                            CONDUCTORES EN EL TRAMO ({selectedConduit.conductors.length})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newConds = [...selectedConduit.conductors];
                              newConds.push({ role: 'retorno', sectionMM2: 1.5, color: '#ca8a04', reference: 'a' });
                              updateConduit(selectedConduit.id, { conductors: newConds });
                            }}
                            className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-200/70 px-2 py-0.5 rounded-lg transition-colors"
                          >
                            ＋ Añadir Retorno
                          </button>
                        </div>

                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {selectedConduit.conductors.map((cond, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 p-1.5 bg-white border border-amber-200 rounded-xl text-xs"
                            >
                              <select
                                value={cond.role}
                                onChange={(e) => {
                                  const newConds = [...selectedConduit.conductors];
                                  newConds[idx].role = e.target.value as ConductorRole;
                                  updateConduit(selectedConduit.id, { conductors: newConds });
                                }}
                                className="px-1 py-0.5 bg-slate-50 border rounded text-[11px] font-semibold"
                              >
                                <option value="fase">Fase</option>
                                <option value="neutro">Neutro</option>
                                <option value="pe">Tierra (PE)</option>
                                <option value="retorno">Retorno</option>
                                <option value="comando">Comando</option>
                              </select>

                              <select
                                value={cond.sectionMM2}
                                onChange={(e) => {
                                  const newConds = [...selectedConduit.conductors];
                                  newConds[idx].sectionMM2 = parseFloat(e.target.value);
                                  updateConduit(selectedConduit.id, { conductors: newConds });
                                }}
                                className="px-1 py-0.5 bg-slate-50 border rounded text-[11px] font-mono font-bold"
                              >
                                <option value={1.5}>1.5 mm²</option>
                                <option value={2.5}>2.5 mm²</option>
                                <option value={4.0}>4.0 mm²</option>
                                <option value={6.0}>6.0 mm²</option>
                              </select>

                              <input
                                type="text"
                                value={cond.reference || ''}
                                onChange={(e) => {
                                  const newConds = [...selectedConduit.conductors];
                                  newConds[idx].reference = e.target.value;
                                  updateConduit(selectedConduit.id, { conductors: newConds });
                                }}
                                placeholder="Ref: a"
                                className="w-14 px-1 py-0.5 bg-slate-50 border rounded text-[11px] font-mono"
                                title="Referencia de retorno (ej: a, b)"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const newConds = selectedConduit.conductors.filter((_, i) => i !== idx);
                                  updateConduit(selectedConduit.id, { conductors: newConds });
                                }}
                                className="text-slate-400 hover:text-red-600 p-1"
                                title="Eliminar conductor"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. INSPECTOR DE BOCA ELÉCTRICA SELECCIONADA */}
                {selectedElectricalElement && (
                  <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-3.5 space-y-3 shadow-sm animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-white border border-blue-200 rounded-xl shadow-xs">
                          <AeaSymbolIcon symbolId={selectedElectricalElement.symbolId} size={30} />
                        </div>
                        <div>
                          <span className="font-bold text-blue-950 block text-xs">
                            {getSymbolById(selectedElectricalElement.symbolId)?.label || 'Boca Eléctrica'}
                          </span>
                          <span className="text-[10px] font-mono text-blue-700">
                            ({selectedElectricalElement.x.toFixed(2)}, {selectedElectricalElement.y.toFixed(2)}) m
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteElectricalElement(selectedElectricalElement.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Eliminar boca"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Circuito Asignado */}
                    <div>
                      <label className="text-[10px] font-bold text-blue-900 block mb-1">CIRCUITO ASIGNADO (TRAZA)</label>
                      <select
                        value={selectedElectricalElement.circuitId || ''}
                        onChange={(e) =>
                          updateElectricalElement(selectedElectricalElement.id, {
                            circuitId: e.target.value || null
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-xl font-bold text-xs text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Sin Circuito Asignado —</option>
                        {project.circuits.map((circ) => (
                          <option key={circ.id} value={circ.id}>
                            {circ.name} ({circ.wireSectionBaseMM2}mm²)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Referencia de Retorno (si aplica a llaves o luminarias) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-blue-900 block mb-1">DESIGNACIÓN / RÓTULO</label>
                        <input
                          type="text"
                          value={selectedElectricalElement.label || ''}
                          onChange={(e) =>
                            updateElectricalElement(selectedElectricalElement.id, { label: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-xl font-bold text-xs text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Toma 1, Centro 2"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-blue-900 block mb-1">RETORNO (REF TRAZA)</label>
                        <input
                          type="text"
                          value={selectedElectricalElement.returnRef || ''}
                          onChange={(e) =>
                            updateElectricalElement(selectedElectricalElement.id, { returnRef: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-xl font-mono font-bold text-xs text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: a, b"
                          title="Referencia de retorno para vincular llave de efecto y boca de luz"
                        />
                      </div>
                    </div>

                    {/* Montaje */}
                    <div>
                      <label className="text-[10px] font-bold text-blue-900 block mb-1">PLANO DE MONTAJE</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['ceiling', 'wall', 'floor'] as const).map((pl) => (
                          <button
                            key={pl}
                            type="button"
                            onClick={() => {
                              const defZ = pl === 'ceiling' ? 2.70 : pl === 'wall' ? 1.20 : 0.05;
                              updateElectricalElement(selectedElectricalElement.id, {
                                placement: pl,
                                heightZ:
                                  selectedElectricalElement.heightZ === 2.70 ||
                                  selectedElectricalElement.heightZ === 1.20 ||
                                  selectedElectricalElement.heightZ === 0.05
                                    ? defZ
                                    : selectedElectricalElement.heightZ
                              });
                            }}
                            className={`py-1.5 rounded-lg font-semibold text-[10px] border transition-all ${
                              selectedElectricalElement.placement === pl
                                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                : 'bg-white border-blue-200 text-blue-800 hover:bg-blue-100/50'
                            }`}
                          >
                            {pl === 'ceiling' ? 'Cielorraso' : pl === 'wall' ? 'Pared' : 'Piso'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Altura Z */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-blue-900">ALTURA SOBRE EL PISO (Z)</label>
                        <span className="font-mono text-xs font-bold text-blue-950">
                          {selectedElectricalElement.heightZ.toFixed(2)} m
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.05"
                          value={selectedElectricalElement.heightZ}
                          onChange={(e) =>
                            updateElectricalElement(selectedElectricalElement.id, {
                              heightZ: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-20 px-2 py-1 bg-white border border-blue-300 rounded-lg font-mono font-bold text-xs"
                        />
                        <div className="flex-1 flex gap-1">
                          {[0.30, 1.20, 2.20, 2.70].map((hz) => (
                            <button
                              key={hz}
                              type="button"
                              onClick={() => updateElectricalElement(selectedElectricalElement.id, { heightZ: hz })}
                              className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                                Math.abs(selectedElectricalElement.heightZ - hz) < 0.01
                                  ? 'bg-blue-700 text-white border-blue-800 font-bold'
                                  : 'bg-white border-blue-200 text-blue-800 hover:bg-blue-100/60'
                              }`}
                            >
                              {hz.toFixed(2)}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ─── ROTACIÓN / GIRO DEL SÍMBOLO ─── */}
                    <div className="pt-2 border-t border-blue-200/80">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-blue-900">ORIENTACIÓN DEL SÍMBOLO</label>
                        <span className="font-mono text-xs font-bold text-blue-950">
                          {Math.round(selectedElectricalElement.rotation || 0)}°
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[-90, -45, 45, 90].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            onClick={() => {
                              const cur = selectedElectricalElement.rotation || 0;
                              const next = (cur + delta + 360) % 360;
                              updateElectricalElement(selectedElectricalElement.id, { rotation: next });
                            }}
                            className="py-1 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-lg text-[10px] font-mono font-bold text-blue-900"
                          >
                            {delta > 0 ? `+${delta}°` : `${delta}°`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Si está adosado a muro: indicación y cambio exacto de cara física */}
                    {selectedElectricalElement.wallId && (
                      <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-blue-800">
                          Muro: {selectedElectricalElement.side === 'left' ? 'Cara Izquierda' : 'Cara Derecha'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const wall = project.walls.find((w) => w.id === selectedElectricalElement.wallId);
                            if (!wall) return;
                            const vStart = verticesMap.get(wall.startVertexId);
                            const vEnd = verticesMap.get(wall.endVertexId);
                            if (!vStart || !vEnd) return;

                            const dx = vEnd.x - vStart.x;
                            const dy = vEnd.y - vStart.y;
                            const len = Math.hypot(dx, dy);
                            if (len < 0.001) return;

                            const ux = dx / len;
                            const uy = dy / len;
                            const nx = -uy;
                            const ny = ux;

                            const curSide = selectedElectricalElement.side || 'left';
                            const newSide: 'left' | 'right' = curSide === 'left' ? 'right' : 'left';
                            const mult = curSide === 'left' ? -1 : 1;
                            const newX = selectedElectricalElement.x + mult * wall.thickness * nx;
                            const newY = selectedElectricalElement.y + mult * wall.thickness * ny;
                            const curRot = selectedElectricalElement.rotation || 0;

                            updateElectricalElement(selectedElectricalElement.id, {
                              x: Number(newX.toFixed(3)),
                              y: Number(newY.toFixed(3)),
                              side: newSide,
                              rotation: (curRot + 180) % 360
                            });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg text-[10px] font-bold text-blue-900 transition-colors shadow-xs"
                        >
                          <ArrowLeftRight size={12} />
                          <span>Invertir Cara Física</span>
                        </button>
                      </div>
                    )}

                    {/* Estado de relevamiento de TRAZA */}
                    <div className="pt-2 border-t border-blue-200/80">
                      <label className="text-[10px] font-bold text-blue-900 block mb-1">ESTADO DE RELEVAMIENTO (TRAZA)</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { id: 'proyectado', label: 'Proyectado', color: 'bg-blue-600' },
                            { id: 'existente', label: 'Existente', color: 'bg-emerald-600' },
                            { id: 'a_reemplazar', label: 'A Reemplazar', color: 'bg-amber-600' }
                          ] as const
                        ).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() =>
                              updateElectricalElement(selectedElectricalElement.id, { status: st.id })
                            }
                            className={`py-1.5 rounded-lg font-semibold text-[10px] border transition-all ${
                              (selectedElectricalElement.status || 'proyectado') === st.id
                                ? `${st.color} text-white border-transparent shadow-sm`
                                : 'bg-white border-blue-200 text-blue-900 hover:bg-blue-100/50'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Banner de ayuda si no hay nada seleccionado */}
                {!selectedElectricalElement && !selectedConduit && (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-500">
                    Tocá una boca o una cañería en el plano para editar sus características, o elegí un símbolo abajo para emplazar.
                  </div>
                )}

                {/* Botón para Trazar Cañería */}
                <button
                  onClick={onToggleConnectConduit}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    isConnectingConduit
                      ? 'bg-amber-600 border-amber-700 text-white animate-pulse shadow-md'
                      : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100 shadow-xs'
                  }`}
                >
                  <Zap size={16} className={isConnectingConduit ? 'text-white' : 'text-amber-600'} />
                  <span>{isConnectingConduit ? 'Tocá 2 bocas en el plano para unirlas' : 'Trazar Cañería entre Bocas'}</span>
                </button>

                {/* Categorías de símbolos */}
                <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
                  {SYMBOL_CATEGORIES.slice(0, 4).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                        activeCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Grilla de símbolos AEA puros */}
                <div className="grid grid-cols-3 gap-2">
                  {symbols.map((sym) => {
                    const isSelected = selectedSymbolId === sym.id;
                    return (
                      <button
                        key={sym.id}
                        onClick={() => onSelectSymbol(isSelected ? null : sym.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
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
        )}
      </div>
    </aside>
  );
};
