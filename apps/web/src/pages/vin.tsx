import { useSearch } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  CarFrontIcon,
  CheckCircle2Icon,
  ClipboardIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  HelpCircleIcon,
  Loader2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import {
  useDecodeVin,
  useFetchVehicleHistory,
  useVehicleHistoryAvailable,
} from '@/lib/queries';
import type { NhtsaEnrichment } from '@/lib/types';

const CEPIK_URL = 'https://historiapojazdu.gov.pl/';

/**
 * NHTSA's raw `DisplacementL` is a straight cubic-inches-to-litres
 * conversion with float artefacts (e.g. "2.998832712") - round it to the one
 * decimal place people actually mean when they say "2.0 l" or "3.0 l".
 */
function formatNhtsaValue(key: keyof NhtsaEnrichment, value: string | null | undefined): string {
  if (!value) return '—';
  if (key === 'displacementL') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(1) : value;
  }
  return value;
}

/** NHTSA's own field names, shown only when it actually returned something for them. */
const NHTSA_FIELDS: Array<{ key: keyof NhtsaEnrichment; label: string }> = [
  { key: 'make', label: 'Marka' },
  { key: 'model', label: 'Model' },
  { key: 'modelYear', label: 'Rocznik' },
  { key: 'series', label: 'Seria' },
  { key: 'trim', label: 'Wersja wyposażenia' },
  { key: 'bodyClass', label: 'Nadwozie' },
  { key: 'doors', label: 'Liczba drzwi' },
  { key: 'engineCylinders', label: 'Cylindry' },
  { key: 'engineHp', label: 'Moc (KM)' },
  { key: 'displacementL', label: 'Pojemność (l)' },
  { key: 'fuelTypePrimary', label: 'Paliwo' },
  { key: 'driveType', label: 'Napęd' },
  { key: 'transmissionStyle', label: 'Skrzynia' },
  { key: 'transmissionSpeeds', label: 'Liczba biegów' },
  { key: 'plantCountry', label: 'Kraj produkcji' },
  { key: 'plantCity', label: 'Miasto produkcji (fabryka)' },
];

/**
 * The only kind of "equipment" a free VIN decode can actually answer for -
 * NHTSA collects these because US safety regulation requires manufacturers
 * to report them. Comfort/luxury options (leather, sunroof, navigation) have
 * no free or legal-to-scrape public source per VIN; that data lives in each
 * manufacturer's own paid build-data systems.
 */
const EQUIPMENT_FIELDS: Array<{ key: keyof NhtsaEnrichment; label: string }> = [
  { key: 'airbagFront', label: 'Poduszki przednie' },
  { key: 'airbagSide', label: 'Poduszki boczne' },
  { key: 'airbagCurtain', label: 'Kurtyny powietrzne' },
  { key: 'airbagKnee', label: 'Poduszki kolan' },
  { key: 'seatBelts', label: 'Pasy bezpieczeństwa' },
];

export function VinPage() {
  const search = useSearch({ strict: false }) as { vin?: string };
  const [input, setInput] = useState(search.vin ?? '');
  const [committed, setCommitted] = useState(search.vin ?? '');

  // A pasted/typed-out full-length VIN checks itself - no need to press a
  // button for the common case of pasting one in from a listing.
  useEffect(() => {
    const cleaned = input.trim().toUpperCase();
    if (cleaned.length === 17) setCommitted(cleaned);
  }, [input]);

  const lookup = useDecodeVin(committed || null);
  const { user } = useAuth();
  const historyAvailable = useVehicleHistoryAvailable();
  const history = useFetchVehicleHistory();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCommitted(input.trim().toUpperCase());
    history.reset();
  }

  async function openCepik(vin: string) {
    try {
      await navigator.clipboard.writeText(vin);
    } catch {
      // Clipboard access can be denied - the official site still opens fine,
      // the user just pastes the VIN in manually instead.
    }
    window.open(CEPIK_URL, '_blank', 'noopener,noreferrer');
  }

  function requestHistoryReport(vin: string) {
    if (
      window.confirm(
        `Pobrać pełny raport historii z ${historyAvailable.data?.provider ?? 'zewnętrznego dostawcy'}? Każde zapytanie kosztuje realne pieniądze (płatne API).`,
      )
    ) {
      history.mutate(vin);
    }
  }

  const result = lookup.data;
  const hasNhtsaData = result?.nhtsa && NHTSA_FIELDS.some((f) => result.nhtsa?.[f.key]);
  const hasEquipmentData = result?.nhtsa && EQUIPMENT_FIELDS.some((f) => result.nhtsa?.[f.key]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sprawdź VIN</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Numer VIN mówi więcej, niż widać na pierwszy rzut oka - producenta, kraj pochodzenia i
          czy sam numer w ogóle wygląda na prawdziwy. Wklej VIN z dowolnego ogłoszenia.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-md items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="vin-input">Numer VIN</Label>
          <Input
            id="vin-input"
            placeholder="np. WVWZZZ1JZXW000001"
            maxLength={17}
            className="font-mono uppercase"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <Button type="submit">Sprawdź</Button>
      </form>

      {lookup.isLoading ? <Skeleton className="h-64" /> : null}

      {!committed && !lookup.isLoading ? (
        <EmptyState
          icon={<FingerprintIcon className="size-8" />}
          title="Wklej VIN, żeby zacząć"
          description="17 znaków - producent, kraj produkcji i orientacyjny rocznik rozpoznają się od razu, offline."
        />
      ) : null}

      {result && !result.formatValid ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-4">
            <XCircleIcon className="text-destructive mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">To nie wygląda na poprawny VIN</p>
              <p className="text-muted-foreground text-sm">{result.formatError}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result?.formatValid ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 py-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Producent i pochodzenie
                </p>
                {result.make ? (
                  <p className="text-lg font-semibold">{result.make}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nie rozpoznano dokładnego producenta - kod WMI spoza mojej tabeli.
                  </p>
                )}
                {result.country ? (
                  <Badge variant="secondary">{result.country}</Badge>
                ) : null}
                {result.makeSource === 'region_only' ? (
                  <p className="text-muted-foreground text-xs">
                    Rozpoznany tylko region, nie konkretny producent.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 py-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Poprawność numeru
                </p>
                {result.checkDigitValid === null ? (
                  <div className="flex items-start gap-2">
                    <HelpCircleIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <p className="text-muted-foreground text-sm">
                      Suma kontrolna nie dotyczy tego VIN-u - obowiązuje tylko dla rynku
                      północnoamerykańskiego.
                    </p>
                  </div>
                ) : result.checkDigitValid ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2Icon className="text-success mt-0.5 size-4 shrink-0" />
                    <p className="text-sm">Suma kontrolna zgodna.</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
                    <p className="text-sm">
                      Suma kontrolna niezgodna - VIN może zawierać literówkę albo być sfałszowany.
                    </p>
                  </div>
                )}
                {result.candidateYears.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {result.candidateYears.length > 1
                        ? 'Możliwe roczniki (kod 30-letni, niejednoznaczny):'
                        : 'Prawdopodobny rocznik:'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {result.candidateYears.map((y) => (
                        <Badge key={y} variant="outline" className="data-figure">
                          {y}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Dodatkowe dane (NHTSA, USA)
                </p>
              </div>
              {hasNhtsaData ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  {NHTSA_FIELDS.filter((f) => result.nhtsa?.[f.key]).map((f) => (
                    <div key={f.key}>
                      <dt className="text-muted-foreground text-xs">{f.label}</dt>
                      <dd className="font-medium">{formatNhtsaValue(f.key, result.nhtsa?.[f.key])}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Brak dodatkowych danych - typowe dla aut sprzedawanych wyłącznie w Europie,
                  baza NHTSA jest nastawiona na rynek amerykański.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 py-4">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Wyposażenie bezpieczeństwa
              </p>
              {hasEquipmentData ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  {EQUIPMENT_FIELDS.filter((f) => result.nhtsa?.[f.key]).map((f) => (
                    <div key={f.key}>
                      <dt className="text-muted-foreground text-xs">{f.label}</dt>
                      <dd className="font-medium">{result.nhtsa?.[f.key]}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Brak danych o wyposażeniu bezpieczeństwa. To i tak jedyny rodzaj "wyposażenia",
                  jaki darmowy dekoder VIN może podać - skóra, nawigacja czy podgrzewane fotele nie
                  są nigdzie w publicznym rejestrze VIN, to płatne bazy producentów.
                </p>
              )}
            </CardContent>
          </Card>

          {user?.role === 'admin' ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      Pełny raport historii ({historyAvailable.data?.provider ?? 'AutoDNA / carVertical'})
                    </p>
                    <p className="text-muted-foreground max-w-xl text-sm">
                      Płatne API zewnętrznego dostawcy - szkody, realna historia przebiegu,
                      status kradzieżowy. Każde kliknięcie to koszt.
                    </p>
                  </div>
                  {historyAvailable.data?.available ? (
                    <Button
                      variant="outline"
                      disabled={history.isPending}
                      onClick={() => requestHistoryReport(result.vin)}
                    >
                      {history.isPending ? <Loader2Icon className="animate-spin" /> : <CarFrontIcon />}
                      Pobierz raport
                    </Button>
                  ) : null}
                </div>

                {!historyAvailable.isLoading && !historyAvailable.data?.available ? (
                  <p className="text-muted-foreground text-sm">
                    Nieskonfigurowane - ustaw <code className="text-xs">VEHICLE_HISTORY_PROVIDER</code>{' '}
                    i <code className="text-xs">AUTODNA_API_KEY</code> lub{' '}
                    <code className="text-xs">CARVERTICAL_API_KEY</code> w konfiguracji serwera.
                  </p>
                ) : null}

                {history.isError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {history.error instanceof Error ? history.error.message : 'Nie udało się pobrać raportu'}
                  </p>
                ) : null}

                {history.data ? <VehicleHistoryResult report={history.data} /> : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">Historia pojazdu, szkody, przebieg</p>
                <p className="text-muted-foreground max-w-xl text-sm">
                  Jedyne wiarygodne źródło dla aut w Polsce to oficjalna, darmowa usługa rządowa -
                  otwiera się w nowej karcie, VIN kopiuje się do schowka do wklejenia.
                </p>
              </div>
              <Button variant="outline" onClick={() => openCepik(result.vin)}>
                <ClipboardIcon />
                Sprawdź w CEPiK
                <ExternalLinkIcon />
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

const STOLEN_LABELS: Record<string, string> = {
  clear: 'Brak zgłoszenia kradzieży',
  reported_stolen: 'Zgłoszona kradzież',
  unknown: 'Status nieznany',
};

function VehicleHistoryResult({ report }: { report: import('@/lib/types').VehicleHistoryReport }) {
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {report.stolenStatus === 'reported_stolen' ? (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlertIcon />
            {STOLEN_LABELS[report.stolenStatus]}
          </Badge>
        ) : report.stolenStatus === 'clear' ? (
          <Badge variant="success" className="gap-1">
            <ShieldCheckIcon />
            {STOLEN_LABELS[report.stolenStatus]}
          </Badge>
        ) : (
          <Badge variant="outline">{STOLEN_LABELS[report.stolenStatus]}</Badge>
        )}
        {report.ownersCount !== null ? (
          <Badge variant="secondary">{report.ownersCount} właścicieli</Badge>
        ) : null}
        {report.importCountry ? <Badge variant="secondary">Import: {report.importCountry}</Badge> : null}
        <span className="text-muted-foreground text-xs">
          Pobrano {formatDateTime(report.fetchedAt)}
        </span>
      </div>

      {report.damageRecords.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Szkody</p>
          <ul className="mt-1 space-y-1">
            {report.damageRecords.map((d, i) => (
              <li key={i} className="text-sm">
                {d.date ? <span className="text-muted-foreground">{d.date} · </span> : null}
                {d.description}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Brak zarejestrowanych szkód.</p>
      )}

      {report.mileageRecords.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Historia przebiegu
          </p>
          <ul className="mt-1 space-y-1">
            {report.mileageRecords.map((m, i) => (
              <li key={i} className="data-figure text-sm">
                {m.date ? `${m.date} · ` : ''}
                {m.mileageKm.toLocaleString('pl-PL')} km
                {m.source ? <span className="text-muted-foreground"> ({m.source})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.reportUrl ? (
        <Button asChild size="sm" variant="outline">
          <a href={report.reportUrl} target="_blank" rel="noopener noreferrer">
            Pełny raport na stronie dostawcy
            <ExternalLinkIcon />
          </a>
        </Button>
      ) : null}
    </div>
  );
}
