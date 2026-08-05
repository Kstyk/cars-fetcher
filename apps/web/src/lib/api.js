const ACCESS_TOKEN_KEY = 'cf_access_token';
export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, message, code, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
}
export function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function setAccessToken(token) {
    if (token)
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else
        localStorage.removeItem(ACCESS_TOKEN_KEY);
}
let onUnauthorized = () => { };
export function setUnauthorizedHandler(handler) {
    onUnauthorized = handler;
}
/** Shared so that N parallel 401s trigger exactly one refresh round-trip. */
let refreshPromise = null;
async function refreshAccessToken() {
    refreshPromise ??= (async () => {
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: '{}',
            });
            if (!response.ok)
                return null;
            const data = (await response.json());
            setAccessToken(data.accessToken);
            return data.accessToken;
        }
        catch {
            return null;
        }
        finally {
            // Cleared on the next tick so concurrent callers observe this result.
            queueMicrotask(() => {
                refreshPromise = null;
            });
        }
    })();
    return refreshPromise;
}
export async function apiFetch(path, { body, searchParams, skipAuthRetry, ...init } = {}) {
    const url = new URL(path, window.location.origin);
    for (const [key, value] of Object.entries(searchParams ?? {})) {
        if (value === undefined || value === null || value === '')
            continue;
        if (Array.isArray(value)) {
            if (value.length > 0)
                url.searchParams.set(key, value.join(','));
        }
        else {
            url.searchParams.set(key, String(value));
        }
    }
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token)
        headers.set('Authorization', `Bearer ${token}`);
    if (body !== undefined)
        headers.set('Content-Type', 'application/json');
    const response = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401 && !skipAuthRetry) {
        const fresh = await refreshAccessToken();
        if (fresh) {
            return apiFetch(path, {
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
    if (response.status === 204)
        return undefined;
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
        const error = payload
            ?.error;
        throw new ApiError(response.status, error?.message ?? `Żądanie nie powiodło się (${response.status})`, error?.code, error?.details);
    }
    return payload;
}
export const api = {
    get: (path, searchParams) => apiFetch(path, { method: 'GET', ...(searchParams ? { searchParams } : {}) }),
    post: (path, body) => apiFetch(path, { method: 'POST', body }),
    put: (path, body) => apiFetch(path, { method: 'PUT', body }),
    patch: (path, body) => apiFetch(path, { method: 'PATCH', body }),
    delete: (path) => apiFetch(path, { method: 'DELETE' }),
};
