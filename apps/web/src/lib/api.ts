import type { AuthResponse } from './types';

const ACCESS_TOKEN_KEY = 'cf_access_token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/** Shared so that N parallel 401s trigger exactly one refresh round-trip. */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
      if (!response.ok) return null;
      const data = (await response.json()) as AuthResponse;
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Cleared on the next tick so concurrent callers observe this result.
      queueMicrotask(() => {
        refreshPromise = null;
      });
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  searchParams?: Record<string, unknown>;
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(
  path: string,
  { body, searchParams, skipAuthRetry, ...init }: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) url.searchParams.set(key, value.join(','));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !skipAuthRetry) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      return apiFetch<T>(path, {
        body,
        searchParams,
        ...init,
        skipAuthRetry: true,
      });
    }
    setAccessToken(null);
    onUnauthorized();
    throw new ApiError(401, 'Sesja wygasła, zaloguj się ponownie');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.message ?? `Żądanie nie powiodło się (${response.status})`,
      error?.code,
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, searchParams?: Record<string, unknown>) =>
    apiFetch<T>(path, { method: 'GET', ...(searchParams ? { searchParams } : {}) }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
