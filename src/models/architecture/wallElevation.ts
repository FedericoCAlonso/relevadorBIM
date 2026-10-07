/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: wallElevation.ts — Responsabilidad Única:
 * Proyección ortogonal 2D (alzado) de una cara de muro: aberturas, cajas,
 * gabinetes y canalizaciones a escala métrica 1:1, más la traducción inversa de
 * ediciones hechas sobre el alzado hacia coordenadas de planta.
 *
 * Espacio de dibujo: X en metros desde la esquina izquierda del observador,
 * Y en metros hacia abajo desde la parte superior del dibujo (Y = H - Z).
 * Cara 'right': observador sobre la normal derecha, mira hacia +normal izquierda
 * y ve crecer la distancia al vértice inicial hacia su derecha (X = u).
 * Cara 'left': la vista se refleja (X = L - u).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Wall, WallVertex, Vector2D } from './Wall';
import { getWallLength, getWallVector } from './Wall';
import type { Opening, OpeningType } from './Opening';
import type { Space } from './Space';
import type {
  BoxCategory,
  Circuit,
  Conduit,
  ConduitElevationRoute,
  ConduitRoutingPlane,
  ElectricalElement,
  Panel,
  ProjectMaterialCatalog,
  SpatialElectricalNode
} from '../electrical/ElectricalModel';
import { AEA_HEIGHT_PRESETS } from '../electrical/electricalStandards';
import { getSymbolById } from '../electrical/symbolsLib';
import { resolveConduitColor } from './wallElevationStyle';
import type { ElevationViewBox } from './elevationViewport';

export type ElevationFace = 'left' | 'right';
export type ElevationBoxKind = 'electrical_element' | 'panel';
export type ElevationBoxShape = 'rect' | 'octagon' | 'cabinet';

export const WALL_ELEVATION_CONSTANTS = {
  MM_PER_M: 1000,
  COORDINATE_DECIMALS: 3,
  DISPLAY_DECIMALS: 2,
  DRAG_STEP_M: 0.01,
  HEIGHT_SNAP_TOLERANCE_M: 0.05,
  DEDUPE_EPSILON_M: 0.005,
  MIN_SEGMENT_M: 0.02,
  DEFAULT_CEILING_HEIGHT_M: 2.70,
  MIN_OPENING_WIDTH_M: 0.30,
  MIN_OPENING_HEIGHT_M: 0.30,
  MIN_CONDUIT_DRAW_WIDTH_M: 0.012,
  KNOCKOUT_RADIUS_M: 0.011,
  KNOCKOUT_INSET_M: 0.014,
  KNOCKOUT_MIN_BOX_HEIGHT_M: 0.07,
  OCTAGON_CHAMFER_RATIO: 1 / (2 + Math.SQRT2),
  LABEL_GAP_M: 0.03,
  DIMENSION_TICK_M: 0.05,
  DIMENSION_TEXT_GAP_M: 0.11,
  LEVEL_TICK_M: 0.08,
  LEVEL_TEXT_GAP_M: 0.03,
  FLOOR_OVERHANG_M: 0.20,
  CM_PER_M: 100,
  DIMENSION_OFFSET_M: 0.30,
  LEVEL_MARK_OFFSET_M: 0.12,
  LABEL_FONT_SIZE_M: 0.075,
  ANNOTATION_FONT_SIZE_M: 0.07,
  MARGIN_LEFT_M: 0.70,
  MARGIN_RIGHT_M: 0.30,
  MARGIN_TOP_M: 0.35,
  MARGIN_BOTTOM_M: 0.60
} as const;

export const CONDUIT_ELEVATION_LAYOUT = {
  /** Separación entre ejes de conductos paralelos que comparten tramo o caja. */
  PARALLEL_GAP_M: 0.035
} as const;

export const CONDUIT_ROUTE_DEFAULTS = {
  /** Distancia horizontal máxima entre cajas para considerarlas contiguas / enlace directo (30 cm). */
  ADJACENT_MAX_GAP_M: 0.30,
  /** Margen de separación respecto al cielorraso para la cota del puente superior anticondensación (20 cm). */
  TOP_BRIDGE_MARGIN_M: 0.20
} as const;

interface BoxElevationDefaults {
  readonly widthMM: number;
  readonly heightMM: number;
  readonly shape: ElevationBoxShape;
}

/** Medidas de frente por categoría física cuando el tipo de caja no declara las suyas. */
export const BOX_CATEGORY_ELEVATION_DEFAULTS: Readonly<Record<BoxCategory, BoxElevationDefaults>> = {
  caja_rectangular: { widthMM: 50, heightMM: 100, shape: 'rect' },
  caja_octogonal: { widthMM: 75, heightMM: 75, shape: 'octagon' },
  caja_cuadrada: { widthMM: 100, heightMM: 100, shape: 'rect' },
  caja_mignon: { widthMM: 50, heightMM: 50, shape: 'rect' },
  gabinete_tablero: { widthMM: 300, heightMM: 400, shape: 'cabinet' },
  otro: { widthMM: 100, heightMM: 100, shape: 'rect' }
};

/** Caja física que suele alojar cada familia de símbolos de la biblioteca AEA. */
export const SYMBOL_CATEGORY_DEFAULT_BOX: Readonly<Record<string, BoxCategory>> = {
  tableros: 'gabinete_tablero',
  cajas_pase: 'caja_cuadrada',
  tomacorrientes: 'caja_rectangular',
  iluminacion: 'caja_octogonal'
};

const FALLBACK_BOX_CATEGORY: BoxCategory = 'caja_rectangular';

// ─── GEOMETRÍA BASE DE MURO ──────────────────────────────────────────────────

export interface WallAxisFrame {
  origin: Vector2D;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  length: number;
}

export function getWallAxisFrame(wall: Wall, vertices: Map<string, WallVertex>): WallAxisFrame | null {
  const start = vertices.get(wall.startVertexId);
  const length = getWallLength(wall, vertices);
  if (!start || length < WALL_ELEVATION_CONSTANTS.DEDUPE_EPSILON_M) return null;
  const vec = getWallVector(wall, vertices);
  const ux = vec.x / length;
  const uy = vec.y / length;
  return { origin: { x: start.x, y: start.y }, ux, uy, nx: -uy, ny: ux, length };
}

/** Proyecta un punto de planta sobre el eje del muro: u (a lo largo) y v (perpendicular, + izquierda). */
export function projectOnWall(point: Vector2D, frame: WallAxisFrame): { u: number; v: number } {
  const dx = point.x - frame.origin.x;
  const dy = point.y - frame.origin.y;
  return { u: dx * frame.ux + dy * frame.uy, v: dx * frame.nx + dy * frame.ny };
}

/** Distancia al vértice inicial ⇄ coordenada X del observador (la relación es una involución). */
export function alongWallToScreenX(u: number, wallLength: number, face: ElevationFace): number {
  return face === 'left' ? u : wallLength - u;
}

export const screenXToAlongWall = alongWallToScreenX;

export function toDrawingY(z: number, drawingHeightM: number): number {
  return drawingHeightM - z;
}

/** Cara por defecto: la que da a un ambiente asignado; si no hay, la de la luz libre según justificación. */
export function getDefaultElevationFace(wall: Wall): ElevationFace {
  if (wall.leftSpaceId) return 'left';
  if (wall.rightSpaceId) return 'right';
  return wall.justification === 'exterior' ? 'right' : 'left';
}

export function getFaceSpaceId(wall: Wall, face: ElevationFace): string | null {
  return (face === 'left' ? wall.leftSpaceId : wall.rightSpaceId) ?? null;
}

function resolveNodeFace(node: SpatialElectricalNode, v: number): ElevationFace {
  if (node.side === 'left' || node.side === 'right') return node.side;
  return v >= 0 ? 'left' : 'right';
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

const round3 = (v: number) => roundTo(v, WALL_ELEVATION_CONSTANTS.COORDINATE_DECIMALS);

export function formatElevationMeters(value: number): string {
  return value.toFixed(WALL_ELEVATION_CONSTANTS.DISPLAY_DECIMALS);
}

export function formatElevationLevel(z: number): string {
  return `${z < 0 ? '-' : '+'}${formatElevationMeters(Math.abs(z))}`;
}

function formatBoxSize(widthM: number, heightM: number, orientation?: 'vertical' | 'horizontal'): string {
  const cm = (m: number) => Number((m * WALL_ELEVATION_CONSTANTS.CM_PER_M).toFixed(1));
  const base = `${cm(widthM)} × ${cm(heightM)} cm`;
  if (orientation === 'horizontal') return `${base} (Horizontal)`;
  if (orientation === 'vertical' && widthM !== heightM) return `${base} (Vertical)`;
  return base;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

// ─── TIPOS DEL ALZADO ────────────────────────────────────────────────────────

export interface ElevationRect {
  x: number;
  y: number;
  width: number;
  height: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
}

function makeRect(x0: number, x1: number, zBottom: number, zTop: number, drawingH: number): ElevationRect {
  const y = toDrawingY(zTop, drawingH);
  const width = x1 - x0;
  const height = zTop - zBottom;
  return { x: x0, y, width, height, x2: x1, y2: y + height, cx: x0 + width / 2, cy: y + height / 2 };
}

export interface ElevationOpening {
  id: string;
  type: OpeningType;
  label?: string;
  width: number;
  height: number;
  sill: number;
  xLeft: number;
  zBottom: number;
  zTop: number;
  rect: ElevationRect;
  labelAnchor: ElevationPoint;
}

export interface ElevationPoint {
  x: number;
  y: number;
}

export interface ElevationKnockout {
  cx: number;
  cy: number;
  r: number;
}

export interface ElevationBox {
  id: string;
  kind: ElevationBoxKind;
  label: string;
  symbolId?: string;
  category: BoxCategory;
  shape: ElevationBoxShape;
  boxTypeName?: string;
  orientation: 'vertical' | 'horizontal';
  rotationDeg: number;
  centerX: number;
  centerZ: number;
  width: number;
  height: number;
  rect: ElevationRect;
  sizeLabel: string;
  outline: ElevationPoint[];
  knockouts: ElevationKnockout[];
  labelAnchor: ElevationPoint;
  widthMM: number;
  heightMM: number;
  depthMM?: number;
  dinModules?: number;
}

export type ElevationBoxSeed = Pick<
  ElevationBox,
  | 'id'
  | 'kind'
  | 'label'
  | 'symbolId'
  | 'category'
  | 'shape'
  | 'boxTypeName'
  | 'width'
  | 'height'
  | 'orientation'
  | 'rotationDeg'
> & {
  widthMM?: number;
  heightMM?: number;
  depthMM?: number;
  dinModules?: number;
};

export interface ElevationConduit {
  id: string;
  label?: string;
  color: string;
  widthM: number;
  diameterMM: number;
  segments: ElevationPoint[][];
  routingPlane?: ConduitRoutingPlane;
  elevationRoute?: ConduitElevationRoute;
  fromElementId: string;
  toElementId: string;
}

export interface ElevationLevelMark {
  z: number;
  y: number;
  label: string;
  tickX1: number;
  tickX2: number;
  textX: number;
  textY: number;
}

export interface ElevationDimensionSegment {
  x1: number;
  x2: number;
  cx: number;
  lengthM: number;
  label: string;
}

export interface WallElevation {
  wallId: string;
  face: ElevationFace;
  wallType: NonNullable<Wall['wallType']>;
  lengthM: number;
  wallHeightM: number;
  ceilingZ: number;
  drawingHeightM: number;
  wallRect: ElevationRect;
  ceilingY: number;
  openings: ElevationOpening[];
  boxes: ElevationBox[];
  conduits: ElevationConduit[];
  floorLine: { x1: number; x2: number; y: number };
  levelMarks: ElevationLevelMark[];
  dimensionChain: ElevationDimensionSegment[];
  dimensionLine: { y: number; tickY1: number; tickY2: number; textY: number };
  bounds: ElevationViewBox;
}

// ─── GEOMETRÍA FÍSICA DE CAJAS ───────────────────────────────────────────────

export interface ResolvedBoxGeometry {
  category: BoxCategory;
  shape: ElevationBoxShape;
  widthM: number;
  heightM: number;
  widthMM: number;
  heightMM: number;
  boxTypeName?: string;
  orientation: 'vertical' | 'horizontal';
  rotationDeg: number;
}

export function resolveBoxGeometry(params: {
  boxTypeId?: string;
  symbolId?: string;
  isPanel: boolean;
  catalog?: ProjectMaterialCatalog;
  boxOrientation?: 'vertical' | 'horizontal';
  boxRotationDeg?: number;
  customWidthMM?: number;
  customHeightMM?: number;
}): ResolvedBoxGeometry {
  const {
    boxTypeId,
    symbolId,
    isPanel,
    catalog,
    boxOrientation,
    boxRotationDeg,
    customWidthMM,
    customHeightMM
  } = params;
  const boxType = boxTypeId ? catalog?.boxTypes.find((b) => b.id === boxTypeId) : undefined;
  const symbolCategory = symbolId ? getSymbolById(symbolId)?.categoria : undefined;
  const category: BoxCategory =
    boxType?.category ??
    (isPanel
      ? 'gabinete_tablero'
      : symbolId && (symbolId.includes('llave') || symbolId.includes('toma'))
      ? 'caja_rectangular'
      : (symbolCategory && SYMBOL_CATEGORY_DEFAULT_BOX[symbolCategory]) || FALLBACK_BOX_CATEGORY);
  const defaults = BOX_CATEGORY_ELEVATION_DEFAULTS[category];
  const mm = WALL_ELEVATION_CONSTANTS.MM_PER_M;

  let widthMM = customWidthMM ?? boxType?.widthMM ?? defaults.widthMM;
  let heightMM = customHeightMM ?? boxType?.heightMM ?? defaults.heightMM;

  const isHorizontal =
    boxOrientation === 'horizontal' ||
    boxRotationDeg === 90 ||
    boxRotationDeg === 270;

  // Si la caja se orienta en horizontal y sus dimensiones difieren (ej: rectangular 50x100mm), invertimos frente y alto
  if (isHorizontal && widthMM !== heightMM) {
    const tmp = widthMM;
    widthMM = heightMM;
    heightMM = tmp;
  }

  const rotationDeg = boxRotationDeg ?? (isHorizontal ? 90 : 0);
  const orientation: 'vertical' | 'horizontal' = isHorizontal ? 'horizontal' : 'vertical';

  return {
    category,
    shape: defaults.shape,
    widthM: widthMM / mm,
    heightM: heightMM / mm,
    widthMM,
    heightMM,
    boxTypeName: boxType?.name,
    orientation,
    rotationDeg
  };
}

function buildKnockouts(rect: ElevationRect, shape: ElevationBoxShape): ElevationKnockout[] {
  const { KNOCKOUT_RADIUS_M: r, KNOCKOUT_INSET_M: inset, KNOCKOUT_MIN_BOX_HEIGHT_M } = WALL_ELEVATION_CONSTANTS;
  if (shape === 'cabinet') return [];
  if (shape === 'octagon') {
    return [
      { cx: rect.cx, cy: rect.y + inset, r },
      { cx: rect.cx, cy: rect.y + rect.height - inset, r },
      { cx: rect.x + inset, cy: rect.cy, r },
      { cx: rect.x + rect.width - inset, cy: rect.cy, r }
    ];
  }
  if (rect.width > rect.height) {
    // Caja horizontal apaisada (ej: 10x5 cm)
    return [
      { cx: rect.x + inset, cy: rect.cy, r },
      { cx: rect.x + rect.width - inset, cy: rect.cy, r },
      { cx: rect.cx, cy: rect.y + inset, r },
      { cx: rect.cx, cy: rect.y + rect.height - inset, r }
    ];
  }
  if (rect.height < KNOCKOUT_MIN_BOX_HEIGHT_M) return [];
  return [
    { cx: rect.cx, cy: rect.y + inset, r },
    { cx: rect.cx, cy: rect.y + rect.height - inset, r }
  ];
}

function buildOctagonOutline(rect: ElevationRect): ElevationPoint[] {
  const cx = Math.min(rect.width, rect.height) * WALL_ELEVATION_CONSTANTS.OCTAGON_CHAMFER_RATIO;
  const { x, y, width: w, height: h } = rect;
  return [
    { x: x + cx, y },
    { x: x + w - cx, y },
    { x: x + w, y: y + cx },
    { x: x + w, y: y + h - cx },
    { x: x + w - cx, y: y + h },
    { x: x + cx, y: y + h },
    { x, y: y + h - cx },
    { x, y: y + cx }
  ];
}

/** Ubica una caja en el alzado: único origen de su rectángulo, contorno, troqueles y etiqueta. */
export function placeElevationBox(
  seed: ElevationBoxSeed,
  centerX: number,
  centerZ: number,
  drawingHeightM: number
): ElevationBox {
  const rect = makeRect(
    centerX - seed.width / 2,
    centerX + seed.width / 2,
    centerZ - seed.height / 2,
    centerZ + seed.height / 2,
    drawingHeightM
  );
  return {
    ...seed,
    centerX,
    centerZ,
    rect,
    sizeLabel: formatBoxSize(seed.width, seed.height, seed.orientation),
    outline: seed.shape === 'octagon' ? buildOctagonOutline(rect) : [],
    knockouts: buildKnockouts(rect, seed.shape),
    labelAnchor: { x: rect.cx, y: rect.y - WALL_ELEVATION_CONSTANTS.LABEL_GAP_M },
    widthMM: seed.widthMM ?? Math.round(seed.width * WALL_ELEVATION_CONSTANTS.MM_PER_M),
    heightMM: seed.heightMM ?? Math.round(seed.height * WALL_ELEVATION_CONSTANTS.MM_PER_M),
    depthMM: seed.depthMM,
    dinModules: seed.dinModules
  };
}

// ─── SNAP DE ALTURAS DE MONTAJE ──────────────────────────────────────────────

export interface HeightSnapResult {
  z: number;
  guideZ: number | null;
}

/** Imanta la cota Z a los presets de montaje AEA; fuera de tolerancia redondea al paso de arrastre. */
export function snapElevationHeight(z: number, maxZ: number): HeightSnapResult {
  const { HEIGHT_SNAP_TOLERANCE_M, DRAG_STEP_M } = WALL_ELEVATION_CONSTANTS;
  let best: number | null = null;
  let bestDist: number = HEIGHT_SNAP_TOLERANCE_M;
  for (const preset of AEA_HEIGHT_PRESETS) {
    if (preset.meters > maxZ) continue;
    const dist = Math.abs(preset.meters - z);
    if (dist <= bestDist) {
      best = preset.meters;
      bestDist = dist;
    }
  }
  if (best !== null) return { z: best, guideZ: best };
  return { z: round3(Math.round(z / DRAG_STEP_M) * DRAG_STEP_M), guideZ: null };
}

// ─── CONSTRUCCIÓN DEL ALZADO ─────────────────────────────────────────────────

export interface BuildWallElevationParams {
  wall: Wall;
  vertices: Map<string, WallVertex>;
  face: ElevationFace;
  openings: Opening[];
  elements: ElectricalElement[];
  panels: Panel[];
  conduits: Conduit[];
  circuits: Circuit[];
  spaces: Space[];
  catalog?: ProjectMaterialCatalog;
}

function resolveCeilingZ(wall: Wall, face: ElevationFace, spaces: Space[]): number {
  if ((wall.wallType ?? 'standard') === 'standard') return wall.height;
  const own = getFaceSpaceId(wall, face);
  const other = getFaceSpaceId(wall, face === 'left' ? 'right' : 'left');
  const byId = (id: string | null) => (id ? spaces.find((s) => s.id === id) : undefined);
  return byId(own)?.ceilingHeight ?? byId(other)?.ceilingHeight ?? WALL_ELEVATION_CONSTANTS.DEFAULT_CEILING_HEIGHT_M;
}

function dedupeSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > WALL_ELEVATION_CONSTANTS.DEDUPE_EPSILON_M) out.push(v);
  }
  return out;
}

function pointsAreDegenerate(points: ElevationPoint[]): boolean {
  const eps = WALL_ELEVATION_CONSTANTS.DEDUPE_EPSILON_M;
  return points.every((p) => Math.abs(p.x - points[0].x) < eps && Math.abs(p.y - points[0].y) < eps);
}

/** Cajas del paramento a las que llega el conducto, sin repetir la misma caja. */
function conduitEndBoxes(fromBox: ElevationBox | undefined, toBox: ElevationBox | undefined): ElevationBox[] {
  const ends = [fromBox, toBox].filter((b): b is ElevationBox => b !== undefined);
  return ends.filter((b, i) => ends.findIndex((o) => o.id === b.id) === i);
}

/**
 * Claves de "carril": los conductos que comparten clave corren en paralelo y se
 * separan entre sí. Una clave por tramo (pared) o por cada caja alojada (losa/contrapiso).
 */
function conduitLaneKeys(
  conduit: Conduit,
  fromBox: ElevationBox | undefined,
  toBox: ElevationBox | undefined
): string[] {
  const plane = conduit.routingPlane ?? 'wall';
  if (plane === 'ceiling_slab' || plane === 'floor_slab') {
    return conduitEndBoxes(fromBox, toBox).map((b) => `${plane}:${b.id}`);
  }
  if (fromBox && toBox && fromBox.id !== toBox.id) {
    return [[fromBox.id, toBox.id].sort().join('|')];
  }
  const localBox = fromBox ?? toBox;
  if (localBox) {
    return [`cross:${localBox.id}:${plane}`];
  }
  return [];
}

/** Reparte cada grupo de conductos en carriles simétricos respecto del eje común. */
function assignLaneOffsets(keysPerConduit: string[][]): number[][] {
  const totals = new Map<string, number>();
  for (const keys of keysPerConduit) for (const k of keys) totals.set(k, (totals.get(k) ?? 0) + 1);
  const seen = new Map<string, number>();
  return keysPerConduit.map((keys) =>
    keys.map((k) => {
      const index = seen.get(k) ?? 0;
      seen.set(k, index + 1);
      return (index - ((totals.get(k) ?? 1) - 1) / 2) * CONDUIT_ELEVATION_LAYOUT.PARALLEL_GAP_M;
    })
  );
}

function buildWallRunSegment(
  fromBox: ElevationBox,
  toBox: ElevationBox,
  offset: number,
  wallHeightM: number,
  ceilingZ: number,
  H: number
): ElevationPoint[] {
  const [first, second] = fromBox.centerX <= toBox.centerX ? [fromBox, toBox] : [toBox, fromBox];
  const deltaX = Math.abs(second.centerX - first.centerX);
  const deltaZ = Math.abs(second.centerZ - first.centerZ);

  // Si están contiguas a la misma altura o similar (distancia horizontal <= 30cm y deltaZ <= 15cm):
  // Enlace recto directo entre cajas
  if (deltaX <= CONDUIT_ROUTE_DEFAULTS.ADJACENT_MAX_GAP_M && deltaZ <= 0.15) {
    const eps = WALL_ELEVATION_CONSTANTS.DEDUPE_EPSILON_M;
    const { cx: fx, cy: fy } = first.rect;
    const { cx: tx, cy: ty } = second.rect;
    if (Math.abs(fy - ty) < eps) return [{ x: fx, y: fy + offset }, { x: tx, y: ty + offset }];
    return [
      { x: fx + offset, y: fy },
      { x: fx + offset, y: ty + offset },
      { x: tx, y: ty + offset }
    ];
  }

  // Si están distanciadas (> 30 cm) o con desnivel significativo:
  // PUENTE SUPERIOR ANTICONDENSACIÓN (sale por arriba, corre a cota superior y baja a la otra caja)
  const zBridge = Math.max(
    first.centerZ,
    second.centerZ,
    Math.min(ceilingZ, wallHeightM) - CONDUIT_ROUTE_DEFAULTS.TOP_BRIDGE_MARGIN_M
  );
  const yBridge = toDrawingY(zBridge, H);

  return [
    { x: first.centerX + offset, y: first.rect.y },
    { x: first.centerX + offset, y: yBridge + offset },
    { x: second.centerX + offset, y: yBridge + offset },
    { x: second.centerX + offset, y: second.rect.y }
  ];
}

function buildCrossWallSegment(
  conduit: Conduit,
  localBox: ElevationBox,
  otherNode: SpatialElectricalNode | undefined,
  wall: Wall,
  vertices: Map<string, WallVertex>,
  face: ElevationFace,
  ceilingY: number,
  floorY: number,
  wallHeightM: number,
  ceilingZ: number,
  H: number,
  offset: number
): ElevationPoint[] {
  const plane = conduit.routingPlane ?? 'wall';
  if (plane === 'ceiling_slab') {
    return [
      { x: localBox.centerX + offset, y: localBox.rect.y },
      { x: localBox.centerX + offset, y: ceilingY }
    ];
  }
  if (plane === 'floor_slab') {
    return [
      { x: localBox.centerX + offset, y: localBox.rect.y + localBox.rect.height },
      { x: localBox.centerX + offset, y: floorY }
    ];
  }

  // plane === 'wall': el caño va por pared hacia la esquina que conecta con el otro elemento
  const vStart = vertices.get(wall.startVertexId);
  const vEnd = vertices.get(wall.endVertexId);
  const frame = getWallAxisFrame(wall, vertices);
  const L = frame?.length ?? wall.thickness;
  let exitU = 0;
  if (otherNode && vStart && vEnd) {
    const dStart = Math.hypot(otherNode.x - vStart.x, otherNode.y - vStart.y);
    const dEnd = Math.hypot(otherNode.x - vEnd.x, otherNode.y - vEnd.y);
    exitU = dEnd < dStart ? L : 0;
  } else {
    exitU = localBox.centerX > L / 2 ? L : 0;
  }
  const exitX = alongWallToScreenX(exitU, L, face);
  const distToExit = Math.abs(exitX - localBox.centerX);

  if (distToExit <= CONDUIT_ROUTE_DEFAULTS.ADJACENT_MAX_GAP_M) {
    return [
      { x: localBox.centerX, y: localBox.rect.cy + offset },
      { x: exitX, y: localBox.rect.cy + offset }
    ];
  }

  const zBridge = Math.max(
    localBox.centerZ,
    Math.min(ceilingZ, wallHeightM) - CONDUIT_ROUTE_DEFAULTS.TOP_BRIDGE_MARGIN_M
  );
  const yBridge = toDrawingY(zBridge, H);
  return [
    { x: localBox.centerX + offset, y: localBox.rect.y },
    { x: localBox.centerX + offset, y: yBridge + offset },
    { x: exitX, y: yBridge + offset }
  ];
}

function buildConduitSegments(params: {
  conduit: Conduit;
  fromBox: ElevationBox | undefined;
  toBox: ElevationBox | undefined;
  allNodesMap: Map<string, SpatialElectricalNode>;
  wall: Wall;
  vertices: Map<string, WallVertex>;
  face: ElevationFace;
  ceilingY: number;
  floorY: number;
  wallHeightM: number;
  ceilingZ: number;
  H: number;
  L: number;
  offsets: number[];
}): ElevationPoint[][] {
  const {
    conduit,
    fromBox,
    toBox,
    allNodesMap,
    wall,
    vertices,
    face,
    ceilingY,
    floorY,
    wallHeightM,
    ceilingZ,
    H,
    L,
    offsets
  } = params;
  const plane = conduit.routingPlane ?? 'wall';

  // Si el conducto posee una traza explícita modelada para este muro, se renderiza exactamente
  if (conduit.elevationRoute && conduit.elevationRoute.wallId === wall.id && conduit.elevationRoute.points.length >= 2) {
    const off = offsets[0] ?? 0;
    const seg: ElevationPoint[] = conduit.elevationRoute.points.map((p) => ({
      x: alongWallToScreenX(p.u, L, face),
      y: toDrawingY(p.z, H) + off
    }));
    return [seg];
  }

  // Caso 1: Ambas cajas están en este paramento
  if (fromBox && toBox && fromBox.id !== toBox.id) {
    if (plane === 'ceiling_slab' || plane === 'floor_slab') {
      const target = plane === 'ceiling_slab' ? ceilingY : floorY;
      return conduitEndBoxes(fromBox, toBox).map((box, i) => {
        const x = box.centerX + (offsets[i] ?? 0);
        const from = plane === 'ceiling_slab' ? box.rect.y : box.rect.y + box.rect.height;
        return [{ x, y: from }, { x, y: target }];
      });
    }
    return [buildWallRunSegment(fromBox, toBox, offsets[0] ?? 0, wallHeightM, ceilingZ, H)];
  }

  // Caso 2: Solo una caja está en este paramento (la otra viene de otra pared o losa)
  const localBox = fromBox ?? toBox;
  if (localBox) {
    const otherId = localBox.id === conduit.fromElementId ? conduit.toElementId : conduit.fromElementId;
    const otherNode = allNodesMap.get(otherId);
    return [
      buildCrossWallSegment(
        conduit,
        localBox,
        otherNode,
        wall,
        vertices,
        face,
        ceilingY,
        floorY,
        wallHeightM,
        ceilingZ,
        H,
        offsets[0] ?? 0
      )
    ];
  }

  return [];
}

export function buildWallElevation(params: BuildWallElevationParams): WallElevation | null {
  const { wall, vertices, face, openings, elements, panels, conduits, circuits, spaces, catalog } = params;
  const frame = getWallAxisFrame(wall, vertices);
  if (!frame) return null;
  const L = frame.length;
  const wallHeightM = wall.height;
  const ceilingZ = resolveCeilingZ(wall, face, spaces);
  const H = Math.max(wallHeightM, ceilingZ);
  const wallType = wall.wallType ?? 'standard';

  const elevOpenings: ElevationOpening[] = openings
    .filter((o) => o.wallId === wall.id)
    .map((o) => {
      const xLeft = face === 'left' ? o.distanceAlongWall : L - o.distanceAlongWall - o.width;
      const zBottom = o.sill;
      const zTop = o.sill + o.height;
      const rect = makeRect(xLeft, xLeft + o.width, zBottom, zTop, H);
      return {
        id: o.id,
        type: o.type,
        label: o.label,
        width: o.width,
        height: o.height,
        sill: o.sill,
        xLeft,
        zBottom,
        zTop,
        rect,
        labelAnchor: { x: rect.cx, y: rect.cy }
      };
    });

  const nodes: Array<{
    node: SpatialElectricalNode;
    kind: ElevationBoxKind;
    label: string;
    symbolId?: string;
    boxTypeId?: string;
    customWidthMM?: number;
    customHeightMM?: number;
    depthMM?: number;
    dinModules?: number;
  }> = [
    ...elements
      .filter((e) => e.wallId === wall.id && e.levelId === wall.levelId && !e.isTerminalReference)
      .map((e) => ({
        node: e,
        kind: 'electrical_element' as const,
        label: e.label ?? '',
        symbolId: e.symbolId,
        boxTypeId: e.boxTypeId
      })),
    ...panels
      .filter((p) => p.wallId === wall.id && p.levelId === wall.levelId && p.isPlaced !== false)
      .map((p) => ({
        node: p,
        kind: 'panel' as const,
        label: p.name,
        symbolId: p.symbolId,
        boxTypeId: p.gabineteBoxTypeId,
        customWidthMM: p.widthMM,
        customHeightMM: p.heightMM,
        depthMM: p.depthMM,
        dinModules: p.dinModules
      }))
  ];

  const boxes: ElevationBox[] = [];
  for (const entry of nodes) {
    const { u, v } = projectOnWall({ x: entry.node.x, y: entry.node.y }, frame);
    if (resolveNodeFace(entry.node, v) !== face) continue;
    const geo = resolveBoxGeometry({
      boxTypeId: entry.boxTypeId,
      symbolId: entry.symbolId,
      isPanel: entry.kind === 'panel',
      catalog,
      boxOrientation: entry.node.boxOrientation,
      boxRotationDeg: entry.node.boxRotationDeg,
      customWidthMM: entry.customWidthMM,
      customHeightMM: entry.customHeightMM
    });
    boxes.push(
      placeElevationBox(
        {
          id: entry.node.id,
          kind: entry.kind,
          label: entry.label,
          symbolId: entry.symbolId,
          category: geo.category,
          shape: geo.shape,
          boxTypeName: geo.boxTypeName,
          width: geo.widthM,
          height: geo.heightM,
          orientation: geo.orientation,
          rotationDeg: geo.rotationDeg,
          widthMM: geo.widthMM,
          heightMM: geo.heightMM,
          depthMM: entry.depthMM,
          dinModules: entry.dinModules
        },
        alongWallToScreenX(u, L, face),
        entry.node.heightZ,
        H
      )
    );
  }

  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const ceilingY = toDrawingY(ceilingZ, H);
  const floorY = H;
  const circuitColor = (c: Conduit) => {
    const id = c.circuitId ?? c.circuitIds?.[0];
    return id ? circuits.find((ci) => ci.id === id)?.color : undefined;
  };
  const allNodesMap = new Map<string, SpatialElectricalNode>([
    ...elements.map((e) => [e.id, e] as const),
    ...panels.map((p) => [p.id, p] as const)
  ]);
  const routed = conduits.map((c) => ({
    conduit: c,
    fromBox: boxById.get(c.fromElementId),
    toBox: boxById.get(c.toElementId)
  }));
  const laneOffsets = assignLaneOffsets(routed.map((r) => conduitLaneKeys(r.conduit, r.fromBox, r.toBox)));
  const elevConduits: ElevationConduit[] = [];
  routed.forEach(({ conduit: c, fromBox, toBox }, idx) => {
    const segments = buildConduitSegments({
      conduit: c,
      fromBox,
      toBox,
      allNodesMap,
      wall,
      vertices,
      face,
      ceilingY,
      floorY,
      wallHeightM,
      ceilingZ,
      H,
      L,
      offsets: laneOffsets[idx] ?? [0]
    }).filter((seg) => !pointsAreDegenerate(seg));
    if (segments.length === 0) return;
    elevConduits.push({
      id: c.id,
      label: c.label,
      color: resolveConduitColor(circuitColor(c), String(c.material)),
      widthM: Math.max(c.diameterMM / WALL_ELEVATION_CONSTANTS.MM_PER_M, WALL_ELEVATION_CONSTANTS.MIN_CONDUIT_DRAW_WIDTH_M),
      diameterMM: c.diameterMM,
      segments,
      routingPlane: c.routingPlane,
      elevationRoute: c.elevationRoute,
      fromElementId: c.fromElementId,
      toElementId: c.toElementId
    });
  });

  const levelZs = dedupeSorted([
    0,
    wallHeightM,
    ...boxes.map((b) => b.centerZ),
    ...elevOpenings.flatMap((o) => [o.zBottom, o.zTop])
  ]);
  const markX = -WALL_ELEVATION_CONSTANTS.LEVEL_MARK_OFFSET_M;
  const levelMarks: ElevationLevelMark[] = levelZs.map((z) => {
    const y = toDrawingY(z, H);
    return {
      z,
      y,
      label: formatElevationLevel(z),
      tickX1: markX,
      tickX2: markX + WALL_ELEVATION_CONSTANTS.LEVEL_TICK_M,
      textX: markX - WALL_ELEVATION_CONSTANTS.LEVEL_TEXT_GAP_M,
      textY: y
    };
  });

  const chainXs = dedupeSorted([
    0,
    L,
    ...elevOpenings.flatMap((o) => [o.xLeft, o.xLeft + o.width]),
    ...boxes.map((b) => b.centerX)
  ]).filter((x) => x >= 0 && x <= L);
  const dimensionChain: ElevationDimensionSegment[] = [];
  for (let i = 0; i < chainXs.length - 1; i++) {
    const x1 = chainXs[i];
    const x2 = chainXs[i + 1];
    const lengthM = x2 - x1;
    if (lengthM < WALL_ELEVATION_CONSTANTS.MIN_SEGMENT_M) continue;
    dimensionChain.push({ x1, x2, cx: (x1 + x2) / 2, lengthM, label: formatElevationMeters(lengthM) });
  }

  const m = WALL_ELEVATION_CONSTANTS;
  return {
    wallId: wall.id,
    face,
    wallType,
    lengthM: L,
    wallHeightM,
    ceilingZ,
    drawingHeightM: H,
    wallRect: makeRect(0, L, 0, wallHeightM, H),
    ceilingY,
    openings: elevOpenings,
    boxes,
    conduits: elevConduits,
    floorLine: { x1: -m.FLOOR_OVERHANG_M, x2: L + m.FLOOR_OVERHANG_M, y: H },
    levelMarks,
    dimensionChain,
    dimensionLine: {
      y: H + m.DIMENSION_OFFSET_M,
      tickY1: H + m.DIMENSION_OFFSET_M - m.DIMENSION_TICK_M,
      tickY2: H + m.DIMENSION_OFFSET_M + m.DIMENSION_TICK_M,
      textY: H + m.DIMENSION_OFFSET_M + m.DIMENSION_TEXT_GAP_M
    },
    bounds: {
      x: -m.MARGIN_LEFT_M,
      y: -m.MARGIN_TOP_M,
      width: L + m.MARGIN_LEFT_M + m.MARGIN_RIGHT_M,
      height: H + m.MARGIN_TOP_M + m.MARGIN_BOTTOM_M
    }
  };
}

// ─── TRADUCCIÓN DE EDICIONES DEL ALZADO A DATOS DE PLANTA ────────────────────

export interface NodeElevationMove {
  x: number;
  y: number;
  wallOffset: number;
  heightZ: number;
}

/**
 * Convierte una posición deseada en el alzado (centro de caja X/Z) en las
 * coordenadas de planta del nodo, conservando su separación perpendicular al eje.
 */
export function computeNodeMoveFromElevation(params: {
  node: SpatialElectricalNode;
  wall: Wall;
  vertices: Map<string, WallVertex>;
  face: ElevationFace;
  boxWidthM: number;
  boxHeightM: number;
  targetX: number;
  targetZ: number;
}): NodeElevationMove | null {
  const { node, wall, vertices, face, boxWidthM, boxHeightM, targetX, targetZ } = params;
  const frame = getWallAxisFrame(wall, vertices);
  if (!frame) return null;
  const { v } = projectOnWall({ x: node.x, y: node.y }, frame);
  const cx = clamp(targetX, boxWidthM / 2, frame.length - boxWidthM / 2);
  const cz = clamp(targetZ, boxHeightM / 2, wall.height - boxHeightM / 2);
  const u = screenXToAlongWall(cx, frame.length, face);
  return {
    x: round3(frame.origin.x + frame.ux * u + frame.nx * v),
    y: round3(frame.origin.y + frame.uy * u + frame.ny * v),
    wallOffset: round3(u),
    heightZ: round3(cz)
  };
}

export interface OpeningElevationPatch {
  xLeft?: number;
  width?: number;
  height?: number;
  sill?: number;
}

/** Valida y convierte una edición de abertura hecha en el alzado a los campos de `Opening`. */
export function computeOpeningUpdateFromElevation(params: {
  opening: Opening;
  wallLengthM: number;
  wallHeightM: number;
  face: ElevationFace;
  patch: OpeningElevationPatch;
}): Pick<Opening, 'width' | 'height' | 'sill' | 'distanceAlongWall'> {
  const { opening, wallLengthM: L, wallHeightM: H, face, patch } = params;
  const m = WALL_ELEVATION_CONSTANTS;
  const currentXLeft = face === 'left' ? opening.distanceAlongWall : L - opening.distanceAlongWall - opening.width;
  const width = clamp(patch.width ?? opening.width, m.MIN_OPENING_WIDTH_M, L);
  const xLeft = clamp(patch.xLeft ?? currentXLeft, 0, L - width);
  const height = clamp(patch.height ?? opening.height, m.MIN_OPENING_HEIGHT_M, H);
  const sill = clamp(patch.sill ?? opening.sill, 0, H - height);
  const distanceAlongWall = face === 'left' ? xLeft : L - xLeft - width;
  return {
    width: round3(width),
    height: round3(height),
    sill: round3(sill),
    distanceAlongWall: round3(distanceAlongWall)
  };
}
