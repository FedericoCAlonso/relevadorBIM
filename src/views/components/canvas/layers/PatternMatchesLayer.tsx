/**
 * Capa SVG de símbolos detectados por autovalores sobre el mapa de bits de la lámina de fondo.
 */
import React from 'react';
import type { UnderlaySheet } from '../../../../models/underlay/UnderlaySheet';
import type { DetectedPatternMatch } from '../../../../models/underlay/PatternDetector';
import { CAD_OVERLAY_COLORS as C } from '../../../../config';

interface PatternMatchesLayerProps {
  matches: DetectedPatternMatch[];
  underlaySheet: UnderlaySheet;
  zoom: number;
  onDismiss?: (matchId: string) => void;
}

export const PatternMatchesLayer: React.FC<PatternMatchesLayerProps> = React.memo(
  ({ matches, underlaySheet, zoom, onDismiss }) => (
    <g>
      {matches.map((m) => {
        const boxX = (underlaySheet.originWorldX + m.boxPx.x * underlaySheet.scaleMetersPerPx) * zoom;
        const boxY = (underlaySheet.originWorldY + m.boxPx.y * underlaySheet.scaleMetersPerPx) * zoom;
        const boxW = m.boxPx.width * underlaySheet.scaleMetersPerPx * zoom;
        const boxH = m.boxPx.height * underlaySheet.scaleMetersPerPx * zoom;
        const cx = m.worldPos.x * zoom;
        const cy = m.worldPos.y * zoom;

        return (
          <g key={m.id} className="group">
            {/* Recuadro de coincidencia */}
            <rect
              x={boxX}
              y={boxY}
              width={boxW}
              height={boxH}
              fill={C.patternMatchFill}
              stroke={C.patternMatchStroke}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              rx={3}
              className="transition-colors group-hover:fill-cyan-500/25 group-hover:stroke-cyan-600"
            />
            {/* Centroide magnético con mira */}
            <circle cx={cx} cy={cy} r={3.5} fill={C.patternMatchCentroid} stroke={C.white} strokeWidth={1} />
            <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={C.patternMatchCentroid} strokeWidth={1} />
            <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={C.patternMatchCentroid} strokeWidth={1} />

            {/* Porcentaje de similitud */}
            <text
              x={boxX + boxW / 2}
              y={boxY + boxH + 9}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight="bold"
              fill={C.patternMatchStroke}
              className="select-none font-mono drop-shadow pointer-events-none"
            >
              {Math.round(m.similarityScore * 100)}%
            </text>

            {/* Botón descartar falso positivo con amplia zona de impacto táctil */}
            <g
              transform={`translate(${boxX + boxW}, ${boxY})`}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss?.(m.id);
              }}
              className="cursor-pointer group/dismiss"
            >
              <title>Descartar falso positivo y aprender del rechazo</title>
              {/* Zona invisible amplia de impacto para mouse y dedos táctiles (36px de diámetro) */}
              <circle r={18} fill="transparent" />
              <circle
                r={8}
                fill={C.patternDismiss}
                stroke={C.white}
                strokeWidth={1.5}
                className="transition-colors group-hover/dismiss:fill-red-600 drop-shadow"
              />
              <text x="0" y="2.5" textAnchor="middle" fontSize={8} fontWeight="bold" fill={C.white} className="select-none font-sans pointer-events-none">
                ✕
              </text>
            </g>
          </g>
        );
      })}
    </g>
  )
);
PatternMatchesLayer.displayName = 'PatternMatchesLayer';
