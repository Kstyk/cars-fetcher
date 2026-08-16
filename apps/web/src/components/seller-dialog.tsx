import { ExternalLinkIcon, ImageOffIcon, StoreIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import {
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  formatDateTime,
  formatPrice,
  label,
} from '@/lib/format';
import { useSellerProfile, useTrackListingView } from '@/lib/queries';
import { cn } from '@/lib/utils';

/**
 * Sellers have no id anywhere in the scraped data, only a free-text name -
 * see the API doc comment on `getSellerProfile` for what that does and
 * doesn't mean for accuracy.
 */
export function SellerDialog({
  sellerName,
  open,
  onOpenChange,
}: {
  sellerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useSellerProfile(open ? sellerName : null);
  const trackView = useTrackListingView();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StoreIcon className="size-5 shrink-0" />
            <span className="truncate" title={sellerName ?? undefined}>
              {sellerName}
            </span>
          </DialogTitle>
          <DialogDescription>
            Wszystkie ogłoszenia pod tą nazwą sprzedawcy w naszej bazie, niezależnie od serwisu.
          </DialogDescription>
        </DialogHeader>

        {profile.isLoading ? (
          <Skeleton className="h-64" />
        ) : profile.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.data.totalActive} aktywnych ofert</Badge>
              {profile.data.totalArchived > 0 ? (
                <Badge variant="outline">{profile.data.totalArchived} sprzedanych</Badge>
              ) : null}
              {profile.data.medianDaysToSellOwn !== null ? (
                <Badge variant="outline">
                  śr. {profile.data.medianDaysToSellOwn} dni do sprzedaży
                </Badge>
              ) : null}
              <Badge variant="outline" title={formatDateTime(profile.data.firstSeenAt)}>
                u nas od {formatDateTime(profile.data.firstSeenAt)}
              </Badge>
            </div>

            {profile.data.totalActive > 5 ? (
              <p className="bg-secondary/60 rounded-md px-3 py-2 text-xs">
                Sporo równoległych ofert pod tą samą nazwą - typowe dla komisu/dealera, nie
                pojedynczego prywatnego sprzedawcy.
              </p>
            ) : null}

            <div className="max-h-96 space-y-2 overflow-x-hidden overflow-y-auto">
              {profile.data.activeListings.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackView.mutate(item.id)}
                  className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-2 transition-colors"
                >
                  <div className="bg-muted size-12 shrink-0 overflow-hidden rounded-md">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {/* `min-w-0` here too - a flex row's text does not shrink/truncate
                        by default, only its already-`min-w-0` parent does. */}
                    <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                      <span
                        className={cn('inline-block size-1.5 shrink-0 rounded-full')}
                        style={{ background: PROVIDER_COLORS[item.provider] ?? '#475569' }}
                      />
                      <span className="truncate">
                        {label(PROVIDER_LABELS, item.provider)} · {item.daysListed} dni na rynku
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="data-figure text-sm font-semibold whitespace-nowrap">
                      {formatPrice(item.price, item.currency)}
                    </span>
                    <ExternalLinkIcon className="text-muted-foreground size-3.5 shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<StoreIcon className="size-8" />}
            title="Brak danych o sprzedawcy"
            description="Nie znaleziono innych ogłoszeń pod tą nazwą."
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
