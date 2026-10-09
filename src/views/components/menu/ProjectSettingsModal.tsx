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
  BOX_CATEGORIES_CATALOG,
  BOX_MATERIALS_CATALOG,
  DEFAULT_CABLE_SECTIONS,
  STANDARD_CUSTOM_CONDUIT_SIZES,
  createCableTraySizeOptions,
  createDefaultMaterialCatalog
} from '../../../models/electrical/electricalStandards';
import {
  CAD_SNAP_CONFIG,
  AEA_GRID_CONSTANTS,
  AEA_VOLTAGE_DROP_LIMITS,
  AEA_CONDUIT_OCCUPANCY_LIMITS,
  AEA_MOUNTING_HEIGHTS,
  OPENING_TYPE_OPTIONS,
  OPENING_SWING_OPTIONS
} from '../../../config';
import { DEFAULT_OPENING_TYPES } from '../../../models/architecture/openingPresets';
import type { OpeningType, OpeningSwing } from '../../../models/architecture/Opening';
import type {
  ConduitMaterial,
  CableStandard,
  BoxCategory,
  BoxMaterialBase
} from '../../../models/electrical/ElectricalModel';
import { X, Building2, Sliders, Package, Plus, Trash2, Compass, BookOpen, RotateCcw } from 'lucide-react';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    project,
    updateProjectMeta,
    addConduitType,
    removeConduitType,
    addCableType,
    removeCableType,
    addBoxType,
    removeBoxType,
    addOpeningType,
    removeOpeningType
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'obra' | 'cad' | 'normas' | 'catalogo'>('obra');
  const [catalogCategory, setCatalogCategory] = useState<'conduits' | 'cables' | 'boxes' | 'openings'>('conduits');

  // Formularios de alta
  const [showNewConduit, setShowNewConduit] = useState(false);
  const [newConduitName, setNewConduitName] = useState('');
  const [newConduitDesc, setNewConduitDesc] = useState('');
  const [newConduitSize, setNewConduitSize] = useState(19);
  const [newConduitIsTray, setNewConduitIsTray] = useState(false);
  const [newTrayFlangeMM, setNewTrayFlangeMM] = useState(50);

  const [showNewCable, setShowNewCable] = useState(false);
  const [newCableName, setNewCableName] = useState('');
  const [newCableDesc, setNewCableDesc] = useState('');
  const [newCableSection, setNewCableSection] = useState(2.5);

  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxCategory, setNewBoxCategory] = useState<BoxCategory>('caja_rectangular');
  const [newBoxMaterial, setNewBoxMaterial] = useState<BoxMaterialBase>('chapa');
  const [newBoxDesc, setNewBoxDesc] = useState('');
  const [newBoxWidthMM, setNewBoxWidthMM] = useState(50);
  const [newBoxHeightMM, setNewBoxHeightMM] = useState(100);

  const [showNewOpening, setShowNewOpening] = useState(false);
  const [newOpeningName, setNewOpeningName] = useState('');
  const [newOpeningType, setNewOpeningType] = useState<OpeningType>('door');
  const [newOpeningWidth, setNewOpeningWidth] = useState(0.80);
  const [newOpeningHeight, setNewOpeningHeight] = useState(2.05);
  const [newOpeningSill, setNewOpeningSill] = useState(0.0);
  const [newOpeningSwing, setNewOpeningSwing] = useState<OpeningSwing>('left_in');
  const [newOpeningDesc, setNewOpeningDesc] = useState('');

  if (!isOpen) return null;

  const catalog = project.materialCatalog || createDefaultMaterialCatalog();

  const handleAddConduit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConduitName.trim()) return;
    const id = `custom_conduit_${Date.now()}`;
    if (newConduitIsTray) {
      addConduitType({
        id,
        name: newConduitName.trim(),
        description: newConduitDesc.trim() || undefined,
        defaultSizeMM: newConduitSize,
        isTray: true,
        trayFlangeHeightMM: newTrayFlangeMM,
        availableSizes: createCableTraySizeOptions([50, 100, 150, 200, 300, 450, 600], newTrayFlangeMM),
        isCustom: true
      });
    } else {
      addConduitType({
        id,
        name: newConduitName.trim(),
        description: newConduitDesc.trim() || undefined,
        defaultSizeMM: newConduitSize,
        availableSizes: [...STANDARD_CUSTOM_CONDUIT_SIZES],
        isCustom: true
      });
    }
    setNewConduitName('');
    setNewConduitDesc('');
    setNewConduitIsTray(false);
    setShowNewConduit(false);
  };

  const handleAddCable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCableName.trim()) return;
    const id = `custom_cable_${Date.now()}`;
    addCableType({
      id,
      name: newCableName.trim(),
      description: newCableDesc.trim() || undefined,
      defaultSectionMM2: newCableSection,
      availableSectionsMM2: [...DEFAULT_CABLE_SECTIONS],
      isCustom: true
    });
    setNewCableName('');
    setNewCableDesc('');
    setShowNewCable(false);
  };

  const handleAddBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoxName.trim()) return;
    const id = `custom_box_${Date.now()}`;
    addBoxType({
      id,
      name: newBoxName.trim(),
      category: newBoxCategory,
      materialBase: newBoxMaterial,
      description: newBoxDesc.trim() || undefined,
      widthMM: newBoxWidthMM > 0 ? newBoxWidthMM : undefined,
      heightMM: newBoxHeightMM > 0 ? newBoxHeightMM : undefined,
      isCustom: true
    });
    setNewBoxName('');
    setNewBoxDesc('');
    setShowNewBox(false);
  };

  const handleAddOpening = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpeningName.trim()) return;
    const id = `custom_opening_${Date.now()}`;
    addOpeningType({
      id,
      name: newOpeningName.trim(),
      type: newOpeningType,
      width: Number(newOpeningWidth.toFixed(2)),
      height: Number(newOpeningHeight.toFixed(2)),
      sill: Number(newOpeningSill.toFixed(2)),
      defaultSwing: newOpeningSwing,
      description: newOpeningDesc.trim() || undefined,
      isCustom: true
    });
    setNewOpeningName('');
    setNewOpeningDesc('');
    setShowNewOpening(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
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
                Parámetros de la obra y catálogo de materiales
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

        {/* Selector de Solapas Principales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('obra')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all ${
              activeTab === 'obra'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Building2 size={15} />
            <span>Datos Obra</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cad')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all ${
              activeTab === 'cad'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Compass size={15} />
            <span>Entorno CAD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('normas')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all ${
              activeTab === 'normas'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <BookOpen size={15} />
            <span>Normas AEA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all ${
              activeTab === 'catalogo'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Package size={15} />
            <span>Catálogo</span>
          </button>
        </div>

        {/* Contenido según Solapa */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'obra' && (
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
                <label className="block font-bold text-slate-700 mb-1">Técnico / Relevador:</label>
                <input
                  type="text"
                  value={project.meta.electricianName || ''}
                  onChange={(e) => updateProjectMeta({ electricianName: e.target.value })}
                  placeholder="Ej: Ing. / Téc. Relevador"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tensión de Red Predeterminada:</label>
                <select
                  value={project.meta.defaultVoltageV || AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_SINGLE_PHASE}
                  onChange={(e) => updateProjectMeta({ defaultVoltageV: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                >
                  <option value={AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_SINGLE_PHASE}>
                    Monofásica ({AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_SINGLE_PHASE} V · Fase y Neutro)
                  </option>
                  <option value={AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_THREE_PHASE}>
                    Trifásica ({AEA_GRID_CONSTANTS.NOMINAL_VOLTAGE_THREE_PHASE} V · 3 Fases y Neutro)
                  </option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'cad' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-2.5">
                <Compass size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-blue-900 block">Sensibilidad del Lienzo y Smart Grips</span>
                  <span className="text-[11px] text-blue-800 leading-relaxed block">
                    Ajuste la tolerancia de imantación magnética al dibujar muros, empalmes en T y canalizaciones.
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 text-xs">Snap a Vértices y Esquinas:</label>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {(project.meta.cadSnapToleranceM ?? CAD_SNAP_CONFIG.VERTEX_TOLERANCE_METERS).toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.80}
                    step={0.05}
                    value={project.meta.cadSnapToleranceM ?? CAD_SNAP_CONFIG.VERTEX_TOLERANCE_METERS}
                    onChange={(e) => updateProjectMeta({ cadSnapToleranceM: parseFloat(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Distancia para fusionar automáticamente esquinas de muros.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 text-xs">Snap Deslizante a Muros (Empalmes T):</label>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {(project.meta.cadWallToleranceM ?? CAD_SNAP_CONFIG.WALL_TOLERANCE_METERS).toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.80}
                    step={0.05}
                    value={project.meta.cadWallToleranceM ?? CAD_SNAP_CONFIG.WALL_TOLERANCE_METERS}
                    onChange={(e) => updateProjectMeta({ cadWallToleranceM: parseFloat(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Distancia perpendicular para proyectar empalmes rectos sobre muros existentes.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 text-xs">Tolerancia Angular Ortogonal / Polar:</label>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {(project.meta.cadOrthogonalAngleToleranceDeg ?? CAD_SNAP_CONFIG.ORTHOGONAL_ANGLE_TOLERANCE_DEG).toFixed(1)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={12.0}
                    step={0.5}
                    value={project.meta.cadOrthogonalAngleToleranceDeg ?? CAD_SNAP_CONFIG.ORTHOGONAL_ANGLE_TOLERANCE_DEG}
                    onChange={(e) => updateProjectMeta({ cadOrthogonalAngleToleranceDeg: parseFloat(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Desvío máximo para fijar escuadra exacta a 0°, 45°, 90°, 135°, 180°, etc.
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => updateProjectMeta({
                      cadSnapToleranceM: CAD_SNAP_CONFIG.VERTEX_TOLERANCE_METERS,
                      cadWallToleranceM: CAD_SNAP_CONFIG.WALL_TOLERANCE_METERS,
                      cadOrthogonalAngleToleranceDeg: CAD_SNAP_CONFIG.ORTHOGONAL_ANGLE_TOLERANCE_DEG
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    <RotateCcw size={13} />
                    <span>Restablecer Tolerancias por Defecto</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'normas' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5">
                <BookOpen size={18} className="text-slate-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-900 block">
                    Reglamentación AEA 90364-771 / IRAM
                  </span>
                  <span className="text-[11px] text-slate-600 leading-relaxed block">
                    Constantes físicas y referencias reglamentarias empleadas en los cómputos de caída de tensión, ocupación de cañerías y alturas de relevamiento.
                  </span>
                </div>
              </div>

              {/* Caídas de Tensión Admisibles */}
              <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                <span className="font-bold text-xs text-slate-800 block">
                  Caída de Tensión Máxima Admisible (AEA 771.19)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 block">Iluminación (IUG / IUE):</span>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      ≤ {AEA_VOLTAGE_DROP_LIMITS.LIGHTING_CIRCUITS_MAX_PERCENT}% (ΔV ≤ 6.6 V)
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 block">Fuerza Motriz / Tomas:</span>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      ≤ {AEA_VOLTAGE_DROP_LIMITS.POWER_CIRCUITS_MAX_PERCENT}% (ΔV ≤ 11.0 V)
                    </span>
                  </div>
                </div>
              </div>

              {/* Ocupación Máxima de Cañerías */}
              <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                <span className="font-bold text-xs text-slate-800 block">
                  Ocupación Máxima en Cañerías (AEA 771.12.3)
                </span>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">1 Conductor</span>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {AEA_CONDUIT_OCCUPANCY_LIMITS.SINGLE_CONDUCTOR_MAX_PERCENT}%
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">2 Conductores</span>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {AEA_CONDUIT_OCCUPANCY_LIMITS.TWO_CONDUCTORS_MAX_PERCENT}%
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">≥ 3 Conductores</span>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {AEA_CONDUIT_OCCUPANCY_LIMITS.THREE_OR_MORE_CONDUCTORS_MAX_PERCENT}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Alturas de Montaje Sugeridas */}
              <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                <span className="font-bold text-xs text-slate-800 block">
                  Alturas Típicas de Montaje sobre Nivel de Piso Terminado
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                  {AEA_MOUNTING_HEIGHTS.map((h) => (
                    <div
                      key={h.id}
                      className="p-1.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center"
                      title={h.description}
                    >
                      <span className="text-slate-600 truncate pr-1">{h.label.split('(')[0].trim()}:</span>
                      <span className="font-mono font-bold text-slate-900 shrink-0">+{h.heightM.toFixed(2)} m</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalogo' && (
            <div className="space-y-3">
              {/* Sub-pills de las Categorías del Catálogo de Proyecto */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCatalogCategory('conduits')}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    catalogCategory === 'conduits'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Canaliz. ({catalog.conduitTypes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategory('cables')}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    catalogCategory === 'cables'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Conduct. ({catalog.cableTypes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategory('boxes')}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    catalogCategory === 'boxes'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cajas ({catalog.boxTypes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategory('openings')}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    catalogCategory === 'openings'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Aberturas ({(catalog.openingTypes || DEFAULT_OPENING_TYPES).length})
                </button>
              </div>

              {/* Categoría 1: Canalizaciones */}
              {catalogCategory === 'conduits' && (
                <div className="space-y-2.5">
                  {/* Selector de material de cañería por defecto */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">Canalización por Defecto:</span>
                      <span className="text-[10px] text-slate-500">Para nuevos tramos trazados</span>
                    </div>
                    <select
                      value={project.meta.defaultConduitMaterial || 'hierro_semipesado_rs'}
                      onChange={(e) => updateProjectMeta({ defaultConduitMaterial: e.target.value as ConduitMaterial })}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] truncate"
                    >
                      {catalog.conduitTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600 font-semibold text-[11px]">
                      Tipos de Caños, Conductos y Bandejas registrados:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewConduit(!showNewConduit)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={14} />
                      <span>{showNewConduit ? 'Cancelar' : 'Agregar Tipo'}</span>
                    </button>
                  </div>

                  {showNewConduit && (
                    <form onSubmit={handleAddConduit} className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                      <div className="font-bold text-blue-900 text-xs">Nuevo Tipo de Canalización:</div>
                      <div>
                        <input
                          type="text"
                          required
                          value={newConduitName}
                          onChange={(e) => setNewConduitName(e.target.value)}
                          placeholder="Nombre (ej: Caño Bergman, Manguera Reforzada)"
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newConduitDesc}
                          onChange={(e) => setNewConduitDesc(e.target.value)}
                          placeholder="Descripción (opcional)"
                          className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                            {newConduitIsTray ? 'Ancho def:' : 'Ø defecto:'}
                          </span>
                          <input
                            type="number"
                            min={10}
                            max={600}
                            value={newConduitSize}
                            onChange={(e) => setNewConduitSize(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                          />
                          <span className="text-[10px] text-slate-500">mm</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-blue-200/60">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newConduitIsTray}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setNewConduitIsTray(checked);
                              if (checked && newConduitSize < 50) setNewConduitSize(150);
                            }}
                            className="rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-[11px] text-blue-950">¿Es bandeja portacables?</span>
                        </label>
                        {newConduitIsTray && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Ala / Pestaña:</span>
                            <input
                              type="number"
                              min={15}
                              max={150}
                              step={5}
                              value={newTrayFlangeMM}
                              onChange={(e) => setNewTrayFlangeMM(Number(e.target.value))}
                              className="w-16 px-1.5 py-1 bg-white border border-blue-300 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                            />
                            <span className="text-[10px] text-slate-500">mm</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors"
                      >
                        Registrar Canalización
                      </button>
                    </form>
                  )}

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {catalog.conduitTypes.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs truncate">{c.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold ${
                                c.isCustom
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-200/80 text-slate-600'
                              }`}
                            >
                              {c.isCustom ? 'Personalizado' : 'Estándar'}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-[10px] text-slate-500 truncate">{c.description}</p>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {c.isTray
                              ? `Bandeja (Ala ${c.trayFlangeHeightMM ?? 50}mm · ${c.availableSizes.length} calibres)`
                              : `${c.availableSizes.length} calibres (defecto: Ø${c.defaultSizeMM}mm)`}
                          </span>
                        </div>
                        {c.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeConduitType(c.id)}
                            title="Eliminar tipo de canalización personalizado"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoría 2: Conductores */}
              {catalogCategory === 'cables' && (
                <div className="space-y-2.5">
                  {/* Selector de conductor por defecto */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">Conductor por Defecto:</span>
                      <span className="text-[10px] text-slate-500">Para nuevos conductores asignados</span>
                    </div>
                    <select
                      value={project.meta.defaultCableStandard || 'IRAM_NM_247_3'}
                      onChange={(e) => updateProjectMeta({ defaultCableStandard: e.target.value as CableStandard })}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] truncate"
                    >
                      {catalog.cableTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600 font-semibold text-[11px]">
                      Tipos y Normas de Conductores registrados:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewCable(!showNewCable)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={14} />
                      <span>{showNewCable ? 'Cancelar' : 'Agregar Tipo'}</span>
                    </button>
                  </div>

                  {showNewCable && (
                    <form onSubmit={handleAddCable} className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                      <div className="font-bold text-blue-900 text-xs">Nuevo Tipo de Conductor:</div>
                      <div>
                        <input
                          type="text"
                          required
                          value={newCableName}
                          onChange={(e) => setNewCableName(e.target.value)}
                          placeholder="Nombre (ej: Cable Tela / Goma, Sintenax Antiguo)"
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newCableDesc}
                          onChange={(e) => setNewCableDesc(e.target.value)}
                          placeholder="Descripción (opcional)"
                          className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Secc. defecto:</span>
                          <input
                            type="number"
                            step="0.5"
                            min={0.5}
                            max={50}
                            value={newCableSection}
                            onChange={(e) => setNewCableSection(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                          />
                          <span className="text-[10px] text-slate-500">mm²</span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors"
                      >
                        Registrar Conductor
                      </button>
                    </form>
                  )}

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {catalog.cableTypes.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs truncate">{c.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold ${
                                c.isCustom
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-200/80 text-slate-600'
                              }`}
                            >
                              {c.isCustom ? 'Personalizado' : 'Estándar'}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-[10px] text-slate-500 truncate">{c.description}</p>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {c.availableSectionsMM2.length} secciones (defecto: {c.defaultSectionMM2} mm²)
                          </span>
                        </div>
                        {c.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeCableType(c.id)}
                            title="Eliminar conductor personalizado"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoría 3: Cajas y Gabinetes */}
              {catalogCategory === 'boxes' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold text-[11px]">
                      Tipos de Cajas y Gabinetes registrados:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewBox(!showNewBox)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={14} />
                      <span>{showNewBox ? 'Cancelar' : 'Agregar Tipo'}</span>
                    </button>
                  </div>

                  {showNewBox && (
                    <form onSubmit={handleAddBox} className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                      <div className="font-bold text-blue-900 text-xs">Nueva Caja o Gabinete:</div>
                      <div>
                        <input
                          type="text"
                          required
                          value={newBoxName}
                          onChange={(e) => setNewBoxName(e.target.value)}
                          placeholder="Nombre (ej: Caja Cuadrada 15x15 Estanca)"
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Categoría:</label>
                          <select
                            value={newBoxCategory}
                            onChange={(e) => {
                              const cat = e.target.value as BoxCategory;
                              setNewBoxCategory(cat);
                              if (cat === 'gabinete_tablero') {
                                setNewBoxWidthMM(300);
                                setNewBoxHeightMM(400);
                              } else if (cat === 'caja_rectangular') {
                                setNewBoxWidthMM(50);
                                setNewBoxHeightMM(100);
                              } else if (cat === 'caja_cuadrada') {
                                setNewBoxWidthMM(100);
                                setNewBoxHeightMM(100);
                              } else if (cat === 'caja_octogonal') {
                                setNewBoxWidthMM(90);
                                setNewBoxHeightMM(90);
                              } else if (cat === 'caja_mignon') {
                                setNewBoxWidthMM(50);
                                setNewBoxHeightMM(50);
                              }
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            {BOX_CATEGORIES_CATALOG.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Material Base:</label>
                          <select
                            value={newBoxMaterial}
                            onChange={(e) => setNewBoxMaterial(e.target.value as BoxMaterialBase)}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            {BOX_MATERIALS_CATALOG.map((mat) => (
                              <option key={mat.id} value={mat.id}>
                                {mat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Ancho de Frente (mm):</label>
                          <input
                            type="number"
                            step={5}
                            min={30}
                            max={1500}
                            value={newBoxWidthMM}
                            onChange={(e) => setNewBoxWidthMM(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Alto de Frente (mm):</label>
                          <input
                            type="number"
                            step={5}
                            min={30}
                            max={2000}
                            value={newBoxHeightMM}
                            onChange={(e) => setNewBoxHeightMM(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newBoxDesc}
                          onChange={(e) => setNewBoxDesc(e.target.value)}
                          placeholder="Descripción (opcional)"
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors"
                      >
                        Registrar Caja / Gabinete
                      </button>
                    </form>
                  )}

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {catalog.boxTypes.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs truncate">{b.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold ${
                                b.isCustom
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-200/80 text-slate-600'
                              }`}
                            >
                              {b.isCustom ? 'Personalizado' : 'Estándar'}
                            </span>
                          </div>
                          {b.description && (
                            <p className="text-[10px] text-slate-500 truncate">{b.description}</p>
                          )}
                          <span className="text-[10px] text-slate-400 capitalize">
                            {b.category.replace(/_/g, ' ')} {b.materialBase ? `· ${b.materialBase}` : ''}
                            {b.widthMM && b.heightMM ? ` · ${b.widthMM}×${b.heightMM} mm` : ''}
                          </span>
                        </div>
                        {b.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeBoxType(b.id)}
                            title="Eliminar caja personalizada"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoría 4: Aberturas y Carpinterías */}
              {catalogCategory === 'openings' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold text-[11px]">
                      Puertas, Ventanas y Vanos de Proyecto:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewOpening(!showNewOpening)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={14} />
                      <span>{showNewOpening ? 'Cancelar' : 'Agregar Tipo'}</span>
                    </button>
                  </div>

                  {showNewOpening && (
                    <form onSubmit={handleAddOpening} className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                      <div className="font-bold text-blue-900 text-xs">Nueva Carpintería / Abertura:</div>
                      <div>
                        <input
                          type="text"
                          required
                          value={newOpeningName}
                          onChange={(e) => setNewOpeningName(e.target.value)}
                          placeholder="Nombre (ej: Puerta Placa 75x205, Ventanal 240x205)"
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Tipo:</label>
                          <select
                            value={newOpeningType}
                            onChange={(e) => {
                              const t = e.target.value as OpeningType;
                              setNewOpeningType(t);
                              if (t === 'door') {
                                setNewOpeningWidth(0.80);
                                setNewOpeningHeight(2.05);
                                setNewOpeningSill(0.0);
                                setNewOpeningSwing('left_in');
                              } else if (t === 'window') {
                                setNewOpeningWidth(1.20);
                                setNewOpeningHeight(1.10);
                                setNewOpeningSill(0.90);
                                setNewOpeningSwing('sliding');
                              } else {
                                setNewOpeningWidth(0.90);
                                setNewOpeningHeight(2.05);
                                setNewOpeningSill(0.0);
                                setNewOpeningSwing('none');
                              }
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            {OPENING_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Batiente / Giro:</label>
                          <select
                            value={newOpeningSwing}
                            onChange={(e) => setNewOpeningSwing(e.target.value as OpeningSwing)}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            {OPENING_SWING_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Ancho (m):</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.3}
                            max={6.0}
                            value={newOpeningWidth}
                            onChange={(e) => setNewOpeningWidth(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Alto (m):</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.3}
                            max={4.0}
                            value={newOpeningHeight}
                            onChange={(e) => setNewOpeningHeight(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Antepecho (m):</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            max={3.0}
                            value={newOpeningSill}
                            onChange={(e) => setNewOpeningSill(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newOpeningDesc}
                          onChange={(e) => setNewOpeningDesc(e.target.value)}
                          placeholder="Descripción (opcional)"
                          className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors"
                      >
                        Registrar Abertura
                      </button>
                    </form>
                  )}

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {(catalog.openingTypes || DEFAULT_OPENING_TYPES).map((op) => (
                      <div
                        key={op.id}
                        className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs truncate">{op.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold ${
                                op.isCustom
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-200/80 text-slate-600'
                              }`}
                            >
                              {op.isCustom ? 'Personalizado' : 'Estándar'}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md font-semibold bg-blue-100 text-blue-800">
                              {op.type === 'door' ? 'Puerta' : op.type === 'window' ? 'Ventana' : 'Vano'}
                            </span>
                          </div>
                          {op.description && (
                            <p className="text-[10px] text-slate-500 truncate">{op.description}</p>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {op.width.toFixed(2)}m × {op.height.toFixed(2)}m
                            {op.sill > 0 ? ` · Antepecho: +${op.sill.toFixed(2)}m` : ''}
                            {op.defaultSwing ? ` · Batiente: ${op.defaultSwing}` : ''}
                          </span>
                        </div>
                        {op.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeOpeningType(op.id)}
                            title="Eliminar abertura personalizada"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
