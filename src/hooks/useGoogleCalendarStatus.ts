import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface GoogleCalendarConnection {
  id: string;
  user_id: string;
  google_email: string;
  google_calendar_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useGoogleCalendarStatus = () => {
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  return useQuery({
    queryKey: ['google-calendar-status', crmUserId],
    queryFn: async (): Promise<GoogleCalendarConnection | null> => {
      if (!crmUserId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('user_calendar_connections')
        .select('id, user_id, google_email, google_calendar_id, is_active, created_at, updated_at')
        .eq('user_id', crmUserId)
        .eq('provider', 'google')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!crmUserId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useDisconnectGoogleCalendar = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  return useMutation({
    mutationFn: async () => {
      if (!crmUserId) throw new Error('Usuário não encontrado');
      const { error } = await supabase
        .from('user_calendar_connections')
        .delete()
        .eq('user_id', crmUserId)
        .eq('provider', 'google');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status', crmUserId] });
      queryClient.invalidateQueries({ queryKey: ['ms-teams-status', crmUserId] });
    },
  });
};
