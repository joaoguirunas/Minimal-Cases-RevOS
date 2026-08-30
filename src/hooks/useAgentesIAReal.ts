import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

// Interfaces
export interface AgenteIA {
  id: string;
  nome: string;
  descricao?: string;
  identidade?: string;
  regras_gerais?: string;
  input_data?: string;
  usa_etapas: boolean;
  ativo: boolean;
  versao_atual: number;
  pipeline_id?: string;
  pipeline_ids?: string[];      // Multi-pipeline routing (AIAGT-PRO v3)
  leads_stages_id?: string;
  score_matrix_ids?: string[];  // includes '__empty__' sentinel in UI state
  score_allow_empty?: boolean;  // DB column — persists the __empty__ sentinel
  score_value?: number;
  // Multi-select routing (AIAGT-PRO v2)
  channel_types?: string[];
  stage_ids?: string[];
  origem_lista_filters?: string[];  // [] = todos; non-empty = only matching origem_lista
  // LLM runtime fields (N8N-WAA)
  llm_provider?: string;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_provider_id?: string;
  memory_window?: number;
  wa_phone_number_id?: string;
  wa_channel_id?: string;
  buffer_ms?: number;
  humanizacao?: 'alta' | 'media' | 'nenhuma';
  // Voice Agent (MVP)
  agent_type?: 'text' | 'voice';
  voice_enabled?: boolean;
  voice_response_mode?: 'always' | 'mirror';
  voice_id?: string | null;
  elevenlabs_agent_id?: string | null;
  voice_first_message?: string;
  voice_language?: string;
  voice_model_id?: string;
  voice_stability?: number;
  voice_similarity?: number;
  voice_speed?: number;
  el_sync_status?: 'pending' | 'synced' | 'error' | 'not_applicable';
  el_last_synced_at?: string;
  created_at: string;
  updated_at: string;
  is_template?: boolean;
  template_type?: string;
}

export interface PassoAgente {
  id: string;
  agente_ia_id: string;
  ai_agent_id: string;
  nome: string;
  prompt: string;
  controle?: string | null;
  ordem?: number;
  order_index: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface HistoricoAgente {
  id: string;
  ai_agent_id: string;
  versao: number;
  version: number;
  changelog?: Record<string, unknown>;
  data: string;
  created_at: string;
  alteracoes: string;
  // Additional fields from data jsonb
  nome?: string;
  descricao?: string;
  identidade?: string;
  regras_gerais?: string;
  prompt_base?: string;
  dados_entrada?: string;
  usa_etapas?: boolean;
  ativo?: boolean;
  pipeline_id?: string;
  leads_stages_id?: string;
  score_matrix_ids?: string[];
  llm_provider?: string;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  steps?: Array<{ id: string; nome: string; controle: number | string; prompt: string }>;
}

// Hook to fetch all agents (for listings - excludes templates)
export const useAgentesIA = () => {
  return useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('is_template', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Map database fields to interface
      // Cast to include new columns not yet in types.ts
      type AgentRow = typeof data extends (infer R)[] ? R & {
        llm_provider?: string; llm_model?: string; llm_temperature?: number;
        llm_max_tokens?: number; llm_provider_id?: string; memory_window?: number;
        wa_phone_number_id?: string; wa_channel_id?: string; buffer_ms?: number;
        humanizacao?: string; channel_types?: string[]; stage_ids?: string[]; pipeline_ids?: string[];
        voice_enabled?: boolean; voice_response_mode?: string; voice_id?: string | null;
        agent_type?: string; elevenlabs_agent_id?: string | null;
        voice_first_message?: string; voice_language?: string; voice_model_id?: string;
        voice_stability?: number; voice_similarity?: number; voice_speed?: number;
        el_sync_status?: string; el_last_synced_at?: string;
      } : never;
      return ((data || []) as AgentRow[]).map(agent => ({
        id: agent.id,
        nome: agent.name,
        descricao: agent.description,
        identidade: agent.identity,
        regras_gerais: agent.general_rules,
        input_data: agent.input_data,
        usa_etapas: agent.use_stages,
        ativo: agent.active,
        versao_atual: agent.current_version,
        pipeline_id: agent.pipeline_id,
        pipeline_ids: agent.pipeline_ids || (agent.pipeline_id ? [agent.pipeline_id] : []),
        leads_stages_id: agent.leads_stages_id,
        score_matrix_ids: [
          ...(agent.score_matrix_ids || []),
          ...(agent.score_allow_empty ? ['__empty__'] : []),
        ],
        score_allow_empty: agent.score_allow_empty ?? false,
        score_value: agent.score_value,
        channel_types: agent.channel_types || [],
        stage_ids: agent.stage_ids || [],
        llm_provider: agent.llm_provider,
        llm_model: agent.llm_model,
        llm_temperature: agent.llm_temperature,
        llm_max_tokens: agent.llm_max_tokens,
        llm_provider_id: agent.llm_provider_id,
        memory_window: agent.memory_window,
        wa_phone_number_id: agent.wa_phone_number_id,
        wa_channel_id: agent.wa_channel_id,
        buffer_ms: agent.buffer_ms,
        humanizacao: (agent.humanizacao as AgenteIA['humanizacao']) ?? 'media',
        agent_type: (agent.agent_type as AgenteIA['agent_type']) ?? 'text',
        voice_enabled: agent.voice_enabled ?? false,
        voice_response_mode: (agent.voice_response_mode as AgenteIA['voice_response_mode']) ?? 'mirror',
        voice_id: agent.voice_id ?? null,
        elevenlabs_agent_id: agent.elevenlabs_agent_id ?? null,
        voice_first_message: agent.voice_first_message,
        voice_language: agent.voice_language ?? 'pt',
        voice_model_id: agent.voice_model_id,
        voice_stability: agent.voice_stability ?? 0.5,
        voice_similarity: agent.voice_similarity ?? 0.75,
        voice_speed: agent.voice_speed ?? 1.0,
        el_sync_status: (agent.el_sync_status as AgenteIA['el_sync_status']) ?? 'not_applicable',
        el_last_synced_at: agent.el_last_synced_at,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        is_template: agent.is_template || false,
        template_type: agent.template_type
      })) as AgenteIA[];
    }
  });
};

// Hook to fetch a single agent (including templates) - used by AgenteSingle
export const useAgenteById = (id: string) => {
  return useQuery({
    queryKey: ['ai-agent', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Map database fields to interface
      return {
        id: data.id,
        nome: data.name,
        descricao: data.description,
        identidade: data.identity,
        regras_gerais: data.general_rules,
        input_data: data.input_data,
        usa_etapas: data.use_stages,
        ativo: data.active,
        versao_atual: data.current_version,
        pipeline_id: data.pipeline_id,
        pipeline_ids: data.pipeline_ids || (data.pipeline_id ? [data.pipeline_id] : []),
        leads_stages_id: data.leads_stages_id,
        score_matrix_ids: [
          ...(data.score_matrix_ids || []),
          ...(data.score_allow_empty ? ['__empty__'] : []),
        ],
        score_allow_empty: data.score_allow_empty ?? false,
        score_value: data.score_value,
        channel_types: data.channel_types || [],
        stage_ids: data.stage_ids || [],
        origem_lista_filters: data.origem_lista_filters || [],
        llm_provider: data.llm_provider,
        llm_model: data.llm_model,
        llm_temperature: data.llm_temperature,
        llm_max_tokens: data.llm_max_tokens,
        llm_provider_id: data.llm_provider_id,
        memory_window: data.memory_window,
        wa_phone_number_id: data.wa_phone_number_id,
        wa_channel_id: data.wa_channel_id,
        buffer_ms: data.buffer_ms,
        humanizacao: (data.humanizacao as AgenteIA['humanizacao']) ?? 'media',
        agent_type: (data.agent_type as AgenteIA['agent_type']) ?? 'text',
        voice_enabled: data.voice_enabled ?? false,
        voice_response_mode: (data.voice_response_mode as AgenteIA['voice_response_mode']) ?? 'mirror',
        voice_id: data.voice_id ?? null,
        elevenlabs_agent_id: data.elevenlabs_agent_id ?? null,
        voice_first_message: data.voice_first_message,
        voice_language: data.voice_language ?? 'pt',
        voice_model_id: data.voice_model_id,
        voice_stability: data.voice_stability ?? 0.5,
        voice_similarity: data.voice_similarity ?? 0.75,
        voice_speed: data.voice_speed ?? 1.0,
        el_sync_status: (data.el_sync_status as AgenteIA['el_sync_status']) ?? 'not_applicable',
        el_last_synced_at: data.el_last_synced_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        is_template: data.is_template || false,
        template_type: data.template_type
      } as AgenteIA;
    },
    enabled: !!id && id !== 'stub-id'
  });
};

// Hook to fetch templates only
export const useAgentesTemplates = () => {
  return useQuery({
    queryKey: ['ai-agents-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('is_template', true)
        .order('name', { ascending: true });

      if (error) throw error;

      // Map database fields to interface
      return (data || []).map(agent => ({
        id: agent.id,
        nome: agent.name,
        descricao: agent.description,
        identidade: agent.identity,
        regras_gerais: agent.general_rules,
        input_data: agent.input_data,
        usa_etapas: agent.use_stages,
        ativo: agent.active,
        versao_atual: agent.current_version,
        pipeline_id: agent.pipeline_id,
        leads_stages_id: agent.leads_stages_id,
        score_matrix_ids: agent.score_matrix_ids || [],
        score_value: agent.score_value,
        channel_types: [],
        stage_ids: [],
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        is_template: agent.is_template || false,
        template_type: agent.template_type
      })) as AgenteIA[];
    }
  });
};

// Hook to fetch steps for a specific agent
export const usePassosAgente = (agentId: string) => {
  return useQuery({
    queryKey: ['ai-agent-steps', agentId],
    queryFn: async () => {
      if (!agentId || agentId === 'stub-id') return [];

      const { data, error } = await supabase
        .from('ai_agents_steps')
        .select('*')
        .eq('ai_agent_id', agentId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Map database fields to interface
      return (data || []).map(step => ({
        id: step.id,
        agente_ia_id: step.ai_agent_id,
        ai_agent_id: step.ai_agent_id,
        nome: step.name || '',
        prompt: step.prompt || '',
        controle: step.control,
        ordem: step.order_index,
        order_index: step.order_index,
        ativo: step.active ?? true,
        created_at: step.created_at,
        updated_at: step.updated_at
      })) as PassoAgente[];
    },
    enabled: !!agentId && agentId !== 'stub-id'
  });
};

// Hook to create a new agent
export const useCriarAgente = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (agenteData: Partial<AgenteIA> & { nome: string }) => {
      const { data, error } = await supabase
        .from('ai_agents')
        .insert({
          name: agenteData.nome,
          description: agenteData.descricao,
          identity: agenteData.identidade,
          general_rules: agenteData.regras_gerais,
          input_data: agenteData.input_data,
          use_stages: agenteData.usa_etapas ?? false,
          active: agenteData.ativo ?? true,
          current_version: 1,
          pipeline_id: agenteData.pipeline_id,
          leads_stages_id: agenteData.leads_stages_id,
          score_matrix_ids: agenteData.score_matrix_ids || [],
          score_value: agenteData.score_value,
          agent_type: agenteData.agent_type ?? 'text',
          voice_enabled: agenteData.voice_enabled ?? false,
          voice_response_mode: agenteData.voice_response_mode ?? 'mirror',
          voice_id: agenteData.voice_id ?? null,
          voice_first_message: agenteData.voice_first_message,
          voice_language: agenteData.voice_language ?? 'pt',
          voice_model_id: agenteData.voice_model_id,
          voice_stability: agenteData.voice_stability,
          voice_similarity: agenteData.voice_similarity,
          voice_speed: agenteData.voice_speed,
          el_sync_status: agenteData.agent_type === 'voice' ? 'pending' : 'not_applicable',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast({
        title: "Sucesso",
        description: "Agente criado com sucesso"
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao criar agente:', error);
      toast({
        title: "Erro",
        description: `Não foi possível criar o agente: ${error.message}`,
        variant: "destructive"
      });
    }
  });
};

export interface EtapaPayload {
  id?: string;
  nome: string;
  prompt: string;
  controle: number;
}

// Hook to save/update agent (with history) — uses RPC save_agent_complete (atomic)
export const useSalvarAgente = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, etapas, ...agenteData }: Partial<AgenteIA> & { id: string; etapas?: EtapaPayload[] }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Strip __empty__ sentinel from score_matrix_ids (not a valid uuid)
      const EMPTY_SENTINEL = '__empty__';
      const rawMatrixIds = agenteData.score_matrix_ids ?? [];
      const realMatrixIds = rawMatrixIds.filter((mid) => mid !== EMPTY_SENTINEL);
      const scoreAllowEmpty = rawMatrixIds.includes(EMPTY_SENTINEL);

      // Normalize optional UUID fields: empty string → null (prevents Postgres cast error)
      const uuid = (v: string | null | undefined): string | null =>
        v && v.trim() !== '' ? v : null;

      // Build p_agent_data with DB column names; omit undefined fields
      const agentData: Record<string, unknown> = {};
      if (agenteData.nome !== undefined) agentData.name = agenteData.nome;
      if (agenteData.descricao !== undefined) agentData.description = agenteData.descricao;
      if (agenteData.identidade !== undefined) agentData.identity = agenteData.identidade;
      if (agenteData.regras_gerais !== undefined) agentData.general_rules = agenteData.regras_gerais;
      if (agenteData.input_data !== undefined) agentData.input_data = agenteData.input_data;
      if (agenteData.usa_etapas !== undefined) agentData.use_stages = agenteData.usa_etapas;
      if (agenteData.ativo !== undefined) agentData.active = agenteData.ativo;
      if (agenteData.pipeline_ids !== undefined || agenteData.pipeline_id !== undefined) {
        agentData.pipeline_id = uuid(agenteData.pipeline_ids?.[0] ?? agenteData.pipeline_id);
        agentData.pipeline_ids = agenteData.pipeline_ids;
      }
      if (agenteData.leads_stages_id !== undefined) agentData.leads_stages_id = uuid(agenteData.leads_stages_id);
      agentData.score_matrix_ids = realMatrixIds;
      agentData.score_allow_empty = scoreAllowEmpty;
      if (agenteData.score_value !== undefined) agentData.score_value = agenteData.score_value;
      if (agenteData.channel_types !== undefined) agentData.channel_types = agenteData.channel_types;
      if (agenteData.stage_ids !== undefined) agentData.stage_ids = agenteData.stage_ids;
      if (agenteData.origem_lista_filters !== undefined) agentData.origem_lista_filters = agenteData.origem_lista_filters;
      if (agenteData.llm_provider !== undefined) agentData.llm_provider = agenteData.llm_provider;
      if (agenteData.llm_model !== undefined) agentData.llm_model = agenteData.llm_model;
      if (agenteData.llm_temperature !== undefined) agentData.llm_temperature = agenteData.llm_temperature;
      if (agenteData.llm_max_tokens !== undefined) agentData.llm_max_tokens = agenteData.llm_max_tokens;
      if (agenteData.llm_provider_id !== undefined) agentData.llm_provider_id = uuid(agenteData.llm_provider_id);
      if (agenteData.memory_window !== undefined) agentData.memory_window = agenteData.memory_window;
      if (agenteData.wa_phone_number_id !== undefined) agentData.wa_phone_number_id = agenteData.wa_phone_number_id;
      if (agenteData.wa_channel_id !== undefined) agentData.wa_channel_id = uuid(agenteData.wa_channel_id);
      if (agenteData.buffer_ms !== undefined) agentData.buffer_ms = agenteData.buffer_ms;
      if (agenteData.humanizacao !== undefined) agentData.humanizacao = agenteData.humanizacao;
      if (agenteData.agent_type !== undefined) agentData.agent_type = agenteData.agent_type;
      if (agenteData.voice_enabled !== undefined) agentData.voice_enabled = agenteData.voice_enabled;
      if (agenteData.voice_response_mode !== undefined) agentData.voice_response_mode = agenteData.voice_response_mode;
      if (agenteData.voice_id !== undefined) agentData.voice_id = agenteData.voice_id;
      if (agenteData.voice_first_message !== undefined) agentData.voice_first_message = agenteData.voice_first_message;
      if (agenteData.voice_language !== undefined) agentData.voice_language = agenteData.voice_language;
      if (agenteData.voice_model_id !== undefined) agentData.voice_model_id = agenteData.voice_model_id;
      if (agenteData.voice_stability !== undefined) agentData.voice_stability = agenteData.voice_stability;
      if (agenteData.voice_similarity !== undefined) agentData.voice_similarity = agenteData.voice_similarity;
      if (agenteData.voice_speed !== undefined) agentData.voice_speed = agenteData.voice_speed;
      if (agenteData.el_sync_status !== undefined) agentData.el_sync_status = agenteData.el_sync_status;

      // Build changelog — describe which areas are changing (RPC handles old/new comparison internally)
      const changelog = {
        resumo: 'Configurações atualizadas',
        areas_alteradas: [
          ...(agenteData.nome !== undefined || agenteData.ativo !== undefined || agenteData.usa_etapas !== undefined ? ['configuracao'] : []),
          ...(agenteData.identidade !== undefined ? ['identidade'] : []),
          ...(agenteData.regras_gerais !== undefined ? ['regras_gerais'] : []),
          ...(agenteData.input_data !== undefined ? ['dados_entrada'] : []),
        ],
        detalhes: {},
        timestamp: new Date().toISOString(),
      };

      // Build steps payload — omit id for new (temporary) steps so RPC generates a real UUID
      const stepsData = etapas
        ? etapas.map(e => ({
            ...(e.id && !e.id.startsWith('etapa-') ? { id: e.id } : {}),
            name: e.nome || `Controle ${e.controle}`,
            prompt: e.prompt,
            control: String(e.controle),
            order_index: e.controle,
          }))
        : null;

      const { data, error } = await supabase.rpc('save_agent_complete' as never, {
        p_agent_id: id,
        p_agent_data: agentData,
        p_steps_data: stepsData,
        p_changelog: changelog,
        p_created_by: user?.id ?? null,
      }) as unknown as { data: { version: number; ok: boolean } | null; error: Error | null };

      if (error) throw error;

      const version = data?.version ?? null;
      return { id, version };
    },
    onSuccess: ({ id, version }) => {
      // Update current_version in single-agent cache without a refetch
      if (version !== null) {
        queryClient.setQueryData<AgenteIA>(['ai-agent', id], (old) =>
          old ? { ...old, versao_atual: version } : old,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-steps', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-history'] });
    },
  });
};

// Hook to delete agent
export const useExcluirAgente = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agentId);

      if (error) throw error;
      return agentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast({
        title: "Sucesso",
        description: "Agente excluído com sucesso"
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir agente:', error);
      toast({
        title: "Erro",
        description: `Não foi possível excluir o agente: ${error.message}`,
        variant: "destructive"
      });
    }
  });
};

// Hook to fetch agent history
export const useHistoricoAgente = (agentId: string) => {
  return useQuery({
    queryKey: ['ai-agent-history', agentId],
    queryFn: async () => {
      if (!agentId || agentId === 'stub-id') return [];

      const { data, error } = await supabase
        .from('ai_agents_history')
        .select('*')
        .eq('ai_agent_id', agentId)
        .order('version', { ascending: false });

      if (error) throw error;

      return (data || []).map(history => {
        const parsedData = typeof history.data === 'string' 
          ? JSON.parse(history.data) 
          : history.data;

        return {
          id: history.id,
          ai_agent_id: history.ai_agent_id,
          versao: history.version,
          version: history.version,
          changelog: history.changelog,
          data: JSON.stringify(parsedData),
          created_at: history.created_at,
          alteracoes: history.changelog ? JSON.stringify(history.changelog) : '',
          // Fields from data jsonb
          nome: parsedData?.name,
          descricao: parsedData?.description,
          identidade: parsedData?.identity,
          regras_gerais: parsedData?.general_rules,
          prompt_base: parsedData?.prompt_base,
          dados_entrada: parsedData?.input_data,
          usa_etapas: parsedData?.use_stages,
          ativo: parsedData?.active,
          pipeline_id: parsedData?.pipeline_id,
          leads_stages_id: parsedData?.leads_stages_id,
          score_matrix_ids: parsedData?.score_matrix_ids,
          llm_provider: parsedData?.llm_provider,
          llm_model: parsedData?.llm_model,
          llm_temperature: parsedData?.llm_temperature,
          llm_max_tokens: parsedData?.llm_max_tokens,
          steps: parsedData?.steps,
        } as HistoricoAgente;
      });
    },
    enabled: !!agentId && agentId !== 'stub-id'
  });
};

// Hook to restore a previous version (uses RPC for atomic transaction)
export const useRestaurarVersao = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      agentId,
      historyId
    }: {
      agentId: string;
      historyId: string;
    }) => {
      const { error } = await supabase.rpc('restore_agent_version' as never, {
        p_agent_id: agentId,
        p_history_id: historyId,
      });

      if (error) throw error;

      return { agentId, historyId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-steps'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-history'] });
      toast({
        title: "Sucesso",
        description: "Versão restaurada com sucesso"
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao restaurar versão:', error);
      toast({
        title: "Erro",
        description: `Não foi possível restaurar a versão: ${error.message}`,
        variant: "destructive"
      });
    }
  });
};

// Hook to clone a template as a new agent
export const useClonarAgente = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // 1. Fetch the template
      const { data: template, error: fetchError } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Create a new agent based on the template
      const newAgentName = `${template.name.replace(/^Template\s*[—-]\s*/i, '')} (Cópia)`;
      const { data: newAgent, error: createError } = await supabase
        .from('ai_agents')
        .insert({
          name: newAgentName,
          description: template.description,
          identity: template.identity,
          general_rules: template.general_rules,
          input_data: template.input_data,
          use_stages: template.use_stages,
          active: true,
          current_version: 1,
          pipeline_id: template.pipeline_id,
          leads_stages_id: template.leads_stages_id,
          score_matrix_ids: template.score_matrix_ids || [],
          score_value: template.score_value,
          is_template: false,
          template_type: null,
          // Runtime defaults from template
          channel_types: template.channel_types,
          humanizacao: template.humanizacao,
          buffer_ms: template.buffer_ms,
          memory_window: template.memory_window,
          llm_provider: template.llm_provider,
          llm_model: template.llm_model,
          llm_temperature: template.llm_temperature,
          llm_max_tokens: template.llm_max_tokens,
        })
        .select()
        .single();

      if (createError) throw createError;

      // 3. Fetch template steps if they exist
      const { data: templateSteps } = await supabase
        .from('ai_agents_steps')
        .select('*')
        .eq('ai_agent_id', templateId)
        .order('order_index', { ascending: true });

      // 4. Clone steps to the new agent
      if (templateSteps && templateSteps.length > 0) {
        const stepsToInsert = templateSteps.map(step => ({
          ai_agent_id: newAgent.id,
          name: step.name,
          prompt: step.prompt,
          control: step.control,
          order_index: step.order_index,
          pipeline_id: step.pipeline_id,
          stage_id: step.stage_id,
          active: step.active
        }));

        await supabase
          .from('ai_agents_steps')
          .insert(stepsToInsert);
      }

      return newAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-steps'] });
      toast({
        title: "Sucesso",
        description: "Template clonado com sucesso"
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao clonar template:', error);
      toast({
        title: "Erro",
        description: `Não foi possível clonar o template: ${error.message}`,
        variant: "destructive"
      });
    }
  });
};

// ── Conflict Detection ─────────────────────────────────────────────────────────

export interface AgentConflict { id: string; nome: string; }

/**
 * Returns other active agents that share at least one channel AND at least one
 * stage with the current agent in the same pipeline — an invalid overlap.
 */
export const useCheckAgentConflict = (
  currentAgentId: string,
  channelTypes: string[],
  pipelineIds: string[],
  stageIds: string[],
) => {
  return useQuery({
    queryKey: ['agent-conflict', currentAgentId, channelTypes, pipelineIds, stageIds],
    queryFn: async () => {
      if (pipelineIds.length === 0 || stageIds.length === 0 || channelTypes.length === 0) return [];

      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('active', true)
        .eq('is_template', false)
        .neq('id', currentAgentId)
        .overlaps('pipeline_ids', pipelineIds)
        .overlaps('channel_types', channelTypes)
        .overlaps('stage_ids', stageIds);

      if (error) throw error;
      return (data || []).map(a => ({
        id: a.id,
        nome: a.name,
      })) as AgentConflict[];
    },
    enabled: pipelineIds.length > 0 && stageIds.length > 0 && channelTypes.length > 0,
    staleTime: 10_000,
  });
};

// Hook to fetch score matrices for dropdown selection
export const useScoreMatrices = () => {
  return useQuery({
    queryKey: ['score-matrices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('score_matrix')
        .select('id, score_number, name, profile_score, pre_description_score, detail_score')
        .order('score_number', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });
};

// ── AI Providers (settings_ai_providers) ──────────────────────────────────────

export interface AIProvider {
  id: string;
  provider: string;
  label: string;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const useAIProviders = () => {
  return useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_ai_providers')
        .select('id, provider, label, is_default, active, created_at, updated_at')
        .order('provider', { ascending: true });

      if (error) throw error;
      return (data || []) as AIProvider[];
    }
  });
};

export interface AIProviderInput {
  provider: string;
  label: string;
  api_key: string;
  is_default: boolean;
  active: boolean;
}

export const useCreateAIProvider = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AIProviderInput) => {
      const { data, error } = await supabase
        .from('settings_ai_providers')
        .insert(input)
        .select('id, provider, label, is_default, active, created_at, updated_at')
        .single();

      if (error) throw error;
      return data as AIProvider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      toast({ title: 'Provedor criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar provedor', description: error.message, variant: 'destructive' });
    }
  });
};

export const useUpdateAIProvider = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AIProviderInput> & { id: string }) => {
      const { error } = await supabase
        .from('settings_ai_providers')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      toast({ title: 'Provedor atualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeleteAIProvider = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('settings_ai_providers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      toast({ title: 'Provedor removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });
};

// ── Agent Execution Log ────────────────────────────────────────────────────────

export interface AgentExecution {
  id: string;
  ai_agent_id: string;
  people_id: string;
  lead_id: string | null;
  prompt_rendered: string;
  response_data: {
    text?: string;
    paragraphs?: number;
    test_mode?: boolean;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    tool_call_details?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  } | null;
  tools_used: string[] | null;
  execution_status: string;
  execution_duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  // Joined
  person_name?: string | null;
  lead_title?: string | null;
}

// ── WhatsApp Channels ─────────────────────────────────────────────────────────

export interface WhatsappChannel {
  id: string;
  label: string;
  phone_number_id: string;
  waba_id?: string | null;
  access_token: string;
  app_secret?: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const useWhatsappChannels = () => {
  return useQuery({
    queryKey: ['whatsapp-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_whatsapp_channels')
        .select('id, label, phone_number_id, waba_id, access_token, app_secret, is_default, active, created_at, updated_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as WhatsappChannel[];
    },
  });
};

export const useCreateWhatsappChannel = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<WhatsappChannel, 'id' | 'created_at' | 'updated_at'>) => {
      // Desliga o default anterior primeiro — a constraint whatsapp_channels_one_default
      // já garante unicidade no banco (1 default por vez, cross-provider); sem esse passo
      // marcar um novo canal como padrão daria erro de violação se já houver outro default.
      if (input.is_default) {
        await supabase.from('settings_whatsapp_channels').update({ is_default: false }).eq('is_default', true);
      }
      const { data, error } = await supabase
        .from('settings_whatsapp_channels')
        .insert(input).select().single();
      if (error) throw error;
      return data as WhatsappChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      toast({ title: 'Canal criado com sucesso' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao criar canal', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateWhatsappChannel = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WhatsappChannel> & { id: string }) => {
      // Mesmo motivo do useCreateWhatsappChannel — desliga o default anterior primeiro.
      if (data.is_default) {
        await supabase.from('settings_whatsapp_channels').update({ is_default: false }).eq('is_default', true).neq('id', id);
      }
      const { error } = await supabase
        .from('settings_whatsapp_channels')
        .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      toast({ title: 'Canal atualizado' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteWhatsappChannel = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('settings_whatsapp_channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      toast({ title: 'Canal removido' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' }),
  });
};

export const useAgentExecutionLog = (agentId: string) => {
  return useQuery({
    queryKey: ['agent-execution-log', agentId],
    queryFn: async () => {
      if (!agentId || agentId === 'stub-id') return [];

      const { data, error } = await supabase
        .from('ai_agents_execution_log')
        .select(`
          id, ai_agent_id, people_id, lead_id,
          prompt_rendered, response_data, tools_used,
          execution_status, execution_duration_ms, error_message, created_at,
          clients_people!ai_agents_execution_log_people_id_fkey(name),
          leads!ai_agents_execution_log_lead_id_fkey(title)
        `)
        .eq('ai_agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map(row => {
        const r = row as typeof row & {
          clients_people?: { name?: string } | null;
          leads?: { title?: string } | null;
        };
        return {
          ...row,
          person_name: r.clients_people?.name ?? null,
          lead_title: r.leads?.title ?? null,
        };
      }) as unknown as AgentExecution[];
    },
    enabled: !!agentId && agentId !== 'stub-id'
  });
};
