/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ElectricalReportModal.tsx (Arquitectura MVVM Estricta)
 * Memoria Técnica de Cálculo Eléctrico y Cuadro de Cargas AEA 90364-771 / IRAM.
 * 
 * Principios:
 * - Divulgación progresiva: Cuadro de verificación técnica y datos de fabricante.
 * - Enfoque objetivo y neutral: Cero advertencias punitivas o semáforos alarmistas.
 * - Exportación limpia a CSV y formato de impresión técnica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useElectricalReportViewModel } from '../../../viewmodels/useElectricalReportViewModel';
import type { CircuitCalculationReportRow } from '../../../viewmodels/useElectricalReportViewModel';
import {
  INSTALLATION_METHODS,
  type InstallationMethodCode,
  type CableManufacturerCatalog
} from '../../../models/electrical/cableManufacturerCatalog';
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  Sliders,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';

interface ElectricalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ElectricalReportModal: React.FC<ElectricalReportModalProps> = ({ isOpen, onClose }) => {
  const {
    reportRows,
    summary,
    activeCatalog,
    activeCatalogId,
    availableCatalogs,
    ambientTempC,
    globalCosPhi,
    setActiveCatalogId,
    setAmbientTempC,
    setGlobalCosPhi,
    setCircuitOverride,
    exportReportCsv
  } = useElectricalReportViewModel();

  const [activeTab, setActiveTab] = useState<'schedule' | 'catalogs'>('schedule');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera Técnica */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Zap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base leading-tight">
                  Memoria de Cálculo y Cuadro de Cargas
                </h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                  AEA 90364-771
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Verificación electromecánica con impedancias de fabricante y factores de tendido
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportReportCsv(';')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
              title="Descargar Planilla CSV (Excel)"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
              title="Imprimir o Guardar PDF"
            >
              <Printer size={14} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Métricas Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-100/60 border-b border-slate-200 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-medium">Potencia Instalada</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              {(summary.totalApparentPowerVA / 1000).toFixed(2)} kVA <span className="text-[11px] font-normal text-slate-500">({summary.totalActivePowerKW} kW)</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-medium">Circuitos / Tableros</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              {summary.totalCircuits} circ. <span className="text-[11px] font-normal text-slate-500">({summary.totalPanels} tableros)</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-medium">Caída Máxima (ΔV)</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              {summary.maxVoltageDropPercent.toFixed(2)}% <span className="text-[11px] font-normal text-slate-500">(en {summary.worstVoltageDropCircuitName || 'C1'})</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-medium">Catálogo / Temp.</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5 truncate">
              {activeCatalog.manufacturer} <span className="text-[11px] font-normal text-slate-500">· {ambientTempC}°C</span>
            </div>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex border-b border-slate-200 px-4 bg-white text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`py-2.5 px-4 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>Cuadro de Cargas y Verificación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalogs')}
            className={`py-2.5 px-4 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'catalogs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={15} />
            <span>Fabricante de Cables y Parámetros ({availableCatalogs.length})</span>
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
          {activeTab === 'schedule' && (
            <div className="space-y-3">
              {/* Tabla Cuadro de Cargas */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="p-2.5">Circuito / Uso</th>
                      <th className="p-2.5">Tablero</th>
                      <th className="p-2.5 text-right">Potencia (VA)</th>
                      <th className="p-2.5 text-right">Ib (A) / In (A)</th>
                      <th className="p-2.5">Cable / Sección</th>
                      <th className="p-2.5">Método / fn / fT</th>
                      <th className="p-2.5 text-right">Iz (A)</th>
                      <th className="p-2.5 text-right">L (m)</th>
                      <th className="p-2.5 text-right">ΔV (%)</th>
                      <th className="p-2.5 text-center">Ajustes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportRows.map((row) => {
                      const isEditing = editingRowId === row.circuitId;

                      return (
                        <React.Fragment key={row.circuitId}>
                          <tr
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isEditing ? 'bg-blue-50/50' : ''
                            }`}
                          >
                            <td className="p-2.5 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                <span>{row.circuitName}</span>
                              </div>
                              <div className="text-[10px] font-normal text-slate-400 pl-3.5">
                                {row.circuitType} · {row.isThreePhase ? '3F+N+PE' : '1F+N+PE'} ({row.voltageV}V)
                              </div>
                            </td>

                            <td className="p-2.5 text-slate-600 font-medium truncate max-w-[120px]">
                              {row.panelName}
                            </td>

                            <td className="p-2.5 text-right font-semibold text-slate-700">
                              {row.apparentPowerVA} VA
                              <div className="text-[10px] text-slate-400 font-normal">
                                {row.connectedElementsCount} bocas
                              </div>
                            </td>

                            <td className="p-2.5 text-right font-medium text-slate-700">
                              <span className="font-bold text-slate-900">{row.designCurrentA} A</span>
                              <span className="text-slate-400"> / {row.breakerAmperageA} A</span>
                            </td>

                            <td className="p-2.5 text-slate-700">
                              <div className="font-bold text-slate-900">{row.wireSectionMM2} mm²</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                {row.catalogManufacturer} ({row.catalogName.slice(0, 20)}...)
                              </div>
                            </td>

                            <td className="p-2.5 text-slate-600">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-bold text-[10px]">
                                {row.installationMethod}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                fn: {row.groupingFactor} · fT: {row.temperatureFactor}
                              </div>
                            </td>

                            <td className="p-2.5 text-right">
                              <div className="font-bold text-slate-800">{row.correctedAmpacityA} A</div>
                              <div className="text-[10px] text-slate-400">
                                Iz0: {row.baseAmpacityA} A
                              </div>
                            </td>

                            <td className="p-2.5 text-right font-semibold text-slate-700">
                              {row.lengthM.toFixed(1)} m
                              {row.isManualLength && (
                                <span className="text-[9px] text-amber-600 font-bold block">
                                  Manual
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 text-right">
                              <div className="font-bold text-slate-900">
                                {row.deltaVPercent.toFixed(2)}%
                              </div>
                              <div className="text-[10px] text-slate-400">
                                (máx {row.maxAllowedDeltaVPercent}%)
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => setEditingRowId(isEditing ? null : row.circuitId)}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  isEditing
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                                title="Ajustar parámetros individuales del circuito"
                              >
                                {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>

                          {/* Sub-fila de Configuración Específica del Circuito */}
                          {isEditing && (
                            <tr className="bg-blue-50/40 border-b border-blue-200">
                              <td colSpan={10} className="p-3">
                                <CircuitRowEditor
                                  row={row}
                                  availableCatalogs={availableCatalogs}
                                  onSave={(patch) => setCircuitOverride(row.circuitId, patch)}
                                  onClose={() => setEditingRowId(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pie Informativo Neutral */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-500" />
                  <span>Criterios de Verificación Electromecánica AEA 90364-771:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500 pl-1">
                  <li>
                    <strong>Térmica:</strong> Corriente de diseño Ib ≤ In (térmica) ≤ Iz (corriente admisible corregida con factores de agrupamiento fn y temperatura fT).
                  </li>
                  <li>
                    <strong>Caída de Tensión:</strong> ΔV = k · Ib · (L / 1000) · (R · cosφ + XL · sinφ) con k = 2 (1F) o k = √3 (3F). Límites: 1.0% para alimentación, 3.0% para iluminación, 5.0% para tomas y fuerza motriz.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'catalogs' && (
            <div className="space-y-4">
              {/* Selector de Catálogo de Fabricante */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                  <Cpu size={16} className="text-blue-600" />
                  <span>Catálogo de Fabricante Predeterminado</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {availableCatalogs.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCatalogId(cat.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        activeCatalogId === cat.id
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-slate-800 text-xs">{cat.manufacturer}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 font-medium">{cat.name}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Norma {cat.standard} · {cat.maxOperatingTempC}°C
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Parámetros Globales de Tendido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Temperatura Ambiente de Diseño (°C)
                  </label>
                  <div className="flex gap-1.5">
                    {[30, 35, 40, 45].map((temp) => (
                      <button
                        key={temp}
                        type="button"
                        onClick={() => setAmbientTempC(temp)}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          ambientTempC === temp
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {temp}°C
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Norma AEA fija 40°C en aire exterior/verano y 30°C estándar
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Factor de Potencia Global cos(φ)
                  </label>
                  <div className="flex gap-1.5">
                    {[0.85, 0.90, 0.95, 1.0].map((cos) => (
                      <button
                        key={cos}
                        type="button"
                        onClick={() => setGlobalCosPhi(cos)}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          globalCosPhi === cos
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cos.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    cos(φ) = 0.90 estándar reglamentario para circuitos monofásicos
                  </span>
                </div>
              </div>

              {/* Tabla de Parámetros Físicos del Catálogo Activo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs">
                    Datos Técnicos Oficiales: {activeCatalog.name}
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Aislación: {activeCatalog.insulationType} (R a {activeCatalog.maxOperatingTempC}°C, XL a 50Hz)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="p-2.5">Sección</th>
                        <th className="p-2.5 text-right">R (Ω/km)</th>
                        <th className="p-2.5 text-right">XL (Ω/km)</th>
                        <th className="p-2.5 text-right">B1 (Vista)</th>
                        <th className="p-2.5 text-right">B2 (Embutido)</th>
                        <th className="p-2.5 text-right">E (Bandeja)</th>
                        <th className="p-2.5 text-right">D1 (Enterrado)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCatalog.rows.map((r) => (
                        <tr key={r.sectionMM2} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{r.sectionMM2} mm²</td>
                          <td className="p-2.5 text-right font-mono text-slate-700">{r.resistanceOhmKm.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-700">{r.reactanceOhmKm.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-semibold text-slate-800">{r.baseAmpacityA.B1} A</td>
                          <td className="p-2.5 text-right font-semibold text-blue-700 bg-blue-50/50">{r.baseAmpacityA.B2} A</td>
                          <td className="p-2.5 text-right font-semibold text-slate-800">{r.baseAmpacityA.E ?? '-'} A</td>
                          <td className="p-2.5 text-right font-semibold text-slate-800">{r.baseAmpacityA.D1 ?? '-'} A</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CircuitRowEditorProps {
  row: CircuitCalculationReportRow;
  availableCatalogs: CableManufacturerCatalog[];
  onSave: (patch: {
    installationMethod?: InstallationMethodCode;
    customCurrentA?: number;
    customLengthM?: number;
    customCosPhi?: number;
    customCatalogId?: string;
    notes?: string;
  }) => void;
  onClose: () => void;
}

const CircuitRowEditor: React.FC<CircuitRowEditorProps> = ({
  row,
  availableCatalogs,
  onSave,
  onClose
}) => {
  const [method, setMethod] = useState<InstallationMethodCode>(row.installationMethod);
  const [currentA, setCurrentA] = useState<string>(row.designCurrentA.toString());
  const [lengthM, setLengthM] = useState<string>(row.lengthM > 0 ? row.lengthM.toString() : '');
  const [cosPhi, setCosPhi] = useState<string>(row.cosPhi.toString());
  const [catalogId, setCatalogId] = useState<string>(row.catalogId);
  const [notes, setNotes] = useState<string>(row.notes || '');

  const handleApply = () => {
    onSave({
      installationMethod: method,
      customCurrentA: currentA ? parseFloat(currentA) : undefined,
      customLengthM: lengthM ? parseFloat(lengthM) : undefined,
      customCosPhi: cosPhi ? parseFloat(cosPhi) : undefined,
      customCatalogId: catalogId,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  const handleReset = () => {
    onSave({
      installationMethod: undefined,
      customCurrentA: undefined,
      customLengthM: undefined,
      customCosPhi: undefined,
      customCatalogId: undefined,
      notes: undefined
    });
    onClose();
  };

  return (
    <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-xs space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="font-bold text-slate-800">
          Ajustar Parámetros de Cálculo: <strong>{row.circuitName}</strong>
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] text-slate-400 hover:text-red-600 transition-colors"
        >
          Restablecer a automáticos
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {/* Método de Instalación */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            Método de Canalización
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as InstallationMethodCode)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          >
            {INSTALLATION_METHODS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fabricante de Cable */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            Fabricante del Cable
          </label>
          <select
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          >
            {availableCatalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} ({c.name.slice(0, 20)}...)
              </option>
            ))}
          </select>
        </div>

        {/* Longitud Forzada */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            Longitud L (metros)
          </label>
          <input
            type="number"
            step="0.5"
            placeholder={row.lengthM.toFixed(1)}
            value={lengthM}
            onChange={(e) => setLengthM(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          />
        </div>

        {/* Corriente Ib */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            Corriente Ib (A)
          </label>
          <input
            type="number"
            step="0.1"
            placeholder={row.designCurrentA.toFixed(1)}
            value={currentA}
            onChange={(e) => setCurrentA(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          />
        </div>

        {/* Factor de Potencia cos(phi) */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            cos(φ)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.5"
            max="1.0"
            placeholder={row.cosPhi.toFixed(2)}
            value={cosPhi}
            onChange={(e) => setCosPhi(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <input
          type="text"
          placeholder="Notas u observaciones de relevamiento para este circuito..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 mr-3 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
