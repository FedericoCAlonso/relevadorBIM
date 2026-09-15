/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: SurveyActionSheets.tsx
 * Diálogos y Menús Contextuales para Flujos de Relevamiento Referenciado.
 * Incluye el Acople de Ambiente por Jamba, Empalme en T y Carga de Aberturas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { getWallLength } from '../../../models/architecture/Wall';
import { X, DoorOpen, Split, Trash2 } from 'lucide-react';

interface SurveyActionSheetsProps {
  showInitialRoomModal: boolean;
  onCloseInitialRoomModal: () => void;
}

export const SurveyActionSheets: React.FC<SurveyActionSheetsProps> = ({
  showInitialRoomModal,
  onCloseInitialRoomModal
}) => {
  const {
    project,
    selectedEntity,
    setSelectedEntity,
    createInitialRoom,
    linkNewRoomFromDoor,
    createTeeWallBranch,
    addOpening,
    deleteOpening
  } = useProjectStore();

  // Estados de modales contextuales
  const [showDoorLinkModal, setShowDoorLinkModal] = useState(false);
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);

  // Formulario: Ambiente Inicial
  const [initName, setInitName] = useState('Living Comedor');
  const [initWidth, setInitWidth] = useState('4.00');
  const [initLength, setInitLength] = useState('5.00');

  // Formulario: Acople por Jamba de Puerta
  const [doorLinkParams, setDoorLinkParams] = useState({
    distanceCornerToJamb: 0.50,
    whichJamb: 1 as 1 | 2,
    side: 'left' as 'left' | 'right',
    newRoomWidth: 3.50,
    newRoomDepth: 3.20,
    name: 'Dormitorio 1'
  });

  // Formulario: Empalme en T
  const [teeParams, setTeeParams] = useState({
    offsetFromStart: 2.00,
    branchLength: 2.50,
    side: 'left' as 'left' | 'right'
  });

  // Formulario: Nueva Abertura
  const [openingParams, setOpeningParams] = useState({
    type: 'door' as 'door' | 'window' | 'passage',
    width: 0.80,
    distanceAlongWall: 0.60
  });

  // Mapa de vértices para cálculo de longitud
  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // Entidad actualmente seleccionada
  const selectedWall = selectedEntity?.type === 'wall' ? project.walls.find((w) => w.id === selectedEntity.id) : null;
  const selectedOpening =
    selectedEntity?.type === 'opening' ? project.openings.find((o) => o.id === selectedEntity.id) : null;

  // ─── ACCIONES DE CONFIRMACIÓN ───────────────────────────────────────────

  const handleConfirmInitialRoom = () => {
    const w = parseFloat(initWidth);
    const l = parseFloat(initLength);
    if (!isNaN(w) && !isNaN(l) && w > 0 && l > 0) {
      createInitialRoom({ name: initName, width: w, length: l });
      onCloseInitialRoomModal();
    }
  };

  const handleConfirmDoorLink = () => {
    if (!selectedOpening) return;
    linkNewRoomFromDoor({
      hostWallId: selectedOpening.wallId,
      openingId: selectedOpening.id,
      distanceCornerToJamb: Number(doorLinkParams.distanceCornerToJamb),
      whichJamb: doorLinkParams.whichJamb,
      side: doorLinkParams.side,
      newRoomWidth: Number(doorLinkParams.newRoomWidth),
      newRoomDepth: Number(doorLinkParams.newRoomDepth),
      name: doorLinkParams.name
    });
    setShowDoorLinkModal(false);
    setSelectedEntity(null);
  };

  const handleConfirmTee = () => {
    if (!selectedWall) return;
    createTeeWallBranch({
      hostWallId: selectedWall.id,
      offsetFromStart: Number(teeParams.offsetFromStart),
      branchLength: Number(teeParams.branchLength),
      side: teeParams.side
    });
    setShowTeeModal(false);
    setSelectedEntity(null);
  };

  const handleConfirmOpening = () => {
    if (!selectedWall) return;
    addOpening({
      id: `open-${Date.now()}`,
      wallId: selectedWall.id,
      type: openingParams.type,
      width: Number(openingParams.width),
      height: openingParams.type === 'door' ? 2.05 : 1.10,
      sill: openingParams.type === 'door' ? 0.0 : 0.90,
      distanceAlongWall: Number(openingParams.distanceAlongWall),
      swing: 'left_in'
    });
    setShowOpeningModal(false);
    setSelectedEntity(null);
  };

  return (
    <>
      {/* ─── BARRA CONTEXTUAL FLOTANTE (INFERIOR) AL SELECCIONAR ELEMENTO ─── */}
      {selectedWall && (
        <aside aria-label="Acciones de Muro" className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2.5 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-700 z-10">
          <div className="px-2 text-xs font-mono text-slate-300">
            Pared: <strong className="text-white">{getWallLength(selectedWall, verticesMap).toFixed(2)} m</strong>
          </div>
          <button
            onClick={() => setShowOpeningModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-medium"
          >
            <DoorOpen size={14} />
            <span>+ Abertura</span>
          </button>
          <button
            onClick={() => setShowTeeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-medium"
          >
            <Split size={14} />
            <span>Empalme en T</span>
          </button>
          <button
            onClick={() => setSelectedEntity(null)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X size={14} />
          </button>
        </aside>
      )}

      {selectedOpening && (
        <aside aria-label="Acciones de Abertura" className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2.5 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-700 z-10">
          <div className="px-2 text-xs font-mono text-slate-300">
            Abertura: <strong className="text-white">{selectedOpening.width.toFixed(2)} m</strong>
          </div>
          {selectedOpening.type === 'door' && (
            <button
              onClick={() => setShowDoorLinkModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-medium shadow-sm"
            >
              <DoorOpen size={14} />
              <span>🔗 Nuevo Ambiente desde esta Puerta</span>
            </button>
          )}
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

      {/* ─── MODAL: AMBIENTE INICIAL ─── */}
      {showInitialRoomModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-3">Nuevo Ambiente Inicial</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={initName}
                  onChange={(e) => setInitName(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ancho (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={initWidth}
                    onChange={(e) => setInitWidth(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Largo (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={initLength}
                    onChange={(e) => setInitLength(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={onCloseInitialRoomModal}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmInitialRoom}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Crear Ambiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ACOPLE DE AMBIENTE POR JAMBA ─── */}
      {showDoorLinkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Acople de Ambiente por Jamba</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Medida desde la esquina interior del nuevo ambiente hacia el marco de la puerta existente.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre del Ambiente</label>
                <input
                  type="text"
                  value={doorLinkParams.name}
                  onChange={(e) => setDoorLinkParams({ ...doorLinkParams, name: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Distancia Esquina $\to$ Jamba ($d_2$ en metros)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={doorLinkParams.distanceCornerToJamb}
                  onChange={(e) =>
                    setDoorLinkParams({ ...doorLinkParams, distanceCornerToJamb: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-1.5 border rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ancho (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={doorLinkParams.newRoomWidth}
                    onChange={(e) =>
                      setDoorLinkParams({ ...doorLinkParams, newRoomWidth: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Profundidad (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={doorLinkParams.newRoomDepth}
                    onChange={(e) =>
                      setDoorLinkParams({ ...doorLinkParams, newRoomDepth: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expansión del ambiente</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDoorLinkParams({ ...doorLinkParams, side: 'left' })}
                    className={`flex-1 py-1.5 border rounded-lg text-xs font-medium ${
                      doorLinkParams.side === 'left' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50'
                    }`}
                  >
                    Hacia la Izquierda
                  </button>
                  <button
                    type="button"
                    onClick={() => setDoorLinkParams({ ...doorLinkParams, side: 'right' })}
                    className={`flex-1 py-1.5 border rounded-lg text-xs font-medium ${
                      doorLinkParams.side === 'right' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50'
                    }`}
                  >
                    Hacia la Derecha
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowDoorLinkModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDoorLink}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Acoplar Ambiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: EMPALME EN T ─── */}
      {showTeeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Empalme de Muro en T</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Genera una pared perpendicular naciendo a una distancia fija a lo largo del muro.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Distancia desde el inicio (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={teeParams.offsetFromStart}
                  onChange={(e) => setTeeParams({ ...teeParams, offsetFromStart: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Largo de la nueva pared (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={teeParams.branchLength}
                  onChange={(e) => setTeeParams({ ...teeParams, branchLength: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lado del muro</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTeeParams({ ...teeParams, side: 'left' })}
                    className={`flex-1 py-1.5 border rounded-lg text-xs font-medium ${
                      teeParams.side === 'left' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50'
                    }`}
                  >
                    Lado Izquierdo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeeParams({ ...teeParams, side: 'right' })}
                    className={`flex-1 py-1.5 border rounded-lg text-xs font-medium ${
                      teeParams.side === 'right' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50'
                    }`}
                  >
                    Lado Derecho
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowTeeModal(false)}
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

      {/* ─── MODAL: NUEVA ABERTURA ─── */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-3">Insertar Abertura</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Abertura</label>
                <select
                  value={openingParams.type}
                  onChange={(e) => setOpeningParams({ ...openingParams, type: e.target.value as any })}
                  className="w-full px-3 py-1.5 border rounded-lg bg-white"
                >
                  <option value="door">Puerta batiente (0.80m)</option>
                  <option value="window">Ventana (1.20m)</option>
                  <option value="passage">Vano libre (Paso)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ancho libre (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={openingParams.width}
                    onChange={(e) => setOpeningParams({ ...openingParams, width: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Distancia en pared (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={openingParams.distanceAlongWall}
                    onChange={(e) =>
                      setOpeningParams({ ...openingParams, distanceAlongWall: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 border rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowOpeningModal(false)}
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
