/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BulkEditPanel.tsx (Patrón Estricto MVVM)
 * Panel de edición por lote cuando hay 2 o más elementos seleccionados
 * (cañerías, bocas, tableros).
 * Permite auto-cálculo masivo de conductores, asignación de circuitos,
 * cambio de materiales y diámetros, y actualización de estado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { getSizesForConduitType } from '../../../models/electrical/electricalStandards';
import type { ConduitMaterial } from '../../../models/electrical/ElectricalModel';
import {
  Layers,
  Zap,
  Cable,
  Box,
  Trash2,
  CheckCircle2,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface BulkEditPanelProps {
  onDeselectAll?: () => void;
}

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({ onDeselectAll }) => {
  const {
    project,
    selectedEntities,
    clearSelection,
    batchUpdateConduits,
    batchUpdateElectricalElements,
    batchDeriveConduitConductors,
    deleteConduit,
    deleteElectricalElement
  } = useProjectStore();

  const [notification, setNotification] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const selectedConduitIds = useMemo(
    () => selectedEntities.filter((e) => e.type === 'conduit').map((e) => e.id),
    [selectedEntities]
  );

  const selectedElementIds = useMemo(
    () => selectedEntities.filter((e) => e.type === 'electrical_element').map((e) => e.id),
    [selectedEntities]
  );

  const selectedConduits = useMemo(
    () => project.conduits.filter((c) => selectedConduitIds.includes(c.id)),
    [project.conduits, selectedConduitIds]
  );

  // Material de caño predominante en la selección
  const sampleConduit = selectedConduits[0];
  const availableSizes = useMemo(() => {
    if (!sampleConduit) return [];
    return getSizesForConduitType(sampleConduit.material, project.materialCatalog);
  }, [sampleConduit, project.materialCatalog]);

  // Manejo de Auto-Cálculo de conductores por lote
  const handleBatchDeriveConductors = () => {
    if (selectedConduitIds.length === 0) return;
    batchDeriveConduitConductors(selectedConduitIds);
    showFeedback(`¡Conductores auto-calculados en ${selectedConduitIds.length} caños con regla de PE único!`);
  };

  // Manejo de cambio masivo de circuito
  const handleBatchAssignCircuit = (circuitId: string) => {
    if (selectedConduitIds.length > 0) {
      batchUpdateConduits(selectedConduitIds, {
        circuitId: circuitId || null,
        circuitIds: circuitId ? [circuitId] : []
      });
    }
    if (selectedElementIds.length > 0) {
      batchUpdateElectricalElements(selectedElementIds, {
        circuitId: circuitId || null
      });
    }
    showFeedback('Circuito asignado al lote seleccionado.');
  };

  // Manejo de cambio masivo de material de cañería
  const handleBatchChangeMaterial = (material: ConduitMaterial) => {
    if (selectedConduitIds.length === 0) return;
    batchUpdateConduits(selectedConduitIds, { material });
    showFeedback(`Material actualizado a ${material.replace(/_/g, ' ')} en ${selectedConduitIds.length} caños.`);
  };

  // Manejo de cambio masivo de diámetro
  const handleBatchChangeDiameter = (diameterMM: number) => {
    if (selectedConduitIds.length === 0) return;
    batchUpdateConduits(selectedConduitIds, { diameterMM });
    showFeedback(`Calibre actualizado a Ø ${diameterMM} mm en ${selectedConduitIds.length} caños.`);
  };

  // Manejo de cambio masivo de estado
  const handleBatchChangeStatus = (status: 'existente' | 'proyectado' | 'a_reemplazar') => {
    if (selectedConduitIds.length > 0) {
      batchUpdateConduits(selectedConduitIds, { status });
    }
    if (selectedElementIds.length > 0) {
      batchUpdateElectricalElements(selectedElementIds, { status });
    }
    showFeedback(`Estado actualizado a "${status}" en todo el lote.`);
  };

  // Manejo de cambio masivo de tipo de caja
  const handleBatchChangeBoxType = (boxTypeId: string) => {
    if (selectedElementIds.length === 0) return;
    batchUpdateElectricalElements(selectedElementIds, { boxTypeId });
    showFeedback(`Tipo de caja actualizado en ${selectedElementIds.length} bocas.`);
  };

  // Eliminación masiva
  const handleBatchDelete = () => {
    if (!window.confirm(`¿Estás seguro de eliminar los ${selectedEntities.length} elementos seleccionados?`)) {
      return;
    }
    for (const id of selectedConduitIds) {
      deleteConduit(id);
    }
    for (const id of selectedElementIds) {
      deleteElectricalElement(id);
    }
    clearSelection();
    onDeselectAll?.();
  };

  return (
    <div className="bg-indigo-50/80 border-2 border-indigo-400 rounded-2xl p-3.5 space-y-3.5 shadow-sm text-xs animate-in fade-in duration-150">
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Layers size={18} />
          </div>
          <div>
            <span className="font-bold text-indigo-950 block text-xs">
              Edición en Lote ({selectedEntities.length})
            </span>
            <span className="text-[10px] text-indigo-700">
              {selectedConduitIds.length} caños · {selectedElementIds.length} bocas
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            clearSelection();
            onDeselectAll?.();
          }}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white/80 hover:bg-white px-2 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
          title="Deseleccionar todos los elementos"
        >
          <RotateCcw size={12} />
          Limpiar
        </button>
      </div>

      {/* Notificación de acción rápida */}
      {notification && (
        <div className="flex items-center gap-1.5 p-2 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-[11px] font-medium animate-in fade-in">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ACCIÓN ESTRELLA: AUTO-CALCULAR CONDUCTORES EN LOTE */}
      {selectedConduitIds.length > 0 && (
        <div className="p-2.5 bg-white rounded-xl border border-indigo-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" />
              Conductores de Línea Automáticos
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Regla PE único AEA</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Deduce fases, neutros y PE unificado para los {selectedConduitIds.length} caños según sus circuitos y bocas extremas (incluye llaves).
          </p>
          <button
            type="button"
            onClick={handleBatchDeriveConductors}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer text-xs"
          >
            <Zap size={14} />
            <span>Auto-Calcular Conductores en Lote</span>
          </button>
        </div>
      )}

      {/* ASIGNACIÓN DE CIRCUITO EN LOTE */}
      <div className="space-y-1 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-xs">
        <label className="font-bold text-slate-700 block text-[11px] flex items-center gap-1">
          <Zap size={13} className="text-amber-500" />
          Asignar Circuito a Todo el Lote
        </label>
        <select
          onChange={(e) => handleBatchAssignCircuit(e.target.value)}
          defaultValue=""
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="" disabled>Seleccionar circuito para aplicar...</option>
          <option value="">(Sin circuito / Desasignar)</option>
          {project.circuits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.wireSectionBaseMM2} mm² + PE)
            </option>
          ))}
        </select>
      </div>

      {/* EDICIÓN MASIVA DE CAÑERÍAS */}
      {selectedConduitIds.length > 0 && (
        <div className="space-y-2 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-xs">
          <span className="font-bold text-slate-700 block text-[11px] flex items-center gap-1">
            <Cable size={13} className="text-blue-500" />
            Propiedades de Cañerías ({selectedConduitIds.length} seleccionados)
          </span>

          {/* Material */}
          <div>
            <span className="text-[10px] text-slate-500 block mb-0.5">Tipo / Material de Caño</span>
            <select
              value={sampleConduit?.material || 'hierro_semipesado_rs'}
              onChange={(e) => handleBatchChangeMaterial(e.target.value as ConduitMaterial)}
              className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs cursor-pointer"
            >
              {(project.materialCatalog?.conduitTypes || []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Calibres rápidos */}
          {availableSizes.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 block mb-1">Calibre / Diámetro Comercial</span>
              <div className="grid grid-cols-4 gap-1">
                {availableSizes.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => handleBatchChangeDiameter(size.value)}
                    className="py-1 px-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 font-mono text-[11px] font-bold text-slate-700 transition-colors cursor-pointer text-center"
                  >
                    Ø{size.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDICIÓN MASIVA DE BOCAS */}
      {selectedElementIds.length > 0 && (
        <div className="space-y-2 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-xs">
          <span className="font-bold text-slate-700 block text-[11px] flex items-center gap-1">
            <Box size={13} className="text-emerald-500" />
            Propiedades de Bocas ({selectedElementIds.length} seleccionadas)
          </span>

          {/* Tipo de caja física */}
          {(project.materialCatalog?.boxTypes?.length ?? 0) > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Tipo de Caja Física</span>
              <select
                onChange={(e) => handleBatchChangeBoxType(e.target.value)}
                defaultValue=""
                className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs cursor-pointer"
              >
                <option value="" disabled>Seleccionar caja para aplicar...</option>
                {(project.materialCatalog?.boxTypes || []).map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ESTADO DE RELEVAMIENTO EN LOTE */}
      <div className="space-y-1 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-xs">
        <span className="font-bold text-slate-700 block text-[11px]">Estado de Relevamiento</span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleBatchChangeStatus('existente')}
            className="py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[10px] transition-colors cursor-pointer"
          >
            Existente
          </button>
          <button
            type="button"
            onClick={() => handleBatchChangeStatus('proyectado')}
            className="py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition-colors cursor-pointer"
          >
            Proyectado
          </button>
          <button
            type="button"
            onClick={() => handleBatchChangeStatus('a_reemplazar')}
            className="py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] transition-colors cursor-pointer"
          >
            A Reemplazar
          </button>
        </div>
      </div>

      {/* BOTÓN DE ELIMINACIÓN MASIVA */}
      <button
        type="button"
        onClick={handleBatchDelete}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold text-xs transition-colors cursor-pointer"
      >
        <Trash2 size={13} />
        <span>Eliminar {selectedEntities.length} elementos seleccionados</span>
      </button>
    </div>
  );
};
