import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadType {
  id: string;
  name: string;
  description: string;
  csv_headers: string[];
  csv_example: string[];
  is_active: boolean;
  sort_order: number;
  whatsapp_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadTypeInput {
  name: string;
  description?: string;
  csv_headers: string[];
  csv_example?: string[];
  sort_order?: number;
  whatsapp_template_id?: string | null;
}

const QUERY_KEY = ['lead_types'];

export const useLeadTypes = (onlyActive = true) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, onlyActive],
    queryFn: async () => {
      let q = supabase
        .from('lead_types')
        .select('*')
        .order('sort_order')
        .order('name');
      if (onlyActive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadType[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async (input: LeadTypeInput) => {
      const { data, error } = await supabase
        .from('lead_types')
        .insert([{ ...input }])
        .select()
        .single();
      if (error) throw error;
      return data as LeadType;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error('Erro ao adicionar tipo: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LeadTypeInput> & { id: string }) => {
      const { error } = await supabase
        .from('lead_types')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error('Erro ao atualizar tipo: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error('Erro ao remover tipo: ' + e.message),
  });

  return {
    leadTypes: query.data ?? [],
    isLoading: query.isLoading,
    addLeadType: (input: LeadTypeInput) => addMutation.mutateAsync(input),
    updateLeadType: (id: string, patch: Partial<LeadTypeInput>) => updateMutation.mutateAsync({ id, ...patch }),
    deleteLeadType: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
