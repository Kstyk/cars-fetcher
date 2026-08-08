# Cars Fetcher

Agregator ogłoszeń samochodowych z grupami filtrów. Pobiera oferty z serwisów
zewnętrznych (na start: **Otomoto**), zapisuje je w PostgreSQL i pokazuje w
jednym miejscu — z ulubionymi, historią cen i powiadomieniami.

Szczegóły nie są duplikowane: karta oferty linkuje **bezpośrednio do serwisu
źródłowego**.

## Stack

| Warstwa       | Technologia                                                          |
| ------------- | -------------------------------------------------------------------- |
| Baza          | PostgreSQL 17 (Docker) + Adminer                                     |
| Backend       | Node 22, Express 5, TypeScript, Drizzle ORM, zod, JWT, node-cron      |
| Frontend      | React 19, TypeScript, Vite 7, Tailwind CSS v4, shadcn/ui             |
| Dane w UI     | TanStack Query v5, TanStack Router v1                                |

### Styl: „terminal rynkowy"

Nie kolejny szablonowy SaaS-blue. Appka to obserwator rynku, nie katalog —
paleta i typografia to odzwierciedlają:

- **Kolor** — tokeny w [styles.css](apps/web/src/styles.css) przesunięte z
  niebiesko-szarego (hue ~255-265) na zielony terminal (hue ~150-195). Jasny
  motyw: "wydruk z tickera" (papier + teal). Ciemny: przydymiona zieleń CRT —
  natywny tryb tego kierunku.
- **Typografia** — Space Grotesk samohostowany (`public/fonts/`, ~44 KB, zero
  CDN w runtime) na nagłówkach i wordmarku. Każda cena/przebieg/moc/data —
  klasa `.data-figure` (monospace tabular) — czyta się jak odczyt z terminala,
  nie jak zwykły tekst.
- **Sygnatura** — cena na karcie ma wbudowaną strzałkę trendu (↓/↑) zamiast
  osobnego badge'a. Semantyka jak dla kupującego, nie inwestora: spadek =
  zielony (dobrze dla Ciebie), wzrost = czerwony — spójne w karcie, dialogu
  historii cen i porównywarce.

## Szybki start (Docker)

Cała aplikacja w kontenerach — baza, API i frontend:

```bash
cp .env.example .env
docker compose up -d --build
```

Aplikacja: **http://localhost:8090**  ·  Adminer: http://localhost:8080

Migracje wykonują się automatycznie przy starcie kontenera API (entrypoint
czeka na bazę, potem uruchamia `drizzle` — już zastosowane są pomijane).
Dane demo wgrasz raz przez `docker compose exec api node apps/api/dist/db/seed.js`.

| Usługa | Port | Uwagi |
| ------ | ---- | ----- |
| web (nginx) | 8090 | serwuje SPA i proxy'uje `/api` do kontenera API |
| api | 4000 | wystawiony do debugowania; przeglądarka go nie potrzebuje |
| postgres | 5433 | |
| adminer | 8080 | |

### Automatyczna aktualizacja obrazów

Hook `Stop` w [.claude/settings.json](.claude/settings.json) uruchamia
[scripts/docker-deploy.sh](scripts/docker-deploy.sh) po każdym zakończonym
promptcie. Skrypt porównuje czasy modyfikacji źródeł ze znacznikiem z ostatniego
wdrożenia i przebudowuje obrazy tylko wtedy, gdy coś się zmieniło — bez zmian
kończy się w ~0,15 s. Log ostatniej przebudowy: `docker-deploy.log`.

## Szybki start (bez Dockera)

```bash
# 1. Konfiguracja
cp .env.example .env

# 2. Baza danych
npm run db:up            # postgres :5433 + adminer :8080

# 3. Zależności
npm install

# 4. Migracje + dane demo
npm run db:migrate
npm run db:seed

# 5. Uruchomienie (API :4000, web :5173)
npm run dev
```

Konto demo: **demo@cars-fetcher.local** / **Demo1234**

Seed tworzy dwie grupy filtrów odpowiadające założeniom projektu:

- **Skandynawia i Japonia** — filtry: Volvo, Toyota
- **Korea i Japonia – budżet** — filtry: Mazda, Kia

## Struktura

```
cars-fetcher/
├── docker-compose.yml            PostgreSQL + Adminer
├── docs/ERD.md                   diagram ERD + decyzje projektowe
├── apps/
│   ├── api/
│   │   ├── drizzle/              wygenerowane migracje SQL
│   │   └── src/
│   │       ├── config/           env (zod) + logger (pino)
│   │       ├── db/               schema, klient, migrate, seed
│   │       ├── middleware/       auth, walidacja, obsługa błędów
│   │       ├── modules/
│   │       │   ├── auth/         rejestracja, logowanie, JWT, profil
│   │       │   ├── filters/      grupy filtrów i filtry
│   │       │   ├── listings/     wyszukiwanie, ulubione, statystyki
│   │       │   ├── fetching/     orkiestracja pobierania + zapis do bazy
│   │       │   └── notifications/ powiadomienia i uprawnienia
│   │       ├── providers/        warstwa dostawców (patrz niżej)
│   │       └── jobs/scheduler.ts cron odświeżający grupy
│   └── web/
│       └── src/
│           ├── components/ui/    prymitywy shadcn/ui
│           ├── lib/              klient API, auth, hooki React Query
│           ├── pages/            widoki
│           └── router.tsx        drzewo tras TanStack Router
```

## Integracja z Otomoto

Warstwa dostawców opiera się na jednym interfejsie —
[`ListingSource`](apps/api/src/providers/types.ts). Dodanie autoplac.pl czy OLX
to napisanie jednej implementacji i zarejestrowanie jej; reszta aplikacji się
nie zmienia.

Adapter wybiera `OTOMOTO_SOURCE`:

| Wartość   | Źródło danych                        | Poświadczenia |
| --------- | ------------------------------------ | ------------- |
| `scraper` | publiczne strony ofert (**domyślne**) | nie           |
| `api`     | oficjalne API partnerskie OAuth2      | tak           |
| `fixture` | generator, praca offline              | nie           |

### Scraper (domyślny)

Otomoto to aplikacja Next.js — komplet ofert siedzi w stronie jako JSON
(`__NEXT_DATA__` → cache urql → `advertSearch`). Nie ma parsowania HTML-a ani
headless browsera.

Wspólna warstwa w [`providers/scraping/`](apps/api/src/providers/scraping/)
trzyma to, o czym łatwo zapomnieć przy dopisywaniu kolejnego serwisu:

- [`robots.ts`](apps/api/src/providers/scraping/robots.ts) — pobiera i parsuje
  `robots.txt`, cache 6 h, wygrywa najdłuższy pasujący wzorzec. Otomoto ma
  `Disallow: /api/` i `Disallow: /ajax/` (ich wewnętrzne GraphQL) przy
  `Allow: /` dla stron ofert — scraper rusza wyłącznie po dozwolonych ścieżkach.
- [`rate-limiter.ts`](apps/api/src/providers/scraping/rate-limiter.ts) —
  kolejkuje żądania per host, minimum 2,5 s przerwy. Żaden adapter nie może tego
  obejść.
- [`http-client.ts`](apps/api/src/providers/scraping/http-client.ts) — retry z
  backoffem na 429/5xx (respektuje `Retry-After`), cache odpowiedzi 5 min,
  nagłówki przeglądarki.
- [`next-data.ts`](apps/api/src/providers/scraping/next-data.ts) — wyciąganie
  `__NEXT_DATA__` i strukturalne szukanie payloadu GraphQL. Klucze cache'a urql
  są generowane, więc szukanie po strukturze przeżywa deploye serwisu.

Dwie pułapki, na które są zabezpieczenia:

1. **Zły slug modelu jest cicho ignorowany.** `/osobowe/volvo/xc60` zwraca 8404
   ofert (całe Volvo), a poprawne `xc-60` — 2489. Dlatego marka i model idą jako
   filtry `search[filter_enum_make]`, nie segmenty ścieżki, a wyniki są
   dodatkowo filtrowane po stronie aplikacji.
2. **Części z OLX wyciekają do kategorii osobowych.** „Lampa LED lewy tył Volvo
   XC 60" za 1050 zł ma `category.id=29` i komplet parametrów auta (rocznik
   2022, 55 000 km). Kategoria nie odróżnia — odróżnia cena, stąd próg
   `SCRAPER_MIN_PRICE_PLN`.

Mapper [`otomoto.mapper.ts`](apps/api/src/providers/otomoto/otomoto.mapper.ts)
jest wspólny dla scrapera i oficjalnego API — jeden zestaw słowników enumów.

#### Co wraca w wynikach, a co nie

Otomoto zwraca w liście wyników tylko dziesięć atrybutów:

`make`, `model`, `version`, `year`, `mileage`, `fuel_type`, `gearbox`,
`engine_capacity`, `engine_power`, `country_origin`

**Nie ma** typu nadwozia, koloru, liczby drzwi ani rodzaju napędu — te dane są
dopiero na stronie oferty. Konsekwencja w aplikacji:

- filtrować **po stronie Otomoto** można po wszystkim (formularz filtra wysyła
  `search[filter_enum_color]` itd. i serwis zawęża wyniki),
- filtrować **po stronie naszej bazy** (widok „Ogłoszenia") można wyłącznie po
  tych dziesięciu polach — dlatego lista ma selecty paliwa, skrzyni, kraju i
  mocy, ale nie ma nadwozia ani koloru. Filtr po nieprzechowywanej kolumnie
  zawsze zwracałby zero wyników.

### Słownik marek i modeli

Definicja filtrów Otomoto siedzi w tej samej stronie co oferty — łącznie z
listą modeli **każdej** marki (każdy stan modelu ma warunek
`{ filterId: 'filter_enum_make', value: 'ford' }`). Jedno żądanie wystarcza na
cały słownik:

```bash
npm run taxonomy:build --workspace @cars-fetcher/api
```

Wynik trafia do `apps/api/src/data/otomoto-taxonomy.json` (w repozytorium):
**187 marek, 2551 modeli, 52 pozycje wyposażenia, 40 krajów, 17 kolorów**.
Serwowany przez `GET /api/taxonomy`; UI używa go do selectów, więc formularz
nie zależy od dostępności Otomoto.

> Po przebudowie słownika zrestartuj API — `tsx watch` nie śledzi plików JSON,
> a słownik jest wczytywany raz i trzymany w pamięci.

Test na żywym serwisie:

```bash
npm run scrape:test --workspace @cars-fetcher/api
```

### OAuth2 (tryb `api`)

[`OtomotoAuthClient`](apps/api/src/providers/otomoto/otomoto.auth.ts) realizuje
przepływ z [dokumentacji](https://www.otomoto.pl/api/doc/):

```
POST {OTOMOTO_BASE_URL}/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=...&password=...
```

Token trafia do tabeli `provider_tokens` (przeżywa restart), jest odnawiany
przez `grant_type=refresh_token` na 60 s przed wygaśnięciem, a równoległe
wywołania współdzielą jedno żądanie.

Otomoto Open API to **API partnerskie/dealerskie** — `/api/open/account/adverts`
zwraca ogłoszenia *zalogowanego konta*, a nie wyniki wyszukiwania całego
serwisu. Dlatego domyślnym źródłem jest scraper. Żeby użyć API:

```env
OTOMOTO_SOURCE=api
OTOMOTO_ENABLED=true
OTOMOTO_CLIENT_ID=...
OTOMOTO_CLIENT_SECRET=...
OTOMOTO_USERNAME=...
OTOMOTO_PASSWORD=...
```

`GET /api/providers` pokazuje, które źródło jest aktualnie aktywne.

## Integracja z OLX

OLX jest osobnym adapterem —
[`olx.source.ts`](apps/api/src/providers/olx/olx.source.ts) — korzystającym z
publicznego API JSON, **nie** z parsowania HTML.

### Dlaczego API, a nie strona

`robots.txt` OLX blokuje `/api/`, ale robi jawny wyjątek:

```
Disallow: /api/
Allow: /api/v1/offers/
Allow: /api/v1/targeting/
Allow: /api/v1/friendly-links/
```

Endpoint ofert jest więc drogą sankcjonowaną — czysty JSON, bez zgadywania
struktury DOM.

### Dwie osobliwości OLX

**1. Nie ma filtra marki.** API odrzuca `filter_enum_make`:

```
"Dynamic filters not applicable for category 84: filter_enum_make"
```

Każda marka to u nich **osobna kategoria** (Volvo = 208, Toyota = 206,
Mazda = 194, Cupra = 4769). Dlatego adapter potrzebuje mapy slug → `category_id`:

```bash
npm run taxonomy:olx --workspace @cars-fetcher/api
```

Wynik trafia do `apps/api/src/data/olx-taxonomy.json`. Bez tego pliku adapter
nadal działa — szuka w kategorii ogólnej (84) z marką w `query` — tylko mniej
precyzyjnie. Wyniki i tak przechodzą filtrowanie po stronie aplikacji.

**2. OLX zwraca więcej danych niż Otomoto.** Oferta niesie `car_body`, `color`,
`drive` i `vin`, których wyszukiwarka Otomoto nie podaje. Ten sam
`NormalizedListing` obsługuje oba źródła — pola po prostu bywają puste.

### CloudFront blokuje wszystko poza prawdziwą przeglądarką

OLX stoi za CloudFront/WAF, który odrzuca **każdego** klienta bez realnego
odcisku TLS/HTTP2 przeglądarki — `curl`, Node `fetch`, identyczne nagłówki
UA, nic nie pomaga. Blokowany jest nawet `robots.txt`, więc to nie
wykrywanie zachowania konkretnego żądania, tylko twardy filtr na poziomie
połączenia. Realna przeglądarka z tego samego IP przechodzi bez problemu.

Dlatego `olx.source.ts` woła `fetchHtml(url, { useBrowser: true })` —
[`browser-fetch.ts`](apps/api/src/providers/scraping/browser-fetch.ts) odpala
jeden, długo żyjący headless Chromium (Playwright) na cały proces i faktycznie
nawiguje na URL API, zamiast robić gołe zapytanie HTTP. Wolniejsze
(~1-6 s/stronę zamiast ~0.1 s), ale przechodzi. Inne adaptery (Otomoto,
autoplac, FindCar) nie mają tego problemu i zostają na zwykłym `fetch`.

Efekt uboczny: obraz Dockera `api` jest teraz ~1.9 GB (Chromium + zależności
systemowe), a `Dockerfile` bazuje na `node:22-slim` (Debian) zamiast
`alpine` — Playwright nie wspiera musl/Alpine.

**Przełącznik (circuit breaker):** po 3 kolejnych 403 z jednego hosta,
`ScrapingClient` przestaje go odpytywać na 3h (`CIRCUIT_COOLDOWN_MS` w
[`http-client.ts`](apps/api/src/providers/scraping/http-client.ts)) — regularne
bicie w zablokowany host co 15-30 min samo w sobie wygląda jak bot i
podtrzymuje blokadę. Widać to w historii pobrań jako natychmiastowy `failed`
z komunikatem „wstrzymano próby do…”.

## Serwisy

| Serwis        | Status              | Źródło danych                    |
| ------------- | ------------------- | -------------------------------- |
| Otomoto       | działa              | publiczne strony ofert / API partnerskie |
| OLX           | działa (przez headless Chromium) | `/api/v1/offers/` (dozwolone w robots.txt) |
| autoplac.pl   | działa              | Angular TransferState na stronach `/oferty/` |
| FindCar       | działa              | —                            |
| Sprzedajemy.pl | działa             | klasyczny SSR HTML, `/motoryzacja/samochody-osobowe/...` |
| mobile.de     | **niezaimplementowane** | JS-rendered (Next.js RSC) - wymaga Chromium + rozkminy ich API |
| AutoScout24   | **zablokowane celowo** | `robots.txt`: `Disallow: /lst?` dla wszystkich botów |

### autoplac.pl

Angular z SSR — cała odpowiedź API ląduje w stronie jako
`<script type="application/json">` (TransferState). Parsowanie tego daje
strukturalne oferty bez sięgania do ich hosta API (który i tak wymaga
uwierzytelnienia: GET zwraca `offerCount: 0`, POST — 403).

`robots.txt` mocno ogranicza sposób filtrowania:

```
Disallow: /*offset
Disallow: /*?*fullTextQuery=
Disallow: /*?*brandModelIds=
Disallow: /?sortOrder=   /?orderBy=
```

Czyli standardowe parametry wyszukiwania są zabronione. Ale marka i model
działają jako **segmenty ścieżki**, a paginacja przez `?p=N` — żadne z nich nie
jest na liście `Disallow`:

```
/oferty/samochody-osobowe              → 185 368 ofert
/oferty/samochody-osobowe/volvo        →   6 404
/oferty/samochody-osobowe/volvo/xc-60  →   1 776
```

Reszta kryteriów (cena, rocznik, przebieg, paliwo, nadwozie) jest filtrowana po
naszej stronie. 24 oferty na stronę.

Uwagi o danych: moc podawana w kW (przeliczam na KM), `insertTime` to epoch w
milisekundach, a payload listy nie zawiera flagi prywatny/dealer — dlatego
`sellerType` to `unknown`.

### Sprzedajemy.pl

Ogólny serwis ogłoszeniowy, nie automotive-specific — klasyczny SSR HTML
(żadnego `__NEXT_DATA__`/Apollo state), parsowany przez `cheerio`. Marka i
model to segmenty ścieżki (`/motoryzacja/samochody-osobowe/audi/a4`), które
pokrywają się ze wspólnym `slugify()` na tyle dobrze, że nie trzeba osobnego
pliku taksonomii.

`robots.txt` ma `Disallow: *inp_*` — a `inp_*` to dokładnie prefiks *każdego*
parametru filtra i sortowania w ich panelu „Pokaż wszystkie filtry”
(`inp_price`, `inp_attribute_466` dla rocznika, nawet `sort=inp_srt_date_d`).
Odkryte to zostało boleśnie — pierwsza wersja adaptera kopiowała nazwy pól
formularza wprost i dostawała ciche odrzucenie na poziomie `RobotsChecker`.
Efekt: ten adapter woła wyłącznie `{ścieżka}?offset=N`, nic więcej. Cena,
rocznik, przebieg, paliwo i typ sprzedawcy są filtrowane po naszej stronie
(`matchesCriteria`) na podstawie tego, co karta wyniku faktycznie pokazuje —
nadwozie, kolor, drzwi, przebieg wypadku i VAT nie są tam widoczne, więc dla
tego serwisu po prostu nie da się ich filtrować. Sortowanie też jest
`inp_srt_*`, więc strony wracają w domyślnej kolejności serwisu
(„Polecane”), nie od najnowszych — realne ograniczenie, nie błąd.

`GET /api/providers` zwraca ten stan; UI wyszarza serwisy bez adaptera i
oznacza je jako „wkrótce". Filtr przypisany do niezaimplementowanego serwisu
kończy przebieg statusem `failed` z czytelnym powodem, zamiast po cichu nie
zwracać nic. AutoScout24 nie doczeka się adaptera w ogóle — ich `robots.txt`
blokuje `/lst?` (endpoint wyszukiwania) dla wszystkich botów.

Dodanie kolejnego serwisu to jedna implementacja
[`ListingSource`](apps/api/src/providers/types.ts) plus wpis w
[`registry.ts`](apps/api/src/providers/registry.ts).

### Uwaga prawna

`robots.txt` zezwala na strony ofert, ale regulamin serwisu to osobna sprawa i
zwykle zakazuje automatycznego zbierania danych. Domyślne ustawienia celowo są
zachowawcze (2,5 s przerwy, respektowanie `robots.txt`, cache) — przy prywatnym
użyciu to rozsądny kompromis. Przed użyciem komercyjnym warto sprawdzić
regulamin albo wystąpić do Otomoto o dostęp partnerski.

## Jak działa pobieranie

```
scheduler (cron)                 użytkownik klika „Pobierz”
       │                                    │
       └──────► runDueGroups() ────► runGroup(groupId)
                                            │
                          dla każdego aktywnego filtru w grupie:
                                            │
                                    runFilter()
                                    ├─ source.search()   paginacja do FETCH_MAX_PAGES
                                    ├─ ingestListings()  upsert + historia cen + dopasowania
                                    ├─ deactivateStale() miękkie usunięcie znikniętych ofert
                                    └─ notify()          nowe oferty / spadki cen
                                            │
                                    zapis do fetch_runs
```

Grupa ma własny `refresh_interval_minutes` — scheduler bierze tylko te, którym
minął interwał, więc grupa „co 6 h” nie jest odpytywana co pół godziny.
Nakładające się przebiegi crona są pomijane, nie kolejkowane.

## API

| Metoda   | Ścieżka                                   | Opis                                    |
| -------- | ----------------------------------------- | --------------------------------------- |
| `POST`   | `/api/auth/register`                      | rejestracja (email, hasło, imię, nazwisko) |
| `POST`   | `/api/auth/login`                         | logowanie → access token + cookie refresh |
| `POST`   | `/api/auth/refresh`                       | rotacja refresh tokenu                  |
| `POST`   | `/api/auth/logout` `/logout-all`          | wylogowanie                             |
| `GET`    | `/api/auth/me`                            | profil                                  |
| `PATCH`  | `/api/auth/me`                            | zmiana imienia/nazwiska                 |
| `POST`   | `/api/auth/change-password`               | zmiana hasła (unieważnia sesje)         |
| `GET`    | `/api/auth/providers`                     | czy logowanie Google jest skonfigurowane |
| `GET`    | `/api/auth/google` `/google/callback`     | logowanie Google (redirect, nie JSON)   |
| `POST`   | `/api/auth/verify-email`                  | potwierdzenie e-maila tokenem z linku   |
| `POST`   | `/api/auth/resend-verification`           | ponowna wysyłka linku (cooldown 60s)    |
| `GET`    | `/api/filter-groups`                      | grupy + statystyki + ostatni przebieg   |
| `POST`   | `/api/filter-groups`                      | nowa grupa (opcjonalnie z filtrami)     |
| `PATCH`  | `/api/filter-groups/:id`                  | edycja grupy                            |
| `DELETE` | `/api/filter-groups/:id`                  | usunięcie grupy                         |
| `POST`   | `/api/filter-groups/:id/filters`          | dodanie filtru                          |
| `PUT`    | `/api/filter-groups/:id/filters/:filterId`| edycja filtru                           |
| `DELETE` | `/api/filter-groups/:id/filters/:filterId`| usunięcie filtru                        |
| `POST`   | `/api/filter-groups/:id/fetch`            | ręczne pobranie                         |
| `GET`    | `/api/filter-groups/:id/runs`             | historia pobrań                         |
| `GET`    | `/api/listings`                           | wyszukiwanie z filtrami i paginacją     |
| `GET`    | `/api/listings/stats`                     | statystyki                              |
| `GET`    | `/api/listings/:id`                       | szczegóły + historia cen                |
| `PUT`    | `/api/listings/:id/favorite`              | dodanie do ulubionych                   |
| `DELETE` | `/api/listings/:id/favorite`              | usunięcie z ulubionych                  |
| `GET`    | `/api/favorites`                          | lista ulubionych                        |
| `GET`    | `/api/notifications`                      | powiadomienia                           |
| `GET`    | `/api/notifications/unread-count`         | licznik nieprzeczytanych                |
| `POST`   | `/api/notifications/read` `/read-all`     | oznaczanie jako przeczytane             |
| `GET`    | `/api/notifications/preferences/me`       | uprawnienia powiadomień                 |
| `PATCH`  | `/api/notifications/preferences/me`       | zmiana uprawnień                        |
| `POST`   | `/api/notifications/push/subscribe`       | rejestracja urządzenia push             |
| `GET`    | `/api/taxonomy`                           | pełny słownik (marki, modele, wyposażenie) |
| `GET`    | `/api/taxonomy/makes`                     | same marki (lżejsza odpowiedź)          |
| `GET`    | `/api/taxonomy/makes/:make/models`        | modele danej marki                      |
| `GET`    | `/api/providers`                          | status źródeł danych                    |

## Porównywarka, historia cen i wskaźnik dobrej ceny

- **Porównywarka** — checkbox na karcie (max 3 na raz), pływająca taca na
  dole ekranu, dialog z tabelą side-by-side (cena/przebieg/rocznik/moc,
  najlepsza wartość podświetlona). Stan żyje nad routerem
  ([`lib/compare.tsx`](apps/web/src/lib/compare.tsx)), więc przeżywa
  nawigację między `/listings` i `/favorites`.
- **Historia ceny** — `listing_price_history` dostaje wiersz przy każdej
  zmianie ceny (patrz `ingest.service.ts`), łącznie z pierwszym zapisem.
  Ikona na karcie otwiera dialog z prostym wykresem SVG (bez biblioteki do
  wykresów) — [`price-history-chart.tsx`](apps/web/src/components/price-history-chart.tsx):
  linia + wash pod spodem, punkty ekstremalne podpisane, krzyżyk + tooltip
  pod kursorem, tabela z dokładnymi wartościami pod spodem. Ofertę bez zmian
  ceny dialog pokazuje jako płaski komunikat zamiast bezsensownego
  jednopunktowego wykresu.
- **Wskaźnik dobrej ceny** — zielona odznaka „X% poniżej rynku” na karcie.
  Jedno skorelowane podzapytanie SQL na wiersz ([`listings.service.ts`](apps/api/src/modules/listings/listings.service.ts))
  liczy medianę (`percentile_cont`) cen ofert tej samej marki+modelu, ±1 rok
  produkcji, ±30% przebiegu, wykluczając samą ofertę. Odznaka pokazuje się
  dopiero przy ≥5 porównywalnych ofertach (mniej = szum, nie sygnał) i ≥10%
  poniżej mediany. Indeks `listings_market_cohort_idx` (make, model, year,
  mileage_km) trzyma to szybkie.

## Powiadomienia e-mail i push

Dzwonek w nagłówku był jedynym kanałem — `notify()` wstawiał wiersz do bazy i
na tym się kończyło (`sent_at` zawsze `NULL`, 0 subskrypcji push). Teraz
`notify()` po zapisaniu w bazie **wysyła** e-mail i/lub push, zależnie od
ustawień użytkownika (`emailEnabled` / `pushEnabled` + przełącznik per typ
zdarzenia w `notification_preferences`).

### Web Push (VAPID)

```bash
npm run push:generate-keys --workspace @cars-fetcher/api
```

Wynik wklej do `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`) i do `docker-compose.yml`/środowiska kontenera — klucze są
tam przekazywane jawnie, `env_file` nie jest używane.

Przepływ: przeglądarka rejestruje `apps/web/public/sw.js`
([`lib/push.ts`](apps/web/src/lib/push.ts)), pyta o zgodę, subskrybuje przez
`PushManager` z kluczem publicznym pobranym z
`GET /api/notifications/push/vapid-public-key` (publiczny endpoint, klucz
prywatny nigdy nie opuszcza serwera), potem rejestruje subskrypcję pod
`POST /api/notifications/push/subscribe`. Przełącznik „Push w przeglądarce”
w profilu wykonuje ten cały przepływ, nie tylko zapisuje flagę w bazie.

Wygasłe subskrypcje (przeglądarka odinstalowana, zgoda cofnięta) serwis push
zgłasza jako 404/410 — [`push.service.ts`](apps/api/src/modules/notifications/push.service.ts)
usuwa taki wiersz zamiast próbować bez końca.

### E-mail (SMTP)

Dowolny serwer SMTP przez `nodemailer` — `SMTP_HOST/PORT/USER/PASS/FROM` w
`.env`. Puste `SMTP_HOST` = wysyłka pomijana z jednym ostrzeżeniem w logu,
reszta aplikacji działa normalnie (ten sam wzorzec co brak poświadczeń
Otomoto). Szablon w
[`email.service.ts`](apps/api/src/modules/notifications/email.service.ts) —
inline style, bo klienty pocztowe wycinają `<style>`.

### Śledzenie dostawy

Kolumny `email_sent_at` / `email_error` / `push_sent_at` / `push_error` na
`notifications` — `NULL` w obu znaczy „kanał wyłączony, nic nie próbowano”,
nie „się nie udało”. Błąd wysyłki nigdy nie przerywa przebiegu pobierania:
[`dispatch.service.ts`](apps/api/src/modules/notifications/dispatch.service.ts)
łapie wyjątki i zapisuje je na wierszu zamiast rzucać dalej.

### Godziny ciszy

`quiet_hours_start/end` w preferencjach wstrzymuje **wysyłkę** e-mail/push
(wiersz w dzwonku i tak powstaje) — sam to złapałem podczas testu o 22:43
czasu warszawskiego, gdzie `emailSentAt` zostawało `NULL` mimo poprawnej
konfiguracji SMTP. To zamierzone działanie, nie błąd.

## Logowanie Google i weryfikacja e-maila

Rejestracja/logowanie hasłem to nie jedyna droga — jest też logowanie przez
Google (OAuth2, bez zewnętrznego SDK, tylko `fetch` — ten sam styl co klient
Otomoto) i weryfikacja adresu e-mail. 2FA świadomie pominięte.

### Google OAuth2

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   utwórz OAuth Client ID (typ „Web application”).
2. Authorised redirect URI musi być dokładnie
   `${APP_URL}/api/auth/google/callback` (domyślnie
   `http://localhost:8090/api/auth/google/callback`).
3. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` w `.env` i
   `docker-compose.yml` (jak zawsze — przekazywane jawnie, `env_file` nie
   jest używane).

Puste zmienne = przycisk „Zaloguj przez Google” **ukryty** (frontend pyta
`GET /api/auth/providers` przy montowaniu strony logowania), reszta apki
działa normalnie — ten sam wzorzec co Otomoto/SMTP/VAPID.

Przepływ: `GET /api/auth/google` ustawia `state` w krótkotrwałym `httpOnly`
cookie i przekierowuje na ekran zgody Google → `GET /api/auth/google/callback`
porównuje `state` (ochrona CSRF), wymienia kod na token, pobiera profil z
`userinfo` endpointu (bez lokalnej weryfikacji JWKS — prościej, wystarcza do
jednorazowego logowania), ustawia refresh cookie i **zwykłym HTTP redirectem**
wraca na `APP_URL`. Brak dedykowanej strony callbacku po stronie frontu —
`AuthProvider` i tak odpytuje `/api/auth/me` przy starcie, dostanie 401,
odpali już istniejący mechanizm auto-refresh i sesja się sama złoży.

Konto: e-mail z Google pasujący do istniejącego konta hasłowego → `googleId`
dopisywany do tego wiersza (linkowanie), nie tworzy duplikatu. Nowy e-mail →
nowe konto bez hasła (`password_hash IS NULL`), od razu oznaczone jako
zweryfikowane (Google już to potwierdził). Stąd `hasPassword` w odpowiedzi
`/api/auth/me` — front chowa nim formularz zmiany hasła dla kont
Google-only.

### Weryfikacja e-mail

Token: `crypto.randomBytes(48)`, w bazie tylko SHA-256 (ten sam prymityw co
refresh token, `generateOpaqueToken`/`hashOpaqueToken`). Ważny 24h, wysyłka
best-effort — martwy SMTP nie blokuje rejestracji, tylko loguje ostrzeżenie
(spójnie z resztą apki). Link z e-maila:
`${APP_URL}/verify-email?token=...` → publiczna strona frontu, działa
niezależnie od tego, czy przeglądarka ma aktywną sesję.

**Niezweryfikowany e-mail nie blokuje korzystania z appki** — świadoma
decyzja, żeby nie zamykać ludzi za drzwiami, gdy SMTP akurat nie jest
skonfigurowane (świeże środowisko deweloperskie). W profilu widać banner z
przyciskiem „Wyślij ponownie” (`POST /api/auth/resend-verification`,
cooldown 60s, `409` przy zbyt częstym klikaniu).

## Bezpieczeństwo

- Hasła: bcrypt, 12 rund. Logowanie porównuje hash także dla nieistniejącego
  konta i dla konta bez hasła (Google-only), więc czas odpowiedzi nie zdradza,
  czy adres jest zarejestrowany ani jak założono konto.
- Access token: JWT (domyślnie 15 min) w nagłówku `Authorization`.
- Refresh token: losowy, opaque, w bazie tylko jako SHA-256, w przeglądarce jako
  `httpOnly` cookie ograniczone do `/api/auth`. Rotowany przy każdym użyciu.
- Zmiana hasła unieważnia wszystkie sesje.
- Każde zapytanie o ogłoszenia jest zawężone do grup należących do wywołującego.
- Wejście walidowane przez zod; `helmet` i `cors` z listą dozwolonych origins.

## Skrypty

| Komenda               | Działanie                                        |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | API + web równolegle                             |
| `npm run build`       | build obu aplikacji                              |
| `npm run typecheck`   | sprawdzenie typów                                |
| `npm run db:up`       | start PostgreSQL + Adminer                       |
| `npm run db:reset`    | usunięcie wolumenu i świeża baza                 |
| `npm run db:generate` | wygenerowanie migracji ze schematu               |
| `npm run db:migrate`  | zastosowanie migracji                            |
| `npm run db:seed`     | konto demo + grupy filtrów + pierwsze pobranie   |
| `npm run db:studio`   | Drizzle Studio                                   |

W workspace `@cars-fetcher/api`:

| Komenda                  | Działanie                                     |
| ------------------------ | --------------------------------------------- |
| `npm run scrape:test`    | test scrapera na żywym Otomoto                |
| `npm run olx:test`       | test adaptera OLX                             |
| `npm run taxonomy:build` | przebudowa słownika Otomoto (marki, modele, wyposażenie) |
| `npm run taxonomy:olx`   | przebudowa mapy marek OLX (slug → category_id) |

## Co dalej

- mobile.de — wymaga headless Chromium (jak OLX) + rozkminy ich wewnętrznego
  API, JS-rendered wyniki. AutoScout24 odrzucony na stałe (`robots.txt`).
- Testy: Vitest + Testcontainers dla warstwy repozytoriów.
- 2FA świadomie pominięte (patrz [„Logowanie Google i weryfikacja
  e-maila”](#logowanie-google-i-weryfikacja-e-maila)) — dorzucić jeśli
  będzie potrzeba.
