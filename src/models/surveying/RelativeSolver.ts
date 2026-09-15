/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTOR MATEMÁTICO: RelativeSolver.ts
 * Solucionador de Geometría Referenciada para Relevamiento en Sitio.
 * Implementa el acople automático por jamba de vano y empalmes en T,
 * garantizando muros únicos compartidos y cero colisiones.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Wall, WallVertex, Vector2D } from '../architecture/Wall';
import { getWallVector, getWallLength, getWallLeftNormal } from '../architecture/Wall';
import type { Opening } from '../architecture/Opening';
import { getOpeningJambs } from '../architecture/Opening';
import type { Space, SpaceCategory } from '../architecture/Space';

export interface GeneratedRoomResult {
  vertices: WallVertex[];
  walls: Wall[];
  space: Space;
}

/**
 * Genera un ambiente rectangular inicial en una posición y ángulo dados.
 * Crea 4 vértices, 4 muros a 90° con espesor y el espacio funcional.
 */
export function solveRectangularSpace(params: {
  origin: Vector2D;
  width: number;           // Ancho en metros (eje X local)
  length: number;          // Largo en metros (eje Y local)
  rotationDeg?: number;    // Rotación respecto al eje X global
  wallThickness?: number;  // Espesor por defecto (default: 0.15)
  ceilingHeight?: number;  // Altura libre (default: 2.70)
  levelId: string;
  name: string;
  category: SpaceCategory;
  prefixId?: string;
}): GeneratedRoomResult {
  const {
    origin,
    width,
    length,
    rotationDeg = 0,
    wallThickness = 0.15,
    ceilingHeight = 2.70,
    levelId,
    name,
    category,
    prefixId = `room-${Date.now()}`
  } = params;

  const rad = (rotationDeg * Math.PI) / 180;
  const ux = { x: Math.cos(rad), y: Math.sin(rad) };
  const uy = { x: -Math.sin(rad), y: Math.cos(rad) };

  // 4 vértices del polígono perimetral
  const v0: WallVertex = { id: `${prefixId}-v0`, x: origin.x, y: origin.y };
  const v1: WallVertex = { id: `${prefixId}-v1`, x: origin.x + ux.x * width, y: origin.y + ux.y * width };
  const v2: WallVertex = {
    id: `${prefixId}-v2`,
    x: origin.x + ux.x * width + uy.x * length,
    y: origin.y + ux.y * width + uy.y * length
  };
  const v3: WallVertex = { id: `${prefixId}-v3`, x: origin.x + uy.x * length, y: origin.y + uy.y * length };

  const vertices = [v0, v1, v2, v3];

  // 4 muros en ciclo cerrado
  const w0: Wall = {
    id: `${prefixId}-w0`,
    levelId,
    startVertexId: v0.id,
    endVertexId: v1.id,
    thickness: wallThickness,
    height: ceilingHeight
  };
  const w1: Wall = {
    id: `${prefixId}-w1`,
    levelId,
    startVertexId: v1.id,
    endVertexId: v2.id,
    thickness: wallThickness,
    height: ceilingHeight
  };
  const w2: Wall = {
    id: `${prefixId}-w2`,
    levelId,
    startVertexId: v2.id,
    endVertexId: v3.id,
    thickness: wallThickness,
    height: ceilingHeight
  };
  const w3: Wall = {
    id: `${prefixId}-w3`,
    levelId,
    startVertexId: v3.id,
    endVertexId: v0.id,
    thickness: wallThickness,
    height: ceilingHeight
  };

  const walls = [w0, w1, w2, w3];

  const space: Space = {
    id: `${prefixId}-space`,
    name,
    category,
    levelId,
    ceilingHeight,
    floorElevation: 0.0,
    boundaryVertexIds: [v0.id, v1.id, v2.id, v3.id],
    wallIds: [w0.id, w1.id, w2.id, w3.id]
  };

  return { vertices, walls, space };
}

/**
 * ACÓPLE POR JAMBA:
 * Ubica un nuevo ambiente a partir de una abertura existente (puerta/vano).
 * 
 * En el ambiente existente, la puerta tiene una jamba conocida.
 * Al ingresar al nuevo ambiente, el instalador dispara desde la esquina interior
 * del nuevo ambiente hacia esa misma jamba (distancia = d2).
 * 
 * El solucionador calcula la posición exacta del nuevo ambiente en el espacio global,
 * comparte la pared divisoria existente (cero duplicación de muros) y genera los 3 muros nuevos.
 */
export function solveSpaceFromDoorJamb(params: {
  hostWall: Wall;
  opening: Opening;
  verticesMap: Map<string, WallVertex>;
  distanceCornerToJamb: number; // d2: Distancia desde la esquina del nuevo ambiente a la jamba
  whichJamb?: 1 | 2;             // 1 = jamba de inicio, 2 = jamba final
  side: 'left' | 'right';       // Hacia qué lado del muro existente se expande el nuevo cuarto
  newRoomWidth: number;         // Ancho del nuevo cuarto a lo largo de la dirección del muro
  newRoomDepth: number;         // Profundidad del nuevo cuarto perpendicular al muro
  wallThickness?: number;       // Espesor para las paredes nuevas (default: 0.15)
  ceilingHeight?: number;       // Altura de cielorraso (default: 2.70)
  levelId: string;
  name: string;
  category: SpaceCategory;
  prefixId?: string;
}): GeneratedRoomResult | null {
  const {
    hostWall,
    opening,
    verticesMap,
    distanceCornerToJamb,
    whichJamb = 1,
    side,
    newRoomWidth,
    newRoomDepth,
    wallThickness = 0.15,
    ceilingHeight = 2.70,
    levelId,
    name,
    category,
    prefixId = `room-${Date.now()}`
  } = params;

  const jambs = getOpeningJambs(opening, hostWall, verticesMap);
  if (!jambs) return null;

  const wallLen = getWallLength(hostWall, verticesMap);
  if (wallLen === 0) return null;

  const wallVec = getWallVector(hostWall, verticesMap);
  const uWall = { x: wallVec.x / wallLen, y: wallVec.y / wallLen };
  const leftNormal = getWallLeftNormal(hostWall, verticesMap);

  // Vector de profundidad hacia el interior del nuevo cuarto
  const uDepth = side === 'left' ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };

  // Jamba de referencia elegida
  const targetJamb = whichJamb === 1 ? jambs.jamb1 : jambs.jamb2;

  // La esquina de inicio del nuevo cuarto a lo largo de la línea de la pared:
  // Corner0 = targetJamb - (uWall * distanceCornerToJamb)
  const corner0: Vector2D = {
    x: targetJamb.x - uWall.x * distanceCornerToJamb,
    y: targetJamb.y - uWall.y * distanceCornerToJamb
  };

  // Vértices del nuevo cuarto:
  // v0: Esquina inicial sobre el eje de la pared compartida
  // v1: Esquina final sobre el eje de la pared compartida (extensión de width)
  // v2: Esquina opuesta profunda (v1 + uDepth * newRoomDepth)
  // v3: Esquina opuesta profunda (v0 + uDepth * newRoomDepth)
  const v0: WallVertex = { id: `${prefixId}-v0`, x: corner0.x, y: corner0.y };
  const v1: WallVertex = {
    id: `${prefixId}-v1`,
    x: corner0.x + uWall.x * newRoomWidth,
    y: corner0.y + uWall.y * newRoomWidth
  };
  const v2: WallVertex = {
    id: `${prefixId}-v2`,
    x: v1.x + uDepth.x * newRoomDepth,
    y: v1.y + uDepth.y * newRoomDepth
  };
  const v3: WallVertex = {
    id: `${prefixId}-v3`,
    x: v0.x + uDepth.x * newRoomDepth,
    y: v0.y + uDepth.y * newRoomDepth
  };

  const newVertices = [v0, v1, v2, v3];

  // MUROS NUEVOS:
  // Solo se crean 3 muros nuevos; el 4to lado es el MURO EXISTENTE (hostWall)!
  const wSideA: Wall = {
    id: `${prefixId}-w-sideA`,
    levelId,
    startVertexId: v1.id,
    endVertexId: v2.id,
    thickness: wallThickness,
    height: ceilingHeight
  };
  const wBack: Wall = {
    id: `${prefixId}-w-back`,
    levelId,
    startVertexId: v2.id,
    endVertexId: v3.id,
    thickness: wallThickness,
    height: ceilingHeight
  };
  const wSideB: Wall = {
    id: `${prefixId}-w-sideB`,
    levelId,
    startVertexId: v3.id,
    endVertexId: v0.id,
    thickness: wallThickness,
    height: ceilingHeight
  };

  const newWalls = [wSideA, wBack, wSideB];

  // El nuevo espacio referencia a los 3 muros nuevos MÁS el muro anfitrión existente
  const space: Space = {
    id: `${prefixId}-space`,
    name,
    category,
    levelId,
    ceilingHeight,
    floorElevation: 0.0,
    boundaryVertexIds: [v0.id, v1.id, v2.id, v3.id],
    wallIds: [hostWall.id, wSideA.id, wBack.id, wSideB.id]
  };

  return {
    vertices: newVertices,
    walls: newWalls,
    space
  };
}

/**
 * EMPALME EN T (Tee-Wall):
 * Genera un nuevo muro perpendicular que nace a una distancia específica
 * sobre la cara de un muro existente.
 */
export function solveTeeWallBranch(params: {
  hostWall: Wall;
  verticesMap: Map<string, WallVertex>;
  offsetFromStart: number;    // Distancia métrica a lo largo del muro anfitrión
  branchLength: number;       // Longitud del nuevo muro perpendicular
  side: 'left' | 'right';     // Hacia qué lado nace la T
  thickness?: number;         // Espesor del nuevo muro (default: 0.15)
  levelId: string;
  prefixId?: string;
}): { branchVertex: WallVertex; endVertex: WallVertex; branchWall: Wall } | null {
  const {
    hostWall,
    verticesMap,
    offsetFromStart,
    branchLength,
    side,
    thickness = 0.15,
    levelId,
    prefixId = `tee-${Date.now()}`
  } = params;

  const vStart = verticesMap.get(hostWall.startVertexId);
  const wallLen = getWallLength(hostWall, verticesMap);
  if (!vStart || wallLen === 0) return null;

  const wallVec = getWallVector(hostWall, verticesMap);
  const uWall = { x: wallVec.x / wallLen, y: wallVec.y / wallLen };
  const leftNormal = getWallLeftNormal(hostWall, verticesMap);
  const uBranch = side === 'left' ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };

  // Punto de origen del empalme en T
  const rootPoint: Vector2D = {
    x: vStart.x + uWall.x * offsetFromStart,
    y: vStart.y + uWall.y * offsetFromStart
  };

  // Punto final del nuevo muro
  const endPoint: Vector2D = {
    x: rootPoint.x + uBranch.x * branchLength,
    y: rootPoint.y + uBranch.y * branchLength
  };

  const branchVertex: WallVertex = {
    id: `${prefixId}-root-v`,
    x: rootPoint.x,
    y: rootPoint.y
  };

  const endVertex: WallVertex = {
    id: `${prefixId}-end-v`,
    x: endPoint.x,
    y: endPoint.y
  };

  const branchWall: Wall = {
    id: `${prefixId}-wall`,
    levelId,
    startVertexId: branchVertex.id,
    endVertexId: endVertex.id,
    thickness,
    height: hostWall.height
  };

  return { branchVertex, endVertex, branchWall };
}
