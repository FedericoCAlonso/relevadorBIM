/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: openingPresets.ts
 * Catálogo y Presets Paramétricos de Carpinterías y Aberturas de Proyecto.
 * Puertas, Ventanas y Vanos normalizados para arquitectura y relevamiento BIM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { OpeningType, OpeningSwing } from './Opening';
import type { ProjectMaterialCatalog } from '../electrical/ElectricalModel';

export interface OpeningTypeDefinition {
  id: string;
  name: string;             // Denominación comercial (ej: "Puerta Placa 80×205", "Ventana Corrediza 120×110")
  type: OpeningType;        // 'door' | 'window' | 'passage'
  width: number;            // Ancho libre del vano en metros
  height: number;           // Altura libre del vano en metros
  sill: number;             // Antepecho sobre NPT en metros (0 para puertas/vanos)
  defaultSwing?: OpeningSwing; // Sentido de giro recomendado
  description?: string;
  isCustom?: boolean;       // True si fue dada de alta por el usuario en el proyecto
}

export const DEFAULT_OPENING_TYPES: readonly OpeningTypeDefinition[] = [
  // ─── PUERTAS ───
  {
    id: 'puerta_placa_70',
    name: 'Puerta Placa 70×205',
    type: 'door',
    width: 0.70,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'left_in',
    description: 'Puerta interior estándar para dormitorio o baño'
  },
  {
    id: 'puerta_placa_80',
    name: 'Puerta Placa 80×205',
    type: 'door',
    width: 0.80,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'left_in',
    description: 'Puerta interior estándar para pasos y ambientes principales'
  },
  {
    id: 'puerta_acceso_90',
    name: 'Puerta Entrada 90×205',
    type: 'door',
    width: 0.90,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'left_in',
    description: 'Puerta principal de acceso o seguridad'
  },
  {
    id: 'puerta_doble_140',
    name: 'Puerta Doble Hoja 140×205',
    type: 'door',
    width: 1.40,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'double',
    description: 'Puerta principal o de recepción de dos hojas'
  },
  {
    id: 'puerta_balcon_150',
    name: 'Puerta Balcón 150×205',
    type: 'door',
    width: 1.50,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'sliding',
    description: 'Puerta ventana corrediza de salida a patio o balcón'
  },

  // ─── VENTANAS ───
  {
    id: 'ventana_estandar_120',
    name: 'Ventana Corrediza 120×110',
    type: 'window',
    width: 1.20,
    height: 1.10,
    sill: 0.90,
    defaultSwing: 'sliding',
    description: 'Ventana de dos hojas corredizas (antepecho +0.90m)'
  },
  {
    id: 'ventana_estandar_150',
    name: 'Ventana Corrediza 150×110',
    type: 'window',
    width: 1.50,
    height: 1.10,
    sill: 0.90,
    defaultSwing: 'sliding',
    description: 'Ventana corrediza amplia para estar o comedor (antepecho +0.90m)'
  },
  {
    id: 'ventana_bano_60',
    name: 'Ventiluz Baño 60×40',
    type: 'window',
    width: 0.60,
    height: 0.40,
    sill: 1.60,
    defaultSwing: 'none',
    description: 'Ventana alta de ventilación con antepecho +1.60m'
  },
  {
    id: 'ventana_cocina_120',
    name: 'Ventana Cocina 120×90',
    type: 'window',
    width: 1.20,
    height: 0.90,
    sill: 1.10,
    defaultSwing: 'sliding',
    description: 'Ventana sobre mesada con antepecho +1.10m'
  },

  // ─── VANOS LIBRES ───
  {
    id: 'vano_paso_80',
    name: 'Vano Libre 80×205',
    type: 'passage',
    width: 0.80,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'none',
    description: 'Paso libre entre recintos sin carpintería'
  },
  {
    id: 'vano_paso_90',
    name: 'Vano Libre 90×205',
    type: 'passage',
    width: 0.90,
    height: 2.05,
    sill: 0.0,
    defaultSwing: 'none',
    description: 'Paso libre amplio sin carpintería'
  },
  {
    id: 'vano_desayunador_120',
    name: 'Pasa-platos 120×90',
    type: 'passage',
    width: 1.20,
    height: 0.90,
    sill: 1.10,
    defaultSwing: 'none',
    description: 'Vano pasa-platos o barra desayunadora sobre murete'
  }
];

/**
 * Obtiene la lista completa de definiciones de aberturas activas, priorizando las del catálogo de proyecto.
 */
export function getOpeningTypesFromCatalog(
  catalog?: ProjectMaterialCatalog
): readonly OpeningTypeDefinition[] {
  if (catalog?.openingTypes && catalog.openingTypes.length > 0) {
    return catalog.openingTypes;
  }
  return DEFAULT_OPENING_TYPES;
}

/**
 * Filtra los tipos de abertura según su categoría funcional.
 */
export function filterOpeningTypes(
  types: readonly OpeningTypeDefinition[],
  category?: OpeningType
): OpeningTypeDefinition[] {
  if (!category) return [...types];
  return types.filter((t) => t.type === category);
}

/**
 * Busca un tipo de abertura por su identificador.
 */
export function findOpeningTypeById(
  id: string,
  catalog?: ProjectMaterialCatalog
): OpeningTypeDefinition | undefined {
  const all = getOpeningTypesFromCatalog(catalog);
  return all.find((t) => t.id === id);
}
