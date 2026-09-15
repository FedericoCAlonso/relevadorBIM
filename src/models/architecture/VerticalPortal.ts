/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODELO: VerticalPortal.ts
 * Portales Verticales: Escaleras, Ascensores y Huecos de Pasadizo.
 * Elementos que comparten huella (X, Y) a través de dos o más niveles
 * y canalizan tendidos eléctricos verticales (montantes).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type VerticalPortalType = 'stairs' | 'elevator' | 'shaft';

export interface StairsParameters {
  shape: 'straight' | 'L' | 'U';
  direction: 'up' | 'down';
  treadsCount: number;        // Cantidad de escalones / pedadas
  riserHeight: number;        // Alzada aproximada en metros (ej: 0.175)
  treadDepth: number;         // Pedada en metros (ej: 0.26)
  hasHandrail: boolean;
}

export interface ElevatorParameters {
  capacityKg: number;         // Capacidad en kg (ej: 450 kg = 6 personas)
  motorPowerKW: number;       // Potencia nominal del motor en kW para fuerza motriz
  hasMachineRoomAbove: boolean; // Sala de máquinas superior
  doorType: 'telescopic' | 'central' | 'manual';
}

export interface VerticalPortal {
  id: string;
  name: string;               // Ej: "Escalera Principal", "Ascensor 1"
  type: VerticalPortalType;
  baseLevelId: string;        // Nivel inferior donde nace
  targetLevelId: string;      // Nivel superior al que llega
  x: number;                  // Coordenada X del punto de inserción (esquina o centro)
  y: number;                  // Coordenada Y del punto de inserción
  width: number;              // Ancho de la huella en metros
  length: number;             // Largo de la huella en metros
  rotationDeg: number;        // Rotación en grados [0, 360)
  stairsConfig?: StairsParameters;
  elevatorConfig?: ElevatorParameters;
}
