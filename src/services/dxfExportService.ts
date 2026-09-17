/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: dxfExportService.ts
 * Generador de Archivos CAD DXF ASCII (AutoCAD / LibreCAD / QCAD).
 * Exporta muros, aberturas, ambientes, bocas eléctricas y cañerías en capas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';
import { resolveSpacePolygon, calculatePolygonArea, calculatePolygonCentroid } from '../models/architecture/Space';
import { getSymbolById } from '../models/electrical/symbolsLib';

export function exportProjectToDxf(project: BuildingProject): string {
  const lines: string[] = [];

  const add = (code: number | string, val: string | number) => {
    lines.push(String(code));
    lines.push(String(val));
  };

  // 1. SECCIÓN HEADER
  add(0, 'SECTION');
  add(2, 'HEADER');
  add(9, '$ACADVER');
  add(1, 'AC1009'); // AutoCAD Release 12 DXF (máxima compatibilidad)
  add(9, '$INSUNITS');
  add(70, 6); // 6 = Metros
  add(0, 'ENDSEC');

  // 2. SECCIÓN TABLES (Definición de Capas)
  add(0, 'SECTION');
  add(2, 'TABLES');
  add(0, 'TABLE');
  add(2, 'LAYER');
  add(70, 7);

  const defineLayer = (name: string, color: number) => {
    add(0, 'LAYER');
    add(2, name);
    add(70, 0);
    add(62, color); // Código de color ACI (AutoCAD Color Index)
    add(6, 'CONTINUOUS');
  };

  defineLayer('ARQ_MUROS', 7);       // 7 = Blanco / Negro
  defineLayer('ARQ_ABERTURAS', 4);   // 4 = Cian
  defineLayer('ARQ_AMBIENTES', 8);   // 8 = Gris
  defineLayer('ELEC_TABLEROS', 3);   // 3 = Verde
  defineLayer('ELEC_BOCAS', 1);      // 1 = Rojo
  defineLayer('ELEC_CANERIAS', 30);  // 30 = Naranja
  defineLayer('COTAS_METRICAS', 2);  // 2 = Amarillo

  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  // 3. SECCIÓN ENTITIES
  add(0, 'SECTION');
  add(2, 'ENTITIES');

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const nodesMap = new Map<string, any>();
  project.electricalElements.forEach((e) => nodesMap.set(e.id, e));
  (project.panels || []).forEach((p) => nodesMap.set(p.id, p));

  // A. Exportar Muros en capa ARQ_MUROS
  for (const wall of project.walls) {
    const v1 = verticesMap.get(wall.startVertexId);
    const v2 = verticesMap.get(wall.endVertexId);
    if (!v1 || !v2) continue;

    // En DXF, el eje Y estándar es hacia arriba (invertimos Y para mantener la orientación del plano)
    add(0, 'LINE');
    add(8, 'ARQ_MUROS');
    add(10, v1.x);
    add(20, -v1.y);
    add(30, 0.0);
    add(11, v2.x);
    add(21, -v2.y);
    add(31, 0.0);
  }

  // B. Exportar Ambientes en capa ARQ_AMBIENTES
  for (const space of project.spaces) {
    const poly = resolveSpacePolygon(space, verticesMap);
    if (poly.length < 3) continue;

    const area = calculatePolygonArea(poly);
    const centroid = calculatePolygonCentroid(poly);

    add(0, 'TEXT');
    add(8, 'ARQ_AMBIENTES');
    add(10, centroid.x);
    add(20, -centroid.y);
    add(30, 0.0);
    add(40, 0.25); // Altura de texto en metros
    add(1, `${space.name} (${area.toFixed(1)} m²)`);
  }

  // C. Exportar Bocas Eléctricas en capa ELEC_BOCAS
  for (const el of project.electricalElements) {
    if (el.isPanel) continue;
    const sym = getSymbolById(el.symbolId);
    const label = el.label || sym?.label || 'Boca';

    // Círculo representativo
    add(0, 'CIRCLE');
    add(8, 'ELEC_BOCAS');
    add(10, el.x);
    add(20, -el.y);
    add(30, el.heightZ);
    add(40, 0.12); // Radio en metros

    // Rótulo con altura
    add(0, 'TEXT');
    add(8, 'ELEC_BOCAS');
    add(10, el.x + 0.15);
    add(20, -el.y + 0.15);
    add(30, el.heightZ);
    add(40, 0.15);
    add(1, `${label} (h=${el.heightZ.toFixed(2)}m)`);
  }

  // C2. Exportar Tableros en capa ELEC_TABLEROS
  for (const p of project.panels || []) {
    if (p.isPlaced === false) continue;
    add(0, 'CIRCLE');
    add(8, 'ELEC_TABLEROS');
    add(10, p.x);
    add(20, -p.y);
    add(30, p.heightZ);
    add(40, 0.20); // Radio representativo para tablero

    add(0, 'TEXT');
    add(8, 'ELEC_TABLEROS');
    add(10, p.x + 0.25);
    add(20, -p.y + 0.25);
    add(30, p.heightZ);
    add(40, 0.18);
    add(1, `${p.name} (h=${p.heightZ.toFixed(2)}m)`);
  }

  // D. Exportar Cañerías en capa ELEC_CANERIAS
  for (const conduit of project.conduits) {
    const el1 = nodesMap.get(conduit.fromElementId);
    const el2 = nodesMap.get(conduit.toElementId);
    if (!el1 || !el2) continue;

    add(0, 'LINE');
    add(8, 'ELEC_CANERIAS');
    add(10, el1.x);
    add(20, -el1.y);
    add(30, el1.heightZ);
    add(11, el2.x);
    add(21, -el2.y);
    add(31, el2.heightZ);

    // Texto de diámetro en el punto medio
    const midX = (el1.x + el2.x) / 2;
    const midY = (el1.y + el2.y) / 2;
    const circLabel = conduit.circuitId
      ? project.circuits.find((c) => c.id === conduit.circuitId)?.name.split(' ')[0] || ''
      : '';

    add(0, 'TEXT');
    add(8, 'ELEC_CANERIAS');
    add(10, midX);
    add(20, -midY + 0.10);
    add(30, 0.0);
    add(40, 0.12);
    add(1, `${circLabel ? `${circLabel} · ` : ''}Ø${conduit.diameterMM}mm`);
  }

  // F. Exportar Cotas Métricas Libres en capa COTAS_METRICAS
  for (const dim of project.dimensions || []) {
    add(0, 'LINE');
    add(8, 'COTAS_METRICAS');
    add(10, dim.p1.x);
    add(20, -dim.p1.y);
    add(30, 0.0);
    add(11, dim.p2.x);
    add(21, -dim.p2.y);
    add(31, 0.0);

    const dist = Math.hypot(dim.p2.x - dim.p1.x, dim.p2.y - dim.p1.y);
    const midX = (dim.p1.x + dim.p2.x) / 2;
    const midY = (dim.p1.y + dim.p2.y) / 2;

    add(0, 'TEXT');
    add(8, 'COTAS_METRICAS');
    add(10, midX);
    add(20, -midY + 0.15);
    add(30, 0.0);
    add(40, 0.15);
    add(1, dim.label || `${dist.toFixed(2)} m`);
  }

  add(0, 'ENDSEC');
  add(0, 'EOF');

  return lines.join('\n');
}

export function downloadProjectDxf(project: BuildingProject): void {
  const dxfStr = exportProjectToDxf(project);
  const blob = new Blob([dxfStr], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const sanitizedName = (project.meta.name || 'plano')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizedName}_${new Date().toISOString().slice(0, 10)}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
