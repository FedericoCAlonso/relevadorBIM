import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPENING_TYPES,
  getOpeningTypesFromCatalog,
  findOpeningTypeById,
  filterOpeningTypes,
  type OpeningTypeDefinition
} from '../openingPresets';
import {
  createDefaultMaterialCatalog,
  createCableTraySizeOptions,
  formatConduitSizeLabel
} from '../../electrical/electricalStandards';

describe('openingPresets (Bibliotecas paramétricas de aberturas)', () => {
  it('contiene presets por defecto de puertas, ventanas y vanos con medidas estándar', () => {
    expect(DEFAULT_OPENING_TYPES.length).toBeGreaterThanOrEqual(10);

    const door80 = findOpeningTypeById('puerta_placa_80');
    expect(door80).toBeDefined();
    expect(door80?.width).toBe(0.80);
    expect(door80?.height).toBe(2.05);
    expect(door80?.sill).toBe(0.0);
    expect(door80?.type).toBe('door');

    const win120 = findOpeningTypeById('ventana_estandar_120');
    expect(win120).toBeDefined();
    expect(win120?.width).toBe(1.20);
    expect(win120?.height).toBe(1.10);
    expect(win120?.sill).toBe(0.90);
    expect(win120?.type).toBe('window');

    const pass80 = findOpeningTypeById('vano_paso_80');
    expect(pass80).toBeDefined();
    expect(pass80?.type).toBe('passage');
    expect(pass80?.sill).toBe(0.0);
  });

  it('permite filtrar aberturas por categoría funcional', () => {
    const doors = filterOpeningTypes(DEFAULT_OPENING_TYPES, 'door');
    expect(doors.every((d) => d.type === 'door')).toBe(true);
    expect(doors.length).toBeGreaterThanOrEqual(4);

    const windows = filterOpeningTypes(DEFAULT_OPENING_TYPES, 'window');
    expect(windows.every((w) => w.type === 'window')).toBe(true);

    const passages = filterOpeningTypes(DEFAULT_OPENING_TYPES, 'passage');
    expect(passages.every((p) => p.type === 'passage')).toBe(true);
  });

  it('getOpeningTypesFromCatalog prioriza aberturas del catálogo de proyecto sobre las por defecto', () => {
    const customOpening: OpeningTypeDefinition = {
      id: 'custom_porton_300',
      name: 'Portón Corredizo 300×220',
      type: 'door',
      width: 3.0,
      height: 2.2,
      sill: 0,
      isCustom: true
    };

    const catalog = createDefaultMaterialCatalog();
    catalog.openingTypes = [customOpening];

    const result = getOpeningTypesFromCatalog(catalog);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('custom_porton_300');
  });
});

describe('bandejas portacables paramétricas y formateo', () => {
  it('createCableTraySizeOptions genera calibres con dimensiones y área útil correcta', () => {
    const options = createCableTraySizeOptions([100, 150, 200, 300], 50);
    expect(options).toHaveLength(4);

    const opt150 = options.find((o) => o.value === 150);
    expect(opt150).toBeDefined();
    expect(opt150?.label).toBe('150 × 50 mm');
    expect(opt150?.trayWidthMM).toBe(150);
    expect(opt150?.trayHeightMM).toBe(50);
    expect(opt150?.usefulAreaMM2).toBe(7500);
    expect(opt150?.isTray).toBe(true);
  });

  it('formatConduitSizeLabel formatea caños con diámetro y bandejas con ancho x ala', () => {
    const catalog = createDefaultMaterialCatalog();

    // Caño rígido
    const labelCano = formatConduitSizeLabel('hierro_semipesado_rs', 19, catalog);
    expect(labelCano).toContain('19');

    // Bandeja de 20
    const labelBandeja20 = formatConduitSizeLabel('bandeja_perforada_20', 100, catalog);
    expect(labelBandeja20).toBe('100 × 20 mm');

    // Bandeja de 50
    const labelBandeja50 = formatConduitSizeLabel('bandeja_perforada_50', 200, catalog);
    expect(labelBandeja50).toBe('200 × 50 mm');
  });
});
