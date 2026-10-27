/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA / COMPONENTE: SpaceOrthogonalDimensionEditor.tsx
 * Responsabilidad Única (SRP):
 * Control de edición directa y paramétrica de cotas ortogonales de un ambiente
 * (Ancho en X y Largo en Y), con entrada numérica manual, selector de sentido
 * de crecimiento y steppers de ajuste fino de 10 cm.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { Ruler } from 'lucide-react';

export interface SpaceOrthogonalDimensionEditorProps {
  spaceId: string;
  dims: { widthM: number; lengthM: number };
  onResizeSpaceOrthogonal: (params: {
    spaceId: string;
    axis: 'width' | 'length';
    newDimensionM: number;
    direction?: 'positive' | 'negative' | 'center';
  }) => void;
}

interface DimensionRowProps {
  label: string;
  currentM: number;
  dir: 'positive' | 'negative' | 'center';
  onChangeDir: (dir: 'positive' | 'negative' | 'center') => void;
  dirOptions: [
    { key: 'negative'; label: string; title: string },
    { key: 'center'; label: string; title: string },
    { key: 'positive'; label: string; title: string }
  ];
  onCommit: (newM: number) => void;
  onDelta: (deltaM: number) => void;
}

const DimensionRow: React.FC<DimensionRowProps> = ({
  label,
  currentM,
  dir,
  onChangeDir,
  dirOptions,
  onCommit,
  onDelta
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');

  const handleCommit = () => {
    if (isEditing) {
      const parsed = parseFloat(localValue.replace(',', '.'));
      if (!isNaN(parsed) && parsed >= 0.5) {
        onCommit(Number(parsed.toFixed(2)));
      }
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs space-y-1.5">
      {/* Cabecera del eje: Título + Selector de sentido */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-slate-800">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400">Crecer:</span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {dirOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChangeDir(opt.key)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  dir === opt.key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={opt.title}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fila de Input y Steppers */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            inputMode="decimal"
            value={isEditing ? localValue : currentM.toFixed(2)}
            onFocus={(e) => {
              setIsEditing(true);
              setLocalValue(currentM.toFixed(2));
              e.target.select();
            }}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCommit();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setIsEditing(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={handleCommit}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 focus:bg-white rounded-lg font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-7 transition-colors"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400 pointer-events-none">
            m
          </span>
        </div>

        {/* Stepper Restar 10 cm */}
        <button
          type="button"
          onClick={() => onDelta(-0.1)}
          className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-mono font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
          title="Reducir 10 cm"
        >
          −0.10
        </button>

        {/* Stepper Sumar 10 cm */}
        <button
          type="button"
          onClick={() => onDelta(0.1)}
          className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-mono font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs shrink-0"
          title="Aumentar 10 cm"
        >
          +0.10
        </button>
      </div>
    </div>
  );
};

export const SpaceOrthogonalDimensionEditor: React.FC<SpaceOrthogonalDimensionEditorProps> = ({
  spaceId,
  dims,
  onResizeSpaceOrthogonal
}) => {
  const [widthDir, setWidthDir] = useState<'positive' | 'negative' | 'center'>('positive');
  const [lengthDir, setLengthDir] = useState<'positive' | 'negative' | 'center'>('positive');

  if (dims.widthM <= 0 || dims.lengthM <= 0) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
          <Ruler size={13} className="text-blue-600" />
          <span>Dimensiones Ortogonales</span>
        </span>
        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
          {dims.widthM.toFixed(2)}m × {dims.lengthM.toFixed(2)}m
        </span>
      </div>

      <div className="space-y-2">
        {/* Eje X: Ancho */}
        <DimensionRow
          label="Ancho (Eje X)"
          currentM={dims.widthM}
          dir={widthDir}
          onChangeDir={setWidthDir}
          dirOptions={[
            { key: 'negative', label: '←', title: 'Crecer hacia el Oeste (← Izquierda)' },
            { key: 'center', label: '↔', title: 'Crecer simétrico desde el centro (↔)' },
            { key: 'positive', label: '→', title: 'Crecer hacia el Este (→ Derecha)' }
          ]}
          onCommit={(newM) =>
            onResizeSpaceOrthogonal({
              spaceId,
              axis: 'width',
              newDimensionM: newM,
              direction: widthDir
            })
          }
          onDelta={(delta) =>
            onResizeSpaceOrthogonal({
              spaceId,
              axis: 'width',
              newDimensionM: Math.max(0.5, Number((dims.widthM + delta).toFixed(2))),
              direction: widthDir
            })
          }
        />

        {/* Eje Y: Largo */}
        <DimensionRow
          label="Largo (Eje Y)"
          currentM={dims.lengthM}
          dir={lengthDir}
          onChangeDir={setLengthDir}
          dirOptions={[
            { key: 'negative', label: '↑', title: 'Crecer hacia el Norte (↑ Arriba)' },
            { key: 'center', label: '↕', title: 'Crecer simétrico desde el centro (↕)' },
            { key: 'positive', label: '↓', title: 'Crecer hacia el Sur (↓ Abajo)' }
          ]}
          onCommit={(newM) =>
            onResizeSpaceOrthogonal({
              spaceId,
              axis: 'length',
              newDimensionM: newM,
              direction: lengthDir
            })
          }
          onDelta={(delta) =>
            onResizeSpaceOrthogonal({
              spaceId,
              axis: 'length',
              newDimensionM: Math.max(0.5, Number((dims.lengthM + delta).toFixed(2))),
              direction: lengthDir
            })
          }
        />
      </div>
    </div>
  );
};
