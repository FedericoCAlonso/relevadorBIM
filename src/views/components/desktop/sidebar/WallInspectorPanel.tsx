/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBCOMPONENTE DE VISTA: WallInspectorPanel.tsx
 * Responsabilidad Única (SRP):
 * Inspector contextual de Muro (`Wall`) seleccionado en el plano:
 * acceso al alzado 2D, longitud, espesor, tipo de cerramiento, justificación,
 * rotación/inversión, inserción referenciada de aberturas y empalmes en T.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import {
  Ruler,
  Trash2,
  Eye,
  RotateCcw,
  RotateCw,
  ArrowLeftRight,
  MapPin,
  DoorOpen
} from 'lucide-react';
import {
  ARCHITECTURAL_WALL_CONFIG,
  ARCHITECTURAL_OPENING_CONFIG,
  WALL_TYPE_OPTIONS,
  WALL_JUSTIFICATION_OPTIONS,
  OPENING_TYPE_OPTIONS,
  DOOR_QUADRANT_SWING_OPTIONS
} from '../../../../config';
import type { Wall, WallVertex, WallJustification } from '../../../../models/architecture/Wall';
import { getWallLength } from '../../../../models/architecture/Wall';
import type { Opening, OpeningType, OpeningSwing } from '../../../../models/architecture/Opening';
import { useWallElevationStore } from '../../../../viewmodels/useWallElevationViewModel';

export interface WallInspectorPanelProps {
  selectedWall: Wall | null | undefined;
  verticesMap: Map<string, WallVertex>;
  allOpenings: ReadonlyArray<Opening>;
  onUpdateWall: (wallId: string, updates: Partial<Wall>) => void;
  onUpdateWallLength: (wallId: string, newLengthM: number) => void;
  onRotateWall: (wallId: string, deltaAngleDeg: number) => void;
  onInvertWallDirection: (wallId: string) => void;
  onDeleteWall: (wallId: string) => void;
  onSetActiveAnchorVertexId: (vertexId: string | null) => void;
  onAddOpeningReferenced: (params: {
    hostWallId: string;
    referenceVertexId: string;
    offsetToJambM: number;
    widthM: number;
    type: OpeningType;
    swing?: OpeningSwing;
  }) => void;
  onDeleteOpening: (openingId: string) => void;
  onAddBranchWallFromOffset: (params: {
    hostWallId: string;
    referenceVertexId: string;
    offsetM: number;
    branchLengthM: number;
    side: 'left' | 'right';
  }) => void;
}

export const WallInspectorPanel: React.FC<WallInspectorPanelProps> = React.memo(
  ({
    selectedWall,
    verticesMap,
    allOpenings,
    onUpdateWall,
    onUpdateWallLength,
    onRotateWall,
    onInvertWallDirection,
    onDeleteWall,
    onSetActiveAnchorVertexId,
    onAddOpeningReferenced,
    onDeleteOpening,
    onAddBranchWallFromOffset
  }) => {
    const [openingOffset, setOpeningOffset] = useState(
      ARCHITECTURAL_OPENING_CONFIG.DEFAULT_OFFSET_M.toFixed(2)
    );
    const [openingWidth, setOpeningWidth] = useState(
      ARCHITECTURAL_OPENING_CONFIG.DOOR_DEFAULT_WIDTH_M.toFixed(2)
    );
    const [openingType, setOpeningType] = useState<OpeningType>('door');
    const [openingRefSide, setOpeningRefSide] = useState<'start' | 'end'>('start');
    const [openingSwing, setOpeningSwing] = useState<OpeningSwing>('left_in');

    const [teeOffset, setTeeOffset] = useState(
      ARCHITECTURAL_WALL_CONFIG.TEE_DEFAULT_OFFSET_M.toFixed(2)
    );
    const [teeLength, setTeeLength] = useState(
      ARCHITECTURAL_WALL_CONFIG.TEE_DEFAULT_LENGTH_M.toFixed(2)
    );
    const [teeSide, setTeeSide] = useState<'left' | 'right'>('left');

    if (!selectedWall) {
      return (
        <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-slate-400">
          Tocá cualquier muro en el plano para agregar puertas, ventanas o empalmes en T.
        </div>
      );
    }

    const wallLen = getWallLength(selectedWall, verticesMap);
    const wallOpenings = allOpenings.filter((o) => o.wallId === selectedWall.id);

    const handleSelectOpeningType = (type: OpeningType) => {
      setOpeningType(type);
      const opt = OPENING_TYPE_OPTIONS.find((o) => o.id === type);
      if (opt) setOpeningWidth(opt.defaultWidthM.toFixed(2));
    };

    return (
      <div className="bg-slate-50 border-2 border-blue-400 rounded-2xl p-3.5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
              <Ruler size={16} />
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-xs">Muro Seleccionado</span>
              <span className="text-[10px] text-slate-500 font-mono">
                ID: {selectedWall.id.slice(-6)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDeleteWall(selectedWall.id)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar muro"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => useWallElevationStore.getState().openElevation(selectedWall.id)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          title="Abrir vista interactiva de alzado 2D para ver cajas, cañerías, aberturas y alturas"
        >
          <Eye size={15} />
          <span>Ver Alzado / Elevación 2D</span>
        </button>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-slate-600">LONGITUD DEL MURO</label>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.05"
              min="0.20"
              value={Number(wallLen.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val && val > 0) onUpdateWallLength(selectedWall.id, val);
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 pointer-events-none">
              m
            </span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-600 block mb-1">
            ESPESOR DEL MURO
          </label>
          <div className="grid grid-cols-4 gap-1">
            {ARCHITECTURAL_WALL_CONFIG.THICKNESS_PRESETS.map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => onUpdateWall(selectedWall.id, { thickness: th })}
                className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                  Math.abs(selectedWall.thickness - th) < 0.01
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {Math.round(th * 100)} cm
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-600 block mb-1">
            TIPO DE CERRAMIENTO
          </label>
          <div className="grid grid-cols-3 gap-1">
            {WALL_TYPE_OPTIONS.map((wt) => (
              <button
                key={wt.id}
                type="button"
                onClick={() =>
                  onUpdateWall(selectedWall.id, {
                    wallType: wt.id,
                    height:
                      wt.id === 'low_wall'
                        ? selectedWall.height < 2.0
                          ? selectedWall.height
                          : ARCHITECTURAL_WALL_CONFIG.DEFAULT_LOW_WALL_HEIGHT_M
                        : wt.id === 'railing'
                        ? selectedWall.height < 2.0
                          ? selectedWall.height
                          : ARCHITECTURAL_WALL_CONFIG.DEFAULT_RAILING_HEIGHT_M
                        : 2.8
                  })
                }
                className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                  (selectedWall.wallType || 'standard') === wt.id
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {wt.label}
              </button>
            ))}
          </div>
          {selectedWall.wallType === 'low_wall' && (
            <div className="mt-1.5 flex items-center justify-between bg-white border border-slate-300 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-600">Altura de Muro:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  min="0.20"
                  max="2.50"
                  value={
                    selectedWall.height ?? ARCHITECTURAL_WALL_CONFIG.DEFAULT_LOW_WALL_HEIGHT_M
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > 0) onUpdateWall(selectedWall.id, { height: val });
                  }}
                  className="w-16 font-mono font-bold text-xs text-right outline-none"
                />
                <span className="text-xs font-mono font-bold text-slate-400">m</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-600 block mb-1">
            REFERENCIA / JUSTIFICACIÓN
          </label>
          <div className="grid grid-cols-3 gap-1">
            {WALL_JUSTIFICATION_OPTIONS.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() =>
                  onUpdateWall(selectedWall.id, { justification: j.id as WallJustification })
                }
                className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                  (selectedWall.justification || 'center') === j.id
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-600 block mb-1">GIRO Y SENTIDO</label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onRotateWall(selectedWall.id, -90)}
              className="flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              title="Girar pared 90° antihorario"
            >
              <RotateCcw size={13} />
              <span>-90°</span>
            </button>
            <button
              type="button"
              onClick={() => onRotateWall(selectedWall.id, 90)}
              className="flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              title="Girar pared 90° horario"
            >
              <RotateCw size={13} />
              <span>+90°</span>
            </button>
            <button
              type="button"
              onClick={() => onInvertWallDirection(selectedWall.id)}
              className="flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              title="Invertir dirección inicio <-> fin"
            >
              <ArrowLeftRight size={13} />
              <span>Invertir</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSetActiveAnchorVertexId(selectedWall.endVertexId)}
          className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <MapPin size={14} />
          <span>Fijar extremo como Punto de Inicio</span>
        </button>

        <div className="pt-2 border-t border-blue-100 space-y-2">
          <span className="font-bold text-slate-700 block">+ Insertar Abertura en este Muro</span>
          <div className="flex gap-1">
            {OPENING_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectOpeningType(opt.id)}
                className={`flex-1 py-1 rounded-lg border font-semibold ${
                  openingType === opt.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {opt.id === 'passage' ? 'Vano' : opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Referencia a esquina:</label>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setOpeningRefSide('start')}
                className={`py-1 rounded-md border transition-all ${
                  openingRefSide === 'start'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Inicio (Start)
              </button>
              <button
                type="button"
                onClick={() => setOpeningRefSide('end')}
                className={`py-1 rounded-md border transition-all ${
                  openingRefSide === 'end'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Fin (End)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Dist. a esquina</label>
              <input
                type="number"
                step="0.05"
                value={openingOffset}
                onChange={(e) => setOpeningOffset(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Ancho vano</label>
              <input
                type="number"
                step="0.05"
                value={openingWidth}
                onChange={(e) => setOpeningWidth(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>

          {openingType === 'door' && (
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Sentido de batiente:</label>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {DOOR_QUADRANT_SWING_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOpeningSwing(s.id)}
                    className={`py-1 rounded-md border font-semibold transition-all ${
                      openingSwing === s.id
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.arrowLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const refVId =
                openingRefSide === 'start'
                  ? selectedWall.startVertexId
                  : selectedWall.endVertexId;
              onAddOpeningReferenced({
                hostWallId: selectedWall.id,
                referenceVertexId: refVId,
                offsetToJambM: parseFloat(openingOffset) || 0,
                widthM: parseFloat(openingWidth) || 0,
                type: openingType,
                swing: openingSwing
              });
            }}
            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
          >
            Emplazar {openingType === 'door' ? 'Puerta' : openingType === 'window' ? 'Ventana' : 'Vano'}
          </button>

          {wallOpenings.length > 0 && (
            <div className="pt-2 border-t border-blue-100 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 block">
                Aberturas en este muro ({wallOpenings.length}):
              </span>
              <div className="space-y-1">
                {wallOpenings.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded-lg text-[11px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <DoorOpen size={13} className="text-blue-500" />
                      <span className="font-semibold text-slate-700">
                        {op.type === 'door' ? 'Puerta' : op.type === 'window' ? 'Ventana' : 'Vano'}{' '}
                        {op.width.toFixed(2)}m
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        @{op.distanceAlongWall.toFixed(2)}m
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteOpening(op.id)}
                      className="p-1 text-red-500 hover:text-red-700 rounded"
                      title="Eliminar abertura"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-blue-100 space-y-2">
          <span className="font-bold text-slate-700 block">+ Empalme en T</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Desde esquina</label>
              <input
                type="number"
                step="0.1"
                value={teeOffset}
                onChange={(e) => setTeeOffset(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Largo rama</label>
              <input
                type="number"
                step="0.1"
                value={teeLength}
                onChange={(e) => setTeeLength(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Lado de salida</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTeeSide('left')}
                className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                  teeSide === 'left' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
                }`}
              >
                Izquierda
              </button>
              <button
                type="button"
                onClick={() => setTeeSide('right')}
                className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                  teeSide === 'right' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
                }`}
              >
                Derecha
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onAddBranchWallFromOffset({
                hostWallId: selectedWall.id,
                referenceVertexId: selectedWall.startVertexId,
                offsetM: parseFloat(teeOffset) || 0,
                branchLengthM: parseFloat(teeLength) || 0,
                side: teeSide
              });
            }}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm"
          >
            Generar Pared en T
          </button>
        </div>
      </div>
    );
  }
);
WallInspectorPanel.displayName = 'WallInspectorPanel';
