/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO NLP: naturalLanguageTranslator.ts
 * Responsabilidad Única:
 * Traductor determinístico (Módulo 2). Convierte una intención estructurada
 * (NaturalLanguageIntent) en operaciones y mutaciones geométricas sobre
 * useProjectStore y el modelo CAD/BIM sin uso de IA ni lógica estocástica.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useProjectStore } from '../../viewmodels/useProjectStore';
import { placeElectricalElementInStore } from '../../viewmodels/useElectricalViewModel';
import { calculateWallSnap, type Wall } from '../../models/architecture/Wall';
import { splitWallAtDistance } from '../../models/architecture/WallSplitEngine';
import {
  resolveSpacePolygon,
  calculatePolygonCentroid,
  type Space
} from '../../models/architecture/Space';
import {
  type NaturalLanguageIntent,
  type CreateSpaceIntent,
  type PlaceOpeningIntent,
  type PlaceElementIntent,
  type ConnectConduitIntent,
  type RecordMeasurementIntent,
  type RelativeOrientation
} from './naturalLanguageSchema';

export interface NaturalLanguageExecutionResult {
  success: boolean;
  message: string;
  createdType?: 'space' | 'element' | 'conduit' | 'measurement' | 'opening';
  affectedEntityIds?: {
    spaceId?: string;
    wallIds?: string[];
    elementId?: string;
    conduitId?: string;
    openingId?: string;
  };
}

export interface NaturalLanguageExecutionContext {
  projectStore?: ReturnType<typeof useProjectStore.getState>;
  activeSpaceId?: string | null;
}

/**
 * Función principal: ejecuta una intención tipada de lenguaje natural de forma determinística.
 */
export function executeNaturalLanguageIntent(
  intent: NaturalLanguageIntent,
  context: NaturalLanguageExecutionContext = {}
): NaturalLanguageExecutionResult {
  const store = context.projectStore ?? useProjectStore.getState();

  switch (intent.action) {
    case 'create_space':
      return executeCreateSpace(intent, store, context.activeSpaceId);
    case 'place_opening':
      return executePlaceOpening(intent, store, context.activeSpaceId);
    case 'place_element':
      return executePlaceElement(intent, store, context.activeSpaceId);
    case 'connect_conduit':
      return executeConnectConduit(intent, store);
    case 'record_measurement':
      return executeRecordMeasurement(intent, store);
    default: {
      const _exhaustive: never = intent;
      return { success: false, message: `Acción no soportada: ${JSON.stringify(_exhaustive)}` };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREACIÓN DE ESPACIOS / AMBIENTES
// ─────────────────────────────────────────────────────────────────────────────

function executeCreateSpace(
  intent: CreateSpaceIntent,
  store: ReturnType<typeof useProjectStore.getState>,
  _activeSpaceId?: string | null
): NaturalLanguageExecutionResult {
  const { name, dimensions, relativeTo, openings = [] } = intent;
  const { widthM, lengthM } = dimensions;

  if (widthM <= 0 || lengthM <= 0) {
    return { success: false, message: 'Las dimensiones del ambiente deben ser mayores a cero.' };
  }

  const project = store.project;
  const initialWallCount = project.walls.length;
  const initialProjectSnapshot = JSON.parse(JSON.stringify(project));
  const initialAnchorSnapshot = store.activeAnchorVertexId;
  const initialUndoLength = (store.undoStack || []).length;

  let originX = 0;
  let originY = 0;

  // 0. Sincronizar recintos si ya hay muros cerrados pero no detectados
  if (project.walls.length >= 3 && project.spaces.length === 0) {
    store.autoDetectSpaces();
  }
  const currentProject = store.project;

  // Caso A: Ambiente adosado a un espacio existente (Muro Compartido)
  if (relativeTo?.sharedWall && (relativeTo?.targetSpaceName || currentProject.spaces.length > 0)) {
    let targetSpace = relativeTo.targetSpaceName
      ? currentProject.spaces.find((s) => s.name.toLowerCase().includes(relativeTo.targetSpaceName!.toLowerCase()))
      : undefined;

    if (!targetSpace && currentProject.spaces.length > 0) {
      targetSpace = currentProject.spaces[currentProject.spaces.length - 1];
    }

    if (targetSpace && relativeTo.sharedWall) {
      const res = createAttachedSpace({
        intent,
        targetSpace,
        sharedWallOrientation: relativeTo.sharedWall,
        store
      });
      if (res.success) {
        consolidateSpaceUndo(initialProjectSnapshot, initialAnchorSnapshot, initialUndoLength);
      }
      return res;
    }
  }

  // Caso B: Ambiente aislado o no adosado
  if (project.vertices.length > 0) {
    // Si ya hay geometría, situarlo a la derecha del bounding box actual
    const maxX = Math.max(...project.vertices.map((v) => v.x));
    originX = Number((maxX + 1.0).toFixed(2));
    originY = 0;
  }

  // Trazar los 4 muros ortogonales encadenados (en sentido horario desde la esquina noroeste)
  // Muro 1 (Norte): de (originX, originY) hacia el Este (0°)
  const wall1 = store.addWallFromAnchor({
    startCoord: { x: originX, y: originY },
    lengthM: widthM,
    angleDeg: 0
  });
  if (!wall1) return { success: false, message: 'No se pudo trazar la pared norte del recinto.' };

  // Muro 2 (Este): hacia el Sur (90° en coordenadas de pantalla, +Y hacia abajo)
  const wall2 = store.addWallFromAnchor({
    startVertexId: wall1.endVertexId,
    lengthM: lengthM,
    angleDeg: 90
  });
  if (!wall2) return { success: false, message: 'No se pudo trazar la pared este del recinto.' };

  // Muro 3 (Sur): hacia el Oeste (180°)
  const wall3 = store.addWallFromAnchor({
    startVertexId: wall2.endVertexId,
    lengthM: widthM,
    angleDeg: 180
  });
  if (!wall3) return { success: false, message: 'No se pudo trazar la pared sur del recinto.' };

  // Muro 4 (Oeste): hacia el Norte (270° en coordenadas de pantalla, -Y hacia arriba), cerrando en Muro 1
  const wall4 = store.addWallFromAnchor({
    startVertexId: wall3.endVertexId,
    lengthM: lengthM,
    angleDeg: 270
  });
  if (!wall4) return { success: false, message: 'No se pudo trazar la pared oeste del recinto.' };

  const createdWalls = [wall1.wall, wall2.wall, wall3.wall, wall4.wall];

  // Inyectar aberturas si se especificaron
  for (const op of openings) {
    const targetWall = resolveWallForOrientation(createdWalls, op.wall, store);
    if (targetWall) {
      const wallLen = op.wall === 'norte' || op.wall === 'sur' ? widthM : lengthM;
      const opWidth = op.widthM ?? (op.type === 'window' ? 1.20 : 0.80);
      let dist = op.distanceFromCornerM ?? 0.50;
      if (op.centered) {
        dist = Math.max(0.10, (wallLen - opWidth) / 2);
      } else if (op.referenceCornerWall) {
        const verticesMap = new Map(store.project.vertices.map((v) => [v.id, v]));
        const vStart = verticesMap.get(targetWall.startVertexId);
        const vEnd = verticesMap.get(targetWall.endVertexId);
        if (vStart && vEnd) {
          const isStartCorner = isVertexAtOrientation(vStart, vEnd, op.referenceCornerWall);
          const offset = op.distanceFromCornerM ?? 0.20;
          dist = isStartCorner ? offset : wallLen - offset - opWidth;
          dist = Math.max(0.05, Math.min(wallLen - opWidth - 0.05, dist));
        }
      }
      store.addOpeningDirect({
        wallId: targetWall.id,
        type: op.type,
        width: opWidth,
        height: op.type === 'window' ? 1.10 : 2.05,
        sill: op.type === 'window' ? 0.90 : 0,
        distanceAlongWall: Number(dist.toFixed(2))
      });
    }
  }

  // Detección automática del nuevo recinto cerrado
  store.autoDetectSpaces();

  // Asignar nombre al nuevo espacio
  const updatedProject = useProjectStore.getState().project;
  const newSpace = updatedProject.spaces[updatedProject.spaces.length - 1];
  if (newSpace) {
    store.updateSpace(newSpace.id, { name });
  }

  // Consolidar en un único paso de deshacer
  consolidateSpaceUndo(initialProjectSnapshot, initialAnchorSnapshot, initialUndoLength);

  return {
    success: true,
    message: `Ambiente "${name}" (${widthM}x${lengthM} m) creado exitosamente.`,
    createdType: 'space',
    affectedEntityIds: {
      spaceId: newSpace?.id,
      wallIds: updatedProject.walls.slice(initialWallCount).map((w) => w.id)
    }
  };
}

/**
 * Crea un ambiente adosado reutilizando la pared del ambiente existente (Muro Compartido).
 */
function createAttachedSpace(params: {
  intent: CreateSpaceIntent;
  targetSpace: Space;
  sharedWallOrientation: RelativeOrientation;
  store: ReturnType<typeof useProjectStore.getState>;
}): NaturalLanguageExecutionResult {
  const { intent, targetSpace, sharedWallOrientation, store } = params;
  const { widthM, lengthM } = intent.dimensions;
  let project = store.project;
  let verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // Identificar los muros que delimitan el targetSpace
  const spaceWalls = project.walls.filter((w) =>
    targetSpace.boundaryVertexIds.includes(w.startVertexId) &&
    targetSpace.boundaryVertexIds.includes(w.endVertexId)
  );

  const sharedWall = resolveWallForOrientation(spaceWalls, sharedWallOrientation, store);
  if (!sharedWall) {
    return { success: false, message: `No se encontró el muro ${sharedWallOrientation} en ${targetSpace.name}.` };
  }

  let vStart = verticesMap.get(sharedWall.startVertexId);
  let vEnd = verticesMap.get(sharedWall.endVertexId);
  if (!vStart || !vEnd) {
    return { success: false, message: 'Vértices del muro compartido no encontrados.' };
  }

  const hostWallLength = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);

  const isNorthSouth =
    sharedWallOrientation === 'norte' ||
    sharedWallOrientation === 'sur' ||
    sharedWallOrientation === 'frente' ||
    sharedWallOrientation === 'fondo';

  // Si el muro corre en sentido Este-Oeste (norte/sur), la dimensión paralela al muro es widthM.
  // Si el muro corre en sentido Norte-Sur (este/oeste), la dimensión paralela al muro es lengthM.
  let parallelDim = isNorthSouth ? widthM : lengthM;
  let perpLengthM = isNorthSouth ? lengthM : widthM;

  // Si la dimensión paralela excede la longitud del muro pero la otra dimensión calza:
  if (parallelDim > hostWallLength + 0.05) {
    const altParallel = isNorthSouth ? lengthM : widthM;
    const altPerp = isNorthSouth ? widthM : lengthM;
    if (altParallel <= hostWallLength + 0.05) {
      parallelDim = altParallel;
      perpLengthM = altPerp;
    } else {
      // Clampear al largo disponible del muro host
      parallelDim = hostWallLength;
    }
  }

  // Si la dimensión paralela requerida es menor que la longitud del muro host,
  // particionar el muro host colinealmente para obtener el segmento exacto
  let effectiveSharedWall = sharedWall;

  if (parallelDim < hostWallLength - 0.05) {
    const splitRes = splitWallAtDistance({
      hostWallId: sharedWall.id,
      distanceM: parallelDim,
      fromVertexId: vStart.id,
      project: store.project
    });

    if (splitRes) {
      store.loadProject(splitRes.project);
      effectiveSharedWall = splitRes.segmentNearFromVertex;

      // Actualizar referencias locales tras el split con el estado más reciente del store
      project = useProjectStore.getState().project;
      verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
      vStart = verticesMap.get(effectiveSharedWall.startVertexId)!;
      vEnd = verticesMap.get(effectiveSharedWall.endVertexId)!;
    }
  }

  const effectiveSharedLength = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
  const wallSharedAngleRad = Math.atan2(vEnd.y - vStart.y, vEnd.x - vStart.x);
  const wallSharedAngleDeg = Math.round((wallSharedAngleRad * 180) / Math.PI);

  // Determinar dirección de expansión según la orientación del muro compartido:
  // Este (0° = +X), Norte (90° = +Y), Oeste (180° = -X), Sur (270° = -Y)
  let extAngleDeg = 0;
  let returnAngleDeg = 180;

  if (sharedWallOrientation === 'este' || sharedWallOrientation === 'derecha') {
    extAngleDeg = 0;       // Hacia +X (derecha)
    returnAngleDeg = 180;  // Hacia -X
  } else if (sharedWallOrientation === 'oeste' || sharedWallOrientation === 'izquierda') {
    extAngleDeg = 180;     // Hacia -X (izquierda)
    returnAngleDeg = 0;    // Hacia +X
  } else if (sharedWallOrientation === 'norte' || sharedWallOrientation === 'frente') {
    extAngleDeg = 90;      // Hacia +Y (norte)
    returnAngleDeg = 270;  // Hacia -Y
  } else {
    // sur / fondo
    extAngleDeg = 270;     // Hacia -Y (sur)
    returnAngleDeg = 90;   // Hacia +Y
  }

  // Trazar los 3 muros nuevos en "C" anclados a vStart y vEnd del tramo compartido
  const w1 = store.addWallFromAnchor({
    startVertexId: vStart.id,
    lengthM: perpLengthM,
    angleDeg: extAngleDeg
  });
  if (!w1) return { success: false, message: 'No se pudo trazar el primer muro lateral.' };

  const w2 = store.addWallFromAnchor({
    startVertexId: w1.endVertexId,
    lengthM: effectiveSharedLength,
    angleDeg: wallSharedAngleDeg
  });
  if (!w2) return { success: false, message: 'No se pudo trazar el muro frontal.' };

  const w3 = store.addWallFromAnchor({
    startVertexId: w2.endVertexId,
    lengthM: perpLengthM,
    angleDeg: returnAngleDeg
  });
  if (!w3) return { success: false, message: 'No se pudo cerrar el muro contra la pared compartida.' };

  // Inyectar aberturas si se especificaron
  for (const op of intent.openings ?? []) {
    const targetWall = op.wall === sharedWallOrientation ? effectiveSharedWall : w2.wall;
    const opWidth = op.widthM ?? (op.type === 'window' ? 1.20 : 0.80);
    store.addOpeningDirect({
      wallId: targetWall.id,
      type: op.type,
      width: opWidth,
      height: op.type === 'window' ? 1.10 : 2.05,
      sill: op.type === 'window' ? 0.90 : 0,
      distanceAlongWall: 0.50
    });
  }

  store.autoDetectSpaces();

  const updatedProject = useProjectStore.getState().project;
  const newSpace = updatedProject.spaces.find((s) => s.id !== targetSpace.id);
  if (newSpace) {
    store.updateSpace(newSpace.id, { name: intent.name });
  }

  return {
    success: true,
    message: `Ambiente "${intent.name}" adosado a "${targetSpace.name}" creado con éxito.`,
    createdType: 'space',
    affectedEntityIds: { spaceId: newSpace?.id, wallIds: [w1.wall.id, w2.wall.id, w3.wall.id, effectiveSharedWall.id] }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1B. EMPLAZAMIENTO DE ABERTURAS (PUERTAS, VENTANAS, VANOS)
// ─────────────────────────────────────────────────────────────────────────────

function executePlaceOpening(
  intent: PlaceOpeningIntent,
  store: ReturnType<typeof useProjectStore.getState>,
  activeSpaceId?: string | null
): NaturalLanguageExecutionResult {
  const project = store.project;
  const { openingType, wallReference, referenceCornerWall, distanceM, centered, widthM, heightM, sillM, targetSpaceName } = intent;

  // 1. Identificar espacio destino si existe
  let targetSpace: Space | undefined = undefined;
  if (targetSpaceName) {
    targetSpace = project.spaces.find((s) => s.name.toLowerCase().includes(targetSpaceName.toLowerCase()));
  } else if (activeSpaceId) {
    targetSpace = project.spaces.find((s) => s.id === activeSpaceId);
  } else if (project.spaces.length > 0) {
    targetSpace = project.spaces[project.spaces.length - 1];
  }

  // 2. Determinar muros candidatos
  let candidateWalls = project.walls;
  if (targetSpace) {
    const spaceWallIds = new Set(targetSpace.wallIds);
    candidateWalls = project.walls.filter((w) => spaceWallIds.has(w.id));
    if (candidateWalls.length === 0) {
      candidateWalls = project.walls;
    }
  }

  if (candidateWalls.length === 0) {
    return { success: false, message: 'No hay muros en el proyecto para colocar la abertura.' };
  }

  // 3. Resolver muro anfitrión por orientación
  const hostWall = resolveWallForOrientation(candidateWalls, wallReference, store);
  if (!hostWall) {
    const label = openingType === 'door' ? 'la puerta' : openingType === 'window' ? 'la ventana' : 'la abertura';
    return { success: false, message: `No se encontró la pared ${wallReference} para colocar ${label}.` };
  }

  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
  const vStart = verticesMap.get(hostWall.startVertexId);
  const vEnd = verticesMap.get(hostWall.endVertexId);
  if (!vStart || !vEnd) {
    return { success: false, message: 'Vértices del muro anfitrión no encontrados.' };
  }

  const wallLen = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
  const defaultWidth = openingType === 'door' ? 0.80 : openingType === 'window' ? 1.20 : 0.90;
  const opWidth = widthM ?? defaultWidth;
  const opHeight = heightM ?? (openingType === 'window' ? 1.10 : 2.05);
  const opSill = sillM ?? (openingType === 'window' ? 0.90 : 0);

  // 4. Calcular distancia a lo largo del muro
  let dist = 0.50;
  if (centered) {
    dist = Math.max(0.10, (wallLen - opWidth) / 2);
  } else if (referenceCornerWall) {
    const isStartCorner = isVertexAtOrientation(vStart, vEnd, referenceCornerWall);
    const offset = distanceM ?? 0.20;
    dist = isStartCorner ? offset : wallLen - offset - opWidth;
    dist = Math.max(0.05, Math.min(wallLen - opWidth - 0.05, dist));
  } else if (distanceM !== undefined) {
    dist = Math.max(0.05, Math.min(wallLen - opWidth - 0.05, distanceM));
  } else {
    dist = Math.max(0.10, (wallLen - opWidth) / 2);
  }

  const newOpening = store.addOpeningDirect({
    wallId: hostWall.id,
    type: openingType,
    width: opWidth,
    height: opHeight,
    sill: opSill,
    distanceAlongWall: Number(dist.toFixed(3))
  });

  if (!newOpening) {
    const label = openingType === 'door' ? 'la puerta' : openingType === 'window' ? 'la ventana' : 'la abertura';
    return { success: false, message: `No se pudo insertar ${label} en el muro.` };
  }

  const typeLabel = openingType === 'door' ? 'Puerta' : openingType === 'window' ? 'Ventana' : 'Abertura';
  const spaceLabel = targetSpace ? ` en "${targetSpace.name}"` : '';
  const refLabel = referenceCornerWall
    ? ` a ${distanceM ?? 0.20}m de pared ${referenceCornerWall}`
    : centered
    ? ' centrada'
    : ` a ${dist.toFixed(2)}m`;

  return {
    success: true,
    message: `${typeLabel}${spaceLabel} colocada en pared ${wallReference}${refLabel}.`,
    createdType: 'opening',
    affectedEntityIds: {
      spaceId: targetSpace?.id,
      wallIds: [hostWall.id],
      openingId: newOpening.id
    }
  };
}

function isVertexAtOrientation(
  vTarget: { x: number; y: number },
  vOther: { x: number; y: number },
  orientation: RelativeOrientation
): boolean {
  switch (orientation) {
    case 'este':
    case 'derecha':
      return vTarget.x >= vOther.x;
    case 'oeste':
    case 'izquierda':
      return vTarget.x <= vOther.x;
    case 'norte':
    case 'frente':
      return vTarget.y >= vOther.y; // Mayor Y (+Y, 90°)
    case 'sur':
    case 'fondo':
      return vTarget.y <= vOther.y; // Menor Y (-Y, 270°)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EMPLAZAMIENTO DE ELEMENTOS ELÉCTRICOS Y TABLEROS
// ─────────────────────────────────────────────────────────────────────────────

function executePlaceElement(
  intent: PlaceElementIntent,
  store: ReturnType<typeof useProjectStore.getState>,
  activeSpaceId?: string | null
): NaturalLanguageExecutionResult {
  const {
    elementCategory,
    mountType = 'wall',
    wallReference,
    distanceAlongWallM,
    heightZM,
    circuitNumber,
    centeredInRoom,
    spaceName
  } = intent;

  const project = store.project;
  const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

  // 1. Resolver el símbolo visual según categoría
  const symbolId = intent.symbolId ?? resolveSymbolIdForCategory(elementCategory);

  // 2. Resolver la altura Z reglamentaria si no fue provista
  const finalZ = heightZM ?? resolveDefaultHeightZ(elementCategory);

  // 3. Resolver circuito correspondiente
  const circuitId = resolveCircuitId(project.circuits, circuitNumber);

  // 4. Caso Montaje en Techo (Ceiling) o Centrado en Ambiente
  if (mountType === 'ceiling' || centeredInRoom) {
    const targetSpace = resolveTargetSpace(project.spaces, activeSpaceId, spaceName);
    if (!targetSpace) {
      return { success: false, message: 'No hay un ambiente disponible para centrar el elemento.' };
    }

    const poly = resolveSpacePolygon(targetSpace, verticesMap);
    const centroid = calculatePolygonCentroid(poly);

    const placed = placeElectricalElementInStore(
      {
        worldX: centroid.x,
        worldY: centroid.y,
        symbolId,
        overrideCircuitId: circuitId,
        overrideHeightZ: targetSpace.ceilingHeight ?? 2.70,
        autoConnectConduits: false
      },
      store
    );

    return {
      success: true,
      message: `${capitalize(elementCategory)} cenital colocado en el centro de "${targetSpace.name}".`,
      createdType: 'element',
      affectedEntityIds: { elementId: placed.id, spaceId: targetSpace.id }
    };
  }

  // 5. Caso Montaje en Pared (Wall)
  let targetWall: Wall | undefined;
  const targetSpace = resolveTargetSpace(project.spaces, activeSpaceId, spaceName);

  if (targetSpace && wallReference) {
    const spaceWalls = project.walls.filter(
      (w) =>
        targetSpace.boundaryVertexIds.includes(w.startVertexId) &&
        targetSpace.boundaryVertexIds.includes(w.endVertexId)
    );
    targetWall = resolveWallForOrientation(spaceWalls, wallReference, store);
  }

  // Si no se encontró por espacio, buscar entre las paredes del proyecto
  if (!targetWall) {
    if (wallReference) {
      targetWall = resolveWallForOrientation(project.walls, wallReference, store);
    } else {
      targetWall = project.walls[0];
    }
  }

  if (!targetWall) {
    return { success: false, message: 'No se encontró un muro para colocar el elemento.' };
  }

  // Calcular posición a lo largo del muro
  const vStart = verticesMap.get(targetWall.startVertexId);
  const vEnd = verticesMap.get(targetWall.endVertexId);
  if (!vStart || !vEnd) {
    return { success: false, message: 'Vértices del muro no encontrados.' };
  }

  const wallLen = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
  const clampedDistance = Math.min(
    Math.max(distanceAlongWallM ?? wallLen / 2, 0.15),
    wallLen - 0.15
  );

  const ux = (vEnd.x - vStart.x) / wallLen;
  const uy = (vEnd.y - vStart.y) / wallLen;
  const posX = vStart.x + ux * clampedDistance;
  const posY = vStart.y + uy * clampedDistance;

  // Realizar el cálculo del snap magnético al muro para obtener rotación y cara
  const snap = calculateWallSnap({ x: posX, y: posY }, [targetWall], verticesMap, 0.50);

  const placed = placeElectricalElementInStore(
    {
      worldX: snap ? snap.snappedPoint.x : posX,
      worldY: snap ? snap.snappedPoint.y : posY,
      symbolId,
      snapInfo: snap
        ? {
            wallId: targetWall.id,
            wallOffset: snap.distanceAlongWall,
            side: snap.side,
            rotationDeg: snap.rotationDeg
          }
        : undefined,
      rotationDeg: snap?.rotationDeg ?? 0,
      overrideCircuitId: circuitId,
      overrideHeightZ: finalZ,
      autoConnectConduits: false
    },
    store
  );

  return {
    success: true,
    message: `${capitalize(elementCategory)} colocado en muro a Z: ${finalZ.toFixed(2)} m.`,
    createdType: 'element',
    affectedEntityIds: { elementId: placed.id, wallIds: [targetWall.id] }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONEXIÓN DE CAÑERÍAS (CANALIZACIONES)
// ─────────────────────────────────────────────────────────────────────────────

function executeConnectConduit(
  intent: ConnectConduitIntent,
  store: ReturnType<typeof useProjectStore.getState>
): NaturalLanguageExecutionResult {
  const { fromElementRef, toElementRef, routingPlane = 'ceiling_slab', diameterMM = 19 } = intent;
  const project = store.project;

  const elements = project.electricalElements;
  if (elements.length < 2) {
    return { success: false, message: 'Se requieren al menos 2 bocas en el proyecto para conectar cañerías.' };
  }

  // Buscar elemento origen
  let fromElem = elements[elements.length - 2];
  if (fromElementRef && fromElementRef !== 'selected') {
    const found = elements.find((e) => (e.label ?? '').toLowerCase().includes(fromElementRef.toLowerCase()));
    if (found) fromElem = found;
  }

  // Buscar elemento destino
  let toElem = elements[elements.length - 1];
  if (toElementRef) {
    if (toElementRef === 'ceiling') {
      const ceilingElem = elements.find((e) => e.placement === 'ceiling' && e.id !== fromElem.id);
      if (ceilingElem) toElem = ceilingElem;
    } else {
      const found = elements.find((e) => (e.label ?? '').toLowerCase().includes(toElementRef.toLowerCase()));
      if (found) toElem = found;
    }
  }

  if (fromElem.id === toElem.id) {
    return { success: false, message: 'El elemento de origen y destino no pueden ser el mismo.' };
  }

  const conduitId = `cnd-${Date.now()}`;
  store.addConduit({
    id: conduitId,
    fromLevelId: project.activeLevelId,
    toLevelId: project.activeLevelId,
    fromElementId: fromElem.id,
    toElementId: toElem.id,
    diameterMM,
    material: 'corrugado_blanco',
    routingPlane,
    isVerticalRiser: false,
    conductors: [],
    waypoints: []
  });

  return {
    success: true,
    message: `Cañería de Ø${diameterMM} mm conectada entre ${fromElem.label} y ${toElem.label}.`,
    createdType: 'conduit',
    affectedEntityIds: { conduitId, elementId: fromElem.id }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REGISTRO DE MEDICIONES E INSTRUMENTAL DE CAMPO
// ─────────────────────────────────────────────────────────────────────────────

function executeRecordMeasurement(
  intent: RecordMeasurementIntent,
  store: ReturnType<typeof useProjectStore.getState>
): NaturalLanguageExecutionResult {
  const { measurementType, value, unit } = intent;
  const project = store.project;

  const labelKeyMap: Record<string, string> = {
    pat_resistance: 'PAT (Ω)',
    voltage_fn: 'V fn (V)',
    voltage_ft: 'V ft (V)',
    voltage_nt: 'V nt (V)',
    insulation: 'Aislación (MΩ)',
    current: 'Corriente (A)'
  };

  const key = labelKeyMap[measurementType] ?? measurementType;
  const valString = `${value} ${unit}`.trim();

  // Si hay un panel seccional o principal, priorizar panel para PAT y tensiones
  if (measurementType === 'pat_resistance' && project.panels.length > 0) {
    const panel = project.panels[0];
    const prevAttrs = panel.attributes ?? [];
    const updatedAttrs = [...prevAttrs.filter((a) => a.key !== key), { key, value: valString }];
    store.updatePanel(panel.id, { attributes: updatedAttrs });

    return {
      success: true,
      message: `Medición "${key} = ${valString}" registrada en tablero ${panel.name}.`,
      createdType: 'measurement'
    };
  }

  // De lo contrario, registrar en el último elemento eléctrico
  if (project.electricalElements.length > 0) {
    const elem = project.electricalElements[project.electricalElements.length - 1];
    const prevAttrs = elem.attributes ?? [];
    const updatedAttrs = [...prevAttrs.filter((a) => a.key !== key), { key, value: valString }];
    store.updateElectricalElement(elem.id, { attributes: updatedAttrs });

    return {
      success: true,
      message: `Medición "${key} = ${valString}" registrada en boca ${elem.label}.`,
      createdType: 'measurement',
      affectedEntityIds: { elementId: elem.id }
    };
  }

  return { success: false, message: 'No hay tableros ni bocas en el proyecto para registrar la medición.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS Y FUNCIONES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

function resolveWallForOrientation(
  walls: Wall[],
  orientation: RelativeOrientation,
  store: ReturnType<typeof useProjectStore.getState>
): Wall | undefined {
  if (walls.length === 0) return undefined;
  const verticesMap = new Map(store.project.vertices.map((v) => [v.id, v]));

  const getWallMidpoint = (w: Wall) => {
    const v1 = verticesMap.get(w.startVertexId);
    const v2 = verticesMap.get(w.endVertexId);
    if (!v1 || !v2) return { x: 0, y: 0 };
    return { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
  };

  const sorted = [...walls].sort((a, b) => {
    const ma = getWallMidpoint(a);
    const mb = getWallMidpoint(b);
    switch (orientation) {
      case 'este':
      case 'derecha':
        return mb.x - ma.x; // Mayor X primero (+X, 0°)
      case 'oeste':
      case 'izquierda':
        return ma.x - mb.x; // Menor X primero (-X, 180°)
      case 'norte':
      case 'frente':
        return mb.y - ma.y; // Mayor Y primero (+Y, 90°)
      case 'sur':
      case 'fondo':
        return ma.y - mb.y; // Menor Y primero (-Y, 270°)
    }
  });

  return sorted[0];
}

function resolveSymbolIdForCategory(cat: string): string {
  switch (cat) {
    case 'toma':
      return 'sym-planta-toma';
    case 'llave':
      return 'sym-planta-llave-1';
    case 'iluminacion_techo':
      return 'sym-planta-boca-techo';
    case 'aplique_pared':
      return 'sym-planta-aplique';
    case 'tablero':
      return 'sym-planta-tp';
    case 'caja_paso':
      return 'sym-planta-caja-pase';
    default:
      return 'sym-planta-toma';
  }
}

function resolveDefaultHeightZ(cat: string): number {
  switch (cat) {
    case 'toma':
      return 0.30;
    case 'llave':
      return 1.10;
    case 'iluminacion_techo':
      return 2.70;
    case 'aplique_pared':
      return 2.20;
    case 'tablero':
      return 1.50;
    case 'caja_paso':
      return 0.30;
    default:
      return 0.30;
  }
}

function consolidateSpaceUndo(
  initialProjectSnapshot: any,
  initialAnchorSnapshot: string | null,
  initialUndoLength: number
): void {
  const currentState = useProjectStore.getState();
  const currentUndo = currentState.undoStack || [];
  const consolidatedUndo = [
    ...currentUndo.slice(0, initialUndoLength),
    { project: initialProjectSnapshot, activeAnchorVertexId: initialAnchorSnapshot }
  ];
  useProjectStore.setState({
    undoStack: consolidatedUndo,
    redoStack: [],
    canUndo: true,
    canRedo: false
  });
}

function resolveCircuitId(circuits: Array<{ id: string; name: string }>, num?: string | number): string | null {
  if (!num) return circuits[0]?.id ?? null;
  const numStr = String(num).toLowerCase();
  const found = circuits.find(
    (c) => c.name.toLowerCase().includes(numStr) || c.id.toLowerCase().includes(numStr)
  );
  return found?.id ?? circuits[0]?.id ?? null;
}

function resolveTargetSpace(
  spaces: Space[],
  activeSpaceId?: string | null,
  nameHint?: string
): Space | undefined {
  if (nameHint) {
    const hintLower = nameHint.toLowerCase();
    const found = spaces.find((s) => s.name.toLowerCase().includes(hintLower));
    if (found) return found;
  }
  if (activeSpaceId) {
    const active = spaces.find((s) => s.id === activeSpaceId);
    if (active) return active;
  }
  return spaces[spaces.length - 1];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
