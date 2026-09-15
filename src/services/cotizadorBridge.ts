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

export interface ComputoMetricoExport {
  proyectoId: string;
  proyectoNombre: string;
  superficieTotalM2: number;
  cañeriasPorDiametro: Record<string, number>; // Ej: { "19mm (3/4\")": 45.2, "25mm (1\")": 18.0 }
  bocasPorTipo: Record<string, number>;        // Ej: { "IUG": 12, "TUG": 18, "TUE": 2, "Tableros": 1 }
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
  const elementsMap = new Map(project.electricalElements.map(e => [e.id, e]));

  // 1. Cómputo de superficies por ambiente
  let superficieTotalM2 = 0;
  const ambientesComputados: { nombre: string; areaM2: number; bocasCount: number }[] = [];

  for (const space of project.spaces) {
    const poly = resolveSpacePolygon(space, verticesMap);
    const area = calculatePolygonArea(poly);
    superficieTotalM2 += area;

    const bocasCount = project.electricalElements.filter(el => el.spaceId === space.id).length;
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
    const elFrom = elementsMap.get(conduit.fromElementId);
    const elTo = elementsMap.get(conduit.toElementId);
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

  // 3. Cómputo de bocas agrupadas por uso reglamentario
  const bocasPorTipo: Record<string, number> = {};
  for (const el of project.electricalElements) {
    let tipo = 'OTRO';
    if (el.symbolId.includes('techo') || el.symbolId.includes('aplique') || el.symbolId.includes('luminaria')) {
      tipo = 'IUG (Iluminación)';
    } else if (el.symbolId.includes('enchufe') || el.symbolId.includes('toma')) {
      tipo = el.symbolId.includes('especial') ? 'TUE (Tomas Especiales)' : 'TUG (Tomas Generales)';
    } else if (el.symbolId.includes('tablero')) {
      tipo = 'Tablero Eléctrico';
    } else if (el.symbolId.includes('interruptor') || el.symbolId.includes('llave')) {
      tipo = 'Interruptores / Comandos';
    }

    bocasPorTipo[tipo] = (bocasPorTipo[tipo] || 0) + 1;
  }

  return {
    proyectoId: project.meta.id,
    proyectoNombre: project.meta.name,
    superficieTotalM2: Number(superficieTotalM2.toFixed(2)),
    cañeriasPorDiametro,
    bocasPorTipo,
    conductoresPorSeccionM,
    ambientesComputados,
    timestamp: Date.now()
  };
}
