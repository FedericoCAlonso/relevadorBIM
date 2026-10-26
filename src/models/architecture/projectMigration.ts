/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO DE DOMINIO PURO: projectMigration.ts
 * Responsabilidad Única (SRP):
 * Normalización y migración de proyectos BIM cargados desde JSON (conversión
 * de tableros legacy basados en elementId a entidades Panel autónomas) y
 * fábrica determinística de tableros/circuitos iniciales por defecto.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from './BuildingProject';
import type { Circuit, Panel } from '../electrical/ElectricalModel';
import { createDefaultMaterialCatalog } from '../electrical/electricalStandards';
import { CIRCUIT_COLOR_PALETTE } from '../../config';

/**
 * Normaliza un proyecto cargado desde persistencia o archivo JSON,
 * migrando tableros legacy vinculados por `elementId` a entidades `Panel` autónomas.
 */
export function migrateLoadedProject(project: BuildingProject): BuildingProject {
  const elementIdToPanelId = new Map<string, string>();
  for (const p of project.panels || []) {
    if (p.elementId) {
      elementIdToPanelId.set(p.elementId, p.id);
    }
  }

  const migratedPanels: Panel[] = (project.panels || []).map((p) => {
    const legacyEl = p.elementId
      ? project.electricalElements.find((e) => e.id === p.elementId)
      : null;

    const hasIncomings = p.incomings && p.incomings.length > 0;
    const defaultIncomings = hasIncomings
      ? p.incomings
      : [
          {
            id: `inc-${p.id}-grid`,
            sourceType:
              p.type === 'principal' ? ('grid_meter' as const) : ('upstream_panel' as const),
            name:
              p.type === 'principal'
                ? 'Acometida Red (Distribuidora)'
                : 'Alimentador Seccional',
            voltageV: p.isThreePhase ? 380 : 220,
            phases: (p.isThreePhase ? 3 : 1) as 1 | 3,
            mainBreakerAmperageA: p.mainBreakerAmperageA || 32,
            mainDifferentialAmperageA: p.mainDifferentialAmperageA || 40,
            isDefaultActive: true
          }
        ];

    return {
      ...p,
      x: p.x ?? legacyEl?.x ?? 0,
      y: p.y ?? legacyEl?.y ?? 0,
      heightZ: p.heightZ ?? legacyEl?.heightZ ?? 1.4,
      levelId: p.levelId || legacyEl?.levelId || project.activeLevelId || 'level-1',
      spaceId: p.spaceId || legacyEl?.spaceId || 'espacio-principal',
      wallId: p.wallId ?? legacyEl?.wallId ?? null,
      wallOffset: p.wallOffset ?? legacyEl?.wallOffset,
      rotation: p.rotation ?? legacyEl?.rotation ?? 0,
      side: p.side ?? legacyEl?.side,
      isPlaced:
        p.isPlaced !== undefined
          ? p.isPlaced
          : Boolean(legacyEl || (p.x !== undefined && p.x !== 0)),
      symbolId:
        p.symbolId ||
        legacyEl?.symbolId ||
        (p.type === 'principal'
          ? 'sym-planta-tablero-principal'
          : 'sym-planta-tablero-seccional'),
      hasEarthBar: p.hasEarthBar ?? true,
      incomings: defaultIncomings
    };
  });

  const migratedConduits = (project.conduits || []).map((c) => ({
    ...c,
    fromElementId: elementIdToPanelId.get(c.fromElementId) || c.fromElementId,
    toElementId: elementIdToPanelId.get(c.toElementId) || c.toElementId
  }));

  const migratedElements = (project.electricalElements || []).filter(
    (el) => !el.isPanel && !elementIdToPanelId.has(el.id)
  );

  return {
    ...project,
    panels: migratedPanels,
    conduits: migratedConduits,
    electricalElements: migratedElements,
    materialCatalog: project.materialCatalog || createDefaultMaterialCatalog(),
    underlaySheets: project.underlaySheets || {},
    dimensions: project.dimensions || []
  };
}

/**
 * Construye los tableros y circuitos iniciales por defecto (C1 IUG, C2 TUG, C3 TUE)
 * cuando el proyecto aún no posee circuitos creados.
 */
export function buildDefaultPanelsAndCircuits(
  project: BuildingProject,
  now: number = Date.now()
): { panels: Panel[]; circuits: Circuit[] } | null {
  if (project.circuits.length > 0) return null;

  const panelId = project.panels[0]?.id || `pan-${now}`;
  const panels: Panel[] =
    project.panels.length > 0
      ? project.panels
      : [
          {
            id: panelId,
            name: 'Tablero Seccional General (TSG)',
            type: 'principal',
            levelId: project.activeLevelId,
            spaceId: 'espacio-principal',
            x: 0,
            y: 0,
            heightZ: 1.4,
            isPlaced: false,
            symbolId: 'sym-planta-tablero-principal',
            isThreePhase: false,
            mainBreakerAmperageA: 32,
            mainDifferentialAmperageA: 40,
            hasEarthBar: true,
            incomings: [
              {
                id: `inc-${now}-grid`,
                sourceType: 'grid_meter',
                name: 'Acometida Red (Distribuidora)',
                voltageV: 220,
                phases: 1,
                mainBreakerAmperageA: 32,
                mainDifferentialAmperageA: 40,
                isDefaultActive: true
              }
            ]
          }
        ];

  const circuits: Circuit[] = [
    {
      id: `circ-${now}-1`,
      panelId,
      name: 'C1 - IUG (Iluminación)',
      type: 'IUG',
      voltageV: 220,
      wireSectionBaseMM2: 1.5,
      breakerAmperageA: 10,
      color: CIRCUIT_COLOR_PALETTE[0],
      description: 'Circuito de Iluminación Uso General'
    },
    {
      id: `circ-${now}-2`,
      panelId,
      name: 'C2 - TUG (Tomacorrientes)',
      type: 'TUG',
      voltageV: 220,
      wireSectionBaseMM2: 2.5,
      breakerAmperageA: 16,
      color: CIRCUIT_COLOR_PALETTE[6],
      description: 'Circuito de Tomas de Uso General'
    },
    {
      id: `circ-${now}-3`,
      panelId,
      name: 'C3 - TUE (Tomas Especiales)',
      type: 'TUE',
      voltageV: 220,
      wireSectionBaseMM2: 2.5,
      breakerAmperageA: 20,
      color: CIRCUIT_COLOR_PALETTE[2],
      description: 'Circuito de Tomas de Uso Especial'
    }
  ];

  return { panels, circuits };
}
