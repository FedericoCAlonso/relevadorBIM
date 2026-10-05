import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import { calculatePolygonArea, resolveSpacePolygon } from '../../models/architecture/Space';

describe('CAD Wall Grip Drag & Vertex Fusing (useProjectStore)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('debe actualizar la posición de un vértice en tiempo real con updateVertexPosition', () => {
    const store = useProjectStore.getState();
    const wallRes = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    });
    expect(wallRes).not.toBeNull();
    const wall = wallRes!.wall;

    store.updateVertexPosition(wall.endVertexId, { x: 5.0, y: 0 });

    const updatedProject = useProjectStore.getState().project;
    const vEnd = updatedProject.vertices.find((v) => v.id === wall.endVertexId);
    expect(vEnd?.x).toBe(5.0);
    expect(vEnd?.y).toBe(0);
  });

  it('debe independizar un vértice compartido al arrastrar un tramo común con splitSharedVertexForWall', () => {
    const store = useProjectStore.getState();
    // Muro 1: de (0,0) a (4,0)
    const w1Res = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    });
    // Muro 2: parte del mismo vértice (4,0) y va hacia (4,3)
    const w2Res = store.addWallFromAnchor({
      startVertexId: w1Res!.endVertexId,
      lengthM: 3.0,
      angleDeg: 90
    });

    const sharedVertexId = w1Res!.endVertexId;
    expect(w2Res!.wall.startVertexId).toBe(sharedVertexId);

    // Separamos el vértice para el Muro 2
    const newVertexId = store.splitSharedVertexForWall(w2Res!.wall.id, sharedVertexId);
    expect(newVertexId).not.toBe(sharedVertexId);

    const updatedProject = useProjectStore.getState().project;
    const updatedW1 = updatedProject.walls.find((w) => w.id === w1Res!.wall.id);
    const updatedW2 = updatedProject.walls.find((w) => w.id === w2Res!.wall.id);

    // El Muro 1 conserva su vértice
    expect(updatedW1?.endVertexId).toBe(sharedVertexId);
    // El Muro 2 ahora tiene su propio vértice independiente
    expect(updatedW2?.startVertexId).toBe(newVertexId);
  });

  it('debe fusionar vértices y ajustar aberturas al confirmar el arrastre con commitWallVertexDrag', () => {
    const store = useProjectStore.getState();
    // Muro A: de (0,0) a (4,0)
    const wA = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    });
    // Muro B: de (6,0) a (6,4)
    const wB = store.addWallFromAnchor({
      startCoord: { x: 6, y: 0 },
      lengthM: 4.0,
      angleDeg: 90
    });

    // Agregamos una puerta al Muro A a 1.0m del inicio
    store.addOpeningReferenced({
      hostWallId: wA!.wall.id,
      referenceVertexId: wA!.wall.startVertexId,
      offsetToJambM: 1.0,
      widthM: 0.80,
      type: 'door'
    });

    const targetVertexId = wB!.wall.startVertexId; // (6,0)

    // Arrastramos el fin de Muro A hasta fusionarlo con el inicio de Muro B en (6,0)
    store.commitWallVertexDrag({
      wallId: wA!.wall.id,
      draggedVertexId: wA!.wall.endVertexId,
      newPos: { x: 6, y: 0 },
      mergeWithVertexId: targetVertexId,
      draggedEnd: 'end',
      oldLength: 4.0
    });

    const updatedProject = useProjectStore.getState().project;
    const finalWA = updatedProject.walls.find((w) => w.id === wA!.wall.id);

    // Muro A ahora termina en targetVertexId (fusión)
    expect(finalWA?.endVertexId).toBe(targetVertexId);

    // La puerta en Muro A conservó su distancia fija de 1.0m
    const door = updatedProject.openings.find((o) => o.wallId === wA!.wall.id);
    expect(door?.distanceAlongWall).toBe(1.0);
  });

  it('debe ajustar la posición de abertura respecto al extremo fijo cuando se arrastra el inicio (draggedEnd: start)', () => {
    const store = useProjectStore.getState();
    // Muro de (0,0) a (4,0), longitud = 4.0m
    const wallRes = store.addWallFromAnchor({
      startCoord: { x: 0, y: 0 },
      lengthM: 4.0,
      angleDeg: 0
    });
    const wall = wallRes!.wall;

    // Ventana de 1.0m a 2.5m del inicio (a 0.5m del fin fijo)
    store.addOpeningReferenced({
      hostWallId: wall.id,
      referenceVertexId: wall.startVertexId,
      offsetToJambM: 2.5,
      widthM: 1.0,
      type: 'window'
    });

    // Alargamos el muro arrastrando el inicio a (-2, 0) -> nueva longitud = 6.0m
    // El fin en (4,0) no se movió. La distancia desde el fin era 4.0 - (2.5 + 1.0) = 0.5m
    // Por ende, la nueva distancia desde el inicio debe ser 6.0 - 0.5 - 1.0 = 4.5m
    store.commitWallVertexDrag({
      wallId: wall.id,
      draggedVertexId: wall.startVertexId,
      newPos: { x: -2, y: 0 },
      draggedEnd: 'start',
      oldLength: 4.0
    });

    const updatedProject = useProjectStore.getState().project;
    const windowOp = updatedProject.openings.find((o) => o.wallId === wall.id);
    expect(windowOp?.distanceAlongWall).toBeCloseTo(4.5);
  });

  it('debe eliminar el vértice huérfano tras la fusión y autodetectar recintos cerrados', () => {
    const store = useProjectStore.getState();
    // Crear 4 muros en forma de "C" casi cerrada (falta cerrar entre (0,3) y (0,0))
    // Muro 1: (0,0) -> (4,0)
    const w1 = store.addWallFromAnchor({ startCoord: { x: 0, y: 0 }, lengthM: 4, angleDeg: 0 });
    // Muro 2: (4,0) -> (4,3)
    const w2 = store.addWallFromAnchor({ startVertexId: w1!.endVertexId, lengthM: 3, angleDeg: 90 });
    // Muro 3: (4,3) -> (0,3)
    const w3 = store.addWallFromAnchor({ startVertexId: w2!.endVertexId, lengthM: 4, angleDeg: 180 });
    // Muro 4: (0,3) -> (0, 0.5) (deja una brecha de 0.5m respecto al origen (0,0))
    const w4 = store.addWallFromAnchor({ startVertexId: w3!.endVertexId, lengthM: 2.5, angleDeg: 270 });

    const initialVerticesCount = useProjectStore.getState().project.vertices.length;
    // Aún no hay espacios porque el polígono no está cerrado
    expect(useProjectStore.getState().project.spaces.length).toBe(0);

    const oldEndVertexId = w4!.endVertexId;
    const targetVertexId = w1!.wall.startVertexId; // (0,0)

    // Arrastramos el extremo de Muro 4 y lo fusionamos con (0,0)
    store.commitWallVertexDrag({
      wallId: w4!.wall.id,
      draggedVertexId: oldEndVertexId,
      newPos: { x: 0, y: 0 },
      mergeWithVertexId: targetVertexId,
      draggedEnd: 'end',
      oldLength: 2.5
    });

    const updatedProject = useProjectStore.getState().project;

    // 1. El vértice huérfano oldEndVertexId fue removido de vertices
    expect(updatedProject.vertices.some((v) => v.id === oldEndVertexId)).toBe(false);
    expect(updatedProject.vertices.length).toBe(initialVerticesCount - 1);

    // 2. Muro 4 ahora termina en el vértice de inicio de Muro 1
    const finalW4 = updatedProject.walls.find((w) => w.id === w4!.wall.id);
    expect(finalW4?.endVertexId).toBe(targetVertexId);

    // 3. Se autodetectó el espacio cerrado (área: 4m * 3m = 12 m²)
    expect(updatedProject.spaces.length).toBe(1);
    const verticesMap = new Map(updatedProject.vertices.map((v) => [v.id, v]));
    const poly = resolveSpacePolygon(updatedProject.spaces[0], verticesMap);
    const area = calculatePolygonArea(poly);
    expect(area).toBeCloseTo(12.0, 1);
  });
});
