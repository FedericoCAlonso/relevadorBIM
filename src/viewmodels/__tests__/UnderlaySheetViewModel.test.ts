import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import {
  calculateUnderlayScale,
  UNDERLAY_CONSTANTS,
  type UnderlaySheet
} from '../../models/underlay/UnderlaySheet';

describe('UnderlaySheet Store y Ciclo de Vida', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('inicia con underlaySheets vacío', () => {
    const { project } = useProjectStore.getState();
    expect(project.underlaySheets).toEqual({});
  });

  it('permite registrar una lámina de fondo en el nivel activo', () => {
    const { project, setUnderlaySheet } = useProjectStore.getState();
    const levelId = project.activeLevelId;

    const dummySheet: UnderlaySheet = {
      id: 'sheet-101',
      levelId,
      fileName: 'plano-piso-1.png',
      fileType: 'image/png',
      imageUrl: 'data:image/png;base64,sample',
      widthPx: 2000,
      heightPx: 1500,
      scaleMetersPerPx: UNDERLAY_CONSTANTS.DEFAULT_SCALE_METERS_PER_PX,
      originWorldX: 0,
      originWorldY: 0,
      opacity: UNDERLAY_CONSTANTS.DEFAULT_OPACITY,
      visible: true,
      isCalibrated: false
    };

    setUnderlaySheet(levelId, dummySheet);

    const updated = useProjectStore.getState().project;
    expect(updated.underlaySheets?.[levelId]).toEqual(dummySheet);
  });

  it('permite actualizar escala métrica tras calibración en 2 clics', () => {
    const { project, setUnderlaySheet, updateUnderlaySheet } = useProjectStore.getState();
    const levelId = project.activeLevelId;

    const dummySheet: UnderlaySheet = {
      id: 'sheet-102',
      levelId,
      fileName: 'plano-planta-baja.pdf',
      fileType: 'application/pdf',
      imageUrl: 'data:image/png;base64,sample-pdf-render',
      widthPx: 3000,
      heightPx: 2000,
      scaleMetersPerPx: 0.05,
      originWorldX: 0,
      originWorldY: 0,
      opacity: 0.65,
      visible: true,
      isCalibrated: false
    };

    setUnderlaySheet(levelId, dummySheet);

    // Simular calibración con 2 puntos medidos:
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 10, y: 0 }; // 10 metros en el sistema CAD aparente
    const realDistanceM = 5.0; // Distancia real conocida = 5.0m

    const newScale = calculateUnderlayScale(p1, p2, realDistanceM, dummySheet.scaleMetersPerPx);
    expect(newScale).toBe(0.025);

    updateUnderlaySheet(levelId, {
      scaleMetersPerPx: newScale,
      isCalibrated: true
    });

    const sheet = useProjectStore.getState().project.underlaySheets?.[levelId];
    expect(sheet?.scaleMetersPerPx).toBe(0.025);
    expect(sheet?.isCalibrated).toBe(true);
  });

  it('permite alternar visibilidad y opacidad de la lámina', () => {
    const { project, setUnderlaySheet, updateUnderlaySheet } = useProjectStore.getState();
    const levelId = project.activeLevelId;

    const dummySheet: UnderlaySheet = {
      id: 'sheet-103',
      levelId,
      fileName: 'plano.png',
      fileType: 'image/png',
      imageUrl: 'data:image/png;base64,sample',
      widthPx: 1000,
      heightPx: 800,
      scaleMetersPerPx: 0.05,
      originWorldX: 0,
      originWorldY: 0,
      opacity: 0.65,
      visible: true,
      isCalibrated: true
    };

    setUnderlaySheet(levelId, dummySheet);

    // Ocultar
    updateUnderlaySheet(levelId, { visible: false });
    expect(useProjectStore.getState().project.underlaySheets?.[levelId]?.visible).toBe(false);

    // Cambiar opacidad
    updateUnderlaySheet(levelId, { opacity: 0.30 });
    expect(useProjectStore.getState().project.underlaySheets?.[levelId]?.opacity).toBe(0.30);
  });

  it('permite remover la lámina de fondo sin afectar otros niveles', () => {
    const { setUnderlaySheet, removeUnderlaySheet } = useProjectStore.getState();

    const sheet1: UnderlaySheet = {
      id: 'sheet-lvl-1',
      levelId: 'level-1',
      fileName: 'p1.png',
      fileType: 'image/png',
      imageUrl: 'sample1',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.05,
      originWorldX: 0,
      originWorldY: 0,
      opacity: 0.65,
      visible: true,
      isCalibrated: true
    };

    const sheet2: UnderlaySheet = {
      id: 'sheet-lvl-2',
      levelId: 'level-2',
      fileName: 'p2.png',
      fileType: 'image/png',
      imageUrl: 'sample2',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.05,
      originWorldX: 0,
      originWorldY: 0,
      opacity: 0.65,
      visible: true,
      isCalibrated: true
    };

    setUnderlaySheet('level-1', sheet1);
    setUnderlaySheet('level-2', sheet2);

    removeUnderlaySheet('level-1');

    const sheets = useProjectStore.getState().project.underlaySheets;
    expect(sheets?.['level-1']).toBeUndefined();
    expect(sheets?.['level-2']).toEqual(sheet2);
  });
});
