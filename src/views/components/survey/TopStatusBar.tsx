/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: TopStatusBar.tsx
 * Barra Superior Pasiva (Zona Difícil / Lectura en Móvil).
 * Muestra nombre del proyecto, nivel activo y acceso al cómputo IEBA.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { Zap, RotateCcw, Building2, Maximize, Minimize, Ruler } from 'lucide-react';

interface TopStatusBarProps {
  onViewComputoClick: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({ onViewComputoClick }) => {
  const { project, resetProject, showDimensions, toggleDimensions } = useProjectStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
      } catch (err) {
        console.warn('No se pudo activar pantalla completa:', err);
      }
    } else {
      try {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch (err) {
        console.warn('No se pudo salir de pantalla completa:', err);
      }
    }
  };

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
          onClick={toggleDimensions}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
            showDimensions
              ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
          }`}
          title={showDimensions ? 'Ocultar cotas métricas' : 'Mostrar cotas métricas'}
        >
          <Ruler size={14} className={showDimensions ? 'text-blue-600' : 'text-slate-400'} />
          <span className="hidden sm:inline">Cotas</span>
        </button>

        <button
          onClick={handleReset}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          title="Reiniciar plano"
        >
          <RotateCcw size={15} />
        </button>

        <button
          onClick={toggleFullscreen}
          className={`p-1.5 rounded-lg transition-colors ${
            isFullscreen ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (ocultar barras del navegador)'}
        >
          {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
      </div>
    </header>
  );
};
