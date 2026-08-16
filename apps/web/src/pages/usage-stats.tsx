import { Link } from '@tanstack/react-router';
import { AlertTriangleIcon, ExternalLinkIcon, GaugeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { PROVIDER_LABELS, formatDateTime, label } from '@/lib/format';
import { useFilterUsageStats } from '@/lib/queries';
import type { FilterUsageStat } from '@/lib/types';

/** Dead filters first (most actionable), then the stalest of the rest. */
function sortStats(stats: FilterUsageStat[]): FilterUsageStat[] {
  return [...stats].sort((a, b) => {
    if (a.isDead !== b.isDead) return a.isDead ? -1 : 1;
    const aDays = a.daysSinceLastNewMatch ?? Infinity;
    const bDays = b.daysSinceLastNewMatch ?? Infinity;
    return bDays - aDays;
  });
}

export function UsageStatsPage() {
  const stats = useFilterUsageStats();
  const sorted = stats.data ? sortStats(stats.data) : [];
  const deadCount = sorted.filter((s) => s.isDead).length;
  const totalViews = sorted.reduce((sum, s) => sum + s.totalViews, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Statystyki filtrów</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Które filtry realnie coś znajdują i klikasz w wyniki, a które od tygodni nie wnoszą nic
          nowego - across wszystkich Twoich grup.
        </p>
      </div>

      {stats.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<GaugeIcon className="size-8" />}
          title="Brak filtrów"
          description="Dodaj filtr w którejś z grup, żeby zobaczyć tu statystyki."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Filtrów łącznie" value={String(sorted.length)} />
            <StatTile
              label="Bez nowych wyników 3+ tyg."
              value={String(deadCount)}
              warn={deadCount > 0}
            />
            <StatTile label="Kliknięć w oferty łącznie" value={String(totalViews)} />
          </div>

          {deadCount > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed px-3 py-2.5">
              <AlertTriangleIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p className="text-muted-foreground text-xs">
                {deadCount} {deadCount === 1 ? 'filtr' : 'filtrów'} nie znalazł żadnej nowej oferty
                od ponad 3 tygodni - może kryteria są zbyt wąskie, może grupa jest wstrzymana,
                może po prostu nic takiego się nie sprzedaje. Warto zajrzeć i poluzować albo
                usunąć.
              </p>
            </div>
          ) : null}

          <Card>
            <CardContent className="overflow-x-auto pt-4">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-medium">Grupa</th>
                    <th className="py-2 pr-4 font-medium">Filtr</th>
                    <th className="py-2 pr-4 font-medium">Serwis</th>
                    <th className="py-2 pr-4 text-right font-medium">Dopasowania</th>
                    <th className="py-2 pr-4 text-right font-medium">Kliknięcia</th>
                    <th className="py-2 pr-4 font-medium">Ostatnie nowe</th>
                    <th className="py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.filterId} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          to="/groups/$groupId"
                          params={{ groupId: s.groupId }}
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: s.groupColor ?? 'var(--primary)' }}
                          />
                          {s.groupName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        {s.filterName ?? ([s.make, s.model].filter(Boolean).join(' ') || 'Filtr')}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{label(PROVIDER_LABELS, s.provider)}</Badge>
                      </td>
                      <td className="data-figure py-2 pr-4 text-right">
                        {s.activeMatches}
                        <span className="text-muted-foreground"> / {s.totalMatches}</span>
                      </td>
                      <td className="data-figure py-2 pr-4 text-right">
                        {s.totalViews > 0 ? (
                          s.totalViews
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                        {s.lastNewMatchAt ? formatDateTime(s.lastNewMatchAt) : 'nigdy'}
                      </td>
                      <td className="py-2 text-right">
                        {s.isDead ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangleIcon />
                            Martwy
                          </Badge>
                        ) : (
                          <Badge variant="success">Aktywny</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-xs">
            "Dopasowania" = aktywne / wszystkie ogłoszenia jakie ten filtr kiedykolwiek znalazł.
            "Kliknięcia" liczą tylko Twoje wejścia w{' '}
            <Link to="/listings" className="underline">
              <ExternalLinkIcon className="inline size-3" /> Oferta
            </Link>{' '}
            na karcie ogłoszenia.
          </p>
        </>
      )}
    </div>
  );
}

function StatTile({
  label: text,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-muted-foreground text-xs">{text}</p>
        <p className={`data-figure text-xl font-semibold ${warn ? 'text-destructive' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
