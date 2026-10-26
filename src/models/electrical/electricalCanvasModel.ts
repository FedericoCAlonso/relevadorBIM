/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: electricalCanvasModel.ts
 * Cálculos geométricos, descriptores de fichas de remate y trazados 2D de
 * canalizaciones, bocas y tableros para el lienzo CAD.
 * Funciones puras sin dependencias de React ni del DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  ElectricalElement,
  Conduit,
  Panel,
  Circuit,
  SpatialElectricalNode,
  ConduitRoutingPlane
} from './ElectricalModel';
import type { Level } from '../architecture/Level';
import { calculateConduitRealLength } from './conduitMetrics';
import { computeOrthogonalConduitPoints, generateRoundedPolylineSvgPath } from './cadGeometry';
import { CAD_ELECTRICAL_STYLES as S } from '../../config';

/** Símbolo por defecto de un tablero según su jerarquía. */
export function resolvePanelSymbolId(panel: Pick<Panel, 'symbolId' | 'type'>): string {
  if (panel.symbolId) return panel.symbolId;
  return panel.type === 'principal'
    ? 'sym-planta-tablero-principal'
    : 'sym-planta-tablero-seccional';
}

/** Determina si una boca es de montaje en techo / centro (no se imanta a muros). */
export function isCeilingSymbol(symbolId: string): boolean {
  return symbolId.includes('techo') || symbolId.includes('ventilador');
}

export interface TerminalBadgeSpec {
  targetText: string;
  specText: string;
  totalLengthM: number;
  isFixedLength: boolean;
  diameterMM: number;
  conductorsDesc: string;
  boxWidthPx: number;
}

/**
 * Construye los datos de la ficha técnica flotante para una etiqueta de pase / remate de cañería.
 */
export function computeTerminalReferenceBadge(params: {
  element: ElectricalElement;
  conduits: Conduit[];
  elementsMap: Map<string, SpatialElectricalNode>;
  levelsMap: Map<string, Level>;
}): TerminalBadgeSpec {
  const { element, conduits, elementsMap, levelsMap } = params;
  const connectedConduit = conduits.find(
    (c) => c.fromElementId === element.id || c.toElementId === element.id
  );
  const otherId = connectedConduit
    ? connectedConduit.fromElementId === element.id
      ? connectedConduit.toElementId
      : connectedConduit.fromElementId
    : null;
  const otherEl = otherId ? elementsMap.get(otherId) : null;

  const autoLen = otherEl
    ? calculateConduitRealLength({
        fromElement: element,
        toElement: otherEl,
        levelsMap,
        routingPlane: connectedConduit?.routingPlane,
        waypoints: connectedConduit?.waypoints,
        elevationRoute: connectedConduit?.elevationRoute
      })
    : 0;

  const totalLengthM =
    element.totalLengthM ??
    connectedConduit?.manualLengthM ??
    autoLen + (connectedConduit?.additionalLengthM || element.additionalLengthM || 0);

  const isFixedLength = element.totalLengthM != null || connectedConduit?.manualLengthM != null;
  const diameterMM =
    element.continuationConduitDiameterMM ||
    connectedConduit?.diameterMM ||
    S.terminalDefaultDiameterMM;
  const conductorsCount =
    element.continuationConductorsCount ||
    connectedConduit?.conductors?.length ||
    S.terminalDefaultConductorsCount;
  const section =
    element.continuationCableSectionMM2 ||
    connectedConduit?.conductors?.[0]?.sectionMM2 ||
    S.terminalDefaultSectionMM2;

  const conductorsDesc = `${conductorsCount}x${section}mm²`;
  const targetText =
    element.targetDescription ||
    connectedConduit?.targetDescription ||
    S.terminalDefaultTarget;

  const specText = `Ø${diameterMM}mm · L=${totalLengthM.toFixed(1)}m${isFixedLength ? ' [Fijo]' : ''} · ${conductorsDesc}`;
  const boxWidthPx = Math.max(
    S.terminalMinBoxWidthPx,
    targetText.length * S.terminalCharWidthPx + S.terminalPaddingPx
  );

  return {
    targetText,
    specText,
    totalLengthM,
    isFixedLength,
    diameterMM,
    conductorsDesc,
    boxWidthPx
  };
}

export interface ConduitCanvasPath {
  pathD: string;
  midX: number;
  midY: number;
  waypointsPx?: Array<{ x: number; y: number }>;
}

/**
 * Calcula el path SVG y el punto medio de rotulación de una canalización en coordenadas de pantalla.
 * Retorna null si los extremos coinciden (< 1 px).
 */
export function computeConduitCanvasPath(params: {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  conduit: Pick<Conduit, 'routingPlane' | 'routingMode' | 'waypoints'>;
  zoom: number;
}): ConduitCanvasPath | null {
  const { p1, p2, conduit, zoom } = params;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;

  const routingPlane = conduit.routingPlane || 'wall';
  const isSlabOrFloor = routingPlane === 'ceiling_slab' || routingPlane === 'floor_slab';
  const isSchematicArc = conduit.routingMode === 'schematic_arc';
  const waypointsPx = conduit.waypoints?.map((wp) => ({ x: wp.x * zoom, y: wp.y * zoom }));

  if (isSchematicArc) {
    const normalX = -dy / dist;
    const normalY = dx / dist;
    const curveOffset = Math.min(dist * S.conduitArcCurveFactor, S.conduitArcMaxOffsetPx);
    const midX = (p1.x + p2.x) / 2 + normalX * curveOffset;
    const midY = (p1.y + p2.y) / 2 + normalY * curveOffset;
    const pathD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    return { pathD, midX, midY, waypointsPx };
  }

  if (isSlabOrFloor) {
    const pts = [p1, ...(waypointsPx || []), p2];
    const pathD =
      `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} ` +
      pts
        .slice(1)
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
    const midIdx = Math.max(1, Math.floor(pts.length / 2));
    const midX = (pts[midIdx - 1].x + pts[midIdx].x) / 2;
    const midY = (pts[midIdx - 1].y + pts[midIdx].y) / 2;
    return { pathD, midX, midY, waypointsPx };
  }

  const orthoPoints = computeOrthogonalConduitPoints(p1, p2, waypointsPx);
  const filletRadiusPx = Math.min(
    S.conduitFilletMaxPx,
    Math.max(S.conduitFilletMinPx, S.conduitFilletBasePx * (zoom / S.conduitFilletRefZoom))
  );
  const pathD = generateRoundedPolylineSvgPath(orthoPoints, filletRadiusPx);
  const midSegmentIdx = Math.max(1, Math.floor(orthoPoints.length / 2));
  const pSegA = orthoPoints[midSegmentIdx - 1];
  const pSegB = orthoPoints[midSegmentIdx];
  const midX = (pSegA.x + pSegB.x) / 2;
  const midY = (pSegA.y + pSegB.y) / 2;
  return { pathD, midX, midY, waypointsPx };
}

export interface ConduitVisualSpec {
  strokeColor: string;
  labelColor: string;
  strokeWidth: number;
  strokeDasharray: string;
  planeGlyph: string;
  labelText: string;
}

const PLANE_GLYPHS: Record<ConduitRoutingPlane, string> = {
  ceiling_slab: '☁',
  floor_slab: '👣',
  wall: '🧱'
};

/** Estilo de trazo, glifo de vía de tendido y rótulo de una canalización en planta. */
export function resolveConduitVisualSpec(
  conduit: Pick<Conduit, 'material' | 'diameterMM' | 'label' | 'routingPlane' | 'circuitId' | 'circuitIds'>,
  circuits: Circuit[],
  isSelected: boolean
): ConduitVisualSpec {
  const assignedCircuitId = conduit.circuitId || conduit.circuitIds?.[0];
  const circ = assignedCircuitId ? circuits.find((c) => c.id === assignedCircuitId) : null;
  const strokeColor = isSelected ? S.conduitSelectedStroke : circ?.color || S.conduitDefaultStroke;
  const labelColor = isSelected ? S.conduitSelectedLabelFill : strokeColor;
  const isTray = conduit.material.includes('bandeja');
  const isCorrugated = conduit.material.includes('corrugado');

  const strokeWidth = isSelected
    ? S.conduitWidthSelected
    : isTray
    ? S.conduitWidthTray
    : S.conduitWidthDefault;
  const strokeDasharray = isCorrugated
    ? S.conduitDashCorrugated
    : isTray
    ? S.conduitDashTray
    : 'none';

  const routingPlane = conduit.routingPlane || 'wall';
  const planeGlyph = PLANE_GLYPHS[routingPlane];
  const labelText = circ
    ? `${circ.name.split(' ')[0]} · Ø${conduit.diameterMM}mm`
    : conduit.label || `Ø${conduit.diameterMM}mm`;

  return { strokeColor, labelColor, strokeWidth, strokeDasharray, planeGlyph, labelText };
}
