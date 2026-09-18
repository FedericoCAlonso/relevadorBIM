/**
 * ═══════════════════════════════════════════════════════════════════════════
 * elementLabelling.ts — Responsabilidad Única:
 * Generación, Unicidad y Formato Relacional de Etiquetas Eléctricas
 * (Boca -> Circuito -> Tablero).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { LabelDisplayMode } from './ElectricalModel';

/**
 * Genera la próxima etiqueta única para un prefijo dado inspeccionando
 * todas las etiquetas existentes en el proyecto.
 * Garantiza unicidad global en todo el plano (sin duplicados).
 */
export function generateNextUniqueLabel(
  prefix: string,
  existingItems: Array<string | { label?: string }>,
  startNumber: number = 1
): string {
  const cleanPrefix = prefix.trim();
  const basePrefix = cleanPrefix.length > 0 ? cleanPrefix : 'B';

  // Escapar caracteres especiales para la expresión regular
  const escaped = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Coincide con prefijo seguido opcionalmente de espacio, guion o guion bajo, y un número entero al final
  const regex = new RegExp(`^${escaped}(?:[\\s-_]?(\\d+))?$`, 'i');

  const usedNumbers = new Set<number>();

  for (const item of existingItems) {
    const label = typeof item === 'string' ? item : item.label;
    if (!label) continue;
    const match = label.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num)) {
        usedNumbers.add(num);
      }
    }
  }

  let candidate = Math.max(1, Math.floor(startNumber));
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  // Si el prefijo original termina en espacio o guion, respetar ese formato; sino concatenar directo
  if (prefix.endsWith(' ') || prefix.endsWith('-') || prefix.endsWith('_')) {
    return `${prefix}${candidate}`;
  }
  return `${basePrefix}${candidate}`;
}

/**
 * Genera la próxima etiqueta única para un circuito determinado.
 * Garantiza que la numeración sea independiente y única por cada circuito
 * (ej: C1 tiene B1, B2... y C2 tiene B1, B2...).
 * Si circuitId es null o undefined, numera dentro de las bocas sin circuito.
 */
export function generateNextUniqueLabelInCircuit(
  prefix: string,
  circuitId: string | null | undefined,
  existingElements: Array<{ label?: string; circuitId?: string | null }>,
  startNumber: number = 1
): string {
  const filtered = existingElements.filter((el) => {
    if (!circuitId) {
      return !el.circuitId;
    }
    return el.circuitId === circuitId;
  });

  return generateNextUniqueLabel(prefix, filtered, startNumber);
}

/**
 * Formatea dinámicamente la etiqueta compuesta de una boca eléctrica
 * según el modelo relacional (Tablero -> Circuito -> Boca).
 * Modos:
 * - 'full': "TP_C1_B1" (Tablero_Circuito_Boca)
 * - 'circuit_element': "C1_B1" (Circuito_Boca)
 * - 'element_only': "B1" (Solo Boca)
 */
export function formatElementLabel(params: {
  elementLabel?: string;
  circuit?: { name: string } | null;
  panel?: { name: string } | null;
  mode?: LabelDisplayMode;
}): string {
  const { elementLabel, circuit, panel, mode = 'full' } = params;
  const cleanEl = (elementLabel || '').trim();

  if (mode === 'element_only' || (!circuit && !panel)) {
    return cleanEl;
  }

  // Extraer identificador corto del circuito (ej: "C1" de "C1 - Tomas Uso General")
  let circShort = '';
  if (circuit?.name) {
    const match = circuit.name.trim().match(/^([a-zA-Z0-9]+)/);
    circShort = match ? match[1] : circuit.name.trim().split(' ')[0];
  }

  if (mode === 'circuit_element') {
    if (circShort && cleanEl) {
      if (cleanEl.toLowerCase().startsWith(circShort.toLowerCase() + '_')) {
        return cleanEl;
      }
      return `${circShort}_${cleanEl}`;
    }
    return circShort || cleanEl;
  }

  // mode === 'full': Tablero_Circuito_Boca
  let panelShort = '';
  if (panel?.name) {
    const parenMatch = panel.name.match(/\(([^)]+)\)/);
    if (parenMatch) {
      panelShort = parenMatch[1].trim();
    } else {
      const match = panel.name.trim().match(/^([a-zA-Z0-9]+)/);
      panelShort = match ? match[1] : panel.name.trim().split(' ')[0];
    }
  }

  const parts: string[] = [];
  if (panelShort) parts.push(panelShort);
  if (circShort) parts.push(circShort);
  if (cleanEl) parts.push(cleanEl);

  return parts.join('_');
}
