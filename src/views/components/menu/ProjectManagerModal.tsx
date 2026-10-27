/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: ProjectManagerModal.tsx
 * Responsabilidad Única (SRP):
 * Gestor multi-obra local: listar, crear, abrir, descargar y eliminar proyectos
 * almacenados en IndexedDB con protección contra desalojo del navegador.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  Plus,
  FolderOpen,
  Download,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  Building,
  ShieldCheck,
  ShieldAlert,
  HardDrive
} from 'lucide-react';
import {
  listProjectsFromIndexedDb,
  deleteProjectFromIndexedDb,
  loadProjectFromIndexedDb,
  requestPersistentStorage,
  isPersistentStorageGranted,
  type StoredProjectSummary
} from '../../../services/projectStorageService';
import { downloadProjectJson } from '../../../services/projectBackupService';
import { useProjectStore } from '../../../viewmodels/useProjectStore';

export interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ isOpen, onClose }) => {
  const { project: activeProject, loadProjectById, createNewProject } = useProjectStore();
  const [projects, setProjects] = useState<StoredProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const refreshList = useCallback(async () => {
    const list = await listProjectsFromIndexedDb();
    setProjects(list);
    const granted = await isPersistentStorageGranted();
    setIsPersisted(granted);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    if (isOpen) {
      listProjectsFromIndexedDb().then((list) => {
        if (!isCancelled) {
          setProjects(list);
          setIsLoading(false);
        }
      });
      isPersistentStorageGranted().then((granted) => {
        if (!isCancelled) setIsPersisted(granted);
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenProject = async (id: string) => {
    if (id === activeProject.meta.id) {
      onClose();
      return;
    }
    const success = await loadProjectById(id);
    if (success) {
      onClose();
    } else {
      alert('No se pudo abrir el proyecto seleccionado.');
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim() || 'Nuevo Relevamiento';
    await createNewProject(name);
    setNewProjectName('');
    setIsCreating(false);
    onClose();
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (id === activeProject.meta.id && projects.length > 1) {
      alert('Para eliminar esta obra, primero debes abrir o crear otra.');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar permanentemente la obra "${name}" de este dispositivo?`)) {
      await deleteProjectFromIndexedDb(id);
      await refreshList();
    }
  };

  const handleDownloadBackup = async (id: string) => {
    const fullProj = await loadProjectFromIndexedDb(id);
    if (fullProj) {
      downloadProjectJson(fullProj);
    }
  };

  const handleRequestPersist = async () => {
    const granted = await requestPersistentStorage();
    setIsPersisted(granted);
    if (granted) {
      alert('Almacenamiento persistente otorgado. Tus proyectos están resguardados contra limpieza automática del navegador.');
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Fecha desconocida';
    return new Date(timestamp).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150 select-none">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <FolderKanban size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Mis Obras y Relevamientos</h2>
              <p className="text-xs text-slate-500">Proyectos almacenados localmente en este dispositivo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Estado de Almacenamiento Persistente */}
        <div className="bg-slate-100/70 px-4 sm:px-5 py-2 border-b border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <HardDrive size={14} className="text-slate-500" />
            <span className="text-slate-600 font-medium">Almacenamiento Local (IndexedDB)</span>
            {isPersisted ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <ShieldCheck size={12} /> Persistente (Protegido)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <ShieldAlert size={12} /> Estándar
              </span>
            )}
          </div>
          {!isPersisted && (
            <button
              type="button"
              onClick={handleRequestPersist}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Proteger datos
            </button>
          )}
        </div>

        {/* Contenido / Lista */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Botón / Formulario de Nueva Obra */}
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100/80 border border-dashed border-blue-300 rounded-2xl font-bold text-sm text-blue-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={18} />
              <span>Crear Nueva Obra / Relevamiento</span>
            </button>
          ) : (
            <form onSubmit={handleCreateNew} className="bg-blue-50/90 p-3.5 rounded-2xl border border-blue-200 space-y-3">
              <span className="text-xs font-bold text-blue-900 block">Nombre del nuevo relevamiento:</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ej: Casa Calle Mitre 450"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  Crear y Abrir
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Listado de Obras */}
          <div className="space-y-2.5">
            {isLoading ? (
              <div className="text-center py-8 text-xs text-slate-400">Cargando proyectos...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No hay obras registradas en este dispositivo.</div>
            ) : (
              projects.map((p) => {
                const isActive = p.id === activeProject.meta.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-blue-50/70 border-blue-400 shadow-sm ring-1 ring-blue-300/50'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Datos de la Obra */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-800 truncate">{p.name}</h3>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                              <CheckCircle2 size={11} /> Activa
                            </span>
                          )}
                        </div>

                        {(p.clientName || p.address) && (
                          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                            <Building size={12} className="shrink-0 text-slate-400" />
                            <span>{[p.clientName, p.address].filter(Boolean).join(' · ')}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            <span>{formatDate(p.updatedAt)}</span>
                          </span>
                          <span>•</span>
                          <span>{p.wallCount} muros</span>
                          <span>•</span>
                          <span>{p.spaceCount} ambientes</span>
                          <span>•</span>
                          <span>{p.electricalElementCount} bocas</span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProject(p.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen size={14} />
                            <span>Abrir</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
                            En edición
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDownloadBackup(p.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Descargar copia JSON de respaldo"
                        >
                          <Download size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProject(p.id, p.name)}
                          disabled={isActive && projects.length === 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Eliminar obra del dispositivo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
