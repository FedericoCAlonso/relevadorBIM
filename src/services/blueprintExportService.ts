/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: blueprintExportService.ts
 * Cálculo de Encuadre Geométrico, Rótulo y Métricas AEA para Impresión
 * y Exportación de Planos de Obra en Formato Normalizado (A4/A3).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';
import type { WallVertex } from '../models/architecture/Wall';
import {
  calculateProjectLimitSurface,
  getElectrificationDegree,
  type ElectrificationDegreeInfo
} from '../models/electrical/electricalStandards';

export interface BlueprintViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
  svgViewBox: string;
}

export interface BlueprintAeaMetrics {
  limitSurfaceM2: number;
  electrificationDegree: ElectrificationDegreeInfo;
  circuitsCount: number;
  panelsCount: number;
  totalBocas: number;
  bocasByType: Record<string, number>;
  circuitsSummary: Array<{
    id: string;
    name: string;
    type: string;
    sectionMM2: number;
    breakerInA: number;
    elementsCount: number;
  }>;
}

export interface BlueprintSheetMetadata {
  projectName: string;
  clientName: string;
  location: string;
  electricianName: string;
  licenseNumber: string;
  levelName: string;
  scale: string;
  date: string;
  regulationsRef: string;
  notes?: string;
}

/**
 * Calcula el recuadro delimitador y viewBox en metros para encuadrar la planta en la lámina.
 */
export function computeBlueprintViewBox(project: BuildingProject, levelId: string): BlueprintViewBox {
  const verticesMap = new Map<string, WallVertex>(project.vertices.map((v) => [v.id, v]));
  const levelWalls = project.walls.filter((w) => w.levelId === levelId);
  const levelElements = (project.electricalElements || []).filter((e) => e.levelId === levelId);
  const levelPanels = (project.panels || []).filter((p) => p.levelId === levelId && p.isPlaced !== false);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Extremos de muros
  for (const wall of levelWalls) {
    const v1 = verticesMap.get(wall.startVertexId);
    const v2 = verticesMap.get(wall.endVertexId);
    if (v1) {
      if (v1.x < minX) minX = v1.x;
      if (v1.x > maxX) maxX = v1.x;
      if (v1.y < minY) minY = v1.y;
      if (v1.y > maxY) maxY = v1.y;
    }
    if (v2) {
      if (v2.x < minX) minX = v2.x;
      if (v2.x > maxX) maxX = v2.x;
      if (v2.y < minY) minY = v2.y;
      if (v2.y > maxY) maxY = v2.y;
    }
  }

  // Posiciones de bocas y tableros
  for (const el of [...levelElements, ...levelPanels]) {
    if (el.x < minX) minX = el.x;
    if (el.x > maxX) maxX = el.x;
    if (el.y < minY) minY = el.y;
    if (el.y > maxY) maxY = el.y;
  }

  // Fallback si la planta está vacía
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return {
      minX: -2,
      minY: -2,
      width: 14,
      height: 10,
      svgViewBox: '-2 -2 14 10'
    };
  }

  const spanX = Math.max(maxX - minX, 4);
  const spanY = Math.max(maxY - minY, 3);

  // Margen proporcional técnico (12% a los lados)
  const marginX = Math.max(spanX * 0.12, 1.0);
  const marginY = Math.max(spanY * 0.12, 1.0);

  const finalMinX = minX - marginX;
  const finalMinY = minY - marginY;
  const finalWidth = spanX + marginX * 2;
  const finalHeight = spanY + marginY * 2;

  return {
    minX: finalMinX,
    minY: finalMinY,
    width: finalWidth,
    height: finalHeight,
    svgViewBox: `${finalMinX.toFixed(2)} ${finalMinY.toFixed(2)} ${finalWidth.toFixed(2)} ${finalHeight.toFixed(2)}`
  };
}

/**
 * Calcula las métricas del proyecto y cuadro reglamentario AEA para la carátula y cuadro de cargas.
 */
export function calculateBlueprintAeaMetrics(
  project: BuildingProject,
  levelId: string
): BlueprintAeaMetrics {
  const verticesMap = new Map<string, WallVertex>(project.vertices.map((v) => [v.id, v]));
  const wallsMap = new Map(project.walls.map((w) => [w.id, w]));
  const levelSpaces = project.spaces.filter((s) => s.levelId === levelId);

  // Superficie límite calculada según ponderación reglamentaria (cubierta al 100%, semicubierta al 50%)
  const breakdown = calculateProjectLimitSurface(levelSpaces, verticesMap, wallsMap);
  const limitSurfaceM2 = breakdown.totalLimitAreaM2;
  const electrificationDegree = getElectrificationDegree(limitSurfaceM2);

  const levelElements = (project.electricalElements || []).filter((e) => e.levelId === levelId);
  const levelPanels = (project.panels || []).filter((p) => p.levelId === levelId && p.isPlaced !== false);
  const circuits = project.circuits || [];

  const circuitMap = new Map(circuits.map((c) => [c.id, c]));

  const panelsCount = levelPanels.length;
  let totalBocas = 0;
  const bocasByType: Record<string, number> = {
    IUG: 0,
    TUG: 0,
    TUE: 0,
    IUE: 0,
    OTROS: 0
  };

  const elementCountsByCircuit = new Map<string, number>();

  for (const el of levelElements) {
    totalBocas++;

    if (el.circuitId) {
      elementCountsByCircuit.set(el.circuitId, (elementCountsByCircuit.get(el.circuitId) || 0) + 1);
    }

    const circ = el.circuitId ? circuitMap.get(el.circuitId) : undefined;
    const cType = circ?.type?.toUpperCase();

    if (cType && bocasByType[cType] !== undefined) {
      bocasByType[cType]++;
    } else if (el.symbolId.includes('techo') || el.symbolId.includes('braquete') || el.symbolId.includes('luz')) {
      bocasByType['IUG']++;
    } else if (el.symbolId.includes('toma') || el.symbolId.includes('enchufe')) {
      bocasByType['TUG']++;
    } else {
      bocasByType['OTROS']++;
    }
  }

  const circuitsSummary = circuits.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type || 'IUG',
    sectionMM2: c.wireSectionBaseMM2 || 1.5,
    breakerInA: c.breakerAmperageA || 10,
    elementsCount: elementCountsByCircuit.get(c.id) || 0
  }));

  return {
    limitSurfaceM2,
    electrificationDegree,
    circuitsCount: circuits.length,
    panelsCount,
    totalBocas,
    bocasByType,
    circuitsSummary
  };
}

/**
 * Formatea una fecha en formato estándar argentino DD/MM/AAAA.
 */
export function formatBlueprintDate(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
