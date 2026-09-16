/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: BuildingProject.ts
 * Raíz del Agregado (Aggregate Root) del Proyecto BIM 2D y Red Eléctrica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Level } from './Level';
import { createDefaultLevel } from './Level';
import type { Wall, WallVertex } from './Wall';
import type { Opening } from './Opening';
import type { Space } from './Space';
import type { VerticalPortal } from './VerticalPortal';
import type {
  ElectricalElement,
  Conduit,
  Circuit,
  Panel,
  ConduitMaterial,
  CableStandard,
  ProjectMaterialCatalog
} from '../electrical/ElectricalModel';
import { createDefaultMaterialCatalog } from '../electrical/electricalStandards';

export interface ProjectMetadata {
  id: string;
  name: string;
  clientName?: string;
  address?: string;
  electricianName?: string; // Técnico / Instalador matriculado responsable
  defaultConduitMaterial?: ConduitMaterial; // Material de cañería por defecto
  defaultCableStandard?: CableStandard;     // Norma de conductor por defecto
  defaultVoltageV?: number;                 // Tensión de red por defecto (220 o 380)
  createdAt: number;
  updatedAt: number;
  scale: number; // Escala 1:50, 1:100, etc.
}

export interface BuildingProject {
  meta: ProjectMetadata;
  levels: Level[];
  activeLevelId: string;
  vertices: WallVertex[];
  walls: Wall[];
  openings: Opening[];
  spaces: Space[];
  verticalPortals: VerticalPortal[];
  electricalElements: ElectricalElement[];
  conduits: Conduit[];
  circuits: Circuit[];
  panels: Panel[];
  materialCatalog?: ProjectMaterialCatalog; // Catálogo abierto de materiales de este proyecto
}

/**
 * Crea un proyecto vacío con un nivel de Planta Baja listo para relevar.
 */
export function createEmptyProject(name = 'Nuevo Relevamiento'): BuildingProject {
  const defaultLevel = createDefaultLevel();
  const now = Date.now();
  const defaultPanelId = `pan-${now}`;

  const defaultPanels: Panel[] = [
    {
      id: defaultPanelId,
      name: 'Tablero Seccional General (TSG)',
      type: 'principal',
      levelId: defaultLevel.id,
      spaceId: 'espacio-principal',
      elementId: '',
      isThreePhase: false,
      mainBreakerAmperageA: 32,
      mainDifferentialAmperageA: 40
    }
  ];

  const defaultCircuits: Circuit[] = [
    {
      id: `circ-${now}-1`,
      panelId: defaultPanelId,
      name: 'C1 - IUG (Iluminación)',
      type: 'IUG',
      voltageV: 220,
      wireSectionBaseMM2: 1.5,
      breakerAmperageA: 10,
      color: '#2563eb', // Azul reglamentario
      description: 'Circuito de Iluminación Uso General (máx 15 bocas)'
    },
    {
      id: `circ-${now}-2`,
      panelId: defaultPanelId,
      name: 'C2 - TUG (Tomacorrientes)',
      type: 'TUG',
      voltageV: 220,
      wireSectionBaseMM2: 2.5,
      breakerAmperageA: 16,
      color: '#ea580c', // Naranja reglamentario
      description: 'Circuito de Tomas de Uso General (máx 15 bocas)'
    },
    {
      id: `circ-${now}-3`,
      panelId: defaultPanelId,
      name: 'C3 - TUE (Tomas Especiales)',
      type: 'TUE',
      voltageV: 220,
      wireSectionBaseMM2: 2.5,
      breakerAmperageA: 20,
      color: '#16a34a', // Verde reglamentario
      description: 'Circuito de Tomas de Uso Especial (Climatización / Cocina)'
    }
  ];

  return {
    meta: {
      id: `proj-${now}`,
      name,
      defaultConduitMaterial: 'hierro_semipesado_rs',
      defaultCableStandard: 'IRAM_NM_247_3',
      defaultVoltageV: 220,
      createdAt: now,
      updatedAt: now,
      scale: 50
    },
    levels: [defaultLevel],
    activeLevelId: defaultLevel.id,
    vertices: [],
    walls: [],
    openings: [],
    spaces: [],
    verticalPortals: [],
    electricalElements: [],
    conduits: [],
    circuits: defaultCircuits,
    panels: defaultPanels,
    materialCatalog: createDefaultMaterialCatalog()
  };
}
