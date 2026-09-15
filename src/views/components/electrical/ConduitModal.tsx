/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ConduitModal.tsx
 * Modal de Configuración Técnica Integral de Tramo de Cañería.
 * Conductos, Conductores, Materiales, Circuitos y Verificación AEA <=35%.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type {
  Conduit,
  ConduitMaterial,
  CableStandard,
  ConductorLine,
  ConductorRole
} from '../../../models/electrical/ElectricalModel';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { calculateConduitOccupancyFactor, calculateConduitRealLength } from '../../../models/electrical/calculations';
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

const MATERIAL_OPTIONS: Array<{ id: ConduitMaterial; label: string; desc: string }> = [
  { id: 'corrugado_ignifugo', label: 'Corrugado Gris Ignífugo', desc: 'Semipesado IRAM 62386 (Norma AEA)' },
  { id: 'cano_rigido_pvc', label: 'Caño Rígido PVC', desc: 'Semipesado / Curvado en caliente' },
  { id: 'cano_acero', label: 'Caño de Acero Semipesado RS', desc: 'Hierro esmaltado / galvanizado' },
  { id: 'corrugado_blanco', label: 'Corrugado Blanco Liviano', desc: '⚠️ No reglamentario para losas' },
  { id: 'bandeja', label: 'Bandeja Portacables', desc: 'Canalización a la vista / suspendida' }
];

const DIAMETER_OPTIONS = [
  { mm: 16, inch: '5/8"' },
  { mm: 19, inch: '3/4"' },
  { mm: 22, inch: '7/8"' },
  { mm: 25, inch: '1"' },
  { mm: 32, inch: '1 1/4"' },
  { mm: 38, inch: '1 1/2"' }
];

const CABLE_STANDARDS: Array<{ id: CableStandard; label: string; desc: string }> = [
  { id: 'IRAM_NM_247_3', label: 'IRAM NM 247-3 (Unipolar PVC)', desc: 'Antiflama 450/750V estándar' },
  { id: 'IRAM_62267_LSOH', label: 'IRAM 62267 (Libre Halógenos)', desc: 'Baja emisión humos tóxicos LSOH' },
  { id: 'IRAM_2178_SUB', label: 'IRAM 2178 (Subterráneo / Sintenax)', desc: 'Aislación XLPE / Intemperie 1kV' },
  { id: 'IRAM_NM_247_5', label: 'IRAM NM 247-5 (Tipo Taller)', desc: 'Vaina redonda flexible' }
];

export const ConduitModal: React.FC<ConduitModalProps> = ({ conduit, isOpen, onClose }) => {
  const { project, updateConduit, deleteConduit, setSelectedEntity } = useProjectStore();

  if (!isOpen || !conduit) return null;

  const elFrom = project.electricalElements.find((e) => e.id === conduit.fromElementId);
  const elTo = project.electricalElements.find((e) => e.id === conduit.toElementId);
  const symFrom = elFrom ? getSymbolById(elFrom.symbolId) : null;
  const symTo = elTo ? getSymbolById(elTo.symbolId) : null;

  const levelsMap = new Map(project.levels.map((l) => [l.id, l]));
  const autoLengthM =
    elFrom && elTo ? calculateConduitRealLength({ fromElement: elFrom, toElement: elTo, levelsMap }) : 2.5;
  const effectiveLengthM = conduit.manualLengthM || autoLengthM;

  // Factor de ocupación AEA
  const occupancy = calculateConduitOccupancyFactor({
    conduitDiameterMM: conduit.diameterMM,
    conductors: conduit.conductors
  });

  // Presets de conductores reglamentarios
  const applyPreset = (preset: '2x1.5_PE' | '2x2.5_PE' | '2x4.0_PE' | '3x2.5_PE' | '3x4.0_N_PE') => {
    let conds: ConductorLine[] = [];
    switch (preset) {
      case '2x1.5_PE':
        conds = [
          { role: 'fase', sectionMM2: 1.5, color: '#92400e' },
          { role: 'neutro', sectionMM2: 1.5, color: '#0284c7' },
          { role: 'pe', sectionMM2: 1.5, color: '#16a34a' }
        ];
        break;
      case '2x2.5_PE':
        conds = [
          { role: 'fase', sectionMM2: 2.5, color: '#92400e' },
          { role: 'neutro', sectionMM2: 2.5, color: '#0284c7' },
          { role: 'pe', sectionMM2: 2.5, color: '#16a34a' }
        ];
        break;
      case '2x4.0_PE':
        conds = [
          { role: 'fase', sectionMM2: 4.0, color: '#92400e' },
          { role: 'neutro', sectionMM2: 4.0, color: '#0284c7' },
          { role: 'pe', sectionMM2: 2.5, color: '#16a34a' }
        ];
        break;
      case '3x2.5_PE':
        conds = [
          { role: 'fase', sectionMM2: 2.5, color: '#92400e' },
          { role: 'neutro', sectionMM2: 2.5, color: '#0284c7' },
          { role: 'retorno', sectionMM2: 1.5, color: '#64748b', reference: 'a' },
          { role: 'pe', sectionMM2: 2.5, color: '#16a34a' }
        ];
        break;
      case '3x4.0_N_PE':
        conds = [
          { role: 'fase_r', sectionMM2: 4.0, color: '#92400e' },
          { role: 'fase_s', sectionMM2: 4.0, color: '#0f172a' },
          { role: 'fase_t', sectionMM2: 4.0, color: '#dc2626' },
          { role: 'neutro', sectionMM2: 4.0, color: '#0284c7' },
          { role: 'pe', sectionMM2: 2.5, color: '#16a34a' }
        ];
        break;
    }
    updateConduit(conduit.id, { conductors: conds });
  };

  // Agregar conductor individual
  const addConductor = (role: ConductorRole, defaultSection: number) => {
    let color = '#92400e';
    if (role === 'neutro') color = '#0284c7';
    if (role === 'pe') color = '#16a34a';
    if (role === 'retorno') color = '#64748b';

    const newConds = [
      ...conduit.conductors,
      {
        role,
        sectionMM2: defaultSection,
        color,
        reference: role === 'retorno' ? 'a' : undefined
      }
    ];
    updateConduit(conduit.id, { conductors: newConds });
  };

  const removeConductor = (idx: number) => {
    const newConds = conduit.conductors.filter((_, i) => i !== idx);
    updateConduit(conduit.id, { conductors: newConds });
  };

  const updateConductorItem = (idx: number, patch: Partial<ConductorLine>) => {
    const newConds = [...conduit.conductors];
    newConds[idx] = { ...newConds[idx], ...patch };
    updateConduit(conduit.id, { conductors: newConds });
  };

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
                {elFrom?.label || symFrom?.label || 'Boca A'} ➔ {elTo?.label || symTo?.label || 'Boca B'}
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
          {/* 1. Verificación AEA en tiempo real (Banner superior de seguridad) */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              occupancy.isCompliant
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-red-50/90 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {occupancy.isCompliant ? (
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle size={20} className="text-red-600 flex-shrink-0 animate-bounce" />
              )}
              <div>
                <div className="font-bold text-xs">
                  {occupancy.isCompliant
                    ? `Factor de Llenado Reglamentario AEA: ${occupancy.occupancyPercent}% (Máx 35%)`
                    : `⚠️ CAÑERÍA SATURADA: ${occupancy.occupancyPercent}% supera el 35% AEA`}
                </div>
                <div className="text-[11px] opacity-80">
                  {occupancy.isCompliant
                    ? `Sección interna útil adecuada para ${conduit.conductors.length} conductores.`
                    : `Reglamento AEA 90364-771: Se requiere aumentar diámetro a Ø${
                        conduit.diameterMM < 22 ? '22' : conduit.diameterMM < 25 ? '25' : '32'
                      } mm.`}
                </div>
              </div>
            </div>
            <div className="text-right font-mono font-bold text-sm">
              <span className={occupancy.isCompliant ? 'text-emerald-700' : 'text-red-700'}>
                {occupancy.occupancyPercent}%
              </span>
            </div>
          </div>

          {/* 2. Diámetro Exterior Nominal */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Diámetro Exterior Comercial:</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {DIAMETER_OPTIONS.map((d) => {
                const isSelected = conduit.diameterMM === d.mm;
                return (
                  <button
                    key={d.mm}
                    type="button"
                    onClick={() => updateConduit(conduit.id, { diameterMM: d.mm })}
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold leading-tight">Ø{d.mm}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {d.inch}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tipo de Conducto / Material */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tipo de Conducto (Material):</label>
            <div className="space-y-1.5">
              {MATERIAL_OPTIONS.map((mat) => {
                const isSelected = (conduit.material || 'corrugado_ignifugo') === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => updateConduit(conduit.id, { material: mat.id })}
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
                      <div className="text-[10px] text-slate-500">{mat.desc}</div>
                    </div>
                    {isSelected && <span className="text-blue-600 font-bold text-xs">✓ Activo</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Norma / Tipo de Cable */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tipo / Norma de Conductor:</label>
            <select
              value={conduit.defaultCableStandard || 'IRAM_NM_247_3'}
              onChange={(e) =>
                updateConduit(conduit.id, {
                  defaultCableStandard: e.target.value as CableStandard
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            >
              {CABLE_STANDARDS.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.label} — {cs.desc}
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
                  updateConduit(conduit.id, {
                    circuitId: e.target.value ? e.target.value : null
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              >
                <option value="">(Sin circuito asignado)</option>
                {project.circuits.map((c) => (
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
                    updateConduit(conduit.id, { manualLengthM: isNaN(val) ? undefined : val });
                  }}
                  className="w-20 bg-transparent font-mono font-bold text-blue-900 outline-none text-right"
                />
                <span className="font-mono text-slate-400">m</span>
                {conduit.manualLengthM && (
                  <button
                    type="button"
                    onClick={() => updateConduit(conduit.id, { manualLengthM: undefined })}
                    className="text-[10px] text-blue-600 underline ml-auto"
                    title="Restaurar cálculo 3D automático"
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 6. Presets Rápidos de Conductores */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700">Llenado Rápido Reglamentario (Presets AEA):</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('2x1.5_PE')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors"
              >
                <div className="font-bold text-slate-800">2x1.5 + PE</div>
                <div className="text-[10px] text-slate-400">Iluminación (IUG)</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2x2.5_PE')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors"
              >
                <div className="font-bold text-slate-800">2x2.5 + PE</div>
                <div className="text-[10px] text-slate-400">Tomacorrientes (TUG)</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2x4.0_PE')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors"
              >
                <div className="font-bold text-slate-800">2x4.0 + PE</div>
                <div className="text-[10px] text-slate-400">Tomas Esp. (TUE/AA)</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('3x2.5_PE')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors"
              >
                <div className="font-bold text-slate-800">3x2.5 + PE</div>
                <div className="text-[10px] text-slate-400">Retorno + Línea</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('3x4.0_N_PE')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors col-span-2 sm:col-span-1"
              >
                <div className="font-bold text-slate-800">3x4.0 + N + PE</div>
                <div className="text-[10px] text-slate-400">Línea Trifásica</div>
              </button>
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
                  onClick={() => addConductor('fase', 2.5)}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold"
                >
                  + Fase
                </button>
                <button
                  type="button"
                  onClick={() => addConductor('neutro', 2.5)}
                  className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-lg text-[10px] font-bold"
                >
                  + Neutro
                </button>
                <button
                  type="button"
                  onClick={() => addConductor('pe', 2.5)}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-bold"
                >
                  + Tierra
                </button>
                <button
                  type="button"
                  onClick={() => addConductor('retorno', 1.5)}
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
                          let color = '#92400e';
                          if (role === 'neutro') color = '#0284c7';
                          if (role === 'pe') color = '#16a34a';
                          if (role === 'retorno') color = '#64748b';
                          updateConductorItem(idx, { role, color });
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
                          onChange={(e) => updateConductorItem(idx, { reference: e.target.value })}
                          className="w-8 px-1 py-0.5 bg-white border border-slate-300 rounded text-center font-mono font-bold uppercase text-xs"
                        />
                      </div>
                    )}

                    {/* Sección mm² */}
                    <div className="flex items-center gap-1">
                      <select
                        value={c.sectionMM2}
                        onChange={(e) =>
                          updateConductorItem(idx, { sectionMM2: parseFloat(e.target.value) })
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
                      onClick={() => removeConductor(idx)}
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
              onChange={(e) => updateConduit(conduit.id, { notes: e.target.value })}
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
              deleteConduit(conduit.id);
              setSelectedEntity(null);
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
