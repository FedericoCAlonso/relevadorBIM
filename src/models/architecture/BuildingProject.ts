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
import type { ElectricalElement, Conduit, Circuit, Panel } from '../electrical/ElectricalModel';

export interface ProjectMetadata {
  id: string;
  name: string;
  clientName?: string;
  address?: string;
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
}

/**
 * Crea un proyecto vacío con un nivel de Planta Baja listo para relevar.
 */
export function createEmptyProject(name = 'Nuevo Relevamiento'): BuildingProject {
  const defaultLevel = createDefaultLevel();
  const now = Date.now();

  return {
    meta: {
      id: `proj-${now}`,
      name,
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
    circuits: [],
    panels: []
  };
}
