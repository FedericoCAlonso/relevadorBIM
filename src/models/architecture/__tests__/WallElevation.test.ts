import { describe, it, expect } from 'vitest';
import type { Wall, WallVertex } from '../Wall';
import type { Opening } from '../Opening';
import type { Space } from '../Space';
import type { Conduit, ElectricalElement, Panel, ProjectMaterialCatalog } from '../../electrical/ElectricalModel';
import { createDefaultMaterialCatalog } from '../../electrical/electricalStandards';
import {
  alongWallToScreenX,
  buildWallElevation,
  computeNodeMoveFromElevation,
  computeOpeningUpdateFromElevation,
  getDefaultElevationFace,
  projectOnWall,
  getWallAxisFrame,
  resolveBoxGeometry,
  snapElevationHeight,
  formatElevationLevel,
  CONDUIT_ELEVATION_LAYOUT,
  type BuildWallElevationParams
} from '../wallElevation';
import { fitViewBox, fitWallViewBox, panViewBox, zoomViewBox, ELEVATION_VIEWPORT_CONSTANTS } from '../elevationViewport';
import { resolveConduitColor, WALL_ELEVATION_STYLE } from '../wallElevationStyle';

// Muro horizontal de 4 m sobre +X, espesor 0.20, altura 2.80: normal izquierda = +Y.
const vertices = new Map<string, WallVertex>([
  ['a', { id: 'a', x: 1, y: 2 }],
  ['b', { id: 'b', x: 5, y: 2 }]
]);

const baseWall: Wall = {
  id: 'w1',
  levelId: 'lvl',
  startVertexId: 'a',
  endVertexId: 'b',
  thickness: 0.2,
  height: 2.8
};

function makeElement(over: Partial<ElectricalElement> & { id: string }): ElectricalElement {
  return {
    levelId: 'lvl',
    spaceId: 's',
    x: 2,
    y: 2.1,
    heightZ: 0.3,
    wallId: 'w1',
    side: 'left',
    symbolId: 'sym-planta-toma',
    placement: 'wall',
    label: 'TUG 1',
    ...over
  } as ElectricalElement;
}

const door: Opening = {
  id: 'o1',
  wallId: 'w1',
  type: 'door',
  width: 0.8,
  height: 2.05,
  sill: 0,
  distanceAlongWall: 0.5,
  swing: 'left_in',
  label: 'P1'
};

function params(over: Partial<BuildWallElevationParams> = {}): BuildWallElevationParams {
  return {
    wall: baseWall,
    vertices,
    face: 'right',
    openings: [],
    elements: [],
    panels: [],
    conduits: [],
    circuits: [],
    spaces: [],
    catalog: createDefaultMaterialCatalog(),
    ...over
  };
}

describe('Proyección base del alzado', () => {
  it('es una involución: la cara izquierda refleja la coordenada X', () => {
    expect(alongWallToScreenX(1, 4, 'right')).toBe(1);
    expect(alongWallToScreenX(1, 4, 'left')).toBe(3);
    expect(alongWallToScreenX(alongWallToScreenX(1.3, 4, 'left'), 4, 'left')).toBeCloseTo(1.3, 9);
  });

  it('proyecta un punto de planta sobre el eje (u a lo largo, v perpendicular)', () => {
    const frame = getWallAxisFrame(baseWall, vertices)!;
    const { u, v } = projectOnWall({ x: 3, y: 2.1 }, frame);
    expect(u).toBeCloseTo(2, 9);
    expect(v).toBeCloseTo(0.1, 9);
  });

  it('elige la cara por defecto hacia el ambiente asignado', () => {
    expect(getDefaultElevationFace({ ...baseWall, leftSpaceId: 'x' })).toBe('left');
    expect(getDefaultElevationFace({ ...baseWall, rightSpaceId: 'x' })).toBe('right');
    expect(getDefaultElevationFace({ ...baseWall, justification: 'exterior' })).toBe('right');
    expect(getDefaultElevationFace(baseWall)).toBe('left');
  });

  it('devuelve null con muro degenerado', () => {
    const degenerate = new Map(vertices);
    degenerate.set('b', { id: 'b', x: 1, y: 2 });
    expect(buildWallElevation(params({ vertices: degenerate }))).toBeNull();
  });
});

describe('Aberturas en el alzado', () => {
  it('cara derecha: X = distancia al vértice inicial', () => {
    const elev = buildWallElevation(params({ openings: [door], face: 'right' }))!;
    expect(elev.openings[0].xLeft).toBeCloseTo(0.5, 9);
    expect(elev.openings[0].zTop).toBeCloseTo(2.05, 9);
  });

  it('cara izquierda: la abertura se refleja respecto a L', () => {
    const elev = buildWallElevation(params({ openings: [door], face: 'left' }))!;
    expect(elev.openings[0].xLeft).toBeCloseTo(4 - 0.5 - 0.8, 9);
  });

  it('el rectángulo de dibujo usa Y = H - Z', () => {
    const win: Opening = { ...door, id: 'o2', type: 'window', sill: 0.9, height: 1.1, distanceAlongWall: 1 };
    const rect = buildWallElevation(params({ openings: [win] }))!.openings[0].rect;
    expect(rect.y).toBeCloseTo(2.8 - 2.0, 9);
    expect(rect.height).toBeCloseTo(1.1, 9);
  });

  it('ignora aberturas de otros muros', () => {
    const other: Opening = { ...door, id: 'ox', wallId: 'otro' };
    expect(buildWallElevation(params({ openings: [other] }))!.openings).toHaveLength(0);
  });
});

describe('Cajas y gabinetes en el alzado', () => {
  it('solo muestra bocas de la cara observada', () => {
    const left = makeElement({ id: 'e-left', side: 'left' });
    const right = makeElement({ id: 'e-right', side: 'right', y: 1.9 });
    expect(buildWallElevation(params({ elements: [left, right], face: 'left' }))!.boxes.map((b) => b.id)).toEqual(['e-left']);
    expect(buildWallElevation(params({ elements: [left, right], face: 'right' }))!.boxes.map((b) => b.id)).toEqual(['e-right']);
  });

  it('infere la cara por el signo perpendicular si falta `side`', () => {
    const el = makeElement({ id: 'e1', side: undefined, y: 1.9 });
    expect(buildWallElevation(params({ elements: [el], face: 'right' }))!.boxes).toHaveLength(1);
  });

  it('ubica la caja a escala real: 5x10 cm centrada en (u, Z)', () => {
    const el = makeElement({ id: 'e1', x: 3, heightZ: 1.2, side: 'right', y: 1.9, boxTypeId: 'caja_rectangular_chapa' });
    const box = buildWallElevation(params({ elements: [el], face: 'right' }))!.boxes[0];
    expect(box.centerX).toBeCloseTo(2, 9);
    expect(box.width).toBeCloseTo(0.05, 9);
    expect(box.height).toBeCloseTo(0.1, 9);
    expect(box.rect.y).toBeCloseTo(2.8 - 1.25, 9);
    expect(box.knockouts).toHaveLength(2);
  });

  it('descarta referencias terminales y bocas de otro nivel', () => {
    const ref = makeElement({ id: 'ref', isTerminalReference: true });
    const otherLevel = makeElement({ id: 'lvl2', levelId: 'otro' });
    expect(buildWallElevation(params({ elements: [ref, otherLevel] }))!.boxes).toHaveLength(0);
  });

  it('incluye tableros ubicados como gabinetes', () => {
    const panel = {
      id: 'p1',
      name: 'TP',
      type: 'principal',
      levelId: 'lvl',
      spaceId: 's',
      x: 2,
      y: 2.1,
      heightZ: 1.4,
      wallId: 'w1',
      side: 'left',
      isPlaced: true,
      incomings: []
    } as Panel;
    const box = buildWallElevation(params({ panels: [panel], face: 'left' }))!.boxes[0];
    expect(box.kind).toBe('panel');
    expect(box.shape).toBe('cabinet');
    expect(box.width).toBeCloseTo(0.3, 9);
  });

  it('resuelve dimensiones del catálogo y cae a la categoría si faltan', () => {
    const catalog: ProjectMaterialCatalog = {
      ...createDefaultMaterialCatalog(),
      boxTypes: [{ id: 'custom', name: 'Custom', category: 'caja_cuadrada', widthMM: 120, heightMM: 150, isCustom: true }]
    };
    const custom = resolveBoxGeometry({ boxTypeId: 'custom', isPanel: false, catalog });
    expect(custom.widthM).toBeCloseTo(0.12, 9);
    expect(custom.heightM).toBeCloseTo(0.15, 9);
    const noDims: ProjectMaterialCatalog = {
      ...catalog,
      boxTypes: [{ id: 'old', name: 'Old', category: 'caja_octogonal' }]
    };
    const old = resolveBoxGeometry({ boxTypeId: 'old', isPanel: false, catalog: noDims });
    expect(old.shape).toBe('octagon');
    expect(old.widthM).toBeCloseTo(0.075, 9);
  });

  it('deduce la caja por familia de símbolo cuando no hay boxTypeId', () => {
    expect(resolveBoxGeometry({ symbolId: 'sym-planta-toma', isPanel: false }).category).toBe('caja_rectangular');
    expect(resolveBoxGeometry({ symbolId: 'sym-planta-boca-techo', isPanel: false }).category).toBe('caja_octogonal');
    expect(resolveBoxGeometry({ isPanel: true }).category).toBe('gabinete_tablero');
    expect(resolveBoxGeometry({ symbolId: 'inexistente', isPanel: false }).category).toBe('caja_rectangular');
  });
});

describe('Canalizaciones en el alzado', () => {
  const a = makeElement({ id: 'a', x: 2, heightZ: 0.3, side: 'left' });
  const b = makeElement({ id: 'b', x: 4, heightZ: 1.2, side: 'left' });
  const baseConduit: Conduit = {
    id: 'c1',
    fromElementId: 'a',
    toElementId: 'b',
    fromLevelId: 'lvl',
    toLevelId: 'lvl',
    diameterMM: 19,
    material: 'hierro_semipesado_rs',
    isVerticalRiser: false,
    conductors: [],
    routingPlane: 'wall'
  };

  it('vía pared: recorrido ortogonal entre ambas cajas', () => {
    const c = buildWallElevation(params({ elements: [a, b], conduits: [baseConduit], face: 'left' }))!.conduits[0];
    expect(c.segments).toHaveLength(1);
    const pts = c.segments[0];
    expect(pts).toHaveLength(3);
    expect(pts[0].x).toBeCloseTo(pts[1].x, 9);
    expect(pts[1].y).toBeCloseTo(pts[2].y, 9);
    expect(c.widthM).toBeCloseTo(0.019, 9);
  });

  it('vía losa: cada extremo sube hasta el cielorraso', () => {
    const elev = buildWallElevation(
      params({ elements: [a], conduits: [{ ...baseConduit, routingPlane: 'ceiling_slab' }], face: 'left' })
    )!;
    const pts = elev.conduits[0].segments[0];
    expect(pts[1].y).toBeCloseTo(elev.ceilingY, 9);
    expect(pts[0].y).toBeGreaterThan(pts[1].y);
  });

  it('vía losa con ambas cajas en el paramento: dibuja un chicote por extremo', () => {
    const elev = buildWallElevation(
      params({ elements: [a, b], conduits: [{ ...baseConduit, routingPlane: 'ceiling_slab' }], face: 'left' })
    )!;
    const segs = elev.conduits[0].segments;
    expect(segs).toHaveLength(2);
    expect(segs[0][0].x).not.toBeCloseTo(segs[1][0].x, 3);
    segs.forEach((s) => expect(s[1].y).toBeCloseTo(elev.ceilingY, 9));
  });

  it('vía contrapiso: baja hasta el piso', () => {
    const elev = buildWallElevation(
      params({ elements: [a], conduits: [{ ...baseConduit, routingPlane: 'floor_slab' }], face: 'left' })
    )!;
    expect(elev.conduits[0].segments[0][1].y).toBeCloseTo(elev.drawingHeightM, 9);
  });

  it('omite tramos cuyos extremos no están en este paramento', () => {
    const elev = buildWallElevation(params({ elements: [a], conduits: [baseConduit], face: 'left' }))!;
    expect(elev.conduits).toHaveLength(0);
  });

  it('dos conductos entre las mismas cajas corren en paralelo sin superponerse', () => {
    const second: Conduit = { ...baseConduit, id: 'c2', fromElementId: 'b', toElementId: 'a' };
    const elev = buildWallElevation(params({ elements: [a, b], conduits: [baseConduit, second], face: 'left' }))!;
    expect(elev.conduits).toHaveLength(2);
    const [p1, p2] = elev.conduits.map((c) => c.segments[0]);
    const gap = CONDUIT_ELEVATION_LAYOUT.PARALLEL_GAP_M;
    expect(Math.abs(p1[1].y - p2[1].y)).toBeCloseTo(gap, 9);
    p1.forEach((pt, i) => {
      expect(pt.x === p2[i].x && pt.y === p2[i].y).toBe(false);
    });
  });

  it('un conducto solo no se desplaza respecto del eje de las cajas', () => {
    const elev = buildWallElevation(params({ elements: [a, b], conduits: [baseConduit], face: 'left' }))!;
    const box = elev.boxes.find((x) => x.id === 'b')!;
    expect(elev.conduits[0].segments[0][2].y).toBeCloseTo(box.rect.cy, 9);
  });

  it('cajas a la misma altura: tramo recto horizontal y paralelos separados en Y', () => {
    const c1 = makeElement({ id: 'c1', x: 2, heightZ: 1.2, side: 'left' });
    const c2 = makeElement({ id: 'c2', x: 2.5, heightZ: 1.2, side: 'left' });
    const x1: Conduit = { ...baseConduit, id: 'x1', fromElementId: 'c1', toElementId: 'c2' };
    const x2: Conduit = { ...baseConduit, id: 'x2', fromElementId: 'c1', toElementId: 'c2' };
    const elev = buildWallElevation(params({ elements: [c1, c2], conduits: [x1, x2], face: 'left' }))!;
    const [s1, s2] = elev.conduits.map((c) => c.segments[0]);
    expect(s1).toHaveLength(2);
    expect(s1[0].y).toBeCloseTo(s1[1].y, 9);
    expect(Math.abs(s1[0].y - s2[0].y)).toBeCloseTo(CONDUIT_ELEVATION_LAYOUT.PARALLEL_GAP_M, 9);
  });

  it('colorea por circuito o, si no hay, por material', () => {
    expect(resolveConduitColor('#123456', 'x')).toBe('#123456');
    expect(resolveConduitColor(undefined, 'corrugado_naranja')).toBe(WALL_ELEVATION_STYLE.conduit.byMaterial.corrugado_naranja);
    expect(resolveConduitColor(undefined, 'desconocido')).toBe(WALL_ELEVATION_STYLE.conduit.fallback);
  });
});

describe('Cotas automáticas y niveles', () => {
  it('encadena cotas horizontales sumando la longitud total del muro', () => {
    const el = makeElement({ id: 'e1', x: 4, side: 'right', y: 1.9 });
    const elev = buildWallElevation(params({ openings: [door], elements: [el], face: 'right' }))!;
    const total = elev.dimensionChain.reduce((acc, s) => acc + s.lengthM, 0);
    expect(total).toBeCloseTo(4, 6);
    expect(elev.dimensionChain[0].x1).toBe(0);
    expect(elev.dimensionChain.at(-1)!.x2).toBeCloseTo(4, 9);
  });

  it('genera cotas de nivel para NPT, cajas, vanos y altura de muro sin duplicados', () => {
    const el = makeElement({ id: 'e1', heightZ: 1.1, side: 'right', y: 1.9 });
    const elev = buildWallElevation(params({ openings: [door], elements: [el], face: 'right' }))!;
    const labels = elev.levelMarks.map((m) => m.label);
    expect(labels).toEqual(['+0.00', '+1.10', '+2.05', '+2.80']);
  });

  it('formatea cotas negativas', () => {
    expect(formatElevationLevel(-0.2)).toBe('-0.20');
  });
});

describe('Muros bajos y cielorraso', () => {
  it('en muro bajo dibuja hasta el cielorraso del ambiente adyacente', () => {
    const low: Wall = { ...baseWall, wallType: 'low_wall', height: 1.0, leftSpaceId: 'sp' };
    const space = { id: 'sp', ceilingHeight: 2.6 } as Space;
    const elev = buildWallElevation(params({ wall: low, spaces: [space], face: 'left' }))!;
    expect(elev.wallHeightM).toBe(1.0);
    expect(elev.ceilingZ).toBe(2.6);
    expect(elev.drawingHeightM).toBe(2.6);
    expect(elev.wallRect.y).toBeCloseTo(1.6, 9);
  });

  it('en muro estándar el cielorraso coincide con la altura del muro', () => {
    const elev = buildWallElevation(params())!;
    expect(elev.ceilingZ).toBe(2.8);
    expect(elev.ceilingY).toBe(0);
  });
});

describe('Snap de alturas de montaje', () => {
  it('imanta a presets AEA dentro de tolerancia', () => {
    expect(snapElevationHeight(0.33, 2.8)).toEqual({ z: 0.3, guideZ: 0.3 });
    expect(snapElevationHeight(1.17, 2.8)).toEqual({ z: 1.2, guideZ: 1.2 });
  });

  it('fuera de tolerancia redondea al centímetro sin guía', () => {
    expect(snapElevationHeight(0.6004, 2.8)).toEqual({ z: 0.6, guideZ: null });
  });

  it('no imanta a presets por encima del límite', () => {
    expect(snapElevationHeight(2.19, 1.0).guideZ).toBeNull();
  });
});

describe('Traducción de ediciones del alzado a planta', () => {
  const node = makeElement({ id: 'e1', x: 2, y: 2.1, side: 'left', heightZ: 0.3 });

  it('mover en el alzado y reconstruirlo devuelve la misma posición (ida y vuelta)', () => {
    for (const face of ['left', 'right'] as const) {
      const n = makeElement({ id: 'e1', x: 2, y: face === 'left' ? 2.1 : 1.9, side: face });
      const move = computeNodeMoveFromElevation({
        node: n,
        wall: baseWall,
        vertices,
        face,
        boxWidthM: 0.05,
        boxHeightM: 0.1,
        targetX: 1.5,
        targetZ: 1.1
      })!;
      const moved = { ...n, ...move };
      const box = buildWallElevation(params({ elements: [moved], face }))!.boxes[0];
      expect(box.centerX).toBeCloseTo(1.5, 6);
      expect(box.centerZ).toBeCloseTo(1.1, 6);
    }
  });

  it('conserva la separación perpendicular y actualiza wallOffset', () => {
    const move = computeNodeMoveFromElevation({
      node,
      wall: baseWall,
      vertices,
      face: 'left',
      boxWidthM: 0.05,
      boxHeightM: 0.1,
      targetX: 1,
      targetZ: 0.9
    })!;
    expect(move.y).toBeCloseTo(2.1, 6);
    expect(move.wallOffset).toBeCloseTo(3, 6);
    expect(move.x).toBeCloseTo(4, 6);
  });

  it('limita la caja dentro del paramento', () => {
    const move = computeNodeMoveFromElevation({
      node,
      wall: baseWall,
      vertices,
      face: 'right',
      boxWidthM: 0.3,
      boxHeightM: 0.4,
      targetX: -5,
      targetZ: 99
    })!;
    expect(move.wallOffset).toBeCloseTo(0.15, 6);
    expect(move.heightZ).toBeCloseTo(2.8 - 0.2, 6);
  });

  it('edita aberturas manteniendo coherencia entre caras', () => {
    const upd = computeOpeningUpdateFromElevation({
      opening: door,
      wallLengthM: 4,
      wallHeightM: 2.8,
      face: 'left',
      patch: { xLeft: 0.4 }
    });
    // Cara izquierda: xLeft = L - d - w -> d = 4 - 0.4 - 0.8 = 2.8
    expect(upd.distanceAlongWall).toBeCloseTo(2.8, 9);
    const back = buildWallElevation(params({ openings: [{ ...door, ...upd }], face: 'left' }))!.openings[0];
    expect(back.xLeft).toBeCloseTo(0.4, 9);
  });

  it('al cambiar el ancho en cara izquierda se conserva la esquina izquierda visible', () => {
    const upd = computeOpeningUpdateFromElevation({
      opening: door,
      wallLengthM: 4,
      wallHeightM: 2.8,
      face: 'left',
      patch: { width: 1.2 }
    });
    const back = buildWallElevation(params({ openings: [{ ...door, ...upd }], face: 'left' }))!.openings[0];
    expect(back.xLeft).toBeCloseTo(4 - 0.5 - 0.8, 9);
    expect(back.width).toBeCloseTo(1.2, 9);
  });

  it('valida alto, antepecho y posición contra los límites del muro', () => {
    const upd = computeOpeningUpdateFromElevation({
      opening: door,
      wallLengthM: 4,
      wallHeightM: 2.8,
      face: 'right',
      patch: { height: 9, sill: 9, xLeft: 99, width: 0.01 }
    });
    expect(upd.height).toBe(2.8);
    expect(upd.sill).toBe(0);
    expect(upd.width).toBe(0.3);
    expect(upd.distanceAlongWall).toBeCloseTo(3.7, 9);
  });
});

describe('Encuadre del visor', () => {
  const bounds = { x: -1, y: -1, width: 6, height: 4 };

  it('zoom conserva el punto focal y la relación de aspecto', () => {
    const focus = { x: 2, y: 1 };
    const vb = zoomViewBox(bounds, 2, focus, bounds);
    expect(vb.width).toBeCloseTo(3, 9);
    expect(vb.height / vb.width).toBeCloseTo(4 / 6, 9);
    expect((focus.x - vb.x) / vb.width).toBeCloseTo((focus.x - bounds.x) / bounds.width, 9);
  });

  it('limita el zoom al mínimo físico y al máximo alejamiento', () => {
    expect(zoomViewBox(bounds, 1e9, { x: 0, y: 0 }, bounds).width).toBe(ELEVATION_VIEWPORT_CONSTANTS.MIN_VIEW_WIDTH_M);
    expect(zoomViewBox(bounds, 1e-9, { x: 0, y: 0 }, bounds).width).toBeCloseTo(
      bounds.width * ELEVATION_VIEWPORT_CONSTANTS.MAX_ZOOM_OUT_RATIO,
      9
    );
  });

  it('pan desplaza el encuadre en sentido contrario al gesto y fit restituye', () => {
    const panned = panViewBox(bounds, 1, -2);
    expect(panned.x).toBe(-2);
    expect(panned.y).toBe(1);
    expect(fitViewBox(bounds)).toEqual(bounds);
  });

  it('fitWallViewBox genera un encuadre ajustado al cuerpo del muro ideal para celulares', () => {
    const wallVb = fitWallViewBox(4.0, 2.8, 2.8, 0.20);
    expect(wallVb.x).toBe(-0.20);
    expect(wallVb.y).toBe(-0.20);
    expect(wallVb.width).toBeCloseTo(4.4, 9);
    expect(wallVb.height).toBeCloseTo(3.55, 9);
  });
});

describe('Rotación y orientación de cajas en alzado', () => {
  it('soporta rotación horizontal alternando ancho y alto en caja rectangular', () => {
    const vertical = resolveBoxGeometry({
      symbolId: 'sym-planta-toma',
      isPanel: false,
      boxOrientation: 'vertical'
    });
    expect(vertical.widthM).toBeCloseTo(0.05, 9);
    expect(vertical.heightM).toBeCloseTo(0.10, 9);
    expect(vertical.orientation).toBe('vertical');
    expect(vertical.rotationDeg).toBe(0);

    const horizontal = resolveBoxGeometry({
      symbolId: 'sym-planta-toma',
      isPanel: false,
      boxOrientation: 'horizontal'
    });
    expect(horizontal.widthM).toBeCloseTo(0.10, 9);
    expect(horizontal.heightM).toBeCloseTo(0.05, 9);
    expect(horizontal.orientation).toBe('horizontal');
    expect(horizontal.rotationDeg).toBe(90);
  });

  it('interpreta boxRotationDeg de 90° y 270° como orientación horizontal', () => {
    const rot90 = resolveBoxGeometry({
      symbolId: 'sym-planta-toma',
      isPanel: false,
      boxRotationDeg: 90
    });
    expect(rot90.orientation).toBe('horizontal');
    expect(rot90.widthM).toBeCloseTo(0.10, 9);
    expect(rot90.heightM).toBeCloseTo(0.05, 9);

    const rot180 = resolveBoxGeometry({
      symbolId: 'sym-planta-toma',
      isPanel: false,
      boxRotationDeg: 180
    });
    expect(rot180.orientation).toBe('vertical');
    expect(rot180.widthM).toBeCloseTo(0.05, 9);
    expect(rot180.heightM).toBeCloseTo(0.10, 9);
  });

  it('construye el alzado proyectando cajas con su orientación horizontal', () => {
    const elHoriz = makeElement({
      id: 'el-h',
      x: 2,
      heightZ: 1.10,
      side: 'right',
      boxOrientation: 'horizontal'
    });
    const elev = buildWallElevation(params({ elements: [elHoriz], face: 'right' }));
    expect(elev).not.toBeNull();
    const box = elev!.boxes.find((b) => b.id === 'el-h');
    expect(box).toBeDefined();
    expect(box?.orientation).toBe('horizontal');
    expect(box?.width).toBeCloseTo(0.10, 9);
    expect(box?.height).toBeCloseTo(0.05, 9);
    expect(box?.sizeLabel).toContain('Horizontal');
  });
});
