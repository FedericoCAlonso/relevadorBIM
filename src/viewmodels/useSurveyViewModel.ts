/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useSurveyViewModel.ts
 * Orquestador de Relevamiento Móvil Optimizado para la Zona del Pulgar.
 * Maneja giros relativos (Derecha +90°, Izquierda -90°, Recto 0°) respecto
 * al muro anterior y encadenamiento continuo de anclajes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from './useProjectStore';
import { getWallAngleDeg } from '../models/architecture/Wall';
import type { OpeningType, OpeningSwing } from '../models/architecture/Opening';
import {
  DEFAULT_CONDUIT_MATERIAL,
  DEFAULT_CONDUIT_DIAMETER_MM,
  AEA_CONDUCTOR_COLORS
} from '../models/electrical/electricalStandards';
import { useElectricalSequenceStore } from './useElectricalViewModel';

export type RelativeTurnType = 'right' | 'left' | 'straight' | 'custom';

export function useSurveyViewModel() {
  const [relativeTurn, setRelativeTurn] = useState<RelativeTurnType>('right'); // Por defecto derecha (horario)
  const [customAngleDeg, setCustomAngleDeg] = useState<number>(45);
  const [currentDistanceInput, setCurrentDistanceInput] = useState<string>('3.50');

  // Herramientas adicionales
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [isConnectingConduit, setIsConnectingConduit] = useState(false);
  const [pendingConduitStartId, setPendingConduitStartId] = useState<string | null>(null);

  // Modales contextuales para empalmes y aberturas
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);

  const {
    project,
    activeAnchorVertexId,
    setActiveAnchorVertexId,
    setSelectedEntity,
    addWallFromAnchor,
    addBranchWallFromOffset,
    addOpeningReferenced,
    addConduit,
    addDimensionLine,
    setShowDimensions
  } = useProjectStore();

  const verticesMap = useMemo(() => {
    return new Map(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  /**
   * Determina el ángulo absoluto (en grados 0-360) de la siguiente pared
   * calculando el giro relativo respecto al muro anterior que llega al anclaje.
   */
  const effectiveAngleDeg = useMemo(() => {
    // 1. Si no hay anclaje o no hay muros, arrancar en dirección Este (0°)
    if (!activeAnchorVertexId || project.walls.length === 0) {
      return 0;
    }

    // 2. Buscar el muro que termina o conecta en este vértice de anclaje
    const incomingWall = project.walls.find((w) => w.endVertexId === activeAnchorVertexId);
    let baseAngle = 0;

    if (incomingWall) {
      baseAngle = getWallAngleDeg(incomingWall, verticesMap);
    } else {
      // Si no es un extremo final, buscar si es el vértice de inicio
      const outgoingWall = project.walls.find((w) => w.startVertexId === activeAnchorVertexId);
      if (outgoingWall) {
        baseAngle = getWallAngleDeg(outgoingWall, verticesMap);
      }
    }

    // 3. Aplicar el giro relativo
    // En coordenadas de pantalla: girar a la derecha (horario) suma 90°, girar a la izquierda resta 90°
    let turn = 0;
    if (relativeTurn === 'right') turn = 90;
    else if (relativeTurn === 'left') turn = -90;
    else if (relativeTurn === 'straight') turn = 0;
    else if (relativeTurn === 'custom') turn = customAngleDeg;

    let targetAngle = (baseAngle + turn) % 360;
    if (targetAngle < 0) targetAngle += 360;

    return targetAngle;
  }, [activeAnchorVertexId, project.walls, verticesMap, relativeTurn, customAngleDeg]);

  /**
   * Agrega la pared usando la distancia del láser y el ángulo relativo calculado.
   */
  const commitWall = useCallback(
    (customDist?: number) => {
      const dist = customDist !== undefined ? customDist : parseFloat(currentDistanceInput);
      if (isNaN(dist) || dist <= 0) return null;

      let startVertexId = activeAnchorVertexId || undefined;
      let startCoord = undefined;

      // Si es el primer trazo, plantar el inicio en el centro del lienzo
      if (project.vertices.length === 0 && !startVertexId) {
        startCoord = { x: 2.0, y: 2.0 };
      }

      const result = addWallFromAnchor({
        startVertexId,
        startCoord,
        lengthM: dist,
        angleDeg: effectiveAngleDeg,
        thickness: 0.15
      });

      // El store ya coloca automáticamente el extremo final como activeAnchorVertexId
      return result;
    },
    [activeAnchorVertexId, currentDistanceInput, effectiveAngleDeg, project.vertices.length, addWallFromAnchor]
  );

  /**
   * Empalme en T referenciado desde una esquina del muro seleccionado.
   */
  const commitBranchWall = useCallback(
    (params: {
      hostWallId: string;
      referenceVertexId: string;
      offsetM: number;
      branchLengthM: number;
      side: 'left' | 'right';
    }) => {
      return addBranchWallFromOffset(params);
    },
    [addBranchWallFromOffset]
  );

  /**
   * Inserción de abertura referenciada a una esquina de la pared.
   */
  const commitReferencedOpening = useCallback(
    (params: {
      hostWallId: string;
      referenceVertexId: string;
      offsetToJambM: number;
      widthM: number;
      type: OpeningType;
      swing?: OpeningSwing;
    }) => {
      return addOpeningReferenced(params);
    },
    [addOpeningReferenced]
  );

  const handleSetIsConnectingConduit = useCallback((connecting: boolean | ((prev: boolean) => boolean)) => {
    setIsConnectingConduit((prev) => {
      const next = typeof connecting === 'function' ? connecting(prev) : connecting;
      if (!next) {
        setPendingConduitStartId(null);
      } else {
        setIsAddingDimension(false);
        setDimensionP1(null);
      }
      return next;
    });
  }, []);

  const cancelConduitConnection = useCallback(() => {
    setIsConnectingConduit(false);
    setPendingConduitStartId(null);
  }, []);

  // ─── ESTADO DE ACOTACIÓN MÉTRICA LIBRE ───
  const [isAddingDimension, setIsAddingDimension] = useState(false);
  const [dimensionP1, setDimensionP1] = useState<{ x: number; y: number } | null>(null);

  const startAddingDimension = useCallback(() => {
    setIsAddingDimension(true);
    setDimensionP1(null);
    setShowDimensions(true);
    setIsConnectingConduit(false);
    setPendingConduitStartId(null);
    setSelectedSymbolId(null);
  }, [setShowDimensions]);

  const cancelAddingDimension = useCallback(() => {
    setIsAddingDimension(false);
    setDimensionP1(null);
  }, []);

  const handleDimensionCanvasClick = useCallback(
    (worldX: number, worldY: number) => {
      if (!isAddingDimension) return;

      if (!dimensionP1) {
        setDimensionP1({ x: worldX, y: worldY });
      } else {
        const dist = Math.hypot(worldX - dimensionP1.x, worldY - dimensionP1.y);
        if (dist >= 0.05) {
          const newDimId = `dim-${Date.now()}`;
          addDimensionLine({
            id: newDimId,
            p1: dimensionP1,
            p2: { x: worldX, y: worldY },
            levelId: project.activeLevelId
          });
          setSelectedEntity({ type: 'dimension', id: newDimId });
        }
        setIsAddingDimension(false);
        setDimensionP1(null);
      }
    },
    [isAddingDimension, dimensionP1, project.activeLevelId, addDimensionLine, setSelectedEntity]
  );

  /**
   * Conexión de cañerías entre bocas eléctricas y tableros.
   */
  const handleElectricalElementClick = useCallback(
    (elementId: string) => {
      if (isConnectingConduit) {
        if (!pendingConduitStartId) {
          setPendingConduitStartId(elementId);
          setSelectedEntity({ type: 'electrical_element', id: elementId });
        } else if (pendingConduitStartId === elementId) {
          // Deseleccionar si hace clic sobre el mismo elemento inicial
          setPendingConduitStartId(null);
        } else {
          const fromEl = project.electricalElements.find((e) => e.id === pendingConduitStartId);
          const toEl = project.electricalElements.find((e) => e.id === elementId);
          const inheritedCircuitId = fromEl?.circuitId || toEl?.circuitId || project.circuits[0]?.id || null;
          const circ = project.circuits.find((c) => c.id === inheritedCircuitId);
          const wireSec = circ?.wireSectionBaseMM2 || 2.5;

          const seqStore = useElectricalSequenceStore.getState();
          const seqMode = seqStore.sequenceRoutingMode || 'schematic_arc';
          const seqPlane = seqStore.sequenceRoutingPlane || 'ceiling_slab';
          const seqDiam = seqStore.sequenceConduitDiameterMM || DEFAULT_CONDUIT_DIAMETER_MM;
          const seqMat = seqStore.sequenceConduitMaterial || DEFAULT_CONDUIT_MATERIAL;

          const newConduitId = `cond-${Date.now()}`;
          addConduit({
            id: newConduitId,
            circuitId: inheritedCircuitId,
            circuitIds: inheritedCircuitId ? [inheritedCircuitId] : [],
            fromElementId: pendingConduitStartId,
            toElementId: elementId,
            fromLevelId: project.activeLevelId,
            toLevelId: project.activeLevelId,
            diameterMM: seqDiam,
            material: seqMat,
            isVerticalRiser: false,
            routingMode: seqMode,
            routingPlane: seqPlane,
            conductors: [
              { role: 'fase', sectionMM2: wireSec, color: AEA_CONDUCTOR_COLORS.fase },
              { role: 'neutro', sectionMM2: wireSec, color: AEA_CONDUCTOR_COLORS.neutro },
              { role: 'pe', sectionMM2: wireSec, color: AEA_CONDUCTOR_COLORS.pe }
            ]
          });
          setPendingConduitStartId(null);
          setSelectedEntity({ type: 'conduit', id: newConduitId });
        }
      } else {
        setSelectedEntity({ type: 'electrical_element', id: elementId });
      }
    },
    [
      isConnectingConduit,
      pendingConduitStartId,
      addConduit,
      project.activeLevelId,
      project.electricalElements,
      project.circuits,
      setSelectedEntity
    ]
  );

  return {
    relativeTurn,
    setRelativeTurn,
    customAngleDeg,
    setCustomAngleDeg,
    effectiveAngleDeg,
    currentDistanceInput,
    setCurrentDistanceInput,
    selectedSymbolId,
    setSelectedSymbolId,
    isConnectingConduit,
    setIsConnectingConduit: handleSetIsConnectingConduit,
    pendingConduitStartId,
    setPendingConduitStartId,
    cancelConduitConnection,
    showTeeModal,
    setShowTeeModal,
    showOpeningModal,
    setShowOpeningModal,
    commitWall,
    commitBranchWall,
    commitReferencedOpening,
    handleElectricalElementClick,
    setActiveAnchorVertexId,
    isAddingDimension,
    setIsAddingDimension,
    dimensionP1,
    setDimensionP1,
    startAddingDimension,
    cancelAddingDimension,
    handleDimensionCanvasClick
  };
}
