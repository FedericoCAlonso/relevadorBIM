/**
 * Capa SVG de overlays para detección de símbolos por SVD:
 * retícula en cruz infinita, recuadro de auto-muestreo, marquesina Muestra #1,
 * recuadro interactivo de ajuste fino con 4 manijas y esténcil rígido de Muestras #2+.
 */
import React from 'react';
import { CAD_INTERACTION_OVERLAY_STYLES as S } from '../../../../config';
import type { AdjustSampleHandle } from './layerTypes';

interface PatternSamplingOverlayLayerProps {
  isSamplingPattern: boolean;
  isAdjustingSampleBox: boolean;
  patternSamplingMode: 'auto' | 'box';
  positiveExemplarsCount: number;
  stencilSizeWorld: { width: number; height: number } | null;
  stencilRotationDeg: number;
  isStencilSnapped: boolean;
  hoverWorldPos: { x: number; y: number } | null;
  samplingStartWorldPos: { x: number; y: number } | null;
  provisionalSquareBox: { x: number; y: number; size: number } | null;
  zoom: number;
  onStartAdjustDrag: (handle: AdjustSampleHandle, clientX: number, clientY: number) => void;
}

const CORNER_HANDLES: ReadonlyArray<{
  handle: Exclude<AdjustSampleHandle, 'move' | null>;
  dxFactor: 0 | 1;
  dyFactor: 0 | 1;
  cursor: string;
}> = [
  { handle: 'nw', dxFactor: 0, dyFactor: 0, cursor: 'cursor-nwse-resize' },
  { handle: 'ne', dxFactor: 1, dyFactor: 0, cursor: 'cursor-nesw-resize' },
  { handle: 'se', dxFactor: 1, dyFactor: 1, cursor: 'cursor-nwse-resize' },
  { handle: 'sw', dxFactor: 0, dyFactor: 1, cursor: 'cursor-nesw-resize' }
];

export const PatternSamplingOverlayLayer: React.FC<PatternSamplingOverlayLayerProps> = React.memo(
  ({
    isSamplingPattern,
    isAdjustingSampleBox,
    patternSamplingMode,
    positiveExemplarsCount,
    stencilSizeWorld,
    stencilRotationDeg,
    isStencilSnapped,
    hoverWorldPos,
    samplingStartWorldPos,
    provisionalSquareBox,
    zoom,
    onStartAdjustDrag
  }) => {
    if (!isSamplingPattern && !isAdjustingSampleBox) return null;

    const hx = hoverWorldPos ? hoverWorldPos.x * zoom : 0;
    const hy = hoverWorldPos ? hoverWorldPos.y * zoom : 0;
    const axisStroke = isStencilSnapped ? S.crosshairSnapped : S.crosshairDefault;
    const ringStroke = isStencilSnapped ? S.crosshairSnapped : S.crosshairRingDefault;
    const halfHandle = S.adjustHandleSizePx / 2;

    return (
      <>
        {/* 1. Retícula en cruz CAD extendida para alineación ortogonal precisa */}
        {isSamplingPattern && hoverWorldPos && (
          <g pointerEvents="none">
            <line
              x1={-S.crosshairExtentPx}
              y1={hy}
              x2={S.crosshairExtentPx}
              y2={hy}
              stroke={axisStroke}
              strokeWidth={1}
              strokeDasharray="6 4"
              strokeOpacity={0.6}
            />
            <line
              x1={hx}
              y1={-S.crosshairExtentPx}
              x2={hx}
              y2={S.crosshairExtentPx}
              stroke={axisStroke}
              strokeWidth={1}
              strokeDasharray="6 4"
              strokeOpacity={0.6}
            />
            <circle cx={hx} cy={hy} r={S.crosshairRingRadiusPx} fill="none" stroke={ringStroke} strokeWidth={1.5} />
            <line x1={hx - S.crosshairArmOuterPx} y1={hy} x2={hx - S.crosshairArmInnerPx} y2={hy} stroke={ringStroke} strokeWidth={1.5} />
            <line x1={hx + S.crosshairArmInnerPx} y1={hy} x2={hx + S.crosshairArmOuterPx} y2={hy} stroke={ringStroke} strokeWidth={1.5} />
            <line x1={hx} y1={hy - S.crosshairArmOuterPx} x2={hx} y2={hy - S.crosshairArmInnerPx} stroke={ringStroke} strokeWidth={1.5} />
            <line x1={hx} y1={hy + S.crosshairArmInnerPx} x2={hx} y2={hy + S.crosshairArmOuterPx} stroke={ringStroke} strokeWidth={1.5} />
          </g>
        )}

        {/* 2. Caja indicadora del objetivo para Auto-muestreo inteligente (1 clic) */}
        {isSamplingPattern && patternSamplingMode === 'auto' && hoverWorldPos && (() => {
          const sideM = stencilSizeWorld?.width || S.autoSampleDefaultSizeM;
          return (
            <g pointerEvents="none">
              <rect
                x={(hoverWorldPos.x - sideM / 2) * zoom}
                y={(hoverWorldPos.y - sideM / 2) * zoom}
                width={sideM * zoom}
                height={sideM * zoom}
                fill={S.autoSampleFill}
                stroke={S.crosshairDefault}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                rx={4}
              />
            </g>
          );
        })()}

        {/* 3. Recuadro elástico de selección de patrón (Marquesina Muestra #1) */}
        {isSamplingPattern &&
          !isAdjustingSampleBox &&
          (!positiveExemplarsCount || positiveExemplarsCount === 0) &&
          samplingStartWorldPos &&
          hoverWorldPos && (
            <g pointerEvents="none">
              <rect
                x={Math.min(samplingStartWorldPos.x, hoverWorldPos.x) * zoom}
                y={Math.min(samplingStartWorldPos.y, hoverWorldPos.y) * zoom}
                width={Math.abs(hoverWorldPos.x - samplingStartWorldPos.x) * zoom}
                height={Math.abs(hoverWorldPos.y - samplingStartWorldPos.y) * zoom}
                fill={S.marqueeFill}
                stroke={S.crosshairRingDefault}
                strokeWidth={2}
                strokeDasharray="5 3"
                rx={2}
              />
              <text
                x={((samplingStartWorldPos.x + hoverWorldPos.x) / 2) * zoom}
                y={(Math.min(samplingStartWorldPos.y, hoverWorldPos.y) - 0.15) * zoom}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={S.crosshairRingDefault}
                className="font-mono bg-white select-none"
              >
                🎯 Muestra #1: Enmarcar símbolo base
              </text>
            </g>
          )}

        {/* 4. Recuadro interactivo de ajuste fino para la Muestra #1 */}
        {isAdjustingSampleBox && provisionalSquareBox && (() => {
          const boxX = provisionalSquareBox.x * zoom;
          const boxY = provisionalSquareBox.y * zoom;
          const boxW = provisionalSquareBox.size * zoom;
          const boxH = provisionalSquareBox.size * zoom;
          const cx = boxX + boxW / 2;
          const cy = boxY + boxH / 2;

          return (
            <g className="select-none">
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                fill={S.adjustBoxFill}
                stroke={S.crosshairDefault}
                strokeWidth={2}
                strokeDasharray="4 2"
                rx={3}
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartAdjustDrag('move', e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (e.touches.length === 1) {
                    onStartAdjustDrag('move', e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
              />

              {/* Retícula en cruz milimétrica para centrado exacto sobre el símbolo */}
              <line
                x1={boxX}
                y1={cy}
                x2={boxX + boxW}
                y2={cy}
                stroke={S.crosshairRingDefault}
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.8}
                pointerEvents="none"
              />
              <line
                x1={cx}
                y1={boxY}
                x2={cx}
                y2={boxY + boxH}
                stroke={S.crosshairRingDefault}
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.8}
                pointerEvents="none"
              />
              <circle cx={cx} cy={cy} r={3} fill={S.crosshairRingDefault} pointerEvents="none" />

              <text
                x={cx}
                y={boxY - 10}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={S.crosshairRingDefault}
                className="font-mono bg-white select-none pointer-events-none"
              >
                🎯 Muestra #1 ({Math.round(provisionalSquareBox.size * 100)} cm) · Ajustá posición y tamaño
              </text>

              {CORNER_HANDLES.map(({ handle, dxFactor, dyFactor, cursor }) => {
                const hxCorner = boxX + dxFactor * boxW;
                const hyCorner = boxY + dyFactor * boxH;
                return (
                  <React.Fragment key={handle}>
                    <circle
                      cx={hxCorner}
                      cy={hyCorner}
                      r={S.adjustHandleHitRadiusPx}
                      fill="transparent"
                      className={cursor}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onStartAdjustDrag(handle, e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (e.touches.length === 1) {
                          onStartAdjustDrag(handle, e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                    />
                    <rect
                      x={hxCorner - halfHandle}
                      y={hyCorner - halfHandle}
                      width={S.adjustHandleSizePx}
                      height={S.adjustHandleSizePx}
                      fill={S.white}
                      stroke={S.crosshairRingDefault}
                      strokeWidth={2}
                      rx={2}
                      pointerEvents="none"
                    />
                  </React.Fragment>
                );
              })}
            </g>
          );
        })()}

        {/* 5. Esténcil rígido semitransparente asistido por SVD (Muestras #2 en adelante) */}
        {isSamplingPattern && positiveExemplarsCount > 0 && stencilSizeWorld && hoverWorldPos && (
          <g pointerEvents="none">
            <rect
              x={(hoverWorldPos.x - stencilSizeWorld.width / 2) * zoom}
              y={(hoverWorldPos.y - stencilSizeWorld.height / 2) * zoom}
              width={stencilSizeWorld.width * zoom}
              height={stencilSizeWorld.height * zoom}
              fill={isStencilSnapped ? S.stencilFillSnapped : S.stencilFillDefault}
              stroke={axisStroke}
              strokeWidth={isStencilSnapped ? 2.5 : 2}
              strokeDasharray={isStencilSnapped ? 'none' : '6 3'}
              rx={3}
            />
            <line
              x1={(hoverWorldPos.x - S.stencilCrossHalfM) * zoom}
              y1={hy}
              x2={(hoverWorldPos.x + S.stencilCrossHalfM) * zoom}
              y2={hy}
              stroke={ringStroke}
              strokeWidth={isStencilSnapped ? 2 : 1.5}
            />
            <line
              x1={hx}
              y1={(hoverWorldPos.y - S.stencilCrossHalfM) * zoom}
              x2={hx}
              y2={(hoverWorldPos.y + S.stencilCrossHalfM) * zoom}
              stroke={ringStroke}
              strokeWidth={isStencilSnapped ? 2 : 1.5}
            />
            <text
              x={hx}
              y={(hoverWorldPos.y - stencilSizeWorld.height / 2 - 0.15) * zoom}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill={isStencilSnapped ? S.stencilTextSnapped : S.crosshairRingDefault}
              className="font-mono bg-white select-none"
            >
              {isStencilSnapped
                ? `🎯 Snap fijado al símbolo (${stencilRotationDeg ?? 0}°) · Clic para confirmar`
                : `🎯 Sello Muestra #${positiveExemplarsCount + 1} (${stencilRotationDeg ?? 0}°) · Clic para estampar`}
            </text>
          </g>
        )}
      </>
    );
  }
);
PatternSamplingOverlayLayer.displayName = 'PatternSamplingOverlayLayer';
