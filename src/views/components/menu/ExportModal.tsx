/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ExportModal.tsx
 * Centro Unificado de Exportación Técnica y Cómputos.
 * Permite descargar DXF para CAD, Planilla CSV, Respaldo JSON y Cotizador.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { downloadProjectDxf } from '../../../services/dxfExportService';
import { downloadProjectJson } from '../../../services/projectBackupService';
import { computeProjectSurvey, downloadComputoCsv } from '../../../services/cotizadorBridge';
import { X, Share2, FileSpreadsheet, FileCode, Download, Zap } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenComputo: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onOpenComputo }) => {
  const { project } = useProjectStore();

  if (!isOpen) return null;

  const computo = computeProjectSurvey(project);

  const handleExportDxf = () => {
    downloadProjectDxf(project);
  };

  const handleExportCsv = () => {
    downloadComputoCsv(computo);
  };

  const handleExportJson = () => {
    downloadProjectJson(project);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <Share2 size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Exportaciones y Salidas Técnicas
              </h3>
              <p className="text-[11px] text-slate-500">
                Formatos estándar CAD, planillas y respaldos
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

        {/* Lista de Tarjetas de Exportación de 1 clic */}
        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          {/* 1. PLANO CAD DXF */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                <FileCode size={20} />
              </div>
              <div>
                <strong className="text-slate-900 text-xs block">Plano CAD 2D (.DXF)</strong>
                <span className="text-[11px] text-slate-500 block">
                  Capas ARQ y ELEC compatibles con AutoCAD y LibreCAD
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportDxf}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0"
            >
              <Download size={14} />
              <span>DXF</span>
            </button>
          </div>

          {/* 2. PLANILLA DE CÓMPUTO MÉTRICO CSV */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <strong className="text-slate-900 text-xs block">Planilla de Materiales (.CSV)</strong>
                <span className="text-[11px] text-slate-500 block">
                  Metros de caño, conductores por sección y bocas para Excel
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          </div>

          {/* 3. RESPALDO DEL PROYECTO JSON */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                <Download size={20} />
              </div>
              <div>
                <strong className="text-slate-900 text-xs block">Respaldo Completo (.json)</strong>
                <span className="text-[11px] text-slate-500 block">
                  Copia íntegra del proyecto para restaurar en cualquier equipo
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0"
            >
              <Download size={14} />
              <span>JSON</span>
            </button>
          </div>

          {/* 4. ENLACE DIRECTO AL COTIZADOR IEBA */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                <Zap size={20} />
              </div>
              <div>
                <strong className="text-slate-900 text-xs block">Cotizador IEBA</strong>
                <span className="text-[11px] text-amber-900/80 block">
                  Copiar cómputo estructurado para pwaCotizadorIeba
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenComputo();
              }}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0"
            >
              Ver / Copiar
            </button>
          </div>
        </div>

        {/* Pie */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
