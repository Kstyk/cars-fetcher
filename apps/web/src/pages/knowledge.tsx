import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  GaugeIcon,
  Loader2Icon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  WrenchIcon,
  ZapIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useAuth } from '@/lib/auth';
import {
  BODY_LABELS,
  DRIVE_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  VEHICLE_ISSUE_SEVERITY_LABELS,
  VEHICLE_NOTE_KIND_LABELS,
  label,
} from '@/lib/format';
import {
  useGenerateKnowledge,
  useKnowledgeGenerateAvailable,
  useKnowledgeMakes,
  useKnowledgeModel,
  useKnowledgeModels,
  useKnowledgeSearch,
} from '@/lib/queries';
import type { VehicleIssueSeverity, VehicleModelSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

/** "2012-2019" / "od 2019" for a generation that is still in production. */
function yearRange(yearFrom: number | null, yearTo: number | null): string {
  if (yearFrom && yearTo) return `${yearFrom}–${yearTo}`;
  if (yearFrom) return `od ${yearFrom}`;
  if (yearTo) return `do ${yearTo}`;
  return '';
}

function SourceBadge({ source }: { source: 'manual' | 'ai_generated' }) {
  if (source !== 'ai_generated') return null;
  return (
    <Badge
      variant="outline"
      className="gap-1"
      title="Treść wygenerowana przez AI - traktuj jako podsumowanie ogólnej wiedzy, nie zweryfikowany fakt"
    >
      <SparklesIcon />
      AI
    </Badge>
  );
}

/* --------------------------------- browse --------------------------------- */

export function KnowledgePage() {
  const { user } = useAuth();
  const makes = useKnowledgeMakes();
  const [activeMake, setActiveMake] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);

  const make = activeMake ?? makes.data?.[0] ?? null;
  const models = useKnowledgeModels(query.trim().length < 2 ? make : null);
  const search = useKnowledgeSearch(query);

  const showingSearch = query.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Baza wiedzy</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Dane techniczne, znane usterki i opinie o modelach - niezależnie od tego, co akurat
            jest wystawione na sprzedaż.
          </p>
        </div>
        {user?.role === 'admin' ? (
          <Button variant="outline" onClick={() => setGenerateOpen(true)}>
            <SparklesIcon />
            Generuj nowy model
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Szukaj marki, modelu, generacji…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {showingSearch ? (
        <SearchResults results={search.data} loading={search.isLoading} />
      ) : (
        <>
          {makes.isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24" />
              ))}
            </div>
          ) : makes.data && makes.data.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {makes.data.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={m === make ? 'default' : 'outline'}
                  onClick={() => setActiveMake(m)}
                >
                  {m}
                </Button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpenIcon className="size-8" />}
              title="Baza wiedzy jest jeszcze pusta"
              description={
                user?.role === 'admin'
                  ? 'Uruchom `npm run knowledge:seed` albo wygeneruj pierwszy model przyciskiem powyżej.'
                  : 'Poproś administratora o wypełnienie bazy.'
              }
            />
          )}

          {models.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : models.data && models.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {models.data.map((m) => (
                <ModelCard key={m.id} model={m} />
              ))}
            </div>
          ) : make ? (
            <EmptyState
              title={`Brak generacji dla ${make}`}
              description="Ten model nie jest jeszcze opisany w bazie wiedzy."
            />
          ) : null}
        </>
      )}

      <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
    </div>
  );
}

function ModelCard({ model }: { model: VehicleModelSummary }) {
  return (
    <Link to="/wiedza/$modelId" params={{ modelId: model.id }}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {model.make} {model.model}
              </p>
              <p className="text-muted-foreground text-xs">
                {model.generation} · {yearRange(model.yearFrom, model.yearTo)}
              </p>
            </div>
            <SourceBadge source={model.source} />
          </div>
          {model.summary ? (
            <p className="text-muted-foreground line-clamp-2 text-xs">{model.summary}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(model.bodyTypes ?? []).map((bt) => (
              <Badge key={bt} variant="secondary" className="font-normal">
                {label(BODY_LABELS, bt)}
              </Badge>
            ))}
            <Badge variant="outline" className="gap-1 font-normal">
              <SettingsIcon />
              {model.engineCount}
            </Badge>
            {model.issueCount > 0 ? (
              <Badge variant="outline" className="gap-1 font-normal">
                <WrenchIcon />
                {model.issueCount}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SearchResults({
  results,
  loading,
}: {
  results: import('@/lib/types').VehicleSearchResult[] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (!results || results.length === 0) {
    return <EmptyState title="Brak wyników" description="Spróbuj innej frazy." />;
  }
  return (
    <div className="space-y-2">
      {results.map((r) => (
        <Link key={r.id} to="/wiedza/$modelId" params={{ modelId: r.id }}>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <p className="font-medium">
                {r.make} {r.model} <span className="text-muted-foreground">· {r.generation}</span>
              </p>
              <span className="data-figure text-muted-foreground text-xs">
                {yearRange(r.yearFrom, r.yearTo)}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const available = useKnowledgeGenerateAvailable();
  const generate = useGenerateKnowledge();
  const navigate = useNavigate();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [generation, setGeneration] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await generate.mutateAsync({
        make: make.trim(),
        model: model.trim(),
        generation: generation.trim() || undefined,
      });
      onOpenChange(false);
      setMake('');
      setModel('');
      setGeneration('');
      void navigate({ to: '/wiedza/$modelId', params: { modelId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wygenerować opisu');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generuj nowy model</DialogTitle>
          <DialogDescription>
            Poda się specyfikację, znane usterki i opinie na podstawie ogólnej wiedzy AI - to
            podsumowanie, nie zweryfikowany fakt. Zapytanie do Anthropic API kosztuje realne
            pieniądze.
          </DialogDescription>
        </DialogHeader>

        {available.data && !available.data.available ? (
          <p className="text-destructive text-sm">
            Generowanie wymaga ustawienia <code className="text-xs">ANTHROPIC_API_KEY</code> w
            konfiguracji serwera.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="k-make">Marka</Label>
                <Input
                  id="k-make"
                  required
                  placeholder="Volkswagen"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-model">Model</Label>
                <Input
                  id="k-model"
                  required
                  placeholder="Passat"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="k-gen">Generacja (opcjonalnie)</Label>
              <Input
                id="k-gen"
                placeholder="Zostaw puste, żeby AI wybrała najbardziej znaną"
                value={generation}
                onChange={(e) => setGeneration(e.target.value)}
              />
            </div>

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={generate.isPending}>
                {generate.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                {generate.isPending ? 'Generuję…' : 'Generuj'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- detail ---------------------------------- */

const SEVERITY_VARIANT: Record<VehicleIssueSeverity, 'secondary' | 'outline' | 'destructive'> = {
  minor: 'secondary',
  moderate: 'outline',
  serious: 'destructive',
};

export function KnowledgeModelPage() {
  const { modelId } = useParams({ from: '/protected-layout/wiedza/$modelId' });
  const detail = useKnowledgeModel(modelId);

  const notesByKind = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const note of detail.data?.notes ?? []) {
      const bucket = map.get(note.kind) ?? [];
      bucket.push(note.body);
      map.set(note.kind, bucket);
    }
    return map;
  }, [detail.data]);

  if (detail.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!detail.data) {
    return (
      <EmptyState
        title="Nie znaleziono modelu"
        action={
          <Button asChild variant="outline">
            <Link to="/wiedza">Wróć do bazy wiedzy</Link>
          </Button>
        }
      />
    );
  }

  const m = detail.data;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/wiedza">
          <ArrowLeftIcon />
          Baza wiedzy
        </Link>
      </Button>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">
            {m.make} {m.model}
          </h1>
          <Badge variant="secondary">{m.generation}</Badge>
          <SourceBadge source={m.source} />
        </div>
        <p className="text-muted-foreground text-sm">{yearRange(m.yearFrom, m.yearTo)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(m.bodyTypes ?? []).map((bt) => (
            <Badge key={bt} variant="outline" className="font-normal">
              {label(BODY_LABELS, bt)}
            </Badge>
          ))}
        </div>
        {m.summary ? <p className="mt-3 max-w-3xl text-sm">{m.summary}</p> : null}
      </div>

      {m.engines.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Silniki</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground bg-muted/40 text-left text-xs">
                <tr className="border-b">
                  <th className="py-2 pr-4 pl-4 font-medium">Wersja</th>
                  <th className="py-2 pr-4 font-medium">Paliwo</th>
                  <th className="py-2 pr-4 text-right font-medium">Moc</th>
                  <th className="py-2 pr-4 text-right font-medium">Moment</th>
                  <th className="py-2 pr-4 font-medium">Skrzynia</th>
                  <th className="py-2 pr-4 font-medium">Napęd</th>
                  <th className="py-2 pr-4 text-right font-medium">0-100</th>
                  <th className="py-2 pr-4 text-right font-medium">V max</th>
                  <th className="py-2 pr-4 text-right font-medium">Spalanie</th>
                </tr>
              </thead>
              <tbody>
                {m.engines.map((engine) => (
                  <tr key={engine.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 pl-4">
                      <p className="font-medium">{engine.name}</p>
                      {engine.engineCode ? (
                        <p className="text-muted-foreground text-xs">{engine.engineCode}</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      {engine.fuelType ? label(FUEL_LABELS, engine.fuelType) : '—'}
                    </td>
                    <td className="data-figure py-2 pr-4 text-right">
                      {engine.powerHp ? `${engine.powerHp} KM` : '—'}
                    </td>
                    <td className="data-figure py-2 pr-4 text-right">
                      {engine.torqueNm ? `${engine.torqueNm} Nm` : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {engine.gearbox ? label(GEARBOX_LABELS, engine.gearbox) : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {engine.driveType ? label(DRIVE_LABELS, engine.driveType) : '—'}
                    </td>
                    <td className="data-figure py-2 pr-4 text-right">
                      {engine.acceleration0To100 ? `${engine.acceleration0To100} s` : '—'}
                    </td>
                    <td className="data-figure py-2 pr-4 text-right">
                      {engine.topSpeedKmh ? `${engine.topSpeedKmh} km/h` : '—'}
                    </td>
                    <td className="data-figure py-2 pr-4 text-right">
                      {engine.fuelConsumptionCombined
                        ? `${engine.fuelConsumptionCombined} l/100km`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {m.knownIssues.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <WrenchIcon className="size-5" />
            Znane usterki
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {m.knownIssues.map((issue) => (
              <Card key={issue.id}>
                <CardContent className="space-y-1.5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{issue.title}</p>
                    <Badge variant={SEVERITY_VARIANT[issue.severity]} className="text-[10px]">
                      {label(VEHICLE_ISSUE_SEVERITY_LABELS, issue.severity)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{issue.description}</p>
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 pt-1 text-xs">
                    {issue.mileageHint ? (
                      <span className="flex items-center gap-1">
                        <GaugeIcon className="size-3" />
                        {issue.mileageHint}
                      </span>
                    ) : null}
                    {issue.engineId ? (
                      <span className="flex items-center gap-1">
                        <ZapIcon className="size-3" />
                        {m.engines.find((e) => e.id === issue.engineId)?.name ?? 'wybrany silnik'}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {notesByKind.size > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Opinie i doświadczenia</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...notesByKind.entries()].map(([kind, bodies]) => (
              <Card key={kind}>
                <CardContent className={cn('space-y-2 py-4')}>
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {label(VEHICLE_NOTE_KIND_LABELS, kind)}
                  </p>
                  {bodies.map((body, i) => (
                    <p key={i} className="text-sm">
                      {body}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
