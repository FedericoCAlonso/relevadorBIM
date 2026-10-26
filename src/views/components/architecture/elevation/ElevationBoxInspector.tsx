import React, { memo } from 'react';
import {
  Layers,
  Cable,
  ArrowUpRight,
  Trash2,
  RotateCw,
  MoveHorizontal,
  MoveVertical
} from 'lucide-react';
import type { ElevationBox, WallElevation } from '../../../../models/architecture/wallElevation';
import type { BoxTypeDefinition, CabinetSizePreset, HeightPresetOption } from '../../../../models/electrical/electricalStandards';

interface ElevationBoxInspectorProps {
  selectedBox: ElevationBox;
  elevation: WallElevation;
  boxTypes: BoxTypeDefinition[];
  cabinetSizePresets: readonly CabinetSizePreset[];
  heightPresets: readonly HeightPresetOption[];
  onClearSelection: () => void;
  onStartConduitConnection: (boxId: string) => void;
  onOpenExternalModal: () => void;
  onDeleteSelectedBox: () => void;
  onRotateSelectedBox: () => void;
  onSetBoxOrientation: (orientation: 'vertical' | 'horizontal') => void;
  onSetElementBoxType: (boxId: string, boxTypeId: string) => void;
  onSetPanelDimensions: (
    panelId: string,
    dimensions: { widthMM?: number; heightMM?: number; depthMM?: number; dinModules?: number }
  ) => void;
  onSetSelectedBoxX: (x: number) => void;
  onSetSelectedBoxZ: (z: number) => void;
  onNudgeSelectedBox: (dx: number, dz: number) => void;
}

export const ElevationBoxInspector: React.FC<ElevationBoxInspectorProps> = memo(({
  selectedBox,
  elevation,
  boxTypes,
  cabinetSizePresets,
  heightPresets,
  onClearSelection,
  onStartConduitConnection,
  onOpenExternalModal,
  onDeleteSelectedBox,
  onRotateSelectedBox,
  onSetBoxOrientation,
  onSetElementBoxType,
  onSetPanelDimensions,
  onSetSelectedBoxX,
  onSetSelectedBoxZ,
  onNudgeSelectedBox
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg">
            <Layers size={16} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-100">
              {selectedBox.kind === 'panel' ? 'Tablero Eléctrico' : 'Caja de Instalación'}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {selectedBox.label || selectedBox.id.slice(-6)}
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

      {/* Acciones rápidas de conexión y eliminación */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onStartConduitConnection(selectedBox.id)}
          className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform cursor-pointer"
          title="Trazar cañería a otra caja en este muro"
        >
          <Cable size={14} />
          <span>Conectar Muro</span>
        </button>
        <button
          type="button"
          onClick={onOpenExternalModal}
          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform cursor-pointer"
          title="Conectar a losa/cielorraso, tablero u otro muro"
        >
          <ArrowUpRight size={14} />
          <span>Conectar Exterior</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onDeleteSelectedBox}
        className="w-full py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95 cursor-pointer"
        title="Eliminar caja del proyecto (Tecla Supr / Delete)"
      >
        <Trash2 size={14} />
        <span>Eliminar Caja Seleccionada</span>
      </button>

      {/* Orientación y Rotación de Caja */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Orientación de Caja:</span>
          <button
            type="button"
            onClick={onRotateSelectedBox}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform cursor-pointer"
            title="Girar 90° (Vertical ↔ Horizontal)"
          >
            <RotateCw size={12} />
            <span>Rotar 90°</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onSetBoxOrientation('vertical')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-center cursor-pointer ${
              selectedBox.orientation === 'vertical'
                ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            ↕ Vertical
          </button>
          <button
            type="button"
            onClick={() => onSetBoxOrientation('horizontal')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-center cursor-pointer ${
              selectedBox.orientation === 'horizontal'
                ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            ↔ Horizontal
          </button>
        </div>
      </div>

      {/* Datos físicos de catálogo */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-2.5 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400 text-[11px]">Tipo de Contenedor:</span>
          <span className="font-medium text-slate-200 text-[11px] truncate max-w-[140px]">
            {selectedBox.boxTypeName || selectedBox.category}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400 text-[11px]">Dimensiones Reales:</span>
          <span className="font-mono text-slate-200 text-[11px]">{selectedBox.sizeLabel}</span>
        </div>
      </div>

      {/* Selector de Tipo de Caja Física (Catálogo) */}
      {selectedBox.kind !== 'panel' && (
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
          <label className="text-[11px] text-slate-300 font-bold block">
            Caja Física en Pared (Catálogo):
          </label>
          <select
            value={selectedBox.boxTypeId || ''}
            onChange={(e) => onSetElementBoxType(selectedBox.id, e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">Por defecto ({selectedBox.category})</option>
            {boxTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.name} ({bt.widthMM ?? '?'}×{bt.heightMM ?? '?'} mm)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Edición paramétrica de dimensiones del Tablero */}
      {selectedBox.kind === 'panel' && (
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Gabinete DIN:
            </span>
            {selectedBox.dinModules ? (
              <span className="font-mono text-[10px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/50 font-bold">
                {selectedBox.dinModules} Módulos
              </span>
            ) : null}
          </div>

          {/* Presets rápidos */}
          <div className="grid grid-cols-4 gap-1">
            {cabinetSizePresets.map((pre) => {
              const isCurrent =
                Math.abs(selectedBox.widthMM - pre.widthMM) < 20 &&
                Math.abs(selectedBox.heightMM - pre.heightMM) < 20;
              return (
                <button
                  key={pre.id}
                  type="button"
                  onClick={() =>
                    onSetPanelDimensions(selectedBox.id, {
                      widthMM: pre.widthMM,
                      heightMM: pre.heightMM,
                      depthMM: pre.depthMM,
                      dinModules: pre.dinModules
                    })
                  }
                  className={`px-1 py-1 rounded text-[10px] font-bold border transition-colors truncate cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`${pre.label} (${pre.widthMM}x${pre.heightMM}mm)`}
                >
                  {pre.label.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Inputs milimétricos */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                Ancho (mm):
              </label>
              <input
                type="number"
                step={10}
                min={100}
                max={1200}
                value={selectedBox.widthMM}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val) && val >= 50) {
                    onSetPanelDimensions(selectedBox.id, { widthMM: val });
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                Alto (mm):
              </label>
              <input
                type="number"
                step={10}
                min={100}
                max={2000}
                value={selectedBox.heightMM}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val) && val >= 50) {
                    onSetPanelDimensions(selectedBox.id, { heightMM: val });
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Posición Métrica: X desde esquina y Altura Z */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
            <span className="flex items-center gap-1">
              <MoveHorizontal size={13} className="text-blue-400" />
              Distancia a Esquina Izquierda (X)
            </span>
            <span className="font-mono text-blue-400">{selectedBox.centerX.toFixed(2)} m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step={0.01}
              min={0}
              max={elevation.lengthM}
              value={selectedBox.centerX.toFixed(2)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) onSetSelectedBoxX(val);
              }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onNudgeSelectedBox(-0.05, 0)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 cursor-pointer"
            >
              -5cm
            </button>
            <button
              type="button"
              onClick={() => onNudgeSelectedBox(0.05, 0)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 cursor-pointer"
            >
              +5cm
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
            <span className="flex items-center gap-1">
              <MoveVertical size={13} className="text-blue-400" />
              Altura de Montaje sobre NPT (Z)
            </span>
            <span className="font-mono text-blue-400">{selectedBox.centerZ.toFixed(2)} m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step={0.01}
              min={0}
              max={elevation.wallHeightM}
              value={selectedBox.centerZ.toFixed(2)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) onSetSelectedBoxZ(val);
              }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onNudgeSelectedBox(0, -0.05)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 cursor-pointer"
            >
              -5cm
            </button>
            <button
              type="button"
              onClick={() => onNudgeSelectedBox(0, 0.05)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 cursor-pointer"
            >
              +5cm
            </button>
          </div>
        </div>
      </div>

      {/* Presets Rápidos de Altura según AEA */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
          Presets de Altura Reglamentaria AEA
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {heightPresets.map((hp) => {
            const isCurrent = Math.abs(selectedBox.centerZ - hp.meters) < 0.02;
            return (
              <button
                key={hp.id}
                type="button"
                onClick={() => onSetSelectedBoxZ(hp.meters)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-colors flex items-center justify-between cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="truncate">{hp.label}</span>
                <span className="font-mono text-[10px] opacity-80">{hp.meters.toFixed(2)}m</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
