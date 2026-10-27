/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BlueprintPrintModal.tsx
 * Lámina Técnica Oficial de Relevamiento de Obra e Impresión / PDF.
 * Integra:
 * 1. Encuadre geométrico en escuadra vectorial puro (muros, aberturas, bocas, cañerías).
 * 2. Carátula Normalizada (Rótulo IRAM / AEA con datos de obra, matrícula y comitente).
 * 3. Cuadro Resumen de Cargas y Grado de Electrificación AEA 90364-7-770/771.
 * 4. Leyenda de Simbología Normalizada.
 * 5. Disparador directo a vista de impresión y guardado como PDF (`window.print()`).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo, useRef } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import {
  computeBlueprintViewBox,
  calculateBlueprintAeaMetrics,
  formatBlueprintDate,
  type BlueprintSheetMetadata
} from '../../../services/blueprintExportService';
import { computeResolvedWallPolygons } from '../../../models/architecture/WallCornerEngine';
import {
  resolveSpacePolygon,
  calculatePolygonArea,
  calculatePolygonCentroid
} from '../../../models/architecture/Space';
import { getOpeningJambs, getDoorSwingGeometry } from '../../../models/architecture/Opening';
import { getWallSideOffsets } from '../../../models/architecture/Wall';
import { computeOrthogonalConduitPoints, generateMetersPolylineSvgPath } from '../../../models/electrical/cadGeometry';
import { getSymbolById } from '../../../models/electrical/symbolsLib';
import type { SpatialElectricalNode } from '../../../models/electrical/ElectricalModel';
import {
  Printer,
  X,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface BlueprintPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlueprintPrintModal: React.FC<BlueprintPrintModalProps> = ({ isOpen, onClose }) => {
  const { project } = useProjectStore();
  const printSheetRef = useRef<HTMLDivElement>(null);

  const activeLevelId = project.activeLevelId;
  const activeLevel = project.levels.find((l) => l.id === activeLevelId);
  const levelName = activeLevel?.name || 'Planta General';

  // Configuración de Rótulo editable
  const [metadata, setMetadata] = useState<BlueprintSheetMetadata>({
    projectName: project.meta?.name || 'Relevamiento de Obra',
    clientName: project.meta?.clientName || 'Propietario / Comitente',
    location: project.meta?.address || 'CABA / Buenos Aires',
    electricianName: project.meta?.electricianName || 'Técnico Relevador',
    licenseNumber: 'COPIME / Matrícula Profesional',
    levelName,
    scale: '1:50',
    date: formatBlueprintDate(new Date()),
    regulationsRef: 'Norma AEA 90364-7-770 / 771',
    notes: 'Plano de relevamiento electromecánico y arquitectura existente/proyectada.'
  });

  // Opciones de visualización
  const [colorMode, setColorMode] = useState<'technical' | 'cad'>('technical');
  const [showDimensions, setShowDimensions] = useState(true);
  const [showAeaTable, setShowAeaTable] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);

  // Derivaciones y cálculos
  const viewBox = useMemo(
    () => computeBlueprintViewBox(project, activeLevelId),
    [project, activeLevelId]
  );

  const aeaMetrics = useMemo(
    () => calculateBlueprintAeaMetrics(project, activeLevelId),
    [project, activeLevelId]
  );

  const verticesMap = useMemo(
    () => new Map(project.vertices.map((v) => [v.id, v])),
    [project.vertices]
  );

  const levelWalls = useMemo(
    () => project.walls.filter((w) => w.levelId === activeLevelId),
    [project.walls, activeLevelId]
  );

  const wallPolygons = useMemo(
    () => computeResolvedWallPolygons(levelWalls, verticesMap),
    [levelWalls, verticesMap]
  );

  const wallsMap = useMemo(
    () => new Map(levelWalls.map((w) => [w.id, w])),
    [levelWalls]
  );

  const levelOpenings = useMemo(
    () => project.openings.filter((o) => wallsMap.has(o.wallId)),
    [project.openings, wallsMap]
  );

  const levelSpaces = useMemo(
    () => project.spaces.filter((s) => s.levelId === activeLevelId),
    [project.spaces, activeLevelId]
  );

  const levelPanels = useMemo(
    () => (project.panels || []).filter((p) => p.levelId === activeLevelId && p.isPlaced !== false),
    [project.panels, activeLevelId]
  );

  const levelElements = useMemo(
    () => (project.electricalElements || []).filter((e) => e.levelId === activeLevelId),
    [project.electricalElements, activeLevelId]
  );

  const elementsMap = useMemo(
    () =>
      new Map<string, SpatialElectricalNode>([
        ...levelPanels.map((p) => [p.id, p] as const),
        ...levelElements.map((e) => [e.id, e] as const)
      ]),
    [levelPanels, levelElements]
  );

  const levelConduits = useMemo(
    () =>
      (project.conduits || []).filter(
        (c) => c.fromLevelId === activeLevelId || c.toLevelId === activeLevelId
      ),
    [project.conduits, activeLevelId]
  );

  const levelDimensions = useMemo(
    () => (project.dimensions || []).filter((d) => d.levelId === activeLevelId),
    [project.dimensions, activeLevelId]
  );

  const circuitsMap = useMemo(
    () => new Map((project.circuits || []).map((c) => [c.id, c])),
    [project.circuits]
  );

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isTechnical = colorMode === 'technical';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col z-50 overflow-hidden">
      {/* ─── BARRA DE CONTROL SUPERIOR (NO IMPRIMIBLE) ─── */}
      <header className="no-print bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between shadow-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base leading-tight">
              Lámina Técnica de Obra & Impresión PDF
            </h2>
            <p className="text-[11px] text-slate-400">
              Formato reglamentario con Carátula IRAM y Cuadro de Cargas AEA 90364
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Imprimir / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer text-xs"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimir / Guardar como PDF</span>
            <span className="sm:hidden">Imprimir</span>
          </button>

          {/* Cerrar */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="Cerrar vista previa"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* ─── BARRA DE OPCIONES RÁPIDAS (NO IMPRIMIBLE) ─── */}
      <div className="no-print bg-slate-800/90 border-b border-slate-700/60 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Modo de color */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setColorMode('technical')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                isTechnical
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Técnico B/N
            </button>
            <button
              type="button"
              onClick={() => setColorMode('cad')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                !isTechnical
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              CAD Color
            </button>
          </div>

          {/* Toggles de elementos */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(e) => setShowDimensions(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span>Cotas</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAeaTable}
              onChange={(e) => setShowAeaTable(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span>Cuadro AEA</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showLegend}
              onChange={(e) => setShowLegend(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span>Simbología</span>
          </label>
        </div>

        {/* Editor de Carátula */}
        <button
          type="button"
          onClick={() => setShowMetadataEditor(!showMetadataEditor)}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
        >
          <Sliders size={13} />
          <span>Datos de Carátula</span>
          {showMetadataEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ─── PANEL DESPLEGABLE DE EDICIÓN DE METADATOS (NO IMPRIMIBLE) ─── */}
      {showMetadataEditor && (
        <div className="no-print bg-slate-900 border-b border-slate-700 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300 animate-in slide-in-from-top duration-150 flex-shrink-0">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Nombre de Obra / Proyecto:</label>
            <input
              type="text"
              value={metadata.projectName}
              onChange={(e) => setMetadata({ ...metadata, projectName: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Propietario / Comitente:</label>
            <input
              type="text"
              value={metadata.clientName}
              onChange={(e) => setMetadata({ ...metadata, clientName: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Ubicación / Dirección:</label>
            <input
              type="text"
              value={metadata.location}
              onChange={(e) => setMetadata({ ...metadata, location: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Instalador / Electricista:</label>
            <input
              type="text"
              value={metadata.electricianName}
              onChange={(e) => setMetadata({ ...metadata, electricianName: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Matrícula Profesional / Registro:</label>
            <input
              type="text"
              value={metadata.licenseNumber}
              onChange={(e) => setMetadata({ ...metadata, licenseNumber: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Escala en Plano:</label>
            <input
              type="text"
              value={metadata.scale}
              onChange={(e) => setMetadata({ ...metadata, scale: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Fecha:</label>
            <input
              type="text"
              value={metadata.date}
              onChange={(e) => setMetadata({ ...metadata, date: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Norma de Referencia:</label>
            <input
              type="text"
              value={metadata.regulationsRef}
              onChange={(e) => setMetadata({ ...metadata, regulationsRef: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
        </div>
      )}

      {/* ─── CONTENEDOR DE LA LÁMINA (PRINT CONTAINER) ─── */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950/60">
        <div
          id="blueprint-print-container"
          ref={printSheetRef}
          className="bg-white text-slate-900 shadow-2xl rounded-sm w-full max-w-[1200px] aspect-[1.414/1] flex flex-col p-4 border-[2px] border-slate-900 print:w-full print:h-full print:max-w-none print:shadow-none print:p-0 print:border-none print:aspect-auto"
        >
          {/* Recuadro Técnico IRAM: Margen izquierdo 25mm para encarpetar, 10mm demás */}
          <div className="flex-1 flex flex-col border-[2px] border-slate-900 overflow-hidden relative p-2">
            
            {/* 1. TÍTULO DE LÁMINA / CABECERA TÉCNICA */}
            <div className="flex items-center justify-between border-b-[2px] border-slate-900 pb-1.5 mb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-sm tracking-wider uppercase">RELEVADOR BIM</span>
                <span className="text-xs text-slate-600 font-medium">| {metadata.projectName}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-800">
                <span>PLANTA: {levelName.toUpperCase()}</span>
                <span>ESCALA: {metadata.scale}</span>
              </div>
            </div>

            {/* 2. ÁREA CENTRAL: PLANO CAD SVG + PANELES LATERALES */}
            <div className="flex-1 flex gap-2 min-h-0 overflow-hidden relative">
              
              {/* LIENZO CAD VECTORIAL DE LA PLANTA */}
              <div className="flex-1 border border-slate-400 bg-white relative overflow-hidden flex items-center justify-center">
                <svg
                  className="w-full h-full select-none"
                  viewBox={viewBox.svgViewBox}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Patrón de cuadrícula métrica técnica muy sutil */}
                  <defs>
                    <pattern id="print-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                      <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e2e8f0" strokeWidth="0.02" />
                    </pattern>
                  </defs>
                  <rect
                    x={viewBox.minX}
                    y={viewBox.minY}
                    width={viewBox.width}
                    height={viewBox.height}
                    fill="url(#print-grid)"
                  />

                  {/* A. AMBIENTES (SPACES) */}
                  {levelSpaces.map((space) => {
                    const poly = resolveSpacePolygon(space, verticesMap);
                    if (poly.length < 3) return null;
                    const area = calculatePolygonArea(poly);
                    const centroid = calculatePolygonCentroid(poly);
                    const pointsStr = poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

                    return (
                      <g key={space.id}>
                        <polygon
                          points={pointsStr}
                          fill={isTechnical ? '#f8fafc' : '#eff6ff'}
                          stroke="#cbd5e1"
                          strokeWidth="0.02"
                          strokeDasharray="0.06 0.04"
                        />
                        <text
                          x={centroid.x}
                          y={centroid.y - 0.12}
                          textAnchor="middle"
                          fontSize="0.28"
                          fontWeight="bold"
                          fill="#1e293b"
                          fontFamily="sans-serif"
                        >
                          {space.name}
                        </text>
                        <text
                          x={centroid.x}
                          y={centroid.y + 0.22}
                          textAnchor="middle"
                          fontSize="0.22"
                          fill="#475569"
                          fontFamily="sans-serif"
                        >
                          {area.toFixed(2)} m²
                        </text>
                      </g>
                    );
                  })}

                  {/* B. MUROS FÍSICOS (WALLS) */}
                  {levelWalls.map((wall) => {
                    const poly = wallPolygons.get(wall.id);
                    if (!poly || poly.length < 3) return null;
                    const pointsStr = poly.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');

                    return (
                      <polygon
                        key={wall.id}
                        points={pointsStr}
                        fill={isTechnical ? '#0f172a' : '#1e293b'}
                        stroke="#000000"
                        strokeWidth="0.02"
                      />
                    );
                  })}

                  {/* C. ABERTURAS (OPENINGS) */}
                  {levelOpenings.map((opening) => {
                    const wall = wallsMap.get(opening.wallId);
                    if (!wall) return null;
                    const jambs = getOpeningJambs(opening, wall, verticesMap);
                    if (!jambs) return null;

                    const dx = jambs.jamb2.x - jambs.jamb1.x;
                    const dy = jambs.jamb2.y - jambs.jamb1.y;
                    const wM = Math.hypot(dx, dy);
                    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

                    const { leftOffset, rightOffset } = getWallSideOffsets(wall);

                    if (opening.type === 'door') {
                      const swing = getDoorSwingGeometry(opening.swing, wM, leftOffset, rightOffset);
                      return (
                        <g
                          key={opening.id}
                          transform={`translate(${jambs.jamb1.x}, ${jambs.jamb1.y}) rotate(${angleDeg})`}
                        >
                          {/* Hueco en muro */}
                          <rect
                            x={0}
                            y={Math.min(leftOffset, rightOffset)}
                            width={wM}
                            height={Math.abs(leftOffset - rightOffset)}
                            fill="#ffffff"
                          />
                          {/* Hoja de puerta */}
                          <line
                            x1={swing.hingeX}
                            y1={swing.hingeY}
                            x2={swing.hingeX}
                            y2={swing.leafY}
                            stroke="#0f172a"
                            strokeWidth="0.03"
                          />
                          {/* Arco de batiente */}
                          <path
                            d={swing.arcPath}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="0.02"
                            strokeDasharray="0.04 0.04"
                          />
                        </g>
                      );
                    }

                    // Ventana
                    return (
                      <g
                        key={opening.id}
                        transform={`translate(${jambs.jamb1.x}, ${jambs.jamb1.y}) rotate(${angleDeg})`}
                      >
                        <rect
                          x={0}
                          y={Math.min(leftOffset, rightOffset)}
                          width={wM}
                          height={Math.abs(leftOffset - rightOffset)}
                          fill="#ffffff"
                          stroke="#0f172a"
                          strokeWidth="0.02"
                        />
                        <line
                          x1={0}
                          y1={(leftOffset + rightOffset) / 2}
                          x2={wM}
                          y2={(leftOffset + rightOffset) / 2}
                          stroke="#2563eb"
                          strokeWidth="0.02"
                        />
                      </g>
                    );
                  })}

                  {/* D. CANALIZACIONES ELÉCTRICAS (CONDUITS) */}
                  {levelConduits.map((conduit) => {
                    const elFrom = elementsMap.get(conduit.fromElementId);
                    const elTo = elementsMap.get(conduit.toElementId);
                    if (!elFrom || !elTo) return null;

                    const waypoints = (conduit.waypoints || []).map((w) => ({ x: w.x, y: w.y }));
                    const points = computeOrthogonalConduitPoints(elFrom, elTo, waypoints);
                    const pathD = generateMetersPolylineSvgPath(points, 0.15);

                    const circuit = conduit.circuitId ? circuitsMap.get(conduit.circuitId) : undefined;
                    const strokeColor = isTechnical
                      ? '#0f172a'
                      : circuit?.type === 'IUG'
                      ? '#2563eb'
                      : circuit?.type === 'TUG'
                      ? '#059669'
                      : '#d97706';

                    const isCeiling = conduit.routingPlane === 'ceiling_slab';
                    const isFloor = conduit.routingPlane === 'floor_slab';

                    return (
                      <g key={conduit.id}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="0.035"
                          strokeDasharray={
                            isCeiling
                              ? undefined
                              : isFloor
                              ? '0.12 0.04 0.03 0.04'
                              : '0.08 0.04'
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    );
                  })}

                  {/* E1. TABLEROS ELÉCTRICOS (PANELS) */}
                  {levelPanels.map((panel) => (
                    <g key={panel.id} transform={`translate(${panel.x}, ${panel.y})`}>
                      <rect
                        x={-0.30}
                        y={-0.18}
                        width={0.60}
                        height={0.36}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth="0.04"
                      />
                      <line
                        x1={-0.30}
                        y1={-0.18}
                        x2={0.30}
                        y2={0.18}
                        stroke="#000000"
                        strokeWidth="0.03"
                      />
                      <text
                        x={0}
                        y={0.38}
                        textAnchor="middle"
                        fontSize="0.22"
                        fontWeight="bold"
                        fill="#000000"
                      >
                        {panel.name || 'TP'}
                      </text>
                    </g>
                  ))}

                  {/* E2. BOCAS DE SALIDA (ELECTRICAL ELEMENTS) */}
                  {levelElements.map((el) => {
                    const circuit = el.circuitId ? circuitsMap.get(el.circuitId) : undefined;
                    const symDef = getSymbolById(el.symbolId);

                    return (
                      <g key={el.id} transform={`translate(${el.x}, ${el.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={0.18}
                          fill="#ffffff"
                          stroke="#000000"
                          strokeWidth="0.035"
                        />
                        {symDef?.svgContent ? (
                          <g
                            transform="scale(0.12)"
                            dangerouslySetInnerHTML={{ __html: symDef.svgContent }}
                            stroke="#000000"
                            strokeWidth="0.03"
                            fill="none"
                          />
                        ) : (
                          <line x1={-0.12} y1={0} x2={0.12} y2={0} stroke="#000000" strokeWidth="0.03" />
                        )}
                        <text
                          x={0.24}
                          y={-0.12}
                          fontSize="0.20"
                          fontWeight="bold"
                          fill="#0f172a"
                          fontFamily="sans-serif"
                        >
                          {circuit ? `[${circuit.name.split(' ')[0]}] ` : ''}
                          {el.label || ''}
                        </text>
                      </g>
                    );
                  })}

                  {/* F. COTAS MÉTRICAS (DIMENSIONS) */}
                  {showDimensions &&
                    levelDimensions.map((dim) => {
                      const dx = dim.p2.x - dim.p1.x;
                      const dy = dim.p2.y - dim.p1.y;
                      const lengthM = Math.hypot(dx, dy);
                      const midX = (dim.p1.x + dim.p2.x) / 2;
                      const midY = (dim.p1.y + dim.p2.y) / 2;

                      return (
                        <g key={dim.id}>
                          <line
                            x1={dim.p1.x}
                            y1={dim.p1.y}
                            x2={dim.p2.x}
                            y2={dim.p2.y}
                            stroke="#64748b"
                            strokeWidth="0.02"
                          />
                          <text
                            x={midX}
                            y={midY - 0.08}
                            textAnchor="middle"
                            fontSize="0.20"
                            fontWeight="bold"
                            fill="#334155"
                          >
                            {lengthM.toFixed(2)} m
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>

              {/* COLUMNA LATERAL DERECHA: CUADRO AEA + SIMBOLOGÍA */}
              {(showAeaTable || showLegend) && (
                <div className="w-[280px] flex flex-col gap-2 border border-slate-900 p-2 bg-slate-50 text-[10px] leading-tight">
                  {/* CUADRO SÍNTESIS AEA 90364 */}
                  {showAeaTable && (
                    <div className="border border-slate-400 bg-white p-2 rounded-xs">
                      <div className="font-extrabold text-[11px] text-slate-900 border-b border-slate-900 pb-1 mb-1.5 uppercase">
                        Síntesis AEA 90364-7-771
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Sup. Límite Reglamentaria:</span>
                          <strong className="text-slate-900 font-mono">
                            {aeaMetrics.limitSurfaceM2.toFixed(1)} m²
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Grado de Electrificación:</span>
                          <strong className="text-blue-800 uppercase font-bold">
                            {aeaMetrics.electrificationDegree.label}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Circuitos Mínimos / Proyectados:</span>
                          <strong className="text-slate-900 font-mono">
                            {aeaMetrics.electrificationDegree.minCircuits} mín / {aeaMetrics.circuitsCount} proy
                          </strong>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1">
                          <span className="text-slate-600">Total Bocas de Salida:</span>
                          <strong className="text-slate-900 font-mono">{aeaMetrics.totalBocas} bocas</strong>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 pl-2">
                          <span>IUG (Luz): {aeaMetrics.bocasByType['IUG'] || 0}</span>
                          <span>TUG (Tomas): {aeaMetrics.bocasByType['TUG'] || 0}</span>
                          <span>TUE: {aeaMetrics.bocasByType['TUE'] || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CUADRO DE CIRCUITOS */}
                  {showAeaTable && aeaMetrics.circuitsSummary.length > 0 && (
                    <div className="border border-slate-400 bg-white p-2 rounded-xs flex-1 overflow-hidden">
                      <div className="font-extrabold text-[10px] text-slate-900 border-b border-slate-900 pb-0.5 mb-1 uppercase">
                        Planilla de Circuitos
                      </div>
                      <div className="overflow-y-auto max-h-[140px] space-y-1 pr-1">
                        {aeaMetrics.circuitsSummary.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between border-b border-slate-100 pb-0.5"
                          >
                            <span className="font-bold truncate max-w-[120px]">{c.name}</span>
                            <span className="font-mono text-slate-600 text-[9px]">
                              {c.sectionMM2}mm² · In={c.breakerInA}A ({c.elementsCount}b)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* REFERENCIAS SIMBÓLICAS */}
                  {showLegend && (
                    <div className="border border-slate-400 bg-white p-2 rounded-xs">
                      <div className="font-extrabold text-[10px] text-slate-900 border-b border-slate-900 pb-0.5 mb-1 uppercase">
                        Referencias Simbólicas
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-black flex items-center justify-center font-bold text-[7px]">
                            L
                          </div>
                          <span>Boca Techo IUG</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-black bg-slate-300" />
                          <span>Tomacorriente TUG</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-2 border border-black bg-white" />
                          <span>Tablero (TP / TS)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-0.5 bg-black" />
                          <span>Caño en Losa</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-0.5 border-b border-dashed border-black" />
                          <span>Caño en Pared</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-0.5 border-b border-dotted border-black" />
                          <span>Caño en Piso</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. RÓTULO / CARÁTULA NORMALIZADA (ESTÁNDAR TÉCNICO IRAM) */}
            <footer className="mt-2 border-[2px] border-slate-900 grid grid-cols-4 sm:grid-cols-6 divide-x-[2px] divide-slate-900 bg-white text-[10px] leading-tight font-sans">
              
              {/* Celda 1: Proyecto & Comitente */}
              <div className="col-span-2 p-1.5 space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                  Obra / Proyecto & Comitente
                </span>
                <div className="font-extrabold text-xs text-slate-900 truncate">
                  {metadata.projectName}
                </div>
                <div className="text-slate-600 truncate">{metadata.clientName}</div>
                <div className="text-[9px] text-slate-500 truncate">{metadata.location}</div>
              </div>

              {/* Celda 2: Instalador & Matrícula */}
              <div className="col-span-2 p-1.5 space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                  Responsable Técnico / Matrícula
                </span>
                <div className="font-bold text-slate-900 truncate">{metadata.electricianName}</div>
                <div className="text-blue-900 font-mono text-[9px] truncate">
                  {metadata.licenseNumber}
                </div>
                <div className="text-[9px] text-slate-500 truncate">{metadata.regulationsRef}</div>
              </div>

              {/* Celda 3: Escala & Fecha */}
              <div className="p-1.5 space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                  Escala / Fecha
                </span>
                <div className="font-extrabold text-slate-900 font-mono">{metadata.scale}</div>
                <div className="text-slate-600 font-mono">{metadata.date}</div>
              </div>

              {/* Celda 4: Plano & Firma */}
              <div className="p-1.5 space-y-0.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    Lámina N°
                  </span>
                  <div className="font-extrabold text-xs text-slate-900">ELEC-01</div>
                </div>
                <div className="border-t border-slate-300 pt-1 text-[8px] text-center text-slate-400">
                  Firma y Sello
                </div>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};
