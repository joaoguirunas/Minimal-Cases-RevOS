import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { TestPerson } from './useTestSession';

export function useTestContext(person: TestPerson | null) {
  const leadId = person?.lead.id ?? null;
  const [pipelineId, setPipelineId] = useState<string | null>(person?.lead.pipeline_id ?? null);
  const [stageId, setStageId] = useState<string | null>(person?.lead.stage_id ?? null);

  useEffect(() => {
    setPipelineId(person?.lead.pipeline_id ?? null);
    setStageId(person?.lead.stage_id ?? null);
  }, [person?.lead.id, person?.lead.pipeline_id, person?.lead.stage_id]);

  const mutation = useMutation({
    mutationFn: async ({ newPipelineId, newStageId }: { newPipelineId: string; newStageId: string }) => {
      if (!leadId) throw new Error('Nenhum lead selecionado');
      const { error } = await supabase
        .from('leads')
        .update({
          leads_pipelines_id: newPipelineId,
          leads_stages_id: newStageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    onError: (e: Error) =>
      toast({ title: 'Erro ao mover lead', description: e.message, variant: 'destructive' }),
  });

  const setPipelineStage = (newPipelineId: string, newStageId: string) => {
    setPipelineId(newPipelineId);
    setStageId(newStageId);
    mutation.mutate({ newPipelineId, newStageId });
  };

  return { pipelineId, stageId, setPipelineStage, isUpdating: mutation.isPending };
}
