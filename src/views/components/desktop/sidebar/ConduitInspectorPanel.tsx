import React, { memo } from 'react';
import { Cable, SlidersHorizontal, GitBranch, Trash2 } from 'lucide-react';
import {
  CONDUIT_QUICK_DIAMETERS,
  CONDUIT_MATERIALS_CATALOG,
  CONDUCTOR_ROLE_OPTIONS,
  CABLE_QUICK_SECTIONS,
  DEFAULT_CIRCUIT_COLOR,
  DEFAULT_RETURN_CONDUCTOR_SPEC
} from '../../../../config';
import { useProjectStore } from '../../../../viewmodels/useProjectStore';
import { useElectricalViewModel } from '../../../../viewmodels/useElectricalViewModel';
import type { Conduit, ConduitMaterial, ConductorRole } from '../../../../models/electrical/ElectricalModel';

interface ConduitInspectorPanelProps {
  selectedConduit: Conduit;
  editingConduitRouteId?: string | null;
  onStartEditingConduitRoute?: (conduitId: string) => void;
  onFinishEditingConduitRoute?: () => void;
  onStartRedesigningConduitRoute?: (conduitId: string) => void;
  onUndoEditingConduitWaypoint?: () => void;
}

export const ConduitInspectorPanel: React.FC<ConduitInspectorPanelProps> = memo(({
  selectedConduit,
  editingConduitRouteId,
  onStartEditingConduitRoute,
  onFinishEditingConduitRoute,
  onStartRedesigningConduitRoute,
  onUndoEditingConduitWaypoint
}) => {
  const { project, updateConduit, deleteConduit } = useProjectStore();
  const { conduitBreakdown, conduitOccupancy, conduitFromElement, conduitToElement } = useElectricalViewModel();

  const elFrom = conduitFromElement;
  const elTo = conduitToElement;
  const fromLabel = elFrom ? ('label' in elFrom ? elFrom.label : 'name' in elFrom ? elFrom.name : 'Boca 1') : 'Boca 1';
  const toLabel = elTo ? ('label' in elTo ? elTo.label : 'name' in elTo ? elTo.name : 'Boca 2') : 'Boca 2';
  const autoLengthM = conduitBreakdown?.totalLengthM ?? 0;
  const effectiveLengthM = selectedConduit.manualLengthM || autoLengthM;
  const occupancy = conduitOccupancy;

  return (
    <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-3.5 space-y-3 shadow-sm animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 text-white rounded-xl shadow-xs">
            <Cable size={18} />
          </div>
          <div>
            <span className="font-bold text-amber-950 block text-xs">
              Cañería: {fromLabel} ➔ {toLabel}
            </span>
            <span className="text-[10px] font-mono text-amber-800">
              Largo: {effectiveLengthM.toFixed(2)} m {selectedConduit.manualLengthM ? '(Manual)' : '(3D)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-conduit-edit-modal'))}
            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1"
            title="Abrir panel completo de configuración"
          >
            <SlidersHorizontal size={12} />
            <span>Configurar</span>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-branch-edit-modal'))}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1"
            title="Modificar toda la rama interconectada"
          >
            <GitBranch size={12} />
            <span>Rama</span>
          </button>
          <button
            type="button"
            onClick={() => deleteConduit(selectedConduit.id)}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            title="Eliminar tramo de cañería"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Diámetro de Cañería */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-amber-950">DIÁMETRO DEL CAÑO (EXTERIOR)</label>
          <span className="font-mono text-xs font-bold text-amber-900">
            Ø{selectedConduit.diameterMM} mm
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {CONDUIT_QUICK_DIAMETERS.map((diam) => (
            <button
              key={diam}
              type="button"
              onClick={() => updateConduit(selectedConduit.id, { diameterMM: diam })}
              className={`py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${
                selectedConduit.diameterMM === diam
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100/60'
              }`}
            >
              Ø{diam}
            </button>
          ))}
        </div>
      </div>

      {/* Material de la Cañería */}
      <div>
        <label className="text-[10px] font-bold text-amber-950 block mb-1">MATERIAL DE LA CAÑERÍA</label>
        <select
          value={selectedConduit.material || 'hierro_semipesado_rs'}
          onChange={(e) => updateConduit(selectedConduit.id, { material: e.target.value as ConduitMaterial })}
          className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {CONDUIT_MATERIALS_CATALOG.map((mat) => (
            <option key={mat.id} value={mat.id}>{mat.label}</option>
          ))}
        </select>
      </div>

      {/* Geometría de Trazado (Arco AEA vs Ortogonal) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-amber-950">TRAZADO EN PLANO</label>
          <span className="text-[10px] font-mono text-amber-800">
            {selectedConduit.routingMode === 'orthogonal' ? 'Ortogonal 90°' : 'Arco AEA'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => updateConduit(selectedConduit.id, { routingMode: 'schematic_arc', waypoints: undefined })}
            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
              selectedConduit.routingMode !== 'orthogonal'
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
            }`}
          >
            <span>⌒</span>
            <span>Arco AEA</span>
          </button>
          <button
            type="button"
            onClick={() => updateConduit(selectedConduit.id, { routingMode: 'orthogonal' })}
            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
              selectedConduit.routingMode === 'orthogonal'
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
            }`}
          >
            <span>📐</span>
            <span>90° Ortogonal</span>
          </button>
        </div>
      </div>

      {/* Waypoints del Recorrido Arbitrario (solo disponible en modos no-arco) */}
      {selectedConduit.routingMode !== 'schematic_arc' && (
        <div className="p-2.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-950 flex items-center gap-1">
              <span>📐 Quiebres de Recorrido:</span>
            </span>
            <span className="font-mono font-bold text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded text-[11px]">
              {selectedConduit.waypoints?.length || 0} puntos
            </span>
          </div>

          {editingConduitRouteId === selectedConduit.id ? (
            <div className="space-y-1.5 p-2 bg-amber-200/50 border border-amber-400/60 rounded-lg">
              <p className="text-[11px] text-amber-900 font-medium leading-tight">
                Modo edición activo: Haz clic en el plano para agregar puntos o arrastra los manipuladores P1, P2 en pantalla.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={onUndoEditingConduitWaypoint}
                  disabled={!selectedConduit.waypoints || selectedConduit.waypoints.length === 0}
                  className="flex-1 py-1 px-2 bg-white hover:bg-amber-100 disabled:opacity-40 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  ↶ Deshacer Punto
                </button>
                <button
                  type="button"
                  onClick={onFinishEditingConduitRoute}
                  className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs cursor-pointer"
                >
                  ✓ Finalizar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStartEditingConduitRoute?.(selectedConduit.id)}
                className="flex-1 py-1 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                title="Agregar o desplazar quiebres intermedios en el lienzo"
              >
                <span>✏️</span>
                <span>Editar Quiebres</span>
              </button>
              <button
                type="button"
                onClick={() => onStartRedesigningConduitRoute?.(selectedConduit.id)}
                className="py-1 px-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Redibujar la trayectoria completa desde la boca inicial"
              >
                <span>🔄</span>
                <span>Rediseñar</span>
              </button>
            </div>
          )}

          {selectedConduit.waypoints && selectedConduit.waypoints.length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-amber-200/80">
              <span className="text-[10px] text-amber-800">
                Trazo multipunto personalizado
              </span>
              <button
                type="button"
                onClick={() => updateConduit(selectedConduit.id, { waypoints: undefined })}
                className="px-2 py-0.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold transition-colors shadow-2xs cursor-pointer"
                title="Quitar quiebres intermedios y volver a trazado directo"
              >
                Restablecer trazo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Factor de Ocupación */}
      {occupancy && (
        <div className="p-2.5 bg-white border border-amber-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              Ocupación de canalización:
            </span>
            <span className="font-mono font-bold text-slate-700">
              {occupancy.occupancyPercent}% (Capacidad máx: 35.0%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (occupancy.occupancyPercent / 35) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Asignación de Circuitos que pasan por este tramo */}
      <div>
        <label className="text-[10px] font-bold text-amber-950 block mb-1">
          CIRCUITOS EN ESTE TRAMO (MULTICIRCUITO TRAZA)
        </label>
        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
          {project.circuits.map((c) => {
            const conduitCircuitIds =
              selectedConduit.circuitIds !== undefined
                ? selectedConduit.circuitIds
                : (selectedConduit.circuitId ? [selectedConduit.circuitId] : []);
            const isIncluded = conduitCircuitIds.includes(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center justify-between p-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  isIncluded
                    ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold'
                    : 'bg-white border-amber-200/80 text-slate-700 hover:bg-amber-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isIncluded}
                    onChange={(e) => {
                      const currentIds =
                        selectedConduit.circuitIds !== undefined
                          ? selectedConduit.circuitIds
                          : (selectedConduit.circuitId ? [selectedConduit.circuitId] : []);
                      let newIds: string[];
                      if (e.target.checked) {
                        newIds = Array.from(new Set([...currentIds, c.id]));
                      } else {
                        newIds = currentIds.filter((id) => id !== c.id);
                      }
                      updateConduit(selectedConduit.id, {
                        circuitIds: newIds,
                        circuitId: newIds[0] || null
                      });
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color || DEFAULT_CIRCUIT_COLOR }} />
                  <span>{c.name}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">{c.wireSectionBaseMM2}mm²</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Desglose de Conductores en la Cañería */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-amber-950">
            CONDUCTORES EN EL TRAMO ({selectedConduit.conductors.length})
          </label>
          <button
            type="button"
            onClick={() => {
              const newConds = [...selectedConduit.conductors];
              newConds.push({ ...DEFAULT_RETURN_CONDUCTOR_SPEC });
              updateConduit(selectedConduit.id, { conductors: newConds });
            }}
            className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-200/70 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
          >
            ＋ Añadir Retorno
          </button>
        </div>

        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
          {selectedConduit.conductors.map((cond, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 p-1.5 bg-white border border-amber-200 rounded-xl text-xs"
            >
              <select
                value={cond.role}
                onChange={(e) => {
                  const newConds = [...selectedConduit.conductors];
                  newConds[idx].role = e.target.value as ConductorRole;
                  updateConduit(selectedConduit.id, { conductors: newConds });
                }}
                className="px-1 py-0.5 bg-slate-50 border rounded text-[11px] font-semibold"
              >
                {CONDUCTOR_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>

              <select
                value={cond.sectionMM2}
                onChange={(e) => {
                  const newConds = [...selectedConduit.conductors];
                  newConds[idx].sectionMM2 = parseFloat(e.target.value);
                  updateConduit(selectedConduit.id, { conductors: newConds });
                }}
                className="px-1 py-0.5 bg-slate-50 border rounded text-[11px] font-mono font-bold"
              >
                {CABLE_QUICK_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>{sec} mm²</option>
                ))}
              </select>

              <input
                type="text"
                value={cond.reference || ''}
                onChange={(e) => {
                  const newConds = [...selectedConduit.conductors];
                  newConds[idx].reference = e.target.value;
                  updateConduit(selectedConduit.id, { conductors: newConds });
                }}
                placeholder="Ref: a"
                className="w-14 px-1 py-0.5 bg-slate-50 border rounded text-[11px] font-mono"
                title="Referencia de retorno (ej: a, b)"
              />

              <button
                type="button"
                onClick={() => {
                  const newConds = selectedConduit.conductors.filter((_, i) => i !== idx);
                  updateConduit(selectedConduit.id, { conductors: newConds });
                }}
                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                title="Eliminar conductor"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
