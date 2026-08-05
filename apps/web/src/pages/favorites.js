import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HeartIcon } from 'lucide-react';
import { ListingCard } from '@/components/listing-card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useFavorites } from '@/lib/queries';
export function FavoritesPage() {
    const favorites = useFavorites();
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Ulubione" }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Auta zapisane z poziomu listy ofert." })] }), favorites.isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { className: "h-72" }, i))) })) : favorites.data && favorites.data.length > 0 ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: favorites.data.map((favorite) => (_jsx(ListingCard, { listing: {
                        ...favorite.listing,
                        isFavorite: true,
                        groupIds: [],
                        priceChangePct: null,
                    } }, favorite.listing.id))) })) : (_jsx(EmptyState, { icon: _jsx(HeartIcon, { className: "size-8" }), title: "Brak ulubionych", description: "Kliknij serduszko na karcie oferty, aby zapisa\u0107 auto na p\u00F3\u017Aniej." }))] }));
}
