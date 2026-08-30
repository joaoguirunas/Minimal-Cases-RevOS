import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

// RETORNO-04 — config da tool `agendar_retorno` por agente/step (ADR-RETORNO-01 D2).
//
// `ai_agent_callback_configs` foi criada na RETORNO-01 e ainda NÃO está em
// src/integrations/supabase/types.ts → cast de fronteira, mesmo padrão usado nas
// tabelas kiwify_* (useKiwifyProductsInPipeline.ts / useNegocios.ts).
const sbUntyped = supabase as unknown as SupabaseClient;

const TABLE = 'ai_agent_callback_configs';

export type CallbackMode = 'direct' | 'agent';

/** Item de `templates` (jsonb). Shape provado no runtime: ai-callback-worker/logic.ts:26. */
export interface CallbackTemplate {
  id: string;
  label: string;
  body: string;
  whatsapp_template_name?: string | null;
}

export interface AgentCallbackConfig {
  id: string;
  agent_id: string;
  /** NULL = config default do agente; preenchido = override do step. */
  step_id: string | null;
  enabled: boolean;
  default_mode: CallbackMode;
  allow_agent_choose_mode: boolean;
  allow_free_text: boolean;
  templates: CallbackTemplate[];
  free_prompt: string | null;
  whatsapp_template_fallback: string | null;
  min_delay_minutes: number;
  max_delay_hours: number;
  cancel_on_resume: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Valores dos DEFAULTs da migration 20260721120000 (RETORNO-01). */
export const CALLBACK_CONFIG_DEFAULTS = {
  enabled: false,
  default_mode: 'direct' as CallbackMode,
  allow_agent_choose_mode: false,
  allow_free_text: false,
  templates: [] as CallbackTemplate[],
  free_prompt: null,
  whatsapp_template_fallback: null,
  min_delay_minutes: 5,
  max_delay_hours: 720,
  cancel_on_resume: true,
} as const;

export interface AgentCallbackConfigsResult {
  /** Linha com step_id IS NULL (default do agente). */
  default: AgentCallbackConfig | null;
  /** Overrides indexados por step_id. */
  overrides: Record<string, AgentCallbackConfig>;
  rows: AgentCallbackConfig[];
}

export type AgentCallbackConfigInput = Omit<
  AgentCallbackConfig,
  'id' | 'created_at' | 'updated_at'
> & { id?: string };

export const agentCallbackConfigKey = (agentId: string) =>
  ['ai-agent-callback-configs', agentId] as const;

const normalizeRow = (row: AgentCallbackConfig): AgentCallbackConfig => ({
  ...row,
  templates: Array.isArray(row.templates) ? row.templates : [],
  min_delay_minutes: Number(row.min_delay_minutes ?? CALLBACK_CONFIG_DEFAULTS.min_delay_minutes),
  max_delay_hours: Number(row.max_delay_hours ?? CALLBACK_CONFIG_DEFAULTS.max_delay_hours),
});

/** Config da tool de retorno: linha default + overrides por step, de um agente. */
export const useAgentCallbackConfigs = (agentId: string) => {
  return useQuery<AgentCallbackConfigsResult>({
    queryKey: agentCallbackConfigKey(agentId),
    queryFn: async () => {
      const { data, error } = await sbUntyped
        .from(TABLE)
        .select('*')
        .eq('agent_id', agentId);

      if (error) throw new Error(error.message);

      const rows = ((data ?? []) as AgentCallbackConfig[]).map(normalizeRow);
      const overrides: Record<string, AgentCallbackConfig> = {};
      for (const row of rows) {
        if (row.step_id) overrides[row.step_id] = row;
      }

      return {
        default: rows.find((r) => r.step_id === null) ?? null,
        overrides,
        rows,
      };
    },
    enabled: !!agentId && agentId !== 'stub-id',
  });
};

/** Upsert manual (a UNIQUE(agent_id, step_id) não cobre step_id NULL no Postgres). */
export const useUpsertAgentCallbackConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AgentCallbackConfigInput) => {
      const { id, ...values } = input;
      const payload = {
        ...values,
        free_prompt: values.free_prompt?.trim() ? values.free_prompt : null,
        whatsapp_template_fallback: values.whatsapp_template_fallback || null,
      };

      const query = id
        ? sbUntyped.from(TABLE).update(payload).eq('id', id)
        : sbUntyped.from(TABLE).insert(payload);

      const { data, error } = await query.select('*').single();
      if (error) throw new Error(error.message);

      return normalizeRow(data as AgentCallbackConfig);
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: agentCallbackConfigKey(row.agent_id) });
      toast({
        title: 'Sucesso',
        description: 'Configuração de retorno salva.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Não foi possível salvar a configuração de retorno: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
