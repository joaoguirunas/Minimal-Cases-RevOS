import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface CreateStepData {
  ai_agent_id: string;
  name: string;
  prompt?: string;
  control?: string | null;
  order_index: number;
}

interface UpdateStepData {
  name?: string;
  prompt?: string;
  control?: string | null;
  order_index?: number;
  active?: boolean;
}

// Hook para criar um passo individualmente
export const useCreateAgentStep = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStepData) => {
      console.log('🆕 [CREATE STEP] Iniciando criação:', {
        agent_id: data.ai_agent_id,
        name: data.name,
        order_index: data.order_index
      });
      
      if (!data.ai_agent_id || !data.name) {
        const error = 'Dados obrigatórios faltando: ' + 
          (!data.ai_agent_id ? 'agent_id ' : '') +
          (!data.name ? 'name ' : '');
        console.error('❌ [CREATE STEP] Validação falhou:', error);
        throw new Error(error);
      }
      
      const insertData = {
        ai_agent_id: data.ai_agent_id,
        name: data.name.trim(),
        prompt: data.prompt || '',
        control: data.control || null,
        order_index: data.order_index,
        active: true
      };
      
      console.log('📤 [CREATE STEP] Enviando para banco:', insertData);
      
      const { data: insertedStep, error } = await supabase
        .from('ai_agents_steps')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ [CREATE STEP] Erro do Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ [CREATE STEP] Passo criado com sucesso:', insertedStep);
      return insertedStep;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-steps', variables.ai_agent_id] });
    },
    onError: (error: Error) => {
      console.error('❌ [CREATE STEP] Erro capturado no onError:', error);
      toast({
        title: "Erro ao criar passo",
        description: error.message || "Erro desconhecido ao criar passo",
        variant: "destructive"
      });
    }
  });
};

// Hook para atualizar um passo individualmente (com histórico)
export const useUpdateAgentStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: UpdateStepData }) => {
      console.log('✏️ [UPDATE STEP] Atualizando passo:', { stepId, data });
      
      // 1. Fetch current step to get agent_id
      const { data: currentStep, error: stepError } = await supabase
        .from('ai_agents_steps')
        .select('*')
        .eq('id', stepId)
        .single();

      if (stepError) throw stepError;

      const agentId = currentStep.ai_agent_id;

      // 2. Fetch current agent data
      const { data: currentAgent, error: agentError } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentError) throw agentError;

      // 3. Fetch all current steps
      const { data: currentSteps } = await supabase
        .from('ai_agents_steps')
        .select('*')
        .eq('ai_agent_id', agentId)
        .order('order_index', { ascending: true });

      // 4. Create history entry with current state
      const historyData = {
        name: currentAgent.name,
        description: currentAgent.description,
        identity: currentAgent.identity,
        general_rules: currentAgent.general_rules,
        input_data: currentAgent.input_data,
        use_stages: currentAgent.use_stages,
        active: currentAgent.active,
        pipeline_id: currentAgent.pipeline_id,
        leads_stages_id: currentAgent.leads_stages_id,
        score_matrix_ids: currentAgent.score_matrix_ids,
        score_value: currentAgent.score_value,
        steps: currentSteps || []
      };

      // 5. Build changelog for step changes
      const changes: string[] = [];
      if (data.name !== undefined && data.name !== currentStep.name) {
        changes.push(`Nome do passo: "${currentStep.name}" → "${data.name}"`);
      }
      if (data.prompt !== undefined && data.prompt !== currentStep.prompt) {
        changes.push(`Prompt do passo "${currentStep.name}" alterado`);
      }

      const changelog = {
        summary: changes.length > 0 ? changes.join('; ') : `Passo "${currentStep.name}" atualizado`,
        changes,
        timestamp: new Date().toISOString()
      };

      // 6. Insert history record
      await supabase
        .from('ai_agents_history')
        .insert({
          ai_agent_id: agentId,
          version: currentAgent.current_version || 1,
          data: historyData,
          changelog
        });

      // 7. Update agent version
      await supabase
        .from('ai_agents')
        .update({ 
          current_version: (currentAgent.current_version || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId);

      // 8. Update the step
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.prompt !== undefined) updateData.prompt = data.prompt;
      if (data.control !== undefined) updateData.control = data.control;
      if (data.order_index !== undefined) updateData.order_index = data.order_index;
      if (data.active !== undefined) updateData.active = data.active;

      const { data: updatedStep, error } = await supabase
        .from('ai_agents_steps')
        .update(updateData)
        .eq('id', stepId)
        .select()
        .single();

      if (error) {
        console.error('❌ [UPDATE STEP] Erro do Supabase:', error);
        throw error;
      }

      console.log('✅ [UPDATE STEP] Passo atualizado com sucesso');
      return updatedStep;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-steps', data.ai_agent_id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-history', data.ai_agent_id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    },
    onError: (error) => {
      console.error('❌ Erro ao atualizar passo:', error);
    }
  });
};

// Hook para deletar um passo
export const useDeleteAgentStep = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, agentId }: { stepId: string; agentId: string }) => {
      console.log('🗑️ [DELETE STEP] Deletando passo:', stepId);
      
      const { error } = await supabase
        .from('ai_agents_steps')
        .delete()
        .eq('id', stepId);

      if (error) {
        console.error('❌ [DELETE STEP] Erro do Supabase:', error);
        throw error;
      }

      console.log('✅ [DELETE STEP] Passo deletado com sucesso');
      return { stepId, agentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-steps', data.agentId] });
      toast({
        title: "Passo removido",
        description: "O passo foi removido com sucesso"
      });
    },
    onError: (error) => {
      console.error('❌ Erro ao remover passo:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover passo",
        variant: "destructive"
      });
    }
  });
};
