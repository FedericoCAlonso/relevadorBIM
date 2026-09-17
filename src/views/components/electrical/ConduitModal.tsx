/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ConduitModal.tsx (Patrón Estricto MVVM)
 * Vista declarativa para inspección y configuración de tramos de cañerías.
 * Delega toda la lógica técnica, catálogos y cálculos al useElectricalViewModel.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import type { Conduit, CableStandard, ConductorRole } from '../../../models/electrical/ElectricalModel';
import { useElectricalViewModel } from '../../../viewmodels/useElectricalViewModel';
import { getSymbolById } from '../../../models/electrical/symbolsLib';
import {
  X,
  Cable,
  Trash2,
  Plus,
  GitBranch,
  Zap,
  Check
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
    conduitAvailableSizes,
    circuits,
    catalogs,
    selectedBranch,
    propagateConduitPropertiesToBranch,
    setConduitProperties,
    applyConduitPreset,
    addConductorToConduit,
    updateConduitConductor,
    removeConductorFromConduit,
    removeConduit,
    toggleConduitCircuit,
    addConduitType
  } = useElectricalViewModel();

  const [hasCopiedToBranch, setHasCopiedToBranch] = useState(false);
  const [showNewMaterialForm, setShowNewMaterialForm] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialSizes, setNewMaterialSizes] = useState('');

  if (!isOpen || !conduit) return null;

  const symFrom = conduitFromElement && 'symbolId' in conduitFromElement && conduitFromElement.symbolId ? getSymbolById(conduitFromElement.symbolId) : null;
  const symTo = conduitToElement && 'symbolId' in conduitToElement && conduitToElement.symbolId ? getSymbolById(conduitToElement.symbolId) : null;

  const handleCreateConduitType = () => {
    if (!newMaterialName.trim()) return;
    const sizes = newMaterialSizes
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    const availableSizes = (sizes.length > 0 ? sizes : [19]).map((mm) => ({
      value: mm,
      label: `Ø${mm} mm`,
      standardSize: `Ø${mm} mm`,
      usefulAreaMM2: Number((Math.PI * Math.pow((mm * 0.85) / 2, 2)).toFixed(1))
    }));
    const newId = `custom-cond-${Date.now()}`;
    addConduitType({
      id: newId,
      name: newMaterialName.trim(),
      availableSizes,
      defaultSizeMM: availableSizes[0].value,
      isCustom: true
    });
    setConduitProperties(conduit.id, {
      material: newId,
      diameterMM: availableSizes[0].value
    });
    setShowNewMaterialForm(false);
    setNewMaterialName('');
    setNewMaterialSizes('');
  };

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
                {(conduitFromElement as any)?.label || (conduitFromElement as any)?.name || symFrom?.label || 'Boca A'} ➔ {(conduitToElement as any)?.label || (conduitToElement as any)?.name || symTo?.label || 'Boca B'}
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
          {selectedBranch && (
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
                      {selectedBranch.conduits.length} {selectedBranch.conduits.length === 1 ? 'cañería' : 'cañerías'} · {selectedBranch.elements.length} {selectedBranch.elements.length === 1 ? 'boca' : 'bocas'}
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
                  className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-300 rounded-xl shadow-2xs transition-colors flex items-center gap-1 shrink-0"
                >
                  <span>Configurar Rama...</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  propagateConduitPropertiesToBranch(conduit.id);
                  setHasCopiedToBranch(true);
                  setTimeout(() => setHasCopiedToBranch(false), 2000);
                }}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                {hasCopiedToBranch ? (
                  <>
                    <Check size={14} />
                    <span>¡Propiedades aplicadas a los {selectedBranch.conduits.length} tramos!</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>Aplicar tipo de caño y cables a toda la rama</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 1. Datos técnicos de ocupación del tramo (Sereno y neutral) */}
          {conduitOccupancy && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-slate-800">
              <div>
                <div className="font-bold text-xs">
                  Factor de Ocupación: {conduitOccupancy.occupancyPercent}% (Capacidad máx: {conduitOccupancy.maxAllowedPercent}%)
                </div>
                <div className="text-[11px] text-slate-500">
                  {conduit.conductors.length} {conduit.conductors.length === 1 ? 'conductor alojado' : 'conductores alojados'}.
                </div>
              </div>
              <div className="text-right font-mono font-bold text-sm text-slate-700">
                {conduitOccupancy.occupancyPercent}%
              </div>
            </div>
          )}

          {/* 2. Calibre / Diámetro Comercial según Material */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {conduit.material.includes('bandeja')
                ? 'Dimensión de Bandeja Perforada (Ancho × Ala 20 mm):'
                : 'Calibre / Diámetro Comercial:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {conduitAvailableSizes.map((sizeOpt) => {
                const isSelected = conduit.diameterMM === sizeOpt.value;
                return (
                  <button
                    key={sizeOpt.value}
                    type="button"
                    onClick={() => setConduitProperties(conduit.id, { diameterMM: sizeOpt.value })}
                    className={`py-2 px-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold leading-tight">
                      {sizeOpt.standardSize || `Ø${sizeOpt.value} mm`}
                    </div>
                    <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {sizeOpt.label.split('[')[0].trim()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tipo de Conducto / Material (Desde Catálogo del Modelo) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 block">Tipo de Conducto (Material):</label>
              <button
                type="button"
                onClick={() => setShowNewMaterialForm(!showNewMaterialForm)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus size={12} />
                <span>{showNewMaterialForm ? 'Cerrar formulario' : 'Nuevo tipo...'}</span>
              </button>
            </div>

            {/* Formulario rápido para alta de nuevo tipo */}
            {showNewMaterialForm && (
              <div className="p-3 mb-2 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <span className="font-bold text-xs text-blue-950 block">Nuevo Tipo de Conducto:</span>
                <input
                  type="text"
                  placeholder="Nombre (ej: Caño Bergman, Manguera 3/4)"
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Calibres mm separados por coma (ej: 16, 19, 25)"
                  value={newMaterialSizes}
                  onChange={(e) => setNewMaterialSizes(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewMaterialForm(false)}
                    className="px-2.5 py-1 text-slate-600 text-xs hover:bg-slate-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateConduitType}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    Guardar y Usar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                      {mat.description && <div className="text-[10px] text-slate-500">{mat.description}</div>}
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

          {/* 5. Circuito Asignado y Multi-circuito */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">Circuito Principal:</label>
                {(() => {
                  const currCirc = circuits.find((c) => c.id === conduit.circuitId);
                  if (!currCirc) return null;
                  return (
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-xs border border-white ring-1 ring-slate-300"
                      style={{ backgroundColor: currCirc.color || '#2563eb' }}
                      title={`Color del circuito en plano: ${currCirc.color || '#2563eb'}`}
                    />
                  );
                })()}
              </div>
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
                  {conduit.manualLengthM ? 'Manual:' : 'Calculado 3D:'}
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

          {/* Vía Física de Tendido (Norma AEA 90364-771) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 text-xs">
                Vía de Tendido del Conducto:
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {conduit.routingPlane === 'ceiling_slab' ? '☁ Losa Techo' : conduit.routingPlane === 'floor_slab' ? '👣 Contrapiso' : '🧱 En Pared'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setConduitProperties(conduit.id, { routingPlane: 'ceiling_slab' })}
                className={`p-2 rounded-xl text-xs font-bold border text-center transition-all ${
                  (conduit.routingPlane || 'wall') === 'ceiling_slab'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ☁ Losa Techo
              </button>
              <button
                type="button"
                onClick={() => setConduitProperties(conduit.id, { routingPlane: 'floor_slab' })}
                className={`p-2 rounded-xl text-xs font-bold border text-center transition-all ${
                  conduit.routingPlane === 'floor_slab'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                👣 Contrapiso
              </button>
              <button
                type="button"
                onClick={() => setConduitProperties(conduit.id, { routingPlane: 'wall' })}
                className={`p-2 rounded-xl text-xs font-bold border text-center transition-all ${
                  (conduit.routingPlane || 'wall') === 'wall'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🧱 En Pared
              </button>
            </div>
            <div className="flex items-center justify-between pt-1.5 text-[11px] text-slate-600 border-t border-slate-200">
              <span className="font-semibold">Geometría de trazado en plano:</span>
              <button
                type="button"
                onClick={() => {
                  const nextMode = conduit.routingMode === 'orthogonal' ? 'schematic_arc' : 'orthogonal';
                  setConduitProperties(conduit.id, {
                    routingMode: nextMode,
                    ...(nextMode === 'schematic_arc' ? { waypoints: undefined } : {})
                  });
                }}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-bold hover:bg-slate-100 flex items-center gap-1.5 text-xs text-slate-800 transition-colors shadow-2xs"
              >
                <span>{conduit.routingMode === 'orthogonal' ? '📐 90° Ortogonal' : '⌒ Arco Curvo AEA'}</span>
              </button>
            </div>
            {conduit.routingMode !== 'schematic_arc' && conduit.waypoints && conduit.waypoints.length > 0 && (
              <div className="flex items-center justify-between pt-1.5 text-[11px] text-amber-900 border-t border-slate-200">
                <span className="font-semibold">Quiebres intermedios: {conduit.waypoints.length} puntos</span>
                <button
                  type="button"
                  onClick={() => setConduitProperties(conduit.id, { waypoints: undefined })}
                  className="px-2 py-0.5 rounded-md bg-white border border-red-300 text-red-700 font-bold hover:bg-red-50 text-xs cursor-pointer transition-colors"
                >
                  Restablecer a directo
                </button>
              </div>
            )}
          </div>

          {/* Montante Vertical / Pase de Losa (Remate a Distancia) */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(conduit.isRiserTerminal || (conduit.additionalLengthM && conduit.additionalLengthM > 0))}
                  onChange={(e) => {
                    const active = e.target.checked;
                    setConduitProperties(conduit.id, {
                      isRiserTerminal: active,
                      additionalLengthM: active ? (conduit.additionalLengthM || 3.0) : undefined
                    });
                  }}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-0 bg-white border-amber-300"
                />
                <span className="font-bold text-amber-950 text-xs">
                  ⌖ Remate en Montante Vertical / Pase de Losa
                </span>
              </label>
              {Boolean(conduit.isRiserTerminal || (conduit.additionalLengthM && conduit.additionalLengthM > 0)) && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                  +{(conduit.additionalLengthM || 0).toFixed(2)}m
                </span>
              )}
            </div>

            {Boolean(conduit.isRiserTerminal || (conduit.additionalLengthM && conduit.additionalLengthM > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200 animate-in fade-in duration-100">
                <div>
                  <label className="text-[10px] font-bold text-amber-900 block mb-0.5">
                    METROS VERTICALES RESTANTES (+ΔZ):
                  </label>
                  <div className="flex items-center gap-1 bg-white border border-amber-300 rounded-xl px-2 py-1">
                    <span className="text-amber-700 font-mono font-bold">+</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={conduit.additionalLengthM ?? 3.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConduitProperties(conduit.id, {
                          additionalLengthM: isNaN(val) ? 0 : val
                        });
                      }}
                      className="w-full bg-transparent font-mono font-bold text-amber-950 outline-none text-xs"
                    />
                    <span className="text-amber-600 text-xs font-mono">m</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-amber-900 block mb-0.5">
                    DESTINO / ETIQUETA DE MONTANTE:
                  </label>
                  <input
                    type="text"
                    value={conduit.targetDescription || ''}
                    onChange={(e) =>
                      setConduitProperties(conduit.id, {
                        targetDescription: e.target.value
                      })
                    }
                    placeholder="Ej: A Tablero Subsuelo"
                    className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1 text-xs font-semibold text-amber-950 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Circuitos en tránsito / compartidos por el conducto */}
          {circuits.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  Circuitos en este Conducto:
                </span>
                <span className="text-[10px] text-slate-500">
                  {(conduit.circuitIds?.length || (conduit.circuitId ? 1 : 0))} seleccionado(s)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {circuits.map((c) => {
                  const isAssigned = (conduit.circuitIds || (conduit.circuitId ? [conduit.circuitId] : [])).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleConduitCircuit(conduit.id, c.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                        isAssigned
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white"
                        style={{ backgroundColor: c.color || '#2563eb' }}
                      />
                      {isAssigned ? '✓ ' : '+ '} {c.name} ({c.type})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desglose Métrico (Planta Ortogonal + Desnivel Z) */}
          {conduitBreakdown && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                <span>Desglose Métrico 3D (Norma AEA 90364-771):</span>
                <span className="font-mono text-blue-800 font-bold">{conduitBreakdown.totalLengthM.toFixed(2)} m</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono">
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-500 block font-sans font-semibold">
                    {conduit.routingPlane === 'ceiling_slab'
                      ? '1. Losa (Diagonal)'
                      : conduit.routingPlane === 'floor_slab'
                      ? '1. Piso (Diagonal)'
                      : '1. Pared (Ortogonal)'}
                  </span>
                  <strong className="text-slate-900">{conduitBreakdown.distPlantaHorizontal.toFixed(2)} m</strong>
                  <span className="text-[9px] text-slate-400 block font-sans">
                    dx:{conduitBreakdown.dx}m · dy:{conduitBreakdown.dy}m
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-500 block font-sans font-semibold">
                    {conduit.routingPlane === 'ceiling_slab'
                      ? '2. Pared a Losa (Sub/Baj)'
                      : conduit.routingPlane === 'floor_slab'
                      ? '2. Pared a Piso (Baj/Sub)'
                      : '2. Desnivel Z (|Δh|)'}
                  </span>
                  <strong className="text-slate-900">{conduitBreakdown.dzLocal.toFixed(2)} m</strong>
                  <span className="text-[9px] text-slate-400 block font-sans">
                    z1:{conduitFromElement?.heightZ.toFixed(2)}m ➔ z2:{conduitToElement?.heightZ.toFixed(2)}m
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-500 block font-sans font-semibold">3. Montante / Pase:</span>
                  <strong className="text-amber-800">
                    +{conduitBreakdown.additionalLengthM.toFixed(2)} m
                  </strong>
                  <span className="text-[9px] text-slate-400 block font-sans">
                    {conduit.targetDescription || 'A nivel/remate'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-500 block font-sans font-semibold">4. Curvas (+10%):</span>
                  <strong className="text-slate-900">
                    {Number(((conduitBreakdown.distPlantaHorizontal + conduitBreakdown.dzLocal + conduitBreakdown.dzNiveles + conduitBreakdown.additionalLengthM) * 0.10).toFixed(2))} m
                  </strong>
                  <span className="text-[9px] text-slate-400 block font-sans">Holgura reglamentaria</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Presets Rápidos de Conductores */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700">Llenado Rápido (Presets):</label>
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
