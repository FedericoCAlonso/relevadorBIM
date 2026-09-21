/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ExportModal.tsx
 * Centro Unificado de Exportación Técnica y Cómputos.
 * Permite descargar:
 * 1. DXF para CAD 2D (LibreCAD, AutoCAD).
 * 2. Cómputo Flexible CSV (Comercial agrupado por capítulos o Base Plana para Excel).
 * 3. Memoria de Cálculo Eléctrico y Cuadro de Cargas CSV (AEA 90364-771).
 * 4. Respaldo íntegro JSON.
 * 5. Puente con Cotizador IEBA.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { downloadProjectDxf } from '../../../services/dxfExportService';
import { downloadProjectJson } from '../../../services/projectBackupService';
import { downloadFlexibleCsv } from '../../../services/materialExportService';
import { useElectricalReportViewModel } from '../../../viewmodels/useElectricalReportViewModel';
import {
  X,
  Share2,
  FileSpreadsheet,
  FileCode,
  Download,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenComputo: () => void;
  onOpenElectricalReport?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onOpenComputo,
  onOpenElectricalReport
}) => {
  const { project } = useProjectStore();
  const { exportReportCsv } = useElectricalReportViewModel();

  // Opciones de exportación flexible de materiales
  const [csvFormat, setCsvFormat] = useState<'commercial' | 'flat_database'>('commercial');
  const [csvDelimiter, setCsvDelimiter] = useState<';' | ','>(';');
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('');
  const [showCsvOptions, setShowCsvOptions] = useState(false);

  if (!isOpen) return null;

  const handleExportDxf = () => {
    downloadProjectDxf(project);
  };

  const handleExportFlexibleCsv = () => {
    downloadFlexibleCsv(project, {
      format: csvFormat,
      delimiter: csvDelimiter,
      circuitId: selectedCircuitId || undefined,
      includeMeasurements: true
    });
  };

  const handleExportJson = () => {
    downloadProjectJson(project);
  };

  const handleOpenCotizador = () => {
    window.open('https://cotizadorieba.web.app', '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
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
                Formatos estándar CAD, planillas y cálculos de ingeniería
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

        {/* Lista de Tarjetas de Exportación */}
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
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0 cursor-pointer"
            >
              <Download size={14} />
              <span>DXF</span>
            </button>
          </div>

          {/* 2. PLANILLA DE CÓMPUTO MÉTRICO CSV (FLEXIBLE) */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl space-y-2.5 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <strong className="text-slate-900 text-xs block">Cómputo Métrico de Materiales (.CSV)</strong>
                  <span className="text-[11px] text-slate-500 block">
                    Canalizaciones, cables por sección, cajas y mediciones
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportFlexibleCsv}
                className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0 cursor-pointer"
              >
                <Download size={14} />
                <span>CSV</span>
              </button>
            </div>

            {/* Opciones de formato de CSV */}
            <div className="border-t border-slate-200/80 pt-2">
              <button
                type="button"
                onClick={() => setShowCsvOptions(!showCsvOptions)}
                className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Configurar formato CSV ({csvFormat === 'commercial' ? 'Comercial agrupado' : 'Base de datos plana'})</span>
                {showCsvOptions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showCsvOptions && (
                <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 text-[11px]">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Estructura del CSV:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCsvFormat('commercial')}
                        className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                          csvFormat === 'commercial'
                            ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        Comercial (Rubros)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsvFormat('flat_database')}
                        className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                          csvFormat === 'flat_database'
                            ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        Base Plana (Excel / BI)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Separador de Columnas:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCsvDelimiter(';')}
                        className={`flex-1 py-1 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                          csvDelimiter === ';'
                            ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        ; (Punto y coma · Excel ES)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsvDelimiter(',')}
                        className={`flex-1 py-1 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                          csvDelimiter === ','
                            ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        , (Coma · Estándar Int.)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Filtrar por Circuito:</label>
                    <select
                      value={selectedCircuitId}
                      onChange={(e) => setSelectedCircuitId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">Todos los Circuitos (Obra Completa)</option>
                      {project.circuits.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phases === 3 ? '380V' : '220V'} · {c.wireSectionBaseMM2}mm²)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. MEMORIA DE CÁLCULO Y CUADRO DE CARGAS ELÉCTRICAS */}
          <div className="p-3.5 bg-blue-50/60 hover:bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <Cpu size={20} />
              </div>
              <div>
                <strong className="text-slate-900 text-xs block">Memoria y Cuadro de Cargas (.CSV)</strong>
                <span className="text-[11px] text-slate-500 block">
                  Corrientes Ib, caídas ΔV%, factores de tendido e impedancias
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onOpenElectricalReport && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenElectricalReport();
                  }}
                  className="px-2.5 py-2 bg-white hover:bg-slate-100 text-blue-700 font-bold rounded-xl border border-blue-200 transition-all cursor-pointer text-[11px]"
                >
                  Ver
                </button>
              )}
              <button
                type="button"
                onClick={() => exportReportCsv(';')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Download size={14} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* 4. RESPALDO DEL PROYECTO JSON */}
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
              className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex-shrink-0 cursor-pointer"
            >
              <Download size={14} />
              <span>JSON</span>
            </button>
          </div>

          {/* 5. ENLACE DIRECTO AL COTIZADOR IEBA */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                <Zap size={20} />
              </div>
              <div>
                <strong className="text-amber-950 text-xs block">Cotizador Online IEBA</strong>
                <span className="text-[11px] text-amber-800 block">
                  Transferir metros de caño, cables y bocas a cotizadorieba.web.app
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenComputo();
                }}
                className="px-2.5 py-2 bg-white hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-300 transition-all cursor-pointer text-[11px]"
              >
                Resumen
              </button>
              <button
                type="button"
                onClick={handleOpenCotizador}
                className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>Abrir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
