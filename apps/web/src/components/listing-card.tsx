import { Link } from '@tanstack/react-router';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BadgePercentIcon,
  CarFrontIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  FuelIcon,
  GaugeIcon,
  GlobeIcon,
  HeartIcon,
  HourglassIcon,
  ImageOffIcon,
  LineChartIcon,
  MapPinIcon,
  SettingsIcon,
  TagIcon,
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
import { SellerDialog } from '@/components/seller-dialog';
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
import { useListingDetail, useToggleFavorite, useTrackListingView } from '@/lib/queries';
import type { Listing } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Notably longer on the market than similar cars that already sold - not just "old". */
function isStaleListing(listing: Listing): boolean {
  return (
    listing.medianDaysToSellCohort !== null &&
    listing.daysListed >= 21 &&
    listing.daysListed > listing.medianDaysToSellCohort * 2
  );
}

/**
 * We store no car details of our own - the card links straight to the
 * provider's offer page for the gallery, description and contact.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const toggleFavorite = useToggleFavorite();
  const trackView = useTrackListingView();
  const compare = useCompare();
  const [imageFailed, setImageFailed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const compareSelected = compare.isSelected(listing.id);

  // Dates shown to the user are the marketplace's, not our fetch time.
  // `firstSeenAt` is the fallback for providers that do not publish one.
  const publishedAt = listing.publishedAt ?? listing.firstSeenAt;
  const isFresh = Date.now() - new Date(publishedAt).getTime() < 24 * 3_600_000;
  const stale = isStaleListing(listing);

  return (
    <Card className="group relative gap-0 overflow-hidden pt-0 transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none">
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-muted relative block aspect-4/3 overflow-hidden"
        onClick={() => trackView.mutate(listing.id)}
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
            className="bg-secondary-background/90 rounded-base border-2 border-border p-1 shadow-shadow"
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
          {stale ? (
            <Badge
              variant="outline"
              className="gap-1"
              title={`${listing.daysListed} dni na rynku - podobne auta zwykle sprzedają się w ok. ${listing.medianDaysToSellCohort} dni. Może warto negocjować.`}
            >
              <HourglassIcon />
              Długo na rynku
            </Badge>
          ) : null}
        </div>

        <Button
          variant="secondary"
          size="icon"
          aria-label={listing.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          disabled={toggleFavorite.isPending}
          className="absolute top-2 right-2"
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

      {/* The same car, still live elsewhere - see the API doc comment on `mergedIntoId`. */}
      {listing.duplicates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-2 text-xs">
          <span className="text-muted-foreground">Też na:</span>
          {listing.duplicates.map((dup) => (
            <Badge
              key={dup.id}
              asChild
              className="border-transparent text-white"
              style={{ backgroundColor: PROVIDER_COLORS[dup.provider] ?? '#475569' }}
            >
              <a
                href={dup.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackView.mutate(dup.id)}
              >
                {label(PROVIDER_LABELS, dup.provider)}
                {dup.price !== null ? (
                  <span className="data-figure opacity-90">
                    {formatPrice(dup.price, listing.currency)}
                  </span>
                ) : null}
              </a>
            </Badge>
          ))}
        </div>
      ) : null}

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
          {listing.sellerName ? (
            <button
              type="button"
              className="hover:text-foreground underline decoration-dotted underline-offset-2"
              onClick={(event) => {
                event.preventDefault();
                setSellerOpen(true);
              }}
            >
              {listing.sellerName}
            </button>
          ) : (
            label(SELLER_LABELS, listing.sellerType)
          )}{' '}
          · {formatRelative(publishedAt)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {listing.vin ? (
            <Button asChild size="icon" variant="outline" aria-label="Sprawdź VIN" title="Sprawdź VIN">
              <Link to="/vin" search={{ vin: listing.vin }}>
                <FingerprintIcon />
              </Link>
            </Button>
          ) : null}
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
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackView.mutate(listing.id)}
            >
              Oferta
              <ExternalLinkIcon />
            </a>
          </Button>
        </div>
      </div>

      <PriceHistoryDialog
        listingId={listing.id}
        title={listing.title}
        price={listing.price}
        currency={listing.currency}
        priceVsMarketPct={listing.priceVsMarketPct}
        daysListed={listing.daysListed}
        medianDaysToSellCohort={listing.medianDaysToSellCohort}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      {listing.sellerName ? (
        <SellerDialog sellerName={listing.sellerName} open={sellerOpen} onOpenChange={setSellerOpen} />
      ) : null}
    </Card>
  );
}

/**
 * A transparent, explainable heuristic, not a guarantee - shown with its own
 * reasoning so it reads as "here's why", not as an oracle. Two inputs:
 * how far above the market median the asking price sits, and whether the ad
 * has been up longer than similar cars usually take to sell (more room to
 * negotiate on both counts).
 */
function suggestOffer(
  price: number,
  priceVsMarketPct: number | null,
  daysListed: number,
  medianDaysToSellCohort: number | null,
): { discountPct: number; suggested: number; reasons: string[] } | null {
  if (price <= 0) return null;

  const reasons: string[] = [];
  let discountPct = 3; // baseline haggling room on almost any asking price

  if (priceVsMarketPct !== null && priceVsMarketPct > 0) {
    const fromMarket = Math.min(priceVsMarketPct / 2, 15);
    discountPct += fromMarket;
    reasons.push(`Cena ${priceVsMarketPct.toFixed(0)}% powyżej mediany podobnych ofert.`);
  }

  const stale =
    medianDaysToSellCohort !== null && daysListed >= 21 && daysListed > medianDaysToSellCohort * 2;
  if (stale) {
    discountPct += 3;
    reasons.push(
      `${daysListed} dni na rynku - podobne auta zwykle sprzedają się w ok. ${medianDaysToSellCohort} dni.`,
    );
  }

  discountPct = Math.min(discountPct, 20);
  if (reasons.length === 0) {
    reasons.push('Cena już zbliżona do rynkowej - zostaje tylko standardowy margines na negocjacje.');
  }

  return { discountPct, suggested: Math.round((price * (1 - discountPct / 100)) / 100) * 100, reasons };
}

function PriceHistoryDialog({
  listingId,
  title,
  price,
  currency,
  priceVsMarketPct,
  daysListed,
  medianDaysToSellCohort,
  open,
  onOpenChange,
}: {
  listingId: string;
  title: string;
  price: number | null;
  currency: string;
  priceVsMarketPct: number | null;
  daysListed: number;
  medianDaysToSellCohort: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useListingDetail(listingId, { enabled: open });
  const offer = price !== null ? suggestOffer(price, priceVsMarketPct, daysListed, medianDaysToSellCohort) : null;

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

        {offer ? (
          <div className="space-y-2 rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <TagIcon className="size-4" />
              Sugerowana oferta:{' '}
              <span className="data-figure">{formatPrice(offer.suggested, currency)}</span>
              <span className="text-muted-foreground font-normal">
                (-{offer.discountPct.toFixed(0)}%)
              </span>
            </p>
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
              {offer.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs italic">
              Punkt wyjścia do rozmowy, nie gwarancja - ostateczna cena zależy od stanu auta i
              sprzedawcy.
            </p>
          </div>
        ) : null}

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
