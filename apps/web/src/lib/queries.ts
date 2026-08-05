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
  ListingStats,
  Notification,
  NotificationPreferences,
  Paginated,
  Taxonomy,
  User,
} from './types';

export const queryKeys = {
  groups: ['filter-groups'] as const,
  group: (id: string) => ['filter-groups', id] as const,
  groupRuns: (id: string) => ['filter-groups', id, 'runs'] as const,
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

export function useGroupRuns(id: string) {
  return useQuery({
    queryKey: queryKeys.groupRuns(id),
    queryFn: () => api.get<FetchRun[]>(`/api/filter-groups/${id}/runs`),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.groupRuns(groupId) });
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

export function useListingStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.get<ListingStats>('/api/listings/stats'),
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

export function useNotifications(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => api.get<Paginated<Notification>>('/api/notifications', params),
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
