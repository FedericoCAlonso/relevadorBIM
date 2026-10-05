/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ElectricalElementModal.tsx (Patrón Estricto MVVM)
 * Vista declarativa de inspección y configuración de boca eléctrica.
 * Delega la lógica de negocio, catálogos y transformaciones al useElectricalViewModel.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type {
  ElectricalElement,
  ElementPlacement,
  ConduitMaterial,
  CableStandard
} from '../../../models/electrical/ElectricalModel';
import { useElectricalViewModel } from '../../../viewmodels/useElectricalViewModel';
import { getSymbolById } from '../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from './AeaSymbolIcon';
import {
  X,
  Trash2,
  ArrowLeftRight,
  ArrowRight,
  Plus,
  GitBranch,
  Zap,
  Check,
  Ruler,
  Layers,
  Cable
} from 'lucide-react';
import { isTerminalReference } from '../../../models/electrical/electricalBranch';
import { createConductorsForTerminal } from '../../../models/electrical/electricalStandards';

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
  const {
    elementWall,
    circuits,
    panels,
    conduits,
    catalogs,
    selectedBranch,
    updateSelectedBranch,
    setElementProperties,
    setConduitProperties,
    invertElementWallSide,
    addElementAttribute,
    updateElementAttribute,
    removeElementAttribute,
    removeElement,
    toggleElementPassingCircuit,
    getFormattedElementLabel
  } = useElectricalViewModel();

  const [appliedBranchCircuit, setAppliedBranchCircuit] = React.useState(false);

  const connectedConduit = React.useMemo(() => {
    if (!element) return null;
    return (
      conduits?.find(
        (c) => c.fromElementId === element.id || c.toElementId === element.id
      ) || null
    );
  }, [conduits, element]);

  const effectiveTotalLengthM =
    element?.totalLengthM ?? connectedConduit?.manualLengthM ?? 10.0;
  const effectiveDiameterMM =
    element?.continuationConduitDiameterMM ||
    connectedConduit?.diameterMM ||
    19;
  const effectiveMaterial =
    element?.continuationConduitMaterial ||
    connectedConduit?.material ||
    'cano_rigido_pvc';
  const effectiveCableStandard =
    element?.continuationCableStandard ||
    connectedConduit?.defaultCableStandard ||
    'IRAM_NM_247_3';
  const effectiveSectionMM2 =
    element?.continuationCableSectionMM2 ||
    connectedConduit?.conductors?.[0]?.sectionMM2 ||
    2.5;
  const effectiveConductorsCount =
    element?.continuationConductorsCount ||
    connectedConduit?.conductors?.length ||
    3;

  const handleUpdateTotalLength = (newLen: number | undefined) => {
    if (!element) return;
    setElementProperties(element.id, { totalLengthM: newLen });
    if (connectedConduit) {
      setConduitProperties(connectedConduit.id, { manualLengthM: newLen });
    }
  };

  const handleUpdateConduitDiameter = (diam: number) => {
    if (!element) return;
    setElementProperties(element.id, { continuationConduitDiameterMM: diam });
    if (connectedConduit) {
      setConduitProperties(connectedConduit.id, { diameterMM: diam });
    }
  };

  const handleUpdateConduitMaterial = (mat: ConduitMaterial) => {
    if (!element) return;
    setElementProperties(element.id, { continuationConduitMaterial: mat });
    if (connectedConduit) {
      setConduitProperties(connectedConduit.id, { material: mat });
    }
  };

  const handleUpdateCableStandard = (std: CableStandard) => {
    if (!element) return;
    setElementProperties(element.id, { continuationCableStandard: std });
    if (connectedConduit) {
      setConduitProperties(connectedConduit.id, { defaultCableStandard: std });
    }
  };

  const handleUpdateCableSection = (sec: number) => {
    if (!element) return;
    setElementProperties(element.id, { continuationCableSectionMM2: sec });
    if (connectedConduit) {
      const conductors = createConductorsForTerminal(sec, effectiveConductorsCount);
      setConduitProperties(connectedConduit.id, { conductors });
    }
  };

  const handleUpdateConductorsCount = (count: number) => {
    if (!element) return;
    setElementProperties(element.id, { continuationConductorsCount: count });
    if (connectedConduit) {
      const conductors = createConductorsForTerminal(effectiveSectionMM2, count);
      setConduitProperties(connectedConduit.id, { conductors });
    }
  };

  if (!isOpen || !element) return null;

  const isTerminalRef = isTerminalReference(element);
  const symbol = getSymbolById(element.symbolId);
  const attributes = element.attributes || [];

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
                {isTerminalRef
                  ? element.targetDescription || 'Etiqueta / Remate de Caño'
                  : symbol?.label || 'Boca Eléctrica'}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                ({element.x.toFixed(2)}, {element.y.toFixed(2)}) m ·{' '}
                {isTerminalRef ? 'REFERENCIA TÉCNICA' : element.placement.toUpperCase()}
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
          {/* Rama Interconectada del Grafo Eléctrico */}
          {selectedBranch && (selectedBranch.conduits.length > 0 || selectedBranch.elements.length > 1) && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 text-white rounded-xl shadow-xs">
                    <GitBranch size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-blue-950 block">
                      Rama Interconectada:
                    </span>
                    <span className="text-[10px] text-blue-800">
                      {selectedBranch.elements.length} {selectedBranch.elements.length === 1 ? 'boca' : 'bocas'} · {selectedBranch.conduits.length} {selectedBranch.conduits.length === 1 ? 'cañería' : 'cañerías'}
                      {selectedBranch.primaryBoundaryPanel
                        ? ` · Tablero: ${(selectedBranch.primaryBoundaryPanel as any).name || (selectedBranch.primaryBoundaryPanel as any).label || 'Extremo'}`
                        : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-branch-edit-modal'));
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-300 rounded-xl shadow-2xs transition-colors shrink-0"
                >
                  Modificar Rama...
                </button>
              </div>

              {element.circuitId && (
                <button
                  type="button"
                  onClick={() => {
                    updateSelectedBranch({ circuitId: element.circuitId });
                    setAppliedBranchCircuit(true);
                    setTimeout(() => setAppliedBranchCircuit(false), 2000);
                  }}
                  className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  {appliedBranchCircuit ? (
                    <>
                      <Check size={14} />
                      <span>¡Circuito aplicado a toda la rama!</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>Aplicar este circuito a toda la rama</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {isTerminalRef ? (
            <>
              {/* 1. Destino y Referencia Técnica */}
              <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sky-950 font-bold text-xs">
                  <ArrowRight size={16} className="text-sky-600" />
                  <span>Destino / Referencia de Continuación (Remate)</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Descripción del Destino:</label>
                  <input
                    type="text"
                    value={element.targetDescription || ''}
                    onChange={(e) => {
                      setElementProperties(element.id, { targetDescription: e.target.value });
                      if (connectedConduit) {
                        setConduitProperties(connectedConduit.id, { targetDescription: e.target.value });
                      }
                    }}
                    placeholder="Ej: A Tablero General"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['A Tablero General', 'A Tablero Seccional', 'Pase a Planta Alta', 'Pase a Planta Baja', 'Subida a Azotea', 'Acometida de Red'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setElementProperties(element.id, { targetDescription: preset });
                          if (connectedConduit) {
                            setConduitProperties(connectedConduit.id, { targetDescription: preset });
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-colors ${
                          element.targetDescription === preset
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tablero Asociado (Cómputo de Bocas):</label>
                    <select
                      value={element.targetPanelId || ''}
                      onChange={(e) => setElementProperties(element.id, { targetPanelId: e.target.value || null })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                    >
                      <option value="">(Ninguno / No asignado)</option>
                      {panels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || 'Tablero'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Rótulo / Identificador:</label>
                    <input
                      type="text"
                      value={element.label || ''}
                      onChange={(e) => setElementProperties(element.id, { label: e.target.value })}
                      placeholder="Ej: TERM-1"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Circuito que Transporta:</label>
                  <select
                    value={element.circuitId || ''}
                    onChange={(e) => {
                      const nextCid = e.target.value ? e.target.value : null;
                      setElementProperties(element.id, { circuitId: nextCid });
                      if (connectedConduit) {
                        setConduitProperties(connectedConduit.id, {
                          circuitId: nextCid,
                          circuitIds: nextCid ? [nextCid] : []
                        });
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                  >
                    <option value="">(Sin Circuito / No asignado)</option>
                    {circuits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type} - {c.breakerAmperageA}A)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Cómputo Métrico de Tramo (Longitud Desacoplada del Dibujo CAD) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Ruler size={16} className="text-blue-600" />
                  <span>Longitud Física Total del Tramo (Desacoplada del Dibujo CAD)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Define la longitud real total del caño y cableado hacia este remate/pase. Mover la etiqueta en el lienzo CAD es puramente estético y no alterará este cómputo.
                </p>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={effectiveTotalLengthM}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleUpdateTotalLength(isNaN(val) ? undefined : val);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                      m
                    </span>
                  </div>
                  {element.totalLengthM != null && (
                    <button
                      type="button"
                      onClick={() => handleUpdateTotalLength(undefined)}
                      className="px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Volver a cálculo automático según trazado en plano"
                    >
                      Automático
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[5, 10, 15, 20, 25, 30].map((lenPreset) => (
                    <button
                      key={lenPreset}
                      type="button"
                      onClick={() => handleUpdateTotalLength(lenPreset)}
                      className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition-colors ${
                        effectiveTotalLengthM === lenPreset
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lenPreset} m
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Canalización que Continúa (Conducto) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Layers size={16} className="text-blue-600" />
                  <span>Canalización que Continúa (Conducto)</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-600">DIÁMETRO EXTERIOR (CANALIZACIÓN)</label>
                    <span className="font-mono text-xs font-bold text-blue-900">
                      Ø {effectiveDiameterMM} mm
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {catalogs.diameters.map((d) => (
                      <button
                        key={d.mm}
                        type="button"
                        onClick={() => handleUpdateConduitDiameter(d.mm)}
                        className={`px-2 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all text-center ${
                          effectiveDiameterMM === d.mm
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                        }`}
                      >
                        {d.mm}mm ({d.inches})
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Material de la Canalización:</label>
                  <select
                    value={effectiveMaterial}
                    onChange={(e) => handleUpdateConduitMaterial(e.target.value as ConduitMaterial)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    {catalogs.materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Conductores que Continúan (Cables) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Cable size={16} className="text-blue-600" />
                  <span>Conductores que Continúan (Cables)</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Norma / Tipo de Conductor:</label>
                  <select
                    value={effectiveCableStandard}
                    onChange={(e) => handleUpdateCableStandard(e.target.value as CableStandard)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    {catalogs.cableStandards.map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Configuración / Fases:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {[
                      { count: 3, label: 'Monofásico (2x + PE)', sub: '3 conductores' },
                      { count: 4, label: 'Trifásico (3x + PE)', sub: '4 conductores' },
                      { count: 5, label: 'Trifásico c/N (3x + N + PE)', sub: '5 conductores' }
                    ].map((cfg) => (
                      <button
                        key={cfg.count}
                        type="button"
                        onClick={() => handleUpdateConductorsCount(cfg.count)}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          effectiveConductorsCount === cfg.count
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                        }`}
                      >
                        <div className="font-bold text-xs leading-tight">{cfg.label}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            effectiveConductorsCount === cfg.count ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {cfg.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-600">SECCIÓN NOMINAL (CONDUCTORES)</label>
                    <span className="font-mono text-xs font-bold text-blue-900">
                      {effectiveSectionMM2} mm²
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1.5, 2.5, 4.0, 6.0, 10.0, 16.0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleUpdateCableSection(sec)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                          effectiveSectionMM2 === sec
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                        }`}
                      >
                        {sec} mm²
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 1. Rótulo y Circuito */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Rótulo Local:</label>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200" title="Nombre jerárquico completo en plano (Tablero_Circuito_Boca)">
                      {getFormattedElementLabel(element)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={element.label || ''}
                    onChange={(e) => setElementProperties(element.id, { label: e.target.value })}
                    placeholder="Ej: B1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Circuito Asignado:</label>
                  <select
                    value={element.circuitId || ''}
                    onChange={(e) =>
                      setElementProperties(element.id, {
                        circuitId: e.target.value ? e.target.value : null
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                  >
                    <option value="">(Sin Circuito / No asignado)</option>
                    {circuits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type} - {c.breakerAmperageA}A)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Caja / Gabinete Físico:</label>
                  <select
                    value={element.boxTypeId || ''}
                    onChange={(e) =>
                      setElementProperties(element.id, {
                        boxTypeId: e.target.value ? e.target.value : undefined
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                  >
                    <option value="">(Sin especificar caja)</option>
                    {catalogs.boxTypes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Circuitos en Tránsito / De Paso por esta Caja (AEA 771.12) */}
                {circuits.length > 0 && (
                  <div className="sm:col-span-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          Circuitos en Tránsito / De Paso por esta Caja:
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Cables que atraviesan la caja sin alimentar este artefacto
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                        {(element.passingCircuitIds?.length || 0)} en tránsito
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {circuits.map((c) => {
                        const isPassing = (element.passingCircuitIds || []).includes(c.id);
                        const isPrimary = element.circuitId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleElementPassingCircuit(element.id, c.id)}
                            disabled={isPrimary}
                            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                              isPrimary
                                ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                                : isPassing
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                            title={isPrimary ? 'Es el circuito de alimentación de esta boca' : undefined}
                          >
                            {isPrimary ? '⚡ Alimenta: ' : isPassing ? '✓ Pasa: ' : '+ '} {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Altura de Montaje Z (Desde Catálogo Reglamentario AEA) */}
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
                        setElementProperties(element.id, {
                          heightZ: parseFloat(e.target.value) || 0
                        })
                      }
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-blue-900"
                    />
                    <span className="font-mono text-slate-500 font-bold">m</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {catalogs.heightPresets.map((hp) => {
                    const isSelected = Math.abs(element.heightZ - hp.meters) < 0.02;
                    return (
                      <button
                        key={hp.id}
                        type="button"
                        onClick={() => setElementProperties(element.id, { heightZ: hp.meters })}
                        className={`px-2 py-1.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[11px] font-mono leading-tight">{hp.meters.toFixed(2)}m</div>
                        <div className={`text-[9px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {hp.description}
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
                        onClick={() => setElementProperties(element.id, { placement: pl })}
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
                        setElementProperties(element.id, {
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
                        onClick={() => setElementProperties(element.id, { rotation: deg })}
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
              {elementWall && (
                <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-2xl">
                  <div>
                    <span className="font-bold text-blue-950 block">Cara física del muro:</span>
                    <span className="text-[11px] text-blue-800">
                      Adosado a {element.side === 'left' ? 'Cara Izquierda' : 'Cara Derecha'} ({Math.round(elementWall.thickness * 100)}cm)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => invertElementWallSide(element.id)}
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
                        setElementProperties(element.id, {
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
                      onChange={(e) => setElementProperties(element.id, { returnRef: e.target.value })}
                      placeholder="Ej: a"
                      className="w-14 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold text-xs uppercase"
                    />
                    {['a', 'b', 'c'].map((letra) => (
                      <button
                        key={letra}
                        type="button"
                        onClick={() => setElementProperties(element.id, { returnRef: letra })}
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
                      onClick={() => setElementProperties(element.id, { phases: 1 })}
                      className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                        (element.phases || 1) === 1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      1F (220V)
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementProperties(element.id, { phases: 3 })}
                      className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                        element.phases === 3 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      3F (380V)
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 5. Estado de Relevamiento (TRAZA) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Estado de Relevamiento:</label>
            <div className="grid grid-cols-3 gap-2">
              {catalogs.installationStates.map((st) => {
                const isActive = (element.status || 'proyectado') === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setElementProperties(element.id, { status: st.id })}
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
                  Mediciones de Campo y Propiedades (Array Clave-Valor):
                </label>
                <span className="text-[10px] text-slate-500">
                  Valores de instrumental (PAT, tensión, aislación) o datos técnicos ({attributes.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => addElementAttribute(element.id)}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all"
              >
                <Plus size={13} />
                <span>+ Agregar</span>
              </button>
            </div>

            {/* Atajos Rápidos de Claves Sugeridas desde el Modelo */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
              <span className="text-[10px] text-slate-400 font-semibold mr-1 flex-shrink-0">Sugerencias:</span>
              {catalogs.suggestedMetadataKeys.map((sugKey) => (
                <button
                  key={sugKey}
                  type="button"
                  onClick={() => addElementAttribute(element.id, sugKey, '')}
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
                      onChange={(e) => updateElementAttribute(element.id, idx, { key: e.target.value })}
                      className="w-1/3 min-w-[85px] px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Valor (ej: Schneider)"
                      value={attr.value}
                      onChange={(e) => updateElementAttribute(element.id, idx, { value: e.target.value })}
                      className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeElementAttribute(element.id, idx)}
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
              onChange={(e) => setElementProperties(element.id, { notes: e.target.value })}
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
              removeElement(element.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-bold transition-colors"
          >
            <Trash2 size={16} />
            <span>{isTerminalRef ? 'Eliminar Etiqueta' : 'Eliminar Boca'}</span>
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
