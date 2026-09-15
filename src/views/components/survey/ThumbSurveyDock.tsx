/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ThumbSurveyDock.tsx
 * Controlador Móvil Unificado y Ergonómico (Zona Natural del Pulgar).
 * Resuelve desbordes y encimamiento en pantallas pequeñas mediante:
 * 1. Pestañas de modo limpias: [ 📐 Muros ] vs [ ⚡ Eléctrico ]
 * 2. Inspector Contextual cuando hay un elemento seleccionado (Pared, Abertura, Boca, Cañería)
 * 3. Diseño flex adaptable sin desbordes horizontales para anchos desde 320px
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useLaserViewModel } from '../../../viewmodels/useLaserViewModel';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { RelativeTurnType } from '../../../viewmodels/useSurveyViewModel';
import type { OpeningSwing } from '../../../models/architecture/Opening';
import { getWallLength } from '../../../models/architecture/Wall';
import { calculateConduitOccupancyFactor } from '../../../models/electrical/calculations';
import { SYMBOL_CATEGORIES, getSymbolsByCategory, getSymbolById } from '../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from '../electrical/AeaSymbolIcon';
import {
  Bluetooth,
  RotateCw,
  RotateCcw,
  MoveUp,
  Plus,
  CornerDownLeft,
  SlidersHorizontal,
  Undo2,
  Zap,
  Ruler,
  DoorOpen,
  Split,
  Trash2,
  X,
  Cable,
  ArrowLeftRight,
  ArrowUpDown
} from 'lucide-react';

interface ThumbSurveyDockProps {
  relativeTurn: RelativeTurnType;
  onSelectTurn: (turn: RelativeTurnType) => void;
  customAngle: number;
  onChangeCustomAngle: (deg: number) => void;
  currentDistance: string;
  onChangeDistance: (val: string) => void;
  onCommitWall: () => void;
  selectedSymbolId?: string | null;
  onSelectSymbol?: (symbolId: string | null) => void;
  isConnectingConduit?: boolean;
  onToggleConnectConduit?: () => void;
}

export const ThumbSurveyDock: React.FC<ThumbSurveyDockProps> = ({
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
    activeAnchorVertexId,
    project,
    selectedEntity,
    setSelectedEntity,
    undoLastWall,
    deleteWall,
    updateOpening,
    deleteOpening,
    updateElectricalElement,
    deleteElectricalElement,
    updateConduit,
    deleteConduit
  } = useProjectStore();

  const [dockMode, setDockMode] = useState<'survey' | 'electrical'>('survey');
  const [activeCategory, setActiveCategory] = useState<string>('iluminacion');
  const [showCustomAngleInput, setShowCustomAngleInput] = useState(false);

  // Distanciómetro Bluetooth
  const { status, connect, disconnect } = useLaserViewModel((distM) => {
    onChangeDistance(distM.toFixed(3));
  });

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // Entidades seleccionadas
  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;
  const selectedElectricalElement =
    selectedEntity?.type === 'electrical_element'
      ? project.electricalElements.find((e) => e.id === selectedEntity.id)
      : null;
  const selectedConduit =
    selectedEntity?.type === 'conduit' ? project.conduits.find((c) => c.id === selectedEntity.id) : null;

  const anchorVertex = activeAnchorVertexId ? verticesMap.get(activeAnchorVertexId) : null;
  const anchorLabel = anchorVertex
    ? `(${anchorVertex.x.toFixed(2)}, ${anchorVertex.y.toFixed(2)})`
    : project.vertices.length === 0
    ? '(0, 0)'
    : 'Tocá esquina';

  // ═════════════════════════════════════════════════════════════════════════
  // CASO 1: INSPECTOR CONTEXTUAL (Elemento Seleccionado en el Plano)
  // ═════════════════════════════════════════════════════════════════════════
  if (selectedWall || selectedOpening || selectedElectricalElement || selectedConduit) {
    return (
      <footer className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl p-2.5 pb-6 flex flex-col gap-2 z-20 touch-manipulation animate-in slide-in-from-bottom duration-150">
        {/* ── Inspector de Muro ── */}
        {selectedWall && (() => {
          const wallLen = getWallLength(selectedWall, verticesMap);
          return (
            <>
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                  <Ruler size={14} className="text-blue-600 flex-shrink-0" />
                  <span className="font-bold">Muro:</span>
                  <span className="font-mono font-bold text-blue-950">{wallLen.toFixed(2)}m</span>
                  <span className="text-slate-400 text-[11px]">({Math.round(selectedWall.thickness * 100)}cm)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                  title="Cerrar selección"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-wall-edit-modal'))}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  <SlidersHorizontal size={13} />
                  <span>Modificar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const event = new CustomEvent('open-opening-modal', { detail: { type: 'door' } });
                    window.dispatchEvent(event);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  <DoorOpen size={13} />
                  <span>+ Puerta</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const event = new CustomEvent('open-opening-modal', { detail: { type: 'window' } });
                    window.dispatchEvent(event);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  <span>+ Ventana</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-tee-modal'))}
                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  <Split size={13} />
                  <span>Empalme T</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    deleteWall(selectedWall.id);
                    setSelectedEntity(null);
                  }}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors ml-auto flex-shrink-0"
                  title="Eliminar muro"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          );
        })()}

        {/* ── Inspector de Abertura (Puerta / Ventana) ── */}
        {selectedOpening && (
          <>
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                <DoorOpen size={14} className="text-blue-600 flex-shrink-0" />
                <span className="font-bold">{selectedOpening.type === 'door' ? 'Puerta' : 'Ventana'}:</span>
                <span className="font-mono font-bold text-blue-950">{selectedOpening.width.toFixed(2)}m</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntity(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {selectedOpening.type === 'door' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-300"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Invertir Mano</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-300"
                  >
                    <ArrowUpDown size={13} />
                    <span>Invertir Sentido</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-opening-edit-modal'))}
                className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-semibold whitespace-nowrap"
              >
                <SlidersHorizontal size={13} />
                <span>Editar Medidas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  deleteOpening(selectedOpening.id);
                  setSelectedEntity(null);
                }}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors ml-auto flex-shrink-0"
                title="Eliminar abertura"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}

        {/* ── Inspector de Boca Eléctrica ── */}
        {selectedElectricalElement && (() => {
          const circ = selectedElectricalElement.circuitId
            ? project.circuits.find((c) => c.id === selectedElectricalElement.circuitId)
            : null;

          return (
            <>
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                  <Zap size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="font-bold truncate">{selectedElectricalElement.label || 'Boca'}</span>
                  <span className="text-slate-400 text-[11px]">({selectedElectricalElement.heightZ.toFixed(2)}m)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                {/* Ciclar Circuito */}
                {project.circuits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const curIdx = project.circuits.findIndex((c) => c.id === selectedElectricalElement.circuitId);
                      const nextIdx = (curIdx + 1) % (project.circuits.length + 1);
                      const nextCircuitId = nextIdx === project.circuits.length ? null : project.circuits[nextIdx].id;
                      updateElectricalElement(selectedElectricalElement.id, { circuitId: nextCircuitId });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-300"
                    title="Ciclar circuito"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: circ?.color || '#94a3b8' }}
                    />
                    <span>{circ ? circ.name.split(' ')[0] : 'Sin Circuito'}</span>
                  </button>
                )}

                {/* Girar 45° */}
                <button
                  type="button"
                  onClick={() => {
                    const cur = selectedElectricalElement.rotation || 0;
                    updateElectricalElement(selectedElectricalElement.id, { rotation: (cur + 45) % 360 });
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-300"
                >
                  <RotateCw size={13} />
                  <span>{Math.round(selectedElectricalElement.rotation || 0)}°</span>
                </button>

                {/* Si está en pared: Invertir Cara */}
                {selectedElectricalElement.wallId && (
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
                    className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-300"
                    title="Invertir cara del muro"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Cara</span>
                  </button>
                )}

                {/* Estado (Proyectado / Existente / Reemplazar) */}
                <button
                  type="button"
                  onClick={() => {
                    const cur = selectedElectricalElement.status || 'proyectado';
                    const next =
                      cur === 'proyectado' ? 'existente' : cur === 'existente' ? 'a_reemplazar' : 'proyectado';
                    updateElectricalElement(selectedElectricalElement.id, { status: next });
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all ${
                    (selectedElectricalElement.status || 'proyectado') === 'existente'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : (selectedElectricalElement.status || 'proyectado') === 'a_reemplazar'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}
                >
                  {(selectedElectricalElement.status || 'proyectado').toUpperCase()}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    deleteElectricalElement(selectedElectricalElement.id);
                    setSelectedEntity(null);
                  }}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors ml-auto flex-shrink-0"
                  title="Eliminar boca"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          );
        })()}

        {/* ── Inspector de Cañería ── */}
        {selectedConduit && (() => {
          const occupancy = calculateConduitOccupancyFactor({
            conduitDiameterMM: selectedConduit.diameterMM,
            conductors: selectedConduit.conductors
          });

          return (
            <>
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                  <Cable size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="font-bold">Cañería:</span>
                  <span className="font-mono font-bold text-amber-700">Ø{selectedConduit.diameterMM}mm</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                {/* Ciclar Diámetro */}
                <button
                  type="button"
                  onClick={() => {
                    const diams = [19, 22, 25, 32];
                    const curIdx = diams.indexOf(selectedConduit.diameterMM);
                    const nextDiam = diams[(curIdx + 1) % diams.length];
                    updateConduit(selectedConduit.id, { diameterMM: nextDiam });
                  }}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-mono font-bold whitespace-nowrap"
                  title="Cambiar diámetro"
                >
                  Ø {selectedConduit.diameterMM} mm
                </button>

                {/* Badge Ocupación AEA */}
                <span
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold whitespace-nowrap border ${
                    occupancy.isCompliant
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-red-50 text-red-800 border-red-300 animate-pulse'
                  }`}
                >
                  {occupancy.isCompliant ? `✓ ${occupancy.occupancyPercent}% AEA` : `⚠️ ${occupancy.occupancyPercent}% >35%`}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    deleteConduit(selectedConduit.id);
                    setSelectedEntity(null);
                  }}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors ml-auto flex-shrink-0"
                  title="Eliminar cañería"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          );
        })()}
      </footer>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CASO 2: BOTONERA OPERATIVA (Muros vs Eléctrico sin superposiciones)
  // ═════════════════════════════════════════════════════════════════════════
  const symbols = getSymbolsByCategory(activeCategory);
  const selectedSymDef = selectedSymbolId ? getSymbolById(selectedSymbolId) : null;

  return (
    <footer className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl p-2.5 pb-6 flex flex-col gap-2 z-20 touch-manipulation">
      {/* ─── PESTAÑAS DE MODO PRINCIPAL + BLUETOOTH / ACCIONES ─── */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setDockMode('survey');
              if (selectedSymbolId) onSelectSymbol?.(null);
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              dockMode === 'survey' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ruler size={13} />
            <span>Muros</span>
          </button>
          <button
            type="button"
            onClick={() => setDockMode('electrical')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              dockMode === 'electrical' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap size={13} />
            <span>Eléctrico</span>
          </button>
        </div>

        {dockMode === 'survey' ? (
          <button
            type="button"
            onClick={status.isConnected ? disconnect : connect}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0 ${
              status.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={status.isConnected ? 'Desconectar distanciómetro' : 'Conectar distanciómetro Bluetooth'}
          >
            <Bluetooth size={12} className={status.isConnected ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="max-w-[110px] truncate">
              {status.isConnected ? status.deviceName || 'Conectado' : 'Láser'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleConnectConduit}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
              isConnectingConduit
                ? 'bg-amber-600 text-white animate-pulse shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Zap size={12} className={isConnectingConduit ? 'text-white' : 'text-amber-600'} />
            <span>{isConnectingConduit ? 'Unir 2 bocas' : 'Trazar Caño'}</span>
          </button>
        )}
      </div>

      {/* ════════════ MODO 1: LEVANTAMIENTO DE MUROS ════════════ */}
      {dockMode === 'survey' && (
        <>
          {/* Anclaje */}
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 px-1 truncate">
            <span className="text-blue-600 font-bold">📍 Anclaje:</span>
            <span className="font-mono text-slate-800 font-semibold truncate">{anchorLabel}</span>
          </div>

          {/* Fila Métrica y Giros Relativos (Sin desborde) */}
          <div className="flex items-center gap-1.5">
            {/* Campo Largo */}
            <div className="flex-1 min-w-[90px] flex items-center bg-slate-100 border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 mr-1.5 flex-shrink-0">L</span>
              <input
                type="number"
                step="0.05"
                value={currentDistance}
                onChange={(e) => onChangeDistance(e.target.value)}
                className="w-full bg-transparent font-mono font-bold text-lg text-slate-900 focus:outline-none min-w-0"
                placeholder="3.50"
              />
              <span className="font-mono text-xs font-semibold text-slate-400 flex-shrink-0">m</span>
            </div>

            {/* Segmented Control de Giros (Compacto y responsivo) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-300 flex-shrink-0">
              <button
                type="button"
                onClick={() => onSelectTurn('right')}
                className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  relativeTurn === 'right' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Giro a la derecha (+90°)"
              >
                <RotateCw size={13} />
                <span>Der</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTurn('left')}
                className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  relativeTurn === 'left' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Giro a la izquierda (-90°)"
              >
                <RotateCcw size={13} />
                <span>Izq</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTurn('straight')}
                className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  relativeTurn === 'straight' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Continuar recto (0°)"
              >
                <MoveUp size={13} />
                <span>0°</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustomAngleInput(!showCustomAngleInput)}
                className={`p-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  relativeTurn === 'custom' || showCustomAngleInput
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Ángulo personalizado"
              >
                <SlidersHorizontal size={13} />
              </button>
            </div>
          </div>

          {/* Sub-fila de ángulo libre */}
          {showCustomAngleInput && (
            <div className="flex items-center justify-between gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-[11px] font-semibold text-slate-600">Ángulo:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={customAngle}
                  onChange={(e) => {
                    const deg = parseFloat(e.target.value) || 0;
                    onChangeCustomAngle(deg);
                    onSelectTurn('custom');
                  }}
                  className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-xs"
                />
                <span className="font-mono text-slate-400 text-xs">°</span>
              </div>
              <div className="flex gap-1">
                {[45, 135, 30, 60].map((quickDeg) => (
                  <button
                    key={quickDeg}
                    type="button"
                    onClick={() => {
                      onChangeCustomAngle(quickDeg);
                      onSelectTurn('custom');
                    }}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-lg text-[10px] font-mono hover:bg-slate-100"
                  >
                    {quickDeg}°
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botón Gigante y Deshacer */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undoLastWall}
              disabled={project.walls.length === 0}
              className="h-12 px-3.5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 font-bold rounded-2xl border border-slate-300 transition-all flex-shrink-0"
              title="Deshacer última pared"
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              onClick={onCommitWall}
              className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg transition-all"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>AGREGAR PARED</span>
              <CornerDownLeft size={15} className="text-blue-200 ml-0.5" />
            </button>
          </div>
        </>
      )}

      {/* ════════════ MODO 2: CATÁLOGO Y SÍMBOLOS ELÉCTRICOS AEA ════════════ */}
      {dockMode === 'electrical' && (
        <>
          {/* Categorías AEA */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            {SYMBOL_CATEGORIES.slice(0, 5).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Tira horizontal de símbolos */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5">
            {symbols.map((sym) => {
              const isSelected = selectedSymbolId === sym.id;
              return (
                <button
                  key={sym.id}
                  type="button"
                  onClick={() => onSelectSymbol?.(isSelected ? null : sym.id)}
                  className={`flex flex-col items-center justify-center p-1.5 min-w-[62px] max-w-[68px] rounded-xl border transition-all flex-shrink-0 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={sym.label}
                >
                  <AeaSymbolIcon
                    symbolId={sym.id}
                    size={24}
                    color={isSelected ? '#2563eb' : '#334155'}
                    isSelected={isSelected}
                  />
                  <span className="text-[9px] font-medium text-slate-600 mt-0.5 truncate w-full text-center">
                    {sym.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Banner de estado al seleccionar una boca */}
          {selectedSymbolId && (
            <div className="flex items-center justify-between gap-2 p-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              <span className="truncate text-[11px] font-medium">
                📍 Tocá el plano para emplazar: <strong>{selectedSymDef?.label || 'Boca'}</strong>
              </span>
              <button
                type="button"
                onClick={() => onSelectSymbol?.(null)}
                className="px-2 py-0.5 bg-blue-200 hover:bg-blue-300 text-blue-900 rounded-lg text-[10px] font-bold flex-shrink-0"
              >
                ✕ Cancelar
              </button>
            </div>
          )}
        </>
      )}
    </footer>
  );
};
