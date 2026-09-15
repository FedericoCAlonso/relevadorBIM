/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ElectricalElementModal.tsx
 * Modal de Inspección y Configuración Detallada de Boca Eléctrica.
 * Compatible con Móvil y Escritorio (Norma AEA 90364-771 y Modelo TRAZA).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type { ElectricalElement, ElementPlacement } from '../../../models/electrical/ElectricalModel';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { getSymbolById } from '../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from './AeaSymbolIcon';
import {
  X,
  Trash2,
  ArrowLeftRight,
  Plus
} from 'lucide-react';

interface ElectricalElementModalProps {
  element: ElectricalElement | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ElectricalElementModal: React.FC<ElectricalElementModalProps> = ({
  element,
  isOpen,
  onClose
}) => {
  const { project, updateElectricalElement, deleteElectricalElement, setSelectedEntity } = useProjectStore();

  if (!isOpen || !element) return null;

  const symbol = getSymbolById(element.symbolId);
  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const wall = element.wallId ? project.walls.find((w) => w.id === element.wallId) : null;

  // Atributos clave-valor dinámicos (TRAZA)
  const attributes = element.attributes || [];

  const addAttribute = (key = '', value = '') => {
    const updated = [...attributes, { key, value }];
    updateElectricalElement(element.id, { attributes: updated });
  };

  const updateAttribute = (idx: number, patch: Partial<{ key: string; value: string }>) => {
    const updated = [...attributes];
    updated[idx] = { ...updated[idx], ...patch };
    updateElectricalElement(element.id, { attributes: updated });
  };

  const removeAttribute = (idx: number) => {
    const updated = attributes.filter((_, i) => i !== idx);
    updateElectricalElement(element.id, { attributes: updated });
  };

  // Presets de altura reglamentaria AEA
  const heightPresets = [
    { label: 'Zócalo (0.30m)', value: 0.30, desc: 'Tomas bajos' },
    { label: 'Mesada (0.90m)', value: 0.90, desc: 'Cocina/Baño' },
    { label: 'Llave (1.20m)', value: 1.20, desc: 'Puntos y tomas' },
    { label: 'Alto (2.20m)', value: 2.20, desc: 'AA / Campana' },
    { label: 'Techo (2.70m)', value: 2.70, desc: 'Centros y apliques' }
  ];

  // Invertir cara del muro
  const handleInvertWallSide = () => {
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

    const curSide = element.side || 'left';
    const newSide: 'left' | 'right' = curSide === 'left' ? 'right' : 'left';
    const mult = curSide === 'left' ? -1 : 1;
    const newX = element.x + mult * wall.thickness * nx;
    const newY = element.y + mult * wall.thickness * ny;
    const curRot = element.rotation || 0;

    updateElectricalElement(element.id, {
      x: Number(newX.toFixed(3)),
      y: Number(newY.toFixed(3)),
      side: newSide,
      rotation: (curRot + 180) % 360
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
              <AeaSymbolIcon symbolId={element.symbolId} size={28} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                {symbol?.label || 'Boca Eléctrica'}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                ({element.x.toFixed(2)}, {element.y.toFixed(2)}) m · {element.placement.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo Scrolleable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Rótulo y Circuito */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Rótulo / Nombre:</label>
              <input
                type="text"
                value={element.label || ''}
                onChange={(e) => updateElectricalElement(element.id, { label: e.target.value })}
                placeholder="Ej: Boca 1, Toma Cocina, Llave A"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Circuito Asignado:</label>
              <select
                value={element.circuitId || ''}
                onChange={(e) =>
                  updateElectricalElement(element.id, {
                    circuitId: e.target.value ? e.target.value : null
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              >
                <option value="">(Sin Circuito / No asignado)</option>
                {project.circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type} - {c.breakerAmperageA}A)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Altura de Montaje Z */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700">Altura sobre piso (Z):</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="6"
                  value={element.heightZ}
                  onChange={(e) =>
                    updateElectricalElement(element.id, {
                      heightZ: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-blue-900"
                />
                <span className="font-mono text-slate-500 font-bold">m</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {heightPresets.map((hp) => {
                const isSelected = Math.abs(element.heightZ - hp.value) < 0.02;
                return (
                  <button
                    key={hp.value}
                    type="button"
                    onClick={() => updateElectricalElement(element.id, { heightZ: hp.value })}
                    className={`px-2 py-1.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-mono leading-tight">{hp.value.toFixed(2)}m</div>
                    <div className={`text-[9px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {hp.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Ubicación y Geometría en Pared / Piso / Techo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipo de Montaje:</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['ceiling', 'wall', 'floor'] as ElementPlacement[]).map((pl) => (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => updateElectricalElement(element.id, { placement: pl })}
                    className={`py-1.5 rounded-lg text-center font-semibold transition-all ${
                      element.placement === pl ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pl === 'ceiling' ? 'Techo' : pl === 'wall' ? 'Pared' : 'Piso'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Rotación del Símbolo:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={Math.round(element.rotation || 0)}
                  onChange={(e) =>
                    updateElectricalElement(element.id, {
                      rotation: (parseFloat(e.target.value) || 0) % 360
                    })
                  }
                  className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold text-xs"
                />
                <span className="font-mono text-slate-400">°</span>
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => updateElectricalElement(element.id, { rotation: deg })}
                    className={`flex-1 py-1.5 rounded-xl border font-mono text-[11px] transition-colors ${
                      Math.round(element.rotation || 0) === deg
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Si está adosado a pared: selector de cara */}
          {wall && (
            <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-2xl">
              <div>
                <span className="font-bold text-blue-950 block">Cara física del muro:</span>
                <span className="text-[11px] text-blue-800">
                  Adosado a {element.side === 'left' ? 'Cara Izquierda' : 'Cara Derecha'} ({Math.round(wall.thickness * 100)}cm)
                </span>
              </div>
              <button
                type="button"
                onClick={handleInvertWallSide}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold shadow-sm"
              >
                <ArrowLeftRight size={13} />
                <span>Invertir Cara</span>
              </button>
            </div>
          )}

          {/* 4. Carga Eléctrica, Fases y Retorno */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Potencia (W / VA):</label>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={element.powerW ?? ''}
                  onChange={(e) =>
                    updateElectricalElement(element.id, {
                      powerW: e.target.value ? parseFloat(e.target.value) : undefined
                    })
                  }
                  placeholder="Ej: 100"
                  className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none"
                />
                <span className="font-mono text-slate-400 font-semibold">VA</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Letra de Retorno:</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  maxLength={3}
                  value={element.returnRef || ''}
                  onChange={(e) => updateElectricalElement(element.id, { returnRef: e.target.value })}
                  placeholder="Ej: a"
                  className="w-14 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold text-xs uppercase"
                />
                {['a', 'b', 'c'].map((letra) => (
                  <button
                    key={letra}
                    type="button"
                    onClick={() => updateElectricalElement(element.id, { returnRef: letra })}
                    className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs font-bold uppercase"
                  >
                    {letra}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Alimentación:</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateElectricalElement(element.id, { phases: 1 })}
                  className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                    (element.phases || 1) === 1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  1F (220V)
                </button>
                <button
                  type="button"
                  onClick={() => updateElectricalElement(element.id, { phases: 3 })}
                  className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                    element.phases === 3 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  3F (380V)
                </button>
              </div>
            </div>
          </div>

          {/* 5. Estado de Relevamiento (TRAZA) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Estado de Relevamiento:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'existente', label: 'Existente', bg: 'bg-emerald-600 text-white', inactive: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                { id: 'proyectado', label: 'Proyectado', bg: 'bg-blue-600 text-white', inactive: 'bg-blue-50 text-blue-800 border-blue-200' },
                { id: 'a_reemplazar', label: 'A Reemplazar', bg: 'bg-amber-600 text-white', inactive: 'bg-amber-50 text-amber-800 border-amber-200' }
              ].map((st) => {
                const isActive = (element.status || 'proyectado') === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => updateElectricalElement(element.id, { status: st.id as any })}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border text-center transition-all ${
                      isActive ? `${st.bg} shadow-sm border-transparent` : `${st.inactive} hover:opacity-80`
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Atributos Personalizados Clave-Valor (Modelo TRAZA) */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-slate-700 block">
                  Propiedades Arbitrarias / Metadatos (TRAZA):
                </label>
                <span className="text-[10px] text-slate-500">
                  Array de clave-valor ({attributes.length} {attributes.length === 1 ? 'propiedad' : 'propiedades'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => addAttribute()}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all"
              >
                <Plus size={13} />
                <span>+ Agregar</span>
              </button>
            </div>

            {/* Atajos Rápidos de Claves Sugeridas */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
              <span className="text-[10px] text-slate-400 font-semibold mr-1 flex-shrink-0">Sugerencias:</span>
              {['Marca', 'Modelo', 'IP', 'Tipo Lámpara', 'Consumo'].map((sugKey) => (
                <button
                  key={sugKey}
                  type="button"
                  onClick={() => addAttribute(sugKey, '')}
                  className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-medium whitespace-nowrap flex-shrink-0 transition-colors"
                >
                  +{sugKey}
                </button>
              ))}
            </div>

            {attributes.length === 0 ? (
              <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px]">
                El array está vacío por defecto. Tocá <strong>+ Agregar</strong> para añadir propiedades técnicas libres.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Clave (ej: Marca)"
                      value={attr.key}
                      onChange={(e) => updateAttribute(idx, { key: e.target.value })}
                      className="w-1/3 min-w-[85px] px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Valor (ej: Schneider)"
                      value={attr.value}
                      onChange={(e) => updateAttribute(idx, { value: e.target.value })}
                      className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttribute(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Eliminar propiedad"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. Notas de Relevamiento */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notas / Observaciones:</label>
            <textarea
              rows={2}
              value={element.notes || ''}
              onChange={(e) => updateElectricalElement(element.id, { notes: e.target.value })}
              placeholder="Ej: Caja rectangular de chapa a cambiar, caño corrugado saturado..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-normal focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none resize-none"
            />
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              deleteElectricalElement(element.id);
              setSelectedEntity(null);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-bold transition-colors"
          >
            <Trash2 size={16} />
            <span>Eliminar Boca</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl font-bold shadow-md transition-all text-center"
          >
            Listo / Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
