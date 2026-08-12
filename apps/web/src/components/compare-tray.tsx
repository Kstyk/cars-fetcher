import { ExternalLinkIcon, ImageOffIcon, ScaleIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { COMPARE_LIMIT, useCompare } from '@/lib/compare';
import {
  FUEL_LABELS,
  GEARBOX_LABELS,
  PROVIDER_LABELS,
  formatMileage,
  formatPrice,
  label,
} from '@/lib/format';
import { useTrackListingView } from '@/lib/queries';
import type { Listing } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Sticky tray for whatever is queued for comparison. Lives in AppShell so it
 * survives navigating between /listings and /favorites - the selection is a
 * cross-page tray, not per-page UI state.
 */
export function CompareTray() {
  const compare = useCompare();
  const [open, setOpen] = useState(false);

  if (compare.items.length === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div className="bg-card flex max-w-full items-center gap-3 rounded-xl border p-2 pr-3 shadow-lg">
          <div className="flex items-center gap-2 pl-1">
            {compare.items.map((item) => (
              <div key={item.id} className="group relative">
                <div className="bg-muted size-11 overflow-hidden rounded-lg border">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground grid size-full place-items-center">
                      <ImageOffIcon className="size-4" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Usuń z porównania"
                  onClick={() => compare.remove(item.id)}
                  className="bg-foreground text-background absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <XIcon className="size-2.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: COMPARE_LIMIT - compare.items.length }).map((_, i) => (
              <div
                key={i}
                className="text-muted-foreground/50 grid size-11 place-items-center rounded-lg border border-dashed text-xs"
              >
                +
              </div>
            ))}
          </div>

          <Button size="sm" disabled={compare.items.length < 2} onClick={() => setOpen(true)}>
            <ScaleIcon />
            Porównaj ({compare.items.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={compare.clear}>
            Wyczyść
          </Button>
        </div>
      </div>

      <CompareDialog open={open} onOpenChange={setOpen} items={compare.items} />
    </>
  );
}

interface Row {
  label: string;
  render: (listing: Listing) => string;
  /** Lower/higher-is-better values to highlight; omitted for non-numeric rows. */
  metric?: (listing: Listing) => number | null;
  betterIs?: 'lower' | 'higher';
}

const ROWS: Row[] = [
  {
    label: 'Cena',
    render: (l) => formatPrice(l.price, l.currency),
    metric: (l) => l.price,
    betterIs: 'lower',
  },
  {
    label: 'Przebieg',
    render: (l) => formatMileage(l.mileageKm),
    metric: (l) => l.mileageKm,
    betterIs: 'lower',
  },
  {
    label: 'Rocznik',
    render: (l) => (l.year ? String(l.year) : '—'),
    metric: (l) => l.year,
    betterIs: 'higher',
  },
  {
    label: 'Moc',
    render: (l) => (l.enginePowerHp ? `${l.enginePowerHp} KM` : '—'),
    metric: (l) => l.enginePowerHp,
    betterIs: 'higher',
  },
  { label: 'Lokalizacja', render: (l) => [l.city, l.region].filter(Boolean).join(', ') || '—' },
  { label: 'Paliwo', render: (l) => label(FUEL_LABELS, l.fuelType) },
  { label: 'Skrzynia', render: (l) => label(GEARBOX_LABELS, l.gearbox) },
  { label: 'Serwis', render: (l) => label(PROVIDER_LABELS, l.provider) },
];

function CompareDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Listing[];
}) {
  const trackView = useTrackListingView();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Porównanie ofert</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-32" />
                {items.map((item) => (
                  <th key={item.id} className="p-2 pb-3 text-left align-top font-normal">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                      onClick={() => trackView.mutate(item.id)}
                    >
                      <div className="bg-muted mb-2 aspect-4/3 w-full overflow-hidden rounded-lg border">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="text-muted-foreground grid size-full place-items-center">
                            <ImageOffIcon className="size-6" />
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-2 font-semibold group-hover:underline">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        Zobacz ofertę
                        <ExternalLinkIcon className="size-3" />
                      </p>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const values = row.metric ? items.map((item) => row.metric?.(item) ?? null) : null;
                const known = values?.filter((v): v is number => v !== null) ?? [];
                const best =
                  known.length > 1
                    ? row.betterIs === 'lower'
                      ? Math.min(...known)
                      : Math.max(...known)
                    : null;

                return (
                  <tr key={row.label} className="border-t">
                    <th className="text-muted-foreground p-2 text-left align-middle text-xs font-medium whitespace-nowrap">
                      {row.label}
                    </th>
                    {items.map((item, i) => {
                      const isBest = best !== null && values?.[i] === best;
                      return (
                        <td
                          key={item.id}
                          className={cn(
                            'p-2 align-middle',
                            row.metric && 'data-figure',
                            isBest && 'font-semibold',
                          )}
                        >
                          <span
                            className={cn(
                              isBest && 'text-[var(--success)]',
                            )}
                          >
                            {row.render(item)}
                          </span>
                          {isBest ? (
                            <Badge variant="success" className="ml-2">
                              Najlepsze
                            </Badge>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
