/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BatchSelectModal.tsx (Patrón Estricto MVVM)
 * Modal interactivo para selección y filtrado masivo de elementos eléctricos
 * por circuito, tipo de cañería, símbolo de boca o estado de relevamiento.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import {
  X,
  Filter,
  Zap,
  Cable,
  Box,
  Layers,
  CheckCircle2,
  Trash2
} from 'lucide-react';

interface BatchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToInspector?: () => void;
}

export const BatchSelectModal: React.FC<BatchSelectModalProps> = ({
  isOpen,
  onClose,
  onProceedToInspector
}) => {
  const {
    project,
    selectedEntities,
    selectByCriteria,
    clearSelection
  } = useProjectStore();

  // Conteo de elementos y caños por circuito
  const circuitStats = useMemo(() => {
    return project.circuits.map((circ) => {
      const matchConduits = project.conduits.filter(
        (c) => c.circuitId === circ.id || c.circuitIds?.includes(circ.id)
      ).length;
      const matchElements = project.electricalElements.filter(
        (el) => el.circuitId === circ.id || el.passingCircuitIds?.includes(circ.id)
      ).length;
      return {
        circuit: circ,
        total: matchConduits + matchElements,
        conduitsCount: matchConduits,
        elementsCount: matchElements
      };
    });
  }, [project.circuits, project.conduits, project.electricalElements]);

  // Agrupación de caños por material y diámetro existentes en el plano
  const conduitTypeStats = useMemo(() => {
    const map = new Map<string, { material: string; diameterMM: number; count: number }>();
    for (const c of project.conduits) {
      const key = `${c.material}_${c.diameterMM}`;
      const existing = map.get(key) || { material: c.material, diameterMM: c.diameterMM, count: 0 };
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [project.conduits]);

  // Agrupación de bocas por símbolo
  const elementSymbolStats = useMemo(() => {
    const map = new Map<string, { symbolId: string; count: number }>();
    for (const el of project.electricalElements) {
      const existing = map.get(el.symbolId) || { symbolId: el.symbolId, count: 0 };
      existing.count += 1;
      map.set(el.symbolId, existing);
    }
    return Array.from(map.values());
  }, [project.electricalElements]);

  // Agrupación por estado
  const statusStats = useMemo(() => {
    let existente = 0;
    let proyectado = 0;
    let aReemplazar = 0;
    for (const el of project.electricalElements) {
      if (el.status === 'existente') existente += 1;
      else if (el.status === 'a_reemplazar') aReemplazar += 1;
      else proyectado += 1;
    }
    for (const c of project.conduits) {
      if (c.status === 'existente') existente += 1;
      else if (c.status === 'a_reemplazar') aReemplazar += 1;
      else proyectado += 1;
    }
    return { existente, proyectado, aReemplazar };
  }, [project.electricalElements, project.conduits]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh]">
        {/* Cabecera */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Filter size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Selección por Filtro / Criterio</h3>
              <p className="text-[11px] text-slate-500">Seleccioná elementos masivamente para modificarlos por lote</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* SECCIÓN 1: FILTRAR POR CIRCUITO */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
              <Zap size={14} className="text-amber-500" />
              <span>Por Circuito ({project.circuits.length})</span>
            </div>
            {circuitStats.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">No hay circuitos creados en el proyecto.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {circuitStats.map(({ circuit, total, conduitsCount, elementsCount }) => (
                  <button
                    key={circuit.id}
                    type="button"
                    onClick={() => selectByCriteria({ circuitId: circuit.id })}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-slate-300"
                        style={{ backgroundColor: circuit.color || '#94a3b8' }}
                      />
                      <span className="font-bold text-slate-800 truncate">{circuit.name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      {total} ({elementsCount}B / {conduitsCount}C)
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: FILTRAR POR TIPO DE CAÑERÍA */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
              <Cable size={14} className="text-blue-500" />
              <span>Por Tipo de Cañería ({project.conduits.length} tramos totales)</span>
            </div>
            {conduitTypeStats.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">No hay cañerías trazadas en el proyecto.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {conduitTypeStats.map(({ material, diameterMM, count }) => (
                  <button
                    key={`${material}_${diameterMM}`}
                    type="button"
                    onClick={() =>
                      selectByCriteria({
                        conduitMaterial: material,
                        conduitDiameterMM: diameterMM
                      })
                    }
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all text-left group cursor-pointer"
                  >
                    <div className="truncate">
                      <span className="font-bold text-slate-800 block truncate">
                        {material.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">Ø {diameterMM} mm</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {count} tramos
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: FILTRAR POR TIPO DE BOCA */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
              <Box size={14} className="text-emerald-500" />
              <span>Por Tipo de Boca ({project.electricalElements.length} bocas totales)</span>
            </div>
            {elementSymbolStats.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">No hay bocas colocadas en el plano.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {elementSymbolStats.map(({ symbolId, count }) => (
                  <button
                    key={symbolId}
                    type="button"
                    onClick={() => selectByCriteria({ elementSymbolId: symbolId })}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left group cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 truncate">
                      {symbolId.replace('sym-planta-', '').replace(/-/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      {count} bocas
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 4: FILTRAR POR ESTADO */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
              <Layers size={14} className="text-purple-500" />
              <span>Por Estado de Relevamiento</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => selectByCriteria({ status: 'existente' })}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-center cursor-pointer"
              >
                <span className="font-bold text-slate-800 block text-xs">Existente</span>
                <span className="text-[10px] text-slate-500">{statusStats.existente} elem.</span>
              </button>
              <button
                type="button"
                onClick={() => selectByCriteria({ status: 'proyectado' })}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-center cursor-pointer"
              >
                <span className="font-bold text-blue-800 block text-xs">Proyectado</span>
                <span className="text-[10px] text-blue-600">{statusStats.proyectado} elem.</span>
              </button>
              <button
                type="button"
                onClick={() => selectByCriteria({ status: 'a_reemplazar' })}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-center cursor-pointer"
              >
                <span className="font-bold text-rose-800 block text-xs">A Reemplazar</span>
                <span className="text-[10px] text-rose-600">{statusStats.aReemplazar} elem.</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Estado Inferior y Acciones */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-xs">
              {selectedEntities.length}{' '}
              {selectedEntities.length === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}
            </span>
            {selectedEntities.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
              >
                <Trash2 size={12} />
                Limpiar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all text-xs cursor-pointer"
            >
              Cerrar
            </button>
            {selectedEntities.length > 0 && onProceedToInspector && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onProceedToInspector();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs text-xs cursor-pointer"
              >
                <CheckCircle2 size={14} />
                Editar en Lote
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
