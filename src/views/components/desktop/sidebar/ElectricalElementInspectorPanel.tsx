import React, { memo } from 'react';
import {
  SlidersHorizontal,
  GitBranch,
  Trash2,
  ArrowLeftRight,
  RotateCw
} from 'lucide-react';
import {
  CAD_SNAP_CONFIG,
  AEA_MOUNTING_HEIGHTS,
  ELEMENT_PLACEMENT_OPTIONS
} from '../../../../config';
import { useProjectStore } from '../../../../viewmodels/useProjectStore';
import { useElectricalViewModel } from '../../../../viewmodels/useElectricalViewModel';
import type { ElectricalElement, ElementPlacement } from '../../../../models/electrical/ElectricalModel';
import type { WallVertex } from '../../../../models/architecture/Wall';
import { flipWallMountedNodeSide } from '../../../../models/architecture/Wall';
import { getSymbolById } from '../../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from '../../electrical/AeaSymbolIcon';

interface ElectricalElementInspectorPanelProps {
  selectedElectricalElement: ElectricalElement;
  verticesMap: Map<string, WallVertex>;
}

export const ElectricalElementInspectorPanel: React.FC<ElectricalElementInspectorPanelProps> = memo(({
  selectedElectricalElement,
  verticesMap
}) => {
  const {
    project,
    updateElectricalElement,
    deleteElectricalElement
  } = useProjectStore();
  const { catalogs } = useElectricalViewModel();

  const handleFlipWallSide = () => {
    if (!selectedElectricalElement.wallId) return;
    const wall = project.walls.find((w) => w.id === selectedElectricalElement.wallId);
    if (!wall) return;

    const flipped = flipWallMountedNodeSide(selectedElectricalElement, wall, verticesMap);
    if (flipped) {
      updateElectricalElement(selectedElectricalElement.id, flipped);
    }
  };

  const handleToggleBoxOrientation = () => {
    const curOri = selectedElectricalElement.boxOrientation || 'vertical';
    const nextOri = curOri === 'vertical' ? 'horizontal' : 'vertical';
    updateElectricalElement(selectedElectricalElement.id, {
      boxOrientation: nextOri,
      boxRotationDeg: nextOri === 'horizontal' ? 90 : 0
    });
  };

  return (
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-element-edit-modal'))}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1"
            title="Abrir propiedades completas"
          >
            <SlidersHorizontal size={12} />
            <span>Propiedades</span>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-branch-edit-modal'))}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1"
            title="Modificar toda la rama interconectada"
          >
            <GitBranch size={12} />
            <span>Rama</span>
          </button>
          <button
            type="button"
            onClick={() => deleteElectricalElement(selectedElectricalElement.id)}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
            title="Eliminar boca"
          >
            <Trash2 size={15} />
          </button>
        </div>
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
          {ELEMENT_PLACEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const defZ = opt.defaultHeightZ;
                updateElectricalElement(selectedElectricalElement.id, {
                  placement: opt.id as ElementPlacement,
                  heightZ:
                    selectedElectricalElement.heightZ === 2.70 ||
                    selectedElectricalElement.heightZ === 1.20 ||
                    selectedElectricalElement.heightZ === 0.05
                      ? defZ
                      : selectedElectricalElement.heightZ
                });
              }}
              className={`py-1.5 rounded-lg font-semibold text-[10px] border transition-all ${
                selectedElectricalElement.placement === opt.id
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white border-blue-200 text-blue-800 hover:bg-blue-100/50'
              }`}
            >
              {opt.label}
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
            {AEA_MOUNTING_HEIGHTS.slice(0, 4).map((h) => h.heightM).map((hz) => (
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
          {CAD_SNAP_CONFIG.DESKTOP_QUICK_ANGLES_DEG.map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => {
                const cur = selectedElectricalElement.rotation || 0;
                const next = (cur + delta + 360) % 360;
                updateElectricalElement(selectedElectricalElement.id, { rotation: next });
              }}
              className="py-1 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-lg text-[10px] font-mono font-bold text-blue-900 cursor-pointer"
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
            onClick={handleFlipWallSide}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg text-[10px] font-bold text-blue-900 transition-colors shadow-xs cursor-pointer"
          >
            <ArrowLeftRight size={12} />
            <span>Invertir Cara Física</span>
          </button>
          <button
            type="button"
            onClick={handleToggleBoxOrientation}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg text-[10px] font-bold text-blue-900 transition-colors shadow-xs cursor-pointer"
            title="Alternar orientación física de la caja"
          >
            <RotateCw size={12} />
            <span>Caja: {selectedElectricalElement.boxOrientation === 'horizontal' ? 'Horizontal (10×5)' : 'Vertical (5×10)'}</span>
          </button>
        </div>
      )}

      {/* Estado de relevamiento de TRAZA */}
      <div className="pt-2 border-t border-blue-200/80">
        <label className="text-[10px] font-bold text-blue-900 block mb-1">ESTADO DE RELEVAMIENTO (TRAZA)</label>
        <div className="grid grid-cols-3 gap-1">
          {catalogs.installationStates.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() =>
                updateElectricalElement(selectedElectricalElement.id, { status: st.id })
              }
              className={`py-1.5 rounded-lg font-semibold text-[10px] border transition-all cursor-pointer ${
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
  );
});
