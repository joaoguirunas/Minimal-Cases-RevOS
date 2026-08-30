import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type CalendarProvider = 'google' | 'microsoft';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  google_email: string | null;
  ms_email: string | null;
  google_calendar_id: string | null;
  sync_booking: boolean;
  is_active: boolean;
  created_at: string;
}

const calendarConnectionsKey = (crmUserId?: string) => ['calendar-connections', crmUserId] as const;

export const useCalendarConnections = () => {
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  return useQuery({
    queryKey: calendarConnectionsKey(crmUserId),
    queryFn: async (): Promise<CalendarConnection[]> => {
      if (!crmUserId) return [];
      const { data, error } = await supabase
        .from('user_calendar_connections')
        .select('id, user_id, provider, google_email, ms_email, google_calendar_id, sync_booking, is_active, created_at')
        .eq('user_id', crmUserId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarConnection[];
    },
    enabled: !!crmUserId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useDisconnectCalendar = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_calendar_connections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarConnectionsKey(crmUserId) });
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status', crmUserId] });
      queryClient.invalidateQueries({ queryKey: ['ms-teams-status', crmUserId] });
    },
  });
};

export const usePatchCalendarSync = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;
  const key = calendarConnectionsKey(crmUserId);

  return useMutation({
    mutationFn: async ({ id, sync_booking }: { id: string; sync_booking: boolean }) => {
      const { error } = await supabase
        .from('user_calendar_connections')
        .update({ sync_booking })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, sync_booking }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CalendarConnection[]>(key);
      queryClient.setQueryData<CalendarConnection[]>(key, (old) =>
        (old ?? []).map((conn) => (conn.id === id ? { ...conn, sync_booking } : conn)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
};
