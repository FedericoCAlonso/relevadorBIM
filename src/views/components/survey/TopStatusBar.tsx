/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: TopStatusBar.tsx
 * Barra Superior Minimalista (Directiva AGENTS.md / Cero Ruido Contextual).
 * Estructura: [ ☰ Menú ]  RelevadorBIM · Nivel               [ ⛶ ]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { Menu, Maximize, Minimize, Filter } from 'lucide-react';

interface TopStatusBarProps {
  onOpenMenu: () => void;
  onOpenBatchSelect?: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({ onOpenMenu, onOpenBatchSelect }) => {
  const { project, labelDisplayMode, setLabelDisplayMode, selectedEntities } = useProjectStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cycleLabelMode = () => {
    if (labelDisplayMode === 'full') setLabelDisplayMode('circuit_element');
    else if (labelDisplayMode === 'circuit_element') setLabelDisplayMode('element_only');
    else setLabelDisplayMode('full');
  };

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
    <header className="absolute top-3 left-3 right-3 flex items-center justify-between p-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 z-10 text-xs">
      {/* Extremo Izquierdo: Botón Menú Principal + Identificación */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-0.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition-all active:scale-95 shrink-0"
          title="Menú principal (Archivo, Exportar, Configuración)"
        >
          <Menu size={16} />
          <span className="hidden sm:inline">Menú</span>
        </button>

        <div className="flex items-center gap-1 sm:gap-1.5 ml-0.5 min-w-0 truncate">
          <span className="font-bold text-slate-800 tracking-tight shrink-0">
            <span className="hidden sm:inline">RelevadorBIM</span>
            <span className="sm:hidden">BIM</span>
          </span>
          <span className="text-slate-400 shrink-0">·</span>
          <span className="text-slate-600 font-medium truncate text-[11px] sm:text-xs">
            {project.levels.find((l) => l.id === project.activeLevelId)?.name || 'Planta'}
          </span>
        </div>
      </div>

      {/* Extremo Derecho: Herramientas de visualización de dibujo (Cotas y Pantalla Completa) */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Selector de Rótulo de Bocas (1 Toque) */}
        <button
          type="button"
          onClick={cycleLabelMode}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold transition-colors cursor-pointer"
          title={`Formato de etiquetas en plano: ${
            labelDisplayMode === 'full'
              ? 'Completo (Tablero_Circuito_Boca)'
              : labelDisplayMode === 'circuit_element'
              ? 'Circuito y Boca (C1_B1)'
              : 'Solo Boca (B1)'
          }. Toca para cambiar.`}
        >
          <span className="text-[10px]">🏷️</span>
          <span className="hidden sm:inline">
            {labelDisplayMode === 'full' ? 'TP_C1_B1' : labelDisplayMode === 'circuit_element' ? 'C1_B1' : 'B1'}
          </span>
          <span className="sm:hidden text-[10px]">
            {labelDisplayMode === 'full' ? 'C1_B1' : labelDisplayMode === 'circuit_element' ? 'B1' : '🏷️'}
          </span>
        </button>

        {/* Botón de Filtro / Selección por Lote */}
        {onOpenBatchSelect && (
          <button
            type="button"
            onClick={onOpenBatchSelect}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              selectedEntities.length > 0
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Seleccionar por Filtro o Criterio (Circuito, Caño, Boca, Estado)"
          >
            <Filter size={13} className={selectedEntities.length > 0 ? 'text-indigo-600' : 'text-slate-500'} />
            {selectedEntities.length > 0 && (
              <span className="font-bold text-[10px] sm:text-[11px] text-indigo-700">
                {selectedEntities.length}
              </span>
            )}
            <span className="hidden sm:inline">
              {selectedEntities.length > 0 ? `Lote` : 'Filtro'}
            </span>
          </button>
        )}

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
