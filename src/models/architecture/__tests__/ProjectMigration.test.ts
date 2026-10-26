import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../BuildingProject';
import { migrateLoadedProject, buildDefaultPanelsAndCircuits } from '../projectMigration';

describe('projectMigration — Normalización de proyectos legacy y circuitos iniciales', () => {
  it('migra tableros legacy vinculados por elementId y redirige las cañerías al ID del panel', () => {
    const raw = createEmptyProject();
    raw.electricalElements = [
      {
        id: 'el-legacy-panel',
        symbolId: 'sym-planta-tablero-principal',
        levelId: raw.activeLevelId,
        spaceId: 's1',
        placement: 'wall',
        x: 3.5,
        y: 1.2,
        heightZ: 1.5,
        rotation: 90,
        circuitId: null,
        isPanel: true
      },
      {
        id: 'el-boca-1',
        symbolId: 'toma_doble',
        levelId: raw.activeLevelId,
        spaceId: 's1',
        placement: 'wall',
        x: 5,
        y: 1.2,
        heightZ: 0.3,
        rotation: 0,
        circuitId: 'c1'
      }
    ];
    raw.panels = [
      {
        id: 'panel-main',
        elementId: 'el-legacy-panel',
        name: 'TSG',
        type: 'principal',
        levelId: raw.activeLevelId,
        spaceId: 's1',
        symbolId: 'sym-planta-tablero-principal',
        isThreePhase: false,
        mainBreakerAmperageA: 32,
        mainDifferentialAmperageA: 40
      } as any
    ];
    raw.conduits = [
      {
        id: 'cond-1',
        fromElementId: 'el-legacy-panel',
        toElementId: 'el-boca-1',
        fromLevelId: raw.activeLevelId,
        toLevelId: raw.activeLevelId,
        circuitId: null,
        diameterMM: 19,
        material: 'pvc_rigido',
        isVerticalRiser: false,
        conductors: []
      }
    ];

    const migrated = migrateLoadedProject(raw);
    expect(migrated.electricalElements).toHaveLength(1);
    expect(migrated.electricalElements[0].id).toBe('el-boca-1');
    expect(migrated.panels[0].x).toBe(3.5);
    expect(migrated.panels[0].y).toBe(1.2);
    expect(migrated.panels[0].isPlaced).toBe(true);
    expect(migrated.panels[0].incomings?.length).toBeGreaterThan(0);
    expect(migrated.conduits[0].fromElementId).toBe('panel-main');
  });

  it('crea los 3 circuitos por defecto (IUG, TUG, TUE) solo cuando el proyecto no tiene circuitos', () => {
    const empty = createEmptyProject();
    empty.circuits = [];
    const generated = buildDefaultPanelsAndCircuits(empty, 1700000000000);
    expect(generated).not.toBeNull();
    expect(generated?.circuits).toHaveLength(3);
    expect(generated?.circuits.map((c) => c.type)).toEqual(['IUG', 'TUG', 'TUE']);

    empty.circuits = generated!.circuits;
    expect(buildDefaultPanelsAndCircuits(empty)).toBeNull();
  });
});
