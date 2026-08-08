import { CarFrontIcon, SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ListingsSearch } from '@/router';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EMPTY_LOCATION,
  LocationFilter,
  locationToParams,
  type LocationValue,
} from '@/components/location-filter';
import { Combobox, MultiCombobox } from '@/components/ui/combobox';
import { BODY_LABELS, FUEL_LABELS, GEARBOX_LABELS } from '@/lib/format';
import {
  useCities,
  useFilterGroups,
  useListings,
  useProviders,
  useTaxonomy,
} from '@/lib/queries';

const SORT_OPTIONS = [
  // "Newest" follows the marketplace's publication date, not our fetch time.
  { value: 'newest', label: 'Najnowsze ogłoszenia' },
  { value: 'oldest', label: 'Najstarsze ogłoszenia' },
  { value: 'added_newest', label: 'Ostatnio pobrane' },
  { value: 'price_asc', label: 'Cena rosnąco' },
  { value: 'price_desc', label: 'Cena malejąco' },
  { value: 'mileage_asc', label: 'Przebieg rosnąco' },
  { value: 'year_desc', label: 'Rocznik malejąco' },
] as const;

const ALL = '__all__';

interface Filters {
  q: string;
  groupId: string;
  provider: string[];
  make: string | null;
  model: string | null;
  fuelType: string;
  gearbox: string;
  priceFrom: string;
  priceTo: string;
  yearFrom: string;
  mileageTo: string;
  powerFrom: string;
  countryOrigin: string[];
  color: string[];
  bodyType: string;
  archived: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  groupId: ALL,
  provider: [],
  make: null,
  model: null,
  fuelType: ALL,
  gearbox: ALL,
  priceFrom: '',
  priceTo: '',
  yearFrom: '',
  mileageTo: '',
  powerFrom: '',
  countryOrigin: [],
  color: [],
  bodyType: ALL,
  archived: 'no',
  sort: 'newest',
};

/** URL -> form state. Missing parameters fall back to "no restriction". */
function fromSearch(search: ListingsSearch): Filters {
  const text = (value: number | undefined) =>
    value === undefined ? '' : String(value);

  return {
    q: search.q ?? '',
    groupId: search.groupId ?? ALL,
    provider: search.provider ?? [],
    make: search.make ?? null,
    model: search.model ?? null,
    fuelType: search.fuelType ?? ALL,
    gearbox: search.gearbox ?? ALL,
    bodyType: search.bodyType ?? ALL,
    archived: search.archived ?? 'no',
    priceFrom: text(search.priceFrom),
    priceTo: text(search.priceTo),
    yearFrom: text(search.yearFrom),
    mileageTo: text(search.mileageTo),
    powerFrom: text(search.powerFrom),
    countryOrigin: search.countryOrigin ?? [],
    color: search.color ?? [],
    sort: search.sort ?? 'newest',
  };
}

function locationFromSearch(search: ListingsSearch): LocationValue {
  return {
    regions: search.region ?? [],
    city: search.city ?? null,
    radiusKm: search.radiusKm ?? null,
    point:
      search.lat !== undefined && search.lon !== undefined
        ? { lat: search.lat, lon: search.lon }
        : null,
  };
}

/** Drops defaults so the address bar only carries what the user actually set. */
function pruneSearch(search: ListingsSearch): ListingsSearch {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === 'sort' && value === 'newest') continue;
    if (key === 'archived' && value === 'no') continue;
    if (key === 'page' && value === 1) continue;
    cleaned[key] = value;
  }
  return cleaned as ListingsSearch;
}

export function ListingsPage() {
  // `strict: false` keeps this decoupled from the generated route id - the
  // shape is already guaranteed by the route's `validateSearch`.
  const search = useSearch({ strict: false }) as ListingsSearch;
  const navigate = useNavigate();

  const filters = useMemo(() => fromSearch(search), [search]);
  const location = useMemo(() => locationFromSearch(search), [search]);
  const page = search.page ?? 1;

  /** Writes to the URL; `replace` keeps filter tweaks out of the back stack. */
  const applySearch = useCallback(
    (patch: Partial<ListingsSearch>) => {
      void navigate({
        to: '/listings',
        search: (prev: ListingsSearch) => pruneSearch({ ...prev, ...patch }),
        replace: true,
      });
    },
    [navigate],
  );

  const setPage = (next: number) => applySearch({ page: next });

  const groups = useFilterGroups();
  const taxonomy = useTaxonomy();
  const providers = useProviders();
  const cities = useCities();

  const cityNames = [...new Set((cities.data ?? []).map((entry) => entry.city))];

  // Listings store display names ("Volvo", "Niemcy"), not provider slugs, so
  // the option value has to be the label.
  const countryOptions =
    taxonomy.data?.countries.map(({ label }) => ({ value: label, label })) ?? [];
  const colorOptions =
    taxonomy.data?.colors.map(({ label }) => ({ value: label, label })) ?? [];
  const makeOptions =
    taxonomy.data?.makes.map(({ label }) => ({ value: label, label })) ?? [];
  // Only providers with a working adapter can have produced any listing.
  const providerOptions =
    providers.data
      ?.filter((entry) => entry.implemented)
      .map((entry) => ({ value: entry.provider, label: entry.label })) ?? [];
  const modelOptions =
    taxonomy.data?.makes
      .find((make) => make.label === filters.make)
      ?.models.map(({ label }) => ({ value: label, label })) ?? [];

  const params = {
    page,
    pageSize: 24,
    sort: filters.sort,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.groupId !== ALL ? { groupId: filters.groupId } : {}),
    ...(filters.provider.length ? { provider: filters.provider } : {}),
    ...(filters.make ? { make: filters.make } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.fuelType !== ALL ? { fuelType: filters.fuelType } : {}),
    ...(filters.gearbox !== ALL ? { gearbox: filters.gearbox } : {}),
    ...(filters.priceFrom ? { priceFrom: filters.priceFrom } : {}),
    ...(filters.priceTo ? { priceTo: filters.priceTo } : {}),
    ...(filters.yearFrom ? { yearFrom: filters.yearFrom } : {}),
    ...(filters.mileageTo ? { mileageTo: filters.mileageTo } : {}),
    ...(filters.powerFrom ? { powerFrom: filters.powerFrom } : {}),
    ...(filters.countryOrigin.length ? { countryOrigin: filters.countryOrigin } : {}),
    ...(filters.color.length ? { color: filters.color } : {}),
    ...(filters.bodyType !== ALL ? { bodyType: filters.bodyType } : {}),
    archived: filters.archived,
    ...locationToParams(location),
  };

  const listings = useListings(params);

  /** Sentinel values and empty strings are dropped by `pruneSearch`. */
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    const serialised =
      value === ALL || value === '' || value === null ? undefined : value;
    applySearch({ [key]: serialised, page: undefined } as Partial<ListingsSearch>);
  }

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) ||
    JSON.stringify(location) !== JSON.stringify(EMPTY_LOCATION);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ogłoszenia</h1>
        <p className="text-muted-foreground text-sm">
          Wyniki zebrane przez Twoje grupy filtrów. Kliknięcie oferty prowadzi
          bezpośrednio do serwisu źródłowego.
        </p>
      </div>

      <div className="bg-card space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="q">Szukaj</Label>
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="q"
                placeholder="np. XC60, RAV4 Hybrid"
                className="pl-9"
                value={filters.q}
                onChange={(e) => update('q', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Grupa</Label>
            <Select
              value={filters.groupId}
              onValueChange={(v) => update('groupId', v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Wszystkie grupy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Wszystkie grupy</SelectItem>
                {groups.data?.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Serwis</Label>
            <MultiCombobox
              options={providerOptions}
              values={filters.provider}
              placeholder="Wszystkie"
              onChange={(v) => update('provider', v)}
            />
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Marka</Label>
            <Combobox
              options={makeOptions}
              value={filters.make}
              placeholder="Wszystkie"
              // A new make invalidates whatever model was picked.
              onChange={(make) => {
                applySearch({ make: make ?? undefined, model: undefined, page: undefined });
                setPage(1);
              }}
            />
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Model</Label>
            <Combobox
              options={modelOptions}
              value={filters.model}
              disabled={!filters.make}
              placeholder={filters.make ? 'Wszystkie' : 'Wybierz markę'}
              emptyText="Brak modeli"
              onChange={(model) => update('model', model)}
            />
          </div>

          <div className="w-40 space-y-1.5">
            <Label>Zarchiwizowane</Label>
            <Select
              value={filters.archived}
              onValueChange={(v) => update('archived', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Nie</SelectItem>
                <SelectItem value="yes">Tylko sprzedane</SelectItem>
                <SelectItem value="all">Wszystkie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sortowanie</Label>
            <Select value={filters.sort} onValueChange={(v) => update('sort', v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Paliwo</Label>
            <Select
              value={filters.fuelType}
              onValueChange={(v) => update('fuelType', v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Dowolne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Dowolne</SelectItem>
                {Object.entries(FUEL_LABELS).map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Skrzynia</Label>
            <Select
              value={filters.gearbox}
              onValueChange={(v) => update('gearbox', v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Dowolna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Dowolna</SelectItem>
                {Object.entries(GEARBOX_LABELS).map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            Only attributes the provider actually returns in its result rows can
            be filtered here. Otomoto's search payload omits body type, colour,
            doors and drive - those live in the filter form, where they are
            applied by the provider itself.
          */}
          <LocationFilter
            value={location}
            cities={cityNames}
            onChange={(next) => {
              applySearch({
                region: next.regions.length ? next.regions : undefined,
                city: next.city ?? undefined,
                radiusKm: next.radiusKm ?? undefined,
                lat: next.point?.lat,
                lon: next.point?.lon,
                page: undefined,
              });
              setPage(1);
            }}
          />

          <div className="w-44 space-y-1.5">
            <Label>Kraj pochodzenia</Label>
            <MultiCombobox
              options={countryOptions}
              values={filters.countryOrigin}
              onChange={(v) => update('countryOrigin', v)}
            />
          </div>

          {/*
            Body type and colour only reach the database through OLX - the
            Otomoto search payload omits them, so those listings drop out when
            either filter is used.
          */}
          <div className="space-y-1.5">
            <Label>Nadwozie</Label>
            <Select
              value={filters.bodyType}
              onValueChange={(v) => update('bodyType', v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Dowolne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Dowolne</SelectItem>
                {Object.entries(BODY_LABELS).map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40 space-y-1.5">
            <Label>Kolor</Label>
            <MultiCombobox
              options={colorOptions}
              values={filters.color}
              onChange={(v) => update('color', v)}
            />
          </div>

          <NumberField
            label="Cena od"
            value={filters.priceFrom}
            onChange={(v) => update('priceFrom', v)}
          />
          <NumberField
            label="Cena do"
            value={filters.priceTo}
            onChange={(v) => update('priceTo', v)}
          />
          <NumberField
            label="Rocznik od"
            value={filters.yearFrom}
            onChange={(v) => update('yearFrom', v)}
          />
          <NumberField
            label="Przebieg do"
            value={filters.mileageTo}
            onChange={(v) => update('mileageTo', v)}
          />
          <NumberField
            label="Moc od (KM)"
            value={filters.powerFrom}
            onChange={(v) => update('powerFrom', v)}
          />

          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigate({ to: '/listings', search: {}, replace: true });
                setPage(1);
              }}
            >
              <XIcon />
              Wyczyść
            </Button>
          ) : null}
        </div>
      </div>

      {listings.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : listings.data && listings.data.items.length > 0 ? (
        <>
          <p className="text-muted-foreground text-sm">
            Znaleziono {listings.data.total} ofert
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.data.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {listings.data.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Poprzednia
              </Button>
              <span className="text-muted-foreground text-sm">
                Strona {listings.data.page} z {listings.data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= listings.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Następna
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<CarFrontIcon className="size-8" />}
          title="Brak wyników"
          description="Zmień kryteria wyszukiwania albo uruchom pobieranie w grupie filtrów."
        />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        className="w-32"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
