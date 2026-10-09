/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO NLP: naturalLanguageSchema.ts
 * Responsabilidad Única:
 * Esquemas de validación Zod y tipos TypeScript que definen el contrato
 * estricto de intenciones extraídas por lenguaje natural (Constrained Decoding).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';

export const RelativeOrientationSchema = z.enum([
  'norte',
  'sur',
  'este',
  'oeste',
  'derecha',
  'izquierda',
  'frente',
  'fondo'
]);
export type RelativeOrientation = z.infer<typeof RelativeOrientationSchema>;

export const SpaceCategorySchema = z.enum([
  'living_comedor',
  'dormitorio',
  'cocina',
  'bano',
  'circulacion',
  'balcon',
  'otro'
]);
export type NlpSpaceCategory = z.infer<typeof SpaceCategorySchema>;

export const OpeningTypeNlpSchema = z.enum(['door', 'window', 'passage']);
export type NlpOpeningType = z.infer<typeof OpeningTypeNlpSchema>;

export const SpaceOpeningSpecSchema = z.object({
  type: OpeningTypeNlpSchema,
  wall: RelativeOrientationSchema,
  distanceFromCornerM: z.number().positive().optional(),
  centered: z.boolean().optional(),
  widthM: z.number().positive().optional()
});
export type SpaceOpeningSpec = z.infer<typeof SpaceOpeningSpecSchema>;

export const CreateSpaceIntentSchema = z.object({
  action: z.literal('create_space'),
  name: z.string().min(1),
  category: SpaceCategorySchema.optional(),
  dimensions: z.object({
    widthM: z.number().positive(),
    lengthM: z.number().positive()
  }),
  relativeTo: z
    .object({
      targetSpaceName: z.string().optional(),
      sharedWall: RelativeOrientationSchema.optional()
    })
    .optional(),
  openings: z.array(SpaceOpeningSpecSchema).optional()
});
export type CreateSpaceIntent = z.infer<typeof CreateSpaceIntentSchema>;

export const ElementCategorySchema = z.enum([
  'toma',
  'llave',
  'iluminacion_techo',
  'aplique_pared',
  'tablero',
  'caja_paso'
]);
export type NlpElementCategory = z.infer<typeof ElementCategorySchema>;

export const PlaceElementIntentSchema = z.object({
  action: z.literal('place_element'),
  elementCategory: ElementCategorySchema,
  symbolId: z.string().optional(),
  mountType: z.enum(['wall', 'ceiling']).optional(),
  heightZM: z.number().nonnegative().optional(),
  circuitNumber: z.union([z.number(), z.string()]).optional(),
  wallReference: RelativeOrientationSchema.optional(),
  distanceAlongWallM: z.number().nonnegative().optional(),
  centeredInRoom: z.boolean().optional(),
  spaceName: z.string().optional()
});
export type PlaceElementIntent = z.infer<typeof PlaceElementIntentSchema>;

export const RoutingPlaneSchema = z.enum(['ceiling_slab', 'floor_slab', 'wall']);
export type NlpRoutingPlane = z.infer<typeof RoutingPlaneSchema>;

export const ConnectConduitIntentSchema = z.object({
  action: z.literal('connect_conduit'),
  fromElementRef: z.string().optional(),
  toElementRef: z.string().optional(),
  routingPlane: RoutingPlaneSchema.optional(),
  diameterMM: z.number().positive().optional()
});
export type ConnectConduitIntent = z.infer<typeof ConnectConduitIntentSchema>;

export const MeasurementTypeSchema = z.enum([
  'pat_resistance',
  'voltage_fn',
  'voltage_ft',
  'voltage_nt',
  'insulation',
  'current'
]);
export type NlpMeasurementType = z.infer<typeof MeasurementTypeSchema>;

export const RecordMeasurementIntentSchema = z.object({
  action: z.literal('record_measurement'),
  targetElementRef: z.string().optional(),
  measurementType: MeasurementTypeSchema,
  value: z.number(),
  unit: z.string()
});
export type RecordMeasurementIntent = z.infer<typeof RecordMeasurementIntentSchema>;

export const NaturalLanguageIntentSchema = z.discriminatedUnion('action', [
  CreateSpaceIntentSchema,
  PlaceElementIntentSchema,
  ConnectConduitIntentSchema,
  RecordMeasurementIntentSchema
]);
export type NaturalLanguageIntent = z.infer<typeof NaturalLanguageIntentSchema>;
