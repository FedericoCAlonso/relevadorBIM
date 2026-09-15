/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ConduitModal.tsx (Patrón Estricto MVVM)
 * Vista declarativa para inspección y configuración de tramos de cañerías.
 * Delega toda la lógica técnica, catálogos y cálculos al useElectricalViewModel.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type { Conduit, CableStandard, ConductorRole } from '../../../models/electrical/ElectricalModel';
import { useElectricalViewModel } from '../../../viewmodels/useElectricalViewModel';
import { getSymbolById } from '../../../models/electrical/symbolsLib';
import {
  X,
  Cable,
  Trash2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface ConduitModalProps {
  conduit: Conduit | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ConduitModal: React.FC<ConduitModalProps> = ({ conduit, isOpen, onClose }) => {
  const {
    conduitFromElement,
    conduitToElement,
    conduitBreakdown,
    conduitOccupancy,
    circuits,
    catalogs,
    setConduitProperties,
    applyConduitPreset,
    addConductorToConduit,
    updateConduitConductor,
    removeConductorFromConduit,
    removeConduit
  } = useElectricalViewModel();

  if (!isOpen || !conduit) return null;

  const symFrom = conduitFromElement ? getSymbolById(conduitFromElement.symbolId) : null;
  const symTo = conduitToElement ? getSymbolById(conduitToElement.symbolId) : null;

  const autoLengthM = conduitBreakdown ? conduitBreakdown.totalLengthM : 2.5;
  const effectiveLengthM = conduit.manualLengthM || autoLengthM;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-2xl shadow-sm flex items-center justify-center">
              <Cable size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Configurar Tramo de Cañería
              </h3>
              <p className="text-[11px] text-slate-500">
                {conduitFromElement?.label || symFrom?.label || 'Boca A'} ➔ {conduitToElement?.label || symTo?.label || 'Boca B'}
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
          {/* 1. Verificación AEA en tiempo real */}
          {conduitOccupancy && (
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                conduitOccupancy.isCompliant
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-red-50/90 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {conduitOccupancy.isCompliant ? (
                  <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={20} className="text-red-600 flex-shrink-0 animate-bounce" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {conduitOccupancy.isCompliant
                      ? `Factor de Llenado AEA: ${conduitOccupancy.occupancyPercent}% (Máx ${conduitOccupancy.maxAllowedPercent}%)`
                      : `⚠️ CAÑERÍA SATURADA: ${conduitOccupancy.occupancyPercent}% supera el ${conduitOccupancy.maxAllowedPercent}% AEA`}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {conduitOccupancy.isCompliant
                      ? `Sección interna útil adecuada para ${conduit.conductors.length} conductores.`
                      : `Reglamento AEA 90364-771: Aumentar diámetro comercial.`}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono font-bold text-sm">
                <span className={conduitOccupancy.isCompliant ? 'text-emerald-700' : 'text-red-700'}>
                  {conduitOccupancy.occupancyPercent}%
                </span>
              </div>
            </div>
          )}

          {/* 2. Diámetro Exterior Comercial (Desde Catálogo del Modelo) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Diámetro Exterior Comercial:</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {catalogs.diameters.map((d) => {
                const isSelected = conduit.diameterMM === d.mm;
                return (
                  <button
                    key={d.mm}
                    type="button"
                    onClick={() => setConduitProperties(conduit.id, { diameterMM: d.mm })}
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold leading-tight">Ø{d.mm}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {d.inches}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tipo de Conducto / Material (Desde Catálogo del Modelo) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tipo de Conducto (Material):</label>
            <div className="space-y-1.5">
              {catalogs.materials.map((mat) => {
                const isSelected = (conduit.material || catalogs.materials[0].id) === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => setConduitProperties(conduit.id, { material: mat.id })}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className={`font-bold text-xs ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                        {mat.label}
                      </div>
                      <div className="text-[10px] text-slate-500">{mat.description}</div>
                    </div>
                    {isSelected && <span className="text-blue-600 font-bold text-xs">✓ Activo</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Norma / Tipo de Cable (Desde Catálogo del Modelo) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tipo / Norma de Conductor:</label>
            <select
              value={conduit.defaultCableStandard || catalogs.cableStandards[0].id}
              onChange={(e) =>
                setConduitProperties(conduit.id, {
                  defaultCableStandard: e.target.value as CableStandard
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            >
              {catalogs.cableStandards.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.label} — {cs.description}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Circuito Asignado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Circuito Principal:</label>
              <select
                value={conduit.circuitId || ''}
                onChange={(e) =>
                  setConduitProperties(conduit.id, {
                    circuitId: e.target.value ? e.target.value : null
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              >
                <option value="">(Sin circuito asignado)</option>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Longitud del Tramo:</label>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
                <span className="text-slate-500 font-medium">
                  {conduit.manualLengthM ? 'Manual:' : 'Auto 3D AEA:'}
                </span>
                <input
                  type="number"
                  step="0.10"
                  min="0.1"
                  value={effectiveLengthM.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setConduitProperties(conduit.id, { manualLengthM: isNaN(val) ? undefined : val });
                  }}
                  className="w-20 bg-transparent font-mono font-bold text-blue-900 outline-none text-right"
                />
                <span className="font-mono text-slate-400">m</span>
                {conduit.manualLengthM && (
                  <button
                    type="button"
                    onClick={() => setConduitProperties(conduit.id, { manualLengthM: undefined })}
                    className="text-[10px] text-blue-600 underline ml-auto"
                    title="Restaurar cálculo 3D automático"
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desglose Métrico Reglamentario (Planta Ortogonal + Desnivel Z) */}
          {conduitBreakdown && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                <span>Desglose Métrico Reglamentario (Norma AEA 90364-771):</span>
                <span className="font-mono text-blue-800">{conduitBreakdown.totalLengthM.toFixed(2)} m</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-400 block font-sans">1. Planta Ortogonal (dx+dy):</span>
                  <strong className="text-slate-900">{conduitBreakdown.distPlantaOrthogonal.toFixed(2)} m</strong>
                  <span className="text-[9px] text-slate-400 block font-sans">
                    dx:{conduitBreakdown.dx}m + dy:{conduitBreakdown.dy}m
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-400 block font-sans">2. Desnivel Z (|Δh|):</span>
                  <strong className="text-slate-900">{conduitBreakdown.dzLocal.toFixed(2)} m</strong>
                  <span className="text-[9px] text-slate-400 block font-sans">
                    z1:{conduitFromElement?.heightZ.toFixed(2)}m ➔ z2:{conduitToElement?.heightZ.toFixed(2)}m
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 block font-sans">3. Curvas & Desperdicio:</span>
                  <strong className="text-slate-900">
                    {(conduitBreakdown.totalLengthM - (conduitBreakdown.distPlantaOrthogonal + conduitBreakdown.dzLocal + conduitBreakdown.dzNiveles)).toFixed(2)} m
                  </strong>
                  <span className="text-[9px] text-slate-400 block font-sans">+10% reglamentario AEA</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Presets Rápidos de Conductores (Desde Catálogo del Modelo) */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700">Llenado Rápido Reglamentario (Presets AEA):</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {catalogs.conductorPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyConduitPreset(conduit.id, preset.id)}
                  className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors"
                >
                  <div className="font-bold text-slate-800">{preset.label}</div>
                  <div className="text-[10px] text-slate-400">{preset.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 7. Lista Detallada de Conductores */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700">
                Conductores en el Tramo ({conduit.conductors.length}):
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addConductorToConduit(conduit.id, 'fase', 2.5)}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold"
                >
                  + Fase
                </button>
                <button
                  type="button"
                  onClick={() => addConductorToConduit(conduit.id, 'neutro', 2.5)}
                  className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-lg text-[10px] font-bold"
                >
                  + Neutro
                </button>
                <button
                  type="button"
                  onClick={() => addConductorToConduit(conduit.id, 'pe', 2.5)}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-bold"
                >
                  + Tierra
                </button>
                <button
                  type="button"
                  onClick={() => addConductorToConduit(conduit.id, 'retorno', 1.5)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[10px] font-bold"
                >
                  + Retorno
                </button>
              </div>
            </div>

            {conduit.conductors.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-slate-400">
                No hay conductores agregados. Elegí un preset arriba o agregá manualmente.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {conduit.conductors.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {/* Rol */}
                    <div className="flex items-center gap-1.5 min-w-[100px]">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color || '#64748b' }}
                      />
                      <select
                        value={c.role}
                        onChange={(e) => {
                          const role = e.target.value as ConductorRole;
                          updateConduitConductor(conduit.id, idx, { role });
                        }}
                        className="bg-transparent font-bold text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="fase">Fase (L)</option>
                        <option value="neutro">Neutro (N)</option>
                        <option value="pe">Tierra (PE)</option>
                        <option value="retorno">Retorno</option>
                        <option value="fase_r">Fase R</option>
                        <option value="fase_s">Fase S</option>
                        <option value="fase_t">Fase T</option>
                        <option value="comando">Comando</option>
                      </select>
                    </div>

                    {/* Si es retorno: selector de letra */}
                    {c.role === 'retorno' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Efecto:</span>
                        <input
                          type="text"
                          maxLength={2}
                          value={c.reference || 'a'}
                          onChange={(e) =>
                            updateConduitConductor(conduit.id, idx, { reference: e.target.value })
                          }
                          className="w-8 px-1 py-0.5 bg-white border border-slate-300 rounded text-center font-mono font-bold uppercase text-xs"
                        />
                      </div>
                    )}

                    {/* Sección mm² */}
                    <div className="flex items-center gap-1">
                      <select
                        value={c.sectionMM2}
                        onChange={(e) =>
                          updateConduitConductor(conduit.id, idx, {
                            sectionMM2: parseFloat(e.target.value)
                          })
                        }
                        className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-blue-900"
                      >
                        {[1.5, 2.5, 4.0, 6.0, 10.0, 16.0].map((sec) => (
                          <option key={sec} value={sec}>
                            {sec.toFixed(1)} mm²
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => removeConductorFromConduit(conduit.id, idx)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Quitar conductor"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 8. Notas / Observaciones */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notas / Observaciones del tramo:</label>
            <input
              type="text"
              value={conduit.notes || ''}
              onChange={(e) => setConduitProperties(conduit.id, { notes: e.target.value })}
              placeholder="Ej: Embutido en losa de hormigón armado, caja de paso intermedia..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-normal focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              removeConduit(conduit.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-bold transition-colors"
          >
            <Trash2 size={16} />
            <span>Eliminar Cañería</span>
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
