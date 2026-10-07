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
import { DEFAULT_OPENING_TYPES } from '../../../models/architecture/openingPresets';
import type { OpeningType, OpeningSwing } from '../../../models/architecture/Opening';
import type {
  ConduitMaterial,
  CableStandard,
  BoxCategory,
  BoxMaterialBase
} from '../../../models/electrical/ElectricalModel';
import { X, Building2, Sliders, Package, Plus, Trash2 } from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'obra' | 'catalogo'>('obra');
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
        <div className="flex border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('obra')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all ${
              activeTab === 'obra'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Building2 size={15} />
            <span>Datos de la Obra</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl transition-all ${
              activeTab === 'catalogo'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Package size={15} />
            <span>Catálogo de Materiales</span>
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
                            <option value="door">Puerta</option>
                            <option value="window">Ventana</option>
                            <option value="passage">Vano Libre</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Batiente / Giro:</label>
                          <select
                            value={newOpeningSwing}
                            onChange={(e) => setNewOpeningSwing(e.target.value as OpeningSwing)}
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            <option value="left_in">Izquierda (Hacia Adentro)</option>
                            <option value="right_in">Derecha (Hacia Adentro)</option>
                            <option value="left_out">Izquierda (Hacia Afuera)</option>
                            <option value="right_out">Derecha (Hacia Afuera)</option>
                            <option value="double">Doble Hoja</option>
                            <option value="sliding">Corrediza</option>
                            <option value="none">Sin Batiente / Fijo</option>
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
