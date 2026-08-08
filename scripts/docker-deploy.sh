#!/usr/bin/env bash
# Rebuilds and restarts the Docker stack when application sources changed.
#
# Wired to the Stop hook, so it runs after every completed prompt. Rebuilding
# unconditionally would add a minute to every turn, so a stamp file records the
# newest source mtime from the last deploy and the build is skipped when
# nothing moved.
#
# Output is a single JSON object with `systemMessage`, which Claude Code shows
# in the UI.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 0

STAMP=".docker-deploy-stamp"
LOG="docker-deploy.log"

emit() {
  # jq keeps the message valid JSON even with quotes or newlines in it.
  jq -nc --arg m "$1" '{systemMessage: $m}' 2>/dev/null || printf '{"systemMessage":"%s"}\n' "$1"
  exit 0
}

command -v docker >/dev/null 2>&1 || emit "Docker niedostępny — pominięto przebudowę."

# Newest mtime across everything baked into the images.
newest=$(find apps/api/src apps/api/drizzle apps/web/src apps/web/index.html \
              apps/api/package.json apps/web/package.json package.json \
              apps/api/Dockerfile apps/web/Dockerfile apps/web/nginx.conf \
              docker-compose.yml \
              -type f -newer "$STAMP" -print -quit 2>/dev/null)

if [ -f "$STAMP" ] && [ -z "$newest" ]; then
  exit 0
fi

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
  docker compose up -d --build api web 2>&1
} >"$LOG"
status=$?

if [ "$status" -ne 0 ]; then
  emit "Przebudowa Dockera nie powiodła się — szczegóły w $LOG"
fi

touch "$STAMP"

web_port=$(docker compose port web 80 2>/dev/null | sed 's/.*://')
emit "Docker zaktualizowany: http://localhost:${web_port:-8090}"
