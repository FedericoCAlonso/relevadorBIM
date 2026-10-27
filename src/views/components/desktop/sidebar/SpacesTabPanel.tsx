/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBCOMPONENTE DE VISTA: SpacesTabPanel.tsx
 * Responsabilidad Única (SRP):
 * Pestaña de Ambientes y Alturas de Techo: resumen de Superficie Límite AEA 771,
 * nombres, tipo de cubierta, proyección de alero en semicubiertos, acceso a RCP
 * y reubicación de ambiente con punto base.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import {
  Building2,
  Cloud,
  Home,
  Umbrella,
  Sun,
  Layers,
  PenTool,
  Repeat,
  Move,
  Ruler,
  Eye,
  Trash2
} from 'lucide-react';
import { ARCHITECTURAL_SPACE_CONFIG } from '../../../../config';
import type { Space } from '../../../../models/architecture/Space';
import {
  isSpaceOpenAir,
  isSpaceSemiCovered,
  calculateSpaceMetrics,
  SPACE_COVER_TYPE_OPTIONS,
  getSpaceCoverOption,
  ROOM_NAME_SUGGESTIONS,
  STANDARD_CEILING_HEIGHT_PRESETS
} from '../../../../models/architecture/Space';
import type { Wall, WallVertex } from '../../../../models/architecture/Wall';
import { getWallLength } from '../../../../models/architecture/Wall';
import { calculateProjectLimitSurface } from '../../../../models/electrical/electricalStandards';
import { calculateSpaceWallReferences } from '../../../../models/architecture/spaceWallReference';
import { useWallElevationStore } from '../../../../viewmodels/useWallElevationViewModel';
import {
  SPACE_ANCHOR_OPTIONS,
  type SpaceAnchorPreset
} from '../../../../models/architecture/SpaceMoveEngine';
import { getSpaceOrthogonalDimensions } from '../../../../models/architecture/SpaceOrthogonalResize';
import { SpaceOrthogonalDimensionEditor } from '../../architecture/SpaceOrthogonalDimensionEditor';
import { useCeilingPlanStore } from '../../../../viewmodels/useCeilingPlanViewModel';

export interface SpacesTabPanelProps {
  activeLevelSpaces: ReadonlyArray<Space>;
  verticesMap: Map<string, WallVertex>;
  wallsMap: Map<string, Wall>;
  selectedSpaceId: string | null;
  onSelectSpace?: (spaceId: string) => void;
  onAutoDetectSpaces: () => void;
  onUpdateSpace: (spaceId: string, updates: Partial<Space>) => void;
  onResizeSpaceOrthogonal?: (params: {
    spaceId: string;
    axis: 'width' | 'length';
    newDimensionM: number;
    direction?: 'positive' | 'negative' | 'center';
  }) => void;
  onStartDrawingOverhang?: (spaceId: string) => void;
  onStartMovingSpace?: (spaceId: string, initialAnchorPreset?: SpaceAnchorPreset) => void;
  onDeleteSpace?: (spaceId: string) => void;
}

export const SpacesTabPanel: React.FC<SpacesTabPanelProps> = React.memo(
  ({
    activeLevelSpaces,
    verticesMap,
    wallsMap,
    selectedSpaceId,
    onSelectSpace,
    onAutoDetectSpaces,
    onUpdateSpace,
    onResizeSpaceOrthogonal,
    onStartDrawingOverhang,
    onStartMovingSpace,
    onDeleteSpace
  }) => {
    const limitSurfaceBreakdown = calculateProjectLimitSurface(
      activeLevelSpaces as Space[],
      verticesMap,
      wallsMap
    );

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-800">Ambientes del Nivel</span>
            <span className="text-[10px] text-slate-500 block">
              Identificación y clasificación AEA 771
            </span>
          </div>
          <button
            type="button"
            onClick={onAutoDetectSpaces}
            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Actualizar
          </button>
        </div>

        {activeLevelSpaces.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-3 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                Superficie Límite AEA 771
              </span>
              <span className="text-xs font-bold font-mono text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-100 shadow-2xs">
                {limitSurfaceBreakdown.totalLimitAreaM2.toFixed(2)} m²
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">Grado Electrificación:</span>
              <span className="font-bold text-indigo-700">
                {limitSurfaceBreakdown.electrificationDegree.label} (mín.{' '}
                {limitSurfaceBreakdown.electrificationDegree.minCircuits} ctos)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-blue-200/50">
              <span>Cub: {limitSurfaceBreakdown.coveredAreaM2} m²</span>
              <span>Semicub: {limitSurfaceBreakdown.semiCoveredAreaM2} m² (50%)</span>
              <span>Descub: {limitSurfaceBreakdown.openAreaM2} m²</span>
            </div>
          </div>
        )}

        {activeLevelSpaces.length === 0 ? (
          <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-slate-400 space-y-1">
            <Building2 size={24} className="mx-auto text-slate-300 mb-1" />
            <p className="font-medium text-xs text-slate-600">
              No hay ambientes detectados en este nivel
            </p>
            <p className="text-[11px]">
              Cerrá un circuito de 3 o más paredes para generar un ambiente automáticamente.
            </p>
          </div>
        ) : (
          activeLevelSpaces.map((space, idx) => {
            const metrics = calculateSpaceMetrics(space, verticesMap, wallsMap);
            const isSelected = selectedSpaceId === space.id;
            const isOpenAir = isSpaceOpenAir(space);
            const isSemi = isSpaceSemiCovered(space);
            const coverOption = getSpaceCoverOption(space.coverType);
            const spaceWallRefs = calculateSpaceWallReferences(space, verticesMap, wallsMap);

            return (
              <div
                key={space.id}
                onClick={() => onSelectSpace?.(space.id)}
                className={`rounded-2xl p-3 space-y-2.5 transition-all cursor-default ${
                  isSelected
                    ? 'bg-blue-50/80 border-2 border-blue-500 shadow-sm'
                    : 'bg-slate-50 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                      Ambiente {idx + 1}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        isOpenAir
                          ? 'bg-amber-100 text-amber-800'
                          : isSemi
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {coverOption.shortLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-[11px] font-mono font-bold text-slate-700">
                      {metrics.areaM2.toFixed(2)} m²{' '}
                      {isOpenAir ? '' : `· ${metrics.volumeM3.toFixed(2)} m³`}
                    </div>
                    {!isOpenAir && space.coverType !== 'vacio' && (
                      <button
                        type="button"
                        onClick={() => useCeilingPlanStore.getState().openCeilingPlan(space.id)}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Abrir Plano de Cielorraso Reflejado (RCP)"
                      >
                        <Cloud size={11} />
                        <span>RCP</span>
                      </button>
                    )}
                    {onDeleteSpace && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`¿Eliminar el ambiente "${space.name}"? Los muros compartidos con otros ambientes se preservarán intactos.`)) {
                            onDeleteSpace(space.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar ambiente (preserva muros compartidos)"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    NOMBRE DEL AMBIENTE
                  </label>
                  <input
                    type="text"
                    value={space.name}
                    onChange={(e) => onUpdateSpace(space.id, { name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Living Comedor"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {ROOM_NAME_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => onUpdateSpace(space.id, { name: sug })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                        space.name === sug
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Dimensiones Ortogonales del Ambiente */}
                {isSelected && onResizeSpaceOrthogonal && (
                  <SpaceOrthogonalDimensionEditor
                    spaceId={space.id}
                    dims={getSpaceOrthogonalDimensions(space, verticesMap)}
                    onResizeSpaceOrthogonal={onResizeSpaceOrthogonal}
                  />
                )}

                <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500">
                      TIPO DE CUBIERTA (AEA 771)
                    </label>
                    <span className="text-[10px] font-mono font-bold text-slate-600">
                      {coverOption.aeaAreaFactor === 1
                        ? '100% AEA'
                        : coverOption.aeaAreaFactor === 0.5
                        ? '50% AEA'
                        : '0% AEA'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SPACE_COVER_TYPE_OPTIONS.map((opt) => {
                      const isTypeSelected = (space.coverType || 'cubierto') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onUpdateSpace(space.id, {
                              coverType: opt.id,
                              category: opt.defaultCategory,
                              ceilingProjection:
                                opt.id === 'semicubierto'
                                  ? space.ceilingProjection || {
                                      mode: 'total',
                                      overhangDepth:
                                        ARCHITECTURAL_SPACE_CONFIG.DEFAULT_OVERHANG_DEPTH_M
                                    }
                                  : space.ceilingProjection
                            });
                          }}
                          className={`px-2 py-1.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isTypeSelected
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-medium'
                          }`}
                          title={opt.description}
                        >
                          {opt.id === 'cubierto' && (
                            <Home
                              size={13}
                              className={isTypeSelected ? 'text-white' : 'text-blue-600'}
                            />
                          )}
                          {opt.id === 'semicubierto' && (
                            <Umbrella
                              size={13}
                              className={isTypeSelected ? 'text-white' : 'text-cyan-600'}
                            />
                          )}
                          {opt.id === 'descubierto' && (
                            <Sun
                              size={13}
                              className={isTypeSelected ? 'text-white' : 'text-amber-500'}
                            />
                          )}
                          {opt.id === 'vacio' && (
                            <Layers
                              size={13}
                              className={isTypeSelected ? 'text-white' : 'text-slate-400'}
                            />
                          )}
                          <div className="min-w-0">
                            <span className="text-[11px] block leading-tight truncate">
                              {opt.shortLabel}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isSemi && (
                  <div className="p-2.5 bg-cyan-50/70 border border-cyan-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-cyan-900">
                      <span className="flex items-center gap-1">
                        <Umbrella size={12} className="text-cyan-600" />
                        <span>Proyección de Techo / Alero</span>
                      </span>
                      <span className="font-mono text-cyan-700">50% AEA</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSpace(space.id, {
                            ceilingProjection: {
                              ...(space.ceilingProjection || {
                                overhangDepth: ARCHITECTURAL_SPACE_CONFIG.DEFAULT_OVERHANG_DEPTH_M
                              }),
                              mode: 'total'
                            }
                          });
                        }}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer text-center ${
                          !space.ceilingProjection || space.ceilingProjection.mode === 'total'
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Techo Total
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSpace(space.id, {
                            ceilingProjection: {
                              ...(space.ceilingProjection || {
                                overhangDepth: ARCHITECTURAL_SPACE_CONFIG.DEFAULT_OVERHANG_DEPTH_M
                              }),
                              mode: 'alero'
                            }
                          });
                        }}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer text-center ${
                          space.ceilingProjection?.mode === 'alero'
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Alero Parcial
                      </button>
                    </div>

                    {space.ceilingProjection?.mode === 'alero' && (
                      <div className="space-y-2 pt-1 border-t border-cyan-200/60">
                        <button
                          type="button"
                          onClick={() => onStartDrawingOverhang?.(space.id)}
                          className="w-full py-1.5 px-2 bg-white hover:bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                        >
                          <PenTool size={12} className="text-cyan-600" />
                          <span>
                            {space.ceilingProjection?.projectionLine
                              ? 'Re-trazar Alero en Plano (2 clics)'
                              : 'Trazar Alero en Plano (2 clics)'}
                          </span>
                        </button>

                        {space.wallIds && space.wallIds.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                              <span>Muro de Apoyo / Fachada:</span>
                            </div>
                            <select
                              value={space.ceilingProjection?.referenceWallId || ''}
                              onChange={(e) => {
                                onUpdateSpace(space.id, {
                                  ceilingProjection: {
                                    ...(space.ceilingProjection || { mode: 'alero' }),
                                    referenceWallId: e.target.value || undefined,
                                    projectionLine: undefined
                                  }
                                });
                              }}
                              className="w-full text-[11px] py-1 px-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700"
                            >
                              <option value="">Automático (muro más largo)</option>
                              {space.wallIds.map((wId, i) => {
                                const w = wallsMap.get(wId);
                                const len = w ? getWallLength(w, verticesMap) : 0;
                                return (
                                  <option key={wId} value={wId}>
                                    Muro #{i + 1} ({len.toFixed(2)}m)
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600">
                            Profundidad Alero:
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.05"
                              min="0.20"
                              max="10.0"
                              value={
                                space.ceilingProjection.overhangDepth ??
                                ARCHITECTURAL_SPACE_CONFIG.DEFAULT_OVERHANG_DEPTH_M
                              }
                              onChange={(e) => {
                                const val =
                                  parseFloat(e.target.value) ||
                                  ARCHITECTURAL_SPACE_CONFIG.DEFAULT_OVERHANG_DEPTH_M;
                                onUpdateSpace(space.id, {
                                  ceilingProjection: {
                                    ...space.ceilingProjection,
                                    mode: 'alero',
                                    overhangDepth: Math.max(0.2, val),
                                    projectionLine: undefined
                                  }
                                });
                              }}
                              className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-center text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            <span className="font-mono text-xs text-slate-400">m</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-500 mr-0.5">
                            Presets:
                          </span>
                          {ARCHITECTURAL_SPACE_CONFIG.OVERHANG_DEPTH_PRESETS.map((depth) => {
                            const isDepthSelected =
                              Math.abs(
                                (space.ceilingProjection?.overhangDepth ??
                                  ARCHITECTURAL_SPACE_CONFIG.DEFAULT_OVERHANG_DEPTH_M) - depth
                              ) < 0.01;
                            return (
                              <button
                                key={depth}
                                type="button"
                                onClick={() => {
                                  onUpdateSpace(space.id, {
                                    ceilingProjection: {
                                      ...(space.ceilingProjection || {}),
                                      mode: 'alero',
                                      overhangDepth: depth,
                                      projectionLine: undefined
                                    }
                                  });
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                  isDepthSelected
                                    ? 'bg-cyan-600 text-white border-cyan-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {depth.toFixed(2)}m
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSpace(space.id, {
                              ceilingProjection: {
                                ...(space.ceilingProjection || { mode: 'alero' }),
                                invertSide: !space.ceilingProjection?.invertSide
                              }
                            });
                          }}
                          className="w-full py-1 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Repeat size={11} className="text-cyan-600" />
                          <span>
                            Invertir Lado Techado (
                            {space.ceilingProjection?.invertSide ? 'Invertido' : 'Normal'})
                          </span>
                        </button>

                        <div className="p-2 bg-white/80 border border-cyan-200 rounded-lg text-[10px] space-y-0.5 font-mono">
                          <div className="flex justify-between text-cyan-900 font-bold">
                            <span>Techado (50% AEA):</span>
                            <span>
                              {metrics.coveredAreaM2?.toFixed(2) ?? '-'} m² (
                              {(metrics.limitAreaM2 ?? 0).toFixed(2)} m²)
                            </span>
                          </div>
                          <div className="flex justify-between text-amber-800 font-medium">
                            <span>A cielo abierto (0% AEA):</span>
                            <span>{metrics.uncoveredAreaM2?.toFixed(2) ?? '-'} m²</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isOpenAir || space.coverType === 'vacio' ? (
                  <div className="pt-2 border-t border-slate-200/80 text-[11px] text-amber-800 bg-amber-50/60 p-2 rounded-xl flex items-center justify-between">
                    <span>
                      {space.coverType === 'vacio'
                        ? 'Vacío / Pleno (sin cielorraso)'
                        : 'A cielo abierto (sin cielorraso)'}
                    </span>
                    <span className="font-bold font-mono">0% AEA</span>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">
                        {isSemi ? 'Altura Alero / Techo (h):' : 'Altura de Techo (h):'}
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.05"
                          value={space.ceilingHeight}
                          onChange={(e) =>
                            onUpdateSpace(space.id, {
                              ceilingHeight:
                                parseFloat(e.target.value) ||
                                ARCHITECTURAL_SPACE_CONFIG.DEFAULT_CEILING_HEIGHT_M
                            })
                          }
                          className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="font-mono text-xs text-slate-400">m</span>
                      </div>
                    </div>

                    <div className="flex gap-1 justify-end">
                      {STANDARD_CEILING_HEIGHT_PRESETS.map((hp) => (
                        <button
                          key={hp}
                          type="button"
                          onClick={() => onUpdateSpace(space.id, { ceilingHeight: hp })}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            Math.abs(space.ceilingHeight - hp) < 0.01
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {hp.toFixed(2)}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Referencias Relativas de Paredes (Pared A, B, C...) - Divulgación Progresiva */}
                {isSelected && spaceWallRefs.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                      <span className="flex items-center gap-1">
                        <Ruler size={12} className="text-blue-600" />
                        <span>Paredes del Ambiente ({spaceWallRefs.length})</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal">Secuencia horaria</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {spaceWallRefs.map((wRef) => (
                        <div
                          key={wRef.letter}
                          className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded-lg text-[11px] shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold font-mono text-[9px] flex items-center justify-center shrink-0">
                              {wRef.letter}
                            </span>
                            <div className="truncate">
                              <span className="font-semibold text-slate-800 block truncate leading-tight">
                                {wRef.shortLabel}
                              </span>
                              <span className="text-[9px] text-slate-400 block font-mono truncate leading-tight">
                                {wRef.compassOrientation} · {wRef.lengthM.toFixed(2)} m
                              </span>
                            </div>
                          </div>

                          {wRef.wallId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                useWallElevationStore.getState().openElevation(wRef.wallId!);
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold transition-colors cursor-pointer shrink-0 ml-1"
                              title="Abrir vista de alzado 2D de la pared"
                            >
                              <Eye size={10} />
                              <span>Alzado</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {onStartMovingSpace && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Move size={12} className="text-blue-600" />
                        <span>Mover con Punto Base</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal">Reubicar</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {SPACE_ANCHOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onStartMovingSpace(space.id, opt.id)}
                          className="py-1 px-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center"
                          title={`Mover tomando como punto base ${opt.label}`}
                        >
                          {opt.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }
);
SpacesTabPanel.displayName = 'SpacesTabPanel';
