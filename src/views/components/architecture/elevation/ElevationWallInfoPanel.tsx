import React, { memo } from 'react';
import { Info, ArrowLeftRight } from 'lucide-react';
import type { Wall } from '../../../../models/architecture/Wall';
import type { WallElevation, ElevationFace } from '../../../../models/architecture/wallElevation';

interface ElevationWallInfoPanelProps {
  wall: Wall;
  elevation: WallElevation;
  face: ElevationFace | null;
  onToggleFace: () => void;
}

export const ElevationWallInfoPanel: React.FC<ElevationWallInfoPanelProps> = memo(({
  wall,
  elevation,
  face,
  onToggleFace
}) => {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-800 pb-2">
        <h3 className="font-bold text-xs text-slate-100 mb-0.5">Paramento en Inspección</h3>
        <p className="text-[11px] text-slate-400">
          Seleccioná o arrastrá cualquier caja en la vista para reubicarla métricamente o rotarla.
        </p>
      </div>

      {/* Tarjeta de métricas del muro */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Longitud total:</span>
          <span className="font-bold font-mono text-slate-100">{elevation.lengthM.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Altura constructiva:</span>
          <span className="font-bold font-mono text-slate-100">{elevation.wallHeightM.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Espesor:</span>
          <span className="font-bold font-mono text-slate-100">{wall.thickness.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Cajas en esta cara:</span>
          <span className="font-bold font-mono text-blue-400">{elevation.boxes.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Aberturas:</span>
          <span className="font-bold font-mono text-amber-400">{elevation.openings.length}</span>
        </div>
      </div>

      {/* Tips interactivos */}
      <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 text-[11px] text-blue-300 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-blue-200">
          <Info size={14} />
          <span>Edición Interactiva</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
          <li>Arrastrá cajas para desplazarlas; se imantan a alturas AEA (0.30m, 1.10m, 2.20m).</li>
          <li>Rotá cualquier caja 90° entre vertical y apaisada/horizontal.</li>
          <li>Usá pellizco táctil con 2 dedos o la rueda del mouse para hacer zoom libre.</li>
          <li>Los cambios impactan de inmediato en la planta y en el cómputo métrico.</li>
        </ul>
      </div>

      {/* Botón rápido para alternar cara */}
      <button
        type="button"
        onClick={onToggleFace}
        className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <ArrowLeftRight size={14} />
        <span>Ver Cara Opuesta ({face === 'left' ? 'Derecha' : 'Izquierda'})</span>
      </button>
    </div>
  );
});
