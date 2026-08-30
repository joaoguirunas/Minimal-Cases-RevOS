import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Send, SendStatus, SendChannel } from '@/types/sends';

interface UseSendsFilters {
  status?: SendStatus;
  search?: string;
  channel?: SendChannel;
  createdBy?: string;
}

export const useSends = (filters?: UseSendsFilters) => {
  return useQuery({
    queryKey: ['sends', filters],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log('🔍 Fetching campaigns with filters:', filters);

      let query = (supabase as any)
        .from('sends')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching campaigns:', error);
        throw error;
      }

      return data as Send[];
    },
  });
};

export const useSend = (id: string, options?: { refetchInterval?: number | false | ((query: unknown) => number | false) }) => {
  return useQuery({
    queryKey: ['send', id],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: options?.refetchInterval,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sends')
        .select(`
          *,
          pipeline:leads_pipelines(id, name),
          wa_channel:settings_whatsapp_channels(id, label, phone_number_id, is_default, active),
          created_by_user:settings_users(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error fetching campaign:', error);
        throw error;
      }

      return data as Send;
    },
    enabled: !!id,
  });
};
