/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: underlaySheetService.ts
 * Ingesta y conversión de planos en imágenes (PNG/JPG/WebP) y documentos PDF
 * a láminas de fondo con alta fidelidad para el lienzo CAD.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  type UnderlaySheet,
  UNDERLAY_CONSTANTS
} from '../models/underlay/UnderlaySheet';

// Inicialización segura del worker de pdfjs en entorno cliente
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

/**
 * Carga un archivo de imagen (PNG, JPG, WebP) y extrae sus dimensiones y DataURL.
 */
function loadImageFile(file: File): Promise<{ dataUrl: string; widthPx: number; heightPx: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('No se pudo leer el contenido del archivo de imagen.'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          widthPx: img.naturalWidth || img.width,
          heightPx: img.naturalHeight || img.height
        });
      };
      img.onerror = () => {
        reject(new Error('El archivo de imagen no es válido o está dañado.'));
      };
      img.src = dataUrl;
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo desde el disco local.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza la primera página de un archivo PDF a un lienzo de alta resolución
 * y lo convierte a DataURL PNG.
 */
async function loadPdfFile(file: File, pageNumber = 1): Promise<{ dataUrl: string; widthPx: number; heightPx: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const validPageNum = Math.min(Math.max(1, pageNumber), pdfDoc.numPages);
  const page = await pdfDoc.getPage(validPageNum);

  // Renderizar a 2.0x para máxima nitidez en cotas y textos finos de ingeniería
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo inicializar el contexto 2D para renderizar el PDF.');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderContext = {
    canvasContext: context,
    viewport
  };

  // @ts-expect-error RenderParameters typing compatibility with pdfjs-dist
  await page.render(renderContext).promise;

  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    widthPx: viewport.width,
    heightPx: viewport.height
  };
}

/**
 * Convierte cualquier archivo compatible (PNG, JPG, WebP o PDF) en una entidad UnderlaySheet lista para proyectar.
 */
export async function createUnderlaySheetFromFile(file: File, levelId: string): Promise<UnderlaySheet> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  let asset: { dataUrl: string; widthPx: number; heightPx: number };

  if (isPdf) {
    asset = await loadPdfFile(file);
  } else {
    asset = await loadImageFile(file);
  }

  return {
    id: `underlay-${Date.now()}`,
    levelId,
    imageUrl: asset.dataUrl,
    fileName: file.name,
    widthPx: asset.widthPx,
    heightPx: asset.heightPx,
    scaleMetersPerPx: UNDERLAY_CONSTANTS.DEFAULT_SCALE_METERS_PER_PX,
    originWorldX: 0,
    originWorldY: 0,
    opacity: UNDERLAY_CONSTANTS.DEFAULT_OPACITY,
    visible: true,
    isCalibrated: false
  };
}
