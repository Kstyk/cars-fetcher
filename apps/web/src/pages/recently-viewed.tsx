import { HistoryIcon } from 'lucide-react';
import { ListingCard } from '@/components/listing-card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useRecentlyViewed } from '@/lib/queries';

export function RecentlyViewedPage() {
  const recentlyViewed = useRecentlyViewed();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ostatnio oglądane</h1>
        <p className="text-muted-foreground text-sm">
          Oferty, które otworzyłeś w serwisie źródłowym - z karty, powiadomienia albo
          porównywarki. Najnowsze na górze.
        </p>
      </div>

      {recentlyViewed.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : recentlyViewed.data && recentlyViewed.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentlyViewed.data.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<HistoryIcon className="size-8" />}
          title="Brak ostatnio oglądanych"
          description="Kliknij zdjęcie albo „Oferta” na karcie, żeby otworzyć ogłoszenie w serwisie źródłowym - trafi tutaj."
        />
      )}
    </div>
  );
}
