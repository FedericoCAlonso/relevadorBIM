/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useSurveyViewModel.ts
 * Orquestador de Flujos de Relevamiento en Sitio ("One Eye, One Hand").
 * Controla herramientas activas, snaps automáticos y asignación de mediciones.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from './useProjectStore';
import type { OpeningType, OpeningSwing } from '../models/architecture/Opening';

export type SurveyTool =
  | 'select'
  | 'new_room'
  | 'link_room_door'
  | 'tee_wall'
  | 'add_opening'
  | 'place_symbol'
  | 'connect_conduit';

export interface PendingDoorLinkParams {
  hostWallId: string;
  openingId: string;
  distanceCornerToJamb: number;
  whichJamb: 1 | 2;
  side: 'left' | 'right';
  newRoomWidth: number;
  newRoomDepth: number;
  name: string;
}

export interface PendingTeeParams {
  hostWallId: string;
  offsetFromStart: number;
  branchLength: number;
  side: 'left' | 'right';
}

export interface PendingOpeningParams {
  hostWallId: string;
  type: OpeningType;
  width: number;
  distanceAlongWall: number;
  swing: OpeningSwing;
}

export function useSurveyViewModel() {
  const [activeTool, setActiveTool] = useState<SurveyTool>('select');
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [pendingConduitStartId, setPendingConduitStartId] = useState<string | null>(null);

  // Modales/Dialogos contextuales para flujos de obra
  const [doorLinkDialog, setDoorLinkDialog] = useState<PendingDoorLinkParams | null>(null);
  const [teeDialog, setTeeDialog] = useState<PendingTeeParams | null>(null);
  const [openingDialog, setOpeningDialog] = useState<PendingOpeningParams | null>(null);

  const {
    project,
    setSelectedEntity,
    createInitialRoom,
    linkNewRoomFromDoor,
    createTeeWallBranch,
    updateWallLength,
    addOpening,
    addConduit
  } = useProjectStore();

  /**
   * Inicia el flujo de nuevo ambiente acoplado a una puerta seleccionada.
   */
  const startLinkRoomFromDoor = useCallback((hostWallId: string, openingId: string) => {
    setDoorLinkDialog({
      hostWallId,
      openingId,
      distanceCornerToJamb: 0.50, // Valor inicial típico 50cm
      whichJamb: 1,
      side: 'left',
      newRoomWidth: 3.50,
      newRoomDepth: 3.00,
      name: 'Dormitorio'
    });
    setActiveTool('link_room_door');
  }, []);

  /**
   * Confirma la creación del ambiente acoplado por jamba.
   */
  const confirmDoorLink = useCallback(() => {
    if (!doorLinkDialog) return;
    linkNewRoomFromDoor(doorLinkDialog);
    setDoorLinkDialog(null);
    setActiveTool('select');
  }, [doorLinkDialog, linkNewRoomFromDoor]);

  /**
   * Inicia el flujo de empalme en T sobre una pared existente.
   */
  const startTeeWall = useCallback((hostWallId: string) => {
    setTeeDialog({
      hostWallId,
      offsetFromStart: 1.50,
      branchLength: 2.50,
      side: 'left'
    });
    setActiveTool('tee_wall');
  }, []);

  /**
   * Confirma la creación del empalme en T.
   */
  const confirmTeeWall = useCallback(() => {
    if (!teeDialog) return;
    createTeeWallBranch(teeDialog);
    setTeeDialog(null);
    setActiveTool('select');
  }, [teeDialog, createTeeWallBranch]);

  /**
   * Inicia la inserción de una puerta o ventana en una pared.
   */
  const startAddOpening = useCallback((hostWallId: string, type: OpeningType = 'door') => {
    setOpeningDialog({
      hostWallId,
      type,
      width: type === 'door' ? 0.80 : 1.20,
      distanceAlongWall: 0.50,
      swing: 'left_in'
    });
    setActiveTool('add_opening');
  }, []);

  /**
   * Confirma la inserción de la abertura en la pared.
   */
  const confirmAddOpening = useCallback(() => {
    if (!openingDialog) return;
    addOpening({
      id: `open-${Date.now()}`,
      wallId: openingDialog.hostWallId,
      type: openingDialog.type,
      width: openingDialog.width,
      height: openingDialog.type === 'door' ? 2.05 : 1.10,
      sill: openingDialog.type === 'door' ? 0.0 : 0.90,
      distanceAlongWall: openingDialog.distanceAlongWall,
      swing: openingDialog.swing
    });
    setOpeningDialog(null);
    setActiveTool('select');
  }, [openingDialog, addOpening]);

  /**
   * Maneja el clic sobre un elemento eléctrico para trazar cañerías.
   */
  const handleElectricalElementClick = useCallback((elementId: string) => {
    if (activeTool === 'connect_conduit') {
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
  }, [activeTool, pendingConduitStartId, addConduit, project.activeLevelId, setSelectedEntity]);

  return {
    activeTool,
    setActiveTool,
    selectedSymbolId,
    setSelectedSymbolId,
    pendingConduitStartId,
    doorLinkDialog,
    setDoorLinkDialog,
    teeDialog,
    setTeeDialog,
    openingDialog,
    setOpeningDialog,
    startLinkRoomFromDoor,
    confirmDoorLink,
    startTeeWall,
    confirmTeeWall,
    startAddOpening,
    confirmAddOpening,
    handleElectricalElementClick,
    createInitialRoom,
    updateWallLength
  };
}
