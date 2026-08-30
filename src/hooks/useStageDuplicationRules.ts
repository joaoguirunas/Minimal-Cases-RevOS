import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// leads_stage_duplication_rules ainda não está em types.ts (MULTI-PIPELINE-02)
// — mesmo padrão de cast de fronteira usado no resto do projeto.
const sbUntyped = supabase as unknown as SupabaseClient;

export interface StageDuplicationRule {
  id: string;
  source_stage_id: string;
  target_pipeline_id: string;
  target_stage_id: string | null;
  active: boolean;
}

export const useStageDuplicationRules = (stageId?: string) => {
  return useQuery({
    queryKey: ['stage-duplication-rules', stageId],
    queryFn: async () => {
      const { data, error } = await sbUntyped
        .from('leads_stage_duplication_rules')
        .select('id, source_stage_id, target_pipeline_id, target_stage_id, active')
        .eq('source_stage_id', stageId!);
      if (error) throw error;
      return (data ?? []) as StageDuplicationRule[];
    },
    enabled: !!stageId,
  });
};

export const useCreateStageDuplicationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { source_stage_id: string; target_pipeline_id: string; target_stage_id: string | null }) => {
      const { error } = await sbUntyped.from('leads_stage_duplication_rules').insert([rule]);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['stage-duplication-rules', variables.source_stage_id] });
    },
  });
};

export const useDeleteStageDuplicationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; source_stage_id: string }) => {
      const { error } = await sbUntyped.from('leads_stage_duplication_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['stage-duplication-rules', variables.source_stage_id] });
    },
  });
};
