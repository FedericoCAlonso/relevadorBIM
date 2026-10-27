/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: projectStorageService.ts
 * Responsabilidad Única (SRP):
 * Persistencia persistente y resiliente en IndexedDB con soporte multi-proyecto,
 * cuota ilimitada para láminas de fondo pesadas (Underlay) y preservación
 * de almacenamiento de campo (navigator.storage.persist).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';
import {
  saveProjectToLocalStorage,
  loadProjectFromLocalStorage
} from './projectBackupService';

export const DB_NAME = 'RelevadorBimDB';
export const DB_VERSION = 1;
export const PROJECTS_STORE = 'projects';
export const APP_STATE_STORE = 'app_state';
export const ACTIVE_PROJECT_KEY = 'active_project_id';

export interface StoredProjectSummary {
  id: string;
  name: string;
  clientName?: string;
  address?: string;
  updatedAt: number;
  levelCount: number;
  wallCount: number;
  spaceCount: number;
  electricalElementCount: number;
}

/**
 * Obtiene la referencia al motor IndexedDB disponible en el entorno.
 */
function getIdb(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB) {
    return (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB;
  }
  return null;
}

/**
 * Abre o inicializa la base de datos IndexedDB de RelevadorBIM.
 */
export function openProjectDatabase(): Promise<IDBDatabase | null> {
  const idb = getIdb();
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'meta.id' });
        }
        if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
          db.createObjectStore(APP_STATE_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir la base de datos IndexedDB'));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Guarda un proyecto íntegro en IndexedDB con soporte para múltiples obras.
 * También actualiza localStorage como caché sincronizado rápido.
 */
export async function saveProjectToIndexedDb(project: BuildingProject): Promise<boolean> {
  if (!project || !project.meta || !project.meta.id) return false;

  // Intenta siempre mantener el espejo síncrono rápido en localStorage
  saveProjectToLocalStorage(project);

  try {
    const db = await openProjectDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction([PROJECTS_STORE, APP_STATE_STORE], 'readwrite');
      const projectsStore = tx.objectStore(PROJECTS_STORE);
      const appStateStore = tx.objectStore(APP_STATE_STORE);

      const projectToSave: BuildingProject = {
        ...project,
        meta: {
          ...project.meta,
          updatedAt: Date.now()
        }
      };

      projectsStore.put(projectToSave);
      appStateStore.put({ key: ACTIVE_PROJECT_KEY, value: project.meta.id });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Carga un proyecto de IndexedDB por su identificador único.
 * Si no se especifica ID, intenta cargar el proyecto activo actual.
 */
export async function loadProjectFromIndexedDb(id?: string): Promise<BuildingProject | null> {
  try {
    const db = await openProjectDatabase();
    if (!db) {
      return loadProjectFromLocalStorage();
    }

    let targetId = id;
    if (!targetId) {
      targetId = (await getActiveProjectIdFromIndexedDb()) ?? undefined;
    }

    if (!targetId) {
      return loadProjectFromLocalStorage();
    }

    return new Promise((resolve) => {
      const tx = db.transaction(PROJECTS_STORE, 'readonly');
      const store = tx.objectStore(PROJECTS_STORE);
      const req = store.get(targetId!);

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as BuildingProject);
        } else {
          // Fallback a localStorage si aún no migró a IndexedDB
          resolve(loadProjectFromLocalStorage());
        }
      };
      req.onerror = () => resolve(loadProjectFromLocalStorage());
    });
  } catch {
    return loadProjectFromLocalStorage();
  }
}

/**
 * Retorna la lista resumida de todas las obras y relevamientos almacenados localmente.
 */
export async function listProjectsFromIndexedDb(): Promise<StoredProjectSummary[]> {
  try {
    const db = await openProjectDatabase();
    if (!db) {
      const fallback = loadProjectFromLocalStorage();
      if (!fallback) return [];
      return [
        {
          id: fallback.meta.id,
          name: fallback.meta.name || 'Relevamiento Actual',
          clientName: fallback.meta.clientName,
          address: fallback.meta.address,
          updatedAt: fallback.meta.updatedAt || Date.now(),
          levelCount: fallback.levels?.length || 1,
          wallCount: fallback.walls?.length || 0,
          spaceCount: fallback.spaces?.length || 0,
          electricalElementCount: fallback.electricalElements?.length || 0
        }
      ];
    }

    return new Promise((resolve) => {
      const tx = db.transaction(PROJECTS_STORE, 'readonly');
      const store = tx.objectStore(PROJECTS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result as BuildingProject[]) || [];
        const summaries: StoredProjectSummary[] = list.map((p) => ({
          id: p.meta.id,
          name: p.meta.name || 'Sin título',
          clientName: p.meta.clientName,
          address: p.meta.address,
          updatedAt: p.meta.updatedAt || p.meta.createdAt || Date.now(),
          levelCount: p.levels?.length || 1,
          wallCount: p.walls?.length || 0,
          spaceCount: p.spaces?.length || 0,
          electricalElementCount: p.electricalElements?.length || 0
        })).sort((a, b) => b.updatedAt - a.updatedAt);

        resolve(summaries);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Elimina un proyecto específico de la base de datos local.
 */
export async function deleteProjectFromIndexedDb(id: string): Promise<boolean> {
  try {
    const db = await openProjectDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction([PROJECTS_STORE, APP_STATE_STORE], 'readwrite');
      const store = tx.objectStore(PROJECTS_STORE);
      const appStateStore = tx.objectStore(APP_STATE_STORE);

      store.delete(id);

      // Si se borró el activo, limpiar puntero
      const getReq = appStateStore.get(ACTIVE_PROJECT_KEY);
      getReq.onsuccess = () => {
        if (getReq.result?.value === id) {
          appStateStore.delete(ACTIVE_PROJECT_KEY);
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Obtiene el ID del proyecto actualmente activo.
 */
export async function getActiveProjectIdFromIndexedDb(): Promise<string | null> {
  try {
    const db = await openProjectDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(APP_STATE_STORE, 'readonly');
      const store = tx.objectStore(APP_STATE_STORE);
      const req = store.get(ACTIVE_PROJECT_KEY);

      req.onsuccess = () => {
        resolve(req.result ? (req.result.value as string) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Establece el proyecto activo en la base de datos.
 */
export async function setActiveProjectIdInIndexedDb(id: string): Promise<boolean> {
  try {
    const db = await openProjectDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(APP_STATE_STORE, 'readwrite');
      const store = tx.objectStore(APP_STATE_STORE);
      store.put({ key: ACTIVE_PROJECT_KEY, value: id });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Solicita al navegador otorgar almacenamiento persistente (Persistent Storage API)
 * para evitar que los datos de obra sean desalojados por falta de espacio en disco.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Consulta si el almacenamiento persistente ya fue otorgado por el navegador.
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}
