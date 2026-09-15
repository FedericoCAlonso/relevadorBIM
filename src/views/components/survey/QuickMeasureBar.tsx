/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: QuickMeasureBar.tsx
 * Barra Rápida de Medición en Obra ("One Eye, One Hand").
 * Conexión Bluetooth Láser, selector de rumbo ortogonal (N, S, E, O) y botón de trazo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { useLaserViewModel } from '../../../viewmodels/useLaserViewModel';
import type { DrawingDirection } from '../../../viewmodels/useSurveyViewModel';
import { Bluetooth, Zap, Ruler, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, Plus } from 'lucide-react';

interface QuickMeasureBarProps {
  currentDirection: DrawingDirection;
  onSelectDirection: (dir: DrawingDirection) => void;
  currentDistance: string;
  onChangeDistance: (val: string) => void;
  onCommitWall: () => void;
  onViewComputoClick: () => void;
}

export const QuickMeasureBar: React.FC<QuickMeasureBarProps> = ({
  currentDirection,
  onSelectDirection,
  currentDistance,
  onChangeDistance,
  onCommitWall,
  onViewComputoClick
}) => {
  const { status, connect, disconnect } = useLaserViewModel((dist) => {
    onChangeDistance(dist.toFixed(3));
  });

  const directions: { dir: DrawingDirection; label: string; icon: React.ReactNode }[] = [
    { dir: 90, label: 'Norte', icon: <ArrowUp size={14} /> },
    { dir: 0, label: 'Este', icon: <ArrowRight size={14} /> },
    { dir: 270, label: 'Sur', icon: <ArrowDown size={14} /> },
    { dir: 180, label: 'Oeste', icon: <ArrowLeft size={14} /> }
  ];

  return (
    <header className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 z-10">
      {/* 1. Bluetooth Láser */}
      <div className="flex items-center gap-2">
        <button
          onClick={status.isConnected ? disconnect : connect}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            status.isConnected
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title={status.isConnected ? 'Desconectar distanciómetro' : 'Conectar distanciómetro Bluetooth'}
        >
          <Bluetooth size={15} className={status.isConnected ? 'text-emerald-600' : 'text-slate-400'} />
          <span>{status.isConnected ? status.deviceName || 'Láser Activo' : 'Conectar Láser'}</span>
        </button>

        {/* Input métrico directo */}
        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200">
          <Ruler size={14} className="text-blue-500" />
          <input
            type="number"
            step="0.05"
            value={currentDistance}
            onChange={(e) => onChangeDistance(e.target.value)}
            className="w-16 bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none"
            placeholder="3.50"
          />
          <span className="text-xs font-mono text-slate-400">m</span>
        </div>
      </div>

      {/* 2. Selector de Dirección Ortogonal (N, S, E, O) */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {directions.map((d) => {
          const isSelected = currentDirection === d.dir;
          return (
            <button
              key={d.dir}
              onClick={() => onSelectDirection(d.dir)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d.icon}
              <span className="hidden sm:inline">{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Botón Principal: Trazar Muro */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCommitWall}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all"
        >
          <Plus size={15} />
          <span>Trazar Muro</span>
        </button>

        <button
          onClick={onViewComputoClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl transition-all"
          title="Ver Cómputo para Cotizador IEBA"
        >
          <Zap size={14} className="text-amber-600" />
          <span className="hidden md:inline">Cotizador</span>
        </button>
      </div>
    </header>
  );
};
