/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: projectBackupService.ts
 * Respaldo Completo y Restauración del Proyecto BIM en formato JSON nativo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';

export function exportProjectToJson(project: BuildingProject): string {
  const exportPayload = {
    app: 'RelevadorBIM',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    project
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function downloadProjectJson(project: BuildingProject): void {
  const jsonStr = exportProjectToJson(project);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const sanitizedName = (project.meta.name || 'relevamiento')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizedName}_${new Date().toISOString().slice(0, 10)}.bim.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseProjectJson(jsonStr: string): BuildingProject {
  const parsed = JSON.parse(jsonStr);
  const project = parsed.project || parsed;

  if (!project || !project.meta || !Array.isArray(project.levels) || !Array.isArray(project.walls)) {
    throw new Error('El archivo seleccionado no corresponde a un proyecto válido de RelevadorBIM.');
  }

  return project as BuildingProject;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export const RELEVADOR_BIM_LOCAL_STORAGE_KEY = 'relevadorbim_offline_project_v1';

/**
 * Guarda automáticamente una instantánea del proyecto en localStorage para
 * garantizar resiliencia total y cero pérdida de datos en relevamientos de campo sin conexión.
 */
export function saveProjectToLocalStorage(project: BuildingProject): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const jsonStr = exportProjectToJson(project);
    storage.setItem(RELEVADOR_BIM_LOCAL_STORAGE_KEY, jsonStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recupera el último proyecto guardado en el dispositivo local.
 */
export function loadProjectFromLocalStorage(): BuildingProject | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const item = storage.getItem(RELEVADOR_BIM_LOCAL_STORAGE_KEY);
    if (!item) return null;
    return parseProjectJson(item);
  } catch {
    return null;
  }
}

/**
 * Limpia el proyecto en el almacenamiento local al iniciar un nuevo relevamiento desde cero.
 */
export function clearProjectFromLocalStorage(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(RELEVADOR_BIM_LOCAL_STORAGE_KEY);
  } catch {
    // Ignorar en entornos sin acceso a almacenamiento
  }
}
