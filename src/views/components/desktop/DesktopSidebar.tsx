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
import { SYMBOL_CATEGORIES, getSymbolsByCategory } from '../../../models/electrical/symbolsLib';
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
  DoorOpen
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
    deleteWall,
    deleteOpening,
    updateSpace,
    autoDetectSpaces
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'survey' | 'spaces' | 'electrical'>('survey');
  const [activeCategory, setActiveCategory] = useState<string>('iluminacion');

  // Cambiar pestaña automáticamente cuando el usuario toca un elemento en el lienzo
  useEffect(() => {
    if (selectedEntity?.type === 'space') {
      setActiveTab('spaces');
    } else if (selectedEntity?.type === 'wall' || selectedEntity?.type === 'opening') {
      setActiveTab('survey');
    }
  }, [selectedEntity]);

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;

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
            </div>

            {/* Inspector de Abertura Seleccionada (si se hizo clic en una) */}
            {selectedOpening && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <DoorOpen size={15} className="text-amber-700" />
                    <span className="font-bold text-amber-900">
                      Abertura: {selectedOpening.type === 'door' ? 'Puerta' : selectedOpening.type === 'window' ? 'Ventana' : 'Vano libre'}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteOpening(selectedOpening.id)}
                    className="p-1 text-red-500 hover:text-red-700 rounded"
                    title="Eliminar abertura"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700">
                  <div className="bg-white p-1.5 rounded-lg border border-amber-100">
                    <span className="text-[10px] text-slate-400 block font-sans">Ancho:</span>
                    <strong>{selectedOpening.width.toFixed(2)} m</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-amber-100">
                    <span className="text-[10px] text-slate-400 block font-sans">Dist. a esquina:</span>
                    <strong>{selectedOpening.distanceAlongWall.toFixed(2)} m</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Inspector de Muro Seleccionado */}
            {selectedWall ? (
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">Muro Seleccionado</span>
                  <button
                    onClick={() => deleteWall(selectedWall.id)}
                    className="p-1 text-red-500 hover:text-red-700 rounded"
                    title="Eliminar muro"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="text-[11px] text-slate-600 font-mono">
                  Largo: <strong>{getWallLength(selectedWall, verticesMap).toFixed(2)} m</strong> · Espesor:{' '}
                  <strong>{selectedWall.thickness * 100} cm</strong>
                </div>

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
                    Clavar {openingType === 'door' ? 'Puerta' : openingType === 'window' ? 'Ventana' : 'Vano'}
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

        {/* ════════════ PESTAÑA 3: RED ELÉCTRICA AEA ════════════ */}
        {activeTab === 'electrical' && (
          <div className="space-y-3">
            {/* Trazado de cañería */}
            <button
              onClick={onToggleConnectConduit}
              className={`w-full py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                isConnectingConduit
                  ? 'bg-amber-600 border-amber-700 text-white animate-pulse'
                  : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Zap size={15} />
              <span>{isConnectingConduit ? 'Tocá 2 bocas en el plano para unirlas' : 'Trazar Cañería'}</span>
            </button>

            {/* Categorías */}
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

            {/* Grilla de símbolos */}
            <div className="grid grid-cols-3 gap-1.5">
              {symbols.map((sym) => {
                const isSelected = selectedSymbolId === sym.id;
                return (
                  <button
                    key={sym.id}
                    onClick={() => onSelectSymbol(isSelected ? null : sym.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                      isSelected ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className="w-7 h-7 flex items-center justify-center text-slate-700"
                      dangerouslySetInnerHTML={{ __html: sym.svgContent }}
                    />
                    <span className="text-[9px] font-medium text-slate-600 mt-1 truncate w-full text-center">
                      {sym.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
