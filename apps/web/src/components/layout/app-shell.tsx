import { Link, useRouterState } from '@tanstack/react-router';
import {
  CarFrontIcon,
  HeartIcon,
  LaptopIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  LogOutIcon,
  MoonIcon,
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

const NAV_ITEMS = [
  { to: '/', label: 'Pulpit', icon: LayoutDashboardIcon, exact: true },
  { to: '/groups', label: 'Grupy filtrów', icon: ListFilterIcon, exact: false },
  { to: '/listings', label: 'Ogłoszenia', icon: CarFrontIcon, exact: false },
  { to: '/favorites', label: 'Ulubione', icon: HeartIcon, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <div className="min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
              <CarFrontIcon className="size-4" />
            </span>
            <span className="font-display hidden tracking-tight sm:inline">Cars Fetcher</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname.startsWith(item.to);
              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(active && 'font-semibold')}
                >
                  <Link to={item.to}>
                    <item.icon />
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
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
