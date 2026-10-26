/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBCOMPONENTE DE VISTA: StructuralInspectorPanel.tsx
 * Responsabilidad Única (SRP):
 * Inspectores contextuales de Columna H°A° (`StructuralColumn`) y Viga Saliente
 * (`StructuralBeam`) seleccionadas en el plano.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Building2, Layers, Trash2, RotateCcw, RotateCw } from 'lucide-react';
import type {
  StructuralColumn,
  StructuralBeam,
  ColumnShape
} from '../../../../models/architecture/StructuralElement';
import {
  COLUMN_DIMENSION_PRESETS,
  BEAM_DIMENSION_PRESETS
} from '../../../../models/architecture/StructuralElement';

export interface StructuralInspectorPanelProps {
  selectedColumn: StructuralColumn | null | undefined;
  selectedBeam: StructuralBeam | null | undefined;
  onUpdateColumn: (columnId: string, updates: Partial<StructuralColumn>) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpdateBeam: (beamId: string, updates: Partial<StructuralBeam>) => void;
  onDeleteBeam: (beamId: string) => void;
  onClearSelection: () => void;
}

export const StructuralInspectorPanel: React.FC<StructuralInspectorPanelProps> = React.memo(
  ({
    selectedColumn,
    selectedBeam,
    onUpdateColumn,
    onDeleteColumn,
    onUpdateBeam,
    onDeleteBeam,
    onClearSelection
  }) => {
    if (!selectedColumn && !selectedBeam) return null;

    return (
      <>
        {selectedColumn && (
          <div className="bg-slate-50 border-2 border-slate-500 rounded-2xl p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-200 text-slate-800 rounded-lg">
                  <Building2 size={16} />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    Columna {selectedColumn.shape === 'circular' ? 'Circular' : 'Rectangular'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {selectedColumn.id.slice(-6)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onDeleteColumn(selectedColumn.id);
                  onClearSelection();
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar columna"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                FORMA GEOMÉTRICA
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(['rectangular', 'circular'] as ColumnShape[]).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => onUpdateColumn(selectedColumn.id, { shape })}
                    className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                      (selectedColumn.shape || 'rectangular') === shape
                        ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {shape === 'rectangular' ? 'Rectangular' : 'Circular (Ø)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                PRESETS DE SECCIÓN
              </label>
              <div className="grid grid-cols-3 gap-1">
                {COLUMN_DIMENSION_PRESETS.map((preset) => {
                  const isSelected =
                    Math.abs(selectedColumn.width - preset.width) < 0.01 &&
                    Math.abs(selectedColumn.depth - preset.depth) < 0.01;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        onUpdateColumn(selectedColumn.id, {
                          width: preset.width,
                          depth: preset.depth,
                          shape: preset.label.startsWith('Ø')
                            ? 'circular'
                            : selectedColumn.shape || 'rectangular'
                        })
                      }
                      className={`py-1 px-1 rounded-lg text-[10px] font-mono font-semibold border transition-all text-center ${
                        isSelected
                          ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  {selectedColumn.shape === 'circular' ? 'DIÁMETRO (m)' : 'ANCHO X (m)'}
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.10"
                  value={selectedColumn.width}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > 0) {
                      onUpdateColumn(selectedColumn.id, {
                        width: val,
                        depth: selectedColumn.shape === 'circular' ? val : selectedColumn.depth
                      });
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900"
                />
              </div>
              {selectedColumn.shape !== 'circular' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    PROFUNDIDAD Y (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.10"
                    value={selectedColumn.depth}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > 0) onUpdateColumn(selectedColumn.id, { depth: val });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                POSICIÓN CENTRO (X, Y)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2 py-1">
                  <span className="text-[10px] font-mono text-slate-400 mr-1">X:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={Number(selectedColumn.x.toFixed(2))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) onUpdateColumn(selectedColumn.id, { x: val });
                    }}
                    className="w-full font-mono font-bold text-xs outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">m</span>
                </div>
                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2 py-1">
                  <span className="text-[10px] font-mono text-slate-400 mr-1">Y:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={Number(selectedColumn.y.toFixed(2))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) onUpdateColumn(selectedColumn.id, { y: val });
                    }}
                    className="w-full font-mono font-bold text-xs outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">m</span>
                </div>
              </div>
            </div>

            {selectedColumn.shape !== 'circular' && (
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">ROTACIÓN</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateColumn(selectedColumn.id, {
                        rotationDeg: (((selectedColumn.rotationDeg || 0) - 90) % 360 + 360) % 360
                      })
                    }
                    className="py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-1"
                  >
                    <RotateCcw size={12} />
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateColumn(selectedColumn.id, {
                        rotationDeg: ((selectedColumn.rotationDeg || 0) + 90) % 360
                      })
                    }
                    className="py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-1"
                  >
                    <RotateCw size={12} />
                    <span>+90°</span>
                  </button>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-center">
                    <input
                      type="number"
                      value={selectedColumn.rotationDeg || 0}
                      onChange={(e) =>
                        onUpdateColumn(selectedColumn.id, {
                          rotationDeg: parseFloat(e.target.value) || 0
                        })
                      }
                      className="w-full text-center font-mono font-bold text-xs outline-none"
                    />
                    <span className="text-[10px] text-slate-400">°</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-2 bg-slate-100 rounded-xl text-[10px] text-slate-600 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-0.5">
                Elemento Estructural H°A°:
              </span>
              Zona no canaleteable en hormigón armado. Los trazados deben esquivar esta sección o
              pasar en superficie/cielorraso.
            </div>
          </div>
        )}

        {selectedBeam && (
          <div className="bg-slate-50 border-2 border-indigo-400 rounded-2xl p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Layers size={16} />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    Viga Saliente Bajo Losa
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {selectedBeam.id.slice(-6)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onDeleteBeam(selectedBeam.id);
                  onClearSelection();
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar viga"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                PRESETS DE SECCIÓN (Ancho x Cuelgue)
              </label>
              <div className="grid grid-cols-2 gap-1">
                {BEAM_DIMENSION_PRESETS.map((preset) => {
                  const isSelected =
                    Math.abs(selectedBeam.width - preset.width) < 0.01 &&
                    Math.abs(selectedBeam.dropHeightM - preset.dropHeightM) < 0.01;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        onUpdateBeam(selectedBeam.id, {
                          width: preset.width,
                          dropHeightM: preset.dropHeightM
                        })
                      }
                      className={`py-1 px-1 rounded-lg text-[10px] font-mono font-semibold border transition-all text-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  ANCHO VIGA (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.10"
                  value={selectedBeam.width}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > 0) onUpdateBeam(selectedBeam.id, { width: val });
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  CUELGUE / ALTURA (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.15"
                  value={selectedBeam.dropHeightM}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > 0) onUpdateBeam(selectedBeam.id, { dropHeightM: val });
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-600 block">EXTREMOS (X, Y)</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-slate-200 rounded-xl p-1.5">
                  <span className="text-[9px] font-bold text-slate-400 block mb-1">Inicio:</span>
                  <div className="flex gap-1 text-[11px] font-mono">
                    <input
                      type="number"
                      step="0.05"
                      value={Number(selectedBeam.startX.toFixed(2))}
                      onChange={(e) =>
                        onUpdateBeam(selectedBeam.id, { startX: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border border-slate-200 rounded px-1"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={Number(selectedBeam.startY.toFixed(2))}
                      onChange={(e) =>
                        onUpdateBeam(selectedBeam.id, { startY: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border border-slate-200 rounded px-1"
                    />
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-1.5">
                  <span className="text-[9px] font-bold text-slate-400 block mb-1">Fin:</span>
                  <div className="flex gap-1 text-[11px] font-mono">
                    <input
                      type="number"
                      step="0.05"
                      value={Number(selectedBeam.endX.toFixed(2))}
                      onChange={(e) =>
                        onUpdateBeam(selectedBeam.id, { endX: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border border-slate-200 rounded px-1"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={Number(selectedBeam.endY.toFixed(2))}
                      onChange={(e) =>
                        onUpdateBeam(selectedBeam.id, { endY: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border border-slate-200 rounded px-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-indigo-50/70 rounded-xl text-[10px] text-indigo-900 border border-indigo-100">
              <span className="font-bold block mb-0.5">Cuelgue bajo losa:</span>
              Proyección en planta con líneas de trazos. Señala discontinuidad de losa para ruteo
              de cañerías.
            </div>
          </div>
        )}
      </>
    );
  }
);
StructuralInspectorPanel.displayName = 'StructuralInspectorPanel';
