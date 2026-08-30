import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadTag {
  id: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadTagInput {
  name: string;
  color?: string;
  active?: boolean;
}

const QUERY_KEY = ['lead_tags'];

export const useLeadTags = (onlyActive = false) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, onlyActive],
    queryFn: async () => {
      let q = supabase.from('lead_tags').select('*').order('name');
      if (onlyActive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadTag[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async (input: LeadTagInput) => {
      const { data, error } = await supabase
        .from('lead_tags')
        .insert([{ ...input }])
        .select()
        .single();
      if (error) throw error;
      return data as LeadTag;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error('Erro ao adicionar tag: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LeadTagInput> & { id: string }) => {
      const { error } = await supabase.from('lead_tags').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error('Erro ao atualizar tag: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error('Erro ao remover tag: ' + e.message),
  });

  return {
    tags: query.data ?? [],
    isLoading: query.isLoading,
    addTag: (input: LeadTagInput) => addMutation.mutateAsync(input),
    updateTag: (id: string, patch: Partial<LeadTagInput>) => updateMutation.mutateAsync({ id, ...patch }),
    deleteTag: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};

// ── Tags de um lead específico (marcar/desmarcar) ────────────────────────────

export const useLeadTagsFor = (leadId: string | undefined) => {
  return useQuery({
    queryKey: ['leads_tags', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_tags')
        .select('tag_id, tag:lead_tags(id, name, color)')
        .eq('lead_id', leadId as string);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.tag as LeadTag).filter(Boolean);
    },
    enabled: !!leadId,
    staleTime: 60 * 1000,
  });
};

export const useToggleLeadTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, tagId, assign }: { leadId: string; tagId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase.from('leads_tags').insert({ lead_id: leadId, tag_id: tagId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leads_tags')
          .delete()
          .eq('lead_id', leadId)
          .eq('tag_id', tagId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['leads_tags', leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-by-stage'] });
    },
    onError: (e: Error) => toast.error('Erro ao marcar tag: ' + e.message),
  });
};
