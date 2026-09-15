/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: QuickMeasureBar.tsx
 * Barra Rápida de Medición en Obra ("One Eye, One Hand").
 * Conexión Bluetooth Láser, lectura en tiempo real y asignación inmediata.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useLaserViewModel } from '../../../viewmodels/useLaserViewModel';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { Bluetooth, Zap, Check, Ruler } from 'lucide-react';

interface QuickMeasureBarProps {
  onAddRoomClick: () => void;
  onViewComputoClick: () => void;
}

export const QuickMeasureBar: React.FC<QuickMeasureBarProps> = ({
  onAddRoomClick,
  onViewComputoClick
}) => {
  const { selectedEntity, updateWallLength } = useProjectStore();
  const [simValue, setSimValue] = useState<string>('3.50');
  const [showSimInput, setShowSimInput] = useState(false);

  const { status, connect, disconnect, simulateMeasurement } = useLaserViewModel((dist) => {
    // Si hay una pared seleccionada, asignarle la medida del láser al instante
    if (selectedEntity?.type === 'wall') {
      updateWallLength(selectedEntity.id, dist);
    }
  });

  const handleApplySimulated = () => {
    const val = parseFloat(simValue);
    if (!isNaN(val) && val > 0) {
      simulateMeasurement(val);
    }
  };

  return (
    <header className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200 z-10">
      {/* Estado del Láser Bluetooth */}
      <div className="flex items-center gap-3">
        <button
          onClick={status.isConnected ? disconnect : connect}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            status.isConnected
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title={status.isConnected ? 'Desconectar láser' : 'Conectar distanciómetro Bluetooth'}
        >
          <Bluetooth size={16} className={status.isConnected ? 'text-emerald-600' : 'text-slate-400'} />
          <span>{status.isConnected ? status.deviceName || 'Láser Activo' : 'Conectar Láser'}</span>
        </button>

        {/* Display de Última Medición */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800">
          <Ruler size={14} className="text-blue-500" />
          <span>{status.lastMeasurementM !== null ? `${status.lastMeasurementM.toFixed(3)} m` : '—.— m'}</span>
        </div>

        {/* Simulador rápido para testing sin hardware físico */}
        <div className="relative">
          <button
            onClick={() => setShowSimInput(!showSimInput)}
            className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 underline"
          >
            Simular
          </button>
          {showSimInput && (
            <div className="absolute top-8 left-0 flex items-center gap-1 p-2 bg-white rounded-xl shadow-lg border border-slate-200 z-20">
              <input
                type="number"
                step="0.05"
                value={simValue}
                onChange={(e) => setSimValue(e.target.value)}
                className="w-20 px-2 py-1 text-xs border rounded-lg"
                placeholder="Metros"
              />
              <button
                onClick={handleApplySimulated}
                className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Check size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAddRoomClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-sm transition-all"
        >
          <span>+ Ambiente</span>
        </button>

        <button
          onClick={onViewComputoClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium rounded-xl transition-all"
        >
          <Zap size={14} className="text-amber-600" />
          <span>Cotizador IEBA</span>
        </button>
      </div>
    </header>
  );
};
