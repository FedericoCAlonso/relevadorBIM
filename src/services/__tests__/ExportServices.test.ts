import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../../models/architecture/BuildingProject';
import { exportProjectToDxf } from '../dxfExportService';
import { exportProjectToJson, parseProjectJson } from '../projectBackupService';
import { generarComputoCotizador, exportComputoToCsv } from '../cotizadorBridge';

describe('Servicios de Exportación y Respaldo Técnico', () => {
  const createMockProject = () => {
    const project = createEmptyProject('Obra Test AEA');
    project.meta.clientName = 'Cliente Demo';
    project.meta.address = 'Av. Corrientes 1234';
    project.meta.electricianName = 'Téc. Juan Pérez';

    // Vértices de una habitación 4x3
    project.vertices = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 4, y: 0 },
      { id: 'v3', x: 4, y: 3 },
      { id: 'v4', x: 0, y: 3 }
    ];

    // Muros
    project.walls = [
      { id: 'w1', levelId: project.activeLevelId, startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.7 },
      { id: 'w2', levelId: project.activeLevelId, startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.7 },
      { id: 'w3', levelId: project.activeLevelId, startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.7 },
      { id: 'w4', levelId: project.activeLevelId, startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.7 }
    ];

    // Ambiente
    project.spaces = [
      {
        id: 'sp-1',
        levelId: project.activeLevelId,
        name: 'Estar Comedor',
        category: 'living',
        boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
        wallIds: ['w1', 'w2', 'w3', 'w4'],
        ceilingHeight: 2.7,
        floorElevation: 0,
        color: '#3b82f6'
      }
    ];

    // Bocas eléctricas: un centro de luz y un tomacorriente
    project.electricalElements = [
      {
        id: 'el-1',
        levelId: project.activeLevelId,
        spaceId: 'sp-1',
        symbolId: 'centro-techo-iug',
        placement: 'ceiling',
        x: 2.0,
        y: 1.5,
        heightZ: 2.7,
        circuitId: project.circuits[0]?.id || null,
        status: 'proyectado',
        powerW: 100,
        phases: 1,
        isPanel: false,
        label: 'Centro 1',
        attributes: []
      },
      {
        id: 'el-2',
        levelId: project.activeLevelId,
        spaceId: 'sp-1',
        symbolId: 'toma-doble-tug',
        placement: 'wall',
        x: 4.0,
        y: 1.5,
        heightZ: 0.3,
        circuitId: project.circuits[1]?.id || null,
        status: 'proyectado',
        powerW: 2200,
        phases: 1,
        isPanel: false,
        label: 'Toma 1',
        attributes: []
      }
    ];

    // Cañería uniendo ambas bocas
    project.conduits = [
      {
        id: 'cnd-1',
        fromElementId: 'el-1',
        toElementId: 'el-2',
        fromLevelId: project.activeLevelId,
        toLevelId: project.activeLevelId,
        diameterMM: 19,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        conductors: [
          { role: 'fase', sectionMM2: 2.5, cableStandard: 'IRAM_NM_247_3' },
          { role: 'neutro', sectionMM2: 2.5, cableStandard: 'IRAM_NM_247_3' },
          { role: 'pe', sectionMM2: 2.5, cableStandard: 'IRAM_NM_247_3' }
        ]
      }
    ];

    return project;
  };

  describe('dxfExportService (AutoCAD DXF R12)', () => {
    it('debe generar un archivo DXF válido con encabezado, capas y entidades', () => {
      const project = createMockProject();
      const dxf = exportProjectToDxf(project);

      expect(dxf).toContain('$ACADVER\n1\nAC1009');
      expect(dxf).toContain('SECTION\n2\nTABLES');
      expect(dxf).toContain('ARQ_MUROS');
      expect(dxf).toContain('ARQ_AMBIENTES');
      expect(dxf).toContain('ELEC_BOCAS');
      expect(dxf).toContain('ELEC_CANERIAS');
      expect(dxf).toContain('SECTION\n2\nENTITIES');
      expect(dxf).toContain('LINE');
      expect(dxf).toContain('Estar Comedor');
      expect(dxf).toContain('EOF');
    });

    it('debe invertir la coordenada Y para respetar la convención CAD', () => {
      const project = createMockProject();
      const dxf = exportProjectToDxf(project);

      // Si y=3, en DXF debe figurar -3
      expect(dxf).toContain('-3');
    });
  });

  describe('projectBackupService (JSON nativo)', () => {
    it('debe exportar el proyecto completo con metadatos de versión y restaurarlo sin pérdidas', () => {
      const originalProject = createMockProject();
      const jsonStr = exportProjectToJson(originalProject);

      expect(jsonStr).toContain('"app": "RelevadorBIM"');
      expect(jsonStr).toContain('"version": "1.0.0"');

      const restored = parseProjectJson(jsonStr);
      expect(restored.meta.name).toBe('Obra Test AEA');
      expect(restored.walls.length).toBe(4);
      expect(restored.spaces.length).toBe(1);
      expect(restored.electricalElements.length).toBe(2);
      expect(restored.conduits.length).toBe(1);
    });

    it('debe arrojar error si el archivo JSON no tiene la estructura de un proyecto BIM', () => {
      const invalidJson = JSON.stringify({ algunCampo: 123 });
      expect(() => parseProjectJson(invalidJson)).toThrow(
        'El archivo seleccionado no corresponde a un proyecto válido de RelevadorBIM.'
      );
    });
  });

  describe('cotizadorBridge y exportComputoToCsv', () => {
    it('debe computar superficies, bocas, cañerías y conductores según norma AEA', () => {
      const project = createMockProject();
      const computo = generarComputoCotizador(project);

      expect(computo.proyectoNombre).toBe('Obra Test AEA');
      expect(computo.superficieTotalM2).toBe(12); // 4m * 3m = 12m2
      expect(computo.ambientesComputados.length).toBe(1);
      expect(computo.ambientesComputados[0].nombre).toBe('Estar Comedor');

      // Cañerías: diámetro Ø19 mm
      expect(computo.cañeriasPorDiametro['Ø19 mm']).toBeGreaterThan(0);
      // Conductores: 2.5 mm²
      expect(computo.conductoresPorSeccionM['2.5 mm²']).toBeGreaterThan(0);
    });

    it('debe generar una planilla CSV con secciones normativas AEA', () => {
      const project = createMockProject();
      const computo = generarComputoCotizador(project);
      const csv = exportComputoToCsv(computo);

      expect(csv).toContain('CÓMPUTO MÉTRICO DE INSTALACIÓN ELÉCTRICA (Norma AEA 90364-771)');
      expect(csv).toContain('"Obra Test AEA"');
      expect(csv).toContain('1. BOCAS ELÉCTRICAS');
      expect(csv).toContain('2. CAÑERÍAS Y CANALIZACIONES');
      expect(csv).toContain('3. CONDUCTORES DE COBRE');
      expect(csv).toContain('4. AMBIENTES Y RECINTOS RELEVADOS');
      expect(csv).toContain('"Estar Comedor"');
    });
  });
});
