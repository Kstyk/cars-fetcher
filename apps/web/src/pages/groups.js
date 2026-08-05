import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from '@tanstack/react-router';
import { ListFilterIcon, Loader2Icon, PlusIcon, RefreshCwIcon, Trash2Icon, } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton, Textarea } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { formatRelative } from '@/lib/format';
import { useCreateGroup, useDeleteGroup, useFetchGroup, useFilterGroups, } from '@/lib/queries';
export function GroupsPage() {
    const groups = useFilterGroups();
    const fetchGroup = useFetchGroup();
    const deleteGroup = useDeleteGroup();
    const [dialogOpen, setDialogOpen] = useState(false);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Grupy filtr\u00F3w" }), _jsx("p", { className: "text-muted-foreground max-w-2xl text-sm", children: "Ka\u017Cda grupa zbiera kilka wyszukiwa\u0144 w jedn\u0105 list\u0119 wynik\u00F3w \u2014 np. \u201EVolvo + Toyota\u201D osobno od \u201EMazda + Kia\u201D." })] }), _jsxs(Button, { onClick: () => setDialogOpen(true), children: [_jsx(PlusIcon, {}), "Nowa grupa"] })] }), groups.isLoading ? (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Skeleton, { className: "h-52" }), _jsx(Skeleton, { className: "h-52" })] })) : groups.data && groups.data.length > 0 ? (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: groups.data.map((group) => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx("span", { className: "size-2.5 shrink-0 rounded-full", style: { background: group.color ?? 'var(--primary)' } }), _jsx(Link, { to: "/groups/$groupId", params: { groupId: group.id }, className: "truncate hover:underline", children: group.name })] }), _jsx(CardDescription, { children: group.description ?? 'Brak opisu' })] }), _jsxs("div", { className: "flex shrink-0 gap-1", children: [_jsx(Button, { size: "icon", variant: "ghost", "aria-label": "Pobierz teraz", disabled: fetchGroup.isPending, onClick: () => fetchGroup.mutate(group.id), children: _jsx(RefreshCwIcon, { className: fetchGroup.isPending && fetchGroup.variables === group.id
                                                        ? 'animate-spin'
                                                        : undefined }) }), _jsx(Button, { size: "icon", variant: "ghost", "aria-label": "Usu\u0144 grup\u0119", onClick: () => {
                                                    if (window.confirm(`Usunąć grupę "${group.name}" wraz z jej filtrami?`)) {
                                                        deleteGroup.mutate(group.id);
                                                    }
                                                }, children: _jsx(Trash2Icon, { className: "text-destructive" }) })] })] }) }), _jsxs(CardContent, { className: "space-y-3 pt-4", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Badge, { variant: "outline", children: [group.listingCount, " ofert"] }), group.newListingCount > 0 ? (_jsxs(Badge, { variant: "success", children: ["+", group.newListingCount, " nowych"] })) : null, group.notifyOnNew ? (_jsx(Badge, { variant: "secondary", children: "Powiadomienia" })) : null, !group.isActive ? _jsx(Badge, { variant: "outline", children: "Wstrzymana" }) : null] }), _jsxs("ul", { className: "space-y-1.5 text-sm", children: [group.filters.map((filter) => (_jsxs("li", { className: "bg-muted/50 flex items-center justify-between gap-2 rounded-md px-3 py-2", children: [_jsx("span", { className: "truncate", children: filter.name ??
                                                        [filter.make, filter.model].filter(Boolean).join(' ') ??
                                                        'Filtr' }), _jsxs("span", { className: "text-muted-foreground shrink-0 text-xs", children: [filter.yearFrom ? `od ${filter.yearFrom}` : '', filter.priceTo
                                                            ? ` · do ${filter.priceTo.toLocaleString('pl-PL')} zł`
                                                            : ''] })] }, filter.id))), group.filters.length === 0 ? (_jsx("li", { className: "text-muted-foreground text-sm", children: "Brak filtr\u00F3w \u2014 dodaj je w szczeg\u00F3\u0142ach grupy." })) : null] }), _jsxs("p", { className: "text-muted-foreground text-xs", children: ["Ostatnie pobranie: ", formatRelative(group.lastFetchedAt), " \u00B7 od\u015Bwie\u017Canie co ", group.refreshIntervalMinutes, " min"] })] })] }, group.id))) })) : (_jsx(EmptyState, { icon: _jsx(ListFilterIcon, { className: "size-8" }), title: "Brak grup filtr\u00F3w", description: "Utw\u00F3rz pierwsz\u0105 grup\u0119, aby zacz\u0105\u0107 zbiera\u0107 oferty.", action: _jsxs(Button, { onClick: () => setDialogOpen(true), children: [_jsx(PlusIcon, {}), "Nowa grupa"] }) })), _jsx(CreateGroupDialog, { open: dialogOpen, onOpenChange: setDialogOpen })] }));
}
function CreateGroupDialog({ open, onOpenChange, }) {
    const createGroup = useCreateGroup();
    const [form, setForm] = useState({
        name: '',
        description: '',
        color: '#2563eb',
        refreshIntervalMinutes: 60,
        notifyOnNew: true,
        makes: '',
        yearFrom: '',
        priceTo: '',
    });
    const [error, setError] = useState(null);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        // "Volvo, Toyota" becomes one filter per make inside the new group.
        const makes = form.makes
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean);
        try {
            await createGroup.mutateAsync({
                name: form.name,
                description: form.description || null,
                color: form.color,
                refreshIntervalMinutes: form.refreshIntervalMinutes,
                notifyOnNew: form.notifyOnNew,
                filters: makes.map((make) => ({
                    provider: 'otomoto',
                    name: make,
                    make,
                    ...(form.yearFrom ? { yearFrom: Number(form.yearFrom) } : {}),
                    ...(form.priceTo ? { priceTo: Number(form.priceTo) } : {}),
                    excludeDamaged: true,
                })),
            });
            onOpenChange(false);
            setForm({ ...form, name: '', description: '', makes: '' });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Nie udało się utworzyć grupy');
        }
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Nowa grupa filtr\u00F3w" }), _jsx(DialogDescription, { children: "Podaj marki po przecinku \u2014 dla ka\u017Cdej powstanie osobny filtr w tej grupie." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Nazwa grupy" }), _jsx(Input, { id: "name", required: true, placeholder: "Skandynawia i Japonia", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "makes", children: "Marki (po przecinku)" }), _jsx(Input, { id: "makes", placeholder: "Volvo, Toyota", value: form.makes, onChange: (e) => setForm({ ...form, makes: e.target.value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "yearFrom", children: "Rocznik od" }), _jsx(Input, { id: "yearFrom", type: "number", placeholder: "2018", value: form.yearFrom, onChange: (e) => setForm({ ...form, yearFrom: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "priceTo", children: "Cena do (z\u0142)" }), _jsx(Input, { id: "priceTo", type: "number", placeholder: "150000", value: form.priceTo, onChange: (e) => setForm({ ...form, priceTo: e.target.value }) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "description", children: "Opis" }), _jsx(Textarea, { id: "description", rows: 2, value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "interval", children: "Od\u015Bwie\u017Canie (min)" }), _jsx(Input, { id: "interval", type: "number", min: 15, value: form.refreshIntervalMinutes, onChange: (e) => setForm({
                                                ...form,
                                                refreshIntervalMinutes: Number(e.target.value),
                                            }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "color", children: "Kolor" }), _jsx(Input, { id: "color", type: "color", className: "h-9 p-1", value: form.color, onChange: (e) => setForm({ ...form, color: e.target.value }) })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg border px-3 py-2.5", children: [_jsx(Label, { htmlFor: "notify", className: "cursor-pointer", children: "Powiadamiaj o nowych ofertach" }), _jsx(Switch, { id: "notify", checked: form.notifyOnNew, onCheckedChange: (v) => setForm({ ...form, notifyOnNew: v }) })] }), error ? (_jsx("p", { className: "text-destructive text-sm", role: "alert", children: error })) : null, _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Anuluj" }), _jsxs(Button, { type: "submit", disabled: createGroup.isPending, children: [createGroup.isPending ? (_jsx(Loader2Icon, { className: "animate-spin" })) : null, "Utw\u00F3rz grup\u0119"] })] })] })] }) }));
}
