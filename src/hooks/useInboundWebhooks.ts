import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InboundWebhookFieldMapping {
  source_key: string;
  crm_field: string;
  label: string;
}

export type CreateMode = 'criar' | 'criar_se_nao_existir' | 'atualizar_etapa' | 'somente_etapa';

export interface InboundWebhookTriggerConfig {
  enabled: boolean;
  channel: 'whatsapp';
  wa_channel_id: string;
  wa_template_id: string;
  wa_variable_map: Record<string, string>;
  delay_minutes: number;
}

export interface InboundWebhook {
  id: string;
  name: string;
  token: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_mapping: InboundWebhookFieldMapping[];
  create_mode: CreateMode;
  trigger_config: InboundWebhookTriggerConfig | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type InboundWebhookInsert = {
  name: string;
  pipeline_id?: string | null;
  stage_id?: string | null;
  field_mapping?: InboundWebhookFieldMapping[];
  create_mode?: CreateMode;
  trigger_config?: InboundWebhookTriggerConfig | null;
  active?: boolean;
};

export type InboundWebhookUpdate = Partial<{
  name: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_mapping: InboundWebhookFieldMapping[];
  create_mode: CreateMode;
  trigger_config: InboundWebhookTriggerConfig | null;
  active: boolean;
}> & { id: string };

const TABLE = 'inbound_webhooks';
const QUERY_KEY = ['inbound-webhooks'] as const;

// Supabase generated types don't include `inbound_webhooks` yet — cast through
// an untyped client surface so callers stay strongly typed.
const db = supabase as unknown as SupabaseClient;

type InboundWebhookRow = {
  id: string;
  name: string;
  token: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_mapping: unknown;
  create_mode: string | null;
  trigger_config: unknown;
  active: boolean | null;
  created_at: string;
  updated_at: string;
};

const VALID_MODES: ReadonlyArray<CreateMode> = [
  'criar',
  'criar_se_nao_existir',
  'atualizar_etapa',
  'somente_etapa',
];

const normalizeMapping = (raw: unknown): InboundWebhookFieldMapping[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      source_key: String(item.source_key ?? ''),
      crm_field: String(item.crm_field ?? ''),
      label: String(item.label ?? ''),
    }));
};

const normalizeCreateMode = (raw: unknown): CreateMode => {
  if (typeof raw === 'string' && (VALID_MODES as ReadonlyArray<string>).includes(raw)) {
    return raw as CreateMode;
  }
  return 'criar_se_nao_existir';
};

const normalizeTriggerConfig = (raw: unknown): InboundWebhookTriggerConfig | null => {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const varMap = obj.wa_variable_map;
  return {
    enabled: Boolean(obj.enabled),
    channel: 'whatsapp',
    wa_channel_id: String(obj.wa_channel_id ?? ''),
    wa_template_id: String(obj.wa_template_id ?? ''),
    wa_variable_map:
      varMap && typeof varMap === 'object' && !Array.isArray(varMap)
        ? Object.fromEntries(
            Object.entries(varMap as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
          )
        : {},
    delay_minutes: Number.isFinite(Number(obj.delay_minutes)) ? Number(obj.delay_minutes) : 0,
  };
};

const normalize = (row: InboundWebhookRow): InboundWebhook => ({
  id: row.id,
  name: row.name,
  token: row.token,
  pipeline_id: row.pipeline_id ?? null,
  stage_id: row.stage_id ?? null,
  field_mapping: normalizeMapping(row.field_mapping),
  create_mode: normalizeCreateMode(row.create_mode),
  trigger_config: normalizeTriggerConfig(row.trigger_config),
  active: row.active ?? true,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const useInboundWebhooks = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await db
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data ?? []) as InboundWebhookRow[]).map(normalize);
    },
  });
};

export const useCreateInboundWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: InboundWebhookInsert) => {
      const insertPayload: Record<string, unknown> = {
        name: payload.name,
        pipeline_id: payload.pipeline_id ?? null,
        stage_id: payload.stage_id ?? null,
        field_mapping: payload.field_mapping ?? [],
        active: payload.active ?? true,
      };
      if (payload.create_mode !== undefined) insertPayload.create_mode = payload.create_mode;
      if (payload.trigger_config !== undefined) insertPayload.trigger_config = payload.trigger_config;

      const { data, error } = await db
        .from(TABLE)
        .insert([insertPayload])
        .select()
        .single();

      if (error) throw error;
      return normalize(data as InboundWebhookRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Webhook criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    },
  });
};

export const useUpdateInboundWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: InboundWebhookUpdate) => {
      const { data, error } = await db
        .from(TABLE)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return normalize(data as InboundWebhookRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });
};

export const useDeleteInboundWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(TABLE)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Webhook excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir webhook: ${error.message}`);
    },
  });
};
