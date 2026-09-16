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
  AEA_CALCULATION_CONSTANTS,
  BOX_CATEGORIES_CATALOG,
  BOX_MATERIALS_CATALOG,
  DEFAULT_CABLE_SECTIONS,
  createDefaultMaterialCatalog
} from '../../../models/electrical/electricalStandards';
import type {
  ConduitMaterial,
  CableStandard,
  BoxCategory,
  BoxMaterialBase
} from '../../../models/electrical/ElectricalModel';
import { X, Building2, Sliders, Check, Package, Plus, Trash2 } from 'lucide-react';

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
    removeBoxType
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'obra' | 'instalacion' | 'catalogo'>('obra');
  const [catalogCategory, setCatalogCategory] = useState<'conduits' | 'cables' | 'boxes'>('conduits');

  // Formularios de alta
  const [showNewConduit, setShowNewConduit] = useState(false);
  const [newConduitName, setNewConduitName] = useState('');
  const [newConduitDesc, setNewConduitDesc] = useState('');
  const [newConduitSize, setNewConduitSize] = useState(19);

  const [showNewCable, setShowNewCable] = useState(false);
  const [newCableName, setNewCableName] = useState('');
  const [newCableDesc, setNewCableDesc] = useState('');
  const [newCableSection, setNewCableSection] = useState(2.5);

  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxCategory, setNewBoxCategory] = useState<BoxCategory>('caja_rectangular');
  const [newBoxMaterial, setNewBoxMaterial] = useState<BoxMaterialBase>('chapa');
  const [newBoxDesc, setNewBoxDesc] = useState('');

  if (!isOpen) return null;

  const catalog = project.materialCatalog || createDefaultMaterialCatalog();

  const handleAddConduit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConduitName.trim()) return;
    const id = `custom_conduit_${Date.now()}`;
    addConduitType({
      id,
      name: newConduitName.trim(),
      description: newConduitDesc.trim() || undefined,
      defaultSizeMM: newConduitSize,
      availableSizes: [
        { value: 16, label: '16 mm (5/8")', standardSize: '16', usefulAreaMM2: 132.7 },
        { value: 19, label: '19 mm (3/4")', standardSize: '19', usefulAreaMM2: 213.8 },
        { value: 22, label: '22 mm (7/8")', standardSize: '22', usefulAreaMM2: 298.6 },
        { value: 25, label: '25 mm (1")', standardSize: '25', usefulAreaMM2: 394.1 },
        { value: 32, label: '32 mm (1 1/4")', standardSize: '32', usefulAreaMM2: 642.4 }
      ],
      isCustom: true
    });
    setNewConduitName('');
    setNewConduitDesc('');
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
      isCustom: true
    });
    setNewBoxName('');
    setNewBoxDesc('');
    setShowNewBox(false);
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
                Parámetros de obra, normas AEA y catálogo de materiales
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
        <div className="flex border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('obra')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
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
            onClick={() => setActiveTab('instalacion')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'instalacion'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Sliders size={15} />
            <span>Normas AEA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'catalogo'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Package size={15} />
            <span>Catálogo Materiales</span>
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
          )}

          {activeTab === 'instalacion' && (
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

          {activeTab === 'catalogo' && (
            <div className="space-y-3">
              {/* Sub-pills de las 3 Categorías Físicas Rígidas */}
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
                  Canalizaciones ({catalog.conduitTypes.length})
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
                  Conductores ({catalog.cableTypes.length})
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
              </div>

              {/* Categoría 1: Canalizaciones */}
              {catalogCategory === 'conduits' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold text-[11px]">
                      Tipos de Caños, Conductos y Bandejas disponibles:
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
                          placeholder="Descripción / Norma"
                          className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Ø defecto:</span>
                          <input
                            type="number"
                            min={10}
                            max={200}
                            value={newConduitSize}
                            onChange={(e) => setNewConduitSize(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                          />
                          <span className="text-[10px] text-slate-500">mm</span>
                        </div>
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
                            {c.availableSizes.length} calibres (defecto: Ø{c.defaultSizeMM}mm)
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold text-[11px]">
                      Normas y Tipos de Conductores disponibles:
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
                          placeholder="Descripción técnica"
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
                      Tipos de Cajas y Gabinetes de Tableros:
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
                            onChange={(e) => setNewBoxCategory(e.target.value as BoxCategory)}
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
