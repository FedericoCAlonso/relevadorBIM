/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: SpaceEditModal.tsx
 * Modal / Bottom Sheet para Edición de Ambientes en Móvil y Escritorio.
 * Permite nombrar el recinto (ej: Living, Cocina, Dormitorio) y definir
 * la altura de cielorraso / techo (h) para cómputos cúbicos y electromecánicos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { calculatePolygonArea, resolveSpacePolygon } from '../../../models/architecture/Space';
import { X, Building2, Check, ArrowUpToLine } from 'lucide-react';

interface SpaceEditModalProps {
  spaceId: string | null;
  onClose: () => void;
}

const ROOM_SUGGESTIONS = [
  'Living Comedor',
  'Cocina',
  'Dormitorio 1',
  'Dormitorio 2',
  'Baño',
  'Lavadero',
  'Pasillo',
  'Balcón',
  'Quincho'
];

const HEIGHT_PRESETS = [2.40, 2.60, 2.70, 2.80, 3.00];

export const SpaceEditModal: React.FC<SpaceEditModalProps> = ({ spaceId, onClose }) => {
  const { project, updateSpace } = useProjectStore();

  if (!spaceId) return null;

  const space = project.spaces.find((s) => s.id === spaceId);
  if (!space) return null;

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const poly = resolveSpacePolygon(space, verticesMap);
  const area = poly.length >= 3 ? calculatePolygonArea(poly) : 0;
  const volume = area * space.ceilingHeight;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Propiedades del Ambiente</h3>
              <p className="text-[11px] text-slate-500">Superficie y altura de techo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Métricas Calculadas */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Superficie Neta
            </span>
            <span className="text-base font-bold font-mono text-slate-800">
              {area.toFixed(2)} <span className="text-xs font-normal text-slate-500">m²</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Volumen de Aire
            </span>
            <span className="text-base font-bold font-mono text-slate-800">
              {volume.toFixed(2)} <span className="text-xs font-normal text-slate-500">m³</span>
            </span>
          </div>
        </div>

        {/* Campo de Nombre */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">NOMBRE DE LA HABITACIÓN</label>
          <input
            type="text"
            value={space.name}
            onChange={(e) => updateSpace(space.id, { name: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            placeholder="Ej: Living Comedor"
          />

          {/* Pastillas de sugerencia rápida */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ROOM_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => updateSpace(space.id, { name: sug })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  space.name === sug
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Campo de Altura de Techo (h) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ArrowUpToLine size={15} className="text-blue-600" />
              <label className="text-xs font-bold text-slate-700">ALTURA DE TECHO (h)</label>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.05"
                value={space.ceilingHeight}
                onChange={(e) =>
                  updateSpace(space.id, { ceilingHeight: parseFloat(e.target.value) || 2.70 })
                }
                className="w-20 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <span className="font-mono text-xs text-slate-500 font-bold">m</span>
            </div>
          </div>

          {/* Pastillas de alturas predefinidas */}
          <div className="flex gap-1.5 justify-end">
            {HEIGHT_PRESETS.map((hp) => (
              <button
                key={hp}
                type="button"
                onClick={() => updateSpace(space.id, { ceilingHeight: hp })}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all ${
                  Math.abs(space.ceilingHeight - hp) < 0.01
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'
                }`}
              >
                {hp.toFixed(2)}m
              </button>
            ))}
          </div>
        </div>

        {/* Botón de Guardar / Aceptar */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-2"
        >
          <Check size={16} strokeWidth={2.5} />
          <span>GUARDAR CAMBIOS</span>
        </button>
      </div>
    </div>
  );
};
