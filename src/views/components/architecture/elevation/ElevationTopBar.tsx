import React, { useState, memo } from 'react';
import {
  Ruler,
  Layers,
  Cable,
  X,
  Plus,
  DoorOpen,
  ZoomIn,
  ZoomOut,
  Focus,
  Maximize2
} from 'lucide-react';
import type { Wall } from '../../../../models/architecture/Wall';
import type { WallElevation, ElevationFace } from '../../../../models/architecture/wallElevation';
import type { Circuit } from '../../../../models/electrical/ElectricalModel';
import type { ElectricalSymbolDefinition } from '../../../../models/electrical/symbolsLib';
import type { OpeningTypeDefinition } from '../../../../models/architecture/openingPresets';
import type {
  ElevationFaceOption,
  ElevationPlacementToolState,
  ElevationOpeningPlacementToolState,
  ElevationBox
} from '../../../../viewmodels/useWallElevationViewModel';

interface ElevationTopBarProps {
  wall: Wall;
  elevation: WallElevation;
  face: ElevationFace | null;
  faceOptions: readonly ElevationFaceOption[];
  setFace: (face: ElevationFace) => void;
  placementTool: ElevationPlacementToolState | null;
  openingPlacementTool: ElevationOpeningPlacementToolState | null;
  autoConnectConduits: boolean;
  setAutoConnectConduits: (val: boolean) => void;
  lastPlacedElementId: string | null;
  resetSequence: () => void;
  cancelPlacement: () => void;
  isConnectingConduit: boolean;
  conduitSourceBoxId: string | null;
  cancelConduitConnection: () => void;
  startConduitConnection: (boxId?: string) => void;
  selectedBox: ElevationBox | null;
  availableCircuits: Circuit[];
  availablePlacementSymbols: ElectricalSymbolDefinition[];
  startPlacement: (symbolId: string, circuitId?: string | null) => void;
  openingTypes: readonly OpeningTypeDefinition[];
  startOpeningPlacement: (presetId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWall: () => void;
  fit: () => void;
  close: () => void;
}

export const ElevationTopBar: React.FC<ElevationTopBarProps> = memo(({
  wall,
  elevation,
  face,
  faceOptions,
  setFace,
  placementTool,
  openingPlacementTool,
  autoConnectConduits,
  setAutoConnectConduits,
  lastPlacedElementId,
  resetSequence,
  cancelPlacement,
  isConnectingConduit,
  conduitSourceBoxId,
  cancelConduitConnection,
  startConduitConnection,
  selectedBox,
  availableCircuits,
  availablePlacementSymbols,
  startPlacement,
  openingTypes,
  startOpeningPlacement,
  zoomIn,
  zoomOut,
  fitWall,
  fit,
  close
}) => {
  const [isPlacementMenuOpen, setIsPlacementMenuOpen] = useState(false);
  const [isOpeningPlacementMenuOpen, setIsOpeningPlacementMenuOpen] = useState(false);
  const [placementCircuitId, setPlacementCircuitId] = useState<string | null>(null);
  const [openingCategoryTab, setOpeningCategoryTab] = useState<'door' | 'window' | 'passage'>('door');

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 text-white shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="p-1.5 sm:p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
          <Ruler size={16} className="sm:w-[18px] sm:h-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 id="wall-elevation-title" className="font-bold text-xs sm:text-sm text-slate-100 truncate">
              Alzado de Muro
            </h2>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1 py-0.5 rounded border border-slate-700 shrink-0">
              {wall.id.slice(-6)}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
            L: {elevation.lengthM.toFixed(2)}m · H: {elevation.wallHeightM.toFixed(2)}m
            {elevation.ceilingZ !== elevation.wallHeightM && ` · Cielorraso: ${elevation.ceilingZ.toFixed(2)}m`}
          </p>
        </div>
      </div>

      {/* Selector de Paramento */}
      {/* Móvil: botón compacto toggle */}
      <button
        type="button"
        onClick={() => setFace(face === 'left' ? 'right' : 'left')}
        className="sm:hidden px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 cursor-pointer"
        title="Alternar cara opuesta"
      >
        <Layers size={13} className="text-blue-400" />
        <span className="truncate max-w-[80px]">{face === 'left' ? 'Cara Izq.' : 'Cara Der.'}</span>
      </button>

      {/* Escritorio: selector expandido con 2 opciones */}
      <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5 sm:p-1 gap-1 text-[11px] sm:text-xs font-semibold shrink-0">
        {faceOptions.map((opt) => (
          <button
            key={opt.face}
            type="button"
            onClick={() => setFace(opt.face)}
            className={`px-2 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
              face === opt.face
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Layers size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span className="max-w-[70px] sm:max-w-[140px] truncate">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Indicador de Colocación Activa en Cabecera */}
      {(placementTool || openingPlacementTool) && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-bold shrink-0">
          <span className="truncate max-w-[90px] sm:max-w-none">
            {placementTool ? 'Colocando boca...' : 'Colocando vano...'}
          </span>
          {placementTool && (
            <button
              type="button"
              onClick={() => setAutoConnectConduits(!autoConnectConduits)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors border cursor-pointer ${
                autoConnectConduits
                  ? 'bg-blue-600 text-white border-blue-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={
                autoConnectConduits
                  ? 'Conectar cajas consecutivas con cañería (activo)'
                  : 'Colocar cajas aisladas sin cañería'
              }
            >
              <Cable size={11} />
              <span>{autoConnectConduits ? 'Cañería: Sí' : 'Cañería: No'}</span>
            </button>
          )}
          {placementTool && autoConnectConduits && lastPlacedElementId && (
            <button
              type="button"
              onClick={resetSequence}
              className="px-1.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Desvincular boca previa (inicia nueva secuencia limpia)"
            >
              Desvincular
            </button>
          )}
          <button
            type="button"
            onClick={cancelPlacement}
            className="p-1 hover:bg-amber-500/30 rounded-lg text-amber-200 transition-colors cursor-pointer"
            title="Cancelar colocación (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Indicador de Trazado de Conducto Activo en Cabecera */}
      {isConnectingConduit && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-xl text-[11px] font-bold shrink-0 animate-in fade-in">
          <Cable size={12} className="animate-pulse text-cyan-300" />
          <span className="truncate max-w-[120px] sm:max-w-none">
            {!conduitSourceBoxId ? 'Trazar cañería: 1. Elegí origen' : 'Trazar cañería: 2. Elegí destino'}
          </span>
          <button
            type="button"
            onClick={cancelConduitConnection}
            className="p-1 hover:bg-blue-500/30 rounded-lg text-blue-200 transition-colors cursor-pointer"
            title="Cancelar trazado (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Botones de Colocación para Escritorio */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {/* Botón Desktop ☍ Conectar */}
        {!placementTool && !openingPlacementTool && (
          <button
            type="button"
            onClick={() => {
              if (isConnectingConduit) {
                cancelConduitConnection();
              } else {
                startConduitConnection(selectedBox?.id);
              }
            }}
            className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer ${
              isConnectingConduit
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-blue-600/80 hover:bg-blue-600 text-blue-100 hover:text-white border border-blue-500/30'
            }`}
            title="Trazar cañería entre dos cajas en este muro"
          >
            <Cable size={14} />
            <span>☍ Conectar</span>
          </button>
        )}

        {/* Botón Desktop + Boca */}
        {!placementTool && !openingPlacementTool && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsPlacementMenuOpen((v) => !v);
                setIsOpeningPlacementMenuOpen(false);
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                isPlacementMenuOpen
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-600/80 hover:bg-emerald-600 text-emerald-100 hover:text-white border border-emerald-500/30'
              }`}
              title="Agregar nueva boca o tablero en este muro"
            >
              <Plus size={14} />
              <span>+ Boca</span>
            </button>

            {isPlacementMenuOpen && (
              <div className="absolute top-full mt-2 right-0 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-50 text-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-100">Agregar elemento en muro</span>
                  <button
                    type="button"
                    onClick={() => setIsPlacementMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Circuito asignado:
                  </label>
                  <select
                    value={placementCircuitId ?? ''}
                    onChange={(e) => setPlacementCircuitId(e.target.value ? e.target.value : null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Por defecto / Automático</option>
                    {availableCircuits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                  <div className="flex items-center gap-2">
                    <Cable size={14} className={autoConnectConduits ? 'text-blue-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold text-slate-200 block text-[11px]">Conectar con cañería</span>
                      <span className="text-[9px] text-slate-400 block">
                        {autoConnectConduits ? 'Enlaza con boca previa' : 'Cajas independientes'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoConnectConduits(!autoConnectConduits)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoConnectConduits ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        autoConnectConduits ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Seleccionar tipo de elemento:
                  </label>
                  <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                    {availablePlacementSymbols.map((sym) => (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => {
                          startPlacement(sym.id, placementCircuitId);
                          setIsPlacementMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs bg-slate-800/60 hover:bg-emerald-600 hover:text-white border border-slate-700/60 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <span className="font-semibold truncate">{sym.label}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-700/80 group-hover:bg-emerald-700 text-slate-300 group-hover:text-white shrink-0 ml-1">
                          {sym.id.includes('tp') || sym.id.includes('ts') || sym.id.includes('medidor')
                            ? 'Tablero'
                            : sym.id.includes('toma')
                            ? 'Toma'
                            : sym.id.includes('llave')
                            ? 'Llave'
                            : 'Boca'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botón Desktop + Abertura */}
        {!placementTool && !openingPlacementTool && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsOpeningPlacementMenuOpen((v) => !v);
                setIsPlacementMenuOpen(false);
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                isOpeningPlacementMenuOpen
                  ? 'bg-amber-500 text-slate-900 font-extrabold'
                  : 'bg-amber-600/80 hover:bg-amber-600 text-amber-100 hover:text-white border border-amber-500/30'
              }`}
              title="Agregar nueva puerta, ventana o vano en este muro"
            >
              <DoorOpen size={14} />
              <span>+ Abertura</span>
            </button>

            {isOpeningPlacementMenuOpen && (
              <div className="absolute top-full mt-2 right-0 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-50 text-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-100">Agregar abertura en muro</span>
                  <button
                    type="button"
                    onClick={() => setIsOpeningPlacementMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 bg-slate-800 p-0.5 rounded-xl text-[11px] font-semibold text-center">
                  {(['door', 'window', 'passage'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setOpeningCategoryTab(cat)}
                      className={`py-1 rounded-lg transition-colors cursor-pointer ${
                        openingCategoryTab === cat
                          ? 'bg-amber-600 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat === 'door' ? 'Puertas' : cat === 'window' ? 'Ventanas' : 'Vanos'}
                    </button>
                  ))}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {openingTypes
                    .filter((p) => p.type === openingCategoryTab)
                    .map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          startOpeningPlacement(preset.id);
                          setIsOpeningPlacementMenuOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 hover:border-amber-500/50 transition-all group flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {preset.width.toFixed(2)}m × {preset.height.toFixed(2)}m
                            {preset.sill > 0 ? ` · Antepecho +${preset.sill.toFixed(2)}m` : ' · NPT 0.00m'}
                          </div>
                        </div>
                        <Plus size={14} className="text-slate-400 group-hover:text-amber-400 shrink-0" />
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controles de Vista y Botón Cerrar */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5">
          <button
            type="button"
            onClick={zoomIn}
            className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Acercar"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Alejar"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={fitWall}
            className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 border border-blue-500/30 cursor-pointer"
            title="Enfocar alzado del muro al ancho de pantalla"
          >
            <Focus size={13} />
            <span>Muro</span>
          </button>
          <button
            type="button"
            onClick={fit}
            className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Ajustar encuadre general (Fit)"
          >
            <Maximize2 size={15} />
          </button>
        </div>

        <button
          type="button"
          onClick={close}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-0.5 cursor-pointer"
          title="Cerrar alzado (Esc)"
        >
          <X size={18} className="sm:w-[20px] sm:h-[20px]" />
        </button>
      </div>
    </header>
  );
});
