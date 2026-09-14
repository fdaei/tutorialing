'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/services/api';

export type UserNotification = {
  id: string;
  type: string;
  titleFa: string;
  titleEn: string;
  bodyFa: string;
  bodyEn: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};

export const notificationsQueryKey = ['notifications'] as const;

export function useNotifications(enabled = true) {
  const query = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => api<UserNotification[]>('/notifications'),
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 120_000 : false,
  });
  const unread = query.data?.filter((item) => !item.readAt).length ?? 0;
  return { ...query, unread };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PUT' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = queryClient.getQueryData<UserNotification[]>(notificationsQueryKey);
      queryClient.setQueryData<UserNotification[]>(notificationsQueryKey, (items) =>
        items?.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(notificationsQueryKey, context.previous);
    },
  });
}
