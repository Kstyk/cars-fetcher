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

## Szybki start

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

### Uwaga na klienta HTTP

OLX stoi za CloudFrontem, który odrzuca `curl` z 403 (odcisk TLS), ale
przepuszcza `fetch` Node'a. `ScrapingClient` używa globalnego `fetch`, więc
działa. Debugując z terminala, nie sugeruj się `curl` — użyj Node'a.

## Serwisy

| Serwis        | Status              | Źródło danych                    |
| ------------- | ------------------- | -------------------------------- |
| Otomoto       | działa              | publiczne strony ofert / API partnerskie |
| OLX           | działa              | `/api/v1/offers/` (dozwolone w robots.txt) |
| autoplac.pl   | **niezaimplementowane** | —                            |
| FindCar       | **niezaimplementowane** | —                            |

`GET /api/providers` zwraca ten stan; UI wyszarza serwisy bez adaptera i
oznacza je jako „wkrótce". Filtr przypisany do niezaimplementowanego serwisu
kończy przebieg statusem `failed` z czytelnym powodem, zamiast po cichu nie
zwracać nic.

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

## Bezpieczeństwo

- Hasła: bcrypt, 12 rund. Logowanie porównuje hash także dla nieistniejącego
  konta, więc czas odpowiedzi nie zdradza, czy adres jest zarejestrowany.
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

- Dostawcy: OLX, mobile.de, AutoScout24 — implementacja `ListingSource`.
- Faktyczna wysyłka e-maili i web-push (tabele i uprawnienia już są).
- Wykres historii cen na karcie oferty.
- Testy: Vitest + Testcontainers dla warstwy repozytoriów.
