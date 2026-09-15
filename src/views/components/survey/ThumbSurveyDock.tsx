/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ThumbSurveyDock.tsx
 * Botonera Ergonómica para Celular (Zona Natural del Pulgar de Steven Hoober).
 * Agrupa toda la interacción operativa en el tercio inferior de la pantalla:
 * lectura del distanciómetro, giro relativo (Der/Izq/Recto) y botón gigante.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useLaserViewModel } from '../../../viewmodels/useLaserViewModel';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import type { RelativeTurnType } from '../../../viewmodels/useSurveyViewModel';
import { Bluetooth, RotateCw, RotateCcw, MoveUp, Plus, CornerDownLeft, SlidersHorizontal, Undo2 } from 'lucide-react';

interface ThumbSurveyDockProps {
  relativeTurn: RelativeTurnType;
  onSelectTurn: (turn: RelativeTurnType) => void;
  customAngle: number;
  onChangeCustomAngle: (deg: number) => void;
  currentDistance: string;
  onChangeDistance: (val: string) => void;
  onCommitWall: () => void;
}

export const ThumbSurveyDock: React.FC<ThumbSurveyDockProps> = ({
  relativeTurn,
  onSelectTurn,
  customAngle,
  onChangeCustomAngle,
  currentDistance,
  onChangeDistance,
  onCommitWall
}) => {
  const { activeAnchorVertexId, project, undoLastWall } = useProjectStore();
  const [showCustomAngleInput, setShowCustomAngleInput] = useState(false);

  // Suscribir al láser Bluetooth
  const { status, connect, disconnect } = useLaserViewModel((distM) => {
    onChangeDistance(distM.toFixed(3));
  });

  const anchorVertex = activeAnchorVertexId
    ? project.vertices.find((v) => v.id === activeAnchorVertexId)
    : null;

  const anchorLabel = anchorVertex
    ? `Esquina (${anchorVertex.x.toFixed(2)}, ${anchorVertex.y.toFixed(2)})`
    : project.vertices.length === 0
    ? 'Origen Libre (0, 0)'
    : 'Tocá una esquina en el plano';

  return (
    <footer className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl p-3 pb-6 flex flex-col gap-2.5 z-20 touch-manipulation">
      {/* ─── FILA 1: ESTADO DEL ANCLAJE Y LÁSER BLUETOOTH ─── */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
          <span className="text-blue-600 font-bold">📍 Anclaje:</span>
          <span className="font-mono truncate">{anchorLabel}</span>
        </div>

        <button
          onClick={status.isConnected ? disconnect : connect}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            status.isConnected
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title={status.isConnected ? 'Desconectar distanciómetro' : 'Conectar distanciómetro Bluetooth'}
        >
          <Bluetooth size={13} className={status.isConnected ? 'text-emerald-600' : 'text-slate-400'} />
          <span>{status.isConnected ? status.deviceName || 'Conectado' : 'Conectar Láser'}</span>
        </button>
      </div>

      {/* ─── FILA 2: ENTRADA MÉTRICA Y GIRO RELATIVO (ZONA MEDIA DEL PULGAR) ─── */}
      <div className="flex items-center gap-2">
        {/* Campo de Medida Grande para Fácil Lectura y Tap con Guantes/Dedos */}
        <div className="flex-1 flex items-center bg-slate-100 border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 rounded-2xl px-3 py-1.5">
          <span className="text-xs font-semibold text-slate-400 mr-2">LARGO</span>
          <input
            type="number"
            step="0.05"
            value={currentDistance}
            onChange={(e) => onChangeDistance(e.target.value)}
            className="w-full bg-transparent font-mono font-bold text-xl text-slate-900 focus:outline-none"
            placeholder="3.50"
          />
          <span className="font-mono text-sm font-semibold text-slate-400">m</span>
        </div>

        {/* Segmented Control de Giros Relativos (Derecha 90°, Izquierda -90°, Recto 0°) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-300">
          <button
            type="button"
            onClick={() => onSelectTurn('right')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              relativeTurn === 'right'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Giro a la derecha (+90° horario)"
          >
            <RotateCw size={15} />
            <span>↷ Der</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTurn('left')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              relativeTurn === 'left'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Giro a la izquierda (-90° antihorario)"
          >
            <RotateCcw size={15} />
            <span>↶ Izq</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTurn('straight')}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
              relativeTurn === 'straight'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Continuar recto (0°)"
          >
            <MoveUp size={15} />
            <span>↑ 0°</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCustomAngleInput(!showCustomAngleInput)}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              relativeTurn === 'custom' || showCustomAngleInput
                ? 'bg-blue-100 text-blue-800'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Ángulo personalizado"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Sub-fila desplegable para ángulo arbitrario (falsa escuadra) */}
      {showCustomAngleInput && (
        <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="font-semibold text-slate-600">Ángulo Libre:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={customAngle}
              onChange={(e) => {
                const deg = parseFloat(e.target.value) || 0;
                onChangeCustomAngle(deg);
                onSelectTurn('custom');
              }}
              className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
            />
            <span className="font-mono text-slate-500">°</span>
          </div>
          <div className="flex gap-1">
            {[45, 135, 30, 60].map((quickDeg) => (
              <button
                key={quickDeg}
                onClick={() => {
                  onChangeCustomAngle(quickDeg);
                  onSelectTurn('custom');
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-mono hover:bg-slate-100"
              >
                {quickDeg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── FILA 3: BOTÓN GIGANTE DE ALCANCE INMEDIATO CON PULGAR Y DESHACER ─── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={undoLastWall}
          disabled={project.walls.length === 0}
          className="h-13 px-4 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 font-bold rounded-2xl border border-slate-300 transition-all"
          title="Deshacer última pared"
        >
          <Undo2 size={20} />
        </button>
        <button
          type="button"
          onClick={onCommitWall}
          className="flex-1 h-13 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg transition-all"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span>AGREGAR PARED</span>
          <CornerDownLeft size={16} className="text-blue-200 ml-1" />
        </button>
      </div>
    </footer>
  );
};
