import type { Filter } from '../db/schema.js';

export type ProviderName =
  | 'otomoto'
  | 'olx'
  | 'autoplac'
  | 'findcar'
  | 'mobile_de'
  | 'autoscout24';

export type FuelType =
  | 'petrol'
  | 'petrol_lpg'
  | 'petrol_cng'
  | 'diesel'
  | 'hybrid'
  | 'plugin_hybrid'
  | 'electric'
  | 'hydrogen'
  | 'other';

export type Gearbox = 'manual' | 'automatic' | 'semi_automatic' | 'other';

export type BodyType =
  | 'sedan'
  | 'hatchback'
  | 'wagon'
  | 'suv'
  | 'coupe'
  | 'convertible'
  | 'minivan'
  | 'pickup'
  | 'van'
  | 'other';

export type DriveType = 'fwd' | 'rwd' | 'awd' | 'other';
export type VehicleCondition = 'new' | 'used' | 'damaged';
export type SellerType = 'private' | 'dealer' | 'unknown';

/** The subset of a stored filter that a provider adapter actually consumes. */
export type SearchCriteria = Pick<
  Filter,
  | 'make'
  | 'model'
  | 'generation'
  | 'version'
  | 'query'
  | 'yearFrom'
  | 'yearTo'
  | 'priceFrom'
  | 'priceTo'
  | 'currency'
  | 'mileageFrom'
  | 'mileageTo'
  | 'enginePowerFrom'
  | 'enginePowerTo'
  | 'engineCapacityFrom'
  | 'engineCapacityTo'
  | 'fuelTypes'
  | 'gearboxes'
  | 'bodyTypes'
  | 'driveTypes'
  | 'condition'
  | 'sellerType'
  | 'excludeDamaged'
  | 'onlyWithPhotos'
  | 'registeredInPl'
  | 'firstOwner'
  | 'countryOrigin'
  | 'region'
  | 'city'
  | 'radiusKm'
  | 'colors'
  | 'doorCounts'
  | 'seatCounts'
  | 'noAccident'
  | 'servicedAtAso'
  | 'hasVin'
  | 'vatInvoice'
  | 'equipment'
  | 'extraParams'
>;

export interface SearchOptions {
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

/**
 * A listing normalised across providers. Detail data stays on the provider:
 * `url` is the canonical deep link the UI opens.
 */
export interface NormalizedListing {
  provider: ProviderName;
  externalId: string;
  url: string;
  title: string;

  make?: string | null;
  model?: string | null;
  generation?: string | null;
  version?: string | null;

  price?: number | null;
  currency: string;
  priceGross?: boolean | null;
  hasVatInvoice?: boolean | null;

  year?: number | null;
  mileageKm?: number | null;
  fuelType?: FuelType | null;
  gearbox?: Gearbox | null;
  bodyType?: BodyType | null;
  driveType?: DriveType | null;
  engineCapacityCm3?: number | null;
  enginePowerHp?: number | null;
  doors?: number | null;
  seats?: number | null;
  color?: string | null;

  condition?: VehicleCondition | null;
  isDamaged?: boolean | null;
  vin?: string | null;
  firstRegistrationDate?: Date | null;
  countryOrigin?: string | null;

  sellerType: SellerType;
  sellerName?: string | null;

  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  thumbnailUrl?: string | null;
  imagesCount?: number | null;
  publishedAt?: Date | null;

  raw: Record<string, unknown>;
}

export interface SearchResult {
  items: NormalizedListing[];
  page: number;
  pageSize: number;
  /** Absent when the provider does not report a total. */
  totalCount?: number | undefined;
  hasNextPage: boolean;
}

/**
 * Contract every marketplace adapter implements. Adding OLX or mobile.de means
 * writing one of these and registering it - nothing else in the app changes.
 */
export interface ListingSource {
  readonly provider: ProviderName;
  /** False when credentials are missing; the fetcher then skips this source. */
  isConfigured(): boolean;
  search(criteria: SearchCriteria, options: SearchOptions): Promise<SearchResult>;
  /** Optional taxonomy lookups used to populate the filter form. */
  listMakes?(): Promise<string[]>;
  listModels?(make: string): Promise<string[]>;
}
