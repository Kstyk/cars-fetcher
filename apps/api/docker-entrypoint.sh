#!/bin/sh
set -e

# Compose waits for the database to be healthy, but a healthy Postgres can
# still refuse the first connections while it finishes recovery.
echo "Czekam na bazę danych…"
for i in $(seq 1 30); do
  if node -e "
    const pg = require('pg');
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "Baza odpowiada."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "Baza nie odpowiedziała po 30 próbach — przerywam." >&2
    exit 1
  fi
  sleep 2
done

# Migrations run on every boot; drizzle skips the ones already applied.
echo "Stosuję migracje…"
node apps/api/dist/db/migrate.js

exec "$@"
