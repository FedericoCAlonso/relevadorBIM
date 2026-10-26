import { describe, it, expect } from 'vitest';
import {
  resolvePanelSymbolId,
  isCeilingSymbol,
  computeTerminalReferenceBadge,
  computeConduitCanvasPath,
  resolveConduitVisualSpec
} from '../electricalCanvasModel';
import type { ElectricalElement, Conduit, Circuit } from '../ElectricalModel';
import { createDefaultLevel, type Level } from '../../architecture/Level';
import { CAD_ELECTRICAL_STYLES } from '../../../config';

describe('electricalCanvasModel - cálculos visuales de planta eléctrica', () => {
  it('resolvePanelSymbolId distingue principal y seccional y respeta override', () => {
    expect(resolvePanelSymbolId({ type: 'principal' })).toBe('sym-planta-tablero-principal');
    expect(resolvePanelSymbolId({ type: 'seccional' })).toBe('sym-planta-tablero-seccional');
    expect(resolvePanelSymbolId({ type: 'principal', symbolId: 'custom-sym' })).toBe('custom-sym');
  });

  it('isCeilingSymbol identifica bocas de techo y ventiladores', () => {
    expect(isCeilingSymbol('sym-planta-boca-techo')).toBe(true);
    expect(isCeilingSymbol('sym-ventilador-techo')).toBe(true);
    expect(isCeilingSymbol('sym-planta-toma')).toBe(false);
  });

  it('computeTerminalReferenceBadge formatea remates fijos y automáticos', () => {
    const lvl: Level = createDefaultLevel('L1', 'PB', 0);
    const levelsMap = new Map([['L1', lvl]]);
    const origin: ElectricalElement = {
      id: 'b1',
      symbolId: 'sym-planta-toma',
      levelId: 'L1',
      spaceId: 's1',
      placement: 'wall',
      x: 0,
      y: 0,
      heightZ: 0.3
    };
    const term: ElectricalElement = {
      id: 't1',
      symbolId: 'sym-terminal-referencia',
      levelId: 'L1',
      spaceId: 's1',
      placement: 'wall',
      x: 2,
      y: 0,
      heightZ: 0.3,
      isTerminalReference: true,
      totalLengthM: 12.5,
      targetDescription: 'A TP en SS',
      continuationConduitDiameterMM: 22,
      continuationConductorsCount: 4,
      continuationCableSectionMM2: 4
    };
    const elementsMap = new Map([
      ['b1', origin],
      ['t1', term]
    ]);
    const conduit: Conduit = {
      id: 'c1',
      fromElementId: 'b1',
      toElementId: 't1',
      fromLevelId: 'L1',
      toLevelId: 'L1',
      diameterMM: 19,
      material: 'pvc_rigido_metrico',
      isVerticalRiser: false,
      conductors: []
    };

    const badge = computeTerminalReferenceBadge({
      element: term,
      conduits: [conduit],
      elementsMap,
      levelsMap
    });
    expect(badge.isFixedLength).toBe(true);
    expect(badge.totalLengthM).toBe(12.5);
    expect(badge.targetText).toBe('A TP en SS');
    expect(badge.specText).toBe('Ø22mm · L=12.5m [Fijo] · 4x4mm²');
    expect(badge.boxWidthPx).toBeGreaterThanOrEqual(CAD_ELECTRICAL_STYLES.terminalMinBoxWidthPx);
  });

  it('computeConduitCanvasPath soporta arco esquemático, losa directa y pared ortogonal', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 80 };

    const arc = computeConduitCanvasPath({
      p1,
      p2,
      conduit: { routingMode: 'schematic_arc', routingPlane: 'wall' },
      zoom: 50
    });
    expect(arc?.pathD).toContain(' Q ');

    const slab = computeConduitCanvasPath({
      p1,
      p2,
      conduit: { routingMode: 'orthogonal', routingPlane: 'ceiling_slab' },
      zoom: 50
    });
    expect(slab?.pathD).toBe('M 0.0 0.0 L 100.0 80.0');

    const wall = computeConduitCanvasPath({
      p1,
      p2,
      conduit: { routingMode: 'orthogonal', routingPlane: 'wall' },
      zoom: 50
    });
    expect(wall?.pathD).toContain('M 0.0 0.0');
    expect(computeConduitCanvasPath({ p1, p2: p1, conduit: {}, zoom: 50 })).toBeNull();
  });

  it('resolveConduitVisualSpec asigna glifos, trazos y colores según circuito y material', () => {
    const circuits: Circuit[] = [
      {
        id: 'cir1',
        panelId: 'p1',
        name: 'C1 - TUG',
        type: 'TUG',
        voltageV: 220,
        wireSectionBaseMM2: 2.5,
        breakerAmperageA: 16,
        color: '#16a34a'
      }
    ];
    const spec = resolveConduitVisualSpec(
      {
        material: 'corrugado_blanco_pvc',
        diameterMM: 19,
        routingPlane: 'ceiling_slab',
        circuitId: 'cir1'
      },
      circuits,
      false
    );
    expect(spec.strokeColor).toBe('#16a34a');
    expect(spec.planeGlyph).toBe('☁');
    expect(spec.strokeDasharray).toBe(CAD_ELECTRICAL_STYLES.conduitDashCorrugated);
    expect(spec.labelText).toBe('C1 · Ø19mm');
  });
});
