/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: materialExportService.ts
 * Exportación Flexible de Cómputo Métrico de Materiales a CSV.
 * 
 * Modos Soportados:
 * 1. 'commercial': Planilla comercial estructurada agrupada por rubro
 *    (Canalizaciones, Cajas, Conductores, Mecanismos, Tableros, Mediciones).
 * 2. 'flat_database': Tabla plana para Excel / Power BI con una fila por
 *    registro unitario (Nivel, Ambiente, Circuito, Categoría, Material, etc.).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';
import type { SpatialElectricalNode, ConduitMaterial, ConduitRoutingPlane } from '../models/electrical/ElectricalModel';
import { calculateConduitRealLength } from '../models/electrical/calculations';
import { calculatePolygonArea, resolveSpacePolygon } from '../models/architecture/Space';
import { getSymbolById } from '../models/electrical/symbolsLib';
import { CONDUIT_MATERIALS_CATALOG, getConductorColorLabel } from '../models/electrical/electricalStandards';
import { conductorBelongsToCircuit } from '../models/electrical/electricalConductorDerivation';

export interface CsvExportOptions {
  format?: 'commercial' | 'flat_database';
  delimiter?: ';' | ',';
  statusFilter?: Array<'existente' | 'proyectado' | 'a_reemplazar'>;
  levelId?: string; // undefined = todos los niveles
  circuitId?: string; // undefined = todos los circuitos
  includeMeasurements?: boolean;
}

export interface DetailedMaterialItem {
  id: string;
  levelName: string;
  spaceName: string;
  panelName: string;
  circuitName: string;
  category: 'Canalización' | 'Conductor' | 'Caja / Boca' | 'Tablero' | 'Mecanismo';
  elementName: string;
  material: string;
  sizeOrSection: string;
  unit: 'm' | 'u';
  quantity: number;
  status: 'existente' | 'proyectado' | 'a_reemplazar';
  routingPlane?: string;
  measurementsOrNotes?: string;
}

/**
 * Obtiene el nombre legible de un material de canalización desde el catálogo.
 */
function getConduitMaterialLabel(mat?: ConduitMaterial): string {
  if (!mat) return 'PVC / Sin especificar';
  const opt = CONDUIT_MATERIALS_CATALOG.find((m) => m.id === mat);
  return opt ? opt.label : mat.replace(/_/g, ' ');
}

/**
 * Obtiene la etiqueta del plano de tendido.
 */
function getRoutingPlaneLabel(plane?: ConduitRoutingPlane): string {
  switch (plane) {
    case 'ceiling_slab':
      return 'Losa de Techo (Cielorraso)';
    case 'floor_slab':
      return 'Contrapiso / Losa de Piso';
    case 'wall':
    default:
      return 'Pared (Embutido/Superficie)';
  }
}

/**
 * Extrae todos los ítems de material desglosados unitariamente desde el proyecto BIM.
 */
export function extractDetailedMaterialItems(
  project: BuildingProject,
  options?: CsvExportOptions
): DetailedMaterialItem[] {
  const { statusFilter, levelId, circuitId } = options || {};

  const levelsMap = new Map(project.levels.map((l) => [l.id, l]));
  const spacesMap = new Map(project.spaces.map((s) => [s.id, s]));
  const circuitsMap = new Map(project.circuits.map((c) => [c.id, c]));
  const panelsMap = new Map((project.panels || []).map((p) => [p.id, p]));

  const nodesMap = new Map<string, SpatialElectricalNode>();
  project.electricalElements.forEach((e) => nodesMap.set(e.id, e));
  (project.panels || []).forEach((p) => nodesMap.set(p.id, p));

  const items: DetailedMaterialItem[] = [];

  // 1. Canalizaciones y Conductores dentro de canalizaciones
  for (const conduit of project.conduits) {
    const elFrom = nodesMap.get(conduit.fromElementId);
    const elTo = nodesMap.get(conduit.toElementId);
    if (!elFrom || !elTo) continue;

    const condLevelId = conduit.fromLevelId || elFrom.levelId;
    if (levelId && condLevelId !== levelId) continue;

    const carriesCircuit =
      !circuitId ||
      conduit.circuitId === circuitId ||
      (conduit.circuitIds && conduit.circuitIds.includes(circuitId));
    if (!carriesCircuit) continue;

    const condStatus = conduit.status || 'proyectado';
    if (statusFilter && statusFilter.length > 0 && !statusFilter.includes(condStatus)) continue;

    const levelObj = levelsMap.get(condLevelId);
    const levelName = levelObj ? levelObj.name : 'Nivel 1';

    const spaceObj = elFrom.spaceId ? spacesMap.get(elFrom.spaceId) : undefined;
    const spaceName = spaceObj ? spaceObj.name : 'General';

    const circId = conduit.circuitId || conduit.circuitIds?.[0];
    const circObj = circId ? circuitsMap.get(circId) : undefined;
    const circName = circObj ? circObj.name : 'Sin circuito';

    const panelObj = circObj ? panelsMap.get(circObj.panelId) : undefined;
    const panelName = panelObj ? panelObj.name : 'Tablero General';

    const lengthM = conduit.manualLengthM || calculateConduitRealLength({
      fromElement: elFrom,
      toElement: elTo,
      levelsMap,
      routingPlane: conduit.routingPlane,
      waypoints: conduit.waypoints
    });

    const matLabel = getConduitMaterialLabel(conduit.material);
    const planeLabel = getRoutingPlaneLabel(conduit.routingPlane);

    // Registro de canalización
    items.push({
      id: conduit.id,
      levelName,
      spaceName,
      panelName,
      circuitName: circName,
      category: 'Canalización',
      elementName: `Cañería ${planeLabel}`,
      material: matLabel,
      sizeOrSection: `Ø${conduit.diameterMM} mm`,
      unit: 'm',
      quantity: Number(lengthM.toFixed(2)),
      status: condStatus,
      routingPlane: planeLabel,
      measurementsOrNotes: conduit.label || undefined
    });

    // Registros de conductores alojados dentro de esta canalización
    const conduitCircuitIds = conduit.circuitIds || (conduit.circuitId ? [conduit.circuitId] : []);

    if (conduit.conductors && conduit.conductors.length > 0) {
      for (const [cIdx, cond] of conduit.conductors.entries()) {
        if (circuitId && !conductorBelongsToCircuit(cond, circuitId, conduitCircuitIds)) {
          continue;
        }

        const roleLabel =
          cond.role === 'pe'
            ? 'Puesta a Tierra (PE Verde-Amarillo)'
            : cond.role === 'neutro'
            ? 'Neutro (Celeste)'
            : cond.role === 'retorno'
            ? `Retorno${cond.reference ? ` (${cond.reference})` : ''}`
            : `Fase (${getConductorColorLabel(cond.color, cond.role)})`;

        const condCircuitId = cond.circuitId || (cond.circuitIds ? cond.circuitIds[0] : circId);
        const condCircObj = condCircuitId ? circuitsMap.get(condCircuitId) : circObj;
        const condCircName = condCircObj ? condCircObj.name : circName;

        items.push({
          id: `${conduit.id}-c-${cIdx}`,
          levelName,
          spaceName,
          panelName,
          circuitName: condCircName,
          category: 'Conductor',
          elementName: `Cable ${roleLabel}`,
          material: 'Cobre electrolítico (IRAM NM 247-3)',
          sizeOrSection: `${cond.sectionMM2} mm²`,
          unit: 'm',
          quantity: Number(lengthM.toFixed(2)),
          status: condStatus,
          routingPlane: planeLabel
        });
      }
    }
  }

  // 2. Bocas Eléctricas, Cajas y Mecanismos
  for (const el of project.electricalElements) {
    if (el.isPanel) continue; // Los tableros se procesan aparte
    if (el.symbolId === 'sym-terminal-referencia' || el.isTerminalReference) continue; // Las etiquetas/remates de caño no son cajas físicas

    if (levelId && el.levelId !== levelId) continue;
    if (circuitId && el.circuitId !== circuitId) continue;

    const elStatus = el.status || 'proyectado';
    if (statusFilter && statusFilter.length > 0 && !statusFilter.includes(elStatus)) continue;

    const levelObj = levelsMap.get(el.levelId);
    const levelName = levelObj ? levelObj.name : 'Nivel 1';

    const spaceObj = el.spaceId ? spacesMap.get(el.spaceId) : undefined;
    const spaceName = spaceObj ? spaceObj.name : 'General';

    const circObj = el.circuitId ? circuitsMap.get(el.circuitId) : undefined;
    const circName = circObj ? circObj.name : 'Sin circuito';

    const panelObj = circObj ? panelsMap.get(circObj.panelId) : undefined;
    const panelName = panelObj ? panelObj.name : 'Tablero General';

    const sym = getSymbolById(el.symbolId);
    const symLabel = sym ? sym.label : el.symbolId;

    // Determinar tipo de caja física según montaje
    const boxType =
      el.placement === 'ceiling'
        ? 'Caja Octogonal Chica/Grande (Losa)'
        : el.placement === 'floor'
        ? 'Caja de Piso / Derivación'
        : 'Caja Rectangular 5x10 (Pared)';

    // Formatear atributos / mediciones de campo si existen
    let measurementsNotes = '';
    if (el.attributes && el.attributes.length > 0) {
      measurementsNotes = el.attributes
        .filter((a) => a.key && a.value)
        .map((a) => `${a.key}=${a.value}`)
        .join(' | ');
    }

    items.push({
      id: el.id,
      levelName,
      spaceName,
      panelName,
      circuitName: circName,
      category: 'Caja / Boca',
      elementName: symLabel,
      material: boxType,
      sizeOrSection: `Cota Z: ${el.heightZ.toFixed(2)}m`,
      unit: 'u',
      quantity: 1,
      status: elStatus,
      measurementsOrNotes: measurementsNotes || el.label || undefined
    });
  }

  // 3. Tableros y Gabinetes de Distribución
  for (const panel of project.panels || []) {
    if (panel.isPlaced === false) continue;
    if (levelId && panel.levelId !== levelId) continue;

    if (circuitId) {
      const circ = project.circuits.find((c) => c.id === circuitId);
      if (!circ || circ.panelId !== panel.id) continue;
    }

    const panelStatus = 'proyectado';
    if (statusFilter && statusFilter.length > 0 && !statusFilter.includes(panelStatus)) continue;

    const levelObj = levelsMap.get(panel.levelId);
    const levelName = levelObj ? levelObj.name : 'Nivel 1';

    const circCount = project.circuits.filter((c) => c.panelId === panel.id).length;
    const panelTypeLabel =
      panel.type === 'principal'
        ? 'Tablero Principal (TP)'
        : panel.type === 'seccional'
        ? 'Tablero Seccional (TS)'
        : 'Gabinete Auxiliar';

    items.push({
      id: panel.id,
      levelName,
      spaceName: 'Área de Tablero',
      panelName: panel.name,
      circuitName: `${circCount} circuitos`,
      category: 'Tablero',
      elementName: panelTypeLabel,
      material: 'Gabinete DIN Embutir / Superficie',
      sizeOrSection: panel.isThreePhase ? 'Trifásico (380V)' : 'Monofásico (220V)',
      unit: 'u',
      quantity: 1,
      status: panelStatus,
      measurementsOrNotes: panel.isThreePhase ? 'Trifásico (3F+N+PE)' : 'Monofásico (1F+N+PE)'
    });
  }

  return items;
}

/**
 * Genera el CSV en modo Plano (Flat Database para Excel / Power BI).
 */
export function generateFlatDatabaseCsv(
  items: DetailedMaterialItem[],
  delimiter: ';' | ',' = ';'
): string {
  const d = delimiter;
  const rows: string[] = [];

  const headers = [
    'Nivel',
    'Ambiente',
    'Tablero',
    'Circuito',
    'Categoria',
    'Elemento',
    'Material_o_Tipo',
    'Calibre_o_Dimension',
    'Unidad',
    'Cantidad',
    'Estado',
    'Plano_Tendido',
    'Mediciones_y_Notas'
  ];
  rows.push(headers.map((h) => `"${h}"`).join(d));

  for (const item of items) {
    const row = [
      `"${item.levelName.replace(/"/g, '""')}"`,
      `"${item.spaceName.replace(/"/g, '""')}"`,
      `"${item.panelName.replace(/"/g, '""')}"`,
      `"${item.circuitName.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      `"${item.elementName.replace(/"/g, '""')}"`,
      `"${item.material.replace(/"/g, '""')}"`,
      `"${item.sizeOrSection.replace(/"/g, '""')}"`,
      `"${item.unit}"`,
      item.quantity.toString().replace('.', delimiter === ';' ? ',' : '.'),
      `"${item.status}"`,
      `"${item.routingPlane || ''}"`,
      `"${(item.measurementsOrNotes || '').replace(/"/g, '""')}"`
    ];
    rows.push(row.join(d));
  }

  return rows.join('\r\n');
}

/**
 * Genera el CSV en modo Comercial Estructurado (Agrupado por capítulos para distribuidoras).
 */
export function generateCommercialTakeoffCsv(
  items: DetailedMaterialItem[],
  projectName: string,
  projectAreaM2: number,
  delimiter: ';' | ',' = ';'
): string {
  const d = delimiter;
  const rows: string[] = [];

  rows.push(`CÓMPUTO MÉTRICO DE MATERIALES ELÉCTRICOS`);
  rows.push(`Proyecto:${d}"${projectName}"`);
  rows.push(`Fecha de Emisión:${d}${new Date().toLocaleString('es-AR')}`);
  rows.push(`Superficie Relevada:${d}${projectAreaM2.toString().replace('.', delimiter === ';' ? ',' : '.')} m²`);
  rows.push(``);

  // 1. CANALIZACIONES AGRUPADAS POR MATERIAL Y CALIBRE
  rows.push(`1. CANALIZACIONES Y CAÑERÍAS`);
  rows.push(`Material${d}Calibre / Dimensión${d}Vía de Tendido${d}Metros Lineales (m)`);

  const conduitGroups = new Map<string, number>();
  for (const it of items.filter((i) => i.category === 'Canalización')) {
    const key = `${it.material}${d}${it.sizeOrSection}${d}${it.routingPlane || 'Pared'}`;
    conduitGroups.set(key, (conduitGroups.get(key) || 0) + it.quantity);
  }

  for (const [key, total] of conduitGroups.entries()) {
    rows.push(`${key}${d}${total.toFixed(2).replace('.', delimiter === ';' ? ',' : '.')}`);
  }
  rows.push(``);

  // 2. CONDUCTORES AGRUPADOS POR SECCIÓN Y TIPO
  rows.push(`2. CONDUCTORES Y CABLES DE COBRE`);
  rows.push(`Tipo de Cable${d}Sección (mm²)${d}Función / Rol${d}Metros Totales (m)`);

  const conductorGroups = new Map<string, number>();
  for (const it of items.filter((i) => i.category === 'Conductor')) {
    const key = `${it.material}${d}${it.sizeOrSection}${d}${it.elementName}`;
    conductorGroups.set(key, (conductorGroups.get(key) || 0) + it.quantity);
  }

  for (const [key, total] of conductorGroups.entries()) {
    rows.push(`${key}${d}${total.toFixed(2).replace('.', delimiter === ';' ? ',' : '.')}`);
  }
  rows.push(``);

  // 3. CAJAS FÍSICAS Y BOCAS DE PASO
  rows.push(`3. CAJAS FÍSICAS Y BOCAS DE SALIDA`);
  rows.push(`Formato de Caja${d}Consumo / Función${d}Cantidad (u)`);

  const boxGroups = new Map<string, number>();
  for (const it of items.filter((i) => i.category === 'Caja / Boca')) {
    const key = `${it.material}${d}${it.elementName}`;
    boxGroups.set(key, (boxGroups.get(key) || 0) + it.quantity);
  }

  for (const [key, total] of boxGroups.entries()) {
    rows.push(`${key}${d}${total}`);
  }
  rows.push(``);

  // 4. TABLEROS Y DISTRIBUIDORES
  const panelItems = items.filter((i) => i.category === 'Tablero');
  if (panelItems.length > 0) {
    rows.push(`4. TABLEROS Y GABINETES`);
    rows.push(`Tipo de Tablero${d}Gabinete / Montaje${d}Especificación${d}Cantidad (u)`);
    for (const p of panelItems) {
      rows.push(`"${p.elementName}"${d}"${p.material}"${d}"${p.sizeOrSection}"${d}${p.quantity}`);
    }
    rows.push(``);
  }

  // 5. MEDICIONES Y METADATOS TÉCNICOS DE CAMPO
  const withMeasurements = items.filter((i) => i.measurementsOrNotes && i.measurementsOrNotes.trim().length > 0);
  if (withMeasurements.length > 0) {
    rows.push(`5. MEDICIONES DE CAMPO Y ENSAYOS RELEVADOS`);
    rows.push(`Ambiente${d}Elemento${d}Medición / Ensayo Registrado`);
    for (const m of withMeasurements) {
      rows.push(`"${m.spaceName}"${d}"${m.elementName}"${d}"${m.measurementsOrNotes}"`);
    }
  }

  return rows.join('\r\n');
}

/**
 * Función principal que exporta el proyecto a CSV según las opciones especificadas.
 */
export function exportProjectToFlexibleCsv(
  project: BuildingProject,
  options?: CsvExportOptions
): string {
  const format = options?.format || 'commercial';
  const delimiter = options?.delimiter || ';';
  const items = extractDetailedMaterialItems(project, options);

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  let totalArea = 0;
  for (const space of project.spaces) {
    totalArea += calculatePolygonArea(resolveSpacePolygon(space, verticesMap));
  }

  if (format === 'flat_database') {
    return generateFlatDatabaseCsv(items, delimiter);
  }

  return generateCommercialTakeoffCsv(items, project.meta.name, Number(totalArea.toFixed(2)), delimiter);
}

/**
 * Disparador de descarga de archivo CSV flexible en el navegador.
 */
export function downloadFlexibleCsv(
  project: BuildingProject,
  options?: CsvExportOptions
): void {
  const csvContent = exportProjectToFlexibleCsv(project, options);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const format = options?.format || 'commercial';
  const sanitized = (project.meta.name || 'proyecto')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);

  const a = document.createElement('a');
  a.href = url;
  a.download = `computo_${sanitized}_${format}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
