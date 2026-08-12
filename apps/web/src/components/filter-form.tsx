import { CheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, MultiCombobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { Separator, Skeleton } from '@/components/ui/misc';
import {
  BODY_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  label,
} from '@/lib/format';
import { useProviders, useTaxonomy } from '@/lib/queries';
import type { BodyType, Filter, FuelType, Gearbox } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The criteria a filter row carries, in the shape the API expects.
 * `providers` is plural: when creating a new filter, checking several
 * services fills out the same criteria once and produces one filter per
 * service - the fields below apply identically to all of them. Editing an
 * existing filter always keeps this down to the one provider it already has
 * (see `allowMultipleProviders` on `FilterForm`), since a saved filter is one
 * row for one service.
 */
export interface FilterFormValue {
  providers: string[];
  make: string | null;
  model: string | null;
  yearFrom: string;
  yearTo: string;
  priceFrom: string;
  priceTo: string;
  mileageFrom: string;
  mileageTo: string;
  enginePowerFrom: string;
  enginePowerTo: string;
  fuelTypes: FuelType[];
  gearboxes: Gearbox[];
  bodyTypes: BodyType[];
  colors: string[];
  countryOrigin: string | null;
  doorCounts: string[];
  seatCounts: string[];
  excludeDamaged: boolean;
  onlyWithPhotos: boolean;
  registeredInPl: boolean;
  firstOwner: boolean;
  noAccident: boolean;
  servicedAtAso: boolean;
  hasVin: boolean;
  vatInvoice: boolean;
  equipment: string[];
}

export const EMPTY_FILTER_FORM: FilterFormValue = {
  providers: ['otomoto'],
  make: null,
  model: null,
  yearFrom: '',
  yearTo: '',
  priceFrom: '',
  priceTo: '',
  mileageFrom: '',
  mileageTo: '',
  enginePowerFrom: '',
  enginePowerTo: '',
  fuelTypes: [],
  gearboxes: [],
  bodyTypes: [],
  colors: [],
  countryOrigin: null,
  doorCounts: [],
  seatCounts: [],
  excludeDamaged: true,
  onlyWithPhotos: false,
  registeredInPl: false,
  firstOwner: false,
  noAccident: false,
  servicedAtAso: false,
  hasVin: false,
  vatInvoice: false,
  equipment: [],
};

/**
 * Converts the form into the JSON bodies the filters endpoint validates -
 * one per checked provider, all sharing the same criteria. Almost always a
 * single-element array (editing, or creating for just one service); only
 * multi-provider creation produces more than one.
 */
export function toFilterPayload(value: FilterFormValue): Record<string, unknown>[] {
  const number = (input: string) =>
    input.trim() === '' ? null : Number(input);

  const shared = {
    name: [value.make, value.model].filter(Boolean).join(' ') || null,
    make: value.make,
    model: value.model,
    yearFrom: number(value.yearFrom),
    yearTo: number(value.yearTo),
    priceFrom: number(value.priceFrom),
    priceTo: number(value.priceTo),
    mileageFrom: number(value.mileageFrom),
    mileageTo: number(value.mileageTo),
    enginePowerFrom: number(value.enginePowerFrom),
    enginePowerTo: number(value.enginePowerTo),
    fuelTypes: value.fuelTypes.length ? value.fuelTypes : null,
    gearboxes: value.gearboxes.length ? value.gearboxes : null,
    bodyTypes: value.bodyTypes.length ? value.bodyTypes : null,
    colors: value.colors.length ? value.colors : null,
    countryOrigin: value.countryOrigin,
    doorCounts: value.doorCounts.length ? value.doorCounts.map(Number) : null,
    seatCounts: value.seatCounts.length ? value.seatCounts.map(Number) : null,
    excludeDamaged: value.excludeDamaged,
    onlyWithPhotos: value.onlyWithPhotos,
    registeredInPl: value.registeredInPl || null,
    firstOwner: value.firstOwner || null,
    noAccident: value.noAccident || null,
    servicedAtAso: value.servicedAtAso || null,
    hasVin: value.hasVin || null,
    vatInvoice: value.vatInvoice || null,
    equipment: value.equipment.length ? value.equipment : null,
  };

  return value.providers.map((provider) => ({ provider, ...shared }));
}

/** Rebuilds the form state from a saved filter, for editing and duplicating. */
export function filterToFormValue(filter: Filter): FilterFormValue {
  const text = (value: number | null | undefined) =>
    value === null || value === undefined ? '' : String(value);

  return {
    providers: [filter.provider],
    make: filter.make,
    model: filter.model,
    yearFrom: text(filter.yearFrom),
    yearTo: text(filter.yearTo),
    priceFrom: text(filter.priceFrom),
    priceTo: text(filter.priceTo),
    mileageFrom: text(filter.mileageFrom),
    mileageTo: text(filter.mileageTo),
    enginePowerFrom: text(filter.enginePowerFrom),
    enginePowerTo: text(filter.enginePowerTo),
    fuelTypes: filter.fuelTypes ?? [],
    gearboxes: filter.gearboxes ?? [],
    bodyTypes: filter.bodyTypes ?? [],
    colors: filter.colors ?? [],
    countryOrigin: filter.countryOrigin,
    doorCounts: (filter.doorCounts ?? []).map(String),
    seatCounts: (filter.seatCounts ?? []).map(String),
    excludeDamaged: filter.excludeDamaged,
    onlyWithPhotos: filter.onlyWithPhotos,
    registeredInPl: filter.registeredInPl ?? false,
    firstOwner: filter.firstOwner ?? false,
    noAccident: filter.noAccident ?? false,
    servicedAtAso: filter.servicedAtAso ?? false,
    hasVin: filter.hasVin ?? false,
    vatInvoice: filter.vatInvoice ?? false,
    equipment: filter.equipment ?? [],
  };
}

/**
 * Every criterion a filter carries, rendered as chips. The list view used to
 * show only a handful of fields, which hid things like the chosen marketplace.
 */
export function FilterSummary({ filter }: { filter: Filter }) {
  const taxonomy = useTaxonomy();
  const providers = useProviders();

  const providerLabel =
    providers.data?.find((entry) => entry.provider === filter.provider)?.label ??
    filter.provider;

  const equipmentLabels = (filter.equipment ?? []).map(
    (id) => taxonomy.data?.equipment.find((item) => item.id === id)?.label ?? id,
  );

  const range = (
    from: number | null | undefined,
    to: number | null | undefined,
    unit = '',
  ): string | null => {
    const format = (value: number) => value.toLocaleString('pl-PL');
    if (from !== null && from !== undefined && to !== null && to !== undefined) {
      return `${format(from)}–${format(to)}${unit}`;
    }
    if (from !== null && from !== undefined) return `od ${format(from)}${unit}`;
    if (to !== null && to !== undefined) return `do ${format(to)}${unit}`;
    return null;
  };

  const chips: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) chips.push({ label, value });
  };

  push('Marka', filter.make);
  push('Model', filter.model);
  push('Generacja', filter.generation);
  push('Fraza', filter.query);
  push('Rocznik', range(filter.yearFrom, filter.yearTo));
  push('Cena', range(filter.priceFrom, filter.priceTo, ' zł'));
  push('Przebieg', range(filter.mileageFrom, filter.mileageTo, ' km'));
  push('Moc', range(filter.enginePowerFrom, filter.enginePowerTo, ' KM'));
  push('Pojemność', range(filter.engineCapacityFrom, filter.engineCapacityTo, ' cm³'));
  push('Paliwo', filter.fuelTypes?.map((f) => label(FUEL_LABELS, f)).join(', '));
  push('Skrzynia', filter.gearboxes?.map((g) => label(GEARBOX_LABELS, g)).join(', '));
  push('Nadwozie', filter.bodyTypes?.map((b) => label(BODY_LABELS, b)).join(', '));
  push('Kolor', filter.colors?.join(', '));
  push('Kraj', filter.countryOrigin);
  push('Drzwi', filter.doorCounts?.join(', '));
  push('Miejsca', filter.seatCounts?.join(', '));
  push('Miasto', filter.city);
  push('Promień', filter.radiusKm ? `${filter.radiusKm} km` : null);

  const flags = [
    filter.excludeDamaged && 'bez uszkodzeń',
    filter.noAccident && 'bezwypadkowy',
    filter.servicedAtAso && 'ASO',
    filter.firstOwner && 'pierwszy właściciel',
    filter.registeredInPl && 'zarejestrowany w PL',
    filter.hasVin && 'z VIN',
    filter.vatInvoice && 'faktura VAT',
    filter.onlyWithPhotos && 'ze zdjęciami',
  ].filter((entry): entry is string => Boolean(entry));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* The marketplace decides which criteria apply at all, so it leads. */}
      <Badge variant="secondary">{providerLabel}</Badge>

      {chips.map((chip) => (
        <span
          key={chip.label}
          className="text-muted-foreground rounded-md border px-2 py-0.5 text-xs"
        >
          <span className="opacity-70">{chip.label}:</span> {chip.value}
        </span>
      ))}

      {flags.map((flag) => (
        <Badge key={flag} variant="outline" className="font-normal">
          {flag}
        </Badge>
      ))}

      {equipmentLabels.length > 0 ? (
        <span
          className="text-muted-foreground rounded-md border px-2 py-0.5 text-xs"
          title={equipmentLabels.join(', ')}
        >
          <span className="opacity-70">Wyposażenie:</span>{' '}
          {equipmentLabels.length <= 3
            ? equipmentLabels.join(', ')
            : `${equipmentLabels.slice(0, 2).join(', ')} +${equipmentLabels.length - 2}`}
        </span>
      ) : null}

      {chips.length === 0 && flags.length === 0 && equipmentLabels.length === 0 ? (
        <span className="text-muted-foreground text-xs">
          Bez dodatkowych kryteriów — wszystkie oferty z tego serwisu
        </span>
      ) : null}
    </div>
  );
}

const FUEL_OPTIONS = Object.entries(FUEL_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const GEARBOX_OPTIONS = Object.entries(GEARBOX_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const BODY_OPTIONS = Object.entries(BODY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function FilterForm({
  value,
  onChange,
  allowMultipleProviders = false,
}: {
  value: FilterFormValue;
  onChange: (value: FilterFormValue) => void;
  /**
   * Creating a new filter can fan out to several services at once - check
   * "Serwis" checks/unchecks freely, and one filter is created per checked
   * service. Editing an existing filter is one specific row for one
   * specific service, so this stays off there and clicking a different
   * service just swaps it instead of adding to a set.
   */
  allowMultipleProviders?: boolean;
}) {
  const taxonomy = useTaxonomy();
  const providers = useProviders();

  function patch(update: Partial<FilterFormValue>): void {
    onChange({ ...value, ...update });
  }

  function toggleProvider(providerId: string): void {
    if (!allowMultipleProviders) {
      patch({ providers: [providerId] });
      return;
    }
    const checked = value.providers.includes(providerId);
    // Never let the set go empty - toFilterPayload needs at least one.
    if (checked && value.providers.length === 1) return;
    patch({
      providers: checked
        ? value.providers.filter((p) => p !== providerId)
        : [...value.providers, providerId],
    });
  }

  const makeOptions = useMemo(
    () => taxonomy.data?.makes.map(({ label }) => ({ value: label, label })) ?? [],
    [taxonomy.data],
  );

  // Models depend on the selected make; the label is stored so the value stays
  // readable and still slugifies to the provider's own id.
  const modelOptions = useMemo(() => {
    if (!value.make || !taxonomy.data) return [];
    const make = taxonomy.data.makes.find((m) => m.label === value.make);
    return make?.models.map(({ label }) => ({ value: label, label })) ?? [];
  }, [taxonomy.data, value.make]);

  const equipmentGroups = useMemo(() => {
    const groups = new Map<string, Array<{ value: string; label: string }>>();
    for (const item of taxonomy.data?.equipment ?? []) {
      const bucket = groups.get(item.group) ?? [];
      bucket.push({ value: item.id, label: item.label });
      groups.set(item.group, bucket);
    }
    return [...groups.entries()];
  }, [taxonomy.data]);

  if (taxonomy.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (taxonomy.isError) {
    return (
      <p className="text-destructive text-sm">
        Nie udało się wczytać słownika marek. Uruchom{' '}
        <code className="text-xs">npm run taxonomy:build</code> w apps/api.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Section
        title="Serwis"
        description={
          allowMultipleProviders
            ? 'Zaznacz jeden lub więcej serwisów — dla każdego powstanie osobny filtr z tymi samymi kryteriami. Każdy serwis ma własny zestaw dostępnych kryteriów.'
            : 'Filtr działa po stronie wybranego serwisu — każdy ma własny zestaw dostępnych kryteriów.'
        }
      >
        <div className="grid gap-2 sm:grid-cols-4">
          {(providers.data ?? []).map((entry) => (
            <button
              key={entry.provider}
              type="button"
              disabled={!entry.implemented}
              onClick={() => toggleProvider(entry.provider)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                value.providers.includes(entry.provider)
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'hover:bg-accent/50',
                !entry.implemented && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex items-center gap-1.5">
                {allowMultipleProviders ? (
                  // A plain indicator, not a real `Checkbox` - the whole tile
                  // is already the clickable control (it's a `<button>`), and
                  // a checkbox nested inside a button is invalid HTML.
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                      value.providers.includes(entry.provider)
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {value.providers.includes(entry.provider) ? (
                      <CheckIcon className="size-3" />
                    ) : null}
                  </span>
                ) : null}
                {entry.label}
              </span>
              {!entry.implemented ? (
                <span className="text-muted-foreground text-xs">wkrótce</span>
              ) : null}
            </button>
          ))}
        </div>
      </Section>

      <Separator />

      <Section title="Pojazd">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Marka">
            <Combobox
              options={makeOptions}
              value={value.make}
              placeholder="Wszystkie marki"
              // Changing the make invalidates the model choice.
              onChange={(make) => patch({ make, model: null })}
            />
          </Field>
          <Field label="Model">
            <Combobox
              options={modelOptions}
              value={value.model}
              disabled={!value.make}
              placeholder={value.make ? 'Wszystkie modele' : 'Najpierw wybierz markę'}
              emptyText="Brak modeli dla tej marki"
              onChange={(model) => patch({ model })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nadwozie">
            <MultiCombobox
              options={BODY_OPTIONS}
              values={value.bodyTypes}
              onChange={(v) => patch({ bodyTypes: v as BodyType[] })}
            />
          </Field>
          <Field label="Paliwo">
            <MultiCombobox
              options={FUEL_OPTIONS}
              values={value.fuelTypes}
              onChange={(v) => patch({ fuelTypes: v as FuelType[] })}
            />
          </Field>
          <Field label="Skrzynia">
            <MultiCombobox
              options={GEARBOX_OPTIONS}
              values={value.gearboxes}
              onChange={(v) => patch({ gearboxes: v as Gearbox[] })}
            />
          </Field>
        </div>
      </Section>

      <Separator />

      <Section title="Zakresy">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RangeField
            label="Rocznik"
            from={value.yearFrom}
            to={value.yearTo}
            onFrom={(v) => patch({ yearFrom: v })}
            onTo={(v) => patch({ yearTo: v })}
          />
          <RangeField
            label="Cena (zł)"
            from={value.priceFrom}
            to={value.priceTo}
            onFrom={(v) => patch({ priceFrom: v })}
            onTo={(v) => patch({ priceTo: v })}
          />
          <RangeField
            label="Przebieg (km)"
            from={value.mileageFrom}
            to={value.mileageTo}
            onFrom={(v) => patch({ mileageFrom: v })}
            onTo={(v) => patch({ mileageTo: v })}
          />
          <RangeField
            label="Moc (KM)"
            from={value.enginePowerFrom}
            to={value.enginePowerTo}
            onFrom={(v) => patch({ enginePowerFrom: v })}
            onTo={(v) => patch({ enginePowerTo: v })}
          />
        </div>
      </Section>

      <Separator />

      <Section title="Szczegóły">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Kraj pochodzenia">
            <Combobox
              options={taxonomy.data?.countries ?? []}
              value={value.countryOrigin}
              placeholder="Dowolny"
              onChange={(countryOrigin) => patch({ countryOrigin })}
            />
          </Field>
          <Field label="Kolor">
            <MultiCombobox
              options={taxonomy.data?.colors ?? []}
              values={value.colors}
              onChange={(colors) => patch({ colors })}
            />
          </Field>
          <Field label="Liczba drzwi">
            <MultiCombobox
              options={taxonomy.data?.doorCounts ?? []}
              values={value.doorCounts}
              onChange={(doorCounts) => patch({ doorCounts })}
            />
          </Field>
          <Field label="Liczba miejsc">
            <MultiCombobox
              options={taxonomy.data?.seatCounts ?? []}
              values={value.seatCounts}
              onChange={(seatCounts) => patch({ seatCounts })}
            />
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle
            label="Bez uszkodzeń"
            checked={value.excludeDamaged}
            onChange={(v) => patch({ excludeDamaged: v })}
          />
          <Toggle
            label="Bezwypadkowy"
            checked={value.noAccident}
            onChange={(v) => patch({ noAccident: v })}
          />
          <Toggle
            label="Serwisowany w ASO"
            checked={value.servicedAtAso}
            onChange={(v) => patch({ servicedAtAso: v })}
          />
          <Toggle
            label="Pierwszy właściciel"
            checked={value.firstOwner}
            onChange={(v) => patch({ firstOwner: v })}
          />
          <Toggle
            label="Zarejestrowany w PL"
            checked={value.registeredInPl}
            onChange={(v) => patch({ registeredInPl: v })}
          />
          <Toggle
            label="Z numerem VIN"
            checked={value.hasVin}
            onChange={(v) => patch({ hasVin: v })}
          />
          <Toggle
            label="Faktura VAT"
            checked={value.vatInvoice}
            onChange={(v) => patch({ vatInvoice: v })}
          />
          <Toggle
            label="Tylko ze zdjęciami"
            checked={value.onlyWithPhotos}
            onChange={(v) => patch({ onlyWithPhotos: v })}
          />
        </div>
      </Section>

      <Separator />

      <Section
        title="Wyposażenie"
        description={
          value.equipment.length > 0
            ? `Wybrano ${value.equipment.length} pozycji`
            : 'Opcjonalne — zawęża wyniki do aut z wybranym wyposażeniem'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {equipmentGroups.map(([group, items]) => (
            <Field key={group} label={group}>
              <MultiCombobox
                options={items}
                values={value.equipment.filter((id) =>
                  items.some((item) => item.value === id),
                )}
                onChange={(selected) => {
                  const otherGroups = value.equipment.filter(
                    (id) => !items.some((item) => item.value === id),
                  );
                  patch({ equipment: [...otherGroups, ...selected] });
                }}
              />
            </Field>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel className="text-xs font-normal">{label}</FieldLabel>
      {children}
    </div>
  );
}

function RangeField({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel className="text-xs font-normal">{label}</FieldLabel>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="od"
          value={from}
          onChange={(event) => onFrom(event.target.value)}
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="do"
          value={to}
          onChange={(event) => onTo(event.target.value)}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(state) => onChange(state === true)}
      />
      <span className="truncate">{label}</span>
    </label>
  );
}
