import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useRouterState } from '@tanstack/react-router';
import { BellIcon, CarFrontIcon, HeartIcon, LayoutDashboardIcon, ListFilterIcon, LogOutIcon, UserIcon, } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/queries';
import { cn } from '@/lib/utils';
const NAV_ITEMS = [
    { to: '/', label: 'Pulpit', icon: LayoutDashboardIcon, exact: true },
    { to: '/groups', label: 'Grupy filtrów', icon: ListFilterIcon, exact: false },
    { to: '/listings', label: 'Ogłoszenia', icon: CarFrontIcon, exact: false },
    { to: '/favorites', label: 'Ulubione', icon: HeartIcon, exact: false },
];
export function AppShell({ children }) {
    const { user, logout } = useAuth();
    const { data: unread } = useUnreadCount();
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const initials = user
        ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
        : '';
    return (_jsxs("div", { className: "min-h-dvh", children: [_jsx("header", { className: "bg-background/80 sticky top-0 z-40 border-b backdrop-blur", children: _jsxs("div", { className: "mx-auto flex h-14 max-w-7xl items-center gap-4 px-4", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-2 font-semibold", children: [_jsx("span", { className: "bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg", children: _jsx(CarFrontIcon, { className: "size-4" }) }), _jsx("span", { className: "hidden sm:inline", children: "Cars Fetcher" })] }), _jsx("nav", { className: "flex flex-1 items-center gap-1 overflow-x-auto", children: NAV_ITEMS.map((item) => {
                                const active = item.exact
                                    ? pathname === item.to
                                    : pathname.startsWith(item.to);
                                return (_jsx(Button, { asChild: true, variant: active ? 'secondary' : 'ghost', size: "sm", className: cn(active && 'font-semibold'), children: _jsxs(Link, { to: item.to, children: [_jsx(item.icon, {}), _jsx("span", { className: "hidden md:inline", children: item.label })] }) }, item.to));
                            }) }), _jsx(Button, { asChild: true, variant: "ghost", size: "icon", className: "relative", children: _jsxs(Link, { to: "/notifications", "aria-label": "Powiadomienia", children: [_jsx(BellIcon, {}), unread && unread.count > 0 ? (_jsx(Badge, { variant: "destructive", className: "absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]", children: unread.count > 99 ? '99+' : unread.count })) : null] }) }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "rounded-full", children: _jsx("span", { className: "bg-secondary grid size-8 place-items-center rounded-full text-xs font-semibold", children: initials || _jsx(UserIcon, { className: "size-4" }) }) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-56", children: [_jsx(DropdownMenuLabel, { children: _jsxs("div", { className: "flex flex-col", children: [_jsxs("span", { children: [user?.firstName, " ", user?.lastName] }), _jsx("span", { className: "text-muted-foreground text-xs font-normal", children: user?.email })] }) }), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuItem, { asChild: true, children: _jsxs(Link, { to: "/profile", children: [_jsx(UserIcon, {}), "Profil i ustawienia"] }) }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { variant: "destructive", onSelect: () => void logout(), children: [_jsx(LogOutIcon, {}), "Wyloguj si\u0119"] })] })] })] }) }), _jsx("main", { className: "mx-auto max-w-7xl px-4 py-8", children: children })] }));
}
