import { Loader2Icon, PencilRulerIcon } from 'lucide-react';
import { useState } from 'react';
import {
  BODY_OPTIONS,
  FUEL_OPTIONS,
  GEARBOX_OPTIONS,
  filterToFormValue,
  toFilterPayload,
  type FilterFormValue,
} from '@/components/filter-form';
import { VOIVODESHIPS } from '@/components/location-filter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, MultiCombobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCities, useTaxonomy, useUpdateFilter } from '@/lib/queries';
import type { Filter } from '@/lib/types';

type FieldKind = 'number' | 'multi' | 'combobox' | 'boolean';
/** Which option list a `combobox`-kind field draws from. */
type ComboboxSource = 'countries' | 'regions' | 'cities';

interface BulkField {
  key: keyof FilterFormValue;
  label: string;
  kind: FieldKind;
  comboboxSource?: ComboboxSource;
}

const BULK_FIELDS: BulkField[] = [
  { key: 'priceFrom', label: 'Cena od (zł)', kind: 'number' },
  { key: 'priceTo', label: 'Cena do (zł)', kind: 'number' },
  { key: 'yearFrom', label: 'Rocznik od', kind: 'number' },
  { key: 'yearTo', label: 'Rocznik do', kind: 'number' },
  { key: 'mileageFrom', label: 'Przebieg od (km)', kind: 'number' },
  { key: 'mileageTo', label: 'Przebieg do (km)', kind: 'number' },
  { key: 'enginePowerFrom', label: 'Moc od (KM)', kind: 'number' },
  { key: 'enginePowerTo', label: 'Moc do (KM)', kind: 'number' },
  { key: 'fuelTypes', label: 'Paliwo', kind: 'multi' },
  { key: 'gearboxes', label: 'Skrzynia', kind: 'multi' },
  { key: 'bodyTypes', label: 'Nadwozie', kind: 'multi' },
  { key: 'countryOrigin', label: 'Kraj pochodzenia', kind: 'combobox', comboboxSource: 'countries' },
  { key: 'region', label: 'Województwo', kind: 'combobox', comboboxSource: 'regions' },
  { key: 'city', label: 'Miasto', kind: 'combobox', comboboxSource: 'cities' },
  { key: 'radiusKm', label: 'Promień (km)', kind: 'number' },
  { key: 'excludeDamaged', label: 'Bez uszkodzeń', kind: 'boolean' },
  { key: 'onlyWithPhotos', label: 'Tylko ze zdjęciami', kind: 'boolean' },
];

/**
 * Patches one criterion across several filters in one go - "add a minimum
 * price to these 10 filters" instead of opening each one to type the same
 * number ten times. Reuses the exact same update path a single-filter edit
 * would (`filterToFormValue` -> patch -> `toFilterPayload` -> `PUT`), just
 * looped - the API has no bulk endpoint, this is a client-side fan-out
 * (same shape as multi-provider filter *creation* elsewhere in this file's
 * neighbourhood).
 */
export function BulkEditFiltersDialog({
  groupId,
  filters,
  selectedIds,
  open,
  onOpenChange,
  onDone,
}: {
  groupId: string;
  filters: Filter[];
  selectedIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const taxonomy = useTaxonomy();
  const cities = useCities();
  const updateFilter = useUpdateFilter(groupId);
  const [fieldKey, setFieldKey] = useState<keyof FilterFormValue | ''>('');
  const [numberValue, setNumberValue] = useState('');
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const [comboboxValue, setComboboxValue] = useState<string | null>(null);
  const [booleanValue, setBooleanValue] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = BULK_FIELDS.find((f) => f.key === fieldKey) ?? null;
  const countryOptions =
    taxonomy.data?.countries.map(({ label }) => ({ value: label, label })) ?? [];
  const regionOptions = VOIVODESHIPS.map((r) => ({ value: r, label: r }));
  const cityOptions = [...new Set((cities.data ?? []).map((entry) => entry.city))].map(
    (name) => ({ value: name, label: name }),
  );
  const comboboxOptions: Record<ComboboxSource, Array<{ value: string; label: string }>> = {
    countries: countryOptions,
    regions: regionOptions,
    cities: cityOptions,
  };

  function reset() {
    setFieldKey('');
    setNumberValue('');
    setMultiValue([]);
    setComboboxValue(null);
    setBooleanValue(true);
    setError(null);
  }

  async function handleApply() {
    if (!field) return;

    const value =
      field.kind === 'number'
        ? numberValue
        : field.kind === 'multi'
          ? multiValue
          : field.kind === 'combobox'
            ? comboboxValue
            : booleanValue;

    const isClearing =
      (field.kind === 'number' && numberValue.trim() === '') ||
      (field.kind === 'multi' && multiValue.length === 0) ||
      (field.kind === 'combobox' && comboboxValue === null);

    if (
      !window.confirm(
        isClearing
          ? `Wyczyścić pole "${field.label}" w ${selectedIds.length} filtrach?`
          : `Ustawić "${field.label}" w ${selectedIds.length} filtrach? Nadpisze dotychczasową wartość tego pola w każdym z nich.`,
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const filter = filters.find((f) => f.id === id);
          if (!filter) return;
          const patched: FilterFormValue = { ...filterToFormValue(filter), [field.key]: value };
          const [payload] = toFilterPayload(patched);
          await updateFilter.mutateAsync({ filterId: id, input: payload });
        }),
      );
      onOpenChange(false);
      reset();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zastosować zmian');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj zbiorczo</DialogTitle>
          <DialogDescription>
            Ustawia jedno kryterium naraz w {selectedIds.length}{' '}
            {selectedIds.length === 1 ? 'zaznaczonym filtrze' : 'zaznaczonych filtrach'} - reszta
            kryteriów w każdym z nich zostaje bez zmian. Puste pole czyści tę wartość zamiast ją
            ustawiać.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pole</Label>
            <Select value={fieldKey} onValueChange={(v) => setFieldKey(v as keyof FilterFormValue)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wybierz pole do zmiany" />
              </SelectTrigger>
              <SelectContent>
                {BULK_FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {field?.kind === 'number' ? (
            <div className="space-y-1.5">
              <Label>Nowa wartość</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Zostaw puste, żeby wyczyścić"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
              />
            </div>
          ) : null}

          {field?.kind === 'multi' ? (
            <div className="space-y-1.5">
              <Label>Nowa wartość</Label>
              <MultiCombobox
                options={
                  field.key === 'fuelTypes'
                    ? FUEL_OPTIONS
                    : field.key === 'gearboxes'
                      ? GEARBOX_OPTIONS
                      : BODY_OPTIONS
                }
                values={multiValue}
                placeholder="Zostaw puste, żeby wyczyścić"
                onChange={setMultiValue}
              />
            </div>
          ) : null}

          {field?.kind === 'combobox' ? (
            <div className="space-y-1.5">
              <Label>Nowa wartość</Label>
              <Combobox
                options={comboboxOptions[field.comboboxSource ?? 'countries']}
                value={comboboxValue}
                placeholder="Zostaw puste, żeby wyczyścić"
                onChange={setComboboxValue}
              />
            </div>
          ) : null}

          {field?.kind === 'boolean' ? (
            <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={booleanValue}
                onCheckedChange={(state) => setBooleanValue(state === true)}
              />
              {field.label}
            </label>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button type="button" disabled={!field || pending} onClick={() => void handleApply()}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PencilRulerIcon />}
            Zastosuj do {selectedIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
