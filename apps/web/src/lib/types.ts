export type Provider =
  | 'otomoto'
  | 'olx'
  | 'autoplac'
  | 'findcar'
  | 'sprzedajemy'
  | 'mobile_de'
  | 'autoscout24';

export interface ProviderInfo {
  provider: Provider;
  label: string;
  /** False for providers listed in the UI that have no adapter yet. */
  implemented: boolean;
  configured: boolean;
  live: boolean;
  mode?: string;
}

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

export type SellerType = 'private' | 'dealer' | 'unknown';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  emailVerifiedAt: string | null;
  /** false dla kont założonych przez logowanie Google - nie ma czego zmieniać. */
  hasPassword: boolean;
  createdAt: string;
}

/* --------------------------------- admin --------------------------------- */

export interface AdminStats {
  users: { total: number; active: number; admins: number };
  listings: { total: number; active: number; archived: number };
  groups: { total: number };
  byProvider: Array<{ provider: Provider; total: number }>;
  scheduler: { enabled: boolean; cron: string };
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  isActive: boolean;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  groupCount: number;
  favoriteCount: number;
}

export interface ScraperCircuit {
  host: string;
  streak: number;
  /** Epoch ms - null when the host isn't currently blocked. */
  openUntil: number | null;
  blocked: boolean;
}

export interface AdminScrapers {
  providers: ProviderInfo[];
  circuits: ScraperCircuit[];
}

export interface AdminFetchRun {
  id: string;
  provider: Provider;
  status: string;
  trigger: string;
  itemsSeen: number;
  itemsNew: number;
  errorMessage: string | null;
  startedAt: string;
  durationMs: number | null;
  groupName: string | null;
  filterName: string | null;
  filterMake: string | null;
  filterModel: string | null;
  ownerEmail: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Filter {
  id: string;
  groupId: string;
  provider: Provider;
  name: string | null;
  isActive: boolean;
  make: string | null;
  model: string | null;
  generation: string | null;
  version: string | null;
  query: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  mileageFrom: number | null;
  mileageTo: number | null;
  enginePowerFrom: number | null;
  enginePowerTo: number | null;
  engineCapacityFrom: number | null;
  engineCapacityTo: number | null;
  fuelTypes: FuelType[] | null;
  gearboxes: Gearbox[] | null;
  bodyTypes: BodyType[] | null;
  driveTypes: string[] | null;
  condition: string | null;
  sellerType: SellerType | null;
  excludeDamaged: boolean;
  onlyWithPhotos: boolean;
  registeredInPl: boolean | null;
  firstOwner: boolean | null;
  countryOrigin: string | null;
  region: string | null;
  city: string | null;
  radiusKm: number | null;
  colors: string[] | null;
  doorCounts: number[] | null;
  seatCounts: number[] | null;
  noAccident: boolean | null;
  servicedAtAso: boolean | null;
  hasVin: boolean | null;
  vatInvoice: boolean | null;
  equipment: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilterGroup {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  notifyOnNew: boolean;
  refreshIntervalMinutes: number;
  lastFetchedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  filters: Filter[];
  listingCount: number;
  newListingCount: number;
  lastRun: { status: string; finishedAt: string | null; itemsNew: number } | null;
}

export interface Listing {
  id: string;
  provider: Provider;
  externalId: string;
  url: string;
  title: string;
  make: string | null;
  model: string | null;
  version: string | null;
  price: number | null;
  currency: string;
  year: number | null;
  mileageKm: number | null;
  fuelType: FuelType | null;
  gearbox: Gearbox | null;
  bodyType: BodyType | null;
  enginePowerHp: number | null;
  engineCapacityCm3: number | null;
  vin: string | null;
  city: string | null;
  region: string | null;
  countryOrigin: string | null;
  color: string | null;
  sellerType: SellerType;
  sellerName: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  isFavorite: boolean;
  groups: ListingGroup[];
  priceChangePct: number | null;
  /** Negative = below the market median for similar cars. `null` = not enough comparables. */
  priceVsMarketPct: number | null;
  /** The same car, still live on another marketplace - see the API doc comment on `mergedIntoId`. */
  duplicates: ListingDuplicate[];
  /** Days since the ad went up (marketplace's own date, `firstSeenAt` as fallback). */
  daysListed: number;
  /** Median days-to-sell for similar cars that already sold. `null` = too few comparables or not computed for this view. */
  medianDaysToSellCohort: number | null;
}

export interface ListingGroup {
  id: string;
  name: string;
  color: string | null;
}

export interface ListingDuplicate {
  id: string;
  provider: Provider;
  url: string;
  price: number | null;
  city: string | null;
}

export interface PriceHistoryEntry {
  price: number | null;
  currency: string;
  deltaAmount: number | null;
  deltaPct: number | null;
  recordedAt: string;
}

export interface ListingDetail extends Listing {
  priceHistory: PriceHistoryEntry[];
}

/* ------------------------------- taxonomy -------------------------------- */

export interface TaxonomyOption {
  value: string;
  label: string;
}

export interface EquipmentOption {
  id: string;
  label: string;
  group: string;
  options: TaxonomyOption[];
}

export interface Taxonomy {
  generatedAt: string;
  makes: Array<TaxonomyOption & { models: TaxonomyOption[] }>;
  countries: TaxonomyOption[];
  colors: TaxonomyOption[];
  bodyTypes: TaxonomyOption[];
  fuelTypes: TaxonomyOption[];
  gearboxes: TaxonomyOption[];
  driveTypes: TaxonomyOption[];
  doorCounts: TaxonomyOption[];
  seatCounts: TaxonomyOption[];
  equipment: EquipmentOption[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListingStats {
  total: number;
  active: number;
  fresh24h: number;
  avgPrice: number | null;
  favorites: number;
  /** Listings that disappeared from the marketplace - assumed sold. */
  archived: number;
  byMake: Array<{ make: string | null; count: number; avgPrice: number | null }>;
  soldByModel: Array<{
    make: string | null;
    model: string | null;
    total: number;
    sold: number;
    avgSoldPrice: number | null;
    medianDaysToSell: number | null;
  }>;
}

export interface Notification {
  id: string;
  type:
    | 'new_listing'
    | 'price_drop'
    | 'price_raise'
    | 'listing_removed'
    | 'fetch_failed'
    | 'digest';
  channel: string;
  title: string;
  body: string | null;
  listingId: string | null;
  groupId: string | null;
  readAt: string | null;
  createdAt: string;
  /** Deep link to the marketplace, when the notification is about a listing. */
  listingUrl: string | null;
  listingProvider: Provider | null;
  groupName: string | null;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  notifyNewListing: boolean;
  notifyPriceDrop: boolean;
  notifyListingRemoved: boolean;
  notifyFetchFailed: boolean;
  priceDropThresholdPct: number;
  digestFrequency: 'instant' | 'hourly' | 'daily' | 'weekly' | 'off';
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezone: string;
  updatedAt: string;
}

export interface FetchRun {
  id: string;
  filterId: string | null;
  filterName: string | null;
  filterMake: string | null;
  filterModel: string | null;
  filterProvider: Provider | null;
  status: string;
  trigger: string;
  pagesFetched: number;
  itemsSeen: number;
  itemsNew: number;
  itemsUpdated: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface GroupRunResult {
  groupId: string;
  groupName: string;
  totalNew: number;
  totalSeen: number;
  durationMs: number;
  filters: Array<{
    filterId: string;
    filterName: string;
    status: string;
    itemsSeen: number;
    itemsNew: number;
    error?: string;
  }>;
}

export interface Favorite {
  listing: Listing;
  note: string | null;
  rating: number | null;
  addedAt: string;
}

/* ----------------------------- knowledge base ----------------------------- */

export type DriveType = 'fwd' | 'rwd' | 'awd' | 'other';
/** Where a row's content came from - shown next to it, never hidden. */
export type VehicleSource = 'manual' | 'ai_generated';
export type VehicleIssueSeverity = 'minor' | 'moderate' | 'serious';
export type VehicleNoteKind = 'reputation' | 'ownership_cost' | 'buying_advice';

/** One generation, as it appears in the make → model list before it's opened. */
export interface VehicleModelSummary {
  id: string;
  make: string;
  model: string;
  generation: string;
  yearFrom: number | null;
  yearTo: number | null;
  bodyTypes: BodyType[] | null;
  summary: string | null;
  source: VehicleSource;
  engineCount: number;
  issueCount: number;
}

export interface VehicleEngine {
  id: string;
  modelId: string;
  engineCode: string | null;
  name: string;
  fuelType: FuelType | null;
  displacementCm3: number | null;
  powerHp: number | null;
  torqueNm: number | null;
  gearbox: Gearbox | null;
  driveType: DriveType | null;
  acceleration0To100: number | null;
  topSpeedKmh: number | null;
  fuelConsumptionCombined: number | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface VehicleKnownIssue {
  id: string;
  modelId: string;
  engineId: string | null;
  title: string;
  description: string;
  severity: VehicleIssueSeverity;
  mileageHint: string | null;
  source: VehicleSource;
  sourceUrl: string | null;
}

export interface VehicleNote {
  id: string;
  modelId: string;
  kind: VehicleNoteKind;
  body: string;
  source: VehicleSource;
  sourceUrl: string | null;
}

export interface VehicleModelDetail {
  id: string;
  make: string;
  model: string;
  generation: string;
  yearFrom: number | null;
  yearTo: number | null;
  bodyTypes: BodyType[] | null;
  summary: string | null;
  source: VehicleSource;
  engines: VehicleEngine[];
  knownIssues: VehicleKnownIssue[];
  notes: VehicleNote[];
}

export interface VehicleSearchResult {
  id: string;
  make: string;
  model: string;
  generation: string;
  yearFrom: number | null;
  yearTo: number | null;
}

/* --------------------------------- VIN ------------------------------------ */

export interface NhtsaEnrichment {
  make: string | null;
  model: string | null;
  modelYear: string | null;
  series: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  doors: string | null;
  engineCylinders: string | null;
  engineHp: string | null;
  displacementL: string | null;
  fuelTypePrimary: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  transmissionSpeeds: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  /** Safety equipment - see the doc comment on the API side for why this is all a free VIN decode can tell you. */
  airbagFront: string | null;
  airbagSide: string | null;
  airbagCurtain: string | null;
  airbagKnee: string | null;
  seatBelts: string | null;
  errorText: string | null;
}

export interface VehicleHistoryReport {
  provider: 'autodna' | 'carvertical';
  vin: string;
  fetchedAt: string;
  reportUrl: string | null;
  ownersCount: number | null;
  mileageRecords: Array<{ date: string | null; mileageKm: number; source: string | null }>;
  damageRecords: Array<{
    date: string | null;
    description: string;
    severity: 'minor' | 'moderate' | 'severe' | 'unknown';
  }>;
  stolenStatus: 'clear' | 'reported_stolen' | 'unknown';
  importCountry: string | null;
  notes: string[];
}

export interface VinLookupResult {
  vin: string;
  formatValid: boolean;
  formatError: string | null;
  make: string | null;
  country: string | null;
  makeSource: 'exact' | 'region_only' | null;
  /** `null` = not a North-American VIN, so the check digit isn't a meaningful signal there. */
  checkDigitValid: boolean | null;
  candidateYears: number[];
  /** `null` when the format was invalid (never queried) or NHTSA had nothing. */
  nhtsa: NhtsaEnrichment | null;
}

/* -------------------------------- sellers ---------------------------------- */

export interface SellerListing {
  id: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  currency: string;
  provider: Provider;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  daysListed: number;
}

export interface SellerProfile {
  sellerName: string;
  totalActive: number;
  totalArchived: number;
  providers: Provider[];
  firstSeenAt: string;
  /** How fast *this seller's* own past ads sold - not the market-wide cohort on a listing. */
  medianDaysToSellOwn: number | null;
  activeListings: SellerListing[];
}
