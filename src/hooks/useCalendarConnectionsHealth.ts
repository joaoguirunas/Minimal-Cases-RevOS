import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarConnectionHealth {
  user_id: string;
  user_name: string;
  google_email: string;
  is_active: boolean;
  google_token_expires_at: string | null;
  updated_at: string;
  status: 'healthy' | 'expired' | 'unknown';
}

export const useCalendarConnectionsHealth = () => {
  return useQuery<CalendarConnectionHealth[]>({
    queryKey: ['calendar-connections-health'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_calendar_connections')
        .select('user_id, google_email, is_active, google_token_expires_at, updated_at, settings_users(id, name)')
        .eq('is_active', true);

      if (error) throw error;

      const now = Date.now();
      return ((data ?? []) as any[]).map((row) => {
        const expiresAt = row.google_token_expires_at ? new Date(row.google_token_expires_at).getTime() : null;
        let status: 'healthy' | 'expired' | 'unknown' = 'unknown';
        if (!expiresAt) status = 'unknown';
        else if (expiresAt < now) status = 'expired';
        else status = 'healthy';

        return {
          user_id: row.user_id,
          user_name: row.settings_users?.name ?? 'Desconhecido',
          google_email: row.google_email,
          is_active: row.is_active,
          google_token_expires_at: row.google_token_expires_at,
          updated_at: row.updated_at,
          status,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
  });
};
