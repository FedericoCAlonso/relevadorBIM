/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: SymbolPalette.tsx
 * Paleta de Símbolos Electromecánicos según Norma AEA 90364.
 * Permite seleccionar bocas y colocarlas con un tap en el plano o centro de ambiente.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { SYMBOL_CATEGORIES, getSymbolsByCategory } from '../../../models/electrical/symbolsLib';
import { AeaSymbolIcon } from './AeaSymbolIcon';
import { Zap } from 'lucide-react';

interface SymbolPaletteProps {
  selectedSymbolId: string | null;
  onSelectSymbol: (symbolId: string | null) => void;
  isConnectingConduit: boolean;
  onToggleConnectConduit: () => void;
}

export const SymbolPalette: React.FC<SymbolPaletteProps> = ({
  selectedSymbolId,
  onSelectSymbol,
  isConnectingConduit,
  onToggleConnectConduit
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('iluminacion');
  const symbols = getSymbolsByCategory(activeCategory);

  return (
    <nav aria-label="Paleta Electromecánica" className="absolute bottom-6 right-4 flex flex-col items-end gap-2 z-10">
      {/* Botón para Trazado de Cañería */}
      <button
        onClick={onToggleConnectConduit}
        className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg border text-xs font-semibold transition-all ${
          isConnectingConduit
            ? 'bg-amber-600 border-amber-700 text-white animate-pulse'
            : 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Zap size={16} className={isConnectingConduit ? 'text-white' : 'text-amber-600'} />
        <span>{isConnectingConduit ? 'Tocá 2 bocas para unir caño' : 'Trazar Cañería'}</span>
      </button>

      {/* Contenedor de la Paleta */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-2.5 max-w-xs w-72">
        {/* Selector de Categorías */}
        <div className="flex gap-1 overflow-x-auto pb-1.5 mb-2 border-b border-slate-100 scrollbar-none">
          {SYMBOL_CATEGORIES.slice(0, 4).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grilla de Símbolos */}
        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-0.5">
          {symbols.map((sym) => {
            const isSelected = selectedSymbolId === sym.id;
            return (
              <button
                key={sym.id}
                onClick={() => onSelectSymbol(isSelected ? null : sym.id)}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-blue-50 border-blue-500 shadow-sm'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100'
                }`}
                title={sym.label}
              >
                <AeaSymbolIcon
                  symbolId={sym.id}
                  size={28}
                  color={isSelected ? '#2563eb' : '#334155'}
                  isSelected={isSelected}
                />
                <span className="text-[9px] font-medium text-slate-600 mt-1 truncate w-full">
                  {sym.label}
                </span>
              </button>
            );
          })}
        </div>

        {selectedSymbolId && (
          <div className="mt-2 p-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 text-center font-medium">
            Tocá el plano para insertar la boca seleccionada
          </div>
        )}
      </div>
    </nav>
  );
};
