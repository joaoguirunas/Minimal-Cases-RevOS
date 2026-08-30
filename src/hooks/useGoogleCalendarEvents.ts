import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  calendar_source: 'google';
  html_link?: string | null;
  /** settings_users.id of the calendar owner */
  user_id?: string;
}

export type GCalSyncError =
  | 'not_connected'
  | 'token_expired'
  | 'api_disabled'
  | 'api_error'
  | null;

interface UseGoogleCalendarEventsParams {
  /** Array of settings_users.id to sync. Pass [] to disable. */
  userIds: string[];
  dateStart: string; // 'YYYY-MM-DD'
  dateEnd: string;   // 'YYYY-MM-DD'
  enabled?: boolean;
}

interface GCalResult {
  events: GoogleCalendarEvent[];
  connected: boolean;
  error: GCalSyncError;
  error_detail?: string;
}

export const useGoogleCalendarEvents = ({
  userIds,
  dateStart,
  dateEnd,
  enabled = true,
}: UseGoogleCalendarEventsParams) => {
  return useQuery({
    queryKey: ['google-calendar-events', ...userIds.slice().sort(), dateStart, dateEnd],
    queryFn: async (): Promise<GCalResult> => {
      if (userIds.length === 0) return { events: [], connected: false, error: 'not_connected' };

      const { data, error } = await supabase.functions.invoke('google-cal-sync-events', {
        body: { user_ids: userIds, date_start: dateStart, date_end: dateEnd },
      });

      if (error) {
        console.warn('google-cal-sync-events invoke error:', error);
        return { events: [], connected: false, error: 'api_error', error_detail: error.message };
      }

      return {
        events: (data?.events ?? []) as GoogleCalendarEvent[],
        connected: data?.connected ?? false,
        error: (data?.error ?? null) as GCalSyncError,
        error_detail: data?.error_detail,
      };
    },
    enabled: enabled && userIds.length > 0 && !!dateStart && !!dateEnd,
    staleTime: 90 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
