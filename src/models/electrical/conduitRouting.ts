/**
 * ═══════════════════════════════════════════════════════════════════════════
 * conduitRouting.ts — Responsabilidad Única:
 * Decidir la vía de tendido por defecto de una canalización según el contexto
 * físico de las dos bocas que une.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ConduitRoutingPlane, SpatialElectricalNode } from './ElectricalModel';

type WallAnchoredNode = Pick<SpatialElectricalNode, 'wallId' | 'levelId'>;

/** Dos nodos comparten paramento si están anclados al mismo muro del mismo nivel. */
export function areNodesOnSameWall(
  from: WallAnchoredNode | null | undefined,
  to: WallAnchoredNode | null | undefined
): boolean {
  if (!from || !to) return false;
  return Boolean(from.wallId) && from.wallId === to.wallId && from.levelId === to.levelId;
}

/**
 * Vía de tendido por defecto: si ambas bocas están en el mismo muro, el caño
 * discurre por la propia pared; en caso contrario rige la vía preferida del usuario.
 */
export function resolveDefaultRoutingPlane(
  from: WallAnchoredNode | null | undefined,
  to: WallAnchoredNode | null | undefined,
  preferred: ConduitRoutingPlane
): ConduitRoutingPlane {
  return areNodesOnSameWall(from, to) ? 'wall' : preferred;
}
