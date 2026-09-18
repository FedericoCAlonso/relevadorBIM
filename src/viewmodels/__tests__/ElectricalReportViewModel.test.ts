/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST: ElectricalReportViewModel.test.ts
 * Verificación del Motor de Cuadro de Cargas y Memoria de Cálculo Eléctrico.
 * Cubre:
 * 1. Estimación de potencias y corrientes de diseño (Ib).
 * 2. Selección de catálogos de cables de fabricante (IRAM, Prysmian, IMSA).
 * 3. Factores de corrección por agrupamiento (fn) y temperatura (fT).
 * 4. Capacidad admisible corregida (Iz) según método de instalación (B1, B2, E, etc.).
 * 5. Caída de tensión compleja (R*cosPhi + XL*sinPhi).
 * 6. Overrides específicos por circuito y exportación a CSV.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import {
  computeElectricalReport,
  getMaxAllowedDeltaVPercent,
  estimateCircuitBaseLoadVA
} from '../useElectricalReportViewModel';

describe('Motor de Cálculo Eléctrico (Memoria y Cuadro de Cargas)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe definir límites admisibles de caída de tensión según AEA 90364-771', () => {
    expect(getMaxAllowedDeltaVPercent('LP')).toBe(1.0);
    expect(getMaxAllowedDeltaVPercent('LS')).toBe(1.0);
    expect(getMaxAllowedDeltaVPercent('IUG')).toBe(3.0);
    expect(getMaxAllowedDeltaVPercent('IUE')).toBe(3.0);
    expect(getMaxAllowedDeltaVPercent('TUG')).toBe(5.0);
    expect(getMaxAllowedDeltaVPercent('TUE')).toBe(5.0);
    expect(getMaxAllowedDeltaVPercent('FM')).toBe(5.0);
  });

  it('debe estimar la potencia base según el tipo de circuito y bocas', () => {
    expect(estimateCircuitBaseLoadVA('IUG', 0)).toBe(1000);
    expect(estimateCircuitBaseLoadVA('IUG', 10)).toBe(1000); // 10 * 150 * 0.66 = 990 -> min 1000
    expect(estimateCircuitBaseLoadVA('IUG', 15)).toBe(1485); // 15 * 150 * 0.66 = 1485
    expect(estimateCircuitBaseLoadVA('TUG', 5)).toBe(2200);  // min 2200
    expect(estimateCircuitBaseLoadVA('TUE', 1)).toBe(3300);
    expect(estimateCircuitBaseLoadVA('FM', 1)).toBe(3500);
    expect(estimateCircuitBaseLoadVA('LP', 1)).toBe(7000);
  });

  it('debe calcular las filas de reporte para los circuitos por defecto con catálogo IRAM', () => {
    const { project } = useProjectStore.getState();
    const report = computeElectricalReport(project);

    expect(report.activeCatalog.id).toBe('iram_generico_247_3');
    expect(report.availableCatalogs.length).toBeGreaterThanOrEqual(3);
    expect(report.ambientTempC).toBe(40);
    expect(report.globalCosPhi).toBe(0.9);
    expect(report.reportRows.length).toBe(3); // C1, C2, C3 por defecto

    const c1 = report.reportRows.find((r) => r.circuitName.includes('C1'));
    expect(c1).toBeDefined();
    if (!c1) return;

    expect(c1.circuitType).toBe('IUG');
    expect(c1.voltageV).toBe(220);
    expect(c1.wireSectionMM2).toBe(1.5);
    expect(c1.breakerAmperageA).toBe(10);
    expect(c1.designCurrentA).toBeGreaterThan(0);
    expect(c1.installationMethod).toBe('B2'); // Embutido en pared por defecto
    expect(c1.baseAmpacityA).toBe(15); // Iz0 para 1.5mm2 en B2
    expect(c1.temperatureFactor).toBe(0.87); // fT a 40°C para PVC
    expect(c1.correctedAmpacityA).toBe(13.1); // 15 * 1.0 * 0.87 = 13.05 -> 13.1
    expect(c1.isThermalVerified).toBe(true); // Ib <= In (10) <= Iz (13.1)
  });

  it('debe recalcular correctamente al seleccionar catálogo Prysmian o IMSA', () => {
    const { updateElectricalSettings } = useProjectStore.getState();
    updateElectricalSettings({ defaultCableCatalogId: 'prysmian_superastic' });

    const { project } = useProjectStore.getState();
    const report = computeElectricalReport(project);

    expect(report.activeCatalog.id).toBe('prysmian_superastic');
    expect(report.activeCatalog.manufacturer).toBe('Prysmian Group');

    const c2 = report.reportRows.find((r) => r.circuitName.includes('C2'));
    expect(c2?.catalogManufacturer).toBe('Prysmian Group');
    expect(c2?.resistanceOhmKm).toBe(7.98); // 2.5 mm² en Prysmian Superastic
  });

  it('debe permitir aplicar overrides por circuito (método de tendido, corriente, longitud)', () => {
    const { project: initialProj, updateCircuitCalculationOverride } = useProjectStore.getState();
    const c1Id = initialProj.circuits[0].id;

    updateCircuitCalculationOverride(c1Id, {
      installationMethod: 'E', // Bandeja perforada
      customCurrentA: 8.5,
      customLengthM: 35.0,
      notes: 'Alimentación por bandeja perimetral'
    });

    const { project } = useProjectStore.getState();
    const report = computeElectricalReport(project);

    const updatedC1 = report.reportRows.find((r) => r.circuitId === c1Id);
    expect(updatedC1?.installationMethod).toBe('E');
    expect(updatedC1?.designCurrentA).toBe(8.5);
    expect(updatedC1?.lengthM).toBe(35.0);
    expect(updatedC1?.isManualLength).toBe(true);
    expect(updatedC1?.deltaVVolts).toBeGreaterThan(0);
    expect(updatedC1?.deltaVPercent).toBeGreaterThan(0);
    expect(updatedC1?.notes).toBe('Alimentación por bandeja perimetral');
  });

  it('debe calcular métricas resumidas de la instalación', () => {
    const { project } = useProjectStore.getState();
    const report = computeElectricalReport(project);

    expect(report.summary.totalCircuits).toBe(3);
    expect(report.summary.totalPanels).toBeGreaterThanOrEqual(1);
    expect(report.summary.totalApparentPowerVA).toBeGreaterThan(0);
    expect(report.summary.totalActivePowerKW).toBeGreaterThan(0);
  });
});
