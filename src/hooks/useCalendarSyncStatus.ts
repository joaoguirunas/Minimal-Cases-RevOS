import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarSyncEntry {
  google: boolean;
  microsoft: boolean;
}

/**
 * Returns a map of { [userId]: { google, microsoft } } for all users
 * that have at least one active calendar connection.
 */
export function useCalendarSyncStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-sync-status'],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('user_calendar_connections')
        .select('user_id, provider')
        .eq('is_active', true);

      const map: Record<string, CalendarSyncEntry> = {};
      for (const row of rows ?? []) {
        if (!map[row.user_id]) map[row.user_id] = { google: false, microsoft: false };
        if (row.provider === 'google') map[row.user_id].google = true;
        if (row.provider === 'microsoft') map[row.user_id].microsoft = true;
      }
      return map;
    },
    staleTime: 2 * 60 * 1000,
  });

  return { syncStatus: data ?? {}, isLoading };
}
