import {
  CarFrontIcon,
  ListFilterIcon,
  RadioIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import {
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  formatDateTime,
  formatRelative,
  label,
} from '@/lib/format';
import {
  useAdminRuns,
  useAdminScrapers,
  useAdminStats,
  useAdminUsers,
  useResetScraperCircuit,
  useUpdateAdminUser,
} from '@/lib/queries';
import type { AdminUser } from '@/lib/types';

export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel admina</h1>
        <p className="text-muted-foreground text-sm">
          Konta, stan scraperów i historia pobrań w całej instalacji.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="users">Użytkownicy</TabsTrigger>
          <TabsTrigger value="scrapers">Scrapery</TabsTrigger>
          <TabsTrigger value="runs">Historia pobrań</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users" className="pt-6">
          <UsersTab />
        </TabsContent>
        <TabsContent value="scrapers" className="pt-6">
          <ScrapersTab />
        </TabsContent>
        <TabsContent value="runs" className="pt-6">
          <RunsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  const stats = useAdminStats();

  if (stats.isLoading || !stats.data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const { users, listings, groups, byProvider, scheduler } = stats.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<UsersIcon />}
          label="Użytkownicy"
          value={String(users.total)}
          hint={`${users.active} aktywnych · ${users.admins} adminów`}
        />
        <StatTile
          icon={<CarFrontIcon />}
          label="Ogłoszenia"
          value={String(listings.total)}
          hint={`${listings.active} aktywnych · ${listings.archived} sprzedanych`}
        />
        <StatTile icon={<ListFilterIcon />} label="Grupy filtrów" value={String(groups.total)} />
        <StatTile
          icon={<RadioIcon />}
          label="Harmonogram"
          value={scheduler.enabled ? 'Włączony' : 'Wyłączony'}
          hint={scheduler.cron}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ogłoszenia wg serwisu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {byProvider.map((row) => (
            <Badge
              key={row.provider}
              className="border-transparent text-white"
              style={{ backgroundColor: PROVIDER_COLORS[row.provider] ?? '#475569' }}
            >
              {label(PROVIDER_LABELS, row.provider)}: {row.total}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-lg [&>svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="data-figure truncate text-xl font-semibold">{value}</p>
          {hint ? <p className="text-muted-foreground truncate text-xs">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const users = useAdminUsers();
  const update = useUpdateAdminUser();

  if (users.isLoading) return <Skeleton className="h-96" />;
  if (!users.data?.length) return null;

  function toggleActive(user: AdminUser) {
    const verb = user.isActive ? 'zablokować' : 'odblokować';
    if (!window.confirm(`Na pewno ${verb} konto ${user.email}?`)) return;
    update.mutate({ id: user.id, patch: { isActive: !user.isActive } });
  }

  function toggleRole(user: AdminUser) {
    const next = user.role === 'admin' ? 'user' : 'admin';
    const verb = next === 'admin' ? 'nadać rolę admina' : 'odebrać rolę admina';
    if (!window.confirm(`Na pewno ${verb} kontu ${user.email}?`)) return;
    update.mutate({ id: user.id, patch: { role: next } });
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr className="border-b">
              <th className="py-2 pr-4 font-medium">Konto</th>
              <th className="py-2 pr-4 font-medium">Rola</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 text-right font-medium">Grupy</th>
              <th className="py-2 pr-4 text-right font-medium">Ulubione</th>
              <th className="py-2 pr-4 font-medium">Ostatnie logowanie</th>
              <th className="py-2 text-right font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <p className="font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-muted-foreground text-xs">{user.email}</p>
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role === 'admin' ? 'Admin' : 'Użytkownik'}
                  </Badge>
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={user.isActive ? 'success' : 'destructive'}>
                    {user.isActive ? 'Aktywne' : 'Zablokowane'}
                  </Badge>
                  {!user.emailVerifiedAt ? (
                    <span className="text-muted-foreground ml-1.5 text-xs">niezweryfikowany</span>
                  ) : null}
                </td>
                <td className="data-figure py-2 pr-4 text-right">{user.groupCount}</td>
                <td className="data-figure py-2 pr-4 text-right">{user.favoriteCount}</td>
                <td className="data-figure py-2 pr-4 whitespace-nowrap">
                  {user.lastLoginAt ? formatRelative(user.lastLoginAt) : '—'}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={update.isPending}
                    onClick={() => toggleRole(user)}
                  >
                    {user.role === 'admin' ? 'Odbierz admina' : 'Nadaj admina'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={update.isPending}
                    onClick={() => toggleActive(user)}
                  >
                    {user.isActive ? 'Zablokuj' : 'Odblokuj'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ScrapersTab() {
  const scrapers = useAdminScrapers();
  const reset = useResetScraperCircuit();

  if (scrapers.isLoading || !scrapers.data) return <Skeleton className="h-96" />;

  const { providers, circuits } = scrapers.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dostawcy</CardTitle>
          <CardDescription>Stan adapterów zarejestrowanych w aplikacji.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th className="py-2 pr-4 font-medium">Serwis</th>
                <th className="py-2 pr-4 font-medium">Zaimplementowany</th>
                <th className="py-2 pr-4 font-medium">Skonfigurowany</th>
                <th className="py-2 font-medium">Tryb</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.provider} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Badge
                      className="border-transparent text-white"
                      style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? '#475569' }}
                    >
                      {p.label}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={p.implemented ? 'success' : 'secondary'}>
                      {p.implemented ? 'Tak' : 'Wkrótce'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={p.configured ? 'success' : 'secondary'}>
                      {p.configured ? 'Tak' : 'Nie'}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground py-2">{p.mode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Przełącznik (circuit breaker)</CardTitle>
          <CardDescription>
            Hosty, które ostatnio odrzuciły żądania - po 3 kolejnych 403 dalsze próby są
            wstrzymywane na kilka godzin.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {circuits.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Żaden host nie jest obecnie wstrzymany.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Host</th>
                  <th className="py-2 pr-4 text-right font-medium">Kolejne 403</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {circuits.map((c) => (
                  <tr key={c.host} className="border-b last:border-0">
                    <td className="data-figure py-2 pr-4">{c.host}</td>
                    <td className="data-figure py-2 pr-4 text-right">{c.streak}</td>
                    <td className="py-2 pr-4">
                      {c.blocked ? (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlertIcon />
                          Wstrzymany do {c.openUntil ? formatDateTime(new Date(c.openUntil)) : '—'}
                        </Badge>
                      ) : (
                        <Badge variant="success" className="gap-1">
                          <ShieldCheckIcon />
                          OK
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reset.isPending}
                        onClick={() => reset.mutate(c.host)}
                      >
                        Resetuj
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RunsTab() {
  const runs = useAdminRuns(50);

  if (runs.isLoading) return <Skeleton className="h-96" />;
  if (!runs.data?.length) {
    return <p className="text-muted-foreground text-sm">Brak historii pobrań.</p>;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr className="border-b">
              <th className="py-2 pr-4 font-medium">Start</th>
              <th className="py-2 pr-4 font-medium">Właściciel</th>
              <th className="py-2 pr-4 font-medium">Grupa / filtr</th>
              <th className="py-2 pr-4 font-medium">Serwis</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 text-right font-medium">Nowe</th>
              <th className="py-2 text-right font-medium">Czas</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.map((run) => (
              <tr key={run.id} className="border-b last:border-0">
                <td className="data-figure py-2 pr-4 whitespace-nowrap">
                  {formatDateTime(run.startedAt)}
                </td>
                <td className="text-muted-foreground py-2 pr-4">{run.ownerEmail ?? '—'}</td>
                <td className="py-2 pr-4">
                  {run.groupName ?? '—'} ·{' '}
                  {run.filterName ?? [run.filterMake, run.filterModel].filter(Boolean).join(' ')}
                </td>
                <td className="py-2 pr-4">
                  <Badge
                    className="border-transparent text-white"
                    style={{ backgroundColor: PROVIDER_COLORS[run.provider] ?? '#475569' }}
                  >
                    {label(PROVIDER_LABELS, run.provider)}
                  </Badge>
                </td>
                <td className="py-2 pr-4">
                  <Badge
                    variant={
                      run.status === 'success'
                        ? 'success'
                        : run.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                    title={run.errorMessage ?? undefined}
                  >
                    {run.status}
                  </Badge>
                </td>
                <td className="data-figure py-2 pr-4 text-right">{run.itemsNew}</td>
                <td className="data-figure text-muted-foreground py-2 text-right">
                  {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)} s` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
