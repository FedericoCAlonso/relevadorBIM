import React, { memo } from 'react';
import { Zap, Cable, Trash2 } from 'lucide-react';
import type { ElevationConduit } from '../../../../models/architecture/wallElevation';
import type { Conduit, ConduitMaterial, ConduitRoutePreset } from '../../../../models/electrical/ElectricalModel';
import type { ConduitLengthBreakdown } from '../../../../models/electrical/conduitMetrics';
import type { ConduitPresetOption } from '../../../../models/architecture/conduitElevationRoute';

interface ElevationConduitInspectorProps {
  selectedConduit: ElevationConduit;
  rawSelectedConduit: Conduit | null;
  selectedConduitMetric: ConduitLengthBreakdown | null;
  conduitPresetOptions: readonly ConduitPresetOption[];
  ceilingZ?: number;
  onClearSelection: () => void;
  formatConduitSize: (mat?: ConduitMaterial, diam?: number) => string;
  onSetConduitPreset: (conduitId: string, preset: ConduitRoutePreset) => void;
  onResetConduitRoute: (conduitId: string) => void;
  onNudgeSelectedConduitHeight: (deltaM: number) => void;
  onSetSelectedConduitHeight: (z: number) => void;
  onOpenConduitModal: () => void;
  onDeleteConduit: (conduitId: string) => void;
}

export const ElevationConduitInspector: React.FC<ElevationConduitInspectorProps> = memo(({
  selectedConduit,
  rawSelectedConduit,
  selectedConduitMetric,
  conduitPresetOptions,
  ceilingZ,
  onClearSelection,
  formatConduitSize,
  onSetConduitPreset,
  onResetConduitRoute,
  onNudgeSelectedConduitHeight,
  onSetSelectedConduitHeight,
  onOpenConduitModal,
  onDeleteConduit
}) => {
  const intermediatePoint = selectedConduit.elevationRoute?.points?.find(
    (_, idx, arr) => idx > 0 && idx < arr.length - 1
  );
  const conduitZ = intermediatePoint?.z;

  const heightPresetButtons = [
    { label: '0.30m Zócalo', z: 0.30 },
    { label: '1.10m Llaves', z: 1.10 },
    { label: '2.20m Dintel', z: 2.20 },
    ...(ceilingZ ? [{ label: `${ceilingZ.toFixed(2)}m Losa`, z: ceilingZ }] : [])
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-600/30 text-cyan-400 rounded-lg">
            <Zap size={16} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-100">
              Canalización {formatConduitSize(selectedConduit.material, selectedConduit.diameterMM)}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {selectedConduit.label || selectedConduit.id.slice(-6)}
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

      {/* Métrica calculada objetiva */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
        <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block">
          Cómputo Métrico:
        </span>
        <div className="grid grid-cols-2 gap-2 text-slate-200">
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Longitud total:</span>
            <span className="font-bold font-mono text-cyan-300">
              {selectedConduitMetric ? `${selectedConduitMetric.totalLengthM.toFixed(2)} m` : '—'}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Desglose:</span>
            <span className="text-[11px] font-mono text-slate-300">
              {selectedConduitMetric
                ? `${selectedConduitMetric.distPlantaHorizontal.toFixed(2)}m H + ${selectedConduitMetric.dzLocal.toFixed(2)}m V`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Presets de trazado */}
      <div className="space-y-2">
        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
          Trazado en Alzado:
        </span>
        <div className="grid grid-cols-1 gap-1.5">
          {conduitPresetOptions.map((opt) => {
            const isCurrent = selectedConduit.elevationRoute?.preset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSetConduitPreset(selectedConduit.id, opt.id)}
                className={`p-2 rounded-xl text-left text-xs transition-all border cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-600/30 text-blue-200 border-blue-500 font-semibold'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div className="font-bold text-[11px]">{opt.label}</div>
                <div className="text-[10px] text-slate-400">{opt.description}</div>
              </button>
            );
          })}
        </div>
        {selectedConduit.elevationRoute && (
          <button
            type="button"
            onClick={() => onResetConduitRoute(selectedConduit.id)}
            className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[11px] transition-colors border border-slate-700 mt-2 cursor-pointer"
          >
            Restablecer trazado automático
          </button>
        )}
      </div>

      {/* Ajuste métrico de altura de cañería */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between font-bold">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider">
            Altura Tramo Horizontal (Z):
          </span>
          <span className="font-mono text-cyan-300 font-bold">
            {conduitZ != null ? `${conduitZ.toFixed(2)} m` : 'Variable'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNudgeSelectedConduitHeight(-0.10)}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-bold transition-all text-center cursor-pointer"
            title="Bajar tramo horizontal 10 cm"
          >
            ▼ -10 cm
          </button>
          <button
            type="button"
            onClick={() => onNudgeSelectedConduitHeight(0.10)}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-bold transition-all text-center cursor-pointer"
            title="Subir tramo horizontal 10 cm"
          >
            ▲ +10 cm
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 pt-1">
          {heightPresetButtons.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onSetSelectedConduitHeight(preset.z)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors border text-center truncate cursor-pointer ${
                conduitZ != null && Math.abs(conduitZ - preset.z) < 0.03
                  ? 'bg-cyan-600 text-white border-cyan-400 font-bold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-[11px] text-slate-400">
        💡 Arrastrá los puntos azules sobre la cañería para desplazar la altura del puente o quiebres ortogonales.
      </div>

      {/* Conductores instalados en la cañería */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between font-bold">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider">
            Conductores ({rawSelectedConduit?.conductors?.length || 0}):
          </span>
          <button
            type="button"
            onClick={onOpenConduitModal}
            className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
          >
            <Cable size={13} />
            <span>Configurar</span>
          </button>
        </div>
        {rawSelectedConduit?.conductors && rawSelectedConduit.conductors.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {rawSelectedConduit.conductors.map((c, cIdx) => (
              <span
                key={cIdx}
                className="px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-slate-200"
              >
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                {c.sectionMM2} mm² {c.role}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">
            Sin conductores asignados. Hacé clic en "Configurar" para agregar cables.
          </p>
        )}
      </div>

      {/* Botones de acción principales */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={onOpenConduitModal}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Cable size={15} />
          <span>Configurar Cables y Material...</span>
        </button>
        <button
          type="button"
          onClick={() => onDeleteConduit(selectedConduit.id)}
          className="w-full py-2 px-3 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/40 transition-colors cursor-pointer"
        >
          <Trash2 size={15} />
          <span>Eliminar Tramo de Cañería</span>
        </button>
      </div>
    </div>
  );
});
