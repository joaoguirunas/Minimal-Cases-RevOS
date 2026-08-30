import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LpFormStep {
  id: string;
  title: string;
  order: number;
}

export interface LpFormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'hidden' | 'date' | 'number' | 'file';
  label: string;
  /** Chatbot/Typeform mode: conversational question shown as big heading */
  question?: string;
  placeholder?: string;
  required: boolean;
  crm_field?: string;
  validation?: Record<string, string>;
  /** Number field constraints */
  min?: number;
  max?: number;
  step?: number;
  /** File field constraints */
  accept?: string;    // e.g. "image/*,application/pdf"
  max_size_mb?: number;
  options?: { value: string; label: string; tags: string[] }[];
  conditions?: { trigger_field_id: string; trigger_value: string; action: 'show' | 'hide' }[];
  order: number;
  /** Steps mode: which step this field belongs to */
  step_id?: string;
}

export interface LpFormWidget {
  enabled: boolean;
  position: 'bottom-right' | 'bottom-left';
  button_color: string;
  button_label?: string;           // optional when shape='round'
  button_icon?: string;            // emoji icon e.g. '💬' | '⚡' | '📋' | '📞' | '🎯'
  button_shape?: 'round' | 'pill'; // default 'round'
  button_size?: 'sm' | 'md' | 'lg'; // default 'md'
  button_shadow?: boolean;         // default true
  /** What happens when the FAB is clicked: 'form' = opens the form | 'whatsapp' = opens wa.me link */
  destination?: 'form' | 'whatsapp'; // default 'form'
  whatsapp_number?: string;
}

export interface LpFormWhatsappAuto {
  enabled: boolean;
  channel_id: string;
  template_id: string;
  /** "1" → "field:pessoa.nome" | "fixed:Olá" */
  variable_map: Record<string, string>;
}

export interface LpFormPostSubmitAction {
  id: string;
  enabled: boolean;
  channel: 'whatsapp' | 'email' | 'sms' | 'text';
  delay_minutes: number;           // 0 = immediate
  /** Steps mode: which step triggers this action (1-indexed). 'last' = only on final submit. */
  trigger_step?: number | 'last';
  // WhatsApp template fields:
  wa_channel_id?: string;
  wa_template_id?: string;
  wa_variable_map?: Record<string, string>;
  // Email/SMS via webhook:
  webhook_id?: string;             // FK to omni_outbound_webhooks
  message_template?: string;       // body with {{variables}}
  subject?: string;                // for email
  // Score-based filtering (by score_matrix entry):
  score_filter?: {
    mode: 'all' | 'include' | 'exclude';
    matrix_ids: string[];
  };
}

export interface LpFormSuccessRoute {
  id: string;
  /** IDs das entradas da score_matrix que ativam esta rota */
  matrix_ids: string[];
  action: 'message' | 'redirect' | 'booking';
  title?: string;
  message?: string;
  redirect_url?: string;
  booking_rule_set_id?: string;
  /** Auto-WA after booking: Meta template name to send with meeting link */
  wa_confirm_template?: string;
}

export interface LpFormStyle {
  form_skin?: 'default' | 'dark' | 'minimal' | 'glass' | 'neon' | 'growth_sales';
  /** Modo da página pública: 'light' (padrão) ou 'dark' */
  page_mode?: 'light' | 'dark';
  title?: string;
  subtitle?: string;
  title_align?: 'left' | 'center' | 'right';
  title_font?: string;
  title_size?: 'sm' | 'md' | 'lg' | 'xl';
  title_weight?: 'normal' | 'semibold' | 'bold' | 'extrabold';
  title_color?: string;
  subtitle_size?: 'sm' | 'md' | 'lg';
  subtitle_color?: string;
  bg_color?: string;
  field_gap?: 'compact' | 'normal' | 'relaxed' | 'loose';
  input_radius?: 'none' | 'sm' | 'md' | 'full';
  input_size?: 'sm' | 'md' | 'lg';
  // Input field styling
  input_bg_color?: string;
  input_border_color?: string;
  input_border_width?: 'thin' | 'normal' | 'thick';
  input_text_color?: string;
  label_color?: string;
  // Label typography
  label_font?: string;
  label_weight?: 'normal' | 'semibold' | 'bold' | 'extrabold';
  label_size?: 'sm' | 'md' | 'lg';
  // Input typography
  input_font?: string;
  input_font_weight?: 'normal' | 'semibold' | 'bold' | 'extrabold';
  button_color?: string;
  button_text_color?: string;
  button_radius?: 'none' | 'sm' | 'md' | 'full';
  button_size?: 'sm' | 'md' | 'lg';
  button_full_width?: boolean;
  // Button typography
  button_font?: string;
  button_font_weight?: 'normal' | 'semibold' | 'bold' | 'extrabold';
  // Button gradient
  button_gradient?: boolean;
  button_color2?: string;
  button_gradient_dir?: 'right' | 'diagonal';
  // Detalhes — linha decorativa
  accent_color?: string;
  accent_type?: 'solid' | 'gradient' | 'animated';
  accent_color2?: string;
  accent_width?: 'thin' | 'normal' | 'thick';
  accent_position?: 'top' | 'bottom';
  // Detalhes — bolinha de status
  badge_enabled?: boolean;
  badge_color?: string;
  badge_text?: string;
  badge_icon?: 'circle' | 'pulse' | 'wave' | 'star' | 'bolt' | 'heart';
}

export interface LpFormSettings {
  submit_text: string;
  success_title?: string;
  success_message: string;
  redirect_url?: string;
  /** 'classic' = all fields at once | 'steps' = grouped multi-step | 'chatbot' = conversational */
  mode?: 'classic' | 'steps' | 'chatbot';
  /** How the form appears on the page: 'static' = inline | 'fullscreen' = modal | 'floating' = FAB button */
  display_style?: 'static' | 'fullscreen' | 'floating';
  /** Steps mode: ordered list of step groups */
  steps?: LpFormStep[];
  /** Chatbot mode: bot display name */
  bot_name?: string;
  /** Chatbot mode: bot button/header color (hex) */
  bot_color?: string;
  widget?: LpFormWidget;
  /** Legacy — kept for backward-compat; use post_submit_actions instead */
  whatsapp_auto?: LpFormWhatsappAuto;
  /** Multi-channel post-submit actions (supersedes whatsapp_auto when present) */
  post_submit_actions?: LpFormPostSubmitAction[];
  style?: LpFormStyle;
  /** Rotas de sucesso condicionais por score (FP-02) */
  success_routes?: LpFormSuccessRoute[];
  /** ID da etapa inicial onde leads são criados (sobrescreve o padrão: primeira etapa do pipeline) */
  initial_stage_id?: string;
}

export interface LpForm {
  id: string;
  name: string;
  pipeline_id: string | null;
  fields: LpFormField[];
  settings: LpFormSettings;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = 'lp-forms';

export function useLpForms() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_pro_forms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LpForm[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useLpForm(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('form_pro_forms')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as LpForm;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateLpForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<LpForm, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('form_pro_forms')
        .insert(form)
        .select()
        .single();
      if (error) throw error;
      return data as LpForm;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateLpForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LpForm> & { id: string }) => {
      const { data, error } = await supabase
        .from('form_pro_forms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as LpForm;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.id] });
    },
  });
}

export function useDeleteLpForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('form_pro_forms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export interface LpFormSubmission {
  id: string;
  form_id: string | null;
  lead_id: string | null;
  page_id: string | null;
  data: Record<string, unknown>;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ip_address: string | null;
  submitted_at: string;
}

const SUBMISSIONS_KEY = 'form-pro-submissions';

export function useLpFormSubmissions(formId: string | null) {
  return useQuery({
    queryKey: [SUBMISSIONS_KEY, formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from('form_pro_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LpFormSubmission[];
    },
    enabled: !!formId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useDeleteLpSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('form_pro_submissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] }),
  });
}
