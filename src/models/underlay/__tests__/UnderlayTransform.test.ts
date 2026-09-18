import { describe, it, expect } from 'vitest';
import {
  calculateCroppedOrigin,
  calculateRotatedOrigin,
  type CropBoxPx
} from '../UnderlaySheet';
import { transformUnderlayImage } from '../../../services/underlaySheetService';

describe('UnderlayTransform - Rotación y Recorte de Láminas de Fondo', () => {
  it('debe calcular el nuevo origen métrico tras recortar la lámina preservando la posición de los elementos', () => {
    const initialOrigin = { x: 0.0, y: 0.0 };
    const scaleMetersPerPx = 0.02; // 50 px = 1 metro
    const cropBox: CropBoxPx = { x: 150, y: 250, width: 800, height: 600 };

    const newOrigin = calculateCroppedOrigin(initialOrigin, cropBox, scaleMetersPerPx);

    // 150 px * 0.02 m/px = 3.0 m
    expect(newOrigin.x).toBe(3.0);
    // 250 px * 0.02 m/px = 5.0 m
    expect(newOrigin.y).toBe(5.0);
  });

  it('debe preservar el centro geométrico del plano al rotar 90° y 270°', () => {
    const initialOrigin = { x: 0.0, y: 0.0 };
    const widthPx = 1000;
    const heightPx = 500;
    const scaleMetersPerPx = 0.02; // Ancho = 20m, Alto = 10m, Centro = (10m, 5m)

    // Rotación 90° en sentido horario (ancho y alto se intercambian en el mundo: nuevo ancho = 10m, nuevo alto = 20m)
    const rot90Origin = calculateRotatedOrigin(
      initialOrigin,
      widthPx,
      heightPx,
      90,
      scaleMetersPerPx
    );

    // Nuevo origen X: Centro (10) - NuevoAncho/2 (5) = 5.0
    expect(rot90Origin.x).toBe(5.0);
    // Nuevo origen Y: Centro (5) - NuevoAlto/2 (10) = -5.0
    expect(rot90Origin.y).toBe(-5.0);

    // Verificamos que el centro geométrico resultante coincide exactamente con el original
    const newCenterX = rot90Origin.x + (heightPx * scaleMetersPerPx) / 2;
    const newCenterY = rot90Origin.y + (widthPx * scaleMetersPerPx) / 2;
    expect(newCenterX).toBeCloseTo(10.0, 3);
    expect(newCenterY).toBeCloseTo(5.0, 3);
  });

  it('debe mantener el origen invariable al rotar 180°', () => {
    const initialOrigin = { x: 4.5, y: 8.2 };
    const rot180 = calculateRotatedOrigin(initialOrigin, 800, 600, 180, 0.02);
    expect(rot180.x).toBe(4.5);
    expect(rot180.y).toBe(8.2);
  });

  it('debe ejecutar transformUnderlayImage y retornar dimensiones ajustadas', async () => {
    const dummyImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const cropBox: CropBoxPx = { x: 10, y: 10, width: 400, height: 300 };

    const result = await transformUnderlayImage(dummyImageUrl, 90, cropBox);

    expect(result).toBeDefined();
    expect(result.widthPx).toBe(400);
    expect(result.heightPx).toBe(300);
    expect(result.dataUrl).toBeDefined();
  });
});
