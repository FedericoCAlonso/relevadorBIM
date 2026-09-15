/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: TopStatusBar.tsx
 * Barra Superior Minimalista (Directiva AGENTS.md / Cero Ruido Contextual).
 * Estructura: [ ☰ Menú ]  RelevadorBIM · Nivel          [ Cotas ]  [ ⛶ ]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { Menu, Maximize, Minimize, Ruler } from 'lucide-react';

interface TopStatusBarProps {
  onOpenMenu: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({ onOpenMenu }) => {
  const { project, showDimensions, toggleDimensions } = useProjectStore();
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

  return (
    <header className="absolute top-3 left-3 right-3 flex items-center justify-between p-2 bg-white/85 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 z-10 text-xs">
      {/* Extremo Izquierdo: Botón Menú Principal + Identificación */}
      <div className="flex items-center gap-2 pl-0.5">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition-all active:scale-95"
          title="Menú principal (Archivo, Exportar, Configuración)"
        >
          <Menu size={16} />
          <span className="hidden sm:inline">Menú</span>
        </button>

        <div className="flex items-center gap-1.5 ml-1">
          <span className="font-bold text-slate-800 tracking-tight">RelevadorBIM</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600 font-medium">
            {project.levels.find((l) => l.id === project.activeLevelId)?.name || 'Planta Baja'}
          </span>
        </div>
      </div>

      {/* Extremo Derecho: Herramientas de visualización de dibujo (Cotas y Pantalla Completa) */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
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
          type="button"
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
