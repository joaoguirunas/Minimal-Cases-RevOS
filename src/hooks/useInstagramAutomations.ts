import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TriggerType = 'incoming_dm' | 'post_comment' | 'story_mention' | 'story_reply';
export type ActionType  = 'send_dm' | 'reply_comment' | 'reply_and_dm';
export type FilterOp    = 'any' | 'all';
export type FilterType  = 'always' | 'is_first_contact' | 'message_contains' | 'message_not_contains';

export interface AutomationFilter {
  type: FilterType;
  value?: string;
}

export interface QuickReply {
  title: string;
}

export interface InstagramAutomation {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  target_post_id: string | null;
  filter_operator: FilterOp;
  filters: AutomationFilter[];
  action_type: ActionType;
  action_dm_text: string | null;
  action_dm_quick_replies: QuickReply[];
  action_comment_text: string | null;
  action_comment_texts: string[];
  cooldown_hours: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface InstagramAutomationLog {
  id: string;
  automation_id: string | null;
  automation_name: string | null;
  trigger_type: string | null;
  person_id: string | null;
  person_name: string | null;
  ig_message_id: string | null;
  message_text: string | null;
  filters_matched: string[] | null;
  action_executed: string | null;
  status: 'success' | 'failed' | 'skipped' | 'cooldown';
  error_message: string | null;
  executed_at: string;
}

export type AutomationUpsert = Omit<InstagramAutomation, 'id' | 'created_at' | 'updated_at'>;

// ── Queries ───────────────────────────────────────────────────────────────────

const QK = 'instagram_automations';
const QK_LOG = 'instagram_automation_log';

export function useInstagramAutomations() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_automations')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InstagramAutomation[];
    },
  });
}

export function useInstagramAutomationLog(
  automationId?: string | null,
  limit = 50,
  responsavelId?: string,
) {
  return useQuery({
    queryKey: [QK_LOG, automationId ?? 'all', responsavelId ?? 'all'],
    queryFn: async () => {
      // Restrict to people assigned to this user via leads.user_id
      let allowedPeopleIds: string[] | null = null;
      if (responsavelId) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('people_id')
          .eq('user_id', responsavelId)
          .not('people_id', 'is', null);
        allowedPeopleIds = [...new Set((leadsData ?? []).map((l: { people_id: string }) => l.people_id))];
        if (allowedPeopleIds.length === 0) return [] as InstagramAutomationLog[];
      }

      let q = supabase
        .from('instagram_automation_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(limit);
      if (automationId) q = q.eq('automation_id', automationId);
      if (allowedPeopleIds) q = (q as any).in('person_id', allowedPeopleIds);
      const { data, error } = await q;
      if (error) throw error;
      return data as InstagramAutomationLog[];
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateInstagramAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AutomationUpsert) => {
      const { data, error } = await supabase
        .from('instagram_automations')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as InstagramAutomation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateInstagramAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InstagramAutomation> & { id: string }) => {
      const { data, error } = await supabase
        .from('instagram_automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as InstagramAutomation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteInstagramAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instagram_automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

// ── Instagram Posts (for PostPicker) ─────────────────────────────────────────

export interface InstagramPost {
  id: string;
  thumbnail_url: string | null;
  media_url: string | null;
  caption: string | null;
  timestamp: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  media_product_type: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  no_instagram_config: 'Instagram não está ligado',
  invalid_token: 'Token Instagram expirou — reconecte em Configurações',
};

function toReadableError(err: unknown): string {
  const code = (err as { error?: string })?.error;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  const msg = (err as { message?: string })?.message;
  if (msg) return msg;
  return 'Não foi possível carregar posts';
}

export function useInstagramPosts(enabled: boolean) {
  return useQuery({
    queryKey: ['instagram-posts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('instagram-posts-list');
      if (error) throw error;
      if (data?.error) throw data;
      return (data?.posts ?? []) as InstagramPost[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
    select: (posts) => posts,
    meta: { toReadableError },
  });
}
