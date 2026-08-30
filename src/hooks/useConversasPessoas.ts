import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CriarNegocioParams {
  pessoa_id: string;
  tenant_id: string;
  pipeline_id: string;
  stage_id: string;
  valor?: number;
}

export const useCriarNegocio = () => {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CriarNegocioParams) => {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          people_id: params.pessoa_id,
          leads_pipelines_id: params.pipeline_id,
          leads_stages_id: params.stage_id,
          value: params.valor || 0,
          status: 'in_progress',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversas'] });
      qc.invalidateQueries({ queryKey: ['negocios'] });
      qc.invalidateQueries({ queryKey: ['negocios-sidebar'] });
      toast.success('Negócio criado com sucesso!');
    },
    onError: (err: any) => {
      toast.error('Erro ao criar negócio: ' + err.message);
    },
  });
};
