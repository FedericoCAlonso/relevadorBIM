/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: Level.ts
 * Niveles y Plantas del Edificio (Planta Baja, Planta Alta, Azotea).
 * Permite vincular espacios y elementos verticales con cotas métricas de Z.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Level {
  id: string;
  name: string;                // Ej: "Planta Baja", "Planta Alta", "Subsuelo"
  elevationZ: number;          // Cota Z respecto al nivel de vereda 0.00 en metros
  floorToFloorHeight: number;  // Altura entre pisos terminados en metros (ej: 2.80)
  slabThickness: number;       // Espesor de la losa de entrepiso en metros (ej: 0.20)
  order: number;               // Índice de orden (0 = PB, 1 = PA, etc.)
}

/** Crea un nivel por defecto para proyectos nuevos */
export function createDefaultLevel(id = 'level-pb', name = 'Planta Baja', elevationZ = 0.0): Level {
  return {
    id,
    name,
    elevationZ,
    floorToFloorHeight: 2.80,
    slabThickness: 0.20,
    order: 0
  };
}
