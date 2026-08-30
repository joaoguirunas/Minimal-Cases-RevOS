/**
 * Returns the list of users (in this tenant) who have an active
 * Google Calendar connection.
 *
 * RLS on user_calendar_connections:
 *  - Regular users → only their own row
 *  - Gestors + super_admin → all rows in the tenant
 *
 * This means admins automatically get all connected users;
 * regular users get only themselves (if connected).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectedCalendarUser {
  user_id: string;
  google_email: string;
}

export const useCalendarConnectedUsers = () => {
  return useQuery<ConnectedCalendarUser[]>({
    queryKey: ['calendar-connected-users'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_calendar_connections')
        .select('user_id, google_email')
        .eq('provider', 'google')
        .eq('is_active', true);
      // deduplicate by user_id — a user may have multiple Google accounts
      const seen = new Set<string>();
      return (data ?? []).filter((row: ConnectedCalendarUser) => {
        if (seen.has(row.user_id)) return false;
        seen.add(row.user_id);
        return true;
      }) as ConnectedCalendarUser[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
