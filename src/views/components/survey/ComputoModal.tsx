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
import { X, Copy, Check, Zap, Building2, Cable } from 'lucide-react';

interface ComputoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComputoModal: React.FC<ComputoModalProps> = ({ isOpen, onClose }) => {
  const { project } = useProjectStore();
  const [copied, setCopied] = useState(false);

  const computo = useMemo(() => {
    return generarComputoCotizador(project);
  }, [project]);

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
              <h3 className="text-base font-bold text-slate-800">Cómputo Métrico para Cotizador IEBA</h3>
              <p className="text-xs text-slate-500">
                Superficie Total Relevada: <strong>{computo.superficieTotalM2} m²</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Contenido Desglosado */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
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
              <p className="text-slate-400 italic">No hay cañerías trazadas aún.</p>
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

          {/* 3. Bocas AEA por Tipo */}
          <div>
            <h4 className="font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Zap size={14} className="text-red-500" />
              <span>Bocas AEA por Uso</span>
            </h4>
            {Object.keys(computo.bocasPorTipo).length === 0 ? (
              <p className="text-slate-400 italic">No hay bocas colocadas aún.</p>
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
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Formato compatible con <code>pwaCotizadorIeba</code>
          </span>
          <button
            onClick={handleCopyJSON}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Cómputo JSON'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
