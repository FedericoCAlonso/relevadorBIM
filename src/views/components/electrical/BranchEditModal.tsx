/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BranchEditModal.tsx (Patrón Estricto MVVM)
 * Modal declarativo para modificación en lote de toda una rama interconectada
 * del grafo eléctrico (bocas, cañerías, conductores y circuitos).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo } from 'react';
import { useElectricalViewModel } from '../../../viewmodels/useElectricalViewModel';
import { getSizesForConduitType, getDefaultSizeForConduitType } from '../../../models/electrical/electricalStandards';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { ConduitMaterial, CableStandard, ConduitRoutingPlane } from '../../../models/electrical/ElectricalModel';
import {
  X,
  GitBranch,
  Zap,
  CheckCircle2
} from 'lucide-react';

interface BranchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BranchEditModal: React.FC<BranchEditModalProps> = ({ isOpen, onClose }) => {
  const {
    selectedBranch,
    circuits,
    catalogs,
    updateSelectedBranch
  } = useElectricalViewModel();

  const { project } = useProjectStore();

  const [circuitId, setCircuitId] = useState<string>('');
  const [conduitMaterial, setConduitMaterial] = useState<ConduitMaterial>('hierro_semipesado_rs');
  const [conduitDiameterMM, setConduitDiameterMM] = useState<number>(19);
  const [wireSectionMM2, setWireSectionMM2] = useState<number>(2.5);
  const [conductorPresetId, setConductorPresetId] = useState<string>('');
  const [cableStandard, setCableStandard] = useState<CableStandard>('IRAM_NM_247_3');
  const [routingPlane, setRoutingPlane] = useState<ConduitRoutingPlane>('ceiling_slab');
  const [status, setStatus] = useState<'existente' | 'proyectado' | 'a_reemplazar'>('proyectado');
  const [appliedNotification, setAppliedNotification] = useState(false);

  const [prevBranchKey, setPrevBranchKey] = useState<string | null>(null);
  const currentBranchKey = isOpen && selectedBranch ? (selectedBranch.conduitIds[0] || selectedBranch.elementIds[0] || 'branch') : null;
  if (currentBranchKey !== prevBranchKey) {
    setPrevBranchKey(currentBranchKey);
    if (selectedBranch && isOpen) {
      setCircuitId(selectedBranch.predominantCircuitId || '');
      setConduitMaterial(selectedBranch.predominantMaterial || (catalogs.materials[0]?.id as ConduitMaterial) || 'hierro_semipesado_rs');
      setConduitDiameterMM(selectedBranch.predominantDiameterMM || 19);
      setWireSectionMM2(selectedBranch.predominantWireSectionMM2 || 2.5);
      setConductorPresetId('');
      setCableStandard((catalogs.cableStandards[0]?.id as CableStandard) || 'IRAM_NM_247_3');
      const firstConduit = selectedBranch.conduits[0];
      if (firstConduit?.routingPlane) {
        setRoutingPlane(firstConduit.routingPlane);
      }
      const firstElement = selectedBranch.elements[0];
      if (firstElement?.status) {
        setStatus(firstElement.status);
      }
      setAppliedNotification(false);
    }
  }

  // Calibres válidos para el material actualmente elegido
  const availableSizes = useMemo(() => {
    return getSizesForConduitType(conduitMaterial, project.materialCatalog);
  }, [conduitMaterial, project.materialCatalog]);

  // Al cambiar material, ajustar calibre si no es válido
  const handleMaterialChange = (newMat: ConduitMaterial) => {
    setConduitMaterial(newMat);
    const validSizes = getSizesForConduitType(newMat, project.materialCatalog);
    const isValid = validSizes.some((s) => s.value === conduitDiameterMM);
    if (!isValid) {
      setConduitDiameterMM(getDefaultSizeForConduitType(newMat, project.materialCatalog));
    }
  };

  if (!isOpen || !selectedBranch) return null;

  const boundaryPanel = selectedBranch.primaryBoundaryPanel;
  const elementsCount = selectedBranch.elements.length;
  const conduitsCount = selectedBranch.conduits.length;

  const handleApply = () => {
    updateSelectedBranch({
      circuitId: circuitId ? circuitId : null,
      conduitMaterial,
      conduitDiameterMM,
      wireSectionMM2,
      conductorPresetId: conductorPresetId || undefined,
      cableStandard,
      routingPlane,
      status
    });

    setAppliedNotification(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm flex items-center justify-center">
              <GitBranch size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Modificar Rama Interconectada
              </h3>
              <p className="text-[11px] text-slate-500">
                {elementsCount} {elementsCount === 1 ? 'boca' : 'bocas'} · {conduitsCount} {conduitsCount === 1 ? 'tramo' : 'tramos'} de cañería
                {boundaryPanel ? ` · Tablero: ${(boundaryPanel as any).name || (boundaryPanel as any).label || 'Extremo'}` : ''}
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
          {/* Resumen Informativo Neutral de la Rama */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-blue-950">
            <div>
              <span className="font-bold text-xs block">
                Alcance de la Actualización:
              </span>
              <span className="text-[11px] text-blue-800">
                Los cambios se aplicarán exclusivamente a esta rama conexa. Los extremos conectados a tablero preservarán íntegramente su configuración y naturaleza.
              </span>
            </div>
            <div className="text-right font-mono font-bold text-xs text-blue-700 flex-shrink-0 bg-white px-2.5 py-1 rounded-xl border border-blue-200">
              {elementsCount + conduitsCount} elem.
            </div>
          </div>

          {/* 1. Circuito Asignado */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Circuito Eléctrico de la Rama:
            </label>
            <select
              value={circuitId}
              onChange={(e) => setCircuitId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            >
              <option value="">(Sin Circuito / No Asignado)</option>
              {circuits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type} - {c.wireSectionBaseMM2}mm² - {c.breakerAmperageA}A)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Tipo de Conducto y Calibre */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-700">
              Tipo de Conducto (Material) para toda la Rama:
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {catalogs.materials.map((mat) => {
                const isSelected = conduitMaterial === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleMaterialChange(mat.id as ConduitMaterial)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 text-blue-900 font-bold shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs">{mat.label}</div>
                      {mat.description && <div className="text-[10px] text-slate-400 font-normal">{mat.description}</div>}
                    </div>
                    {isSelected && <span className="text-blue-600 font-bold text-xs">✓</span>}
                  </button>
                );
              })}
            </div>

            <label className="block font-bold text-slate-700 mt-2">
              Calibre Comercial de Cañería:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {availableSizes.map((sizeOpt) => {
                const isSelected = conduitDiameterMM === sizeOpt.value;
                return (
                  <button
                    key={sizeOpt.value}
                    type="button"
                    onClick={() => setConduitDiameterMM(sizeOpt.value)}
                    className={`py-2 px-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold leading-tight">
                      {sizeOpt.standardSize || `Ø${sizeOpt.value} mm`}
                    </div>
                    <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {sizeOpt.label.split('[')[0].trim()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Conductor / Cables */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <span className="font-bold text-slate-800 text-xs block">
              Conductores y Sección del Cableado:
            </span>

            {/* Presets Rápidos AEA */}
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                Llenado Rápido con Preset AEA:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {catalogs.conductorPresets.map((pr) => {
                  const isSelected = conductorPresetId === pr.id;
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => {
                        setConductorPresetId(isSelected ? '' : pr.id);
                        if (!isSelected) {
                          setWireSectionMM2(pr.conductors[0]?.sectionMM2 || 2.5);
                        }
                      }}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[11px] leading-tight font-bold">{pr.label}</div>
                      <div className={`text-[9px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {pr.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sección Troncal mm² */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Sección Troncal de Cable:
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[1.5, 2.5, 4.0, 6.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setWireSectionMM2(sec);
                        setConductorPresetId('');
                      }}
                      className={`py-1.5 rounded-lg font-mono font-bold text-xs border transition-all ${
                        wireSectionMM2 === sec && !conductorPresetId
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sec.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Norma de Conductor:
                </label>
                <select
                  value={cableStandard}
                  onChange={(e) => setCableStandard(e.target.value as CableStandard)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {catalogs.cableStandards.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Vía de Tendido */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Vía Física de Tendido de los Conductos:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'ceiling_slab', label: '☁ Losa Techo' },
                { id: 'floor_slab', label: '👣 Contrapiso' },
                { id: 'wall', label: '🧱 En Pared' }
              ].map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => setRoutingPlane(pl.id as ConduitRoutingPlane)}
                  className={`p-2 rounded-xl text-xs font-bold border text-center transition-all ${
                    routingPlane === pl.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Estado de Relevamiento */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Estado de Relevamiento de la Rama:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'existente', label: 'Existente', bg: 'bg-emerald-600 text-white', inactive: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                { id: 'proyectado', label: 'Proyectado', bg: 'bg-blue-600 text-white', inactive: 'bg-blue-50 text-blue-800 border-blue-200' },
                { id: 'a_reemplazar', label: 'A Reemplazar', bg: 'bg-amber-600 text-white', inactive: 'bg-amber-50 text-amber-800 border-amber-200' }
              ].map((st) => {
                const isActive = status === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatus(st.id as any)}
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
        </div>

        {/* Pie de Acciones */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-200/70 rounded-2xl font-bold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl font-bold shadow-md transition-all text-center flex items-center justify-center gap-2"
          >
            {appliedNotification ? (
              <>
                <CheckCircle2 size={18} className="animate-bounce" />
                <span>¡Rama Actualizada!</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Actualizar Rama ({elementsCount + conduitsCount} elementos)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
