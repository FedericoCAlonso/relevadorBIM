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
import type { OpeningType } from '../../../models/architecture/Opening';
import { X, DoorOpen, Split, Trash2 } from 'lucide-react';

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
    deleteWall,
    deleteOpening
  } = useProjectStore();

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // Entidad actualmente seleccionada
  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;

  // Formulario de Empalme en T
  const [teeOffset, setTeeOffset] = useState('1.50');
  const [teeLength, setTeeLength] = useState('2.50');
  const [teeSide, setTeeSide] = useState<'left' | 'right'>('left');
  const [teeRefVertex, setTeeRefVertex] = useState<string>('');

  // Formulario de Abertura
  const [openingType, setOpeningType] = useState<OpeningType>('door');
  const [openingWidth, setOpeningWidth] = useState('0.80');
  const [openingOffset, setOpeningOffset] = useState('0.60');

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
      {/* ─── BARRA CONTEXTUAL FLOTANTE AL TOCAR UN MURO ─── */}
      {selectedWall && !showTeeModal && !showOpeningModal && (
        <aside
          aria-label="Acciones de Muro"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 z-10"
        >
          <div className="px-2 text-xs font-mono text-slate-300">
            Muro: <strong className="text-white">{getWallLength(selectedWall, verticesMap).toFixed(2)} m</strong>
          </div>

          <button
            onClick={() => {
              setTeeRefVertex(selectedWall.startVertexId);
              // Abrir modal de empalme
              const event = new CustomEvent('open-tee-modal');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-medium"
          >
            <Split size={14} />
            <span>Empalme en T</span>
          </button>

          <button
            onClick={() => {
              const event = new CustomEvent('open-opening-modal');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-medium"
          >
            <DoorOpen size={14} />
            <span>+ Abertura</span>
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

      {/* ─── BARRA CONTEXTUAL AL TOCAR UNA ABERTURA ─── */}
      {selectedOpening && (
        <aside
          aria-label="Acciones de Abertura"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 z-10"
        >
          <div className="px-2 text-xs font-mono text-slate-300">
            {selectedOpening.type === 'door' ? 'Puerta' : 'Ventana'}:{' '}
            <strong className="text-white">{selectedOpening.width.toFixed(2)} m</strong>
          </div>
          <button
            onClick={() => deleteOpening(selectedOpening.id)}
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
                <label className="block font-semibold text-slate-700 mb-1">Tipo</label>
                <select
                  value={openingType}
                  onChange={(e) => setOpeningType(e.target.value as OpeningType)}
                  className="w-full px-3 py-1.5 border rounded-lg bg-white"
                >
                  <option value="door">Puerta batiente (0.80 m)</option>
                  <option value="window">Ventana (1.20 m)</option>
                  <option value="passage">Vano libre (Paso)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ancho (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={openingWidth}
                    onChange={(e) => setOpeningWidth(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Distancia a esquina (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={openingOffset}
                    onChange={(e) => setOpeningOffset(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
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
