import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../../models/architecture/BuildingProject';
import {
  extractDetailedMaterialItems,
  exportProjectToFlexibleCsv
} from '../materialExportService';

describe('MaterialExportService (Cómputo Flexible CSV)', () => {
  const createMockProject = () => {
    const project = createEmptyProject('Residencia Belgrano');
    project.vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 3 },
      { id: 'v4', x: 0, y: 3 }
    ];
    project.walls = [
      { id: 'w1', levelId: project.activeLevelId, startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.7 },
      { id: 'w2', levelId: project.activeLevelId, startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.7 },
      { id: 'w3', levelId: project.activeLevelId, startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.7 },
      { id: 'w4', levelId: project.activeLevelId, startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.7 }
    ];
    project.spaces = [
      {
        id: 'sp-1',
        levelId: project.activeLevelId,
        name: 'Cocina Comedor',
        category: 'cocina',
        boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
        wallIds: ['w1', 'w2', 'w3', 'w4'],
        ceilingHeight: 2.7,
        floorElevation: 0,
        color: '#3b82f6'
      }
    ];

    project.electricalElements = [
      {
        id: 'el-1',
        levelId: project.activeLevelId,
        spaceId: 'sp-1',
        symbolId: 'sym-boca-techo-centro',
        placement: 'ceiling',
        x: 2.0,
        y: 1.5,
        heightZ: 2.7,
        circuitId: project.circuits[0]?.id || null,
        status: 'proyectado',
        powerW: 100,
        phases: 1,
        isPanel: false,
        label: 'B1',
        attributes: [{ key: 'PAT', value: '3.2 ohm' }]
      },
      {
        id: 'el-2',
        levelId: project.activeLevelId,
        spaceId: 'sp-1',
        symbolId: 'sym-toma-corriente-doble',
        placement: 'wall',
        x: 0.0,
        y: 1.5,
        heightZ: 1.2,
        circuitId: project.circuits[0]?.id || null,
        status: 'existente',
        powerW: 2200,
        phases: 1,
        isPanel: false,
        label: 'T1',
        attributes: [{ key: 'Vfn', value: '224V' }]
      }
    ];

    project.conduits = [
      {
        id: 'c-1',
        fromElementId: 'el-1',
        toElementId: 'el-2',
        fromLevelId: project.activeLevelId,
        toLevelId: project.activeLevelId,
        isVerticalRiser: false,
        circuitId: project.circuits[0]?.id || null,
        diameterMM: 19,
        material: 'hierro_semipesado_rs',
        routingPlane: 'ceiling_slab',
        status: 'proyectado',
        conductors: [
          { role: 'fase', sectionMM2: 2.5, color: '#8B4513' },
          { role: 'neutro', sectionMM2: 2.5, color: '#1E90FF' },
          { role: 'pe', sectionMM2: 2.5, color: '#32CD32' }
        ]
      }
    ];

    return project;
  };

  it('debe extraer todos los ítems de materiales unitarios desglosados', () => {
    const project = createMockProject();
    const items = extractDetailedMaterialItems(project);

    expect(items.length).toBeGreaterThanOrEqual(5); // 1 caño, 3 conductores, 2 bocas, 1 tablero
    const conduitItem = items.find((i) => i.category === 'Canalización');
    expect(conduitItem).toBeDefined();
    expect(conduitItem!.material).toContain('Hierro');
    expect(conduitItem!.sizeOrSection).toBe('Ø19 mm');
    expect(conduitItem!.routingPlane).toContain('Losa');

    const conductorItems = items.filter((i) => i.category === 'Conductor');
    expect(conductorItems.length).toBe(3);
    expect(conductorItems[0].sizeOrSection).toBe('2.5 mm²');

    const boxItems = items.filter((i) => i.category === 'Caja / Boca');
    expect(boxItems.length).toBe(2);
    expect(boxItems.find((b) => b.material.includes('Octogonal'))).toBeDefined();
    expect(boxItems.find((b) => b.material.includes('Rectangular'))).toBeDefined();
  });

  it('debe generar una tabla plana CSV (Flat Database para Excel) con delimitador de punto y coma', () => {
    const project = createMockProject();
    const csv = exportProjectToFlexibleCsv(project, { format: 'flat_database', delimiter: ';' });

    expect(csv).toContain('"Nivel";"Ambiente";"Tablero";"Circuito";"Categoria"');
    expect(csv).toContain('"Cocina Comedor"');
    expect(csv).toContain('"Canalización"');
    expect(csv).toContain('Hierro Semipesado RS');
    expect(csv).toContain('"2.5 mm²"');
    expect(csv).toContain('"PAT=3.2 ohm"');
  });

  it('debe generar un cómputo comercial agrupado por capítulos para distribuidoras', () => {
    const project = createMockProject();
    const csv = exportProjectToFlexibleCsv(project, { format: 'commercial', delimiter: ';' });

    expect(csv).toContain('CÓMPUTO MÉTRICO DE MATERIALES ELÉCTRICOS');
    expect(csv).toContain('1. CANALIZACIONES Y CAÑERÍAS');
    expect(csv).toContain('2. CONDUCTORES Y CABLES DE COBRE');
    expect(csv).toContain('3. CAJAS FÍSICAS Y BOCAS DE SALIDA');
    expect(csv).toContain('5. MEDICIONES DE CAMPO Y ENSAYOS RELEVADOS');
    expect(csv).toContain('"PAT=3.2 ohm"');
  });

  it('debe filtrar por estado (proyectado / existente / a_reemplazar)', () => {
    const project = createMockProject();
    const itemsExistente = extractDetailedMaterialItems(project, { statusFilter: ['existente'] });
    const itemsProyectado = extractDetailedMaterialItems(project, { statusFilter: ['proyectado'] });

    expect(itemsExistente.some((i) => i.id === 'el-2')).toBe(true);
    expect(itemsExistente.some((i) => i.id === 'el-1')).toBe(false);

    expect(itemsProyectado.some((i) => i.id === 'el-1')).toBe(true);
    expect(itemsProyectado.some((i) => i.id === 'el-2')).toBe(false);
  });
});
