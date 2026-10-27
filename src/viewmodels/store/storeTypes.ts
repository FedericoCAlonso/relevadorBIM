/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL STORE: storeTypes.ts
 * Responsabilidad Única (SRP) e ISP:
 * Contratos tipados de los slices modulares del almacén global del proyecto
 * BIM (`ProjectStoreState`) y generador determinístico de identificadores.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  BuildingProject,
  ProjectMetadata,
  ElectricalCalculationSettings,
  CircuitCalculationOverride
} from '../../models/architecture/BuildingProject';
import type { Wall, Vector2D, WallJustification } from '../../models/architecture/Wall';
import type { Opening, OpeningType, OpeningSwing } from '../../models/architecture/Opening';
import type { Space } from '../../models/architecture/Space';
import type {
  ElectricalElement,
  Conduit,
  Circuit,
  Panel,
  ConduitMaterial,
  ConduitTypeDefinition,
  CableTypeDefinition,
  BoxTypeDefinition,
  LabelDisplayMode
} from '../../models/electrical/ElectricalModel';
import type { OpeningTypeDefinition } from '../../models/architecture/openingPresets';
import type { UnderlaySheet } from '../../models/underlay/UnderlaySheet';
import type { DimensionLine } from '../../models/architecture/DimensionLine';
import type { StructuralColumn, StructuralBeam } from '../../models/architecture/StructuralElement';
import type { ElectricalBranch, BranchUpdatePayload } from '../../models/electrical/electricalBranch';

let idCounter = 0;
export function generateUniqueId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export interface SelectedEntity {
  type:
    | 'vertex'
    | 'wall'
    | 'opening'
    | 'space'
    | 'electrical_element'
    | 'conduit'
    | 'dimension'
    | 'panel'
    | 'column'
    | 'beam';
  id: string;
}

export interface ProjectHistoryEntry {
  project: BuildingProject;
  activeAnchorVertexId: string | null;
}

export const MAX_PROJECT_UNDO_STACK = 25;

export interface SelectByCriteriaParams {
  levelId?: string;
  circuitId?: string;
  conduitMaterial?: ConduitMaterial;
  conduitDiameterMM?: number;
  elementSymbolId?: string;
  status?: 'existente' | 'proyectado' | 'a_reemplazar';
  entityType?: 'conduit' | 'electrical_element' | 'all';
}

export interface HistoryAndMetaSlice {
  project: BuildingProject;
  undoStack: ProjectHistoryEntry[];
  redoStack: ProjectHistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  loadProject: (project: BuildingProject) => void;
  resetProject: () => void;
  updateProjectMeta: (patch: Partial<ProjectMetadata>) => void;
  updateElectricalSettings: (patch: Partial<ElectricalCalculationSettings>) => void;
  updateCircuitCalculationOverride: (
    circuitId: string,
    patch: Partial<CircuitCalculationOverride>
  ) => void;
}

export interface SelectionAndCatalogSlice {
  selectedEntity: SelectedEntity | null;
  selectedEntities: SelectedEntity[];
  isMultiSelectMode: boolean;
  activeAnchorVertexId: string | null;
  showDimensions: boolean;
  labelDisplayMode: LabelDisplayMode;

  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setSelectedEntities: (entities: SelectedEntity[]) => void;
  toggleSelectEntity: (entity: SelectedEntity, multiSelect?: boolean) => void;
  clearSelection: () => void;
  selectByCriteria: (criteria: SelectByCriteriaParams) => void;
  setActiveAnchorVertexId: (vertexId: string | null) => void;
  setActiveLevel: (levelId: string) => void;

  setShowDimensions: (show: boolean) => void;
  toggleDimensions: () => void;
  setLabelDisplayMode: (mode: LabelDisplayMode) => void;
  setMultiSelectMode: (active: boolean) => void;
  toggleMultiSelectMode: () => void;

  addConduitType: (def: ConduitTypeDefinition) => void;
  removeConduitType: (id: string) => void;
  addCableType: (def: CableTypeDefinition) => void;
  removeCableType: (id: string) => void;
  addBoxType: (def: BoxTypeDefinition) => void;
  removeBoxType: (id: string) => void;
  addOpeningType: (def: OpeningTypeDefinition) => void;
  removeOpeningType: (id: string) => void;

  setUnderlaySheet: (levelId: string, sheet: UnderlaySheet) => void;
  updateUnderlaySheet: (levelId: string, updates: Partial<UnderlaySheet>) => void;
  removeUnderlaySheet: (levelId: string) => void;
}

export interface ArchitectureSlice {
  addWallFromAnchor: (params: {
    startVertexId?: string;
    startCoord?: Vector2D;
    lengthM: number;
    angleDeg: number;
    thickness?: number;
    justification?: WallJustification;
    referenceOrigin?: 'visible_face' | 'axis' | WallJustification;
    measurementReference?: WallJustification;
  }) => { wall: Wall; endVertexId: string } | null;

  addBranchWallFromOffset: (params: {
    hostWallId: string;
    referenceVertexId: string;
    offsetM: number;
    branchLengthM: number;
    side: 'left' | 'right';
    thickness?: number;
    justification?: WallJustification;
  }) => Wall | null;

  addOpeningReferenced: (params: {
    hostWallId: string;
    referenceVertexId: string;
    offsetToJambM: number;
    widthM: number;
    type: OpeningType;
    swing?: OpeningSwing;
    label?: string;
  }) => Opening | null;

  addOpeningDirect: (params: {
    wallId: string;
    type: OpeningType;
    width: number;
    height: number;
    sill: number;
    distanceAlongWall: number;
    swing?: OpeningSwing;
    label?: string;
    presetId?: string;
  }) => Opening | null;

  updateWall: (wallId: string, updates: Partial<Wall>) => void;
  batchUpdateWalls: (wallIds: string[], updates: Partial<Wall>) => void;
  batchUpdateWallLengths: (wallIds: string[], targetLengthM: number, mode?: 'absolute' | 'delta') => void;
  batchDeleteWalls: (wallIds: string[]) => void;
  selectedWallAnchorMode: 'start' | 'end' | 'center';
  setSelectedWallAnchorMode: (mode: 'start' | 'end' | 'center') => void;
  updateWallLength: (
    wallId: string,
    newLengthM: number,
    anchorMode?: 'start' | 'end' | 'center' | string
  ) => void;
  updateVertexPosition: (vertexId: string, newPos: Vector2D) => void;
  splitSharedVertexForWall: (wallId: string, vertexId: string) => string;
  commitWallVertexDrag: (params: {
    wallId: string;
    draggedVertexId: string;
    newPos: Vector2D;
    mergeWithVertexId?: string;
    draggedEnd: 'start' | 'end';
    oldLength: number;
  }) => void;
  rotateWall: (wallId: string, deltaAngleDeg: number) => void;
  invertWallDirection: (wallId: string) => void;
  deleteWall: (wallId: string) => void;
  undoLastWall: () => void;
  updateOpening: (openingId: string, updates: Partial<Opening>) => void;
  deleteOpening: (openingId: string) => void;

  addColumn: (column: Omit<StructuralColumn, 'id'>) => string;
  updateColumn: (columnId: string, updates: Partial<StructuralColumn>) => void;
  deleteColumn: (columnId: string) => void;
  addBeam: (beam: Omit<StructuralBeam, 'id'>) => string;
  updateBeam: (beamId: string, updates: Partial<StructuralBeam>) => void;
  deleteBeam: (beamId: string) => void;

  updateSpace: (spaceId: string, updates: Partial<Space>) => void;
  resizeSpaceOrthogonal: (params: {
    spaceId: string;
    axis: 'width' | 'length';
    newDimensionM: number;
    direction?: 'positive' | 'negative' | 'center';
  }) => void;
  autoDetectSpaces: () => void;
  moveSpace: (spaceId: string, delta: Vector2D) => void;

  addDimensionLine: (dimension: DimensionLine) => void;
  updateDimensionLine: (dimensionId: string, updates: Partial<DimensionLine>) => void;
  deleteDimensionLine: (dimensionId: string) => void;
}

export interface ElectricalSlice {
  addElectricalElement: (element: ElectricalElement) => void;
  updateElectricalElement: (elementId: string, updates: Partial<ElectricalElement>) => void;
  deleteElectricalElement: (elementId: string) => void;
  batchUpdateElectricalElements: (
    elementIds: string[],
    updates: Partial<ElectricalElement>
  ) => void;

  addConduit: (conduit: Conduit) => void;
  updateConduit: (conduitId: string, updates: Partial<Conduit>) => void;
  deleteConduit: (conduitId: string) => void;
  batchUpdateConduits: (conduitIds: string[], updates: Partial<Conduit>) => void;
  batchDeriveConduitConductors: (conduitIds?: string[]) => void;

  addCircuit: (circuit: Circuit) => void;
  updateCircuit: (circuitId: string, updates: Partial<Circuit>) => void;
  deleteCircuit: (circuitId: string) => void;
  updateElectricalBranch: (branch: ElectricalBranch, updates: BranchUpdatePayload) => void;
  ensureDefaultCircuits: () => void;

  addPanel: (panel: Panel) => void;
  updatePanel: (panelId: string, updates: Partial<Panel>) => void;
  deletePanel: (panelId: string) => void;
}

export type ProjectStoreState = HistoryAndMetaSlice &
  SelectionAndCatalogSlice &
  ArchitectureSlice &
  ElectricalSlice;

export type StoreSet = (
  partial:
    | ProjectStoreState
    | Partial<ProjectStoreState>
    | ((state: ProjectStoreState) => ProjectStoreState | Partial<ProjectStoreState>)
    | (Partial<ProjectStoreState> & { _skipHistory?: boolean }),
  replace?: false
) => void;

export type StoreGet = () => ProjectStoreState;
