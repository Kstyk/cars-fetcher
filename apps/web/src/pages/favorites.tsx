import { HeartIcon } from 'lucide-react';
import { ListingCard } from '@/components/listing-card';
import { EmptyState } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { useFavorites } from '@/lib/queries';

export function FavoritesPage() {
  const favorites = useFavorites();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ulubione</h1>
        <p className="text-muted-foreground text-sm">
          Auta zapisane z poziomu listy ofert.
        </p>
      </div>

      {favorites.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : favorites.data && favorites.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.data.map((favorite) => (
            <ListingCard key={favorite.listing.id} listing={favorite.listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<HeartIcon className="size-8" />}
          title="Brak ulubionych"
          description="Kliknij serduszko na karcie oferty, aby zapisać auto na później."
        />
      )}
    </div>
  );
}
