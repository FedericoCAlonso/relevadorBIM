/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: SpaceEditModal.tsx
 * Modal / Bottom Sheet para Edición de Ambientes en Móvil y Escritorio.
 * Permite nombrar el recinto (ej: Living, Cocina, Balcón, Galería), definir
 * su tipología de cubierta (Cubierto, Semicubierto, Descubierto), proyección
 * paramétrica de techo/alero y altura de cielorraso para cómputo AEA 771.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo } from 'react';
import { useProjectStore } from '../../../viewmodels/useProjectStore';
import {
  ROOM_NAME_SUGGESTIONS,
  STANDARD_CEILING_HEIGHT_PRESETS,
  STANDARD_OVERHANG_DEPTH_PRESETS,
  SPACE_COVER_TYPE_OPTIONS,
  calculateSpaceMetrics,
  computeCeilingProjection,
  type SpaceCoverType
} from '../../../models/architecture/Space';
import { getRecommendedIPForCover } from '../../../models/electrical/electricalStandards';
import {
  X,
  Building2,
  Check,
  ArrowUpToLine,
  Home,
  Umbrella,
  Sun,
  ShieldCheck,
  Ruler,
  SquareDashed
} from 'lucide-react';

interface SpaceEditModalProps {
  spaceId: string | null;
  onClose: () => void;
}

export const SpaceEditModal: React.FC<SpaceEditModalProps> = ({ spaceId, onClose }) => {
  const { project, updateSpace } = useProjectStore();

  const space = useMemo(() => {
    return spaceId ? project.spaces.find((s) => s.id === spaceId) : null;
  }, [project.spaces, spaceId]);

  const verticesMap = useMemo(() => {
    return new Map(project.vertices.map((v) => [v.id, v]));
  }, [project.vertices]);

  const wallsMap = useMemo(() => {
    return new Map(project.walls.map((w) => [w.id, w]));
  }, [project.walls]);

  if (!spaceId || !space) return null;

  const { areaM2: area, volumeM3: volume, limitAreaM2 } = calculateSpaceMetrics(space, verticesMap, wallsMap);
  const ceilingProj = computeCeilingProjection(space, verticesMap, wallsMap);

  const resolvedCoverType: SpaceCoverType =
    space.coverType ||
    (space.category === 'aire_luz' || space.category === 'pleno'
      ? 'vacio'
      : space.category === 'balcon'
      ? 'semicubierto'
      : space.category === 'exterior'
      ? 'descubierto'
      : 'cubierto');

  const recommendedIP = getRecommendedIPForCover(resolvedCoverType);

  const getCoverIcon = (type: SpaceCoverType) => {
    switch (type) {
      case 'cubierto':
        return <Home size={15} />;
      case 'semicubierto':
        return <Umbrella size={15} />;
      case 'descubierto':
        return <Sun size={15} />;
      case 'vacio':
        return <SquareDashed size={15} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Propiedades del Ambiente</h3>
              <p className="text-[11px] text-slate-500">Clasificación BIM y Superficie Límite AEA 771</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Métricas Normativas Calculadas */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Superficie Neta
            </span>
            <span className="text-base font-bold font-mono text-slate-800">
              {area.toFixed(2)} <span className="text-xs font-normal text-slate-500">m²</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block">
              S. Límite AEA
            </span>
            <span className="text-base font-bold font-mono text-blue-700">
              {(limitAreaM2 ?? area).toFixed(2)} <span className="text-xs font-normal text-blue-500">m²</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Volumen / IP
            </span>
            <span className="text-xs font-bold font-mono text-slate-800 block">
              {resolvedCoverType === 'descubierto' || resolvedCoverType === 'vacio'
                ? 'A cielo abierto'
                : `${volume.toFixed(2)} m³`}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 mt-0.5">
              <ShieldCheck size={10} />
              {recommendedIP}
            </span>
          </div>
        </div>

        {/* Campo de Nombre */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">NOMBRE DE LA HABITACIÓN</label>
          <input
            type="text"
            value={space.name}
            onChange={(e) => updateSpace(space.id, { name: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            placeholder="Ej: Living Comedor"
          />

          {/* Pastillas de sugerencia rápida */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ROOM_NAME_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => updateSpace(space.id, { name: sug })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  space.name === sug
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de Recinto y Cubierta */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700">TIPO DE CUBIERTA (REGLAMENTO AEA 771)</label>
          <div className="grid grid-cols-2 gap-2">
            {SPACE_COVER_TYPE_OPTIONS.map((opt) => {
              const isSelected = resolvedCoverType === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    updateSpace(space.id, {
                      coverType: opt.id,
                      category: opt.defaultCategory,
                      ceilingProjection:
                        opt.id === 'semicubierto'
                          ? space.ceilingProjection || { mode: 'total', overhangDepth: 1.50 }
                          : space.ceilingProjection
                    });
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {getCoverIcon(opt.id)}
                    <span>{opt.shortLabel}</span>
                  </div>
                  <span
                    className={`text-[10px] leading-tight line-clamp-1 ${
                      isSelected ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── DIVULGACIÓN PROGRESIVA SEGÚN TIPO DE CUBIERTA ── */}

        {/* 1. Semicubierto: Proyección de Techo / Alero */}
        {resolvedCoverType === 'semicubierto' && (
          <div className="space-y-3 p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Umbrella size={14} className="text-blue-600" />
                <span>Proyección del Techo / Alero</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                50% Computable AEA
              </span>
            </div>

            {/* Selector de Modo: Total vs Alero */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  updateSpace(space.id, {
                    ceilingProjection: {
                      ...(space.ceilingProjection || { overhangDepth: 1.50 }),
                      mode: 'total'
                    }
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                  !space.ceilingProjection || space.ceilingProjection.mode === 'total'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cubierta Completa
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSpace(space.id, {
                    ceilingProjection: {
                      ...(space.ceilingProjection || {}),
                      mode: 'alero',
                      overhangDepth: space.ceilingProjection?.overhangDepth ?? 1.50
                    }
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                  space.ceilingProjection?.mode === 'alero'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Alero Paramétrico
              </button>
            </div>

            {/* Ajuste de Profundidad de Alero cuando mode === 'alero' */}
            {space.ceilingProjection?.mode === 'alero' && (
              <div className="space-y-2 pt-2 border-t border-blue-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Ruler size={13} className="text-blue-600" />
                    <label className="text-xs font-bold text-blue-900">Profundidad del Alero:</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0.20"
                      max="10.00"
                      value={space.ceilingProjection.overhangDepth ?? 1.50}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1.50;
                        updateSpace(space.id, {
                          ceilingProjection: {
                            ...space.ceilingProjection!,
                            mode: 'alero',
                            overhangDepth: val
                          }
                        });
                      }}
                      className="w-20 px-2 py-1 bg-white border border-blue-300 rounded-lg font-mono font-bold text-xs text-center text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="font-mono text-xs font-bold text-blue-700">m</span>
                  </div>
                </div>

                {/* Presets de profundidad */}
                <div className="flex gap-1.5 justify-end">
                  {STANDARD_OVERHANG_DEPTH_PRESETS.map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => {
                        updateSpace(space.id, {
                          ceilingProjection: {
                            ...space.ceilingProjection!,
                            mode: 'alero',
                            overhangDepth: depth
                          }
                        });
                      }}
                      className={`px-2 py-0.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                        Math.abs((space.ceilingProjection?.overhangDepth ?? 1.50) - depth) < 0.01
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      {depth.toFixed(2)}m
                    </button>
                  ))}
                </div>

                {/* Detalle de superficie efectiva */}
                <div className="text-[11px] text-blue-800 bg-white/70 p-2 rounded-xl border border-blue-100 flex items-center justify-between">
                  <span>Área cubierta por alero:</span>
                  <span className="font-mono font-bold">
                    {ceilingProj.coveredAreaM2.toFixed(2)} m² (50% AEA: {(ceilingProj.coveredAreaM2 * 0.5).toFixed(2)} m²)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Campo de Altura de Techo (h) para recintos cubiertos y semicubiertos */}
        {resolvedCoverType !== 'descubierto' && resolvedCoverType !== 'vacio' && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowUpToLine size={15} className="text-blue-600" />
                <label className="text-xs font-bold text-slate-700">
                  {resolvedCoverType === 'semicubierto' ? 'ALTURA DE ALERO / TECHO (h)' : 'ALTURA DE TECHO (h)'}
                </label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  value={space.ceilingHeight}
                  onChange={(e) =>
                    updateSpace(space.id, { ceilingHeight: parseFloat(e.target.value) || 2.70 })
                  }
                  className="w-20 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <span className="font-mono text-xs text-slate-500 font-bold">m</span>
              </div>
            </div>

            {/* Pastillas de alturas predefinidas */}
            <div className="flex gap-1.5 justify-end">
              {STANDARD_CEILING_HEIGHT_PRESETS.map((hp) => (
                <button
                  key={hp}
                  type="button"
                  onClick={() => updateSpace(space.id, { ceilingHeight: hp })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                    Math.abs(space.ceilingHeight - hp) < 0.01
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'
                  }`}
                >
                  {hp.toFixed(2)}m
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Banner Informativo para Descubiertos */}
        {resolvedCoverType === 'descubierto' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Sun size={15} className="text-amber-600" />
              <span>Espacio a Cielo Abierto</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-snug">
              Sin cubierta ni losa superior. Computa <strong>0%</strong> para superficie límite AEA 771. Se recomienda
              grado de protección <strong>IP65</strong> para las bocas exteriores.
            </p>
          </div>
        )}

        {/* 4. Banner Informativo para Vacíos */}
        {resolvedCoverType === 'vacio' && (
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <SquareDashed size={15} className="text-slate-500" />
              <span>Vacío Arquitectónico / Pleno Técnico</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Hueco de losa o patio técnico de ventilación. No computa para superficie habitable ni límite.
            </p>
          </div>
        )}

        {/* Botón de Guardar / Aceptar */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
        >
          <Check size={16} strokeWidth={2.5} />
          <span>GUARDAR CAMBIOS</span>
        </button>
      </div>
    </div>
  );
};
