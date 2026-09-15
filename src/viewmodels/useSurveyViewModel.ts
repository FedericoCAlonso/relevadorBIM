/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useSurveyViewModel.ts
 * Orquestador de Flujo de Relevamiento por Puntos de Referencia Físicos.
 * Permite encadenar muros ortogonales (N, S, E, O), empalmes en T y aberturas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from './useProjectStore';
import type { OpeningType, OpeningSwing } from '../models/architecture/Opening';

export type DrawingDirection = 0 | 90 | 180 | 270; // 0 = Este (+X), 90 = Norte (+Y), 180 = Oeste (-X), 270 = Sur (-Y)

export function useSurveyViewModel() {
  const [currentDirection, setCurrentDirection] = useState<DrawingDirection>(0); // Default Este
  const [currentDistanceInput, setCurrentDistanceInput] = useState<string>('3.50');
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [isConnectingConduit, setIsConnectingConduit] = useState(false);
  const [pendingConduitStartId, setPendingConduitStartId] = useState<string | null>(null);

  // Estados de diálogo contextual para pared seleccionada
  const [showTeeDialog, setShowTeeDialog] = useState(false);
  const [showOpeningDialog, setShowOpeningDialog] = useState(false);

  const {
    project,
    activeAnchorVertexId,
    setActiveAnchorVertexId,
    setSelectedEntity,
    addWallFromAnchor,
    addBranchWallFromOffset,
    addOpeningReferenced,
    addConduit
  } = useProjectStore();

  /**
   * Traza una nueva pared desde el anclaje activo en la dirección seleccionada con la distancia actual.
   */
  const commitWallFromAnchor = useCallback(
    (customDist?: number) => {
      const dist = customDist !== undefined ? customDist : parseFloat(currentDistanceInput);
      if (isNaN(dist) || dist <= 0) return null;

      let startVertexId = activeAnchorVertexId || undefined;
      let startCoord = undefined;

      // Si no hay ningún vértice en el proyecto, empezar en (2.0, 2.0)
      if (project.vertices.length === 0 && !startVertexId) {
        startCoord = { x: 2.0, y: 2.0 };
      }

      const res = addWallFromAnchor({
        startVertexId,
        startCoord,
        lengthM: dist,
        angleDeg: currentDirection,
        thickness: 0.15
      });

      return res;
    },
    [activeAnchorVertexId, currentDistanceInput, currentDirection, project.vertices.length, addWallFromAnchor]
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

  /**
   * Conexión de cañerías haciendo clic secuencial en dos bocas eléctricas.
   */
  const handleElectricalElementClick = useCallback(
    (elementId: string) => {
      if (isConnectingConduit) {
        if (!pendingConduitStartId) {
          setPendingConduitStartId(elementId);
        } else if (pendingConduitStartId !== elementId) {
          addConduit({
            id: `cond-${Date.now()}`,
            fromElementId: pendingConduitStartId,
            toElementId: elementId,
            fromLevelId: project.activeLevelId,
            toLevelId: project.activeLevelId,
            diameterMM: 19,
            material: 'corrugado_blanco',
            isVerticalRiser: false,
            conductors: [
              { role: 'fase', sectionMM2: 2.5, color: '#8B4513' },
              { role: 'neutro', sectionMM2: 2.5, color: '#1E90FF' },
              { role: 'pe', sectionMM2: 2.5, color: '#32CD32' }
            ]
          });
          setPendingConduitStartId(null);
        }
      } else {
        setSelectedEntity({ type: 'electrical_element', id: elementId });
      }
    },
    [isConnectingConduit, pendingConduitStartId, addConduit, project.activeLevelId, setSelectedEntity]
  );

  return {
    currentDirection,
    setCurrentDirection,
    currentDistanceInput,
    setCurrentDistanceInput,
    selectedSymbolId,
    setSelectedSymbolId,
    isConnectingConduit,
    setIsConnectingConduit,
    pendingConduitStartId,
    showTeeDialog,
    setShowTeeDialog,
    showOpeningDialog,
    setShowOpeningDialog,
    commitWallFromAnchor,
    commitBranchWall,
    commitReferencedOpening,
    handleElectricalElementClick,
    setActiveAnchorVertexId
  };
}
