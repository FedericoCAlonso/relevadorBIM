/**
 * ═══════════════════════════════════════════════════════════════════════════
 * calculations.ts — Facade / Barrel de Cálculos Eléctricos (SOLID - SRP)
 * 
 * Este módulo unifica y re-exporta los submódulos especializados de dominio:
 * 1. conduitMetrics: Cómputo métrico 3D, desniveles y transiciones (IRAM/AEA).
 * 2. electricalPhysics: Fórmulas físicas, caídas de tensión y ocupación de conductos.
 * 3. elementLabelling: Generación de etiquetas únicas y formato relacional.
 * 4. cadGeometry: Algoritmos CAD de trazado ortogonal y curvas Bézier tangentes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export * from './conduitMetrics';
export * from './electricalPhysics';
export * from './elementLabelling';
export * from './cadGeometry';
export * from './cableManufacturerCatalog';
