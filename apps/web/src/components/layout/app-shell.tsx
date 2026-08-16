import { Link, useRouterState } from '@tanstack/react-router';
import {
  BookOpenIcon,
  CarFrontIcon,
  ChevronDownIcon,
  FingerprintIcon,
  GaugeIcon,
  HeartIcon,
  HistoryIcon,
  LaptopIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  LogOutIcon,
  MoonIcon,
  MoreHorizontalIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CompareTray } from '@/components/compare-tray';
import { NotificationBell } from '@/components/notification-bell';
import { useAuth } from '@/lib/auth';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Kept short on purpose - each one is a full-width button in the top bar, so
 * this list is a hard budget, not a wishlist. Anything past the core daily
 * workflow (dashboard, groups, listings, favourites) belongs in `MORE_NAV_ITEMS`
 * instead of growing this array - that is exactly how the bar ended up
 * overflowing on wide screens before this split (8 flat items never fit
 * `max-w-7xl` next to the logo and the avatar menu, no matter how wide the
 * monitor - the header's own content width was capped, not the viewport).
 */
const PRIMARY_NAV_ITEMS = [
  { to: '/', label: 'Pulpit', icon: LayoutDashboardIcon, exact: true },
  { to: '/groups', label: 'Grupy filtrów', icon: ListFilterIcon, exact: false },
  { to: '/listings', label: 'Ogłoszenia', icon: CarFrontIcon, exact: false },
  { to: '/favorites', label: 'Ulubione', icon: HeartIcon, exact: false },
] as const;

/** Everything else - tucked behind the "Więcej" dropdown so the bar has room to breathe. */
const MORE_NAV_ITEMS = [
  { to: '/recently-viewed', label: 'Ostatnio oglądane', icon: HistoryIcon },
  { to: '/wiedza', label: 'Baza wiedzy', icon: BookOpenIcon },
  { to: '/vin', label: 'Sprawdź VIN', icon: FingerprintIcon },
  { to: '/statystyki', label: 'Statystyki filtrów', icon: GaugeIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '';

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);
  const moreActive = MORE_NAV_ITEMS.some((item) => isActive(item.to, false));

  return (
    <div className="min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        {/* `min-w-0` on the flex-1 nav below matters here - without it, a flex
            item's default min-width is its own unwrapped content, which would
            force this whole row wider than `max-w-7xl` and scroll the page
            itself instead of just the (now unused) nav overflow. */}
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
              <CarFrontIcon className="size-4" />
            </span>
            <span className="font-display hidden tracking-tight sm:inline">Cars Fetcher</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isActive(item.to, item.exact);
              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn('shrink-0', active && 'font-semibold')}
                >
                  <Link to={item.to}>
                    <item.icon />
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={moreActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn('shrink-0', moreActive && 'font-semibold')}
                >
                  <MoreHorizontalIcon />
                  <span className="hidden md:inline">Więcej</span>
                  <ChevronDownIcon className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {MORE_NAV_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>
                      <item.icon />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <ThemeToggle />

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span className="bg-secondary grid size-8 place-items-center rounded-full text-xs font-semibold">
                  {initials || <UserIcon className="size-4" />}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <UserIcon />
                  Profil i ustawienia
                </Link>
              </DropdownMenuItem>
              {user?.role === 'admin' ? (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <ShieldIcon />
                    Panel admina
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
                <LogOutIcon />
                Wyloguj się
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 pb-24">{children}</main>

      <CompareTray />
    </div>
  );
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof SunIcon }> = [
  { value: 'light', label: 'Jasny', icon: SunIcon },
  { value: 'dark', label: 'Ciemny', icon: MoonIcon },
  { value: 'system', label: 'Systemowy', icon: LaptopIcon },
];

function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Zmień motyw">
          {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            className={cn(theme === option.value && 'bg-accent/60')}
          >
            <option.icon />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
