export type Provider = 'otomoto' | 'olx' | 'mobile_de' | 'autoscout24';

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
  createdAt: string;
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
  isFavorite: boolean;
  groups: ListingGroup[];
  priceChangePct: number | null;
}

export interface ListingGroup {
  id: string;
  name: string;
  color: string | null;
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
  byMake: Array<{ make: string | null; count: number; avgPrice: number | null }>;
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
