/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: SurveyActionSheets.tsx
 * Diálogos y Menús Contextuales de Paredes, Empalmes en T y Aberturas.
 * Opera mediante referencias a esquinas físicas de los muros.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { getWallLength } from '../../../models/architecture/Wall';
import type { OpeningType, OpeningSwing } from '../../../models/architecture/Opening';
import { calculateConduitOccupancyFactor } from '../../../models/electrical/calculations';
import {
  X,
  DoorOpen,
  Split,
  Trash2,
  SlidersHorizontal,
  ArrowLeftRight,
  ArrowUpDown,
  Zap,
  RotateCw,
  RotateCcw,
  Ruler,
  MapPin,
  Cable
} from 'lucide-react';

interface SurveyActionSheetsProps {
  showTeeModal: boolean;
  onCloseTeeModal: () => void;
  showOpeningModal: boolean;
  onCloseOpeningModal: () => void;
}

export const SurveyActionSheets: React.FC<SurveyActionSheetsProps> = ({
  showTeeModal,
  onCloseTeeModal,
  showOpeningModal,
  onCloseOpeningModal
}) => {
  const {
    project,
    selectedEntity,
    setSelectedEntity,
    addBranchWallFromOffset,
    addOpeningReferenced,
    updateWall,
    updateWallLength,
    rotateWall,
    invertWallDirection,
    deleteWall,
    setActiveAnchorVertexId,
    updateOpening,
    deleteOpening,
    updateElectricalElement,
    deleteElectricalElement,
    updateConduit,
    deleteConduit
  } = useProjectStore();

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // Entidad actualmente seleccionada
  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;
  const selectedElectricalElement =
    selectedEntity?.type === 'electrical_element'
      ? project.electricalElements.find((e) => e.id === selectedEntity.id)
      : null;
  const selectedConduit =
    selectedEntity?.type === 'conduit' ? project.conduits.find((c) => c.id === selectedEntity.id) : null;

  const [isEditingOpeningMobile, setIsEditingOpeningMobile] = useState(false);
  const [isEditingWallMobile, setIsEditingWallMobile] = useState(false);

  // Formulario de Empalme en T
  const [teeOffset, setTeeOffset] = useState('1.50');
  const [teeLength, setTeeLength] = useState('2.50');
  const [teeSide, setTeeSide] = useState<'left' | 'right'>('left');
  const [teeRefVertex, setTeeRefVertex] = useState<string>('');

  // Formulario de Abertura
  const [openingType, setOpeningType] = useState<OpeningType>('door');
  const [openingWidth, setOpeningWidth] = useState('0.80');
  const [openingOffset, setOpeningOffset] = useState('0.60');

  const handleOpenWithOpeningType = (type: OpeningType) => {
    setOpeningType(type);
    if (type === 'door') setOpeningWidth('0.80');
    else if (type === 'window') setOpeningWidth('1.20');
    else if (type === 'passage') setOpeningWidth('0.90');
    const event = new CustomEvent('open-opening-modal');
    window.dispatchEvent(event);
  };

  const handleConfirmTee = () => {
    if (!selectedWall) return;
    const refVId = teeRefVertex || selectedWall.startVertexId;
    addBranchWallFromOffset({
      hostWallId: selectedWall.id,
      referenceVertexId: refVId,
      offsetM: parseFloat(teeOffset) || 0,
      branchLengthM: parseFloat(teeLength) || 0,
      side: teeSide
    });
    onCloseTeeModal();
    setSelectedEntity(null);
  };

  const handleConfirmOpening = () => {
    if (!selectedWall) return;
    addOpeningReferenced({
      hostWallId: selectedWall.id,
      referenceVertexId: selectedWall.startVertexId,
      offsetToJambM: parseFloat(openingOffset) || 0,
      widthM: parseFloat(openingWidth) || 0,
      type: openingType
    });
    onCloseOpeningModal();
    setSelectedEntity(null);
  };

  return (
    <>
      {/* ─── BARRA CONTEXTUAL FLOTANTE AL TOCAR UN MURO (POR ENCIMA DEL DOCK MÓVIL, SOLO MÓVIL) ─── */}
      {selectedWall && !showTeeModal && !showOpeningModal && (
        <aside
          aria-label="Acciones de Muro"
          className="lg:hidden absolute bottom-[185px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 z-30 max-w-[95vw] overflow-x-auto scrollbar-none"
        >
          <div className="px-2 text-[11px] font-mono text-slate-300 whitespace-nowrap">
            Muro: <strong className="text-white">{getWallLength(selectedWall, verticesMap).toFixed(2)}m</strong>
          </div>

          <button
            onClick={() => setIsEditingWallMobile(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap"
            title="Editar muro"
          >
            <SlidersHorizontal size={13} />
            <span>Editar</span>
          </button>

          <button
            onClick={() => handleOpenWithOpeningType('door')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <DoorOpen size={13} />
            <span>+ Puerta</span>
          </button>

          <button
            onClick={() => handleOpenWithOpeningType('window')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <span>+ Ventana</span>
          </button>

          <button
            onClick={() => {
              setTeeRefVertex(selectedWall.startVertexId);
              const event = new CustomEvent('open-tee-modal');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <Split size={13} />
            <span>Empalme T</span>
          </button>

          <button
            onClick={() => deleteWall(selectedWall.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg"
            title="Eliminar muro"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={() => setSelectedEntity(null)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X size={14} />
          </button>
        </aside>
      )}

      {/* ─── MODAL DE EDICIÓN COMPLETA DE MURO (MÓVIL) ─── */}
      {isEditingWallMobile && selectedWall && (() => {
        const wallLen = getWallLength(selectedWall, verticesMap);
        const handleDeltaLen = (delta: number) => {
          const next = Math.max(0.20, Number((wallLen + delta).toFixed(2)));
          updateWallLength(selectedWall.id, next);
        };

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                    <Ruler size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Modificar Pared</h3>
                </div>
                <button
                  onClick={() => setIsEditingWallMobile(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Longitud */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-500">LONGITUD DEL MURO</label>
                  <span className="font-mono text-xs font-bold text-blue-900">
                    {wallLen.toFixed(2)} m
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => handleDeltaLen(-0.50)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800"
                  >
                    -50cm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeltaLen(-0.10)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800"
                  >
                    -10cm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeltaLen(0.10)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800"
                  >
                    +10cm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeltaLen(0.50)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800"
                  >
                    +50cm
                  </button>
                </div>
              </div>

              {/* Espesor */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">ESPESOR DEL MURO</label>
                <div className="grid grid-cols-4 gap-1">
                  {[0.10, 0.15, 0.20, 0.30].map((th) => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => updateWall(selectedWall.id, { thickness: th })}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        Math.abs(selectedWall.thickness - th) < 0.01
                          ? 'bg-blue-600 text-white border-blue-700 font-bold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {Math.round(th * 100)} cm
                    </button>
                  ))}
                </div>
              </div>

              {/* Giro y Sentido */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">ROTACIÓN Y DIRECCIÓN</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => rotateWall(selectedWall.id, -90)}
                    className="flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <RotateCcw size={13} />
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateWall(selectedWall.id, 90)}
                    className="flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <RotateCw size={13} />
                    <span>+90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => invertWallDirection(selectedWall.id)}
                    className="flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Invertir</span>
                  </button>
                </div>
              </div>

              {/* Anclaje */}
              <button
                type="button"
                onClick={() => {
                  setActiveAnchorVertexId(selectedWall.endVertexId);
                  setIsEditingWallMobile(false);
                }}
                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <MapPin size={14} />
                <span>Continuar trazando desde esta pared</span>
              </button>

              {/* Botones de acción */}
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    deleteWall(selectedWall.id);
                    setIsEditingWallMobile(false);
                    setSelectedEntity(null);
                  }}
                  className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors"
                >
                  Eliminar Muro
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingWallMobile(false)}
                  className="flex-1 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── BARRA CONTEXTUAL AL TOCAR UNA ABERTURA (SOLO MÓVIL) ─── */}
      {selectedOpening && !isEditingOpeningMobile && (
        <aside
          aria-label="Acciones de Abertura"
          className="lg:hidden absolute bottom-[185px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 z-30 max-w-[95vw] overflow-x-auto scrollbar-none"
        >
          <div className="px-2 text-xs font-mono text-slate-300 whitespace-nowrap">
            {selectedOpening.type === 'door'
              ? 'Puerta'
              : selectedOpening.type === 'window'
              ? 'Ventana'
              : 'Vano'}
            : <strong className="text-white">{selectedOpening.width.toFixed(2)}m</strong>
          </div>

          {selectedOpening.type === 'door' && (
            <button
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
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap"
              title="Invertir mano bisagra"
            >
              <ArrowLeftRight size={13} />
              <span>Girar Mano</span>
            </button>
          )}

          <button
            onClick={() => setIsEditingOpeningMobile(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <SlidersHorizontal size={13} />
            <span>Editar</span>
          </button>

          <button
            onClick={() => {
              deleteOpening(selectedOpening.id);
              setSelectedEntity(null);
            }}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg"
            title="Eliminar abertura"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={() => setSelectedEntity(null)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X size={14} />
          </button>
        </aside>
      )}

      {/* ─── MODAL DE EDICIÓN COMPLETA DE ABERTURA (MÓVIL) ─── */}
      {isEditingOpeningMobile && selectedOpening && (() => {
        const hostWall = project.walls.find((w) => w.id === selectedOpening.wallId);
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

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800">
                    <DoorOpen size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Gestionar {selectedOpening.type === 'door' ? 'Puerta' : selectedOpening.type === 'window' ? 'Ventana' : 'Vano'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditingOpeningMobile(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO DE ABERTURA</label>
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
                      className={`py-1.5 rounded-lg font-semibold text-xs border transition-all ${
                        selectedOpening.type === t
                          ? 'bg-amber-600 border-amber-700 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'door' ? 'Puerta' : t === 'window' ? 'Ventana' : 'Vano'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ancho */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-500">ANCHO DEL VANO</label>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {selectedOpening.width.toFixed(2)} m
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustWidth(selectedOpening.width - 0.05)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-mono font-bold text-sm"
                  >
                    -
                  </button>
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    {[0.70, 0.80, 0.90, 1.20].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => handleAdjustWidth(w)}
                        className={`py-1 rounded text-xs font-mono border ${
                          Math.abs(selectedOpening.width - w) < 0.01
                            ? 'bg-amber-600 text-white border-amber-600 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {w.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdjustWidth(selectedOpening.width + 0.05)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-mono font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Distancia a esquina */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-500">DISTANCIA A ESQUINA</label>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {selectedOpening.distanceAlongWall.toFixed(2)} m
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustDist(-0.10)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold"
                  >
                    -10cm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDist(-0.05)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold"
                  >
                    -5cm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDist(0.05)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold"
                  >
                    +5cm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDist(0.10)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono font-semibold"
                  >
                    +10cm
                  </button>
                </div>
              </div>

              {/* Sentido de giro (Puerta) */}
              {selectedOpening.type === 'door' && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 block">SENTIDO DE APERTURA</label>
                  <div className="grid grid-cols-2 gap-2">
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
                      className="flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800"
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
                      className="flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <ArrowUpDown size={13} />
                      <span>Invertir Sentido</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    deleteOpening(selectedOpening.id);
                    setIsEditingOpeningMobile(false);
                    setSelectedEntity(null);
                  }}
                  className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingOpeningMobile(false)}
                  className="flex-1 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── BARRA CONTEXTUAL AL TOCAR UNA BOCA ELÉCTRICA (SOLO MÓVIL) ─── */}
      {selectedElectricalElement && (() => {
        const circ = selectedElectricalElement.circuitId
          ? project.circuits.find((c) => c.id === selectedElectricalElement.circuitId)
          : null;

        return (
          <aside
            aria-label="Acciones de Boca Eléctrica"
            className="lg:hidden absolute bottom-[185px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 z-30 max-w-[95vw] overflow-x-auto scrollbar-none animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-1.5 px-2 text-xs font-mono text-slate-300 whitespace-nowrap">
              <Zap size={14} className="text-amber-400" />
              <strong className="text-white">{selectedElectricalElement.label || 'Boca'}</strong>
              <span className="text-[10px] text-slate-400">({selectedElectricalElement.heightZ.toFixed(2)}m)</span>
            </div>

            {/* Ciclar Circuito Asignado */}
            {project.circuits.length > 0 && (
              <button
                onClick={() => {
                  const currentIdx = project.circuits.findIndex((c) => c.id === selectedElectricalElement.circuitId);
                  const nextIdx = (currentIdx + 1) % (project.circuits.length + 1);
                  const nextCircuitId = nextIdx === project.circuits.length ? null : project.circuits[nextIdx].id;
                  updateElectricalElement(selectedElectricalElement.id, { circuitId: nextCircuitId });
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-700"
                title="Cambiar Circuito"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: circ?.color || '#64748b' }}
                />
                <span>{circ ? circ.name.split(' ')[0] : 'S/C'}</span>
              </button>
            )}

            {/* Giro rápido 45° */}
            <button
              onClick={() => {
                const cur = selectedElectricalElement.rotation || 0;
                updateElectricalElement(selectedElectricalElement.id, { rotation: (cur + 45) % 360 });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-xs font-semibold whitespace-nowrap border border-slate-700"
              title="Girar 45°"
            >
              <RotateCw size={13} />
              <span>{Math.round(selectedElectricalElement.rotation || 0)}°</span>
            </button>

            {/* Toggle de Estado de Relevamiento (TRAZA) */}
            <button
              onClick={() => {
                const cur = selectedElectricalElement.status || 'proyectado';
                const next =
                  cur === 'proyectado' ? 'existente' : cur === 'existente' ? 'a_reemplazar' : 'proyectado';
                updateElectricalElement(selectedElectricalElement.id, { status: next });
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap border transition-all ${
                (selectedElectricalElement.status || 'proyectado') === 'existente'
                  ? 'bg-emerald-700 text-white border-emerald-600'
                  : (selectedElectricalElement.status || 'proyectado') === 'a_reemplazar'
                  ? 'bg-amber-700 text-white border-amber-600'
                  : 'bg-blue-700 text-white border-blue-600'
              }`}
            >
              {(selectedElectricalElement.status || 'proyectado').toUpperCase()}
            </button>

            {/* Si está adosada a pared: cambiar de cara física */}
            {selectedElectricalElement.wallId && (
              <button
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
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title="Invertir cara física del muro"
              >
                <ArrowLeftRight size={14} />
              </button>
            )}

            <button
              onClick={() => {
                deleteElectricalElement(selectedElectricalElement.id);
                setSelectedEntity(null);
              }}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg"
              title="Eliminar boca"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => setSelectedEntity(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X size={14} />
            </button>
          </aside>
        );
      })()}

      {/* ─── BARRA CONTEXTUAL AL TOCAR UNA CAÑERÍA (SOLO MÓVIL) ─── */}
      {selectedConduit && (() => {
        const occupancy = calculateConduitOccupancyFactor({
          conduitDiameterMM: selectedConduit.diameterMM,
          conductors: selectedConduit.conductors
        });

        return (
          <aside
            aria-label="Acciones de Cañería"
            className="lg:hidden absolute bottom-[185px] left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 z-30 max-w-[95vw] overflow-x-auto scrollbar-none animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-1.5 px-2 text-xs font-mono text-slate-300 whitespace-nowrap">
              <Cable size={14} className="text-amber-400" />
              <strong className="text-white">Cañería</strong>
            </div>

            {/* Ciclar Diámetro */}
            <button
              onClick={() => {
                const diams = [19, 22, 25, 32];
                const curIdx = diams.indexOf(selectedConduit.diameterMM);
                const nextDiam = diams[(curIdx + 1) % diams.length];
                updateConduit(selectedConduit.id, { diameterMM: nextDiam });
              }}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-xs font-mono font-bold text-amber-300 border border-slate-700 whitespace-nowrap"
              title="Cambiar diámetro exterior"
            >
              Ø{selectedConduit.diameterMM}mm
            </button>

            {/* Badge de Ocupación AEA */}
            <span
              className={`px-2 py-1 rounded-xl text-[10px] font-mono font-bold whitespace-nowrap border ${
                occupancy.isCompliant
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-red-950/80 text-red-300 border-red-700 animate-pulse'
              }`}
            >
              {occupancy.isCompliant ? `✓ ${occupancy.occupancyPercent}% AEA` : `⚠️ ${occupancy.occupancyPercent}% >35%`}
            </span>

            <button
              onClick={() => {
                deleteConduit(selectedConduit.id);
                setSelectedEntity(null);
              }}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg"
              title="Eliminar cañería"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => setSelectedEntity(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X size={14} />
            </button>
          </aside>
        );
      })()}

      {/* ─── MODAL: EMPALME EN T ─── */}
      {showTeeModal && selectedWall && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Empalme de Muro en T</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Nace una nueva pared perpendicular medida a partir de una esquina del muro actual.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Distancia desde la esquina (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={teeOffset}
                  onChange={(e) => setTeeOffset(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Largo de la nueva pared (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={teeLength}
                  onChange={(e) => setTeeLength(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lado de bifurcación</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTeeSide('left')}
                    className={`flex-1 py-1.5 border rounded-lg text-xs font-medium ${
                      teeSide === 'left' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50'
                    }`}
                  >
                    Lado Izquierdo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeeSide('right')}
                    className={`flex-1 py-1.5 border rounded-lg text-xs font-medium ${
                      teeSide === 'right' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50'
                    }`}
                  >
                    Lado Derecho
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={onCloseTeeModal}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTee}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
              >
                Crear Empalme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: INSERTAR ABERTURA ─── */}
      {showOpeningModal && selectedWall && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-3">Insertar Abertura</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Abertura</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpeningType('door');
                      setOpeningWidth('0.80');
                    }}
                    className={`flex-1 py-1.5 rounded-lg border font-semibold ${
                      openingType === 'door' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    Puerta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpeningType('window');
                      setOpeningWidth('1.20');
                    }}
                    className={`flex-1 py-1.5 rounded-lg border font-semibold ${
                      openingType === 'window' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    Ventana
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpeningType('passage');
                      setOpeningWidth('0.90');
                    }}
                    className={`flex-1 py-1.5 rounded-lg border font-semibold ${
                      openingType === 'passage' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    Vano
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ancho (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={openingWidth}
                    onChange={(e) => setOpeningWidth(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg font-mono font-bold"
                  />
                  <div className="flex gap-1 mt-1">
                    {['0.70', '0.80', '0.90', '1.20'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setOpeningWidth(w)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                          openingWidth === w ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-slate-50'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Distancia a esquina (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={openingOffset}
                    onChange={(e) => setOpeningOffset(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg font-mono font-bold"
                  />
                  <div className="flex gap-1 mt-1">
                    {['0.10', '0.20', '0.50', '1.00'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setOpeningOffset(d)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                          openingOffset === d ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-slate-50'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={onCloseOpeningModal}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmOpening}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Insertar Abertura
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
