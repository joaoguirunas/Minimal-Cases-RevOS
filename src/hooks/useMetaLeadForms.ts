import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────

export interface MetaFieldMapping {
  crm_field: string;
  meta_field: string;       // e.g. 'FULL_NAME', 'EMAIL', or 'custom_1'
  meta_type: 'prefilled' | 'custom';
  label: string;
  options_mapping?: Record<string, string>;  // meta option value → score category item ID
}

export interface MetaPostSubmitAction {
  id: string;
  enabled: boolean;
  channel: 'whatsapp' | 'email' | 'sms';
  delay_minutes: number;
  wa_channel_id?: string;
  wa_template_id?: string;
  wa_variable_map?: Record<string, string>;
  // Email/SMS via webhook:
  webhook_id?: string;
  message_template?: string;
  subject?: string;
  // Score-based filtering:
  score_filter?: {
    mode: 'all' | 'include' | 'exclude';
    matrix_ids: string[];
  };
}

export interface MetaSuccessRoute {
  id: string;
  matrix_ids: string[];
  action: 'message' | 'redirect' | 'booking';
  title?: string;
  message?: string;
  redirect_url?: string;
  booking_rule_set_id?: string;
  wa_confirm_template?: string;
}

export interface MetaLeadFormSettings {
  thank_you_title?: string;
  thank_you_body?: string;
  thank_you_url?: string;
  privacy_policy_url?: string;
  initial_stage_id?: string;
  // Success config (parity with site forms)
  success_title?: string;
  success_message?: string;
  redirect_url?: string;
  success_routes?: MetaSuccessRoute[];
  post_submit_actions?: MetaPostSubmitAction[];
}

export interface MetaRawQuestion {
  key: string;
  type: string;
  label: string;
  options?: unknown[];
}

export interface MetaLeadForm {
  id: string;
  page_id: string;
  meta_form_id: string;
  name: string;
  status: 'active' | 'archived' | 'unmapped';
  field_mapping: MetaFieldMapping[];
  raw_questions: MetaRawQuestion[];
  settings: MetaLeadFormSettings;
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

type CreateMetaLeadFormInput = Omit<MetaLeadForm, 'id' | 'created_at' | 'updated_at' | 'synced_at'>;
type UpdateMetaLeadFormInput = { id: string } & Partial<Omit<MetaLeadForm, 'id' | 'created_at' | 'updated_at'>>;

// ── Query Keys ─────────────────────────────────────────────────

const QUERY_KEY = 'meta-lead-forms';

// ── Hooks ──────────────────────────────────────────────────────

export function useMetaLeadForms() {
  return useQuery<MetaLeadForm[]>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_lead_forms')
        .select('*')
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MetaLeadForm[];
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useMetaLeadForm(id: string | undefined) {
  return useQuery<MetaLeadForm>({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_lead_forms')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as MetaLeadForm;
    },
    enabled: !!id,
  });
}

export function useCreateMetaLeadForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMetaLeadFormInput) => {
      const { data, error } = await supabase
        .from('meta_lead_forms')
        .insert(input as Record<string, unknown>)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MetaLeadForm;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateMetaLeadForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateMetaLeadFormInput) => {
      const { error } = await supabase
        .from('meta_lead_forms')
        .update({ ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, variables.id] });
    },
  });
}

export function useDeleteMetaLeadForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_lead_forms')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

// ── Connected Pages Hook ───────────────────────────────────────

export interface MetaConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  subscribed: boolean;
}

export function useMetaConnectedPages() {
  return useQuery<MetaConnectedPage[]>({
    queryKey: ['meta-connected-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_lead_form_pages_safe')
        .select('id, page_id, page_name, subscribed')
        .eq('subscribed', true)
        .order('page_name');
      if (error) throw error;
      return (data ?? []) as MetaConnectedPage[];
    },
    staleTime: 5 * 60_000,
  });
}
