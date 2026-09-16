/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: CircuitColorPicker.tsx (Patrón Estricto MVVM)
 * Selector de color para circuitos eléctricos en plano CAD.
 * Consume la paleta centralizada en el Modelo y permite personalización libre.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef } from 'react';
import { CIRCUIT_COLOR_PALETTE } from '../../../models/electrical/electricalStandards';
import { Pipette } from 'lucide-react';

interface CircuitColorPickerProps {
  selectedColor?: string;
  onChangeColor: (color: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const CircuitColorPicker: React.FC<CircuitColorPickerProps> = ({
  selectedColor = '#2563eb',
  onChangeColor,
  className = '',
  size = 'md'
}) => {
  const nativeColorInputRef = useRef<HTMLInputElement>(null);

  const buttonSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  const isCustomColor = !CIRCUIT_COLOR_PALETTE.some(
    (p) => p.hex.toLowerCase() === selectedColor.toLowerCase()
  );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {CIRCUIT_COLOR_PALETTE.map((preset) => {
        const isSelected = selectedColor.toLowerCase() === preset.hex.toLowerCase();
        return (
          <button
            key={preset.hex}
            type="button"
            onClick={() => onChangeColor(preset.hex)}
            className={`${buttonSize} rounded-full transition-transform border-2 cursor-pointer ${
              isSelected
                ? 'scale-110 border-slate-900 ring-2 ring-blue-300 shadow-sm'
                : 'border-white hover:scale-105 shadow-xs'
            }`}
            style={{ backgroundColor: preset.hex }}
            title={preset.label}
          />
        );
      })}

      {/* Selector de color libre nativo */}
      <div className="relative">
        <input
          ref={nativeColorInputRef}
          type="color"
          value={selectedColor}
          onChange={(e) => onChangeColor(e.target.value)}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => nativeColorInputRef.current?.click()}
          className={`${buttonSize} rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
            isCustomColor
              ? 'scale-110 border-slate-900 ring-2 ring-blue-300 shadow-sm'
              : 'border-slate-300 hover:border-slate-500 bg-slate-100 text-slate-500 hover:text-slate-800'
          }`}
          style={isCustomColor ? { backgroundColor: selectedColor } : undefined}
          title="Elegir color personalizado..."
        >
          <Pipette size={size === 'sm' ? 10 : 12} className={isCustomColor ? 'text-white' : ''} />
        </button>
      </div>
    </div>
  );
};
