/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: symbolsLib.ts
 * Gestor y catálogo de símbolos electromecánicos según Norma AEA 90364.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import symbolsData from './symbols.json';

export interface SymbolCategory {
  id: string;
  name: string;
}

export interface SymbolPin {
  id: string;
  name?: string;
  role: 'phase' | 'neutral' | 'pe' | 'other';
  x: number;
  y: number;
  anchor?: 'top' | 'bottom' | 'left' | 'right';
}

export interface ElectricalSymbolDefinition {
  id: string;
  label: string;
  categoria: string;
  svgContent: string;
  escalaBase?: number;
  pines?: SymbolPin[];
  tipoElemento?: string;
  uso?: 'planta' | 'unifilar' | 'ambos';
}

export const SYMBOL_CATEGORIES: SymbolCategory[] = (symbolsData as any).categories || [];
export const ALL_SYMBOLS: ElectricalSymbolDefinition[] = (symbolsData as any).symbols || [];

/**
 * Obtiene todos los símbolos aptos para dibujo en planta de arquitectura.
 */
export function getPlantaSymbols(): ElectricalSymbolDefinition[] {
  return ALL_SYMBOLS.filter(s => s.uso === 'planta' || s.uso === 'ambos' || !s.uso);
}

/**
 * Obtiene símbolos por categoría específica.
 */
export function getSymbolsByCategory(categoryId: string): ElectricalSymbolDefinition[] {
  return ALL_SYMBOLS.filter(s => s.categoria === categoryId);
}

/**
 * Busca un símbolo por su ID único.
 */
export function getSymbolById(symbolId: string): ElectricalSymbolDefinition | undefined {
  return ALL_SYMBOLS.find(s => s.id === symbolId);
}
