import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FollowupQueueStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'cancelled';
export type FollowupQueueSourceType = 'stage' | 'meeting';

export interface FollowupQueueEntry {
  id: string;
  followup_id: string | null;
  meeting_followup_id: string | null;
  lead_id: string;
  person_id: string | null;
  channel: string;
  template_id: string | null;
  message: string | null;
  subject: string | null;
  phone_number: string | null;
  source_type: FollowupQueueSourceType;
  scheduled_for: string;
  fired_at: string | null;
  status: FollowupQueueStatus;
  message_id: number | null;
  response_data: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  lead?: {
    id: string;
    title: string | null;
    people_id: string | null;
  } | null;
  pessoa?: {
    id: string;
    name: string;
    whatsapp: string | null;
    email: string | null;
  } | null;
}

export interface FollowupQueueFilters {
  status?: FollowupQueueStatus | 'all';
  channel?: string;
  lead_id?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useFollowupQueue = (filters?: FollowupQueueFilters) => {
  return useQuery({
    queryKey: ['followup-queue', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('followup_queue')
        .select(`
          *,
          lead:lead_id (id, title, people_id),
          pessoa:person_id (id, name, whatsapp, email)
        `)
        .order('scheduled_for', { ascending: false })
        .limit(200);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters?.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }
      if (filters?.dateFrom) {
        query = query.gte('scheduled_for', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('scheduled_for', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as FollowupQueueEntry[];
    },
    staleTime: 30 * 1000, // 30s — dados mudam frequentemente
    refetchInterval: 60 * 1000, // auto-refresh a cada 1 min
  });
};

export const useCancelFollowupQueue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('followup_queue')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending'); // só cancela se ainda pending
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      toast.success('Follow-up cancelado');
    },
    onError: () => toast.error('Erro ao cancelar follow-up'),
  });
};

export const useFollowupQueueStats = () => {
  return useQuery({
    queryKey: ['followup-queue-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('followup_queue')
        .select('status');
      if (error) throw error;
      const rows = (data ?? []) as { status: string }[];
      return {
        total:     rows.length,
        pending:   rows.filter(r => r.status === 'pending').length,
        queued:    rows.filter(r => r.status === 'queued').length,
        sent:      rows.filter(r => r.status === 'sent').length,
        failed:    rows.filter(r => r.status === 'failed').length,
        cancelled: rows.filter(r => r.status === 'cancelled').length,
      };
    },
    staleTime: 30 * 1000,
  });
};
