/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: MainMenuModal.tsx
 * Menú Principal Desplegable / Drawer (Contexto de Gestión y Archivo).
 * Agrupa operaciones globales evitando ruido visual sobre el lienzo CAD.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { downloadProjectJson, parseProjectJson } from '../../../services/projectBackupService';
import {
  FolderPlus,
  Save,
  FolderOpen,
  Share2,
  Settings,
  X,
  Building2,
  Zap,
  ChevronRight,
  FileImage,
  Ruler,
  Trash2,
  Layers,
  Sliders,
  Filter
} from 'lucide-react';

interface MainMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenComputo: () => void;
  onOpenCircuits?: () => void;
  onOpenElectricalReport?: () => void;
  onOpenBatchSelect?: () => void;
  hasUnderlay?: boolean;
  onLoadUnderlay?: (file: File) => void;
  onStartUnderlayCalibration?: () => void;
  onOpenAdjustUnderlay?: () => void;
  onRemoveUnderlay?: () => void;
}

export const MainMenuModal: React.FC<MainMenuModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenExport,
  onOpenComputo,
  onOpenCircuits,
  onOpenElectricalReport,
  onOpenBatchSelect,
  hasUnderlay = false,
  onLoadUnderlay,
  onStartUnderlayCalibration,
  onOpenAdjustUnderlay,
  onRemoveUnderlay
}) => {
  const { project, resetProject, loadProject } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const underlayFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleNewProject = () => {
    if (window.confirm('¿Deseas iniciar un nuevo relevamiento? Se reiniciará el plano actual.')) {
      resetProject();
      onClose();
    }
  };

  const handleDownloadBackup = () => {
    downloadProjectJson(project);
    onClose();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = parseProjectJson(text);
        loadProject(imported);
        alert('¡Proyecto cargado exitosamente!');
        onClose();
      } catch (err: any) {
        alert(err.message || 'Error al procesar el archivo JSON.');
      }
    };
    reader.readAsText(file);
    // Limpiar input para permitir recargar el mismo archivo
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-2xl shadow-sm">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                {project.meta.name || 'RelevadorBIM'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {project.levels[0]?.name || 'Planta Baja'} · {project.walls.length} muros · {project.electricalElements.length} bocas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo con Opciones Agrupadas */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Input oculto para cargar archivos JSON */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.bim"
            className="hidden"
            onChange={handleImportFile}
          />

          {/* 1. SECCIÓN PROYECTO / ARCHIVO */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              📁 Proyecto y Archivo
            </span>

            <button
              type="button"
              onClick={handleNewProject}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-slate-700 rounded-xl border border-slate-200 shadow-xs">
                  <FolderPlus size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Nuevo Relevamiento</div>
                  <div className="text-[11px] text-slate-500">Comenzar un plano desde cero</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-blue-600 rounded-xl border border-slate-200 shadow-xs">
                  <Save size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Guardar Respaldo (.json)</div>
                  <div className="text-[11px] text-slate-500">Descargar copia completa del proyecto</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-amber-600 rounded-xl border border-slate-200 shadow-xs">
                  <FolderOpen size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Abrir / Cargar Proyecto</div>
                  <div className="text-[11px] text-slate-500">Importar archivo .bim.json guardado</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            {/* Input oculto para cargar lámina de plano (PNG, JPG, PDF) */}
            <input
              ref={underlayFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onLoadUnderlay) {
                  onLoadUnderlay(file);
                  onClose();
                }
                e.target.value = '';
              }}
            />

            {/* Cargar / Cambiar Plano de Fondo */}
            <button
              type="button"
              onClick={() => underlayFileInputRef.current?.click()}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-sky-600 rounded-xl border border-slate-200 shadow-xs">
                  <FileImage size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">
                    {hasUnderlay ? 'Cambiar Plano de Fondo' : 'Cargar Plano de Fondo'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Imagen (PNG, JPG) o PDF para relevar
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            {hasUnderlay && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-2">
                  {onOpenAdjustUnderlay && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdjustUnderlay();
                      }}
                      className="flex-1 py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-xl text-[11px] border border-sky-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sliders size={13} />
                      Rotar / Recortar
                    </button>
                  )}
                  {onStartUnderlayCalibration && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartUnderlayCalibration();
                      }}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-[11px] border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Ruler size={13} />
                      Calibrar (2 clics)
                    </button>
                  )}
                </div>
                {onRemoveUnderlay && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Deseas quitar el plano de fondo de este nivel?')) {
                        onRemoveUnderlay();
                        onClose();
                      }
                    }}
                    className="w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-[11px] border border-red-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    Quitar Plano de Fondo
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. SECCIÓN EXPORTACIONES */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              📤 Salidas Técnicas y Cómputo
            </span>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenExport();
              }}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-emerald-600 rounded-xl border border-slate-200 shadow-xs">
                  <Share2 size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Exportar (CAD DXF / CSV / JSON)</div>
                  <div className="text-[11px] text-slate-500">AutoCAD 2D, planillas y respaldos</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenComputo();
              }}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-amber-600 rounded-xl border border-slate-200 shadow-xs">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Cómputo Métrico IEBA</div>
                  <div className="text-[11px] text-slate-500">Resumen y enlace con Cotizador IEBA</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            {onOpenElectricalReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenElectricalReport();
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white text-blue-600 rounded-xl border border-slate-200 shadow-xs">
                    <Zap size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Memoria y Cuadro de Cargas</div>
                    <div className="text-[11px] text-slate-500">Cálculo electromecánico AEA e impedancias</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* 3. SECCIÓN CONFIGURACIÓN */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              ⚙️ Configuración y Catálogo
            </span>

            {onOpenCircuits && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCircuits();
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white text-blue-600 rounded-xl border border-slate-200 shadow-xs">
                    <Layers size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Circuitos y Tableros</div>
                    <div className="text-[11px] text-slate-500">
                      {project.circuits?.length ?? 0} circuito(s) · {project.panels?.length ?? 1} tablero(s)
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            )}

            {onOpenBatchSelect && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatchSelect();
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white text-indigo-600 rounded-xl border border-slate-200 shadow-xs">
                    <Filter size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Filtro y Edición en Lote</div>
                    <div className="text-[11px] text-slate-500">
                      Selección masiva por circuito, caño o boca
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-slate-700 rounded-xl border border-slate-200 shadow-xs">
                  <Settings size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Configuración de la Obra</div>
                  <div className="text-[11px] text-slate-500">Datos de la obra y catálogo de materiales</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
