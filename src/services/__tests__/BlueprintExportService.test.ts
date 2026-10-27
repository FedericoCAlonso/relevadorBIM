import { describe, it, expect } from 'vitest';
import {
  computeBlueprintViewBox,
  calculateBlueprintAeaMetrics,
  formatBlueprintDate
} from '../blueprintExportService';
import type { BuildingProject } from '../../models/architecture/BuildingProject';

describe('BlueprintExportService — Generador de Láminas Técnicas de Obra e Impresión AEA', () => {
  const mockProject: BuildingProject = {
    meta: {
      id: 'proj-1',
      name: 'Vivienda Unifamiliar Martínez',
      clientName: 'Juan Martínez',
      address: 'Av. Libertador 1200',
      electricianName: 'Ing. Carlos Rossi',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scale: 50
    },
    activeLevelId: 'lvl-1',
    levels: [
      {
        id: 'lvl-1',
        name: 'Planta Baja',
        elevationZ: 0,
        floorToFloorHeight: 2.8,
        slabThickness: 0.2,
        order: 0
      }
    ],
    vertices: [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 6, y: 0 },
      { id: 'v3', x: 6, y: 5 },
      { id: 'v4', x: 0, y: 5 }
    ],
    walls: [
      { id: 'w1', levelId: 'lvl-1', startVertexId: 'v1', endVertexId: 'v2', thickness: 0.15, height: 2.8 },
      { id: 'w2', levelId: 'lvl-1', startVertexId: 'v2', endVertexId: 'v3', thickness: 0.15, height: 2.8 },
      { id: 'w3', levelId: 'lvl-1', startVertexId: 'v3', endVertexId: 'v4', thickness: 0.15, height: 2.8 },
      { id: 'w4', levelId: 'lvl-1', startVertexId: 'v4', endVertexId: 'v1', thickness: 0.15, height: 2.8 }
    ],
    openings: [
      {
        id: 'op1',
        wallId: 'w1',
        type: 'door',
        width: 0.8,
        height: 2.05,
        sill: 0,
        distanceAlongWall: 1.5,
        swing: 'left_in'
      }
    ],
    spaces: [
      {
        id: 'sp1',
        levelId: 'lvl-1',
        name: 'Estar Comedor',
        wallIds: ['w1', 'w2', 'w3', 'w4'],
        boundaryVertexIds: ['v1', 'v2', 'v3', 'v4'],
        coverType: 'cubierto',
        category: 'living',
        ceilingHeight: 2.8,
        floorElevation: 0
      }
    ],
    verticalPortals: [],
    panels: [
      {
        id: 'el-tp',
        name: 'TP',
        levelId: 'lvl-1',
        spaceId: 'sp1',
        x: 0.5,
        y: 0.1,
        heightZ: 1.5,
        type: 'principal',
        symbolId: 'sym-planta-tablero-principal',
        incomings: []
      }
    ],
    electricalElements: [
      {
        id: 'el-boca1',
        levelId: 'lvl-1',
        spaceId: 'sp1',
        symbolId: 'sym-planta-centro-techo',
        placement: 'ceiling',
        x: 3.0,
        y: 2.5,
        heightZ: 2.6,
        label: 'B1',
        circuitId: 'c1'
      },
      {
        id: 'el-toma1',
        levelId: 'lvl-1',
        spaceId: 'sp1',
        symbolId: 'sym-planta-toma-simple',
        placement: 'wall',
        x: 1.0,
        y: 0.1,
        heightZ: 0.3,
        label: 'T1',
        circuitId: 'c2'
      }
    ],
    circuits: [
      {
        id: 'c1',
        panelId: 'el-tp',
        name: 'C1 - Iluminación',
        type: 'IUG',
        voltageV: 220,
        wireSectionBaseMM2: 1.5,
        breakerAmperageA: 10,
        phases: 1
      },
      {
        id: 'c2',
        panelId: 'el-tp',
        name: 'C2 - Tomacorrientes',
        type: 'TUG',
        voltageV: 220,
        wireSectionBaseMM2: 2.5,
        breakerAmperageA: 16,
        phases: 1
      }
    ],
    conduits: [
      {
        id: 'cond1',
        fromLevelId: 'lvl-1',
        toLevelId: 'lvl-1',
        fromElementId: 'el-tp',
        toElementId: 'el-boca1',
        circuitId: 'c1',
        diameterMM: 20,
        material: 'hierro_semipesado_rs',
        isVerticalRiser: false,
        conductors: [],
        routingPlane: 'ceiling_slab'
      }
    ]
  };

  it('calcula el viewBox centrado con margen técnico de lámina', () => {
    const vb = computeBlueprintViewBox(mockProject, 'lvl-1');
    expect(vb).toBeDefined();
    expect(vb.minX).toBeLessThan(0);
    expect(vb.minY).toBeLessThan(0);
    expect(vb.width).toBeGreaterThan(6);
    expect(vb.height).toBeGreaterThan(5);
    expect(vb.svgViewBox).toContain(`${vb.minX.toFixed(2)} ${vb.minY.toFixed(2)}`);
  });

  it('calcula métricas y grados de electrificación AEA para la lámina', () => {
    const metrics = calculateBlueprintAeaMetrics(mockProject, 'lvl-1');
    expect(metrics).toBeDefined();
    expect(metrics.limitSurfaceM2).toBeCloseTo(30, 0); // 6m x 5m = 30m2
    expect(metrics.electrificationDegree.id).toBe('minimo');
    expect(metrics.circuitsCount).toBe(2);
    expect(metrics.bocasByType['IUG']).toBe(1);
    expect(metrics.bocasByType['TUG']).toBe(1);
    expect(metrics.totalBocas).toBe(2);
    expect(metrics.panelsCount).toBe(1);
  });

  it('formatea la fecha correctamente para el rótulo técnico', () => {
    const dateStr = formatBlueprintDate(new Date(2026, 9, 27));
    expect(dateStr).toBe('27/10/2026');
  });
});
