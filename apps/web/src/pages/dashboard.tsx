import { Link } from '@tanstack/react-router';
import {
  ArchiveIcon,
  CarFrontIcon,
  ListFilterIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  WalletIcon,
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
import { EmptyState } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { ListingCard } from '@/components/listing-card';
import { formatPrice, formatRelative } from '@/lib/format';
import { useFetchGroup, useFilterGroups, useListingStats, useListings } from '@/lib/queries';

export function DashboardPage() {
  const groups = useFilterGroups();
  const stats = useListingStats();
  const latest = useListings({ pageSize: 6, sort: 'newest' });
  const fetchGroup = useFetchGroup();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pulpit</h1>
          <p className="text-muted-foreground text-sm">
            Przegląd Twoich grup filtrów i najświeższych ofert.
          </p>
        </div>
        <Button asChild>
          <Link to="/groups">
            <PlusIcon />
            Zarządzaj grupami
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CarFrontIcon />}
          label="Aktywne ogłoszenia"
          value={stats.data ? String(stats.data.active) : undefined}
        />
        <StatCard
          icon={<SparklesIcon />}
          label="Nowe (24 h)"
          value={stats.data ? String(stats.data.fresh24h) : undefined}
        />
        <StatCard
          icon={<WalletIcon />}
          label="Średnia cena"
          value={stats.data ? formatPrice(stats.data.avgPrice) : undefined}
        />
        <StatCard
          icon={<ArchiveIcon />}
          label="Sprzedane"
          value={stats.data ? String(stats.data.archived) : undefined}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Grupy filtrów</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/groups">Wszystkie</Link>
          </Button>
        </div>

        {groups.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : groups.data && groups.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.data.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: group.color ?? 'var(--primary)' }}
                        />
                        <Link
                          to="/groups/$groupId"
                          params={{ groupId: group.id }}
                          className="truncate hover:underline"
                        >
                          {group.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="truncate">
                        {group.description ?? 'Brak opisu'}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fetchGroup.isPending}
                      onClick={() => fetchGroup.mutate(group.id)}
                    >
                      <RefreshCwIcon
                        className={
                          fetchGroup.isPending && fetchGroup.variables === group.id
                            ? 'animate-spin'
                            : undefined
                        }
                      />
                      Pobierz
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">
                      {group.filters.length} filtrów
                    </Badge>
                    <Badge variant="outline">{group.listingCount} ofert</Badge>
                    {group.newListingCount > 0 ? (
                      <Badge variant="success">
                        +{group.newListingCount} nowych
                      </Badge>
                    ) : null}
                    {!group.isActive ? (
                      <Badge variant="outline">Wstrzymana</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-3 text-xs">
                    Ostatnie pobranie: {formatRelative(group.lastFetchedAt)} · co{' '}
                    {group.refreshIntervalMinutes} min
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ListFilterIcon className="size-8" />}
            title="Nie masz jeszcze żadnej grupy filtrów"
            description="Grupa to zestaw wyszukiwań, np. Volvo + Toyota w jednej, a Mazda + Kia w drugiej."
            action={
              <Button asChild>
                <Link to="/groups">
                  <PlusIcon />
                  Utwórz pierwszą grupę
                </Link>
              </Button>
            }
          />
        )}
      </section>

      {stats.data && stats.data.soldByModel.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Sprzedaż wg modelu</h2>
            <p className="text-muted-foreground text-sm">
              Ogłoszenie, które zniknęło z serwisu, liczymy jako sprzedane. Modele z jedną ofertą
              są pominięte. Kliknij liczbę sprzedanych, żeby zobaczyć konkretne ogłoszenia - ta
              liczba jest historią i nie kurczy się, gdy później zmienisz kryteria filtra.
            </p>
          </div>

          <Card>
            <CardContent className="overflow-x-auto py-4">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-medium">Model</th>
                    <th className="py-2 pr-4 text-right font-medium">Ogłoszeń</th>
                    <th className="py-2 pr-4 text-right font-medium">Sprzedanych</th>
                    <th className="py-2 pr-4 text-right font-medium">Udział</th>
                    <th className="py-2 pr-4 text-right font-medium">Śr. cena</th>
                    <th className="py-2 text-right font-medium">Mediana dni</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.soldByModel.map((row) => {
                    const share = row.total > 0 ? (row.sold / row.total) * 100 : 0;
                    return (
                      <tr
                        key={`${row.make}-${row.model}`}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-4">
                          {[row.make, row.model].filter(Boolean).join(' ')}
                        </td>
                        <td className="data-figure py-2 pr-4 text-right">{row.total}</td>
                        <td className="data-figure py-2 pr-4 text-right">
                          {row.sold > 0 ? (
                            <Link
                              to="/listings"
                              search={{
                                make: row.make ?? undefined,
                                model: row.model ?? undefined,
                                archived: 'yes',
                              }}
                              className="hover:underline"
                              title="Zobacz konkretne sprzedane ogłoszenia"
                            >
                              {row.sold}
                            </Link>
                          ) : (
                            row.sold
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* A bar reads faster than a bare percentage. */}
                            <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                              <span
                                className="bg-primary block h-full rounded-full"
                                style={{ width: `${Math.min(100, share)}%` }}
                              />
                            </span>
                            <span className="data-figure w-10">{share.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="data-figure py-2 pr-4 text-right">
                          {row.avgSoldPrice ? formatPrice(row.avgSoldPrice) : '—'}
                        </td>
                        <td className="data-figure py-2 text-right">
                          {row.medianDaysToSell ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Najnowsze oferty</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/listings">Wszystkie ogłoszenia</Link>
          </Button>
        </div>

        {latest.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : latest.data && latest.data.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.data.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CarFrontIcon className="size-8" />}
            title="Brak ofert"
            description="Uruchom pobieranie w jednej z grup filtrów, aby zobaczyć wyniki."
          />
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-lg [&>svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          {value === undefined ? (
            <Skeleton className="mt-1 h-6 w-20" />
          ) : (
            <p className="data-figure truncate text-xl font-semibold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
