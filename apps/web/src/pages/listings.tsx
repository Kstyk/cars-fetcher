import { CarFrontIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
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
import { Combobox, MultiCombobox } from '@/components/ui/combobox';
import { FUEL_LABELS, GEARBOX_LABELS } from '@/lib/format';
import { useFilterGroups, useListings, useTaxonomy } from '@/lib/queries';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'price_asc', label: 'Cena rosnąco' },
  { value: 'price_desc', label: 'Cena malejąco' },
  { value: 'mileage_asc', label: 'Przebieg rosnąco' },
  { value: 'year_desc', label: 'Rocznik malejąco' },
] as const;

const ALL = '__all__';

interface Filters {
  q: string;
  groupId: string;
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
  sort: string;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  groupId: ALL,
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
  sort: 'newest',
};

export function ListingsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const groups = useFilterGroups();
  const taxonomy = useTaxonomy();

  // Listings store display names ("Volvo", "Niemcy"), not provider slugs, so
  // the option value has to be the label.
  const countryOptions =
    taxonomy.data?.countries.map(({ label }) => ({ value: label, label })) ?? [];
  const makeOptions =
    taxonomy.data?.makes.map(({ label }) => ({ value: label, label })) ?? [];
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
  };

  const listings = useListings(params);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

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
            <Label>Marka</Label>
            <Combobox
              options={makeOptions}
              value={filters.make}
              placeholder="Wszystkie"
              // A new make invalidates whatever model was picked.
              onChange={(make) => {
                setFilters((current) => ({ ...current, make, model: null }));
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
          <div className="w-44 space-y-1.5">
            <Label>Kraj pochodzenia</Label>
            <MultiCombobox
              options={countryOptions}
              values={filters.countryOrigin}
              onChange={(v) => update('countryOrigin', v)}
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
                setFilters(EMPTY_FILTERS);
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
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
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
