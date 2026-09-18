/**
 * ═══════════════════════════════════════════════════════════════════════════
 * cadGeometry.ts — Responsabilidad Única:
 * Algoritmos Geométricos CAD y Generación de Trazados SVG de Cañerías
 * (Polilíneas Ortogonales y Empalmes Curvos Bézier Tangentes).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Convierte una secuencia de puntos ortogonales [P0, P1, ..., Pn] en una cadena SVG de trazado `d`
 * con esquinas redondeadas continuas (arcos Bézier cuadráticos tangentes de radio técnico a 90°).
 */
export function generateRoundedPolylineSvgPath(
  points: Array<{ x: number; y: number }>,
  radius: number = 14
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const d1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const d2 = Math.hypot(v2x, v2y);

    // Si los segmentos son muy pequeños o degenerados, dibujar recta directa
    if (d1 < 0.5 || d2 < 0.5) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    const u1x = v1x / d1;
    const u1y = v1y / d1;
    const u2x = v2x / d2;
    const u2y = v2y / d2;

    // Verificar si son casi colineales (recta continua sin quiebre)
    const dot = u1x * u2x + u1y * u2y;
    if (dot < -0.99) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    // Radio efectivo adaptativo al espacio disponible para evitar auto-cruces
    const effectiveRadius = Math.min(radius, d1 / 2, d2 / 2);
    if (effectiveRadius < 0.5) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    const tinX = curr.x + u1x * effectiveRadius;
    const tinY = curr.y + u1y * effectiveRadius;
    const toutX = curr.x + u2x * effectiveRadius;
    const toutY = curr.y + u2y * effectiveRadius;

    d += ` L ${tinX.toFixed(1)} ${tinY.toFixed(1)} Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${toutX.toFixed(1)} ${toutY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  return d;
}

/**
 * Genera una polilínea ortogonal (en escuadra) entre dos puntos,
 * respetando waypoints explícitos intermedios si existen.
 */
export function computeOrthogonalConduitPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  waypoints?: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  const rawKeyPoints = [from, ...(waypoints || []), to];
  const result: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }];

  for (let i = 0; i < rawKeyPoints.length - 1; i++) {
    const pA = rawKeyPoints[i];
    const pB = rawKeyPoints[i + 1];

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;

    if (Math.abs(dx) < 0.1 || Math.abs(dy) < 0.1) {
      result.push({ x: pB.x, y: pB.y });
    } else {
      let corner: { x: number; y: number };
      if (Math.abs(dx) >= Math.abs(dy)) {
        corner = { x: pB.x, y: pA.y };
      } else {
        corner = { x: pA.x, y: pB.y };
      }
      result.push(corner);
      result.push({ x: pB.x, y: pB.y });
    }
  }

  return result;
}
