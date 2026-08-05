import { useMutation, useQuery, useQueryClient, } from '@tanstack/react-query';
import { api } from './api';
export const queryKeys = {
    groups: ['filter-groups'],
    group: (id) => ['filter-groups', id],
    groupRuns: (id) => ['filter-groups', id, 'runs'],
    listings: (params) => ['listings', params],
    listing: (id) => ['listings', id],
    stats: ['listings', 'stats'],
    favorites: ['favorites'],
    notifications: (params) => ['notifications', params],
    unreadCount: ['notifications', 'unread-count'],
    preferences: ['notifications', 'preferences'],
};
/* --------------------------------- Groups --------------------------------- */
export function useFilterGroups() {
    return useQuery({
        queryKey: queryKeys.groups,
        queryFn: () => api.get('/api/filter-groups'),
    });
}
export function useFilterGroup(id, options) {
    return useQuery({
        queryKey: queryKeys.group(id),
        queryFn: () => api.get(`/api/filter-groups/${id}`),
        enabled: options?.enabled ?? true,
    });
}
export function useGroupRuns(id) {
    return useQuery({
        queryKey: queryKeys.groupRuns(id),
        queryFn: () => api.get(`/api/filter-groups/${id}/runs`),
    });
}
export function useCreateGroup() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.post('/api/filter-groups', input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
        },
    });
}
export function useUpdateGroup(id) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.patch(`/api/filter-groups/${id}`, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            void queryClient.invalidateQueries({ queryKey: queryKeys.group(id) });
        },
    });
}
export function useDeleteGroup() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/api/filter-groups/${id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            void queryClient.invalidateQueries({ queryKey: ['listings'] });
        },
    });
}
export function useAddFilter(groupId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.post(`/api/filter-groups/${groupId}/filters`, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
        },
    });
}
export function useDeleteFilter(groupId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (filterId) => api.delete(`/api/filter-groups/${groupId}/filters/${filterId}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
        },
    });
}
export function useFetchGroup() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (groupId) => api.post(`/api/filter-groups/${groupId}/fetch`),
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
export function useListings(params, options) {
    return useQuery({
        queryKey: queryKeys.listings(params),
        queryFn: () => api.get('/api/listings', params),
        placeholderData: (previous) => previous,
        ...options,
    });
}
export function useListingStats() {
    return useQuery({
        queryKey: queryKeys.stats,
        queryFn: () => api.get('/api/listings/stats'),
    });
}
export function useFavorites() {
    return useQuery({
        queryKey: queryKeys.favorites,
        queryFn: () => api.get('/api/favorites'),
    });
}
export function useToggleFavorite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ listingId, isFavorite }) => isFavorite
            ? api.delete(`/api/listings/${listingId}/favorite`)
            : api.put(`/api/listings/${listingId}/favorite`, {}),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['listings'] });
            void queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
        },
    });
}
/* ------------------------------ Notifications ----------------------------- */
export function useNotifications(params = {}) {
    return useQuery({
        queryKey: queryKeys.notifications(params),
        queryFn: () => api.get('/api/notifications', params),
    });
}
export function useUnreadCount() {
    return useQuery({
        queryKey: queryKeys.unreadCount,
        queryFn: () => api.get('/api/notifications/unread-count'),
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
        mutationFn: (ids) => api.post('/api/notifications/read', { ids }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}
export function useNotificationPreferences() {
    return useQuery({
        queryKey: queryKeys.preferences,
        queryFn: () => api.get('/api/notifications/preferences/me'),
    });
}
export function useUpdatePreferences() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (patch) => api.patch('/api/notifications/preferences/me', patch),
        onSuccess: (data) => {
            queryClient.setQueryData(queryKeys.preferences, data);
        },
    });
}
/* --------------------------------- Profile -------------------------------- */
export function useUpdateProfile() {
    return useMutation({
        mutationFn: (patch) => api.patch('/api/auth/me', patch),
    });
}
export function useChangePassword() {
    return useMutation({
        mutationFn: (input) => api.post('/api/auth/change-password', input),
    });
}
