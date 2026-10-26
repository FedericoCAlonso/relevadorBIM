/**
 * Píldoras y banners flotantes de estado del modo interactivo sobre el lienzo CAD:
 * conexión de cañerías, calibración de plano, cota libre, alero, reubicación de ambiente,
 * ajuste fino de Muestra #1 y detección de patrones SVD.
 */
import React from 'react';
import type {
  ConduitRoutingMode,
  SpatialElectricalNode
} from '../../../../models/electrical/ElectricalModel';

interface CanvasModeBannersProps {
  isDesktop: boolean;
  isConnectingConduit: boolean;
  pendingConduitStartId: string | null;
  pendingConduitWaypoints: ReadonlyArray<{ x: number; y: number }>;
  sequenceRoutingMode: ConduitRoutingMode;
  hoverWorldPos: { x: number; y: number } | null;
  elementsMap: Map<string, SpatialElectricalNode>;
  onUndoConduitWaypoint?: () => void;
  onClearConduitWaypoints?: () => void;
  onSetSequenceRoutingMode: (mode: ConduitRoutingMode) => void;
  onCommitConduitWithTerminalReference?: (pos: { x: number; y: number }) => void;
  onCancelConnectingConduit?: () => void;
  isCalibratingUnderlay: boolean;
  calibrationP1: { x: number; y: number } | null;
  onCancelCalibration?: () => void;
  isAddingDimension: boolean;
  dimensionP1: { x: number; y: number } | null;
  onCancelAddingDimension?: () => void;
  isDrawingOverhang: boolean;
  overhangP1: { x: number; y: number } | null;
  onCancelDrawingOverhang?: () => void;
  isMovingSpace: boolean;
  movingBasePoint: { x: number; y: number } | null;
  onCancelMovingSpace?: () => void;
  isAdjustingSampleBox: boolean;
  hasProvisionalSquareBox: boolean;
  onConfirmProvisionalSampleBox?: () => void;
  onCancelProvisionalSampleBox?: () => void;
  isSamplingPattern: boolean;
  onCancelSamplingPattern?: () => void;
}

export const CanvasModeBanners: React.FC<CanvasModeBannersProps> = React.memo(
  ({
    isDesktop,
    isConnectingConduit,
    pendingConduitStartId,
    pendingConduitWaypoints,
    sequenceRoutingMode,
    hoverWorldPos,
    elementsMap,
    onUndoConduitWaypoint,
    onClearConduitWaypoints,
    onSetSequenceRoutingMode,
    onCommitConduitWithTerminalReference,
    onCancelConnectingConduit,
    isCalibratingUnderlay,
    calibrationP1,
    onCancelCalibration,
    isAddingDimension,
    dimensionP1,
    onCancelAddingDimension,
    isDrawingOverhang,
    overhangP1,
    onCancelDrawingOverhang,
    isMovingSpace,
    movingBasePoint,
    onCancelMovingSpace,
    isAdjustingSampleBox,
    hasProvisionalSquareBox,
    onConfirmProvisionalSampleBox,
    onCancelProvisionalSampleBox,
    isSamplingPattern,
    onCancelSamplingPattern
  }) => (
    <>
      {/* 1. Banner superior cuando se conecta cañería (visible en escritorio) */}
      {isConnectingConduit && isDesktop && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-3.5 pr-2 py-1.5 rounded-full shadow-xl border border-amber-500/50 flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="truncate max-w-[280px] sm:max-w-none">
            {!pendingConduitStartId
              ? '⚡ Trazar Canalización: Tocá la primera boca o tablero'
              : sequenceRoutingMode === 'schematic_arc'
              ? '⚡ 1° Extremo fijado · Tocá la boca o tablero de destino'
              : pendingConduitWaypoints.length === 0
              ? '⚡ 1° Extremo fijado · Clic en plano para quiebre o en boca para cerrar'
              : `⚡ Recorrido (${pendingConduitWaypoints.length} quiebres) · Clic para sumar quiebre o en boca final`}
          </span>
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            {sequenceRoutingMode !== 'schematic_arc' &&
              pendingConduitWaypoints.length > 0 &&
              onUndoConduitWaypoint && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUndoConduitWaypoint();
                  }}
                  className="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-600 hover:bg-amber-800 text-amber-300 text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                  title="Deshacer último quiebre del recorrido"
                >
                  <span>↶ Deshacer</span>
                  <span className="bg-amber-800/80 px-1 rounded text-[10px]">
                    {pendingConduitWaypoints.length}
                  </span>
                </button>
              )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextMode = sequenceRoutingMode === 'orthogonal' ? 'schematic_arc' : 'orthogonal';
                onSetSequenceRoutingMode(nextMode);
                if (nextMode === 'schematic_arc') {
                  onClearConduitWaypoints?.();
                }
              }}
              className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 hover:bg-slate-700 text-amber-300 text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap"
              title="Alternar entre Arco Curvo AEA y Trazado Ortogonal a 90°"
            >
              {sequenceRoutingMode === 'orthogonal' ? '📐 90° Ortogonal' : '⌒ Arco AEA'}
            </button>
            {onCommitConduitWithTerminalReference && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  let targetPos: { x: number; y: number } | null = hoverWorldPos;
                  if (!targetPos && pendingConduitWaypoints.length > 0) {
                    targetPos = pendingConduitWaypoints[pendingConduitWaypoints.length - 1];
                  }
                  if (!targetPos && pendingConduitStartId) {
                    const start = elementsMap.get(pendingConduitStartId);
                    if (start) {
                      targetPos = { x: start.x + 1.0, y: start.y };
                    }
                  }
                  if (targetPos) {
                    onCommitConduitWithTerminalReference(targetPos);
                  }
                }}
                className="px-2 py-0.5 rounded-full bg-sky-950/90 border border-sky-600 hover:bg-sky-800 text-sky-300 text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                title="Rematar cañería en una etiqueta de referencia / pase a montante"
              >
                <span>➔ Rematar Etiqueta</span>
              </button>
            )}
            {onCancelConnectingConduit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelConnectingConduit();
                }}
                className="p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white text-[11px] transition-colors cursor-pointer ml-0.5"
                title="Cancelar conexión de canalización (Esc)"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Banner superior durante calibración de plano de fondo */}
      {isCalibratingUnderlay && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-sky-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span>
            {calibrationP1
              ? '📏 1° punto fijado · Tocá el segundo punto de la cota conocida'
              : '📏 Calibrar Escala: Tocá el primer punto de una cota conocida del plano'}
          </span>
          {onCancelCalibration && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelCalibration();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar calibración"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 3. Banner superior durante trazado de cota libre */}
      {isAddingDimension && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-blue-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
          <span>
            {dimensionP1
              ? '📐 1° punto fijado · Hacé clic en el segundo punto de la cota'
              : '📐 Trazar Cota: Hacé clic en el primer punto a medir'}
          </span>
          {onCancelAddingDimension && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelAddingDimension();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar trazado de cota"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 4. Banner superior durante trazado de alero / techo parcial */}
      {isDrawingOverhang && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-cyan-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>
            {overhangP1
              ? '☂ 1° punto fijado · Hacé clic en el segundo punto de la arista del alero'
              : '☂ Trazar Alero: Hacé clic en el primer punto de la arista del techo'}
          </span>
          {onCancelDrawingOverhang && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelDrawingOverhang();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar trazado de alero"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 5. Banner superior durante reubicación de ambiente */}
      {isMovingSpace && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-blue-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
          <span>
            {movingBasePoint
              ? `⚓ Punto Base: (${movingBasePoint.x.toFixed(2)}, ${movingBasePoint.y.toFixed(2)}) m · Clic en el destino para reubicar`
              : '⚓ Mover Ambiente: Clic en el plano para definir el Punto Base'}
          </span>
          {onCancelMovingSpace && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelMovingSpace();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar movimiento (Esc)"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 6. Banner superior durante ajuste fino interactivo de Muestra #1 */}
      {isAdjustingSampleBox && hasProvisionalSquareBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-2xl border border-cyan-400/60 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>📐 Ajustá posición y tamaño de la muestra base</span>
          {onConfirmProvisionalSampleBox && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmProvisionalSampleBox();
              }}
              className="ml-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-full shadow transition-colors cursor-pointer flex items-center gap-1"
              title="Confirmar muestra base (Enter)"
            >
              ✓ Confirmar (Enter)
            </button>
          )}
          {onCancelProvisionalSampleBox && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelProvisionalSampleBox();
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] rounded-full border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar ajuste (Esc)"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 7. Banner superior durante selección con recuadro para detectar símbolos */}
      {isSamplingPattern && !isAdjustingSampleBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white pl-4 pr-2 py-1.5 rounded-full shadow-xl border border-cyan-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>🎯 Arrastrá un recuadro sobre el símbolo del plano para detectarlo en toda la planta</span>
          {onCancelSamplingPattern && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelSamplingPattern();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-600 transition-colors cursor-pointer"
              title="Cancelar detección"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </>
  )
);
CanvasModeBanners.displayName = 'CanvasModeBanners';
