import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { useAuth } from '@/lib/auth';
import { AdminPage } from '@/pages/admin';
import { DashboardPage } from '@/pages/dashboard';
import { FavoritesPage } from '@/pages/favorites';
import { GroupDetailPage } from '@/pages/group-detail';
import { GroupsPage } from '@/pages/groups';
import { KnowledgeModelPage, KnowledgePage } from '@/pages/knowledge';
import { ListingsPage } from '@/pages/listings';
import { LoginPage, RegisterPage } from '@/pages/login';
import { NotificationsPage } from '@/pages/notifications';
import { ProfilePage } from '@/pages/profile';
import { RecentlyViewedPage } from '@/pages/recently-viewed';
import { UsageStatsPage } from '@/pages/usage-stats';
import { VerifyEmailPage } from '@/pages/verify-email';
import { VinPage } from '@/pages/vin';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  errorComponent: ({ error, reset }) => (
    <div className="grid min-h-dvh place-items-center p-8">
      <EmptyState
        title="Coś poszło nie tak"
        description={error instanceof Error ? error.message : String(error)}
        action={
          <Button onClick={reset} variant="outline">
            Spróbuj ponownie
          </Button>
        }
      />
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center p-8">
      <EmptyState
        title="Nie znaleziono strony"
        description="Adres, który otworzyłeś, nie istnieje."
        action={
          <Button asChild>
            <a href="/">Wróć na pulpit</a>
          </Button>
        }
      />
    </div>
  ),
});

/** Public shell - redirects away once a session exists. */
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth-layout',
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/register',
  component: RegisterPage,
});

/**
 * Off the root, not the auth/protected layouts: a verification link must work
 * regardless of whether the browser currently holds a session.
 */
const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify-email',
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: VerifyEmailPage,
});

/**
 * Everything below requires a session. The gate lives in the component rather
 * than `beforeLoad`, because the session is restored asynchronously on boot
 * (the refresh cookie outlives the access token) and the router would evaluate
 * `beforeLoad` before that resolves.
 */
const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected-layout',
  component: ProtectedShell,
});

function ProtectedShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  // `throw redirect()` only works inside beforeLoad/loaders - during render it
  // escapes to the error boundary, so navigate declaratively instead.
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/',
  component: DashboardPage,
});

const groupsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/groups',
  component: GroupsPage,
});

const groupDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/groups/$groupId',
  component: GroupDetailPage,
});

/**
 * Listing filters live in the URL so a search can be bookmarked, shared and
 * survives a refresh. Only non-empty values are serialised, which keeps the
 * address bar readable.
 */
export interface ListingsSearch {
  q?: string;
  groupId?: string;
  provider?: string[];
  make?: string;
  model?: string;
  fuelType?: string;
  gearbox?: string;
  bodyType?: string;
  color?: string[];
  countryOrigin?: string[];
  priceFrom?: number;
  priceTo?: number;
  yearFrom?: number;
  mileageTo?: number;
  powerFrom?: number;
  region?: string[];
  city?: string;
  radiusKm?: number;
  lat?: number;
  lon?: number;
  sort?: string;
  page?: number;
  /** 'no' (default) hides sold cars, 'yes' shows only them, 'all' both. */
  archived?: string;
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const asNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed)
    ? parsed
    : undefined;
};

const asStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const list = value.filter((entry): entry is string => typeof entry === 'string');
    return list.length ? list : undefined;
  }
  if (typeof value === 'string' && value !== '') return value.split(',');
  return undefined;
};

const listingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/listings',
  validateSearch: (search: Record<string, unknown>): ListingsSearch => ({
    q: asString(search.q),
    groupId: asString(search.groupId),
    provider: asStringArray(search.provider),
    make: asString(search.make),
    model: asString(search.model),
    fuelType: asString(search.fuelType),
    gearbox: asString(search.gearbox),
    bodyType: asString(search.bodyType),
    color: asStringArray(search.color),
    countryOrigin: asStringArray(search.countryOrigin),
    priceFrom: asNumber(search.priceFrom),
    priceTo: asNumber(search.priceTo),
    yearFrom: asNumber(search.yearFrom),
    mileageTo: asNumber(search.mileageTo),
    powerFrom: asNumber(search.powerFrom),
    region: asStringArray(search.region),
    city: asString(search.city),
    radiusKm: asNumber(search.radiusKm),
    lat: asNumber(search.lat),
    lon: asNumber(search.lon),
    sort: asString(search.sort),
    archived: asString(search.archived),
    page: asNumber(search.page),
  }),
  component: ListingsPage,
});

const favoritesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/favorites',
  component: FavoritesPage,
});

const recentlyViewedRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/recently-viewed',
  component: RecentlyViewedPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const knowledgeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/wiedza',
  component: KnowledgePage,
});

const knowledgeModelRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/wiedza/$modelId',
  component: KnowledgeModelPage,
});

const vinRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/vin',
  validateSearch: (search: Record<string, unknown>): { vin?: string } => ({
    vin: typeof search.vin === 'string' ? search.vin : undefined,
  }),
  component: VinPage,
});

const usageStatsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/statystyki',
  component: UsageStatsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/profile',
  component: ProfilePage,
});

/**
 * `protectedLayoutRoute` already guarantees a signed-in user by the time this
 * renders - only the role is left to check. Same declarative-redirect
 * reasoning as `ProtectedShell`: no `beforeLoad` because the session resolves
 * asynchronously.
 */
function AdminGuard() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <AdminPage />;
}

const adminRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/admin',
  component: AdminGuard,
});

const routeTree = rootRoute.addChildren([
  verifyEmailRoute,
  authLayoutRoute.addChildren([loginRoute, registerRoute]),
  protectedLayoutRoute.addChildren([
    dashboardRoute,
    groupsRoute,
    groupDetailRoute,
    listingsRoute,
    favoritesRoute,
    recentlyViewedRoute,
    notificationsRoute,
    knowledgeRoute,
    knowledgeModelRoute,
    vinRoute,
    usageStatsRoute,
    profileRoute,
    adminRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
