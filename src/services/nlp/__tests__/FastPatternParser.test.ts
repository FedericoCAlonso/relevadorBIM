import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageFast, parseSpanishNumber, normalizeNlpText } from '../FastPatternParser';

describe('FastPatternParser — Parser Determinístico Ultrarrápido (<1ms)', () => {
  it('normaliza texto quitando tildes, preservando decimales y limpiando puntuacion', () => {
    expect(normalizeNlpText('  ¡Póné un Toma DÓBLE a 1,20m!  ')).toBe('pone un toma doble a 1.20m');
    expect(normalizeNlpText('puerta a 0,2m de pared este.')).toBe('puerta a 0.2m de pared este');
  });

  it('parsea números en español hablado', () => {
    expect(parseSpanishNumber('4')).toBe(4);
    expect(parseSpanishNumber('cuatro')).toBe(4);
    expect(parseSpanishNumber('3.5')).toBe(3.5);
    expect(parseSpanishNumber('tres y medio')).toBe(3.5);
    expect(parseSpanishNumber('1.20')).toBe(1.20);
    expect(parseSpanishNumber('un metro veinte')).toBe(1.20);
    expect(parseSpanishNumber('diecinueve')).toBe(19);
    expect(parseSpanishNumber('20cm')).toBe(0.20);
    expect(parseSpanishNumber('80 centimetros')).toBe(0.80);
    expect(parseSpanishNumber('4 metros')).toBe(4);
  });

  describe('Creación de Recintos', () => {
    it('extrae recinto aislado con dimensiones y aberturas', () => {
      const intent = parseNaturalLanguageFast(
        'Living comedor de 4 por 6 con puerta en pared norte y ventana en pared sur'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('create_space');
      if (intent?.action === 'create_space') {
        expect(intent.name).toBe('Living comedor');
        expect(intent.category).toBe('living_comedor');
        expect(intent.dimensions.widthM).toBe(4);
        expect(intent.dimensions.lengthM).toBe(6);
        expect(intent.openings).toBeDefined();
        expect(intent.openings).toHaveLength(2);
      }
    });

    it('soporta variaciones coloquiales de dimensiones ("4 metros por 6 metros", "4x6", etc.)', () => {
      const i1 = parseNaturalLanguageFast('living de 4 por 6');
      expect(i1?.action).toBe('create_space');
      if (i1?.action === 'create_space') {
        expect(i1.dimensions).toEqual({ widthM: 4, lengthM: 6 });
      }

      const i2 = parseNaturalLanguageFast('living de 4 metros por 6 metros');
      expect(i2?.action).toBe('create_space');
      if (i2?.action === 'create_space') {
        expect(i2.dimensions).toEqual({ widthM: 4, lengthM: 6 });
      }

      const i3 = parseNaturalLanguageFast('living 4x6');
      expect(i3?.action).toBe('create_space');
      if (i3?.action === 'create_space') {
        expect(i3.dimensions).toEqual({ widthM: 4, lengthM: 6 });
      }

      const i4 = parseNaturalLanguageFast('living de 4,5 x 6,2');
      expect(i4?.action).toBe('create_space');
      if (i4?.action === 'create_space') {
        expect(i4.dimensions).toEqual({ widthM: 4.5, lengthM: 6.2 });
      }
    });

    it('extrae recinto adosado con dimensiones y pared compartida', () => {
      const intent = parseNaturalLanguageFast(
        'Dormitorio de 3.5x4 pegado a la pared este del living'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('create_space');
      if (intent?.action === 'create_space') {
        expect(intent.name).toBe('Dormitorio');
        expect(intent.dimensions.widthM).toBe(3.5);
        expect(intent.dimensions.lengthM).toBe(4);
        expect(intent.relativeTo?.sharedWall).toBe('este');
      }
    });
  });

  describe('Emplazamiento de Aberturas Individuales', () => {
    it('extrae puerta con cota relativa a esquina perpendicular ("a 0,2m de pared este")', () => {
      const intent = parseNaturalLanguageFast(
        'puerta en pared norte a 0,2m de pared este'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_opening');
      if (intent?.action === 'place_opening') {
        expect(intent.openingType).toBe('door');
        expect(intent.wallReference).toBe('norte');
        expect(intent.referenceCornerWall).toBe('este');
        expect(intent.distanceM).toBeCloseTo(0.20, 2);
        expect(intent.centered).toBe(false);
      }
    });

    it('extrae puerta con cota en centimetros ("a 20cm de pared este")', () => {
      const intent = parseNaturalLanguageFast(
        'puerta en pared norte a 20cm de pared este'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_opening');
      if (intent?.action === 'place_opening') {
        expect(intent.openingType).toBe('door');
        expect(intent.wallReference).toBe('norte');
        expect(intent.referenceCornerWall).toBe('este');
        expect(intent.distanceM).toBeCloseTo(0.20, 2);
      }
    });

    it('extrae ventana centrada en pared sur', () => {
      const intent = parseNaturalLanguageFast('ventana centrada en pared sur');

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_opening');
      if (intent?.action === 'place_opening') {
        expect(intent.openingType).toBe('window');
        expect(intent.wallReference).toBe('sur');
        expect(intent.centered).toBe(true);
      }
    });

    it('distingue correctamente oeste de este sin colision de substring', () => {
      const intent = parseNaturalLanguageFast('ventana en pared sur de 1.20 a 0.50 de pared oeste');

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_opening');
      if (intent?.action === 'place_opening') {
        expect(intent.openingType).toBe('window');
        expect(intent.wallReference).toBe('sur');
        expect(intent.referenceCornerWall).toBe('oeste');
        expect(intent.distanceM).toBeCloseTo(0.50, 2);
        expect(intent.widthM).toBeCloseTo(1.20, 2);
      }
    });
  });

  describe('Emplazamiento de Elementos Eléctricos', () => {
    it('extrae toma en pared con altura Z y circuito', () => {
      const intent = parseNaturalLanguageFast(
        'Pone un toma doble a 1.20 en pared derecha circuito 2'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_element');
      if (intent?.action === 'place_element') {
        expect(intent.elementCategory).toBe('toma');
        expect(intent.mountType).toBe('wall');
        expect(intent.heightZM).toBe(1.20);
        expect(intent.wallReference).toBe('derecha');
        expect(intent.circuitNumber).toBe('2');
      }
    });

    it('extrae boca de techo centrada con circuito', () => {
      const intent = parseNaturalLanguageFast(
        'Boca de iluminacion centrada en el techo con circuito 1'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_element');
      if (intent?.action === 'place_element') {
        expect(intent.elementCategory).toBe('iluminacion_techo');
        expect(intent.mountType).toBe('ceiling');
        expect(intent.centeredInRoom).toBe(true);
        expect(intent.circuitNumber).toBe('1');
      }
    });

    it('extrae tablero seccional en pared', () => {
      const intent = parseNaturalLanguageFast(
        'Tablero seccional en pared norte a 1.50'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('place_element');
      if (intent?.action === 'place_element') {
        expect(intent.elementCategory).toBe('tablero');
        expect(intent.wallReference).toBe('norte');
        expect(intent.heightZM).toBe(1.50);
      }
    });
  });

  describe('Conexión de Cañerías', () => {
    it('extrae conexión por losa con diámetro', () => {
      const intent = parseNaturalLanguageFast(
        'Conectar este toma con la boca de techo por losa con caño de 19'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('connect_conduit');
      if (intent?.action === 'connect_conduit') {
        expect(intent.routingPlane).toBe('ceiling_slab');
        expect(intent.diameterMM).toBe(19);
        expect(intent.toElementRef).toBe('ceiling');
      }
    });
  });

  describe('Registro de Mediciones', () => {
    it('extrae medición de PAT', () => {
      const intent = parseNaturalLanguageFast(
        'Anotar resistencia de puesta a tierra 12.5 ohms'
      );

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('record_measurement');
      if (intent?.action === 'record_measurement') {
        expect(intent.measurementType).toBe('pat_resistance');
        expect(intent.value).toBe(12.5);
        expect(intent.unit).toBe('Ω');
      }
    });

    it('extrae medición de tensión', () => {
      const intent = parseNaturalLanguageFast('Tension 225 volts');

      expect(intent).not.toBeNull();
      expect(intent?.action).toBe('record_measurement');
      if (intent?.action === 'record_measurement') {
        expect(intent.measurementType).toBe('voltage_fn');
        expect(intent.value).toBe(225);
        expect(intent.unit).toBe('V');
      }
    });
  });

  it('retorna null en frases no estructuradas para delegar al LLM', () => {
    expect(parseNaturalLanguageFast('¿Cómo está el clima hoy en la obra?')).toBeNull();
    expect(parseNaturalLanguageFast('Hola buen día')).toBeNull();
  });
});
