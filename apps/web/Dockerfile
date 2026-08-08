# syntax=docker/dockerfile:1

# Built from the repository root so the workspace lockfile is available.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cars-fetcher/web --include-workspace-root --ignore-scripts

COPY apps/web apps/web
RUN npm run build --workspace @cars-fetcher/web

FROM nginx:1.27-alpine AS runtime
# nginx terminates the browser connection and proxies /api to the API
# container, so the app stays on a single origin and the refresh cookie works.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
