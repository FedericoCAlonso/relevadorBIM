import { describe, it, expect } from 'vitest';
import {
  INSTALLATION_METHODS,
  IRAM_GENERIC_CATALOG,
  PRYSMIAN_SUPERASTIC_CATALOG,
  IMSA_PLASVINIL_CATALOG,
  calculateGroupingFactor,
  calculateTemperatureFactor,
  calculateCorrectedAmpacity
} from '../cableManufacturerCatalog';
import { calculateVoltageDropPercent } from '../electricalPhysics';

describe('cableManufacturerCatalog & AEA/IEC Normative Modifiers', () => {
  it('debe contener los métodos normalizados de instalación reglamentarios (B1, B2, C, D1, D2, E, F)', () => {
    const codes = INSTALLATION_METHODS.map((m) => m.code);
    expect(codes).toContain('B1');
    expect(codes).toContain('B2');
    expect(codes).toContain('C');
    expect(codes).toContain('D1');
    expect(codes).toContain('D2');
    expect(codes).toContain('E');
    expect(codes).toContain('F');
  });

  it('debe tener datos de resistencia y reactancia técnica para los catálogos de fabricante', () => {
    for (const catalog of [IRAM_GENERIC_CATALOG, PRYSMIAN_SUPERASTIC_CATALOG, IMSA_PLASVINIL_CATALOG]) {
      expect(catalog.rows.length).toBeGreaterThanOrEqual(9);
      const row2_5 = catalog.rows.find((r) => r.sectionMM2 === 2.5);
      expect(row2_5).toBeDefined();
      expect(row2_5!.resistanceOhmKm).toBeCloseTo(7.98, 1);
      expect(row2_5!.reactanceOhmKm).toBeGreaterThan(0.08);
      expect(row2_5!.baseAmpacityA.B2).toBeGreaterThanOrEqual(20);
    }
  });

  describe('calculateGroupingFactor (fn según AEA 771.19.V)', () => {
    it('debe retornar 1.0 para 1 circuito único', () => {
      expect(calculateGroupingFactor(1)).toBe(1.0);
    });

    it('debe reducir a 0.80 para 2 circuitos que comparten cañería', () => {
      expect(calculateGroupingFactor(2)).toBe(0.80);
    });

    it('debe reducir a 0.70 para 3 circuitos', () => {
      expect(calculateGroupingFactor(3)).toBe(0.70);
    });

    it('debe reducir a 0.50 para 9 o más circuitos', () => {
      expect(calculateGroupingFactor(9)).toBe(0.50);
      expect(calculateGroupingFactor(15)).toBe(0.50);
    });
  });

  describe('calculateTemperatureFactor (fT según AEA 771.19.VI)', () => {
    it('debe retornar 1.00 para 30°C en aire (condición base de referencia)', () => {
      expect(calculateTemperatureFactor(30, 'PVC_70')).toBe(1.00);
      expect(calculateTemperatureFactor(30, 'XLPE_90')).toBe(1.00);
    });

    it('debe penalizar por encima de 30°C para cables de PVC', () => {
      expect(calculateTemperatureFactor(35, 'PVC_70')).toBe(0.94);
      expect(calculateTemperatureFactor(40, 'PVC_70')).toBe(0.87);
    });

    it('debe bonificar si la temperatura ambiente es menor a 30°C', () => {
      expect(calculateTemperatureFactor(25, 'PVC_70')).toBe(1.06);
    });
  });

  describe('calculateCorrectedAmpacity', () => {
    it('debe calcular Iz base para cañería embutida B2 sin factores reductores', () => {
      const res = calculateCorrectedAmpacity({
        sectionMM2: 2.5,
        method: 'B2',
        catalog: IRAM_GENERIC_CATALOG,
        circuitsCount: 1,
        ambientTempC: 30
      });

      expect(res.baseAmpacityA).toBe(20.0);
      expect(res.correctedAmpacityA).toBe(20.0);
      expect(res.groupingFactor).toBe(1.0);
      expect(res.temperatureFactor).toBe(1.0);
    });

    it('debe aplicar reducciones conjuntas por agrupamiento y temperatura', () => {
      // 2 circuitos en el mismo caño (fn = 0.80) y temp 40°C (fT = 0.87)
      // Iz = 20.0 * 0.80 * 0.87 = 13.92 A
      const res = calculateCorrectedAmpacity({
        sectionMM2: 2.5,
        method: 'B2',
        catalog: IRAM_GENERIC_CATALOG,
        circuitsCount: 2,
        ambientTempC: 40
      });

      expect(res.groupingFactor).toBe(0.80);
      expect(res.temperatureFactor).toBe(0.87);
      expect(res.correctedAmpacityA).toBe(13.9);
    });

    it('debe dar mayor corriente admisible para método en bandeja perforada (E) que embutido (B2)', () => {
      const b2 = calculateCorrectedAmpacity({ sectionMM2: 4.0, method: 'B2', catalog: PRYSMIAN_SUPERASTIC_CATALOG });
      const e = calculateCorrectedAmpacity({ sectionMM2: 4.0, method: 'E', catalog: PRYSMIAN_SUPERASTIC_CATALOG });

      expect(e.baseAmpacityA).toBeGreaterThan(b2.baseAmpacityA);
    });
  });

  describe('calculateVoltageDropPercent con impedancia de fabricante', () => {
    it('debe calcular Delta V con fórmula de impedancia (R y X) con alta precisión', () => {
      // L = 30m, I = 16A, 220V 1~, cosPhi = 0.90, cable 2.5 mm² (R = 7.98, X = 0.109 Ohm/km)
      const res = calculateVoltageDropPercent({
        currentA: 16,
        lengthM: 30,
        sectionMM2: 2.5,
        voltageV: 220,
        cosPhi: 0.90,
        resistanceOhmKm: 7.98,
        reactanceOhmKm: 0.109
      });

      // sinPhi = sqrt(1 - 0.9^2) = 0.435889
      // zEff = 7.98 * 0.90 + 0.109 * 0.435889 = 7.182 + 0.0475 = 7.2295 Ohm/km
      // Delta V = 2 * 16 * (30/1000) * 7.2295 = 0.96 * 7.2295 = 6.94 V
      // Delta V % = (6.94 / 220) * 100 = 3.15%
      expect(res.deltaVVolts).toBeCloseTo(6.94, 1);
      expect(res.deltaVPercent).toBeCloseTo(3.15, 1);
      expect(res.isCompliant).toBe(false); // supera el 3% de luz
    });

    it('debe mantener compatibilidad con el cálculo por conductividad si no se pasa R', () => {
      const res = calculateVoltageDropPercent({
        currentA: 10,
        lengthM: 20,
        sectionMM2: 2.5,
        voltageV: 220,
        cosPhi: 0.90
      });

      expect(res.deltaVVolts).toBeGreaterThan(0);
      expect(res.deltaVPercent).toBeLessThan(3.0);
      expect(res.isCompliant).toBe(true);
    });
  });
});
