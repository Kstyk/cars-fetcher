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
import { DashboardPage } from '@/pages/dashboard';
import { FavoritesPage } from '@/pages/favorites';
import { GroupDetailPage } from '@/pages/group-detail';
import { GroupsPage } from '@/pages/groups';
import { ListingsPage } from '@/pages/listings';
import { LoginPage, RegisterPage } from '@/pages/login';
import { NotificationsPage } from '@/pages/notifications';
import { ProfilePage } from '@/pages/profile';

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

const listingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/listings',
  component: ListingsPage,
});

const favoritesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/favorites',
  component: FavoritesPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/profile',
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([loginRoute, registerRoute]),
  protectedLayoutRoute.addChildren([
    dashboardRoute,
    groupsRoute,
    groupDetailRoute,
    listingsRoute,
    favoritesRoute,
    notificationsRoute,
    profileRoute,
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
