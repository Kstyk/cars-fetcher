# Model danych (ERD)

Diagram odzwierciedla `apps/api/src/db/schema.ts`. Podgląd: w VS Code otwórz ten
plik i naciśnij `Ctrl+Shift+V` (Markdown Preview renderuje Mermaid natywnie).

```mermaid
erDiagram
    users ||--o| notification_preferences : "ma ustawienia"
    users ||--o{ refresh_tokens : "ma sesje"
    users ||--o{ push_subscriptions : "ma urządzenia"
    users ||--o{ filter_groups : "posiada"
    users ||--o{ favorites : "zapisuje"
    users ||--o{ notifications : "otrzymuje"

    filter_groups ||--o{ filters : "zawiera"
    filter_groups ||--o{ listing_matches : "grupuje"
    filter_groups ||--o{ fetch_runs : "uruchamia"
    filter_groups ||--o{ notifications : "dotyczy"

    filters ||--o{ listing_matches : "dopasowuje"
    filters ||--o{ fetch_runs : "wykonuje"

    listings ||--o{ listing_matches : "trafia do"
    listings ||--o{ listing_price_history : "ma historię cen"
    listings ||--o{ favorites : "jest ulubione"
    listings ||--o{ notifications : "wywołuje"

    users {
        uuid id PK
        varchar email UK "unikalny case-insensitive"
        text password_hash "bcrypt, 12 rund"
        varchar first_name
        varchar last_name
        enum role "user | admin"
        boolean is_active
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK "SHA-256, nie plaintext"
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by_token_id "rotacja tokenów"
        text user_agent
        varchar ip_address
        timestamptz created_at
    }

    notification_preferences {
        uuid user_id PK_FK
        boolean email_enabled
        boolean push_enabled
        boolean in_app_enabled
        boolean notify_new_listing
        boolean notify_price_drop
        boolean notify_listing_removed
        boolean notify_fetch_failed
        numeric price_drop_threshold_pct
        enum digest_frequency "instant..off"
        smallint quiet_hours_start
        smallint quiet_hours_end
        varchar timezone
    }

    push_subscriptions {
        uuid id PK
        uuid user_id FK
        text endpoint UK
        text p256dh
        text auth
        text user_agent
        timestamptz last_used_at
    }

    filter_groups {
        uuid id PK
        uuid user_id FK
        varchar name "unikalna w obrębie użytkownika"
        text description
        varchar color
        varchar icon
        boolean is_active
        boolean notify_on_new
        integer refresh_interval_minutes
        timestamptz last_fetched_at
        integer position
    }

    filters {
        uuid id PK
        uuid group_id FK
        enum provider "otomoto | olx | ..."
        varchar name
        boolean is_active
        varchar make
        varchar model
        varchar generation
        varchar version
        varchar query
        smallint year_from
        smallint year_to
        numeric price_from
        numeric price_to
        varchar currency
        integer mileage_from
        integer mileage_to
        integer engine_power_from
        integer engine_power_to
        integer engine_capacity_from
        integer engine_capacity_to
        enum_array fuel_types
        enum_array gearboxes
        enum_array body_types
        enum_array drive_types
        enum condition
        enum seller_type
        boolean exclude_damaged
        boolean only_with_photos
        boolean registered_in_pl
        boolean first_owner
        varchar country_origin
        varchar region
        varchar city
        integer radius_km
        jsonb extra_params "passthrough dla dostawcy"
    }

    listings {
        uuid id PK
        enum provider "część klucza naturalnego"
        varchar external_id "UK razem z provider"
        text url "deep link do serwisu"
        text title
        varchar make
        varchar model
        varchar generation
        varchar version
        numeric price
        varchar currency
        boolean price_gross
        boolean has_vat_invoice
        smallint year
        integer mileage_km
        enum fuel_type
        enum gearbox
        enum body_type
        enum drive_type
        integer engine_capacity_cm3
        integer engine_power_hp
        smallint doors
        smallint seats
        varchar color
        enum condition
        boolean is_damaged
        varchar vin
        timestamptz first_registration_date
        varchar country_origin
        enum seller_type
        varchar seller_name
        varchar city
        varchar region
        varchar country
        numeric latitude
        numeric longitude
        text thumbnail_url
        smallint images_count
        timestamptz published_at
        timestamptz first_seen_at
        timestamptz last_seen_at
        boolean is_active
        timestamptz deactivated_at
        jsonb raw "surowa odpowiedź dostawcy"
    }

    listing_price_history {
        uuid id PK
        uuid listing_id FK
        numeric price
        varchar currency
        numeric delta_amount
        numeric delta_pct
        timestamptz recorded_at
    }

    listing_matches {
        uuid id PK
        uuid listing_id FK "UK razem z filter_id"
        uuid filter_id FK
        uuid group_id FK "denormalizacja pod zapytania grupowe"
        integer rank
        timestamptz first_matched_at
        timestamptz last_matched_at
        timestamptz notified_at
    }

    favorites {
        uuid user_id PK_FK
        uuid listing_id PK_FK
        text note
        smallint rating "1-5"
        timestamptz created_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        enum type "new_listing | price_drop | ..."
        enum channel "in_app | email | push"
        varchar title
        text body
        uuid listing_id FK
        uuid group_id FK
        jsonb payload
        timestamptz read_at
        timestamptz sent_at
        timestamptz created_at
    }

    fetch_runs {
        uuid id PK
        enum provider
        uuid group_id FK
        uuid filter_id FK
        enum status "pending | running | success | partial | failed"
        varchar trigger "manual | scheduler | seed"
        integer pages_fetched
        integer items_seen
        integer items_new
        integer items_updated
        text error_message
        timestamptz started_at
        timestamptz finished_at
        integer duration_ms
    }

    provider_tokens {
        enum provider PK
        text access_token
        text refresh_token
        varchar token_type
        text scope
        timestamptz expires_at
        timestamptz obtained_at
    }
```

## Kluczowe decyzje projektowe

### 1. `listings` są globalne, nie per-użytkownik

Jedno ogłoszenie z Otomoto to **jeden wiersz** w bazie, niezależnie od tego ilu
użytkowników je znalazło. Klucz naturalny to `(provider, external_id)` —
`UNIQUE`, więc powtórne pobranie robi `UPDATE`, a nie duplikat.

Powiązanie z użytkownikiem idzie przez łańcuch:

```
users → filter_groups → filters → listing_matches → listings
```

Dzięki temu ta sama Toyota RAV4 znaleziona przez dwie różne grupy filtrów
zajmuje jeden wiersz, ale ma dwa wiersze w `listing_matches`.

### 2. `listing_matches` przechowuje `group_id` mimo że wynika z `filter_id`

Celowa denormalizacja. Widok „pokaż wszystkie oferty z grupy X" to najczęstsze
zapytanie w aplikacji — bez tego każde wymagałoby joina przez `filters`.
Indeks `(group_id, first_matched_at)` obsługuje je bezpośrednio.

### 3. Grupy filtrów = to, o co prosiłeś

`filter_groups` to nazwany worek, `filters` to pojedyncze kryteria w środku:

| Grupa                      | Filtry w grupie            |
| -------------------------- | -------------------------- |
| „Skandynawia i Japonia”     | Volvo, Toyota              |
| „Korea i Japonia – budżet”  | Mazda, Kia                 |

Pobieranie działa **na poziomie grupy** — `runGroup()` przechodzi po wszystkich
aktywnych filtrach i scala wyniki pod jedną grupą.

### 4. Brak tabeli ze szczegółami auta

Zgodnie z założeniem: `listings.url` prowadzi bezpośrednio do oferty w serwisie.
Trzymamy tylko to, co potrzebne do listy, filtrowania i sortowania. Pełna
odpowiedź dostawcy ląduje w `listings.raw` (jsonb) — pozwala dodać kolumnę
później i uzupełnić ją bez ponownego odpytywania API.

### 5. Historia cen jako append-only

`listing_price_history` dostaje wiersz **tylko gdy cena się zmieniła**.
`delta_pct` liczone przy zapisie, więc „pokaż spadki > 5%” to zwykłe `WHERE`,
bez okien czasowych i self-joinów.

### 6. Miękkie usuwanie ogłoszeń

Gdy dostawca przestaje zwracać ofertę, ustawiamy `is_active = false` zamiast
kasować wiersz. Ulubione i historia cen nadal działają, a oferta znika z widoków
domyślnych.

### 7. Rotacja refresh tokenów

`refresh_tokens.token_hash` to SHA-256 — dump bazy nie daje możliwości
podszycia się. Każde odświeżenie tworzy nowy wiersz i ustawia
`replaced_by_token_id` na starym, więc ponowne użycie zrotowanego tokenu jest
wykrywalne.

### 8. `provider_tokens` przeżywa restart

Token OAuth2 z Otomoto (access + refresh) jest cache'owany w bazie. Restart API
nie wywołuje ponownego logowania do Otomoto — token jest odnawiany dopiero
60 s przed faktycznym wygaśnięciem.
