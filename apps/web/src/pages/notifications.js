import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangleIcon, BellIcon, CheckCheckIcon, SparklesIcon, TrendingDownIcon, XCircleIcon, } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { formatRelative } from '@/lib/format';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/lib/queries';
import { cn } from '@/lib/utils';
const ICONS = {
    new_listing: _jsx(SparklesIcon, {}),
    price_drop: _jsx(TrendingDownIcon, {}),
    price_raise: _jsx(TrendingDownIcon, { className: "rotate-180" }),
    listing_removed: _jsx(XCircleIcon, {}),
    fetch_failed: _jsx(AlertTriangleIcon, {}),
    digest: _jsx(BellIcon, {}),
};
export function NotificationsPage() {
    const notifications = useNotifications({ pageSize: 50 });
    const markAllRead = useMarkAllRead();
    const markRead = useMarkRead();
    const hasUnread = notifications.data?.items.some((n) => !n.readAt) ?? false;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Powiadomienia" }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Nowe oferty, spadki cen i b\u0142\u0119dy pobierania." })] }), hasUnread ? (_jsxs(Button, { variant: "outline", size: "sm", disabled: markAllRead.isPending, onClick: () => markAllRead.mutate(), children: [_jsx(CheckCheckIcon, {}), "Oznacz wszystkie jako przeczytane"] })) : null] }), notifications.isLoading ? (_jsx("div", { className: "space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx(Skeleton, { className: "h-20" }, i))) })) : notifications.data && notifications.data.items.length > 0 ? (_jsx("div", { className: "space-y-2", children: notifications.data.items.map((notification) => (_jsx(Card, { className: cn('transition-colors', !notification.readAt && 'border-primary/40 bg-primary/5'), children: _jsxs(CardContent, { className: "flex items-start gap-4 py-4", children: [_jsx("span", { className: cn('grid size-9 shrink-0 place-items-center rounded-lg [&>svg]:size-4', notification.type === 'fetch_failed'
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-secondary text-secondary-foreground'), children: ICONS[notification.type] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "font-medium", children: notification.title }), !notification.readAt ? (_jsx(Badge, { variant: "default", className: "text-[10px]", children: "Nowe" })) : null] }), notification.body ? (_jsx("p", { className: "text-muted-foreground text-sm", children: notification.body })) : null, _jsx("p", { className: "text-muted-foreground mt-1 text-xs", children: formatRelative(notification.createdAt) })] }), !notification.readAt ? (_jsx(Button, { size: "sm", variant: "ghost", onClick: () => markRead.mutate([notification.id]), children: "Przeczytane" })) : null] }) }, notification.id))) })) : (_jsx(EmptyState, { icon: _jsx(BellIcon, { className: "size-8" }), title: "Brak powiadomie\u0144", description: "Gdy pojawi\u0105 si\u0119 nowe oferty lub spadn\u0105 ceny, znajdziesz je tutaj." }))] }));
}
