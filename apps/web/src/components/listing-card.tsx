import {
  CarFrontIcon,
  ExternalLinkIcon,
  FuelIcon,
  GaugeIcon,
  GlobeIcon,
  HeartIcon,
  ImageOffIcon,
  MapPinIcon,
  SettingsIcon,
  TrendingDownIcon,
  ZapIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useToggleFavorite } from '@/lib/queries';
import type { Listing } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * We store no car details of our own - the card links straight to the
 * provider's offer page for the gallery, description and contact.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const toggleFavorite = useToggleFavorite();
  const [imageFailed, setImageFailed] = useState(false);

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

        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {/* Which marketplace this came from - the same car can appear on several. */}
          <Badge
            className="border-transparent text-white"
            style={{ backgroundColor: PROVIDER_COLORS[listing.provider] ?? '#475569' }}
          >
            {label(PROVIDER_LABELS, listing.provider)}
          </Badge>
          {isFresh ? <Badge variant="success">Nowe</Badge> : null}
          {!listing.isActive ? (
            <Badge variant="secondary">Nieaktywne</Badge>
          ) : null}
          {listing.priceChangePct !== null && listing.priceChangePct < 0 ? (
            <Badge variant="destructive" className="gap-1">
              <TrendingDownIcon />
              {listing.priceChangePct.toFixed(1)}%
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
        <h3 className="truncate font-semibold" title={listing.title}>
          {listing.title}
        </h3>
        <p className="text-muted-foreground truncate text-sm">
          {[listing.make, listing.model].filter(Boolean).join(' ') || '—'}
          {listing.year ? ` · ${listing.year}` : ''}
          {listing.version ? ` · ${listing.version}` : ''}
        </p>
        <p className="tabular mt-2 text-2xl font-semibold">
          {formatPrice(listing.price, listing.currency)}
        </p>
      </div>

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 px-5 pt-4 text-sm">
        <Spec icon={<GaugeIcon />} value={formatMileage(listing.mileageKm)} />
        <Spec icon={<FuelIcon />} value={label(FUEL_LABELS, listing.fuelType)} />
        <Spec
          icon={<SettingsIcon />}
          value={label(GEARBOX_LABELS, listing.gearbox)}
        />
        <Spec
          icon={<ZapIcon />}
          value={listing.enginePowerHp ? `${listing.enginePowerHp} KM` : '—'}
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
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a href={listing.url} target="_blank" rel="noopener noreferrer">
            Oferta
            <ExternalLinkIcon />
          </a>
        </Button>
      </div>
    </Card>
  );
}

function Spec({
  icon,
  value,
  className,
}: {
  icon: React.ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 truncate', className)}>
      <span className="shrink-0 opacity-70 [&>svg]:size-3.5">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
