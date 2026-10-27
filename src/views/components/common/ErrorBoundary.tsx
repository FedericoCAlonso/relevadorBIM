/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA / COMPONENTE: ErrorBoundary.tsx
 * Responsabilidad Única (SRP):
 * Captura de excepciones no controladas en el ciclo de vida de React,
 * previniendo el "pantallazo blanco" y proveyendo un mecanismo inmediato de
 * rescate y descarga del proyecto en memoria para cero pérdida de datos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { Component, type ReactNode } from 'react';
import { ShieldAlert, Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { downloadProjectJson } from '../../../services/projectBackupService';
import { saveProjectToIndexedDb } from '../../../services/projectStorageService';
import { useProjectStore } from '../../../viewmodels/useProjectStore';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    // Intenta resguardar preventivamente el estado en IndexedDB y localStorage
    try {
      const currentProject = useProjectStore.getState().project;
      if (currentProject) {
        saveProjectToIndexedDb(currentProject);
      }
    } catch {
      // Ignorar fallo secundario de guardado durante error crítico
    }
  }

  handleDownloadRescueBackup = (): void => {
    try {
      const currentProject = useProjectStore.getState().project;
      if (currentProject) {
        downloadProjectJson(currentProject);
        return;
      }
    } catch {
      // Si falla la lectura del store, intentar desde localStorage
    }

    try {
      const raw = localStorage.getItem('relevadorbim_offline_project_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        const proj = parsed.project || parsed;
        downloadProjectJson(proj);
      }
    } catch {
      alert('No se pudo generar el archivo de respaldo automático.');
    }
  };

  handleReload = (): void => {
    if (this.props.onReset) {
      this.setState({ hasError: false, error: null, errorInfo: null });
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Interrupción Inesperada de la Vista';
      const errorMessage = this.state.error?.message || 'Error desconocido en el motor gráfico';
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 select-none z-50">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera de Alerta */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 p-6 flex items-start gap-4">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Se detectó un fallo imprevisto en la representación visual.
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    Tus datos de relevamiento están protegidos en memoria y en el almacenamiento local.
                  </span>
                </p>
              </div>
            </div>

            {/* Acciones de Rescate */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={this.handleDownloadRescueBackup}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={18} />
                  <span>Descargar Respaldo de Rescate (.bim.json)</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={15} />
                  <span>Reiniciar Aplicación</span>
                </button>
              </div>

              {/* Acordeón de Detalles Técnicos */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-500 hover:text-slate-800 py-1 cursor-pointer"
                >
                  <span>Detalles técnicos del incidente</span>
                  {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 bg-slate-950 text-slate-300 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800 space-y-1">
                    <p className="text-amber-400 font-bold">{errorMessage}</p>
                    <pre className="whitespace-pre-wrap text-slate-400">{stack}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
