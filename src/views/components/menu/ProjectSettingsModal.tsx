/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ProjectSettingsModal.tsx
 * Modal de Configuración General de la Obra y Parámetros AEA por Defecto.
 * Respeta el patrón estricto MVVM consumiendo catálogos centralizados.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import {
  CONDUIT_MATERIALS_CATALOG,
  CABLE_STANDARDS_CATALOG,
  AEA_CALCULATION_CONSTANTS
} from '../../../models/electrical/electricalStandards';
import type { ConduitMaterial, CableStandard } from '../../../models/electrical/ElectricalModel';
import { X, Building2, Sliders, Check } from 'lucide-react';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose }) => {
  const { project, updateProjectMeta } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'obra' | 'instalacion'>('obra');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Sliders size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Configuración del Relevamiento
              </h3>
              <p className="text-[11px] text-slate-500">
                Parámetros de obra y estándares normativos AEA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Selector de Solapas */}
        <div className="flex border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('obra')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === 'obra'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Building2 size={15} />
            <span>Datos de la Obra</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instalacion')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === 'instalacion'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Sliders size={15} />
            <span>Normas y Parámetros AEA</span>
          </button>
        </div>

        {/* Contenido según Solapa */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'obra' ? (
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre de la Obra / Edificio:</label>
                <input
                  type="text"
                  value={project.meta.name || ''}
                  onChange={(e) => updateProjectMeta({ name: e.target.value })}
                  placeholder="Ej: Vivienda Unifamiliar Martínez"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Comitente / Propietario:</label>
                <input
                  type="text"
                  value={project.meta.clientName || ''}
                  onChange={(e) => updateProjectMeta({ clientName: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección / Emplazamiento:</label>
                <input
                  type="text"
                  value={project.meta.address || ''}
                  onChange={(e) => updateProjectMeta({ address: e.target.value })}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Técnico / Instalador Matriculado:</label>
                <input
                  type="text"
                  value={project.meta.electricianName || ''}
                  onChange={(e) => updateProjectMeta({ electricianName: e.target.value })}
                  placeholder="Ej: Ing. / Téc. Electricista"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Material por defecto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Material de Cañería por Defecto para nuevos tramos:
                </label>
                <div className="space-y-1.5">
                  {CONDUIT_MATERIALS_CATALOG.map((mat) => {
                    const isSelected =
                      (project.meta.defaultConduitMaterial || CONDUIT_MATERIALS_CATALOG[0].id) === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => updateProjectMeta({ defaultConduitMaterial: mat.id as ConduitMaterial })}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className={`font-bold text-xs ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            {mat.label}
                          </div>
                          <div className="text-[10px] text-slate-500">{mat.description}</div>
                        </div>
                        {isSelected && <Check size={16} className="text-blue-600 font-bold" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conductor por defecto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Norma de Cable por Defecto:</label>
                <select
                  value={project.meta.defaultCableStandard || CABLE_STANDARDS_CATALOG[0].id}
                  onChange={(e) =>
                    updateProjectMeta({ defaultCableStandard: e.target.value as CableStandard })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                >
                  {CABLE_STANDARDS_CATALOG.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tensión nominal */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tensión Nominal del Suministro:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateProjectMeta({ defaultVoltageV: AEA_CALCULATION_CONSTANTS.VOLTAGE_SINGLE_PHASE_V })}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                      (project.meta.defaultVoltageV || 220) === 220
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    220 V (Monofásico)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProjectMeta({ defaultVoltageV: AEA_CALCULATION_CONSTANTS.VOLTAGE_THREE_PHASE_V })}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                      project.meta.defaultVoltageV === 380
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    380 V (Trifásico)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de modal */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-colors"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
