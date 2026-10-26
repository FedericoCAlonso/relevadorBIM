/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBCOMPONENTE DE VISTA: OpeningInspectorPanel.tsx
 * Responsabilidad Única (SRP):
 * Inspector contextual de Abertura (`Opening`) seleccionada en el plano:
 * tipo, presets de carpintería, ancho, posición a lo largo del muro,
 * inversión de mano/sentido (`toggleOpeningHinge`/`toggleOpeningDirection`)
 * y altura de antepecho.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { DoorOpen, Trash2, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import {
  ARCHITECTURAL_OPENING_CONFIG,
  OPENING_TYPE_OPTIONS,
  DOOR_QUADRANT_SWING_OPTIONS
} from '../../../../config';
import type { Opening } from '../../../../models/architecture/Opening';
import { toggleOpeningHinge, toggleOpeningDirection } from '../../../../models/architecture/Opening';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import { getWallLength } from '../../../../models/architecture/Wall';
import {
  DEFAULT_OPENING_TYPES,
  type OpeningTypeDefinition
} from '../../../../models/architecture/openingPresets';

export interface OpeningInspectorPanelProps {
  selectedOpening: Opening | null | undefined;
  wallsMap: Map<string, Wall>;
  verticesMap: Map<string, WallVertex>;
  openingTypesCatalog?: ReadonlyArray<OpeningTypeDefinition>;
  onUpdateOpening: (openingId: string, updates: Partial<Opening>) => void;
  onDeleteOpening: (openingId: string) => void;
}

export const OpeningInspectorPanel: React.FC<OpeningInspectorPanelProps> = React.memo(
  ({
    selectedOpening,
    wallsMap,
    verticesMap,
    openingTypesCatalog,
    onUpdateOpening,
    onDeleteOpening
  }) => {
    if (!selectedOpening) return null;

    const hostWall = wallsMap.get(selectedOpening.wallId);
    const hostWallLength = hostWall ? getWallLength(hostWall, verticesMap) : 10;
    const maxDist = Math.max(0, hostWallLength - selectedOpening.width);

    const handleAdjustWidth = (newW: number) => {
      const clampedW = Math.max(
        0.4,
        Math.min(hostWallLength - selectedOpening.distanceAlongWall, newW)
      );
      onUpdateOpening(selectedOpening.id, { width: Number(clampedW.toFixed(2)) });
    };

    const presets = (openingTypesCatalog || DEFAULT_OPENING_TYPES).filter(
      (p) => p.type === selectedOpening.type
    );

    const currentTypeOption = OPENING_TYPE_OPTIONS.find((o) => o.id === selectedOpening.type);

    return (
      <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800">
              <DoorOpen size={16} />
            </div>
            <div>
              <span className="font-bold text-amber-950 block text-xs">
                {currentTypeOption?.label || 'Abertura'}
              </span>
              <span className="text-[10px] text-amber-700">Muro: {hostWallLength.toFixed(2)}m</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDeleteOpening(selectedOpening.id)}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            title="Eliminar abertura"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div>
          <label className="text-[10px] font-bold text-amber-900 block mb-1">
            TIPO DE ABERTURA
          </label>
          <div className="grid grid-cols-3 gap-1">
            {OPENING_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const updates: Partial<Opening> = { type: opt.id };
                  if (opt.id === 'window' && (!selectedOpening.sill || selectedOpening.sill === 0)) {
                    updates.sill = ARCHITECTURAL_OPENING_CONFIG.WINDOW_DEFAULT_SILL_M;
                  }
                  onUpdateOpening(selectedOpening.id, updates);
                }}
                className={`py-1.5 rounded-lg font-semibold text-[11px] border transition-all ${
                  selectedOpening.type === opt.id
                    ? 'bg-amber-600 border-amber-700 text-white shadow-sm'
                    : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-100/50'
                }`}
              >
                {opt.id === 'passage' ? 'Vano' : opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-amber-900 block mb-1">
            PRESETS DE CARPINTERÍA
          </label>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {presets.map((preset) => {
              const isCurrent =
                Math.abs(selectedOpening.width - preset.width) < 0.02 &&
                Math.abs(selectedOpening.height - preset.height) < 0.02 &&
                Math.abs(selectedOpening.sill - preset.sill) < 0.02;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const clampedW = Math.max(
                      0.4,
                      Math.min(hostWallLength - selectedOpening.distanceAlongWall, preset.width)
                    );
                    onUpdateOpening(selectedOpening.id, {
                      width: Number(clampedW.toFixed(2)),
                      height: preset.height,
                      sill: preset.sill,
                      swing: preset.defaultSwing ?? selectedOpening.swing,
                      presetId: preset.id
                    });
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap shrink-0 border transition-all ${
                    isCurrent
                      ? 'bg-amber-600 text-white border-amber-700 font-bold shadow-sm'
                      : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-100/60'
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-amber-900">ANCHO DEL VANO</label>
            <span className="font-mono text-xs font-bold text-amber-950">
              {selectedOpening.width.toFixed(2)} m
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.05"
              min="0.40"
              max={hostWallLength}
              value={selectedOpening.width}
              onChange={(e) =>
                handleAdjustWidth(
                  parseFloat(e.target.value) || ARCHITECTURAL_OPENING_CONFIG.DOOR_DEFAULT_WIDTH_M
                )
              }
              className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs"
            />
            <div className="flex-1 flex gap-1">
              {ARCHITECTURAL_OPENING_CONFIG.WIDTH_PRESETS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handleAdjustWidth(w)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                    Math.abs(selectedOpening.width - w) < 0.01
                      ? 'bg-amber-700 text-white border-amber-800 font-bold'
                      : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-100/60'
                  }`}
                >
                  {w.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-amber-900 block mb-1">
            DISTANCIA A ESQUINA
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.05"
              min="0"
              max={maxDist}
              value={selectedOpening.distanceAlongWall}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  onUpdateOpening(selectedOpening.id, {
                    distanceAlongWall: Math.max(0, Math.min(maxDist, val))
                  });
                }
              }}
              className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-xs text-amber-950 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-amber-700/60 pointer-events-none">
              m
            </span>
          </div>
        </div>

        {selectedOpening.type === 'door' && (
          <div className="pt-2 border-t border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-amber-900">SENTIDO DE APERTURA</label>
              <span className="text-[10px] font-mono font-bold text-amber-800">
                {selectedOpening.swing?.includes('left') ? 'Izq' : 'Der'} ·{' '}
                {selectedOpening.swing?.includes('out') ? 'Afuera' : 'Adentro'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateOpening(selectedOpening.id, {
                    swing: toggleOpeningHinge(selectedOpening.swing)
                  })
                }
                className="flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-semibold text-amber-900 transition-colors"
              >
                <ArrowLeftRight size={13} />
                <span>Invertir Mano</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateOpening(selectedOpening.id, {
                    swing: toggleOpeningDirection(selectedOpening.swing)
                  })
                }
                className="flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-semibold text-amber-900 transition-colors"
              >
                <ArrowUpDown size={13} />
                <span>Invertir Sentido</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {DOOR_QUADRANT_SWING_OPTIONS.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => onUpdateOpening(selectedOpening.id, { swing: sw.id })}
                  className={`py-1 rounded text-[9px] font-semibold border ${
                    (selectedOpening.swing || 'left_in') === sw.id
                      ? 'bg-amber-700 text-white border-amber-800'
                      : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  {sw.shortLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedOpening.type === 'window' && (
          <div className="pt-2 border-t border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-amber-900">ANTEPECHO (Sill)</label>
              <span className="text-[10px] font-mono font-bold text-amber-800">
                {(
                  selectedOpening.sill ?? ARCHITECTURAL_OPENING_CONFIG.WINDOW_DEFAULT_SILL_M
                ).toFixed(2)}{' '}
                m
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.05"
                value={selectedOpening.sill ?? ARCHITECTURAL_OPENING_CONFIG.WINDOW_DEFAULT_SILL_M}
                onChange={(e) =>
                  onUpdateOpening(selectedOpening.id, {
                    sill:
                      parseFloat(e.target.value) ||
                      ARCHITECTURAL_OPENING_CONFIG.WINDOW_DEFAULT_SILL_M
                  })
                }
                className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs"
              />
              <div className="flex-1 flex gap-1">
                {ARCHITECTURAL_OPENING_CONFIG.SILL_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUpdateOpening(selectedOpening.id, { sill: s })}
                    className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                      Math.abs(
                        (selectedOpening.sill ??
                          ARCHITECTURAL_OPENING_CONFIG.WINDOW_DEFAULT_SILL_M) - s
                      ) < 0.01
                        ? 'bg-amber-700 text-white border-amber-800 font-bold'
                        : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    {s.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
OpeningInspectorPanel.displayName = 'OpeningInspectorPanel';
