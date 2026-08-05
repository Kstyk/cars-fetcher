import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CarFrontIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { FUEL_LABELS, GEARBOX_LABELS } from '@/lib/format';
import { useFilterGroups, useListings } from '@/lib/queries';
const SORT_OPTIONS = [
    { value: 'newest', label: 'Najnowsze' },
    { value: 'price_asc', label: 'Cena rosnąco' },
    { value: 'price_desc', label: 'Cena malejąco' },
    { value: 'mileage_asc', label: 'Przebieg rosnąco' },
    { value: 'year_desc', label: 'Rocznik malejąco' },
];
const ALL = '__all__';
const EMPTY_FILTERS = {
    q: '',
    groupId: ALL,
    fuelType: ALL,
    gearbox: ALL,
    priceFrom: '',
    priceTo: '',
    yearFrom: '',
    mileageTo: '',
    sort: 'newest',
};
export function ListingsPage() {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const groups = useFilterGroups();
    const params = {
        page,
        pageSize: 24,
        sort: filters.sort,
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.groupId !== ALL ? { groupId: filters.groupId } : {}),
        ...(filters.fuelType !== ALL ? { fuelType: filters.fuelType } : {}),
        ...(filters.gearbox !== ALL ? { gearbox: filters.gearbox } : {}),
        ...(filters.priceFrom ? { priceFrom: filters.priceFrom } : {}),
        ...(filters.priceTo ? { priceTo: filters.priceTo } : {}),
        ...(filters.yearFrom ? { yearFrom: filters.yearFrom } : {}),
        ...(filters.mileageTo ? { mileageTo: filters.mileageTo } : {}),
    };
    const listings = useListings(params);
    function update(key, value) {
        setFilters((current) => ({ ...current, [key]: value }));
        setPage(1);
    }
    const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Og\u0142oszenia" }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Wyniki zebrane przez Twoje grupy filtr\u00F3w. Klikni\u0119cie oferty prowadzi bezpo\u015Brednio do serwisu \u017Ar\u00F3d\u0142owego." })] }), _jsxs("div", { className: "bg-card space-y-4 rounded-xl border p-4", children: [_jsxs("div", { className: "flex flex-wrap items-end gap-3", children: [_jsxs("div", { className: "min-w-56 flex-1 space-y-1.5", children: [_jsx(Label, { htmlFor: "q", children: "Szukaj" }), _jsxs("div", { className: "relative", children: [_jsx(SearchIcon, { className: "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" }), _jsx(Input, { id: "q", placeholder: "np. XC60, RAV4 Hybrid", className: "pl-9", value: filters.q, onChange: (e) => update('q', e.target.value) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Grupa" }), _jsxs(Select, { value: filters.groupId, onValueChange: (v) => update('groupId', v), children: [_jsx(SelectTrigger, { className: "w-48", children: _jsx(SelectValue, { placeholder: "Wszystkie grupy" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL, children: "Wszystkie grupy" }), groups.data?.map((group) => (_jsx(SelectItem, { value: group.id, children: group.name }, group.id)))] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Sortowanie" }), _jsxs(Select, { value: filters.sort, onValueChange: (v) => update('sort', v), children: [_jsx(SelectTrigger, { className: "w-44", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SORT_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-end gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Paliwo" }), _jsxs(Select, { value: filters.fuelType, onValueChange: (v) => update('fuelType', v), children: [_jsx(SelectTrigger, { className: "w-44", children: _jsx(SelectValue, { placeholder: "Dowolne" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL, children: "Dowolne" }), Object.entries(FUEL_LABELS).map(([value, text]) => (_jsx(SelectItem, { value: value, children: text }, value)))] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Skrzynia" }), _jsxs(Select, { value: filters.gearbox, onValueChange: (v) => update('gearbox', v), children: [_jsx(SelectTrigger, { className: "w-44", children: _jsx(SelectValue, { placeholder: "Dowolna" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL, children: "Dowolna" }), Object.entries(GEARBOX_LABELS).map(([value, text]) => (_jsx(SelectItem, { value: value, children: text }, value)))] })] })] }), _jsx(NumberField, { label: "Cena od", value: filters.priceFrom, onChange: (v) => update('priceFrom', v) }), _jsx(NumberField, { label: "Cena do", value: filters.priceTo, onChange: (v) => update('priceTo', v) }), _jsx(NumberField, { label: "Rocznik od", value: filters.yearFrom, onChange: (v) => update('yearFrom', v) }), _jsx(NumberField, { label: "Przebieg do", value: filters.mileageTo, onChange: (v) => update('mileageTo', v) }), hasActiveFilters ? (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }, children: [_jsx(XIcon, {}), "Wyczy\u015B\u0107"] })) : null] })] }), listings.isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx(Skeleton, { className: "h-72" }, i))) })) : listings.data && listings.data.items.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-muted-foreground text-sm", children: ["Znaleziono ", listings.data.total, " ofert"] }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: listings.data.items.map((listing) => (_jsx(ListingCard, { listing: listing }, listing.id))) }), listings.data.totalPages > 1 ? (_jsxs("div", { className: "flex items-center justify-center gap-3 pt-2", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => setPage((p) => p - 1), children: "Poprzednia" }), _jsxs("span", { className: "text-muted-foreground text-sm", children: ["Strona ", listings.data.page, " z ", listings.data.totalPages] }), _jsx(Button, { variant: "outline", size: "sm", disabled: page >= listings.data.totalPages, onClick: () => setPage((p) => p + 1), children: "Nast\u0119pna" })] })) : null] })) : (_jsx(EmptyState, { icon: _jsx(CarFrontIcon, { className: "size-8" }), title: "Brak wynik\u00F3w", description: "Zmie\u0144 kryteria wyszukiwania albo uruchom pobieranie w grupie filtr\u00F3w." }))] }));
}
function NumberField({ label, value, onChange, }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: label }), _jsx(Input, { type: "number", inputMode: "numeric", className: "w-32", value: value, onChange: (e) => onChange(e.target.value) })] }));
}
