import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeadLetterEntry {
  id: string;
  message_id: number;
  channel: string;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  status: 'pending' | 'retrying' | 'exhausted' | 'resolved';
  created_at: string;
  updated_at: string;
}

/**
 * Fetch dead-letter entries with optional status filter.
 */
export function useOmniDeadLetter(status?: string, limit = 20) {
  return useQuery({
    queryKey: ['omni-dead-letter', status, limit],
    queryFn: async () => {
      let query = (supabase as any)
        .from('omni_delivery_dead_letter')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeadLetterEntry[];
    },
    staleTime: 30 * 1000, // 30s — dead-letter changes frequently
  });
}

/**
 * Dead-letter summary stats.
 */
export function useOmniDeadLetterStats() {
  return useQuery({
    queryKey: ['omni-dead-letter-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('omni_delivery_dead_letter')
        .select('status');
      if (error) throw error;

      const entries = data as { status: string }[];
      return {
        pending: entries.filter(e => e.status === 'pending').length,
        exhausted: entries.filter(e => e.status === 'exhausted').length,
        resolved: entries.filter(e => e.status === 'resolved').length,
        total: entries.length,
      };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Manual retry: reset a dead-letter entry for immediate retry.
 */
export function useRetryDeadLetter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      // Reset dead-letter entry
      const { error: dlErr } = await (supabase as any)
        .from('omni_delivery_dead_letter')
        .update({
          status: 'pending',
          next_retry_at: new Date().toISOString(),
        })
        .eq('id', entryId);
      if (dlErr) throw dlErr;

      // Also reset the original message to pending
      const { data: entry } = await (supabase as any)
        .from('omni_delivery_dead_letter')
        .select('message_id')
        .eq('id', entryId)
        .single();

      if (entry?.message_id) {
        await (supabase as any)
          .from('messages')
          .update({ status: 'pending' })
          .eq('id', entry.message_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-dead-letter'] });
      queryClient.invalidateQueries({ queryKey: ['omni-dead-letter-stats'] });
    },
  });
}
