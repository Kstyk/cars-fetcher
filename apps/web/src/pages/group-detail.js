import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeftIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { ListingCard } from '@/components/listing-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, } from '@/components/ui/misc';
import { FUEL_LABELS, formatDateTime, formatRelative, label } from '@/lib/format';
import { useAddFilter, useDeleteFilter, useFetchGroup, useFilterGroup, useGroupRuns, useListings, } from '@/lib/queries';
export function GroupDetailPage() {
    // Route ids are prefixed by the pathless `protected-layout` route.
    const { groupId } = useParams({ from: '/protected-layout/groups/$groupId' });
    const group = useFilterGroup(groupId);
    const runs = useGroupRuns(groupId);
    const listings = useListings({ groupId, pageSize: 12, sort: 'newest' });
    const fetchGroup = useFetchGroup();
    const deleteFilter = useDeleteFilter(groupId);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    if (group.isLoading) {
        return _jsx(Skeleton, { className: "h-96" });
    }
    if (!group.data) {
        return (_jsx(EmptyState, { title: "Nie znaleziono grupy", action: _jsx(Button, { asChild: true, variant: "outline", children: _jsx(Link, { to: "/groups", children: "Wr\u00F3\u0107 do listy" }) }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Button, { asChild: true, variant: "ghost", size: "sm", className: "-ml-2", children: _jsxs(Link, { to: "/groups", children: [_jsx(ArrowLeftIcon, {}), "Grupy filtr\u00F3w"] }) }), _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("h1", { className: "flex items-center gap-2 text-2xl font-semibold", children: [_jsx("span", { className: "size-3 rounded-full", style: { background: group.data.color ?? 'var(--primary)' } }), group.data.name] }), _jsx("p", { className: "text-muted-foreground text-sm", children: group.data.description ?? 'Brak opisu' }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [_jsxs(Badge, { variant: "outline", children: [group.data.listingCount, " ofert"] }), group.data.newListingCount > 0 ? (_jsxs(Badge, { variant: "success", children: ["+", group.data.newListingCount, " nowych"] })) : null, _jsxs(Badge, { variant: "secondary", children: ["co ", group.data.refreshIntervalMinutes, " min"] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => setFilterDialogOpen(true), children: [_jsx(PlusIcon, {}), "Dodaj filtr"] }), _jsxs(Button, { disabled: fetchGroup.isPending, onClick: () => fetchGroup.mutate(groupId), children: [_jsx(RefreshCwIcon, { className: fetchGroup.isPending ? 'animate-spin' : undefined }), "Pobierz teraz"] })] })] }), _jsxs(Tabs, { defaultValue: "listings", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "listings", children: "Oferty" }), _jsxs(TabsTrigger, { value: "filters", children: ["Filtry (", group.data.filters.length, ")"] }), _jsx(TabsTrigger, { value: "runs", children: "Historia pobra\u0144" })] }), _jsx(TabsContent, { value: "listings", className: "pt-6", children: listings.isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { className: "h-72" }, i))) })) : listings.data && listings.data.items.length > 0 ? (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: listings.data.items.map((listing) => (_jsx(ListingCard, { listing: listing }, listing.id))) }), listings.data.total > listings.data.items.length ? (_jsx(Button, { asChild: true, variant: "outline", className: "w-full", children: _jsxs(Link, { to: "/listings", search: { groupId }, children: ["Zobacz wszystkie ", listings.data.total, " ofert"] }) })) : null] })) : (_jsx(EmptyState, { title: "Brak ofert w tej grupie", description: "Uruchom pobieranie, aby zebra\u0107 wyniki dla zdefiniowanych filtr\u00F3w." })) }), _jsxs(TabsContent, { value: "filters", className: "space-y-3 pt-6", children: [group.data.filters.map((filter) => (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-wrap items-center justify-between gap-4 py-4", children: [_jsxs("div", { className: "min-w-0 space-y-1", children: [_jsx("p", { className: "font-medium", children: filter.name ??
                                                        [filter.make, filter.model].filter(Boolean).join(' ') ??
                                                        'Filtr' }), _jsxs("div", { className: "text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs", children: [filter.make ? _jsxs("span", { children: ["Marka: ", filter.make] }) : null, filter.model ? _jsxs("span", { children: ["Model: ", filter.model] }) : null, filter.yearFrom ? _jsxs("span", { children: ["Rocznik od: ", filter.yearFrom] }) : null, filter.priceTo ? (_jsxs("span", { children: ["Cena do: ", filter.priceTo.toLocaleString('pl-PL'), " z\u0142"] })) : null, filter.mileageTo ? (_jsxs("span", { children: ["Przebieg do: ", filter.mileageTo.toLocaleString('pl-PL'), " km"] })) : null, filter.fuelTypes?.length ? (_jsxs("span", { children: ["Paliwo:", ' ', filter.fuelTypes.map((f) => label(FUEL_LABELS, f)).join(', ')] })) : null] })] }), _jsx(Button, { size: "icon", variant: "ghost", "aria-label": "Usu\u0144 filtr", onClick: () => deleteFilter.mutate(filter.id), children: _jsx(Trash2Icon, { className: "text-destructive" }) })] }) }, filter.id))), group.data.filters.length === 0 ? (_jsx(EmptyState, { title: "Brak filtr\u00F3w", description: "Dodaj filtr, aby grupa zacz\u0119\u0142a zbiera\u0107 oferty.", action: _jsxs(Button, { onClick: () => setFilterDialogOpen(true), children: [_jsx(PlusIcon, {}), "Dodaj filtr"] }) })) : null] }), _jsx(TabsContent, { value: "runs", className: "pt-6", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-base", children: "Ostatnie pobrania" }) }), _jsxs(CardContent, { className: "pt-0", children: [runs.data && runs.data.length > 0 ? (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "text-muted-foreground text-left text-xs", children: _jsxs("tr", { className: "border-b", children: [_jsx("th", { className: "py-2 pr-4 font-medium", children: "Start" }), _jsx("th", { className: "py-2 pr-4 font-medium", children: "Status" }), _jsx("th", { className: "py-2 pr-4 font-medium", children: "\u0179r\u00F3d\u0142o" }), _jsx("th", { className: "py-2 pr-4 text-right font-medium", children: "Znalezione" }), _jsx("th", { className: "py-2 pr-4 text-right font-medium", children: "Nowe" }), _jsx("th", { className: "py-2 text-right font-medium", children: "Czas" })] }) }), _jsx("tbody", { children: runs.data.map((run) => (_jsxs("tr", { className: "border-b last:border-0", children: [_jsx("td", { className: "py-2 pr-4 whitespace-nowrap", children: formatDateTime(run.startedAt) }), _jsx("td", { className: "py-2 pr-4", children: _jsx(Badge, { variant: run.status === 'success'
                                                                            ? 'success'
                                                                            : run.status === 'failed'
                                                                                ? 'destructive'
                                                                                : 'secondary', children: run.status }) }), _jsx("td", { className: "text-muted-foreground py-2 pr-4", children: run.trigger }), _jsx("td", { className: "tabular py-2 pr-4 text-right", children: run.itemsSeen }), _jsx("td", { className: "tabular py-2 pr-4 text-right", children: run.itemsNew }), _jsx("td", { className: "tabular text-muted-foreground py-2 text-right", children: run.durationMs ? `${(run.durationMs / 1000).toFixed(1)} s` : '—' })] }, run.id))) })] }) })) : (_jsx("p", { className: "text-muted-foreground text-sm", children: "Brak historii \u2014 uruchom pobieranie." })), _jsxs("p", { className: "text-muted-foreground mt-4 text-xs", children: ["Ostatnie pobranie: ", formatRelative(group.data.lastFetchedAt)] })] })] }) })] }), _jsx(AddFilterDialog, { groupId: groupId, open: filterDialogOpen, onOpenChange: setFilterDialogOpen })] }));
}
function AddFilterDialog({ groupId, open, onOpenChange, }) {
    const addFilter = useAddFilter(groupId);
    const [form, setForm] = useState({
        make: '',
        model: '',
        yearFrom: '',
        priceTo: '',
        mileageTo: '',
    });
    async function handleSubmit(event) {
        event.preventDefault();
        await addFilter.mutateAsync({
            provider: 'otomoto',
            name: [form.make, form.model].filter(Boolean).join(' ') || null,
            make: form.make || null,
            model: form.model || null,
            ...(form.yearFrom ? { yearFrom: Number(form.yearFrom) } : {}),
            ...(form.priceTo ? { priceTo: Number(form.priceTo) } : {}),
            ...(form.mileageTo ? { mileageTo: Number(form.mileageTo) } : {}),
            excludeDamaged: true,
        });
        onOpenChange(false);
        setForm({ make: '', model: '', yearFrom: '', priceTo: '', mileageTo: '' });
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Nowy filtr" }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "make", children: "Marka" }), _jsx(Input, { id: "make", required: true, placeholder: "Volvo", value: form.make, onChange: (e) => setForm({ ...form, make: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "model", children: "Model" }), _jsx(Input, { id: "model", placeholder: "XC60", value: form.model, onChange: (e) => setForm({ ...form, model: e.target.value }) })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "yf", children: "Rocznik od" }), _jsx(Input, { id: "yf", type: "number", value: form.yearFrom, onChange: (e) => setForm({ ...form, yearFrom: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "pt", children: "Cena do" }), _jsx(Input, { id: "pt", type: "number", value: form.priceTo, onChange: (e) => setForm({ ...form, priceTo: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "mt", children: "Przebieg do" }), _jsx(Input, { id: "mt", type: "number", value: form.mileageTo, onChange: (e) => setForm({ ...form, mileageTo: e.target.value }) })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Anuluj" }), _jsx(Button, { type: "submit", disabled: addFilter.isPending, children: "Dodaj filtr" })] })] })] }) }));
}
