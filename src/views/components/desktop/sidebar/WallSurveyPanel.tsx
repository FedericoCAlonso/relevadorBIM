/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBCOMPONENTE DE VISTA: WallSurveyPanel.tsx
 * Responsabilidad Única (SRP):
 * Panel de trazado continuo de muros desde el punto de anclaje, selección de
 * justificación y giros relativos, Deshacer/Rehacer global e inserción rápida
 * de columnas y vigas estructurales.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import {
  Ruler,
  RotateCw,
  RotateCcw,
  MoveUp,
  Plus,
  Undo2,
  Redo2,
  Building2,
  Layers
} from 'lucide-react';
import { WALL_JUSTIFICATION_OPTIONS } from '../../../../config';
import type { WallJustification, WallVertex } from '../../../../models/architecture/Wall';
import type { RelativeTurnType } from '../../../../viewmodels/useSurveyViewModel';

export interface WallSurveyPanelProps {
  anchorVertex: WallVertex | null | undefined;
  verticesCount: number;
  currentDistance: string;
  onChangeDistance: (val: string) => void;
  wallJustification: WallJustification;
  onChangeJustification?: (j: WallJustification) => void;
  relativeTurn: RelativeTurnType;
  onSelectTurn: (turn: RelativeTurnType) => void;
  customAngle: number;
  onChangeCustomAngle: (deg: number) => void;
  onCommitWall: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onQuickAddColumn: () => void;
  onQuickAddBeam: () => void;
}

export const WallSurveyPanel: React.FC<WallSurveyPanelProps> = React.memo(
  ({
    anchorVertex,
    verticesCount,
    currentDistance,
    onChangeDistance,
    wallJustification,
    onChangeJustification,
    relativeTurn,
    onSelectTurn,
    customAngle,
    onChangeCustomAngle,
    onCommitWall,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onQuickAddColumn,
    onQuickAddBeam
  }) => {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-500">Punto de Anclaje:</span>
          <span className="font-mono font-bold text-slate-800">
            {anchorVertex
              ? `(${anchorVertex.x.toFixed(2)}, ${anchorVertex.y.toFixed(2)}) m`
              : verticesCount === 0
              ? 'Origen (0, 0)'
              : 'Seleccioná un vértice'}
          </span>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">LONGITUD DE PARED</label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500">
            <Ruler size={14} className="text-blue-500 mr-1.5" />
            <input
              type="number"
              step="0.05"
              value={currentDistance}
              onChange={(e) => onChangeDistance(e.target.value)}
              className="w-full font-mono font-bold text-base text-slate-900 focus:outline-none"
              placeholder="3.50"
            />
            <span className="font-mono text-xs text-slate-400">m</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            REFERENCIA DE MEDIDA
          </label>
          <div className="grid grid-cols-3 gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs font-semibold">
            {WALL_JUSTIFICATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeJustification?.(opt.id)}
                className={`py-1 rounded-lg transition-all text-center ${
                  wallJustification === opt.id
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={opt.title}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">GIRO RELATIVO</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onSelectTurn('right')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold border transition-all ${
                relativeTurn === 'right'
                  ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RotateCw size={13} />
              <span>↷ Der</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTurn('left')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold border transition-all ${
                relativeTurn === 'left'
                  ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RotateCcw size={13} />
              <span>↶ Izq</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTurn('straight')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold border transition-all ${
                relativeTurn === 'straight'
                  ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MoveUp size={13} />
              <span>↑ Recto</span>
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
            <span>Ángulo libre / Falsa escuadra:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={customAngle}
                onChange={(e) => {
                  onChangeCustomAngle(parseFloat(e.target.value) || 0);
                  onSelectTurn('custom');
                }}
                className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-center text-slate-800"
              />
              <span className="font-mono font-bold">°</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCommitWall}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          <span>+ AGREGAR PARED (Enter)</span>
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
            title="Deshacer última acción (Ctrl+Z)"
          >
            <Undo2 size={14} />
            <span>Deshacer</span>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
            title="Rehacer acción (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
            <span>Rehacer</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <label className="text-[10px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wider">
            + Estructura & Interferencias
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onQuickAddColumn}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-1 transition-colors text-[11px]"
              title="Insertar columna de hormigón armado (zona de exclusión de canaleteado)"
            >
              <Building2 size={13} className="text-slate-600" />
              <span>+ Columna H°A°</span>
            </button>
            <button
              type="button"
              onClick={onQuickAddBeam}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-1 transition-colors text-[11px]"
              title="Insertar viga saliente bajo losa (interferencia de tendido)"
            >
              <Layers size={13} className="text-slate-600" />
              <span>+ Viga Saliente</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
WallSurveyPanel.displayName = 'WallSurveyPanel';
