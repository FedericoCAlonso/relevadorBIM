import React, { useState, useMemo, memo } from 'react';
import { X, ArrowUpRight, MoveVertical } from 'lucide-react';
import type { ElevationBox } from '../../../../models/architecture/wallElevation';
import type { ConduitRoutingPlane } from '../../../../models/electrical/ElectricalModel';
import type { ExternalConnectTarget } from '../../../../viewmodels/useWallElevationViewModel';

interface ElevationExternalTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBox: ElevationBox;
  availableExternalTargets: ExternalConnectTarget[];
  onConnectToExternalElement: (sourceBoxId: string, targetId: string, plane: ConduitRoutingPlane) => void;
}

export const ElevationExternalTargetModal: React.FC<ElevationExternalTargetModalProps> = memo(({
  isOpen,
  onClose,
  selectedBox,
  availableExternalTargets,
  onConnectToExternalElement
}) => {
  const [externalRoutingPlane, setExternalRoutingPlane] = useState<ConduitRoutingPlane>('ceiling_slab');
  const [externalCategoryFilter, setExternalCategoryFilter] = useState<'all' | 'ceiling' | 'panel' | 'wall'>('all');
  const [externalSearchQuery, setExternalSearchQuery] = useState('');

  const filteredExternalTargets = useMemo(() => {
    return availableExternalTargets.filter((t) => {
      if (externalCategoryFilter !== 'all' && t.category !== externalCategoryFilter) {
        return false;
      }
      if (externalSearchQuery.trim()) {
        const query = externalSearchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(query) ||
          t.sublabel.toLowerCase().includes(query) ||
          (t.circuitId && t.circuitId.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [availableExternalTargets, externalCategoryFilter, externalSearchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <ArrowUpRight size={16} className="text-cyan-400" />
              Conectar con Elemento Exterior
            </h3>
            <p className="text-[11px] text-slate-400">
              Caja origen: <span className="text-cyan-300 font-mono">{selectedBox.label || selectedBox.id.slice(-6)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Salida del muro: Cielorraso vs Contrapiso */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Plano de Salida del Muro
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExternalRoutingPlane('ceiling_slab')}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  externalRoutingPlane === 'ceiling_slab'
                    ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-bold'
                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight size={14} className="text-blue-400" />
                  <span>Por Cielorraso</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  Sube a losa superior
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExternalRoutingPlane('floor_slab')}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  externalRoutingPlane === 'floor_slab'
                    ? 'bg-amber-600/30 border-amber-500 text-amber-200 font-bold'
                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <MoveVertical size={14} className="text-amber-400" />
                  <span>Por Contrapiso</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  Baja a nivel de piso
                </span>
              </button>
            </div>
          </div>

          {/* Filtro de Categoría */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Destinos Disponibles ({availableExternalTargets.length})
              </label>
            </div>
            <div className="flex gap-1 bg-slate-800/80 p-1 rounded-xl mb-2 text-[11px]">
              {(['all', 'ceiling', 'panel', 'wall'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setExternalCategoryFilter(cat)}
                  className={`flex-1 py-1 px-1.5 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                    externalCategoryFilter === cat
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat === 'ceiling' ? 'Cielorraso' : cat === 'panel' ? 'Tableros' : 'Paredes'}
                </button>
              ))}
            </div>

            {/* Búsqueda rápida */}
            <input
              type="text"
              placeholder="Filtrar por nombre o circuito..."
              value={externalSearchQuery}
              onChange={(e) => setExternalSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-2"
            />

            {/* Lista de Destinos */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {filteredExternalTargets.length === 0 ? (
                <div className="p-4 text-center text-slate-500 bg-slate-800/30 rounded-xl">
                  No se encontraron elementos disponibles con ese filtro.
                </div>
              ) : (
                filteredExternalTargets.map((extTarget) => (
                  <div
                    key={extTarget.id}
                    className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl flex items-center justify-between gap-2 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded-md font-bold tracking-wider ${
                            extTarget.category === 'ceiling'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : extTarget.category === 'panel'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {extTarget.category === 'ceiling' ? 'Techo' : extTarget.category === 'panel' ? 'Tablero' : 'Pared'}
                        </span>
                        <span className="font-semibold text-slate-100 truncate">{extTarget.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {extTarget.sublabel} {extTarget.mountZ != null ? `· h=${extTarget.mountZ.toFixed(2)}m` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onConnectToExternalElement(selectedBox.id, extTarget.id, externalRoutingPlane);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-[11px] font-bold shadow shrink-0 transition-transform cursor-pointer"
                    >
                      Conectar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 bg-slate-800/50 border-t border-slate-700/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
});
