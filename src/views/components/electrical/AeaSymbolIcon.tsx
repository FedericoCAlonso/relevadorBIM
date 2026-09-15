/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPONENTE: AeaSymbolIcon.tsx
 * Renderizador Normalizado de Símbolos Electromecánicos según Norma AEA 90364.
 * Funciona tanto dentro de la interfaz HTML (botones, paleta) como dentro del
 * lienzo SVG CAD (BimCanvas) garantizando visibilidad absoluta, escala correcta
 * y respaldo de contraste (halo) contra fondos de muros y pisos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { getSymbolById } from '../../../models/electrical/symbolsLib';

interface AeaSymbolIconProps {
  symbolId: string;
  size?: number;
  className?: string;
  color?: string;
  isSelected?: boolean;
}

/**
 * Renderiza el símbolo dentro de un contexto HTML (botones, paleta, listados)
 * dentro de un SVG independiente con viewBox normalizado (-1.2 a 1.2 o -2 a 2).
 */
export const AeaSymbolIcon: React.FC<AeaSymbolIconProps> = ({
  symbolId,
  size = 28,
  className = '',
  color = 'currentColor',
  isSelected = false
}) => {
  const symDef = getSymbolById(symbolId);
  const isTablero = symbolId.includes('tablero') || symbolId.includes('tp') || symbolId.includes('ts') || symbolId.includes('medidor');
  const viewBox = isTablero ? '-2.2 -1.5 4.4 3.0' : '-1.2 -1.2 2.4 2.4';

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={`shrink-0 select-none overflow-visible ${className}`}
      fill="none"
      stroke={color}
      strokeWidth={isTablero ? 0.12 : 0.08}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Halo de selección */}
      {isSelected && (
        <circle cx={0} cy={0} r={1.1} fill="rgba(37, 99, 235, 0.15)" stroke="#2563eb" strokeWidth={0.08} />
      )}

      {/* Si el símbolo tiene svgContent, lo inyectamos de forma segura dentro del SVG */}
      {symDef?.svgContent ? (
        <g
          dangerouslySetInnerHTML={{ __html: symDef.svgContent }}
          className="text-inherit"
          color={color}
          fill="none"
        />
      ) : (
        /* Fallback geométrico limpio AEA si no hay definición */
        renderAeaFallback(symbolId, color)
      )}
    </svg>
  );
};

/**
 * Renderiza el símbolo directamente dentro del lienzo SVG CAD (BimCanvas)
 * a escala de pantalla legible con respaldo blanco opaco (halo) para contraste.
 */
/**
 * Renderiza el símbolo directamente dentro del lienzo SVG CAD (BimCanvas).
 * Símbolo puro: sin recuadros, sin fondos blancos, sin enmarcado.
 * Se dibuja el trazado vectorial puro con su rotación paramétrica.
 */
export const AeaCanvasSymbol: React.FC<{
  symbolId: string;
  zoom: number;
  isSelected?: boolean;
  elementLabel?: string;
  circuitLabel?: string;
  returnRef?: string;
  rotationDeg?: number;
}> = ({ symbolId, isSelected = false, elementLabel, circuitLabel, returnRef, rotationDeg = 0 }) => {
  const symDef = getSymbolById(symbolId);
  const isTablero =
    symbolId.includes('tablero') ||
    symbolId.includes('tp') ||
    symbolId.includes('ts') ||
    symbolId.includes('medidor');

  // Escala visual normalizada para el canvas CAD
  const scale = 18;
  const strokeColor = isSelected ? '#2563eb' : '#0f172a';

  return (
    <g className="select-none" transform={`rotate(${rotationDeg})`}>
      {/* Área de impacto invisible para selección táctil y de ratón al 100% de efectividad */}
      <circle r={22} fill="transparent" pointerEvents="all" className="cursor-pointer" />

      {/* Halo de selección punteado discreto para feedback visual claro */}
      {isSelected && (
        <circle
          r={20}
          fill="rgba(37, 99, 235, 0.12)"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          pointerEvents="none"
        />
      )}

      {/* Geometría PURA del símbolo AEA: sin fondos, sin recuadros ni enmarcados */}
      <g
        transform={`scale(${scale})`}
        stroke={strokeColor}
        strokeWidth={isTablero ? 0.12 : isSelected ? 0.10 : 0.08}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        pointerEvents="none"
      >
        {symDef?.svgContent ? (
          <g dangerouslySetInnerHTML={{ __html: symDef.svgContent }} color={strokeColor} />
        ) : (
          renderAeaFallback(symbolId, strokeColor)
        )}
      </g>

      {/* Rótulo identificatorio puro (sin cajas ni fondos), compensado para mantenerse horizontal */}
      {(elementLabel || circuitLabel || returnRef) && (
        <text
          x={16}
          y={4}
          transform={`rotate(${-rotationDeg}, 16, 4)`}
          fontSize={10}
          fontWeight="bold"
          fill={isSelected ? '#2563eb' : '#334155'}
          className="font-mono select-none pointer-events-none"
        >
          {circuitLabel ? `[${circuitLabel}] ` : ''}
          {elementLabel || ''}
          {returnRef ? ` (${returnRef})` : ''}
        </text>
      )}
    </g>
  );
};

/**
 * Gráficos vectoriales vectorizados puros para símbolos AEA 90364
 */
function renderAeaFallback(symbolId: string, color: string): React.ReactNode {
  if (symbolId.includes('techo') || symbolId.includes('iug')) {
    // Boca de Techo (IUG): círculo con aspa en X
    return (
      <g stroke={color}>
        <circle cx={0} cy={0} r={0.45} strokeWidth={0.08} fill="none" />
        <line x1={-0.32} y1={-0.32} x2={0.32} y2={0.32} strokeWidth={0.08} />
        <line x1={0.32} y1={-0.32} x2={-0.32} y2={0.32} strokeWidth={0.08} />
      </g>
    );
  }

  if (symbolId.includes('pared') || symbolId.includes('aplique') || symbolId.includes('brazo')) {
    // Boca de Pared (Brazo): círculo con aspa y pata perpendicular
    return (
      <g stroke={color}>
        <circle cx={0} cy={0} r={0.45} strokeWidth={0.08} fill="none" />
        <line x1={-0.32} y1={-0.32} x2={0.32} y2={0.32} strokeWidth={0.08} />
        <line x1={0.32} y1={-0.32} x2={-0.32} y2={0.32} strokeWidth={0.08} />
        <line x1={-0.45} y1={0} x2={-0.85} y2={0} strokeWidth={0.1} />
      </g>
    );
  }

  if (symbolId.includes('toma') || symbolId.includes('enchufe') || symbolId.includes('tug') || symbolId.includes('tue')) {
    // Tomacorriente (TUG/TUE): semicírculo con rayos
    return (
      <g stroke={color}>
        <path d="M -0.45 0 A 0.45 0.45 0 0 1 0.45 0" strokeWidth={0.08} fill="none" />
        <line x1={-0.45} y1={0} x2={-0.65} y2={0} strokeWidth={0.08} />
        <line x1={0.45} y1={0} x2={0.65} y2={0} strokeWidth={0.08} />
        <line x1={0} y1={-0.45} x2={0} y2={-0.65} strokeWidth={0.08} />
      </g>
    );
  }

  if (symbolId.includes('llave-1') || symbolId.includes('interruptor-1')) {
    // Llave 1 punto: círculo lleno + palanca
    return (
      <g stroke={color}>
        <circle cx={0} cy={0} r={0.12} fill={color} />
        <line x1={0} y1={0} x2={0.4} y2={-0.4} strokeWidth={0.08} />
        <line x1={0.4} y1={-0.4} x2={0.55} y2={-0.25} strokeWidth={0.08} />
      </g>
    );
  }

  if (symbolId.includes('llave-2')) {
    // Llave 2 puntos
    return (
      <g stroke={color}>
        <circle cx={0} cy={0} r={0.12} fill={color} />
        <line x1={0} y1={0} x2={0.35} y2={-0.35} strokeWidth={0.08} />
        <line x1={0.35} y1={-0.35} x2={0.5} y2={-0.2} strokeWidth={0.08} />
        <line x1={0} y1={0} x2={0.45} y2={-0.1} strokeWidth={0.08} />
        <line x1={0.45} y1={-0.1} x2={0.55} y2={0.05} strokeWidth={0.08} />
      </g>
    );
  }

  if (symbolId.includes('llave-comb') || symbolId.includes('combinacion')) {
    // Llave de combinación
    return (
      <g stroke={color}>
        <circle cx={0} cy={0} r={0.12} fill={color} />
        <line x1={0} y1={0} x2={0.35} y2={-0.35} strokeWidth={0.08} />
        <line x1={0.35} y1={-0.35} x2={0.5} y2={-0.2} strokeWidth={0.08} />
        <line x1={0} y1={0} x2={-0.35} y2={0.35} strokeWidth={0.08} />
        <line x1={-0.35} y1={0.35} x2={-0.5} y2={0.2} strokeWidth={0.08} />
      </g>
    );
  }

  if (symbolId.includes('tp') || symbolId.includes('tablero-principal')) {
    // Tablero Principal: rectángulo cruzado con media mitad rellena
    return (
      <g stroke={color}>
        <rect x={-1.4} y={-0.6} width={2.8} height={1.2} strokeWidth={0.1} fill="none" />
        <polygon points="-1.4,-0.6 1.4,-0.6 1.4,0.6" fill={color} fillOpacity={0.25} />
        <line x1={-1.4} y1={-0.6} x2={1.4} y2={0.6} strokeWidth={0.08} />
        <line x1={1.4} y1={-0.6} x2={-1.4} y2={0.6} strokeWidth={0.08} />
      </g>
    );
  }

  if (symbolId.includes('ts') || symbolId.includes('seccional')) {
    // Tablero Seccional: rectángulo con diagonal
    return (
      <g stroke={color}>
        <rect x={-1.4} y={-0.6} width={2.8} height={1.2} strokeWidth={0.1} fill="none" />
        <line x1={-1.4} y1={-0.6} x2={1.4} y2={0.6} strokeWidth={0.08} />
      </g>
    );
  }

  // Genérico circular
  return (
    <g stroke={color}>
      <circle cx={0} cy={0} r={0.4} strokeWidth={0.08} fill="none" />
      <circle cx={0} cy={0} r={0.1} fill={color} />
    </g>
  );
}
