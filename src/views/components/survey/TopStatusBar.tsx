/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: TopStatusBar.tsx
 * Barra Superior Pasiva (Zona Difícil / Lectura en Móvil).
 * Muestra nombre del proyecto, nivel activo y acceso al cómputo IEBA.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { Zap, RotateCcw, Building2 } from 'lucide-react';

interface TopStatusBarProps {
  onViewComputoClick: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({ onViewComputoClick }) => {
  const { project, resetProject } = useProjectStore();

  const handleReset = () => {
    if (window.confirm('¿Reiniciar plano actual?')) {
      resetProject();
    }
  };

  return (
    <header className="absolute top-3 left-3 right-3 flex items-center justify-between p-2 bg-white/85 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 z-10 text-xs">
      <div className="flex items-center gap-2 pl-1">
        <div className="p-1.5 bg-blue-600 text-white rounded-lg">
          <Building2 size={16} />
        </div>
        <div>
          <span className="font-bold text-slate-800">RelevadorBIM</span>
          <span className="text-slate-400 mx-1.5">·</span>
          <span className="text-slate-600 font-medium">{project.levels[0]?.name || 'Planta Baja'}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onViewComputoClick}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-semibold transition-colors"
        >
          <Zap size={14} className="text-amber-600" />
          <span>Cotizador</span>
        </button>

        <button
          onClick={handleReset}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          title="Reiniciar plano"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </header>
  );
};
