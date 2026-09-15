/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: SurveyActionSheets.tsx
 * Diálogos y Menús Contextuales de Paredes, Empalmes en T y Aberturas.
 * Opera mediante referencias a esquinas físicas de los muros.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { getWallLength } from '../../../models/architecture/Wall';
import type { OpeningType, OpeningSwing } from '../../../models/architecture/Opening';
import {
  X,
  DoorOpen,
  ArrowLeftRight,
  ArrowUpDown,
  RotateCw,
  RotateCcw,
  Ruler,
  MapPin
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
    deleteOpening
  } = useProjectStore();

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // Entidad actualmente seleccionada
  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;

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

  useEffect(() => {
    const handleOpeningEvent = (e: any) => {
      const type = e.detail?.type;
      if (type) {
        setOpeningType(type);
        if (type === 'door') setOpeningWidth('0.80');
        else if (type === 'window') setOpeningWidth('1.20');
        else if (type === 'passage') setOpeningWidth('0.90');
      }
    };
    const handleTeeEvent = (e: any) => {
      if (e.detail?.refVertexId) setTeeRefVertex(e.detail.refVertexId);
    };
    const handleOpenWallEdit = () => setIsEditingWallMobile(true);
    const handleOpenOpeningEdit = () => setIsEditingOpeningMobile(true);

    window.addEventListener('open-opening-modal', handleOpeningEvent);
    window.addEventListener('open-tee-modal', handleTeeEvent);
    window.addEventListener('open-wall-edit-modal', handleOpenWallEdit);
    window.addEventListener('open-opening-edit-modal', handleOpenOpeningEdit);

    return () => {
      window.removeEventListener('open-opening-modal', handleOpeningEvent);
      window.removeEventListener('open-tee-modal', handleTeeEvent);
      window.removeEventListener('open-wall-edit-modal', handleOpenWallEdit);
      window.removeEventListener('open-opening-edit-modal', handleOpenOpeningEdit);
    };
  }, []);

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
