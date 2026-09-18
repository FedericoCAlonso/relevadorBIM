/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useElectricalReportViewModel.ts (Arquitectura MVVM Estricta)
 * Motor de Memoria de Cálculo Eléctrico, Cuadro de Cargas y Verificación
 * Electromecánica con Parámetros Reales de Fabricante (AEA 90364-771 / IRAM).
 * 
 * Principios:
 * - Cero números mágicos en vistas.
 * - Cero juicio punitivo: verificación técnica objetiva e informativa.
 * - Soporta catálogos oficiales (IRAM, Prysmian, IMSA) y extensibles.
 * - Lógica desacoplada mediante función pura `computeElectricalReport`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback } from 'react';
import { useProjectStore } from './useProjectStore';
import type { BuildingProject, CircuitCalculationOverride } from '../models/architecture/BuildingProject';
import type { CircuitType } from '../models/electrical/ElectricalModel';
import type {
  InstallationMethodCode,
  CableManufacturerCatalog
} from '../models/electrical/cableManufacturerCatalog';
import {
  PRELOADED_CABLE_CATALOGS,
  IRAM_GENERIC_CATALOG,
  INSTALLATION_METHODS,
  calculateCorrectedAmpacity
} from '../models/electrical/cableManufacturerCatalog';
import { calculateVoltageDropPercent } from '../models/electrical/electricalPhysics';
import { calculateConduitRealLength } from '../models/electrical/conduitMetrics';
import { AEA_CALCULATION_CONSTANTS } from '../models/electrical/electricalStandards';

export interface CircuitCalculationReportRow {
  circuitId: string;
  circuitName: string;
  circuitType: CircuitType;
  panelId: string;
  panelName: string;
  voltageV: number;
  isThreePhase: boolean;
  wireSectionMM2: number;
  breakerAmperageA: number; // In
  connectedElementsCount: number;
  apparentPowerVA: number; // S
  activePowerW: number;    // P
  designCurrentA: number;  // Ib
  lengthM: number;         // L (m)
  isManualLength: boolean;

  // Parámetros de Fabricante
  catalogId: string;
  catalogName: string;
  catalogManufacturer: string;
  insulationType: 'PVC_70' | 'XLPE_90';
  installationMethod: InstallationMethodCode;
  installationMethodLabel: string;
  resistanceOhmKm: number; // R
  reactanceOhmKm: number;  // XL
  baseAmpacityA: number;   // Iz0
  temperatureFactor: number; // fT
  groupingFactor: number;    // fn
  correctedAmpacityA: number;// Iz

  // Verificación de Caída de Tensión
  cosPhi: number;
  deltaVVolts: number;
  deltaVPercent: number;
  maxAllowedDeltaVPercent: number;

  // Verificaciones Técnicas Objetivas
  isThermalVerified: boolean;      // Ib <= In <= Iz
  isVoltageDropVerified: boolean;  // DeltaV% <= DeltaV_max%
  notes?: string;
}

export interface ElectricalSummaryMetrics {
  totalCircuits: number;
  totalPanels: number;
  totalElements: number;
  totalApparentPowerVA: number;
  totalActivePowerKW: number;
  maxCircuitLengthM: number;
  maxVoltageDropPercent: number;
  worstVoltageDropCircuitName?: string;
  threePhasePanelsCount: number;
}

export interface ElectricalReportResult {
  reportRows: CircuitCalculationReportRow[];
  summary: ElectricalSummaryMetrics;
  activeCatalog: CableManufacturerCatalog;
  activeCatalogId: string;
  availableCatalogs: CableManufacturerCatalog[];
  ambientTempC: number;
  globalCosPhi: number;
}

/**
 * Obtiene el límite admisible de caída de tensión porcentual según el tipo de circuito.
 * AEA 90364-771:
 * - 1.0% para Líneas Principales y Seccionales (LP / LS alimentadores).
 * - 3.0% para Iluminación (IUG / IUE).
 * - 5.0% para Tomacorrientes y Fuerza Motriz (TUG / TUE / ACU / FM / OTRO).
 */
export function getMaxAllowedDeltaVPercent(type: CircuitType): number {
  switch (type) {
    case 'LP':
    case 'LS':
      return 1.0;
    case 'IUG':
    case 'IUE':
      return AEA_CALCULATION_CONSTANTS.MAX_VOLTAGE_DROP_LIGHTING_PERCENT; // 3.0%
    case 'TUG':
    case 'TUE':
    case 'ACU':
    case 'FM':
    case 'OTRO':
    default:
      return AEA_CALCULATION_CONSTANTS.MAX_VOLTAGE_DROP_POWER_PERCENT; // 5.0%
  }
}

/**
 * Estima la potencia aparente base reglamentaria (VA) de un circuito en función
 * de su uso y cantidad de bocas relevadas.
 */
export function estimateCircuitBaseLoadVA(type: CircuitType, elementsCount: number): number {
  switch (type) {
    case 'IUG':
    case 'IUE': {
      if (elementsCount <= 0) return 1000;
      // 150 VA por boca con factor de simultaneidad del 66% (mínimo 1000 VA reglamentario)
      const rawVA = elementsCount * AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_CENTRO_LUZ_W;
      return Math.max(1000, Math.min(2200, Math.round(rawVA * 0.66)));
    }
    case 'TUG': {
      // Tomacorrientes uso general: mínimo 2200 VA por circuito (hasta 15 bocas)
      if (elementsCount <= 0) return AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_TOMA_W;
      return Math.max(AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_TOMA_W, elementsCount * 220);
    }
    case 'TUE':
      return 3300; // 20A uso especial
    case 'ACU':
      return 2500; // Climatizador individual
    case 'FM':
      return 3500; // Bomba / motor
    case 'LP':
    case 'LS':
      return 7000; // Alimentador troncal estimado
    case 'OTRO':
    default:
      return 1500;
  }
}

/**
 * Función pura que calcula la memoria de cálculo eléctrico y cuadro de cargas
 * para un BuildingProject determinado.
 */
export function computeElectricalReport(project: BuildingProject): ElectricalReportResult {
  const electricalSettings = project.electricalSettings;

  const customCatalogs = electricalSettings?.customCableCatalogs || [];
  const availableCatalogs: CableManufacturerCatalog[] = [...PRELOADED_CABLE_CATALOGS, ...customCatalogs];

  const activeCatalogId = electricalSettings?.defaultCableCatalogId || IRAM_GENERIC_CATALOG.id;
  const activeCatalog =
    availableCatalogs.find((c) => c.id === activeCatalogId) || IRAM_GENERIC_CATALOG;

  const ambientTempC = electricalSettings?.ambientTempC ?? 40; // 40°C verano AEA
  const globalCosPhi =
    electricalSettings?.globalCosPhi ?? AEA_CALCULATION_CONSTANTS.DEFAULT_POWER_FACTOR_COS_PHI;

  const levelsMap = new Map(project.levels.map((l) => [l.id, l]));
  const elementsMap = new Map(project.electricalElements.map((e) => [e.id, e]));
  const panelsMap = new Map(project.panels.map((p) => [p.id, p]));

  const circuits = project.circuits || [];
  const overrides = electricalSettings?.circuitOverrides || {};

  const reportRows: CircuitCalculationReportRow[] = circuits.map((circuit) => {
    const panel = panelsMap.get(circuit.panelId) || project.panels[0];
    const override = overrides[circuit.id] || {};

    const isThreePhase = Boolean(
      panel?.isThreePhase && (circuit.type === 'LP' || circuit.type === 'LS' || circuit.type === 'FM')
    );

    const voltageV =
      circuit.voltageV ||
      (isThreePhase
        ? AEA_CALCULATION_CONSTANTS.VOLTAGE_THREE_PHASE_V
        : AEA_CALCULATION_CONSTANTS.VOLTAGE_SINGLE_PHASE_V);

    const connectedElements = project.electricalElements.filter(
      (e) => !e.isPanel && !e.isTerminalReference && e.symbolId !== 'sym-terminal-referencia' && e.circuitId === circuit.id
    );
    const circuitConduits = project.conduits.filter(
      (c) => c.circuitId === circuit.id || c.circuitIds?.includes(circuit.id)
    );

    // 1. CÓMPUTO DE LONGITUD FÍSICA 3D (L)
    let lengthM = 0;
    let isManualLength = false;

    if (typeof override.customLengthM === 'number' && override.customLengthM > 0) {
      lengthM = override.customLengthM;
      isManualLength = true;
    } else if (circuitConduits.length > 0) {
      for (const c of circuitConduits) {
        const fromEl = elementsMap.get(c.fromElementId);
        const toEl = elementsMap.get(c.toElementId);
        const len =
          c.manualLengthM ||
          (fromEl && toEl ? calculateConduitRealLength({ fromElement: fromEl, toElement: toEl, levelsMap }) : 0);
        lengthM += len;
      }
      lengthM = Number(lengthM.toFixed(2));
    } else if (connectedElements.length > 0 && panel) {
      let maxDist = 0;
      for (const el of connectedElements) {
        const dx = Math.abs(el.x - panel.x);
        const dy = Math.abs(el.y - panel.y);
        const dz = Math.abs((el.heightZ ?? 1.2) - (panel.heightZ ?? 1.4));
        const dist = (dx + dy + dz) * AEA_CALCULATION_CONSTANTS.CONDUIT_CURVE_MARGIN_FACTOR;
        if (dist > maxDist) maxDist = dist;
      }
      lengthM = Number(maxDist.toFixed(2));
    }

    // 2. CÓMPUTO DE POTENCIA (S, P) Y CORRIENTE DE PROYECTO (Ib)
    const cosPhi = typeof override.customCosPhi === 'number' ? override.customCosPhi : globalCosPhi;
    let designCurrentA = 0;
    let apparentPowerVA = 0;

    if (typeof override.customCurrentA === 'number' && override.customCurrentA > 0) {
      designCurrentA = override.customCurrentA;
      apparentPowerVA = isThreePhase
        ? Math.round(Math.sqrt(3) * voltageV * designCurrentA)
        : Math.round(voltageV * designCurrentA);
    } else {
      apparentPowerVA = estimateCircuitBaseLoadVA(circuit.type, connectedElements.length);
      const divisor = isThreePhase ? Math.sqrt(3) * voltageV : voltageV;
      designCurrentA = Number((apparentPowerVA / divisor).toFixed(1));
    }

    const activePowerW = Math.round(apparentPowerVA * cosPhi);

    // 3. PARÁMETROS DEL FABRICANTE DE CABLES
    const catalogToUse =
      availableCatalogs.find((c) => c.id === (override.customCatalogId || activeCatalogId)) || activeCatalog;

    let method: InstallationMethodCode = override.installationMethod || 'B2';
    if (!override.installationMethod) {
      const hasTray = circuitConduits.some(
        (c) => c.material === 'bandeja_perforada_20' || c.material === 'bandeja'
      );
      if (hasTray) method = 'E';
    }

    const methodDef = INSTALLATION_METHODS.find((m) => m.code === method) || INSTALLATION_METHODS[0];

    const sharedCircuits = new Set<string>([circuit.id]);
    for (const c of circuitConduits) {
      if (c.circuitId) sharedCircuits.add(c.circuitId);
      if (c.circuitIds) c.circuitIds.forEach((id) => sharedCircuits.add(id));
    }
    const circuitsInConduitCount = sharedCircuits.size;

    const corrected = calculateCorrectedAmpacity({
      sectionMM2: circuit.wireSectionBaseMM2,
      method,
      catalog: catalogToUse,
      circuitsCount: circuitsInConduitCount,
      ambientTempC
    });

    // 4. CÁLCULO DE CAÍDA DE TENSIÓN CON IMPEDANCIA COMPLEJA
    const vDrop = calculateVoltageDropPercent({
      currentA: designCurrentA,
      lengthM: lengthM > 0 ? lengthM : 1,
      sectionMM2: circuit.wireSectionBaseMM2,
      voltageV,
      isThreePhase,
      cosPhi,
      resistanceOhmKm: corrected.resistanceOhmKm,
      reactanceOhmKm: corrected.reactanceOhmKm
    });

    const maxAllowedDeltaVPercent = getMaxAllowedDeltaVPercent(circuit.type);
    const isVoltageDropVerified = lengthM > 0 ? vDrop.deltaVPercent <= maxAllowedDeltaVPercent : true;
    const isThermalVerified =
      designCurrentA <= circuit.breakerAmperageA && circuit.breakerAmperageA <= corrected.correctedAmpacityA;

    return {
      circuitId: circuit.id,
      circuitName: circuit.name,
      circuitType: circuit.type,
      panelId: circuit.panelId,
      panelName: panel?.name || 'Tablero Principal',
      voltageV,
      isThreePhase,
      wireSectionMM2: circuit.wireSectionBaseMM2,
      breakerAmperageA: circuit.breakerAmperageA,
      connectedElementsCount: connectedElements.length,
      apparentPowerVA,
      activePowerW,
      designCurrentA,
      lengthM,
      isManualLength,

      catalogId: catalogToUse.id,
      catalogName: catalogToUse.name,
      catalogManufacturer: catalogToUse.manufacturer,
      insulationType: catalogToUse.insulationType,
      installationMethod: method,
      installationMethodLabel: methodDef.label,
      resistanceOhmKm: corrected.resistanceOhmKm,
      reactanceOhmKm: corrected.reactanceOhmKm,
      baseAmpacityA: corrected.baseAmpacityA,
      temperatureFactor: corrected.temperatureFactor,
      groupingFactor: corrected.groupingFactor,
      correctedAmpacityA: corrected.correctedAmpacityA,

      cosPhi,
      deltaVVolts: lengthM > 0 ? vDrop.deltaVVolts : 0,
      deltaVPercent: lengthM > 0 ? vDrop.deltaVPercent : 0,
      maxAllowedDeltaVPercent,

      isThermalVerified,
      isVoltageDropVerified,
      notes: override.notes
    };
  });

  // Métricas de resumen
  let totalVA = 0;
  let totalW = 0;
  let maxLen = 0;
  let maxVDrop = 0;
  let worstName: string | undefined;

  for (const row of reportRows) {
    totalVA += row.apparentPowerVA;
    totalW += row.activePowerW;
    if (row.lengthM > maxLen) maxLen = row.lengthM;
    if (row.deltaVPercent > maxVDrop) {
      maxVDrop = row.deltaVPercent;
      worstName = row.circuitName;
    }
  }

  const threePhasePanels = project.panels.filter((p) => p.isThreePhase).length;

  const summary: ElectricalSummaryMetrics = {
    totalCircuits: reportRows.length,
    totalPanels: project.panels.length,
    totalElements: project.electricalElements.length,
    totalApparentPowerVA: totalVA,
    totalActivePowerKW: Number((totalW / 1000).toFixed(2)),
    maxCircuitLengthM: maxLen,
    maxVoltageDropPercent: maxVDrop,
    worstVoltageDropCircuitName: worstName,
    threePhasePanelsCount: threePhasePanels
  };

  return {
    reportRows,
    summary,
    activeCatalog,
    activeCatalogId: activeCatalog.id,
    availableCatalogs,
    ambientTempC,
    globalCosPhi
  };
}

/**
 * Hook React que expone el reporte de cálculo y acciones de configuración.
 */
export function useElectricalReportViewModel() {
  const {
    project,
    updateElectricalSettings,
    updateCircuitCalculationOverride
  } = useProjectStore();

  const report = useMemo(() => computeElectricalReport(project), [project]);

  const setActiveCatalogId = useCallback(
    (catalogId: string) => {
      updateElectricalSettings({ defaultCableCatalogId: catalogId });
    },
    [updateElectricalSettings]
  );

  const setAmbientTempC = useCallback(
    (tempC: number) => {
      updateElectricalSettings({ ambientTempC: tempC });
    },
    [updateElectricalSettings]
  );

  const setGlobalCosPhi = useCallback(
    (cosPhi: number) => {
      updateElectricalSettings({ globalCosPhi: cosPhi });
    },
    [updateElectricalSettings]
  );

  const saveCustomCatalog = useCallback(
    (catalog: CableManufacturerCatalog) => {
      const custom = project.electricalSettings?.customCableCatalogs || [];
      const filtered = custom.filter((c) => c.id !== catalog.id);
      updateElectricalSettings({
        customCableCatalogs: [...filtered, { ...catalog, isCustom: true }]
      });
    },
    [project.electricalSettings?.customCableCatalogs, updateElectricalSettings]
  );

  const setCircuitOverride = useCallback(
    (circuitId: string, patch: Partial<CircuitCalculationOverride>) => {
      updateCircuitCalculationOverride(circuitId, patch);
    },
    [updateCircuitCalculationOverride]
  );

  const exportReportCsv = useCallback(
    (delimiter: ';' | ',' = ';') => {
      const d = delimiter;
      const headers = [
        'Tablero',
        'Circuito',
        'Tipo',
        'Fases',
        'Tension_V',
        'Bocas',
        'Potencia_VA',
        'Potencia_W',
        'Cos_Phi',
        'Ib_A',
        'In_Termica_A',
        'Seccion_mm2',
        'Fabricante_Cable',
        'Metodo_Instalacion',
        'R_Ohm_km',
        'XL_Ohm_km',
        'Iz0_Base_A',
        'Factor_fT',
        'Factor_fn',
        'Iz_Corregida_A',
        'Longitud_L_m',
        'DeltaV_V',
        'DeltaV_Porc',
        'DeltaV_Max_Porc',
        'Verif_Termica',
        'Verif_DeltaV',
        'Notas'
      ];

      const lines: string[] = [
        `MEMORIA DE CÁLCULO Y CUADRO DE CARGAS ELÉCTRICAS (AEA 90364-771)`,
        `Proyecto: ${project.meta.name || 'Sin título'}${d}Fecha: ${new Date().toISOString().slice(0, 10)}`,
        `Instalador / Técnico: ${project.meta.electricianName || 'No especificado'}${d}Catálogo Base: ${report.activeCatalog.name}`,
        `Temp. Ambiente: ${report.ambientTempC}°C${d}Cos(phi) Global: ${report.globalCosPhi}`,
        '',
        headers.map((h) => `"${h}"`).join(d)
      ];

      for (const r of report.reportRows) {
        const row = [
          r.panelName,
          r.circuitName,
          r.circuitType,
          r.isThreePhase ? 'Trifásico (3F+N+PE)' : 'Monofásico (1F+N+PE)',
          r.voltageV,
          r.connectedElementsCount,
          r.apparentPowerVA,
          r.activePowerW,
          r.cosPhi.toFixed(2),
          r.designCurrentA.toFixed(1),
          r.breakerAmperageA,
          `${r.wireSectionMM2} mm²`,
          r.catalogName,
          r.installationMethodLabel,
          r.resistanceOhmKm.toFixed(3),
          r.reactanceOhmKm.toFixed(3),
          r.baseAmpacityA.toFixed(1),
          r.temperatureFactor.toFixed(2),
          r.groupingFactor.toFixed(2),
          r.correctedAmpacityA.toFixed(1),
          r.lengthM.toFixed(2),
          r.deltaVVolts.toFixed(2),
          `${r.deltaVPercent.toFixed(2)}%`,
          `${r.maxAllowedDeltaVPercent.toFixed(1)}%`,
          r.isThermalVerified ? 'Verificado (Ib <= In <= Iz)' : 'Revisar coordinación',
          r.isVoltageDropVerified ? 'Dentro de límite' : 'Excede límite admisible',
          r.notes || ''
        ];
        lines.push(row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(d));
      }

      const csvContent = lines.join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memoria_calculo_${(project.meta.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [project.meta.name, project.meta.electricianName, report]
  );

  return {
    ...report,
    setActiveCatalogId,
    setAmbientTempC,
    setGlobalCosPhi,
    saveCustomCatalog,
    setCircuitOverride,
    exportReportCsv
  };
}
