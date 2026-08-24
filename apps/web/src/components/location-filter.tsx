import 'leaflet/dist/leaflet.css';
import { MapPinIcon, XIcon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, MultiCombobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Leaflet pulls in a sizeable bundle, so the picker only loads when opened.
const MapPicker = lazy(() =>
  import('./map-picker').then((m) => ({ default: m.MapPicker })),
);

export const VOIVODESHIPS = [
  'Dolnośląskie',
  'Kujawsko-pomorskie',
  'Lubelskie',
  'Lubuskie',
  'Łódzkie',
  'Małopolskie',
  'Mazowieckie',
  'Opolskie',
  'Podkarpackie',
  'Podlaskie',
  'Pomorskie',
  'Śląskie',
  'Świętokrzyskie',
  'Warmińsko-mazurskie',
  'Wielkopolskie',
  'Zachodniopomorskie',
];

export const RADIUS_OPTIONS = [10, 25, 50, 75, 100, 150, 200, 300];

export interface LocationValue {
  regions: string[];
  city: string | null;
  radiusKm: number | null;
  /** Set only when the user dropped a pin on the map. */
  point: { lat: number; lon: number } | null;
}

export const EMPTY_LOCATION: LocationValue = {
  regions: [],
  city: null,
  radiusKm: null,
  point: null,
};

const NO_RADIUS = '__none__';

/**
 * Location filter with three interchangeable modes: voivodeship, city plus a
 * radius, or a pin on the map plus a radius. The pin wins when set, because it
 * is the more specific of the two anchors.
 */
export function LocationFilter({
  value,
  onChange,
  cities,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  cities: string[];
}) {
  const [mapOpen, setMapOpen] = useState(false);

  function patch(update: Partial<LocationValue>): void {
    onChange({ ...value, ...update });
  }

  const cityOptions = cities.map((city) => ({ value: city, label: city }));

  return (
    <>
      <div className="space-y-1.5 sm:w-44">
        <Label>Województwo</Label>
        <MultiCombobox
          options={VOIVODESHIPS.map((region) => ({ value: region, label: region }))}
          values={value.regions}
          placeholder="Wszystkie"
          onChange={(regions) => patch({ regions })}
        />
      </div>

      <div className="space-y-1.5 sm:w-44">
        <Label>Miasto</Label>
        <Combobox
          options={cityOptions}
          value={value.city}
          placeholder="Dowolne"
          emptyText="Brak miasta w wynikach"
          // A city and a map pin are two ways to say the same thing.
          onChange={(city) => patch({ city, point: null })}
        />
      </div>

      <div className="space-y-1.5 sm:w-36">
        <Label>Promień</Label>
        <Select
          value={value.radiusKm === null ? NO_RADIUS : String(value.radiusKm)}
          onValueChange={(radius) =>
            patch({ radiusKm: radius === NO_RADIUS ? null : Number(radius) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Bez promienia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_RADIUS}>Bez promienia</SelectItem>
            {RADIUS_OPTIONS.map((km) => (
              <SelectItem key={km} value={String(km)}>
                {km} km
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Punkt na mapie</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={value.point ? 'default' : 'outline'}
            onClick={() => setMapOpen(true)}
          >
            <MapPinIcon />
            {value.point
              ? `${value.point.lat.toFixed(3)}, ${value.point.lon.toFixed(3)}`
              : 'Wybierz'}
          </Button>
          {value.point ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Usuń pinezkę"
              onClick={() => patch({ point: null })}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Wskaż punkt na mapie</DialogTitle>
            <DialogDescription>
              Kliknij mapę, aby ustawić środek wyszukiwania. Zasięg bierze się z
              wybranego promienia
              {value.radiusKm ? ` (${value.radiusKm} km)` : ' — ustaw go obok'}.
            </DialogDescription>
          </DialogHeader>

          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <MapPicker
              point={value.point}
              radiusKm={value.radiusKm}
              onPick={(point) => patch({ point, city: null })}
            />
          </Suspense>

          <DialogFooter>
            <Button variant="outline" onClick={() => patch({ point: null })}>
              Wyczyść
            </Button>
            <Button onClick={() => setMapOpen(false)}>Gotowe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Turns the filter state into the query parameters the API understands. */
export function locationToParams(value: LocationValue): Record<string, unknown> {
  return {
    ...(value.regions.length ? { region: value.regions } : {}),
    ...(value.point
      ? { lat: value.point.lat, lon: value.point.lon }
      : value.city
        ? { city: value.city }
        : {}),
    // A radius without an anchor would filter nothing.
    ...(value.radiusKm && (value.point || value.city)
      ? { radiusKm: value.radiusKm }
      : {}),
  };
}
