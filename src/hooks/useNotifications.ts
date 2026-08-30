import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMarkConversationRead } from '@/hooks/useMarkConversationRead';
import type { Database } from '@/integrations/supabase/types';

export type AppNotification = Database['public']['Tables']['notifications']['Row'];

const PAGE_SIZE = 20;
const FEED_KEY = ['notifications', 'feed'] as const;
const UNREAD_KEY = ['notifications', 'unread-count'] as const;

const SELECT_COLUMNS =
  'id, event_type, people_id, lead_id, target_user_id, message_id, title, body, channel, unread_messages, read_at, read_by, created_at';

export function useNotifications() {
  const queryClient = useQueryClient();

  const feed = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      let q = supabase
        .from('notifications')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) q = q.lt('created_at', pageParam);

      const { data, error } = await q;
      if (error) throw error;

      const rows = data ?? [];
      return {
        rows,
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30 * 1000,
  });

  const unreadCount = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: FEED_KEY });
    queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
  };

  const markConversationRead = useMarkConversationRead();

  // Fecha UMA notificação pelo id — usado por tipos que não são sobre "abrir a
  // conversa" (ex: meeting_scheduled, um alerta pessoal pro closer). Diferente
  // de markAsRead(peopleId), não cascateia pra messages.seen_at/clients_people.
  const markNotificationRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error('Erro ao marcar notificação como lida: ' + e.message),
  });

  // Ação leve de propósito: só fecha o feed do sino. Não marca as conversas como
  // atendidas — clicar em massa não significa que alguém abriu cada uma delas.
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error('Erro ao marcar notificações como lidas: ' + e.message),
  });

  useEffect(() => {
    const channel = supabase
      .channel('notifications-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: FEED_KEY });
          queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ NOTIFICACOES: realtime channel ${status}`, err?.message || '');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    notifications: feed.data?.pages.flatMap((p) => p.rows) ?? [],
    isLoading: feed.isLoading,
    hasMore: feed.hasNextPage,
    isLoadingMore: feed.isFetchingNextPage,
    loadMore: () => feed.fetchNextPage(),
    unreadCount: unreadCount.data ?? 0,
    markAsRead: (peopleId: string) =>
      markConversationRead.mutate(peopleId, { onSuccess: invalidate }),
    markNotificationRead: (notificationId: string) => markNotificationRead.mutate(notificationId),
    markAllAsRead: () => markAllAsRead.mutate(),
    isMarkingAll: markAllAsRead.isPending,
  };
}
