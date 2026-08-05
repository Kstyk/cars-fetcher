import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, MultiCombobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator, Skeleton } from '@/components/ui/misc';
import {
  BODY_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
} from '@/lib/format';
import { useTaxonomy } from '@/lib/queries';
import type { BodyType, FuelType, Gearbox } from '@/lib/types';

/** The criteria a single filter row carries, in the shape the API expects. */
export interface FilterFormValue {
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

/** Converts the form into the JSON body the filters endpoint validates. */
export function toFilterPayload(value: FilterFormValue): Record<string, unknown> {
  const number = (input: string) =>
    input.trim() === '' ? null : Number(input);

  return {
    provider: 'otomoto',
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
}: {
  value: FilterFormValue;
  onChange: (value: FilterFormValue) => void;
}) {
  const taxonomy = useTaxonomy();

  function patch(update: Partial<FilterFormValue>): void {
    onChange({ ...value, ...update });
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
      <Label className="text-xs font-normal">{label}</Label>
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
      <Label className="text-xs font-normal">{label}</Label>
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
