import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChannelHealthStatus {
  channel: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  details: {
    healthy: boolean;
    latency_ms: number;
    error: string | null;
    checked_at: string;
  };
  created_at: string;
}

/**
 * Get the latest health check result for each active channel.
 * Returns a map: channel → latest health status.
 */
export function useOmniChannelHealth() {
  return useQuery({
    queryKey: ['omni-channel-health'],
    queryFn: async (): Promise<Record<string, ChannelHealthStatus>> => {
      const { data, error } = await supabase
        .from('omni_channel_alerts')
        .select('channel, severity, title, details, created_at')
        .eq('alert_type', 'health_check')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Deduplicate: keep only the latest per channel
      const map: Record<string, ChannelHealthStatus> = {};
      for (const row of data ?? []) {
        if (!map[row.channel]) {
          map[row.channel] = row as ChannelHealthStatus;
        }
      }
      return map;
    },
    refetchInterval: 60_000, // refresh every minute
    staleTime: 30_000,
  });
}

/**
 * Get health check history for a specific channel (last 50 entries).
 */
export function useOmniChannelHealthHistory(channel: string) {
  return useQuery({
    queryKey: ['omni-channel-health-history', channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('omni_channel_alerts')
        .select('*')
        .eq('alert_type', 'health_check')
        .eq('channel', channel)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!channel,
    staleTime: 30_000,
  });
}
