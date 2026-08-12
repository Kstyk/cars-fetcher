import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from './api';
import type {
  AdminFetchRun,
  AdminScrapers,
  AdminStats,
  AdminUser,
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
  SellerProfile,
  VehicleHistoryReport,
  VehicleModelDetail,
  VehicleModelSummary,
  VehicleSearchResult,
  VinLookupResult,
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

/** Folds one or more groups into a target group; sources end up deleted. */
export function useMergeGroups() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetGroupId,
      sourceGroupIds,
    }: {
      targetGroupId: string;
      sourceGroupIds: string[];
    }) =>
      api.post<FilterGroup>(`/api/filter-groups/${targetGroupId}/merge`, { sourceGroupIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
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

/** Drops matches whose listing no longer fits its filter's *current* criteria. */
export function useCleanStaleMatches(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ removed: number; checkedFilters: number }>(
        `/api/filter-groups/${groupId}/clean-matches`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
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

/** Fires on every click-through to the marketplace - not when a card renders. */
export function useTrackListingView() {
  return useMutation({
    mutationFn: (listingId: string) => api.post<void>(`/api/listings/${listingId}/view`),
  });
}

export function useRecentlyViewed(limit = 60) {
  return useQuery({
    queryKey: ['listings', 'recently-viewed', limit],
    queryFn: () => api.get<Listing[]>('/api/listings/recently-viewed', { limit }),
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

/* ---------------------------------- Admin ---------------------------------- */

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<AdminStats>('/api/admin/stats'),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUser[]>('/api/admin/users'),
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: 'user' | 'admin'; isActive?: boolean } }) =>
      api.patch<void>(`/api/admin/users/${id}`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useAdminScrapers() {
  return useQuery({
    queryKey: ['admin', 'scrapers'],
    queryFn: () => api.get<AdminScrapers>('/api/admin/scrapers'),
    // The whole point is watching something that changes on its own.
    refetchInterval: 30_000,
  });
}

export function useResetScraperCircuit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (host: string) =>
      api.post<{ reset: boolean }>(`/api/admin/scrapers/${encodeURIComponent(host)}/reset`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'scrapers'] });
    },
  });
}

export function useAdminRuns(limit = 50) {
  return useQuery({
    queryKey: ['admin', 'runs', limit],
    queryFn: () => api.get<AdminFetchRun[]>('/api/admin/runs', { limit }),
  });
}

/* ------------------------------ knowledge base ---------------------------- */

export function useKnowledgeMakes() {
  return useQuery({
    queryKey: ['knowledge', 'makes'],
    queryFn: () => api.get<string[]>('/api/knowledge/makes'),
    staleTime: 10 * 60_000, // reference data, not worth refetching often
  });
}

export function useKnowledgeModels(make: string | null) {
  return useQuery({
    queryKey: ['knowledge', 'makes', make, 'models'],
    queryFn: () =>
      api.get<VehicleModelSummary[]>(`/api/knowledge/makes/${encodeURIComponent(make!)}/models`),
    enabled: Boolean(make),
    staleTime: 10 * 60_000,
  });
}

export function useKnowledgeModel(id: string | null) {
  return useQuery({
    queryKey: ['knowledge', 'models', id],
    queryFn: () => api.get<VehicleModelDetail>(`/api/knowledge/models/${id}`),
    enabled: Boolean(id),
  });
}

export function useKnowledgeSearch(q: string) {
  return useQuery({
    queryKey: ['knowledge', 'search', q],
    queryFn: () => api.get<VehicleSearchResult[]>('/api/knowledge/search', { q }),
    enabled: q.trim().length >= 2,
  });
}

export function useKnowledgeGenerateAvailable() {
  return useQuery({
    queryKey: ['knowledge', 'generate', 'available'],
    queryFn: () => api.get<{ available: boolean }>('/api/knowledge/generate/available'),
  });
}

export function useDecodeVin(vin: string | null) {
  return useQuery({
    queryKey: ['vin', vin],
    queryFn: () => api.get<VinLookupResult>(`/api/vin/${encodeURIComponent(vin ?? '')}`),
    enabled: Boolean(vin && vin.trim().length > 0),
    staleTime: Infinity, // a VIN's decode never changes
  });
}

/** Whether a paid history provider (AutoDNA/carVertical) is configured server-side. */
export function useVehicleHistoryAvailable() {
  return useQuery({
    queryKey: ['vin', 'history', 'available'],
    queryFn: () => api.get<{ available: boolean; provider: string | null }>('/api/vin/history/available'),
  });
}

/** Admin-only, paid per call - never fires on its own, only on an explicit click. */
export function useFetchVehicleHistory() {
  return useMutation({
    mutationFn: (vin: string) =>
      api.get<VehicleHistoryReport>(`/api/vin/${encodeURIComponent(vin)}/history`),
  });
}

/* -------------------------------------------------------------------------- */

export function useSellerProfile(name: string | null) {
  return useQuery({
    queryKey: ['sellers', 'profile', name],
    queryFn: () => api.get<SellerProfile>('/api/sellers/profile', { name: name ?? '' }),
    enabled: Boolean(name && name.trim().length > 0),
  });
}

/** Admin-only: asks the LLM to write up a make/model (optionally a specific generation). */
export function useGenerateKnowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { make: string; model: string; generation?: string }) =>
      api.post<VehicleModelDetail>('/api/knowledge/generate', input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'makes'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'makes', result.make] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'models', result.id] });
    },
  });
}
