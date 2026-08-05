import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';
import {
  bodyTypeValues,
  fuelTypeValues,
  gearboxValues,
  providerValues,
  sellerTypeValues,
} from '../filters/filters.schemas.js';

/** Accepts `?fuelType=diesel&fuelType=hybrid` and `?fuelType=diesel,hybrid`. */
const csvArray = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .pipe(z.array(z.enum(values)))
    .optional();

export const listingSortValues = [
  /** By the marketplace's publication date. */
  'newest',
  'oldest',
  /** By when our fetcher first saw the advert. */
  'added_newest',
  'price_asc',
  'price_desc',
  'mileage_asc',
  'year_desc',
] as const;

export const listingQuerySchema = paginationSchema.extend({
  groupId: z.string().uuid().optional(),
  filterId: z.string().uuid().optional(),
  provider: csvArray(providerValues),
  q: z.string().trim().max(200).optional(),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(80).optional(),
  priceFrom: z.coerce.number().nonnegative().optional(),
  priceTo: z.coerce.number().nonnegative().optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  mileageTo: z.coerce.number().int().optional(),
  fuelType: csvArray(fuelTypeValues),
  gearbox: csvArray(gearboxValues),
  bodyType: csvArray(bodyTypeValues),
  sellerType: csvArray(sellerTypeValues),
  countryOrigin: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .optional(),
  color: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .optional(),
  powerFrom: z.coerce.number().int().optional(),
  powerTo: z.coerce.number().int().optional(),

  /* ------------------------------- location ------------------------------ */
  region: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .optional(),
  city: z.string().trim().max(120).optional(),
  /** Radius search anchor - either an explicit point or the named city. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(1000).optional(),
  onlyFavorites: z.coerce.boolean().optional(),
  onlyNew: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().default(false),
  sort: z.enum(listingSortValues).default('newest'),
});

export const listingIdParam = z.object({ id: z.string().uuid() });

export const favoriteInputSchema = z.object({
  note: z.string().trim().max(2000).nullish(),
  rating: z.number().int().min(1).max(5).nullish(),
});

export type ListingQuery = z.infer<typeof listingQuerySchema>;
