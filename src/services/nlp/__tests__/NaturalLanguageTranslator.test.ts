import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import { executeNaturalLanguageIntent } from '../naturalLanguageTranslator';
import { calculatePolygonArea, resolveSpacePolygon } from '../../../models/architecture/Space';
import type {
  CreateSpaceIntent,
  PlaceOpeningIntent,
  PlaceElementIntent,
  ConnectConduitIntent,
  RecordMeasurementIntent
} from '../naturalLanguageSchema';

describe('naturalLanguageTranslator — Traductor Determinístico CAD/BIM', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useProjectStore.getState().ensureDefaultCircuits();
  });

  it('1. Crea un ambiente rectangular aislado con puerta y ventana', () => {
    const intent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living Comedor',
      category: 'living_comedor',
      dimensions: { widthM: 4.0, lengthM: 6.0 },
      openings: [
        { type: 'door', wall: 'norte', centered: true },
        { type: 'window', wall: 'sur', centered: true }
      ]
    };

    const res = executeNaturalLanguageIntent(intent);
    expect(res.success).toBe(true);
    expect(res.createdType).toBe('space');

    const project = useProjectStore.getState().project;
    expect(project.walls).toHaveLength(4);
    expect(project.openings).toHaveLength(2);
    expect(project.spaces).toHaveLength(1);

    const space = project.spaces[0];
    expect(space.name).toBe('Living Comedor');
    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));
    const poly = resolveSpacePolygon(space, verticesMap);
    const area = calculatePolygonArea(poly);
    expect(area).toBeCloseTo(24.0, 1);
  });

  it('2. Crea un ambiente adosado con Muro Compartido (topología BIM limpia sin duplicar paredes)', () => {
    // Primero creamos el living de 4x6
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 6.0 }
    };
    executeNaturalLanguageIntent(livingIntent);

    const storeInitial = useProjectStore.getState();
    expect(storeInitial.project.walls).toHaveLength(4);
    expect(storeInitial.project.spaces).toHaveLength(1);

    // Luego creamos un dormitorio de 3.50x6 adosado al Este del Living
    const bedIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Dormitorio 1',
      dimensions: { widthM: 3.50, lengthM: 6.0 },
      relativeTo: {
        targetSpaceName: 'Living',
        sharedWall: 'este'
      },
      openings: [{ type: 'door', wall: 'este', distanceFromCornerM: 0.80 }]
    };

    const res = executeNaturalLanguageIntent(bedIntent);
    expect(res.success).toBe(true);

    const storeAfter = useProjectStore.getState();
    // 4 iniciales + 3 en forma de 'C' = 7 muros totales (no 8, ¡el muro intermedio es compartido!)
    expect(storeAfter.project.walls).toHaveLength(7);
    expect(storeAfter.project.spaces).toHaveLength(2);

    const names = storeAfter.project.spaces.map((s) => s.name);
    expect(names).toContain('Living');
    expect(names).toContain('Dormitorio 1');
  });

  it('3. Coloca una boca cenital en el centroide geométrico del ambiente', () => {
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 4.0 }
    };
    executeNaturalLanguageIntent(livingIntent);

    const ceilingLightIntent: PlaceElementIntent = {
      action: 'place_element',
      elementCategory: 'iluminacion_techo',
      mountType: 'ceiling',
      centeredInRoom: true
    };

    const res = executeNaturalLanguageIntent(ceilingLightIntent);
    expect(res.success).toBe(true);
    expect(res.createdType).toBe('element');

    const project = useProjectStore.getState().project;
    expect(project.electricalElements).toHaveLength(1);

    const elem = project.electricalElements[0];
    expect(elem.symbolId).toBe('sym-planta-boca-techo');
    // Centroide de un cuadrado de (0,0) a (4,4) es (2, 2)
    expect(elem.x).toBeCloseTo(2.0, 1);
    expect(elem.y).toBeCloseTo(2.0, 1);
    expect(elem.placement).toBe('ceiling');
  });

  it('4. Coloca un tomacorriente en pared con snap, altura AEA y rotación adecuada', () => {
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 4.0 }
    };
    executeNaturalLanguageIntent(livingIntent);

    const tomaIntent: PlaceElementIntent = {
      action: 'place_element',
      elementCategory: 'toma',
      mountType: 'wall',
      wallReference: 'sur',
      distanceAlongWallM: 2.0,
      heightZM: 0.30
    };

    const res = executeNaturalLanguageIntent(tomaIntent);
    expect(res.success).toBe(true);

    const project = useProjectStore.getState().project;
    expect(project.electricalElements).toHaveLength(1);

    const toma = project.electricalElements[0];
    expect(toma.symbolId).toBe('sym-planta-toma');
    expect(toma.heightZ).toBe(0.30);
    expect(toma.wallId).toBeDefined();
  });

  it('5. Conecta cañería entre dos elementos existentes', () => {
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 4.0 }
    };
    executeNaturalLanguageIntent(livingIntent);

    // Toma en pared
    executeNaturalLanguageIntent({
      action: 'place_element',
      elementCategory: 'toma',
      mountType: 'wall',
      wallReference: 'sur'
    });

    // Luz en techo
    executeNaturalLanguageIntent({
      action: 'place_element',
      elementCategory: 'iluminacion_techo',
      mountType: 'ceiling',
      centeredInRoom: true
    });

    // Conectar cañería
    const conduitIntent: ConnectConduitIntent = {
      action: 'connect_conduit',
      routingPlane: 'ceiling_slab',
      diameterMM: 19
    };

    const res = executeNaturalLanguageIntent(conduitIntent);
    expect(res.success).toBe(true);
    expect(res.createdType).toBe('conduit');

    const project = useProjectStore.getState().project;
    expect(project.conduits).toHaveLength(1);
    expect(project.conduits[0].diameterMM).toBe(19);
    expect(project.conduits[0].routingPlane).toBe('ceiling_slab');
  });

  it('6. Registra mediciones de instrumental (PAT en Ohms en tablero)', () => {
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 4.0 }
    };
    executeNaturalLanguageIntent(livingIntent);

    // Colocar un toma
    executeNaturalLanguageIntent({
      action: 'place_element',
      elementCategory: 'toma',
      mountType: 'wall',
      wallReference: 'sur'
    });

    const measureIntent: RecordMeasurementIntent = {
      action: 'record_measurement',
      measurementType: 'pat_resistance',
      value: 12.5,
      unit: 'Ω'
    };

    const res = executeNaturalLanguageIntent(measureIntent);
    expect(res.success).toBe(true);

    const project = useProjectStore.getState().project;
    const panel = project.panels[0];
    expect(panel.attributes).toBeDefined();
    const patAttr = panel.attributes?.find((a) => a.key === 'PAT (Ω)');
    expect(patAttr?.value).toBe('12.5 Ω');
  });

  it('7. Es totalmente compatible con el historial de deshacer (Ctrl+Z)', () => {
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 4.0 }
    };
    executeNaturalLanguageIntent(livingIntent);
    expect(useProjectStore.getState().project.walls).toHaveLength(4);

    // Deshacer con el sistema multinivel revierte todo el espacio
    expect(useProjectStore.getState().canUndo).toBe(true);
    useProjectStore.getState().undo();

    expect(useProjectStore.getState().project.walls).toHaveLength(0);
  });

  it('8. Inserta una abertura individual en un muro existente con cota relativa a esquina', () => {
    // 1. Crear recinto Living de 4x6
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 4.0, lengthM: 6.0 }
    };
    executeNaturalLanguageIntent(livingIntent);

    // 2. Colocar puerta en pared norte a 0.20m de pared este
    const doorIntent: PlaceOpeningIntent = {
      action: 'place_opening',
      openingType: 'door',
      wallReference: 'norte',
      referenceCornerWall: 'este',
      distanceM: 0.20,
      widthM: 0.80
    };

    const res = executeNaturalLanguageIntent(doorIntent);
    expect(res.success).toBe(true);
    expect(res.createdType).toBe('opening');

    const project = useProjectStore.getState().project;
    expect(project.openings).toHaveLength(1);

    const door = project.openings[0];
    expect(door.type).toBe('door');
    expect(door.width).toBe(0.80);

    // Verificar que la distancia métrica respete la esquina este:
    // El muro norte tiene ancho 4m (X de 0 a 4 o de 4 a 0 en Y=6).
    // Con corner = 'este', la puerta está a 0.20m del extremo este (x=4).
    const hostWall = project.walls.find((w) => w.id === door.wallId)!;
    const vStart = project.vertices.find((v) => v.id === hostWall.startVertexId)!;
    const vEnd = project.vertices.find((v) => v.id === hostWall.endVertexId)!;

    // Calcular la posición real en X de los bordes de la puerta
    const wallLen = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
    const ux = (vEnd.x - vStart.x) / wallLen;
    const xJamb1 = vStart.x + ux * door.distanceAlongWall;
    const xJamb2 = vStart.x + ux * (door.distanceAlongWall + door.width);
    const closestToEast = Math.max(xJamb1, xJamb2);
    // Extremo este está en X=4.0
    expect(closestToEast).toBeCloseTo(3.80, 2); // 4.0 - 0.20 = 3.80
  });

  it('9. Crea un balcón adosado con dimensiones menores al muro anfitrión (partición colineal)', () => {
    // 1. Crear Living de 6x4 (Muro sur mide 6m)
    const livingIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Living',
      dimensions: { widthM: 6.0, lengthM: 4.0 }
    };
    const resLiving = executeNaturalLanguageIntent(livingIntent);
    expect(resLiving.success).toBe(true);

    // 2. Crear Balcón pegado a pared sur de 4.5 por 1
    const balconIntent: CreateSpaceIntent = {
      action: 'create_space',
      name: 'Balcón',
      dimensions: { widthM: 4.5, lengthM: 1.0 },
      relativeTo: {
        targetSpaceName: 'Living',
        sharedWall: 'sur'
      }
    };

    const res = executeNaturalLanguageIntent(balconIntent);
    expect(res.success).toBe(true);

    const project = useProjectStore.getState().project;
    expect(project.spaces).toHaveLength(2);

    const living = project.spaces.find((s) => s.name === 'Living')!;
    const balcon = project.spaces.find((s) => s.name === 'Balcón')!;
    expect(living).toBeDefined();
    expect(balcon).toBeDefined();

    const verticesMap = new Map(project.vertices.map((v) => [v.id, v]));

    // Balcón debe tener área de 4.5m x 1m = 4.5 m²
    const balconPoly = resolveSpacePolygon(balcon, verticesMap);
    const balconArea = calculatePolygonArea(balconPoly);
    expect(balconArea).toBeCloseTo(4.5, 1);

    // Living debe conservar su área de 6m x 4m = 24.0 m²
    const livingPoly = resolveSpacePolygon(living, verticesMap);
    const livingArea = calculatePolygonArea(livingPoly);
    expect(livingArea).toBeCloseTo(24.0, 1);
  });
});

