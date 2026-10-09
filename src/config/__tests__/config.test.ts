import { describe, it, expect } from 'vitest';
import {
  AEA_GRID_CONSTANTS,
  AEA_VOLTAGE_DROP_LIMITS,
  AEA_CONDUIT_OCCUPANCY_LIMITS,
  AEA_MOUNTING_HEIGHTS,
  CAD_SNAP_CONFIG,
  CAD_VIEWPORT_CONFIG,
  ARCHITECTURAL_WALL_CONFIG,
  ARCHITECTURAL_OPENING_CONFIG,
  OPENING_TYPE_OPTIONS,
  OPENING_SWING_OPTIONS,
  CIRCUIT_TYPE_OPTIONS,
  PANEL_TYPE_OPTIONS,
  CONDUIT_ROUTING_PLANE_OPTIONS,
  CONDUIT_ROUTING_MODE_OPTIONS,
  CABLE_QUICK_SECTIONS,
  BREAKER_AMPERAGE_PRESETS,
  TERMINAL_REFERENCE_PRESETS,
  TERMINAL_METERS_PRESETS
} from '../index';

describe('Configuration Layer (src/config)', () => {
  describe('AEA Standards Configuration', () => {
    it('defines standard Argentine grid voltages and frequencies', () => {
      expect(AEA_GRID_CONSTANTS.DEFAULT_VOLTAGE_SINGLE_PHASE).toBe(220);
      expect(AEA_GRID_CONSTANTS.DEFAULT_VOLTAGE_THREE_PHASE).toBe(380);
      expect(AEA_GRID_CONSTANTS.GRID_FREQUENCY_HZ).toBe(50);
      expect(AEA_GRID_CONSTANTS.COPPER_CONDUCTIVITY_M_OHM_MM2).toBe(56);
    });

    it('defines valid AEA 771.19 voltage drop percentage limits', () => {
      expect(AEA_VOLTAGE_DROP_LIMITS.LIGHTING_CIRCUITS_MAX_PERCENT).toBe(3.0);
      expect(AEA_VOLTAGE_DROP_LIMITS.POWER_CIRCUITS_MAX_PERCENT).toBe(5.0);
      expect(AEA_VOLTAGE_DROP_LIMITS.MAIN_FEEDER_LP_MAX_PERCENT).toBe(1.0);
    });

    it('defines normalized conduit occupancy percentage limits (AEA 771.12.3)', () => {
      expect(AEA_CONDUIT_OCCUPANCY_LIMITS.SINGLE_CONDUCTOR_MAX_PERCENT).toBe(53);
      expect(AEA_CONDUIT_OCCUPANCY_LIMITS.TWO_CONDUCTORS_MAX_PERCENT).toBe(31);
      expect(AEA_CONDUIT_OCCUPANCY_LIMITS.THREE_OR_MORE_CONDUCTORS_MAX_PERCENT).toBe(35);
    });

    it('provides mounting height catalog with positive physical heights', () => {
      expect(AEA_MOUNTING_HEIGHTS.length).toBeGreaterThanOrEqual(5);
      for (const h of AEA_MOUNTING_HEIGHTS) {
        expect(h.heightM).toBeGreaterThan(0);
        expect(h.id).toBeTruthy();
        expect(h.label).toBeTruthy();
      }
    });
  });

  describe('CAD Viewport and Snap Configuration', () => {
    it('defines sensible tolerances for smart grips and polar snap', () => {
      expect(CAD_SNAP_CONFIG.VERTEX_TOLERANCE_M).toBeGreaterThan(0);
      expect(CAD_SNAP_CONFIG.WALL_SLIDE_TOLERANCE_M).toBeGreaterThan(0);
      expect(CAD_SNAP_CONFIG.ANGLE_TOLERANCE_DEG).toBeGreaterThan(0);
      expect(CAD_SNAP_CONFIG.GRID_STEP_M).toBe(0.05);
      expect(CAD_SNAP_CONFIG.NOTABLE_POLAR_ANGLES_DEG).toContain(0);
      expect(CAD_SNAP_CONFIG.NOTABLE_POLAR_ANGLES_DEG).toContain(90);
    });

    it('defines viewport scale parameters', () => {
      expect(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER).toBe(60);
      expect(CAD_VIEWPORT_CONFIG.MIN_ZOOM_PIXELS_PER_METER).toBeLessThan(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER);
      expect(CAD_VIEWPORT_CONFIG.MAX_ZOOM_PIXELS_PER_METER).toBeGreaterThan(CAD_VIEWPORT_CONFIG.DEFAULT_PIXELS_PER_METER);
    });
  });

  describe('Architectural Configuration', () => {
    it('defines wall thickness presets and standard heights', () => {
      expect(ARCHITECTURAL_WALL_CONFIG.DEFAULT_THICKNESS_M).toBe(0.15);
      expect(ARCHITECTURAL_WALL_CONFIG.THICKNESS_PRESETS).toContain(0.15);
      expect(ARCHITECTURAL_WALL_CONFIG.THICKNESS_PRESETS).toContain(0.30);
    });

    it('defines opening options and swing presets', () => {
      expect(OPENING_TYPE_OPTIONS.length).toBeGreaterThanOrEqual(3);
      expect(OPENING_SWING_OPTIONS.length).toBeGreaterThanOrEqual(4);
      expect(ARCHITECTURAL_OPENING_CONFIG.WIDTH_PRESETS).toContain(0.80);
    });
  });

  describe('Electrical Catalogs Configuration', () => {
    it('defines commercial cable sections and breaker amperage presets', () => {
      expect(CABLE_QUICK_SECTIONS).toEqual([1.5, 2.5, 4.0, 6.0, 10.0, 16.0]);
      expect(BREAKER_AMPERAGE_PRESETS).toContain(10);
      expect(BREAKER_AMPERAGE_PRESETS).toContain(16);
      expect(BREAKER_AMPERAGE_PRESETS).toContain(20);
    });

    it('defines circuit type and panel type options', () => {
      expect(CIRCUIT_TYPE_OPTIONS.map((c) => c.id)).toContain('IUG');
      expect(CIRCUIT_TYPE_OPTIONS.map((c) => c.id)).toContain('TUG');
      expect(PANEL_TYPE_OPTIONS.map((p) => p.id)).toContain('principal');
      expect(PANEL_TYPE_OPTIONS.map((p) => p.id)).toContain('seccional');
    });

    it('defines terminal reference and length presets', () => {
      expect(TERMINAL_REFERENCE_PRESETS.length).toBeGreaterThan(0);
      expect(TERMINAL_METERS_PRESETS.length).toBeGreaterThan(0);
    });

    it('defines conduit routing planes and modes', () => {
      expect(CONDUIT_ROUTING_PLANE_OPTIONS.map((p) => p.id)).toContain('ceiling_slab');
      expect(CONDUIT_ROUTING_PLANE_OPTIONS.map((p) => p.id)).toContain('wall');
      expect(CONDUIT_ROUTING_MODE_OPTIONS.map((m) => m.id)).toContain('orthogonal');
    });
  });
});
