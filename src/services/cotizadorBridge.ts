/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: cotizadorBridge.ts
 * Puente de Exportación de Cómputo Métrico hacia el Cotizador IEBA.
 * Computa automáticamente metros de caño, bocas AEA y conductores.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';
import { calculateConduitRealLength } from '../models/electrical/calculations';
import { calculatePolygonArea, resolveSpacePolygon } from '../models/architecture/Space';
import type { SpatialElectricalNode } from '../models/electrical/ElectricalModel';

export interface ComputoMetricoExport {
  proyectoId: string;
  proyectoNombre: string;
  superficieTotalM2: number;
  cañeriasPorDiametro: Record<string, number>; // Ej: { "19mm (3/4\")": 45.2, "25mm (1\")": 18.0 }
  bocasPorTipo: Record<string, number>;        // Ej: { "IUG": 12, "TUG": 18, "TUE": 2 }
  tablerosPorTipo?: Record<string, number>;    // Ej: { "Tablero Principal (TP)": 1 }
  conductoresPorSeccionM: Record<string, number>; // Ej: { "1.5 mm²": 90.4, "2.5 mm²": 108.0 }
  ambientesComputados: {
    nombre: string;
    areaM2: number;
    bocasCount: number;
  }[];
  timestamp: number;
}

/**
 * Genera el cómputo métrico completo del proyecto listo para cotizar.
 */
export function generarComputoCotizador(project: BuildingProject): ComputoMetricoExport {
  const verticesMap = new Map(project.vertices.map(v => [v.id, v]));
  const levelsMap = new Map(project.levels.map(l => [l.id, l]));

  const nodesMap = new Map<string, SpatialElectricalNode>();
  project.electricalElements.forEach(e => nodesMap.set(e.id, e));
  (project.panels || []).forEach(p => nodesMap.set(p.id, p));

  // 1. Cómputo de superficies por ambiente (excluye tableros del conteo de bocas de consumo)
  let superficieTotalM2 = 0;
  const ambientesComputados: { nombre: string; areaM2: number; bocasCount: number }[] = [];

  for (const space of project.spaces) {
    const poly = resolveSpacePolygon(space, verticesMap);
    const area = calculatePolygonArea(poly);
    superficieTotalM2 += area;

    const bocasCount = project.electricalElements.filter(
      el => el.spaceId === space.id && !el.isPanel && !el.isTerminalReference && el.symbolId !== 'sym-terminal-referencia'
    ).length;
    ambientesComputados.push({
      nombre: space.name,
      areaM2: Number(area.toFixed(2)),
      bocasCount
    });
  }

  // 2. Cómputo de cañerías y conductores
  const cañeriasPorDiametro: Record<string, number> = {};
  const conductoresPorSeccionM: Record<string, number> = {};

  for (const conduit of project.conduits) {
    const elFrom = nodesMap.get(conduit.fromElementId);
    const elTo = nodesMap.get(conduit.toElementId);
    if (!elFrom || !elTo) continue;

    const len = conduit.manualLengthM || calculateConduitRealLength({
      fromElement: elFrom,
      toElement: elTo,
      levelsMap
    });

    // Agrupar cañerías por diámetro
    const diamLabel = `Ø${conduit.diameterMM} mm`;
    cañeriasPorDiametro[diamLabel] = Number(((cañeriasPorDiametro[diamLabel] || 0) + len).toFixed(1));

    // Agrupar conductores que viajan dentro del caño
    for (const c of conduit.conductors) {
      const secLabel = `${c.sectionMM2} mm²`;
      conductoresPorSeccionM[secLabel] = Number(
        ((conductoresPorSeccionM[secLabel] || 0) + len).toFixed(1)
      );
    }
  }

  // 3. Cómputo de bocas agrupadas por uso reglamentario (excluyendo tableros)
  const bocasPorTipo: Record<string, number> = {};
  for (const el of project.electricalElements) {
    if (el.isPanel) continue; // Los tableros no son bocas de consumo
    let tipo = 'OTRO';
    if (el.symbolId.includes('techo') || el.symbolId.includes('aplique') || el.symbolId.includes('luminaria')) {
      tipo = 'IUG (Iluminación)';
    } else if (el.symbolId.includes('enchufe') || el.symbolId.includes('toma')) {
      tipo = el.symbolId.includes('especial') ? 'TUE (Tomas Especiales)' : 'TUG (Tomas Generales)';
    } else if (el.symbolId.includes('interruptor') || el.symbolId.includes('llave')) {
      tipo = 'Interruptores / Comandos';
    }

    bocasPorTipo[tipo] = (bocasPorTipo[tipo] || 0) + 1;
  }

  // 4. Cómputo de tableros distribuidores
  const tablerosPorTipo: Record<string, number> = {};
  for (const p of project.panels || []) {
    if (p.isPlaced !== false) {
      const tipo = p.type === 'principal' ? 'Tablero Principal (TP)' : 'Tablero Seccional (TS)';
      tablerosPorTipo[tipo] = (tablerosPorTipo[tipo] || 0) + 1;
    }
  }

  return {
    proyectoId: project.meta.id,
    proyectoNombre: project.meta.name,
    superficieTotalM2: Number(superficieTotalM2.toFixed(2)),
    cañeriasPorDiametro,
    bocasPorTipo,
    tablerosPorTipo,
    conductoresPorSeccionM,
    ambientesComputados,
    timestamp: Date.now()
  };
}

export type SurveyComputo = ComputoMetricoExport;
export const computeProjectSurvey = generarComputoCotizador;

/**
 * Genera una planilla CSV estructurada con el cómputo métrico de materiales.
 */
export function exportComputoToCsv(computo: ComputoMetricoExport): string {
  const rows: string[] = [];

  rows.push(`CÓMPUTO MÉTRICO DE INSTALACIÓN ELÉCTRICA`);
  rows.push(`Proyecto:;"${computo.proyectoNombre}"`);
  rows.push(`Fecha:;${new Date(computo.timestamp).toLocaleString('es-AR')}`);
  rows.push(`Superficie Cubierta Relevada:;${computo.superficieTotalM2} m²`);
  rows.push(``);

  rows.push(`1. BOCAS ELÉCTRICAS`);
  rows.push(`Tipo de Boca / Consumo;Cantidad`);
  for (const [tipo, cant] of Object.entries(computo.bocasPorTipo)) {
    rows.push(`"${tipo}";${cant}`);
  }
  rows.push(``);

  rows.push(`2. CAÑERÍAS Y CANALIZACIONES`);
  rows.push(`Calibre / Diámetro;Metros Lineales (m)`);
  for (const [diam, metros] of Object.entries(computo.cañeriasPorDiametro)) {
    rows.push(`"${diam}";${metros}`);
  }
  rows.push(``);

  rows.push(`3. CONDUCTORES DE COBRE (IRAM NM 247-3 / 62267)`);
  rows.push(`Sección Nominal (mm²);Metros Totales (m)`);
  for (const [sec, metros] of Object.entries(computo.conductoresPorSeccionM)) {
    rows.push(`"${sec}";${metros}`);
  }
  rows.push(``);

  rows.push(`4. AMBIENTES Y RECINTOS RELEVADOS`);
  rows.push(`Ambiente;Superficie (m²);Bocas Asignadas`);
  for (const amb of computo.ambientesComputados) {
    rows.push(`"${amb.nombre}";${amb.areaM2};${amb.bocasCount}`);
  }

  if (computo.tablerosPorTipo && Object.keys(computo.tablerosPorTipo).length > 0) {
    rows.push(``);
    rows.push(`5. TABLEROS Y GABINETES DE DISTRIBUCIÓN`);
    rows.push(`Tipo de Tablero;Cantidad`);
    for (const [tipo, cant] of Object.entries(computo.tablerosPorTipo)) {
      rows.push(`"${tipo}";${cant}`);
    }
  }

  return rows.join('\r\n');
}

export function downloadComputoCsv(computo: SurveyComputo): void {
  const csvContent = exportComputoToCsv(computo);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const sanitized = (computo.proyectoNombre || 'computo')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);

  const a = document.createElement('a');
  a.href = url;
  a.download = `computo_${sanitized}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
