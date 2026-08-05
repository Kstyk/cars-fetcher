import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarIcon, ExternalLinkIcon, FuelIcon, GaugeIcon, HeartIcon, MapPinIcon, SettingsIcon, TrendingDownIcon, } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FUEL_LABELS, GEARBOX_LABELS, SELLER_LABELS, formatMileage, formatPrice, formatRelative, label, } from '@/lib/format';
import { useToggleFavorite } from '@/lib/queries';
import { cn } from '@/lib/utils';
/**
 * We deliberately store no car details of our own - the card links straight to
 * the provider's offer page for photos, description and contact.
 */
export function ListingCard({ listing }) {
    const toggleFavorite = useToggleFavorite();
    const isFresh = Date.now() - new Date(listing.firstSeenAt).getTime() < 24 * 3_600_000;
    return (_jsxs(Card, { className: "group relative gap-0 overflow-hidden transition-shadow hover:shadow-md", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 px-5 pt-5", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "mb-1 flex flex-wrap items-center gap-1.5", children: [isFresh ? _jsx(Badge, { variant: "success", children: "Nowe" }) : null, !listing.isActive ? (_jsx(Badge, { variant: "outline", children: "Nieaktywne" })) : null, listing.priceChangePct !== null && listing.priceChangePct < 0 ? (_jsxs(Badge, { variant: "destructive", className: "gap-1", children: [_jsx(TrendingDownIcon, {}), listing.priceChangePct.toFixed(1), "%"] })) : null, _jsx(Badge, { variant: "secondary", children: listing.provider })] }), _jsx("h3", { className: "truncate font-semibold", title: listing.title, children: listing.title }), _jsxs("p", { className: "text-muted-foreground truncate text-sm", children: [[listing.make, listing.model].filter(Boolean).join(' ') || '—', listing.year ? ` · ${listing.year}` : ''] })] }), _jsx(Button, { variant: "ghost", size: "icon", "aria-label": listing.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych', disabled: toggleFavorite.isPending, onClick: () => toggleFavorite.mutate({
                            listingId: listing.id,
                            isFavorite: listing.isFavorite,
                        }), children: _jsx(HeartIcon, { className: cn('transition-colors', listing.isFavorite && 'fill-destructive text-destructive') }) })] }), _jsx("div", { className: "px-5 pt-3", children: _jsx("p", { className: "tabular text-2xl font-semibold", children: formatPrice(listing.price, listing.currency) }) }), _jsxs("dl", { className: "text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 px-5 pt-4 text-sm", children: [_jsx(Spec, { icon: _jsx(GaugeIcon, {}), value: formatMileage(listing.mileageKm) }), _jsx(Spec, { icon: _jsx(FuelIcon, {}), value: label(FUEL_LABELS, listing.fuelType) }), _jsx(Spec, { icon: _jsx(SettingsIcon, {}), value: label(GEARBOX_LABELS, listing.gearbox) }), _jsx(Spec, { icon: _jsx(CalendarIcon, {}), value: listing.enginePowerHp ? `${listing.enginePowerHp} KM` : '—' }), _jsx(Spec, { icon: _jsx(MapPinIcon, {}), value: listing.city ?? '—', className: "col-span-2" })] }), _jsxs("div", { className: "mt-5 flex items-center justify-between gap-2 border-t px-5 py-3", children: [_jsxs("span", { className: "text-muted-foreground text-xs", children: [label(SELLER_LABELS, listing.sellerType), " \u00B7", ' ', formatRelative(listing.firstSeenAt)] }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsxs("a", { href: listing.url, target: "_blank", rel: "noopener noreferrer", children: ["Zobacz ofert\u0119", _jsx(ExternalLinkIcon, {})] }) })] })] }));
}
function Spec({ icon, value, className, }) {
    return (_jsxs("div", { className: cn('flex items-center gap-2 truncate', className), children: [_jsx("span", { className: "[&>svg]:size-3.5 shrink-0 opacity-70", children: icon }), _jsx("span", { className: "truncate", children: value })] }));
}
