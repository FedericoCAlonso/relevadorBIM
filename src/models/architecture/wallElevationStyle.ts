/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: wallElevationStyle.ts — Responsabilidad Única:
 * Catálogo de tokens gráficos (colores y trazos) de la Vista de Alzado de Muro.
 * Las vistas consumen estos tokens; nunca definen colores propios.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface ElevationPaint {
  readonly fill: string;
  readonly stroke: string;
}

export const WALL_ELEVATION_STYLE = {
  background: '#f8fafc',
  wall: { fill: '#e2e8f0', stroke: '#334155' } satisfies ElevationPaint,
  railing: { fill: 'none', stroke: '#475569' } satisfies ElevationPaint,
  floorLine: '#0f172a',
  ceilingLine: '#64748b',
  opening: {
    door: { fill: '#fde68a', stroke: '#92400e' } satisfies ElevationPaint,
    window: { fill: '#bae6fd', stroke: '#0369a1' } satisfies ElevationPaint,
    passage: { fill: '#f8fafc', stroke: '#64748b' } satisfies ElevationPaint
  },
  box: {
    default: { fill: '#ffffff', stroke: '#0f172a' } satisfies ElevationPaint,
    cabinet: { fill: '#dbeafe', stroke: '#1e3a8a' } satisfies ElevationPaint,
    knockout: '#64748b',
    label: '#0f172a'
  },
  selection: { stroke: '#ea580c', halo: '#fed7aa' },
  guide: '#10b981',
  dimension: '#0284c7',
  levelMark: '#475569',
  label: '#334155',
  conduit: {
    fallback: '#64748b',
    outline: '#0f172a',
    byMaterial: {
      hierro_semipesado_rs: '#94a3b8',
      hierro_liviano_rl: '#cbd5e1',
      cano_acero: '#94a3b8',
      pvc_rigido_metrico: '#d1d5db',
      cano_rigido_pvc: '#d1d5db',
      corrugado_blanco_pvc: '#f1f5f9',
      corrugado_blanco: '#f1f5f9',
      corrugado_naranja: '#fb923c',
      corrugado_ignifugo: '#fbbf24',
      manguera_negra: '#334155',
      bandeja_perforada_20: '#a8a29e',
      bandeja: '#a8a29e'
    } as Readonly<Record<string, string>>
  },
  strokePx: {
    thin: 1,
    regular: 1.5,
    heavy: 2.5,
    hit: 16
  },
  dash: {
    projected: '4 3',
    ceiling: '6 4',
    passage: '5 4',
    guide: '3 3'
  }
} as const;

/** Resuelve el color de trazo de una canalización según su circuito o material. */
export function resolveConduitColor(circuitColor: string | undefined, material: string): string {
  if (circuitColor) return circuitColor;
  return WALL_ELEVATION_STYLE.conduit.byMaterial[material] ?? WALL_ELEVATION_STYLE.conduit.fallback;
}
