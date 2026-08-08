import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from './api';
import type {
  Favorite,
  FetchRun,
  FilterGroup,
  GroupRunResult,
  Listing,
  ListingDetail,
  ListingStats,
  Notification,
  NotificationPreferences,
  Paginated,
  ProviderInfo,
  Taxonomy,
  User,
} from './types';

export const queryKeys = {
  groups: ['filter-groups'] as const,
  group: (id: string) => ['filter-groups', id] as const,
  groupRuns: (id: string, limit: number) => ['filter-groups', id, 'runs', limit] as const,
  listings: (params: Record<string, unknown>) => ['listings', params] as const,
  listing: (id: string) => ['listings', id] as const,
  stats: ['listings', 'stats'] as const,
  favorites: ['favorites'] as const,
  notifications: (params: Record<string, unknown>) =>
    ['notifications', params] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
};

/* -------------------------------- Taxonomy -------------------------------- */

/**
 * Static dictionary of makes, models and equipment. It never changes during a
 * session, so it is cached for the whole session rather than refetched.
 */
export function useTaxonomy() {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: () => api.get<Taxonomy>('/api/taxonomy'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Which marketplaces exist and which of them actually have an adapter. */
export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get<ProviderInfo[]>('/api/providers'),
    staleTime: Infinity,
  });
}

/* --------------------------------- Groups --------------------------------- */

export function useFilterGroups() {
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => api.get<FilterGroup[]>('/api/filter-groups'),
  });
}

export function useFilterGroup(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.group(id),
    queryFn: () => api.get<FilterGroup>(`/api/filter-groups/${id}`),
    enabled: options?.enabled ?? true,
  });
}

export function useGroupRuns(id: string, limit = 50) {
  return useQuery({
    queryKey: queryKeys.groupRuns(id, limit),
    queryFn: () => api.get<FetchRun[]>(`/api/filter-groups/${id}/runs`, { limit }),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) =>
      api.post<FilterGroup>('/api/filter-groups', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    },
  });
}

export function useUpdateGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) =>
      api.patch<FilterGroup>(`/api/filter-groups/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(id) });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/filter-groups/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useAddFilter(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) =>
      api.post(`/api/filter-groups/${groupId}/filters`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });
}

export function useUpdateFilter(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ filterId, input }: { filterId: string; input: unknown }) =>
      api.put(`/api/filter-groups/${groupId}/filters/${filterId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });
}

export function useDeleteFilter(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filterId: string) =>
      api.delete<void>(`/api/filter-groups/${groupId}/filters/${filterId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });
}

export function useFetchGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      api.post<GroupRunResult>(`/api/filter-groups/${groupId}/fetch`),
    onSuccess: (_result, groupId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      // Partial key - matches useGroupRuns regardless of its `limit`.
      void queryClient.invalidateQueries({ queryKey: ['filter-groups', groupId, 'runs'] });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/* -------------------------------- Listings -------------------------------- */

export function useListings(
  params: Record<string, unknown>,
  options?: Partial<UseQueryOptions<Paginated<Listing>>>,
) {
  return useQuery({
    queryKey: queryKeys.listings(params),
    queryFn: () => api.get<Paginated<Listing>>('/api/listings', params),
    placeholderData: (previous) => previous,
    ...options,
  });
}

/** Fetched lazily - only once a card's price-history dialog is actually opened. */
export function useListingDetail(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => api.get<ListingDetail>(`/api/listings/${id}`),
    enabled: options.enabled ?? true,
  });
}

export function useListingStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.get<ListingStats>('/api/listings/stats'),
  });
}

/** Cities that actually appear in the user's listings, for the location filter. */
export function useCities() {
  return useQuery({
    queryKey: ['listings', 'cities'],
    queryFn: () =>
      api.get<Array<{ city: string; region: string | null }>>('/api/listings/cities'),
    staleTime: 5 * 60_000,
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: queryKeys.favorites,
    queryFn: () => api.get<Favorite[]>('/api/favorites'),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, isFavorite }: { listingId: string; isFavorite: boolean }) =>
      isFavorite
        ? api.delete<void>(`/api/listings/${listingId}/favorite`)
        : api.put(`/api/listings/${listingId}/favorite`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });
}

/* ------------------------------ Notifications ----------------------------- */

export function useNotifications(
  params: Record<string, unknown> = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => api.get<Paginated<Notification>>('/api/notifications', params),
    enabled: options?.enabled ?? true,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: () => api.get<{ count: number }>('/api/notifications/unread-count'),
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/api/notifications/read', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () =>
      api.get<NotificationPreferences>('/api/notifications/preferences/me'),
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      api.patch<NotificationPreferences>(
        '/api/notifications/preferences/me',
        patch,
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.preferences, data);
    },
  });
}

/* --------------------------------- Profile -------------------------------- */

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (patch: { firstName?: string; lastName?: string }) =>
      api.patch<User>('/api/auth/me', patch),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<void>('/api/auth/change-password', input),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => api.post<void>('/api/auth/resend-verification'),
  });
}
