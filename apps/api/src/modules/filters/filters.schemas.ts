import { z } from 'zod';

export const providerValues = ['otomoto', 'olx', 'mobile_de', 'autoscout24'] as const;
export const fuelTypeValues = [
  'petrol',
  'petrol_lpg',
  'petrol_cng',
  'diesel',
  'hybrid',
  'plugin_hybrid',
  'electric',
  'hydrogen',
  'other',
] as const;
export const gearboxValues = ['manual', 'automatic', 'semi_automatic', 'other'] as const;
export const bodyTypeValues = [
  'sedan',
  'hatchback',
  'wagon',
  'suv',
  'coupe',
  'convertible',
  'minivan',
  'pickup',
  'van',
  'other',
] as const;
export const driveTypeValues = ['fwd', 'rwd', 'awd', 'other'] as const;
export const conditionValues = ['new', 'used', 'damaged'] as const;
export const sellerTypeValues = ['private', 'dealer', 'unknown'] as const;

const currentYear = new Date().getFullYear();

export const filterInputSchema = z
  .object({
    provider: z.enum(providerValues).default('otomoto'),
    name: z.string().trim().max(120).nullish(),
    isActive: z.boolean().default(true),

    make: z.string().trim().max(60).nullish(),
    model: z.string().trim().max(80).nullish(),
    generation: z.string().trim().max(80).nullish(),
    version: z.string().trim().max(120).nullish(),
    query: z.string().trim().max(200).nullish(),

    yearFrom: z.number().int().min(1900).max(currentYear + 2).nullish(),
    yearTo: z.number().int().min(1900).max(currentYear + 2).nullish(),
    priceFrom: z.number().nonnegative().max(100_000_000).nullish(),
    priceTo: z.number().nonnegative().max(100_000_000).nullish(),
    currency: z.string().length(3).default('PLN'),
    mileageFrom: z.number().int().nonnegative().max(3_000_000).nullish(),
    mileageTo: z.number().int().nonnegative().max(3_000_000).nullish(),
    enginePowerFrom: z.number().int().nonnegative().max(2_000).nullish(),
    enginePowerTo: z.number().int().nonnegative().max(2_000).nullish(),
    engineCapacityFrom: z.number().int().nonnegative().max(10_000).nullish(),
    engineCapacityTo: z.number().int().nonnegative().max(10_000).nullish(),

    fuelTypes: z.array(z.enum(fuelTypeValues)).max(9).nullish(),
    gearboxes: z.array(z.enum(gearboxValues)).max(4).nullish(),
    bodyTypes: z.array(z.enum(bodyTypeValues)).max(10).nullish(),
    driveTypes: z.array(z.enum(driveTypeValues)).max(4).nullish(),

    condition: z.enum(conditionValues).nullish(),
    sellerType: z.enum(sellerTypeValues).nullish(),
    excludeDamaged: z.boolean().default(false),
    onlyWithPhotos: z.boolean().default(false),
    registeredInPl: z.boolean().nullish(),
    firstOwner: z.boolean().nullish(),

    countryOrigin: z.string().trim().max(60).nullish(),
    region: z.string().trim().max(80).nullish(),
    city: z.string().trim().max(120).nullish(),
    radiusKm: z.number().int().min(0).max(1000).nullish(),

    colors: z.array(z.string().trim().max(40)).max(20).nullish(),
    doorCounts: z.array(z.number().int().min(1).max(9)).max(9).nullish(),
    seatCounts: z.array(z.number().int().min(1).max(20)).max(12).nullish(),
    noAccident: z.boolean().nullish(),
    servicedAtAso: z.boolean().nullish(),
    hasVin: z.boolean().nullish(),
    vatInvoice: z.boolean().nullish(),

    /** Provider filter ids from the taxonomy, e.g. filter_enum_towbar. */
    equipment: z
      .array(z.string().regex(/^filter_(enum|string)_[a-z0-9_]+$/))
      .max(60)
      .nullish(),

    extraParams: z.record(z.unknown()).nullish(),
  })
  .superRefine((data, ctx) => {
    const ranges: Array<[string, string, unknown, unknown]> = [
      ['yearFrom', 'yearTo', data.yearFrom, data.yearTo],
      ['priceFrom', 'priceTo', data.priceFrom, data.priceTo],
      ['mileageFrom', 'mileageTo', data.mileageFrom, data.mileageTo],
      ['enginePowerFrom', 'enginePowerTo', data.enginePowerFrom, data.enginePowerTo],
      [
        'engineCapacityFrom',
        'engineCapacityTo',
        data.engineCapacityFrom,
        data.engineCapacityTo,
      ],
    ];

    for (const [fromKey, toKey, from, to] of ranges) {
      if (typeof from === 'number' && typeof to === 'number' && from > to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [toKey],
          message: `Wartość "${toKey}" musi być większa lub równa "${fromKey}"`,
        });
      }
    }
  });

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Nazwa grupy jest wymagana').max(120),
  description: z.string().trim().max(1000).nullish(),
  color: z.string().trim().max(20).nullish(),
  icon: z.string().trim().max(40).nullish(),
  isActive: z.boolean().default(true),
  notifyOnNew: z.boolean().default(true),
  refreshIntervalMinutes: z.number().int().min(15).max(10_080).default(60),
  filters: z.array(filterInputSchema).max(20).default([]),
});

export const updateGroupSchema = createGroupSchema.partial().omit({ filters: true });

export const groupIdParam = z.object({ id: z.string().uuid() });
export const filterIdParam = z.object({
  id: z.string().uuid(),
  filterId: z.string().uuid(),
});

export type FilterInput = z.infer<typeof filterInputSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
