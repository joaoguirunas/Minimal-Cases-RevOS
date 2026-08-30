import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LogSource =
  | 'edge_logs'
  | 'function_edge_logs'
  | 'auth_logs'
  | 'postgres_logs'
  | 'realtime_logs'
  | 'storage_logs'
  | 'pgbouncer_logs';

export interface LogEntry {
  id: string;
  timestamp: string;
  event_message: string;
  metadata: Record<string, unknown>[] | null;
}

export interface UseSupabaseLogsParams {
  source: LogSource;
  timeRange: string;
  search: string;
  limit?: number;
  enabled?: boolean;
}

export function useSupabaseLogs({
  source,
  timeRange,
  search,
  limit = 100,
  enabled = true,
}: UseSupabaseLogsParams) {
  return useQuery({
    queryKey: ['supabase-logs', source, timeRange, search, limit],
    queryFn: async (): Promise<LogEntry[]> => {
      const { data, error } = await supabase.functions.invoke('logs-proxy', {
        body: { source, timeRange, search, limit },
      });

      if (error) throw error;
      return (data?.result ?? []) as LogEntry[];
    },
    enabled,
    staleTime: 0,
    refetchInterval: false,
  });
}
