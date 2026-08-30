import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

// ─── Types from generated schema ─────────────────────────────────────────────

export type LeadFieldDefinition =
  Database['public']['Tables']['lead_field_definitions']['Row'];

export type LeadFieldDefinitionInsert =
  Database['public']['Tables']['lead_field_definitions']['Insert'];

export type LeadFieldDefinitionUpdate =
  Database['public']['Tables']['lead_field_definitions']['Update'];

export type LeadFieldEntityType = 'negocio' | 'lead' | 'pessoa' | 'empresa';
export type LeadFieldCategory =
  | 'qualificacao'
  | 'contato'
  | 'comercial'
  | 'custom'
  | 'outros';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE = 'lead_field_definitions' as const;
const QUERY_KEY = ['lead_field_definitions'] as const;
const STALE_TIME = 5 * 60 * 1000;
const GC_TIME = 10 * 60 * 1000;

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Active definitions for negocio — optionally scoped to a pipeline */
export function useLeadFieldDefinitions(pipelineId?: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'active', 'negocio', pipelineId],
    queryFn: async () => {
      let query = supabase
        .from(TABLE)
        .select('*')
        .eq('active', true)
        .eq('entity_type', 'negocio')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (pipelineId) {
        query = query.or(`pipeline_id.is.null,pipeline_id.eq.${pipelineId}`);
      } else {
        query = query.is('pipeline_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/** Active definitions for any entity type, with optional category filter */
export function useLeadFieldDefinitionsByEntity(
  entityType: LeadFieldEntityType,
  pipelineId?: string,
  category?: LeadFieldCategory,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'active', entityType, pipelineId, category],
    queryFn: async () => {
      let query = supabase
        .from(TABLE)
        .select('*')
        .eq('active', true)
        .eq('entity_type', entityType)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      if ((entityType === 'negocio' || entityType === 'lead') && pipelineId) {
        query = query.or(`pipeline_id.is.null,pipeline_id.eq.${pipelineId}`);
      } else if (entityType === 'negocio' || entityType === 'lead') {
        query = query.is('pipeline_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/** All definitions including inactive — for config pages */
export function useAllLeadFieldDefinitions() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('entity_type', { ascending: true })
        .order('category', { ascending: true })
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateLeadFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: LeadFieldDefinitionInsert) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Campo criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar campo: ' + error.message);
    },
  });
}

export function useUpdateLeadFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: LeadFieldDefinitionUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .update(values)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Campo atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar campo: ' + error.message);
    },
  });
}

export function useDeleteLeadFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Campo excluído!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir campo: ' + error.message);
    },
  });
}

export function useReorderLeadFieldDefinitions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; order_index: number }[]) => {
      const results = await Promise.all(
        updates.map(({ id, order_index }) =>
          supabase.from(TABLE).update({ order_index }).eq('id', id)
        )
      );
      const firstError = results.find((r) => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao reordenar campos: ' + error.message);
    },
  });
}
