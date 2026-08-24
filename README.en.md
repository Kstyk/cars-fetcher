<p align="center"><a href="README.md">🇵🇱 Polski</a> · <b>🇬🇧 English</b></p>

<h1 align="center">Cars Fetcher</h1>

<p align="center">
  A car-listing aggregator for several Polish marketplaces in one place —
  your own filter groups, deal alerts, cross-marketplace duplicate
  detection, a VIN decoder and market stats, instead of refreshing five
  browser tabs by hand.
</p>

<p align="center">
  <img src="docs/screenshots/01-dashboard.png" alt="Dashboard" width="100%">
</p>

## Why this exists

Car-shopping in Poland means keeping Otomoto, OLX, autoplac.pl, FindCar and
Sprzedajemy.pl open at once, refreshing them by hand, and trying to remember
which listing you've already seen. Cars Fetcher does that for you: define
your criteria once (make, model, price, mileage, location, equipment...),
the app checks every marketplace in the background on a schedule, and
notifies you when something new — or clearly underpriced — shows up. A
personal/hobby project, built for an actual car search — no accounts on any
of these marketplaces, nothing gets posted, it only reads and aggregates
what's already publicly listed.

## Features

**Collecting listings**
- Five live providers: Otomoto (public-page scraper or the official partner
  API), OLX, autoplac.pl, FindCar, Sprzedajemy.pl.
- Shared throttling and `robots.txt` compliance across every HTML adapter —
  nothing hits a host more often than roughly every 2.5s.
- A scheduler (cron) refreshes each filter group on its own interval, plus a
  manual "Fetch now" button.
- Cross-marketplace duplicate detection: the same car listed on several
  sites collapses into one card instead of cluttering results.

**Filter groups**
- A filter is one set of criteria on one marketplace (make, model, price,
  year, mileage, power, fuel, gearbox, body type, colour, location with a
  map radius, country of origin, condition/history, equipment...). A group
  bundles several filters under one name and one shared result list.
- Create a filter across several marketplaces at once with one click.
- Bulk-edit one field across many filters at once.
- Merge groups, duplicate filters, confirmation before deleting one.
- "Clear stale" — drops listings from the results that no longer match
  updated criteria, without losing sales history (see below).

**Notifications**
- Four channels: in-app (bell), e-mail, browser push, Telegram (a
  self-hosted bot on polling — works without a public address).
- Five event types: new listings, **deals** (a new listing that's already
  X% below the market median for similar cars the moment it's ingested — no
  need to wait for a price drop), price drops/rises, removed listings,
  fetch failures.
- Thresholds and quiet hours configurable per user.

**Market & stats**
- Dashboard: active listings, new in 24h, average price, sold count, sales
  by model with share and median days-to-sell — linked straight to the
  matching listings, and the historical count never shrinks when you edit a
  filter.
- Filter usage stats: which filters actually find something, which ones
  haven't surfaced anything new in weeks ("dead" filters).
- Seller/dealer tracking: how many cars a given seller has listed, a
  warning when a listing has been sitting suspiciously long.
- Suggested offer — price vs. market median and median days-to-sell for
  comparable cars.
- Compare tray (up to 4 listings side by side), favourites, recently
  viewed.

**VIN & knowledge**
- Offline VIN decoder: WMI (manufacturer/country), check digit, model
  year — works with no network.
- Enrichment from NHTSA vPIC (US): engine, airbags, seatbelts, body type.
- A direct link to CEPiK (Poland's official, free vehicle-history lookup)
  with the VIN copied to the clipboard.
- Scaffolding for paid AutoDNA/carVertical history reports (disabled by
  default, needs an API key).
- A knowledge base per model: engines, known issues, what to check —
  with optional content generation via Claude (Anthropic API).

**Account & access**
- E-mail+password login or Google OAuth, e-mail verification.
- Admin panel (usage stats, scraper health, users).
- Light/dark theme, fully responsive (filters, tables, buttons on mobile).

## Screenshots

| | |
|---|---|
| ![Filter groups](docs/screenshots/02-groups.png) Filter groups | ![Group detail](docs/screenshots/03-group-detail.png) Group detail |
| ![Filters in a group](docs/screenshots/04-group-filters.png) Filters in a group | ![Listings with the filter panel](docs/screenshots/05-listings.png) Listings & filters |
| ![VIN decoder](docs/screenshots/06-vin.png) VIN decoder | ![Filter usage stats](docs/screenshots/07-usage-stats.png) Filter usage stats |
| ![Profile & notifications](docs/screenshots/08-profile-notifications.png) Profile & notifications | ![Notification bell](docs/screenshots/09-notifications.png) Notification bell |

## Tech stack

**Frontend** — `apps/web`
- React 19 + TypeScript, Vite 7
- TanStack Router (typed routing) + TanStack Query (API cache/sync)
- Tailwind CSS v4 (no config file, tokens live in `styles.css`)
- UI components: [neobrutalism.dev](https://www.neobrutalism.dev) (built on
  shadcn/ui) — thick black borders, hard offset shadows
- Leaflet / react-leaflet (map-based location picking)
- Sonner (toasts), lucide-react (icons)

**Backend** — `apps/api`
- Express 5 + TypeScript
- Drizzle ORM + PostgreSQL 17
- Zod (input validation on every endpoint)
- Playwright + Cheerio (scraping, where a marketplace has no public API)
- node-cron (refresh scheduler), Pino (structured logging)
- JWT (access + refresh), bcrypt, Google OAuth2
- web-push (VAPID), Nodemailer (SMTP), a hand-rolled Telegram Bot API client
  (long polling, no webhook)

**Infrastructure**
- Docker Compose: `postgres`, `api`, `web` (nginx, serves the built frontend
  and proxies `/api`), `adminer` (DB browser)
- Monorepo: npm workspaces (`apps/api`, `apps/web`)

## Repo layout

```
apps/
  api/
    src/
      modules/       # domains: auth, filters, fetching, listings, notifications,
                      # telegram, sellers, stats, vin, knowledge, admin, taxonomy, geo
      providers/      # marketplace adapters (otomoto, olx, autoplac, findcar, sprzedajemy)
      db/             # Drizzle schema + migrations
      jobs/            # scheduler (node-cron)
    drizzle/          # generated SQL migrations
  web/
    src/
      pages/           # one page per route
      components/
        ui/            # neobrutalism.dev/shadcn primitives
      lib/             # API client, TanStack Query hooks, formatting
docker-compose.yml
```

## Running it

### Docker (simplest)

```bash
cp .env.example .env
# fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (see the comment in .env.example)
docker compose up -d --build
```

The app comes up on `http://localhost:8090` (frontend), the API on
`http://localhost:4000`, Adminer (DB browser) on `http://localhost:8080`.
Database migrations run automatically when the `api` container starts.

**A friendly local hostname** instead of `localhost:8090` — the `web`
container also listens on port 80, so add `127.0.0.1 cars-fetcher.pl` (or
any name you like) to your hosts file
(`/etc/hosts` or `C:\Windows\System32\drivers\etc\hosts`) and open it
without a port suffix.

### Dev mode (API/frontend outside Docker)

```bash
npm install
npm run db:up          # just Postgres, in Docker
npm run db:migrate
npm run db:seed         # optional: demo account + sample data
npm run dev             # api on :4000, web on :5173 (hot reload)
```

## Environment variables

Full list with comments in [`.env.example`](.env.example). Required to
start: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Everything below is
optional — a missing integration just turns itself off, the app keeps
running without it:

| Integration | Variables | Effect when absent |
|---|---|---|
| Otomoto (official API) | `OTOMOTO_SOURCE=api`, `OTOMOTO_CLIENT_ID`, `OTOMOTO_CLIENT_SECRET`, `OTOMOTO_USERNAME`, `OTOMOTO_PASSWORD` | Falls back to the public-page scraper |
| E-mail (SMTP) | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, ... | E-mail notifications skipped, a warning is logged |
| Browser push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npm run push:generate-keys`) | Push channel hidden in settings |
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google button hidden |
| Telegram | `TELEGRAM_BOT_TOKEN` (from @BotFather) | Telegram channel shows "not configured" |
| Knowledge base (LLM) | `ANTHROPIC_API_KEY` | Knowledge base only serves hand-curated content |
| Vehicle history report | `VEHICLE_HISTORY_PROVIDER`, `AUTODNA_API_KEY` or `CARVERTICAL_API_KEY` | Paid-report section hidden (VIN lookup still works offline + NHTSA + CEPiK link) |

## Notes / limitations

- **Scraping is configured to behave**: throttled, `robots.txt`-respecting,
  no logging into any marketplace account. The Otomoto adapter prefers the
  official API when it's configured.
- **AutoDNA/carVertical integration** is an architecture scaffold (types,
  routing, UI, admin-gating) built without confirmed, current documentation
  for those paid APIs — needs verification before first real use, flagged
  in the code.
- **VIN check digit** validation only applies to the North American
  market — the app says so explicitly instead of falsely validating
  European VINs.
- Deployment defaults to a LAN — hence Telegram runs on polling rather than
  a webhook, which would need a public HTTPS address.

## Demo account

After `npm run db:seed`: `demo@cars-fetcher.local` / `Demo1234` — an account
pre-loaded with sample filter groups and listings to look around without
wiring up real sources.
