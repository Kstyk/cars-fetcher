import {
  ArrowDownIcon,
  ArrowUpIcon,
  BadgePercentIcon,
  CarFrontIcon,
  ExternalLinkIcon,
  FuelIcon,
  GaugeIcon,
  GlobeIcon,
  HeartIcon,
  ImageOffIcon,
  LineChartIcon,
  MapPinIcon,
  SettingsIcon,
  ZapIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PriceHistoryChart } from '@/components/price-history-chart';
import { COMPARE_LIMIT, useCompare } from '@/lib/compare';
import {
  FUEL_LABELS,
  GEARBOX_LABELS,
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  SELLER_LABELS,
  formatDateTime,
  formatMileage,
  formatPrice,
  formatRelative,
  label,
} from '@/lib/format';
import { useListingDetail, useToggleFavorite } from '@/lib/queries';
import type { Listing } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * We store no car details of our own - the card links straight to the
 * provider's offer page for the gallery, description and contact.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const toggleFavorite = useToggleFavorite();
  const compare = useCompare();
  const [imageFailed, setImageFailed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const compareSelected = compare.isSelected(listing.id);

  // Dates shown to the user are the marketplace's, not our fetch time.
  // `firstSeenAt` is the fallback for providers that do not publish one.
  const publishedAt = listing.publishedAt ?? listing.firstSeenAt;
  const isFresh = Date.now() - new Date(publishedAt).getTime() < 24 * 3_600_000;

  return (
    <Card className="group relative gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-muted relative block aspect-4/3 overflow-hidden"
      >
        {listing.thumbnailUrl && !imageFailed ? (
          <img
            src={listing.thumbnailUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="text-muted-foreground grid size-full place-items-center">
            <ImageOffIcon className="size-8" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
          {/*
            A checkbox nested in an anchor: click handling on this wrapper
            runs after Radix's own (which already toggled the checked state),
            so preventDefault here only ever cancels the card's navigation.
          */}
          <div
            className="bg-background/90 rounded-md border p-1 shadow-sm"
            onClick={(event) => event.preventDefault()}
            title={
              compareSelected
                ? 'Usuń z porównania'
                : compare.isFull
                  ? `Można porównać maks. ${COMPARE_LIMIT} oferty naraz`
                  : 'Dodaj do porównania'
            }
          >
            <Checkbox
              checked={compareSelected}
              disabled={!compareSelected && compare.isFull}
              aria-label="Dodaj do porównania"
              onCheckedChange={() => compare.toggle(listing)}
            />
          </div>
          {/* Which marketplace this came from - the same car can appear on several. */}
          <Badge
            className="border-transparent text-white"
            style={{ backgroundColor: PROVIDER_COLORS[listing.provider] ?? '#475569' }}
          >
            {label(PROVIDER_LABELS, listing.provider)}
          </Badge>
          {isFresh ? <Badge variant="success">Nowe</Badge> : null}
          {listing.isArchived ? (
            <Badge variant="secondary" title="Ogłoszenie zniknęło z serwisu">
              Sprzedane
            </Badge>
          ) : !listing.isActive ? (
            <Badge variant="secondary">Nieaktywne</Badge>
          ) : null}
          {/* Meaningfully below similar cars (same make/model, ±1 rok, ±30% przebiegu) - a few % isn't worth flagging. */}
          {listing.priceVsMarketPct !== null && listing.priceVsMarketPct <= -10 ? (
            <Badge
              variant="success"
              className="gap-1"
              title="Cena poniżej mediany podobnych ofert (ta sama marka/model, zbliżony rocznik i przebieg)"
            >
              <BadgePercentIcon />
              {Math.abs(listing.priceVsMarketPct).toFixed(0)}% poniżej rynku
            </Badge>
          ) : null}
        </div>

        <Button
          variant="secondary"
          size="icon"
          aria-label={listing.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          disabled={toggleFavorite.isPending}
          className="absolute top-2 right-2 rounded-full shadow-sm"
          onClick={(event) => {
            // The whole image is a link to the provider.
            event.preventDefault();
            toggleFavorite.mutate({
              listingId: listing.id,
              isFavorite: listing.isFavorite,
            });
          }}
        >
          <HeartIcon
            className={cn(
              'transition-colors',
              listing.isFavorite && 'fill-destructive text-destructive',
            )}
          />
        </Button>
      </a>

      {/* Which of the user's filter groups produced this result. */}
      {listing.groups.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-5 pt-4">
          {listing.groups.map((group) => (
            <span
              key={group.id}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
              style={
                group.color
                  ? {
                      borderColor: `${group.color}55`,
                      backgroundColor: `${group.color}15`,
                      color: group.color,
                    }
                  : undefined
              }
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: group.color ?? 'currentColor' }}
              />
              {group.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="px-5 pt-3">
        <h3 className="font-display truncate font-semibold" title={listing.title}>
          {listing.title}
        </h3>
        <p className="text-muted-foreground truncate text-sm">
          {[listing.make, listing.model].filter(Boolean).join(' ') || '—'}
          {listing.year ? ` · ${listing.year}` : ''}
          {listing.version ? ` · ${listing.version}` : ''}
        </p>
        <p className="data-figure mt-2 flex items-baseline gap-1.5 text-2xl font-semibold">
          {formatPrice(listing.price, listing.currency)}
          {/* Ticker arrow - the price this listing is watched against moved. */}
          {listing.priceChangePct !== null ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-sm font-medium',
                listing.priceChangePct < 0 ? 'text-success' : 'text-destructive',
              )}
              title={`Zmiana ceny: ${listing.priceChangePct > 0 ? '+' : ''}${listing.priceChangePct.toFixed(1)}%`}
            >
              {listing.priceChangePct < 0 ? <ArrowDownIcon className="size-3.5" /> : <ArrowUpIcon className="size-3.5" />}
              {Math.abs(listing.priceChangePct).toFixed(1)}%
            </span>
          ) : null}
        </p>
      </div>

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 px-5 pt-4 text-sm">
        <Spec icon={<GaugeIcon />} value={formatMileage(listing.mileageKm)} mono />
        <Spec icon={<FuelIcon />} value={label(FUEL_LABELS, listing.fuelType)} />
        <Spec
          icon={<SettingsIcon />}
          value={label(GEARBOX_LABELS, listing.gearbox)}
        />
        <Spec
          icon={<ZapIcon />}
          value={listing.enginePowerHp ? `${listing.enginePowerHp} KM` : '—'}
          mono
        />
        <Spec icon={<MapPinIcon />} value={listing.city ?? '—'} />
        {/* Country of origin only when the advert actually declares it. */}
        {listing.countryOrigin ? (
          <Spec icon={<GlobeIcon />} value={listing.countryOrigin} />
        ) : (
          <Spec
            icon={<CarFrontIcon />}
            value={
              listing.engineCapacityCm3
                ? `${(listing.engineCapacityCm3 / 1000).toFixed(1)} l`
                : '—'
            }
            mono
          />
        )}
      </dl>

      <div className="mt-5 flex items-center justify-between gap-2 border-t px-5 py-3">
        <span
          className="text-muted-foreground truncate text-xs"
          // Exact dates on hover: when the advert went up, and when we saw it.
          title={`Wystawiono: ${formatDateTime(publishedAt)}\nPobrano: ${formatDateTime(listing.firstSeenAt)}`}
        >
          {listing.sellerName ?? label(SELLER_LABELS, listing.sellerType)} ·{' '}
          {formatRelative(publishedAt)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Historia ceny"
            title="Historia ceny"
            onClick={() => setHistoryOpen(true)}
          >
            <LineChartIcon />
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={listing.url} target="_blank" rel="noopener noreferrer">
              Oferta
              <ExternalLinkIcon />
            </a>
          </Button>
        </div>
      </div>

      <PriceHistoryDialog
        listingId={listing.id}
        title={listing.title}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </Card>
  );
}

function PriceHistoryDialog({
  listingId,
  title,
  open,
  onOpenChange,
}: {
  listingId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useListingDetail(listingId, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">Historia ceny</DialogTitle>
        </DialogHeader>
        {detail.isLoading ? (
          <div className="text-muted-foreground py-10 text-center text-sm">Wczytuję…</div>
        ) : detail.data ? (
          <PriceHistoryChart entries={detail.data.priceHistory} />
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Nie udało się wczytać historii ceny.
          </p>
        )}
        <p className="text-muted-foreground truncate text-xs" title={title}>
          {title}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Spec({
  icon,
  value,
  className,
  mono,
}: {
  icon: React.ReactNode;
  value: string;
  className?: string;
  /** Numeric readouts (km, KM, litres) get the data-figure treatment too. */
  mono?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 truncate', className)}>
      <span className="shrink-0 opacity-70 [&>svg]:size-3.5">{icon}</span>
      <span className={cn('truncate', mono && 'data-figure')}>{value}</span>
    </div>
  );
}
