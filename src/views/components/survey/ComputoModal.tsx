/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ComputoModal.tsx
 * Cómputo Métrico Automático y Puente con el Cotizador IEBA.
 * Desglosa metros lineales de caños, conductores y bocas para presupuestar.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { generarComputoCotizador } from '../../../services/cotizadorBridge';
import { downloadFlexibleCsv } from '../../../services/materialExportService';
import { X, Copy, Check, Zap, Building2, Cable, Download, Filter } from 'lucide-react';

interface ComputoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComputoModal: React.FC<ComputoModalProps> = ({ isOpen, onClose }) => {
  const { project } = useProjectStore();
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const computo = useMemo(() => {
    return generarComputoCotizador(project, selectedCircuitId || undefined);
  }, [project, selectedCircuitId]);

  if (!isOpen) return null;

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(computo, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Cómputo Métrico de Materiales</h3>
              <p className="text-xs text-slate-500">
                Superficie Total Relevada: <strong>{computo.superficieTotalM2} m²</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Selector de Filtro por Circuito */}
        <div className="py-2.5 px-3 my-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
          <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 shrink-0">
            <Filter size={13} className="text-blue-500" />
            <span>Circuito:</span>
          </label>
          <select
            value={selectedCircuitId}
            onChange={(e) => setSelectedCircuitId(e.target.value)}
            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Todos los Circuitos (Cómputo Completo)</option>
            {project.circuits.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phases === 3 ? '380V' : '220V'} · {c.wireSectionBaseMM2}mm²)
              </option>
            ))}
          </select>
        </div>

        {/* Contenido Desglosado */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4 text-xs">
          {/* 1. Ambientes Relevados */}
          <div>
            <h4 className="font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Building2 size={14} className="text-blue-500" />
              <span>Ambientes ({computo.ambientesComputados.length})</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {computo.ambientesComputados.map((amb, i) => (
                <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="font-semibold text-slate-800">{amb.nombre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {amb.areaM2} m² · {amb.bocasCount} bocas
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Cañerías por Diámetro */}
          <div>
            <h4 className="font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Cable size={14} className="text-amber-500" />
              <span>Cañerías Estimadas (metros lineales)</span>
            </h4>
            {Object.keys(computo.cañeriasPorDiametro).length === 0 ? (
              <p className="text-slate-400 italic">No hay cañerías para el circuito seleccionado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(computo.cañeriasPorDiametro).map(([diam, metros]) => (
                  <div key={diam} className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="font-medium text-amber-900">{diam}</div>
                    <div className="text-base font-bold text-amber-700">{metros} m</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Conductores y Cables de Cobre */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Cable size={14} className="text-emerald-600" />
                <span>Conductores y Cables de Cobre</span>
              </h4>
              {computo.conductoresDetallados && computo.conductoresDetallados.totalMetros > 0 && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Total: {computo.conductoresDetallados.totalMetros} m
                </span>
              )}
            </div>

            {!computo.conductoresDetallados || computo.conductoresDetallados.totalMetros === 0 ? (
              <p className="text-slate-400 italic">No hay conductores en las cañerías del circuito seleccionado.</p>
            ) : (
              <div className="space-y-2">
                {/* 3.1 Puesta a Tierra PE */}
                {Object.keys(computo.conductoresDetallados.tierraPePorSeccionM).length > 0 && (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-xs shrink-0" />
                      <span className="font-bold text-emerald-900 text-xs">Puesta a Tierra (PE Verde-Amarillo)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(computo.conductoresDetallados.tierraPePorSeccionM).map(([sec, metros]) => (
                        <div key={sec} className="bg-white/80 p-1.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <span className="text-slate-700 font-medium">{sec}</span>
                          <strong className="text-emerald-700 text-sm">{metros} m</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3.2 Fases */}
                {Object.keys(computo.conductoresDetallados.fasesPorSeccionM).length > 0 && (
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-700 border border-white shadow-xs shrink-0" />
                      <span className="font-bold text-amber-900 text-xs">Conductores de Fase</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(computo.conductoresDetallados.fasesPorSeccionM).map(([fase, metros]) => (
                        <div key={fase} className="bg-white/80 p-1.5 rounded-lg border border-amber-100 flex items-center justify-between">
                          <span className="text-slate-700 font-medium truncate" title={fase}>{fase}</span>
                          <strong className="text-amber-800 text-sm shrink-0 ml-1">{metros} m</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3.3 Neutros */}
                {Object.keys(computo.conductoresDetallados.neutrosPorSeccionM).length > 0 && (
                  <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-3 h-3 rounded-full bg-sky-500 border border-white shadow-xs shrink-0" />
                      <span className="font-bold text-sky-900 text-xs">Neutro Reglamentario (Celeste)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(computo.conductoresDetallados.neutrosPorSeccionM).map(([sec, metros]) => (
                        <div key={sec} className="bg-white/80 p-1.5 rounded-lg border border-sky-100 flex items-center justify-between">
                          <span className="text-slate-700 font-medium">{sec}</span>
                          <strong className="text-sky-700 text-sm">{metros} m</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3.4 Retornos */}
                {Object.keys(computo.conductoresDetallados.retornosPorSeccionM).length > 0 && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400 border border-white shadow-xs shrink-0" />
                      <span className="font-bold text-slate-800 text-xs">Retornos de Efecto (Gris/Blanco)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(computo.conductoresDetallados.retornosPorSeccionM).map(([ret, metros]) => (
                        <div key={ret} className="bg-white p-1.5 rounded-lg border border-slate-200 flex items-center justify-between">
                          <span className="text-slate-700 font-medium">{ret}</span>
                          <strong className="text-slate-800 text-sm">{metros} m</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Bocas AEA por Tipo */}
          <div>
            <h4 className="font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Zap size={14} className="text-red-500" />
              <span>Bocas AEA por Uso</span>
            </h4>
            {Object.keys(computo.bocasPorTipo).length === 0 ? (
              <p className="text-slate-400 italic">No hay bocas para el circuito seleccionado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(computo.bocasPorTipo).map(([tipo, cant]) => (
                  <div key={tipo} className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-medium text-slate-700">{tipo}</div>
                    <div className="text-base font-bold text-slate-900">{cant} u.</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón de Exportación */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              downloadFlexibleCsv(project, {
                format: 'commercial',
                delimiter: ';',
                circuitId: selectedCircuitId || undefined
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Descargar Planilla CSV de Materiales agrupada por rubros"
          >
            <Download size={14} />
            <span>Descargar CSV</span>
          </button>

          <button
            type="button"
            onClick={handleCopyJSON}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? '¡Copiado!' : 'Copiar JSON IEBA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
