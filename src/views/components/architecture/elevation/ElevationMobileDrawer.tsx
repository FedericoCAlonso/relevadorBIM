import React, { useState, memo } from 'react';
import {
  Cable,
  Zap,
  DoorOpen,
  X,
  Layers,
  ArrowUpRight,
  Trash2,
  RotateCw,
  Plus,
  ArrowLeftRight,
  Info
} from 'lucide-react';
import type { Wall } from '../../../../models/architecture/Wall';
import type {
  WallElevation,
  ElevationFace,
  ElevationBox,
  ElevationOpening,
  ElevationConduit,
  OpeningElevationPatch
} from '../../../../models/architecture/wallElevation';
import type {
  Conduit,
  Circuit,
  ConduitMaterial,
  ConduitRoutePreset
} from '../../../../models/electrical/ElectricalModel';
import type { ConduitLengthBreakdown } from '../../../../models/electrical/conduitMetrics';
import type { ConduitPresetOption } from '../../../../models/architecture/conduitElevationRoute';
import type {
  BoxTypeDefinition,
  CabinetSizePreset,
  HeightPresetOption
} from '../../../../models/electrical/electricalStandards';
import type { OpeningTypeDefinition } from '../../../../models/architecture/openingPresets';
import type { ElectricalSymbolDefinition } from '../../../../models/electrical/symbolsLib';
import type {
  ElevationPlacementToolState,
  ElevationOpeningPlacementToolState
} from '../../../../viewmodels/useWallElevationViewModel';

interface ElevationMobileDrawerProps {
  isConnectingConduit: boolean;
  conduitSourceBoxId: string | null;
  cancelConduitConnection: () => void;
  startConduitConnection: (boxId?: string) => void;
  placementTool: ElevationPlacementToolState | null;
  openingPlacementTool: ElevationOpeningPlacementToolState | null;
  autoConnectConduits: boolean;
  setAutoConnectConduits: (val: boolean) => void;
  cancelPlacement: () => void;
  cancelOpeningPlacement: () => void;
  selectedBox: ElevationBox | null;
  selectedOpening: ElevationOpening | null;
  selectedConduit: ElevationConduit | null;
  rawSelectedConduit: Conduit | null;
  selectedConduitMetric: ConduitLengthBreakdown | null;
  wall: Wall;
  elevation: WallElevation;
  face: ElevationFace | null;
  setFace: (face: ElevationFace) => void;
  clearSelection: () => void;
  rotateSelectedBox: () => void;
  setBoxOrientation: (orientation: 'vertical' | 'horizontal') => void;
  setElementBoxType: (boxId: string, boxTypeId: string) => void;
  setPanelDimensions: (
    panelId: string,
    dimensions: { widthMM?: number; heightMM?: number; depthMM?: number; dinModules?: number }
  ) => void;
  setSelectedBoxX: (x: number) => void;
  setSelectedBoxZ: (z: number) => void;
  nudgeSelectedBox: (dx: number, dz: number) => void;
  deleteSelectedBox: () => void;
  patchSelectedOpening: (patch: OpeningElevationPatch) => void;
  applyOpeningPreset: (presetId: string) => void;
  formatConduitSize: (mat?: ConduitMaterial, diam?: number) => string;
  conduitPresetOptions: readonly ConduitPresetOption[];
  setConduitPreset: (conduitId: string, preset: ConduitRoutePreset) => void;
  resetConduitRoute: (conduitId: string) => void;
  nudgeSelectedConduitHeight: (deltaM: number) => void;
  setSelectedConduitHeight: (z: number) => void;
  deleteConduit: (conduitId: string) => void;
  onOpenConduitModal: () => void;
  onOpenExternalModal: () => void;
  heightPresets: readonly HeightPresetOption[];
  cabinetSizePresets: readonly CabinetSizePreset[];
  boxTypes: BoxTypeDefinition[];
  openingTypes: readonly OpeningTypeDefinition[];
  availableCircuits: Circuit[];
  availablePlacementSymbols: ElectricalSymbolDefinition[];
  startPlacement: (symbolId: string, circuitId?: string | null) => void;
  startOpeningPlacement: (presetId: string) => void;
}

export const ElevationMobileDrawer: React.FC<ElevationMobileDrawerProps> = memo(({
  isConnectingConduit,
  conduitSourceBoxId,
  cancelConduitConnection,
  startConduitConnection,
  placementTool,
  openingPlacementTool,
  autoConnectConduits,
  setAutoConnectConduits,
  cancelPlacement,
  cancelOpeningPlacement,
  selectedBox,
  selectedOpening,
  selectedConduit,
  rawSelectedConduit,
  selectedConduitMetric,
  wall,
  elevation,
  face,
  setFace,
  clearSelection,
  rotateSelectedBox,
  setBoxOrientation,
  setElementBoxType,
  setPanelDimensions,
  setSelectedBoxX,
  setSelectedBoxZ,
  nudgeSelectedBox,
  deleteSelectedBox,
  patchSelectedOpening,
  applyOpeningPreset,
  formatConduitSize,
  conduitPresetOptions,
  setConduitPreset,
  resetConduitRoute,
  nudgeSelectedConduitHeight,
  setSelectedConduitHeight,
  deleteConduit,
  onOpenConduitModal,
  onOpenExternalModal,
  heightPresets,
  cabinetSizePresets,
  boxTypes,
  openingTypes,
  availableCircuits,
  availablePlacementSymbols,
  startPlacement,
  startOpeningPlacement
}) => {
  const [mobileSheetMode, setMobileSheetMode] = useState<'none' | 'add_box' | 'add_opening' | 'info'>('none');
  const [boxCategoryTab, setBoxCategoryTab] = useState<'tomas' | 'llaves' | 'tableros' | 'paso' | 'apliques'>('tomas');
  const [openingCategoryTab, setOpeningCategoryTab] = useState<'door' | 'window' | 'passage'>('door');
  const [placementCircuitId, setPlacementCircuitId] = useState<string | null>(null);

  return (
    <>
      <div className="lg:hidden shrink-0 bg-slate-900 border-t border-slate-800 text-slate-200">
        {isConnectingConduit ? (
          <div className="p-3 bg-blue-950/80 border-t border-blue-500/40 text-blue-200 flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg shrink-0 animate-pulse">
                <Cable size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {!conduitSourceBoxId ? 'Trazar Cañería: Paso 1' : 'Trazar Cañería: Paso 2'}
                </div>
                <div className="text-[10px] text-blue-300 truncate">
                  {!conduitSourceBoxId
                    ? 'Tocá la caja de origen en la pared'
                    : 'Tocá la caja de destino para unir con caño'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelConduitConnection}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0 cursor-pointer"
            >
              <X size={14} />
              <span>Cancelar</span>
            </button>
          </div>
        ) : placementTool ? (
          <div className="p-3 bg-emerald-950/70 border-t border-emerald-500/40 text-emerald-200 flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg shrink-0 animate-pulse">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  Colocando en muro
                </div>
                <div className="text-[10px] text-emerald-300 truncate">
                  Tocá la pared para ubicar · Snap a cotas AEA
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                  autoConnectConduits
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title={autoConnectConduits ? 'Conectar cañería: Sí' : 'Conectar cañería: No'}
              >
                <Cable size={12} />
                <span>{autoConnectConduits ? 'Cañería: Sí' : 'Cañería: No'}</span>
              </button>
              <button
                type="button"
                onClick={cancelPlacement}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0 cursor-pointer"
              >
                <X size={14} />
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        ) : openingPlacementTool ? (
          <div className="p-3 bg-amber-950/70 border-t border-amber-500/40 text-amber-200 flex items-center justify-between gap-2 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 animate-pulse">
                <DoorOpen size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  Colocando abertura
                </div>
                <div className="text-[10px] text-amber-300 truncate">
                  Tocá la pared para ubicar el vano
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelOpeningPlacement}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0 cursor-pointer"
            >
              <X size={14} />
              <span>Cancelar</span>
            </button>
          </div>
        ) : selectedBox ? (
          <div className="p-3 space-y-2.5 max-h-[46vh] overflow-y-auto">
            {/* Cabecera de la caja seleccionada con botón Rotar 90° inmediato */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 bg-blue-600/30 text-blue-400 rounded-lg shrink-0">
                  <Layers size={14} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-xs text-slate-100 truncate">
                      {selectedBox.kind === 'panel' ? 'Tablero' : 'Caja'}
                    </h4>
                    <span className="font-mono text-[10px] text-blue-400">
                      {selectedBox.label || selectedBox.id.slice(-6)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block">
                    {selectedBox.sizeLabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => startConduitConnection(selectedBox.id)}
                  className="px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform cursor-pointer"
                  title="Trazar cañería desde esta caja a otra"
                >
                  <Cable size={13} />
                  <span>Conectar</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenExternalModal}
                  className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform cursor-pointer"
                  title="Conectar a losa/cielorraso u otros muros"
                >
                  <ArrowUpRight size={13} />
                  <span>Exterior</span>
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedBox}
                  className="p-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg active:scale-95 transition-transform cursor-pointer"
                  title="Eliminar caja (Delete)"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={rotateSelectedBox}
                  className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform cursor-pointer"
                  title="Rotar caja 90°"
                >
                  <RotateCw size={13} />
                  <span>Rotar 90°</span>
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Botones de Orientación Rápida */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setBoxOrientation('vertical')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                  selectedBox.orientation === 'vertical'
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                ↕ Vertical (5×10)
              </button>
              <button
                type="button"
                onClick={() => setBoxOrientation('horizontal')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                  selectedBox.orientation === 'horizontal'
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500 font-bold'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                ↔ Horizontal (10×5)
              </button>
            </div>

            {/* Selector de Tipo de Caja Física (Catálogo) */}
            {selectedBox.kind !== 'panel' && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <span>TIPO DE CAJA FÍSICA</span>
                  <span className="font-mono text-cyan-300 font-bold">{selectedBox.sizeLabel}</span>
                </div>
                <select
                  value={selectedBox.boxTypeId || ''}
                  onChange={(e) => setElementBoxType(selectedBox.id, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
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
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 text-xs space-y-2">
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
                          setPanelDimensions(selectedBox.id, {
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
                          setPanelDimensions(selectedBox.id, { widthMM: val });
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
                          setPanelDimensions(selectedBox.id, { heightMM: val });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Controles de posición Z (Altura) y X (Distancia) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Altura Z */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <span>ALTURA (Z)</span>
                  <span className="font-mono text-blue-400 font-bold">{selectedBox.centerZ.toFixed(2)}m</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudgeSelectedBox(0, -0.05)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0 cursor-pointer"
                  >
                    -5
                  </button>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={elevation.wallHeightM}
                    value={selectedBox.centerZ.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) setSelectedBoxZ(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => nudgeSelectedBox(0, 0.05)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0 cursor-pointer"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* Distancia X */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <span>ESQUINA (X)</span>
                  <span className="font-mono text-blue-400 font-bold">{selectedBox.centerX.toFixed(2)}m</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudgeSelectedBox(-0.05, 0)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0 cursor-pointer"
                  >
                    -5
                  </button>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={elevation.lengthM}
                    value={selectedBox.centerX.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) setSelectedBoxX(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => nudgeSelectedBox(0.05, 0)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-mono shrink-0 cursor-pointer"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>

            {/* Presets Rápidos AEA en tira horizontal deslizable */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">PRESETS REGLAMENTARIOS AEA:</span>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {heightPresets.map((hp) => {
                  const isCurrent = Math.abs(selectedBox.centerZ - hp.meters) < 0.02;
                  return (
                    <button
                      key={hp.id}
                      type="button"
                      onClick={() => setSelectedBoxZ(hp.meters)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-500 font-bold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {hp.meters.toFixed(2)}m · {hp.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : selectedOpening ? (
          <div className="p-3 space-y-2 max-h-[44vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-amber-600/30 text-amber-400 rounded-lg">
                  <DoorOpen size={14} />
                </div>
                <h4 className="font-bold text-xs text-slate-100">
                  {selectedOpening.type === 'door' ? 'Puerta' : selectedOpening.type === 'window' ? 'Ventana' : 'Vano'}
                </h4>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="p-1 text-slate-400 hover:text-white rounded-lg text-xs cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Ancho</span>
                <input
                  type="number"
                  step={0.05}
                  value={selectedOpening.width.toFixed(2)}
                  onChange={(e) => patchSelectedOpening({ width: parseFloat(e.target.value) || selectedOpening.width })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-center text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Alto</span>
                <input
                  type="number"
                  step={0.05}
                  value={selectedOpening.height.toFixed(2)}
                  onChange={(e) => patchSelectedOpening({ height: parseFloat(e.target.value) || selectedOpening.height })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-center text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Antepecho</span>
                <input
                  type="number"
                  step={0.05}
                  value={selectedOpening.sill.toFixed(2)}
                  onChange={(e) => patchSelectedOpening({ sill: parseFloat(e.target.value) || selectedOpening.sill })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-center text-xs text-white"
                />
              </div>
            </div>

            {/* Presets Rápidos de Carpintería */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">PRESETS DE CARPINTERÍA:</span>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
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
                        onClick={() => applyOpeningPreset(preset.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap shrink-0 transition-colors border cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-600 text-white border-amber-500 font-bold shadow-sm'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : selectedConduit ? (
          /* Barra móvil de canalización seleccionada */
          <div className="p-3 space-y-2 max-h-[44vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-cyan-600/30 text-cyan-400 rounded-lg">
                  <Zap size={14} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-100">
                    Canalización {formatConduitSize(selectedConduit.material, selectedConduit.diameterMM)}
                  </h4>
                  <span className="text-[10px] text-cyan-300 font-mono">
                    {selectedConduitMetric ? `${selectedConduitMetric.totalLengthM.toFixed(2)} m` : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="p-1 text-slate-400 hover:text-white rounded-lg text-xs cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Presets en tira deslizable */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">PRESET DE TRAZADO:</span>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {conduitPresetOptions.map((opt) => {
                  const isCurrent = selectedConduit.elevationRoute?.preset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setConduitPreset(selectedConduit.id, opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-500 font-bold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {selectedConduit.elevationRoute && (
                  <button
                    type="button"
                    onClick={() => resetConduitRoute(selectedConduit.id)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 cursor-pointer"
                  >
                    Restablecer
                  </button>
                )}
              </div>
            </div>

            {/* Controles táctiles de ajuste fino de altura de cañería */}
            {(() => {
              const intermediatePoint = selectedConduit.elevationRoute?.points?.find(
                (_, idx, arr) => idx > 0 && idx < arr.length - 1
              );
              const conduitZ = intermediatePoint?.z;
              return (
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>ALTURA DE CAÑERÍA (Z):</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {conduitZ != null ? `${conduitZ.toFixed(2)} m` : 'En puente / auto'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => nudgeSelectedConduitHeight(-0.10)}
                      className="py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-mono font-bold transition-transform text-center cursor-pointer"
                      title="Bajar tramo horizontal 10 cm"
                    >
                      ▼ -10 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeSelectedConduitHeight(0.10)}
                      className="py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-mono font-bold transition-transform text-center cursor-pointer"
                      title="Subir tramo horizontal 10 cm"
                    >
                      ▲ +10 cm
                    </button>
                  </div>
                  {/* Presets de altura AEA rápidos para caños */}
                  <div className="flex gap-1 overflow-x-auto pt-0.5">
                    {[
                      { label: '0.30m Zócalo', z: 0.30 },
                      { label: '1.10m Medio', z: 1.10 },
                      { label: '2.20m Dintel', z: 2.20 },
                      ...(elevation.ceilingZ
                        ? [{ label: `${elevation.ceilingZ.toFixed(2)}m Losa`, z: elevation.ceilingZ }]
                        : [])
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSelectedConduitHeight(preset.z)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                          conduitZ != null && Math.abs(conduitZ - preset.z) < 0.03
                            ? 'bg-cyan-600 text-white border-cyan-400 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Tocá y arrastrá los nodos azules en la pared o usá estos botones.
                  </p>
                </div>
              );
            })()}

            {/* Resumen de conductores en la cañería */}
            {rawSelectedConduit?.conductors && rawSelectedConduit.conductors.length > 0 && (
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                  <span>CONDUCTORES ({rawSelectedConduit.conductors.length}):</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rawSelectedConduit.conductors.map((c, cIdx) => (
                    <span
                      key={cIdx}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                      {c.sectionMM2} mm² {c.role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones principales de cañería: Configurar cables y Eliminar */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onOpenConduitModal}
                className="py-2 px-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform cursor-pointer"
              >
                <Cable size={14} />
                <span>Configurar Cables</span>
              </button>
              <button
                type="button"
                onClick={() => deleteConduit(selectedConduit.id)}
                className="py-2 px-2.5 bg-rose-600/20 hover:bg-rose-600 active:scale-95 text-rose-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-500/40 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Eliminar Caño</span>
              </button>
            </div>
          </div>
        ) : (
          /* Barra móvil cuando no hay nada seleccionado: botones ergonómicos para el pulgar */
          <div className="p-2 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setMobileSheetMode('add_box')}
                className="w-full py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-emerald-500/40 transition-transform cursor-pointer"
              >
                <Plus size={14} />
                <span>+ Boca</span>
              </button>
              <button
                type="button"
                onClick={() => startConduitConnection()}
                className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-blue-500/40 transition-transform cursor-pointer"
              >
                <Cable size={14} />
                <span>☍ Conectar</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileSheetMode('add_opening')}
                className="w-full py-2.5 px-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md border border-amber-500/40 transition-transform cursor-pointer"
              >
                <DoorOpen size={14} />
                <span>+ Vano</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-slate-200">Muro {wall.id.slice(-6)}</span>
                <span className="text-slate-400 text-[11px] truncate">
                  {elevation.lengthM.toFixed(2)}m × {elevation.wallHeightM.toFixed(2)}m · {elevation.boxes.length} bocas
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setFace(face === 'left' ? 'right' : 'left')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Alternar cara opuesta"
                >
                  <ArrowLeftRight size={12} />
                  <span>Cara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSheetMode('info')}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Info size={12} />
                  <span>Info</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM SHEET MÓVIL DESLIZANTE PARA AGREGAR ELEMENTOS O VER INFO ─── */}
      {mobileSheetMode !== 'none' && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileSheetMode('none')}
          />

          <div className="relative bg-slate-900 border-t border-slate-700 rounded-t-3xl shadow-2xl p-4 max-h-[85vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-200 pb-safe">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

            {/* MODO A: Agregar Boca o Tablero */}
            {mobileSheetMode === 'add_box' && (
              <div className="flex flex-col min-h-0 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Plus size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Agregar Boca o Tablero</h3>
                      <p className="text-[11px] text-slate-400">Elegí el elemento a colocar en este muro</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSheetMode('none')}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Selector de circuito */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Circuito asignado:
                  </label>
                  <select
                    value={placementCircuitId ?? ''}
                    onChange={(e) => setPlacementCircuitId(e.target.value ? e.target.value : null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Por defecto / Automático</option>
                    {availableCircuits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Toggle para auto-conectar cañería */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                  <div className="flex items-center gap-2">
                    <Cable size={16} className={autoConnectConduits ? 'text-blue-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold text-slate-200 block text-xs">Conectar con cañería</span>
                      <span className="text-[10px] text-slate-400 block">
                        {autoConnectConduits ? 'Enlaza con la boca previa' : 'Colocar cajas aisladas sin cañería'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoConnectConduits ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        autoConnectConduits ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Pestañas de categorías de bocas */}
                <div className="grid grid-cols-5 gap-1 bg-slate-800/80 p-1 rounded-xl text-[11px] font-semibold text-center shrink-0">
                  {(
                    [
                      { id: 'tomas', label: 'Tomas' },
                      { id: 'llaves', label: 'Llaves' },
                      { id: 'tableros', label: 'Tableros' },
                      { id: 'paso', label: 'Paso' },
                      { id: 'apliques', label: 'Luces' }
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setBoxCategoryTab(tab.id)}
                      className={`py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-colors truncate cursor-pointer ${
                        boxCategoryTab === tab.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Lista táctil de símbolos según tab */}
                <div className="overflow-y-auto max-h-[46vh] space-y-1.5 pr-1">
                  {availablePlacementSymbols
                    .filter((s) => {
                      if (boxCategoryTab === 'tableros')
                        return s.categoria === 'tableros' || s.id.includes('tp') || s.id.includes('ts') || s.id.includes('medidor');
                      if (boxCategoryTab === 'tomas')
                        return s.categoria === 'tomacorrientes' || s.id.includes('toma');
                      if (boxCategoryTab === 'paso')
                        return s.categoria === 'cajas_pase' || s.id.includes('paso') || s.id.includes('derivacion');
                      if (boxCategoryTab === 'llaves')
                        return s.id.includes('llave') || s.id.includes('efecto') || s.id.includes('pulsador') || s.id.includes('combinacion');
                      return (
                        s.id.includes('aplique') ||
                        s.id.includes('brazo') ||
                        (!s.id.includes('tp') &&
                          !s.id.includes('ts') &&
                          !s.id.includes('medidor') &&
                          !s.id.includes('toma') &&
                          !s.id.includes('paso') &&
                          !s.id.includes('derivacion') &&
                          !s.id.includes('llave') &&
                          !s.id.includes('efecto') &&
                          !s.id.includes('pulsador') &&
                          !s.id.includes('combinacion'))
                      );
                    })
                    .map((sym) => (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => {
                          startPlacement(sym.id, placementCircuitId);
                          setMobileSheetMode('none');
                        }}
                        className="w-full text-left p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-[0.98] border border-slate-700/70 hover:border-emerald-500/60 transition-all flex items-center justify-between group shadow-sm cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 truncate">
                            {sym.label}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {sym.id}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-700 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white shrink-0 transition-colors">
                          Colocar ➔
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* MODO B: Agregar Abertura */}
            {mobileSheetMode === 'add_opening' && (
              <div className="flex flex-col min-h-0 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                      <DoorOpen size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Agregar Abertura</h3>
                      <p className="text-[11px] text-slate-400">Seleccioná carpintería estándar o vano libre</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSheetMode('none')}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Pestañas de categorías de aberturas */}
                <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold text-center shrink-0">
                  {(
                    [
                      { id: 'door', label: 'Puertas' },
                      { id: 'window', label: 'Ventanas' },
                      { id: 'passage', label: 'Vanos' }
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOpeningCategoryTab(tab.id)}
                      className={`py-1.5 rounded-lg transition-colors font-bold cursor-pointer ${
                        openingCategoryTab === tab.id
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Lista táctil de presets de aberturas */}
                <div className="overflow-y-auto max-h-[46vh] space-y-1.5 pr-1">
                  {openingTypes
                    .filter((p) => p.type === openingCategoryTab)
                    .map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          startOpeningPlacement(preset.id);
                          setMobileSheetMode('none');
                        }}
                        className="w-full text-left p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-[0.98] border border-slate-700/70 hover:border-amber-500/60 transition-all flex items-center justify-between group shadow-sm cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {preset.width.toFixed(2)}m × {preset.height.toFixed(2)}m
                            {preset.sill > 0 ? ` · Antep: ${preset.sill.toFixed(2)}m` : ' · Sin antepecho'}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-700 group-hover:bg-amber-600 text-slate-300 group-hover:text-white shrink-0 transition-colors">
                          Colocar ➔
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* MODO C: Info y Tips de Pantalla */}
            {mobileSheetMode === 'info' && (
              <div className="flex flex-col min-h-0 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                      <Info size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-white">Información del Muro y Tips</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSheetMode('none')}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                    <span className="text-slate-400 block text-[10px]">Longitud</span>
                    <span className="font-bold font-mono text-sm text-slate-100">{elevation.lengthM.toFixed(2)} m</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                    <span className="text-slate-400 block text-[10px]">Altura Muro</span>
                    <span className="font-bold font-mono text-sm text-slate-100">{elevation.wallHeightM.toFixed(2)} m</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                    <span className="text-slate-400 block text-[10px]">Cielorraso</span>
                    <span className="font-bold font-mono text-sm text-slate-100">{elevation.ceilingZ.toFixed(2)} m</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70">
                    <span className="text-slate-400 block text-[10px]">Espesor</span>
                    <span className="font-bold font-mono text-sm text-slate-100">{wall.thickness.toFixed(2)} m</span>
                  </div>
                </div>

                <div className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-3 text-xs text-blue-200 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-blue-300">
                    <span>💡 Gestos y Operación Táctil</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    <li><strong>Zoom:</strong> Pellizcá la pantalla con 2 dedos o doble toque rápido para encuadrar.</li>
                    <li><strong>Desplazar:</strong> Arrastrá cualquier caja con el dedo para cambiar su posición. Se imanta automáticamente a las alturas AEA (+0.30m, +1.10m, +2.20m).</li>
                    <li><strong>Rotar:</strong> Tocá la caja y usá el botón &quot;Rotar 90°&quot; para pasar de formato rectangular vertical a horizontal.</li>
                    <li><strong>Canalizaciones:</strong> Tocá una cañería para elegir su trazado (Directo, Por Pared, Curva Superior).</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});
