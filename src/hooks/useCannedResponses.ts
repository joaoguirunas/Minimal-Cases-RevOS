import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  channels: string[];
  created_at: string;
  updated_at: string;
}

const QK = ['canned-responses'];

export const useCannedResponses = (canal?: string) => {
  return useQuery({
    queryKey: [...QK, canal],
    queryFn: async (): Promise<CannedResponse[]> => {
      let query = supabase
        .from('canned_responses')
        .select('*')
        .order('title', { ascending: true });

      if (canal) {
        query = query.contains('channels', [canal]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateCannedResponse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; shortcut?: string; content: string; channels?: string[] }) => {
      const { error } = await supabase.from('canned_responses').insert({
        title: payload.title,
        shortcut: payload.shortcut || null,
        content: payload.content,
        channels: payload.channels || ['whatsapp', 'instagram'],
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useUpdateCannedResponse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; title: string; shortcut?: string; content: string; channels?: string[] }) => {
      const { error } = await supabase
        .from('canned_responses')
        .update({
          title: payload.title,
          shortcut: payload.shortcut || null,
          content: payload.content,
          channels: payload.channels || ['whatsapp', 'instagram'],
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useDeleteCannedResponse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('canned_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};
