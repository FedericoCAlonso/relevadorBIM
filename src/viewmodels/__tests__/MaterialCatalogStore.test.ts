/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: MaterialCatalogStore.test.ts
 * Verificación de Gestión del Catálogo de Materiales en useProjectStore.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';

describe('Gestión de Catálogo de Materiales en Store (ViewModel layer)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('el proyecto inicial debe contar con el catálogo por defecto inicializado', () => {
    const { project } = useProjectStore.getState();
    expect(project.materialCatalog).toBeDefined();
    expect(project.materialCatalog?.conduitTypes.length).toBeGreaterThan(0);
    expect(project.materialCatalog?.cableTypes.length).toBeGreaterThan(0);
    expect(project.materialCatalog?.boxTypes.length).toBeGreaterThan(0);
  });

  it('debe permitir agregar y eliminar tipos de canalización personalizados', () => {
    const { addConduitType, removeConduitType } = useProjectStore.getState();

    const customConduit = {
      id: 'custom_manguera_azul',
      name: 'Manguera Azul Especial',
      description: 'Manguera para tendidos provisorios',
      defaultSizeMM: 20,
      availableSizes: [{ value: 20, label: '20 mm' }],
      isCustom: true
    };

    addConduitType(customConduit);

    let state = useProjectStore.getState();
    expect(
      state.project.materialCatalog?.conduitTypes.some((c) => c.id === 'custom_manguera_azul')
    ).toBe(true);

    removeConduitType('custom_manguera_azul');

    state = useProjectStore.getState();
    expect(
      state.project.materialCatalog?.conduitTypes.some((c) => c.id === 'custom_manguera_azul')
    ).toBe(false);
  });

  it('debe permitir agregar y eliminar tipos de conductor personalizados', () => {
    const { addCableType, removeCableType } = useProjectStore.getState();

    const customCable = {
      id: 'custom_cable_plomo',
      name: 'Cable Envainado en Plomo',
      description: 'Conductor subterráneo histórico',
      defaultSectionMM2: 4.0,
      availableSectionsMM2: [2.5, 4.0, 6.0],
      isCustom: true
    };

    addCableType(customCable);

    let state = useProjectStore.getState();
    expect(
      state.project.materialCatalog?.cableTypes.some((c) => c.id === 'custom_cable_plomo')
    ).toBe(true);

    removeCableType('custom_cable_plomo');

    state = useProjectStore.getState();
    expect(
      state.project.materialCatalog?.cableTypes.some((c) => c.id === 'custom_cable_plomo')
    ).toBe(false);
  });

  it('debe permitir agregar y eliminar tipos de caja y gabinete personalizados', () => {
    const { addBoxType, removeBoxType } = useProjectStore.getState();

    const customBox = {
      id: 'custom_caja_estanca_ip67',
      name: 'Caja Estanca IP67 150x150',
      category: 'caja_cuadrada' as const,
      materialBase: 'pvc' as const,
      description: 'Caja estanca para intemperie',
      isCustom: true
    };

    addBoxType(customBox);

    let state = useProjectStore.getState();
    expect(
      state.project.materialCatalog?.boxTypes.some((b) => b.id === 'custom_caja_estanca_ip67')
    ).toBe(true);

    removeBoxType('custom_caja_estanca_ip67');

    state = useProjectStore.getState();
    expect(
      state.project.materialCatalog?.boxTypes.some((b) => b.id === 'custom_caja_estanca_ip67')
    ).toBe(false);
  });
});
