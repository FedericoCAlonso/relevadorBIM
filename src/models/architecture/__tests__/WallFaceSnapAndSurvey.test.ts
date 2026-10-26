import { describe, it, expect } from 'vitest';
import {
  calculateWallSnap,
  calculateVisibleFaceCompensation,
  type Wall,
  type WallVertex
} from '../Wall';
import { computeResolvedWallPolygons } from '../WallCornerEngine';
import { useProjectStore } from '../../../viewmodels/useProjectStore';

describe('Snap Paramétrico a Caras de Muro y Compensación de Cara Vista (Puntos 2 y 6)', () => {
  describe('Punto 6: calculateWallSnap dinámico según justificación y espesor', () => {
    it('debe imantar a paramento interior exacto (offset 0) en muro con justificación interior', () => {
      const vStart: WallVertex = { id: 'v1', x: 0, y: 0 };
      const vEnd: WallVertex = { id: 'v2', x: 5, y: 0 };
      const vertices = new Map<string, WallVertex>([
        [vStart.id, vStart],
        [vEnd.id, vEnd]
      ]);

      const wall: Wall = {
        id: 'w1',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.15,
        height: 2.8,
        justification: 'interior'
      };

      // Cursor en (2.5, 0.05) -> cerca de la cara interior (+Y en coordenadas SVG normales, pero leftOffset = 0)
      const snapLeft = calculateWallSnap({ x: 2.5, y: 0.05 }, [wall], vertices, 0.40);
      expect(snapLeft).not.toBeNull();
      expect(snapLeft?.side).toBe('left');
      // La coordenada Y debe ser exactamente 0.00 (paramento interior), NO 0.075 (flotando en el aire)
      expect(snapLeft?.snappedPoint.x).toBeCloseTo(2.5, 3);
      expect(snapLeft?.snappedPoint.y).toBeCloseTo(0.00, 3);
      expect(snapLeft?.rotationDeg).toBe(180);
    });

    it('debe imantar a paramento exterior exacto (offset -thickness) en muro con justificación interior', () => {
      const vStart: WallVertex = { id: 'v1', x: 0, y: 0 };
      const vEnd: WallVertex = { id: 'v2', x: 5, y: 0 };
      const vertices = new Map<string, WallVertex>([
        [vStart.id, vStart],
        [vEnd.id, vEnd]
      ]);

      const wall: Wall = {
        id: 'w1',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.20,
        height: 2.8,
        justification: 'interior'
      };

      // Cursor en (2.5, -0.22) -> cerca de la cara exterior (rightOffset = -0.20)
      const snapRight = calculateWallSnap({ x: 2.5, y: -0.22 }, [wall], vertices, 0.40);
      expect(snapRight).not.toBeNull();
      expect(snapRight?.side).toBe('right');
      // La coordenada Y debe ser exactamente -0.20 (paramento exterior), NO -0.10 (metido en el seno de la pared)
      expect(snapRight?.snappedPoint.x).toBeCloseTo(2.5, 3);
      expect(snapRight?.snappedPoint.y).toBeCloseTo(-0.20, 3);
      expect(snapRight?.rotationDeg).toBe(0);
    });

    it('debe imantar correctamente en muros de 30cm con justificación centrada', () => {
      const vStart: WallVertex = { id: 'v1', x: 0, y: 0 };
      const vEnd: WallVertex = { id: 'v2', x: 5, y: 0 };
      const vertices = new Map<string, WallVertex>([
        [vStart.id, vStart],
        [vEnd.id, vEnd]
      ]);

      const wall: Wall = {
        id: 'w1',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.30,
        height: 2.8,
        justification: 'center'
      };

      // Izquierda (+0.15)
      const snapLeft = calculateWallSnap({ x: 1.0, y: 0.20 }, [wall], vertices, 0.40);
      expect(snapLeft?.side).toBe('left');
      expect(snapLeft?.snappedPoint.y).toBeCloseTo(0.15, 3);

      // Derecha (-0.15)
      const snapRight = calculateWallSnap({ x: 1.0, y: -0.20 }, [wall], vertices, 0.40);
      expect(snapRight?.side).toBe('right');
      expect(snapRight?.snappedPoint.y).toBeCloseTo(-0.15, 3);
    });

    it('debe imantar correctamente en muro con justificación exterior', () => {
      const vStart: WallVertex = { id: 'v1', x: 0, y: 0 };
      const vEnd: WallVertex = { id: 'v2', x: 5, y: 0 };
      const vertices = new Map<string, WallVertex>([
        [vStart.id, vStart],
        [vEnd.id, vEnd]
      ]);

      const wall: Wall = {
        id: 'w1',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.15,
        height: 2.8,
        justification: 'exterior'
      };

      // Cara izquierda (offset +0.15)
      const snapLeft = calculateWallSnap({ x: 3.0, y: 0.18 }, [wall], vertices, 0.40);
      expect(snapLeft?.side).toBe('left');
      expect(snapLeft?.snappedPoint.y).toBeCloseTo(0.15, 3);

      // Cara derecha (offset 0.00)
      const snapRight = calculateWallSnap({ x: 3.0, y: -0.03 }, [wall], vertices, 0.40);
      expect(snapRight?.side).toBe('right');
      expect(snapRight?.snappedPoint.y).toBeCloseTo(0.00, 3);
    });
  });

  describe('Punto 2: calculateVisibleFaceCompensation y medición desde cara vista', () => {
    it('debe calcular la compensación exacta cuando la nueva pared cruza el espesor del muro base', () => {
      const vStart: WallVertex = { id: 'v1', x: 0, y: 0 };
      const vEnd: WallVertex = { id: 'v2', x: 4, y: 0 };
      const vertices = new Map<string, WallVertex>([
        [vStart.id, vStart],
        [vEnd.id, vEnd]
      ]);

      const hostWall: Wall = {
        id: 'w-base',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.15,
        height: 2.8,
        justification: 'interior'
      };

      // Giro hacia la derecha (hacia -Y, entrando al cuerpo del muro de 15cm)
      const compRight = calculateVisibleFaceCompensation({
        hostWall,
        anchorVertexId: 'v2',
        targetAngleDeg: 270, // -Y
        verticesMap: vertices
      });
      // El muro base tiene su cuerpo en -Y (de 0 a -0.15), por lo que cruza 0.15m
      expect(compRight).toBeCloseTo(0.15, 3);

      // Giro hacia la izquierda (+Y, saliendo directamente al exterior/ambiente sin cruzar ladrillo)
      const compLeft = calculateVisibleFaceCompensation({
        hostWall,
        anchorVertexId: 'v2',
        targetAngleDeg: 90, // +Y
        verticesMap: vertices
      });
      expect(compLeft).toBeCloseTo(0, 3);

      // Continuación recta (0° o 180°)
      const compStraight = calculateVisibleFaceCompensation({
        hostWall,
        anchorVertexId: 'v2',
        targetAngleDeg: 0,
        verticesMap: vertices
      });
      expect(compStraight).toBeCloseTo(0, 3);
    });

    it('debe compensar dinámicamente un muro de 30cm con justificación interior', () => {
      const vStart: WallVertex = { id: 'v1', x: 0, y: 0 };
      const vEnd: WallVertex = { id: 'v2', x: 4, y: 0 };
      const vertices = new Map<string, WallVertex>([
        [vStart.id, vStart],
        [vEnd.id, vEnd]
      ]);

      const hostWall: Wall = {
        id: 'w-base-30',
        levelId: 'lvl-1',
        startVertexId: 'v1',
        endVertexId: 'v2',
        thickness: 0.30,
        height: 2.8,
        justification: 'interior'
      };

      const comp = calculateVisibleFaceCompensation({
        hostWall,
        anchorVertexId: 'v2',
        targetAngleDeg: 270,
        verticesMap: vertices
      });
      expect(comp).toBeCloseTo(0.30, 3);
    });

    it('debe ajustar la longitud al extender pared con addWallFromAnchor en modo visible_face', () => {
      const store = useProjectStore.getState();
      store.resetProject();

      // Muro inicial de 4m con justificación interior
      const w1 = store.addWallFromAnchor({
        startCoord: { x: 0, y: 0 },
        lengthM: 4.0,
        angleDeg: 0,
        thickness: 0.15,
        justification: 'interior'
      })!;

      // Extender desde el extremo final (vEnd de w1) hacia abajo (270°), midiendo 3.00m con láser
      const w2 = store.addWallFromAnchor({
        startVertexId: w1.endVertexId,
        lengthM: 3.0,
        angleDeg: 270,
        thickness: 0.15,
        justification: 'interior',
        referenceOrigin: 'visible_face'
      })!;

      const vEnd2 = useProjectStore.getState().project.vertices.find(v => v.id === w2.endVertexId)!;
      // La coordenada Y final debe ser -3.15, de modo que la luz libre entre la cara del muro (-0.15) y el final sea exactamente 3.00m
      expect(vEnd2.y).toBeCloseTo(-3.15, 2);
      // La justificación física debe ser 'interior' para mantener el empalme enrasado
      expect(w2.wall.justification).toBe('interior');
    });

    it('al seleccionar Cara Ext. o Eje Medio, debe corregir la medida pero mantener el empalme enrasado sin desplazar lateralmente la pared', () => {
      const store = useProjectStore.getState();
      store.resetProject();

      // Muro base horizontal de 4m (justification: 'interior', espesor: 0.15)
      const w1 = store.addWallFromAnchor({
        startCoord: { x: 0, y: 0 },
        lengthM: 4.0,
        angleDeg: 0,
        thickness: 0.15,
        justification: 'interior'
      })!;

      // 1. Extender con referencia a Eje Medio ('center')
      const wAxis = store.addWallFromAnchor({
        startVertexId: w1.endVertexId,
        lengthM: 3.0,
        angleDeg: 270,
        thickness: 0.15,
        measurementReference: 'center'
      })!;

      // El muro derivado debe heredar la justificación física de w1 ('interior') para no romper el empalme
      expect(wAxis.wall.justification).toBe('interior');
      const vEndAxis = useProjectStore.getState().project.vertices.find(v => v.id === wAxis.endVertexId)!;
      // Eje del muro está a y = -0.075. Desde el eje hasta el final deben ser 3.00m => y = -3.075
      expect(vEndAxis.y).toBeCloseTo(-3.075, 2);

      // 2. Extender con referencia a Cara Ext. ('exterior')
      useProjectStore.getState().resetProject();
      const wBase = useProjectStore.getState().addWallFromAnchor({
        startCoord: { x: 0, y: 0 },
        lengthM: 4.0,
        angleDeg: 0,
        thickness: 0.15,
        justification: 'interior'
      })!;

      const wExt = useProjectStore.getState().addWallFromAnchor({
        startVertexId: wBase.endVertexId,
        lengthM: 3.0,
        angleDeg: 270,
        thickness: 0.15,
        measurementReference: 'exterior'
      })!;

      // Justificación física sigue siendo 'interior'
      expect(wExt.wall.justification).toBe('interior');
      const vEndExt = useProjectStore.getState().project.vertices.find(v => v.id === wExt.endVertexId)!;
      // Cara exterior opuesta está en y = 0. Desde y=0 hasta el final deben ser 3.00m => y = -3.00
      expect(vEndExt.y).toBeCloseTo(-3.00, 2);

      // 3. Verificar que WallCornerEngine resuelve el empalme en inglete perfecto sin huecos ni saltos
      const verticesMap = new Map(
        useProjectStore.getState().project.vertices.map((v) => [v.id, v])
      );
      const polygons = computeResolvedWallPolygons([wBase.wall, wExt.wall], verticesMap);
      expect(polygons.get(wBase.wall.id)).toBeDefined();
      expect(polygons.get(wExt.wall.id)).toBeDefined();
      expect(polygons.get(wBase.wall.id)!.length).toBe(4);
      expect(polygons.get(wExt.wall.id)!.length).toBe(4);
    });
  });
});
