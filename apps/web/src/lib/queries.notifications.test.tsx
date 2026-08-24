import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import type { NotificationPreferences } from './types';
import { useNotificationPreferences, useUpdatePreferences } from './queries';

function fixturePrefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    userId: 'user-1',
    emailEnabled: true,
    pushEnabled: false,
    inAppEnabled: true,
    telegramEnabled: false,
    notifyNewListing: true,
    notifyGoodDeal: true,
    notifyPriceDrop: true,
    notifyListingRemoved: false,
    notifyFetchFailed: false,
    priceDropThresholdPct: 1,
    goodDealThresholdPct: 15,
    digestFrequency: 'daily',
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: 'Europe/Warsaw',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Fresh QueryClient per test, closed over by a stable wrapper component. */
function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('notification preferences - query + mutation wiring', () => {
  it('fetches preferences through the real fetch/MSW/api-client stack', async () => {
    server.use(
      http.get('/api/notifications/preferences/me', () =>
        HttpResponse.json(fixturePrefs({ emailEnabled: false })),
      ),
    );

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.emailEnabled).toBe(false);
    expect(result.current.data?.goodDealThresholdPct).toBe(15);
  });

  it('an update writes straight into the query cache, no refetch needed', async () => {
    let patchBody: unknown;
    server.use(
      http.get('/api/notifications/preferences/me', () => HttpResponse.json(fixturePrefs())),
      http.patch('/api/notifications/preferences/me', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json(fixturePrefs({ notifyGoodDeal: false }));
      }),
    );

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({
        prefs: useNotificationPreferences(),
        update: useUpdatePreferences(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.prefs.isSuccess).toBe(true));
    expect(result.current.prefs.data?.notifyGoodDeal).toBe(true);

    await act(async () => {
      await result.current.update.mutateAsync({ notifyGoodDeal: false });
    });

    expect(patchBody).toEqual({ notifyGoodDeal: false });
    // The mutation's onSuccess calls setQueryData - the *read* hook should
    // reflect the new value immediately, without a second network round-trip.
    await waitFor(() => expect(result.current.prefs.data?.notifyGoodDeal).toBe(false));
  });

  it('surfaces a server error as a rejected mutation, not a silent no-op', async () => {
    server.use(
      http.get('/api/notifications/preferences/me', () => HttpResponse.json(fixturePrefs())),
      http.patch('/api/notifications/preferences/me', () =>
        HttpResponse.json(
          { error: { code: 'bad_request', message: 'Nieprawidłowy próg' } },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useUpdatePreferences(), { wrapper: createWrapper() });

    await expect(
      act(() => result.current.mutateAsync({ goodDealThresholdPct: -5 })),
    ).rejects.toThrow('Nieprawidłowy próg');
  });
});
