import React, { memo } from 'react';
import { DoorOpen, Trash2 } from 'lucide-react';
import type { ElevationOpening, OpeningElevationPatch } from '../../../../models/architecture/wallElevation';
import type { OpeningTypeDefinition } from '../../../../models/architecture/openingPresets';

interface ElevationOpeningInspectorProps {
  selectedOpening: ElevationOpening;
  openingTypes: readonly OpeningTypeDefinition[];
  onClearSelection: () => void;
  onApplyOpeningPreset: (presetId: string) => void;
  onPatchSelectedOpening: (patch: OpeningElevationPatch) => void;
  onDeleteSelectedOpening: () => void;
}

export const ElevationOpeningInspector: React.FC<ElevationOpeningInspectorProps> = memo(({
  selectedOpening,
  openingTypes,
  onClearSelection,
  onApplyOpeningPreset,
  onPatchSelectedOpening,
  onDeleteSelectedOpening
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-600/30 text-amber-400 rounded-lg">
            <DoorOpen size={16} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-100">
              {selectedOpening.type === 'door'
                ? 'Puerta'
                : selectedOpening.type === 'window'
                ? 'Ventana'
                : 'Vano Libre'}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {selectedOpening.label || selectedOpening.id.slice(-6)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors text-[10px] cursor-pointer"
        >
          Deseleccionar
        </button>
      </div>

      {/* Selector de Presets de Carpintería */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
          Presets de Carpintería de Proyecto
        </label>
        <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
          {openingTypes
            .filter((p) => p.type === selectedOpening.type)
            .map((preset) => {
              const isCurrent =
                Math.abs(selectedOpening.width - preset.width) < 0.02 &&
                Math.abs(selectedOpening.height - preset.height) < 0.02 &&
                Math.abs(selectedOpening.sill - preset.sill) < 0.02;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyOpeningPreset(preset.id)}
                  className={`p-1.5 rounded-lg text-left text-xs transition-colors border cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-600/30 text-amber-200 border-amber-500 font-bold'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                  title={preset.description}
                >
                  <div className="font-semibold text-[11px] truncate">{preset.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {preset.width.toFixed(2)}×{preset.height.toFixed(2)}m
                    {preset.sill > 0 ? ` (s:${preset.sill.toFixed(2)})` : ''}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Ancho del Vano */}
      <div>
        <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
          <span>Ancho Libre del Vano</span>
          <span className="font-mono text-amber-400">{selectedOpening.width.toFixed(2)} m</span>
        </div>
        <input
          type="number"
          step={0.05}
          min={0.3}
          value={selectedOpening.width.toFixed(2)}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!Number.isNaN(val)) onPatchSelectedOpening({ width: val });
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Altura del Vano */}
      <div>
        <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
          <span>Altura del Vano (Dintel)</span>
          <span className="font-mono text-amber-400">{selectedOpening.height.toFixed(2)} m</span>
        </div>
        <input
          type="number"
          step={0.05}
          min={0.3}
          value={selectedOpening.height.toFixed(2)}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!Number.isNaN(val)) onPatchSelectedOpening({ height: val });
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Antepecho */}
      <div>
        <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
          <span>Antepecho sobre NPT</span>
          <span className="font-mono text-amber-400">{selectedOpening.sill.toFixed(2)} m</span>
        </div>
        <input
          type="number"
          step={0.05}
          min={0}
          value={selectedOpening.sill.toFixed(2)}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!Number.isNaN(val)) onPatchSelectedOpening({ sill: val });
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={onDeleteSelectedOpening}
        className="w-full py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95 cursor-pointer"
        title="Eliminar abertura del muro (Tecla Supr / Delete)"
      >
        <Trash2 size={14} />
        <span>Eliminar Abertura</span>
      </button>
    </div>
  );
});
