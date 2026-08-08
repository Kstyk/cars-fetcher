# syntax=docker/dockerfile:1

# The build context is the repository root, because npm workspaces need the
# root package-lock.json to install deterministically.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Only the API workspace is needed; --ignore-scripts keeps the image lean.
RUN npm ci --workspace @cars-fetcher/api --include-workspace-root --ignore-scripts

FROM deps AS build
WORKDIR /app
COPY apps/api apps/api
RUN npm run build --workspace @cars-fetcher/api

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Shared location so the browsers survive the later `USER node` switch.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Production dependencies only - no TypeScript, no drizzle-kit.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @cars-fetcher/api --include-workspace-root --ignore-scripts \
  && npm cache clean --force

# Chromium for the OLX adapter - its CloudFront WAF 403s plain `fetch`/curl
# outright but lets a real browser fingerprint through (see
# providers/scraping/browser-fetch.ts). `--with-deps` pulls in exactly the
# apt packages that build of Chromium needs; must run as root, before the
# `USER node` switch below.
RUN npx playwright install --with-deps chromium \
  && chmod -R 755 /ms-playwright

COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations are applied by the entrypoint, so the SQL has to ship too.
COPY apps/api/drizzle apps/api/drizzle
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Never run the server as root.
USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
