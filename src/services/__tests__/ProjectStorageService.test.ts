/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRUEBAS UNITARIAS: ProjectStorageService.test.ts
 * Cobertura de persistencia en IndexedDB, multi-proyecto y almacenamiento offline.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEmptyProject } from '../../models/architecture/BuildingProject';
import {
  saveProjectToIndexedDb,
  loadProjectFromIndexedDb,
  listProjectsFromIndexedDb,
  deleteProjectFromIndexedDb,
  getActiveProjectIdFromIndexedDb,
  setActiveProjectIdInIndexedDb,
  requestPersistentStorage,
  isPersistentStorageGranted,
  PROJECTS_STORE,
  APP_STATE_STORE
} from '../projectStorageService';

/**
 * Mock en memoria de IndexedDB para entorno de pruebas Node/Vitest
 */
class MockIDBObjectStore {
  public name: string;
  public data = new Map<string, unknown>();

  constructor(name: string) {
    this.name = name;
  }

  put(value: unknown) {
    const val = value as Record<string, unknown>;
    let key: string;
    if (this.name === PROJECTS_STORE) {
      key = (val.meta as { id: string }).id;
    } else {
      key = val.key as string;
    }
    this.data.set(key, value);
    const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }

  get(key: string) {
    const req = {
      result: this.data.get(key) ?? null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null
    };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }

  getAll() {
    const req = {
      result: Array.from(this.data.values()),
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null
    };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }

  delete(key: string) {
    this.data.delete(key);
    const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }
}

class MockIDBDatabase {
  public objectStores = new Map<string, MockIDBObjectStore>();
  public objectStoreNames = {
    contains: (name: string) => this.objectStores.has(name)
  };

  createObjectStore(name: string) {
    const store = new MockIDBObjectStore(name);
    this.objectStores.set(name, store);
    return store;
  }

  transaction(_storeNames: string | string[]) {
    const tx = {
      objectStore: (name: string) => this.objectStores.get(name)!,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null
    };
    setTimeout(() => tx.oncomplete?.(), 5);
    return tx;
  }
}

function setupMockIndexedDb() {
  const db = new MockIDBDatabase();
  db.createObjectStore(PROJECTS_STORE);
  db.createObjectStore(APP_STATE_STORE);

  const mockFactory = {
    open: vi.fn().mockImplementation(() => {
      const req = {
        result: db,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null
      };
      setTimeout(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    })
  };

  (globalThis as unknown as { indexedDB: unknown }).indexedDB = mockFactory;
  return db;
}

describe('Servicio de Almacenamiento IndexedDB y Multi-Proyecto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('debe guardar y recuperar un proyecto íntegro en IndexedDB', async () => {
    setupMockIndexedDb();
    const project = createEmptyProject('Obra Belgrano');
    project.meta.id = 'proj-belgrano-1';
    project.meta.clientName = 'Martín Fierro';

    const saved = await saveProjectToIndexedDb(project);
    expect(saved).toBe(true);

    const loaded = await loadProjectFromIndexedDb('proj-belgrano-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.meta.name).toBe('Obra Belgrano');
    expect(loaded?.meta.clientName).toBe('Martín Fierro');
  });

  it('debe listar todas las obras almacenadas ordenadas por última modificación', async () => {
    setupMockIndexedDb();
    const p1 = createEmptyProject('Obra A');
    p1.meta.id = 'proj-a';
    p1.meta.updatedAt = 1000;

    const p2 = createEmptyProject('Obra B');
    p2.meta.id = 'proj-b';
    p2.meta.updatedAt = 2000;

    await saveProjectToIndexedDb(p1);
    await saveProjectToIndexedDb(p2);

    const list = await listProjectsFromIndexedDb();
    expect(list.length).toBe(2);
    // Orden descendente por updatedAt
    expect(list[0].id).toBe('proj-b');
    expect(list[1].id).toBe('proj-a');
  });

  it('debe gestionar el puntero de proyecto activo', async () => {
    setupMockIndexedDb();
    await setActiveProjectIdInIndexedDb('proj-test-active');
    const activeId = await getActiveProjectIdFromIndexedDb();
    expect(activeId).toBe('proj-test-active');
  });

  it('debe eliminar un proyecto de la base de datos', async () => {
    setupMockIndexedDb();
    const p = createEmptyProject('Obra a Borrar');
    p.meta.id = 'proj-delete';
    await saveProjectToIndexedDb(p);

    const beforeDelete = await loadProjectFromIndexedDb('proj-delete');
    expect(beforeDelete).not.toBeNull();

    const deleted = await deleteProjectFromIndexedDb('proj-delete');
    expect(deleted).toBe(true);

    const afterDelete = await loadProjectFromIndexedDb('proj-delete');
    expect(afterDelete).toBeNull();
  });

  it('debe consultar y solicitar almacenamiento persistente', async () => {
    const mockStorage = {
      persist: vi.fn().mockResolvedValue(true),
      persisted: vi.fn().mockResolvedValue(true)
    };
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: mockStorage,
      configurable: true,
      writable: true
    });

    const isGranted = await isPersistentStorageGranted();
    expect(isGranted).toBe(true);

    const requested = await requestPersistentStorage();
    expect(requested).toBe(true);
    expect(mockStorage.persist).toHaveBeenCalled();
  });
});
