import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ImportSession {
  id: string;
  send_id: string | null;
  status: 'processing' | 'done' | 'failed';
  total_rows: number;
  processed: number;
  new_people: number;
  existing_people: number;
  failed_rows: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useImportSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['import-session', sessionId],
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data as ImportSession | undefined;
      if (data?.status === 'done' || data?.status === 'failed') return false;
      return 2000;
    },
    queryFn: async (): Promise<ImportSession> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('sends_import_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error) throw error;
      return data as ImportSession;
    },
  });
}
