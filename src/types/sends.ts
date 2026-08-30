// ============================================================
// SENDS PRO v2 — Type System (Multi-Channel Campaigns)
// ============================================================

// Core Enums
export type SendStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'failed';
export type SendType = 'imported' | 'filtered';
export type SendChannel = 'whatsapp' | 'email' | 'sms' | 'phone';
export type ContactStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'invalid';

export interface WhatsappChannel {
  id: string;
  label: string;
  phone_number_id: string;
  is_default: boolean;
  active: boolean;
}

// UI-only channel id — voice_ai maps to channel='phone' + filter_config.voice_agent_id at save time
export type SendChannelUi = SendChannel | 'voice_ai';

// Channel Configuration (UI-facing — voice_ai is shown as a separate channel option)
export const SEND_CHANNELS = [
  {
    id: 'whatsapp' as const,
    value: 'whatsapp' as const,
    label: 'WhatsApp',
    icon: 'MessageCircle',
    contactField: 'whatsapp',
    description: 'Filtra por nº WhatsApp',
  },
  {
    id: 'email' as const,
    value: 'email' as const,
    label: 'Email',
    icon: 'Mail',
    contactField: 'email',
    description: 'Filtra por e-mail',
  },
  {
    id: 'sms' as const,
    value: 'sms' as const,
    label: 'SMS',
    icon: 'Smartphone',
    contactField: 'telefone',
    description: 'Filtra por telefone',
  },
  {
    id: 'phone' as const,
    value: 'phone' as const,
    label: 'Telefone',
    icon: 'Phone',
    contactField: 'telefone',
    description: 'Filtra por telefone',
  },
  {
    id: 'voice_ai' as const,
    value: 'phone' as const,
    label: 'Voice AI',
    icon: 'Bot',
    contactField: 'telefone',
    description: 'Chamada com agente IA',
    isVoiceAI: true,
  },
] as const;

export interface Send {
  id: string;
  name: string;
  type: SendType;
  channel: SendChannel;
  template_id: string | null; // UUID of whatsapp_templates (stored as text in DB)
  pipeline_id: string | null;
  stage_ids: string[] | null; // Array of stage UUIDs (no FK constraint)
  webhook_id: string | null;
  wa_channel_id: string | null;
  message_content: string | null;  // Non-WhatsApp channels (Email/SMS/Phone)
  status: SendStatus;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  send_interval_seconds: number;
  filter_config: SendFilters | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Related data (only fields with FK relationships)
  pipeline?: {
    id: string;
    name: string;
  };
  webhook?: SendWebhook;
  wa_channel?: WhatsappChannel;
  created_by_user?: {
    id: string;
    name: string;
  };
}

export function getVoiceAgentId(send: Pick<Send, 'channel' | 'filter_config'>): string | null {
  if (send.channel !== 'phone') return null;
  return (send.filter_config as { voice_agent_id?: string } | null)?.voice_agent_id ?? null;
}

export function isVoiceSend(send: Pick<Send, 'channel' | 'filter_config'>): boolean {
  return !!getVoiceAgentId(send);
}

export interface SendContact {
  id: string;
  send_id: string;
  people_id: string;
  whatsapp: string; // Generic contact value — stores email/phone/whatsapp depending on campaign channel
  status: ContactStatus;
  error_message: string | null;
  retry_count: number; // Number of webhook dispatch retry attempts (0 = first try, max 3)
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;

  // Related person data (populated via JOIN)
  person?: {
    id: string;
    name: string;
    email?: string;
    status: string;
  };
}

export interface SendWebhook {
  id: string;
  name: string;
  webhook_url: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Tipos para o novo sistema de Webhooks por módulo
export type WebhookEventType = 'conversa' | 'disparo' | 'lead_etapa' | 'followup';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  event_type: WebhookEventType;
  headers?: Record<string, string> | null;
  active: boolean;
  /** Para lead_etapa: UUID do pipeline (null = todos) */
  pipeline_id?: string | null;
  /** Para lead_etapa: array de stage UUIDs (vazio = todas as etapas) */
  stage_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  request_body: any;
  response_body: any;
  status_code: number;
  error_message: string | null;
  created_at: string;
  webhook?: Webhook;
}

export const WEBHOOK_EVENT_TYPES: { value: WebhookEventType; label: string; description: string; module?: string }[] = [
  { value: 'conversa',   label: 'Conversa',     description: 'Disparado ao enviar texto, imagem, áudio ou arquivo pela interface', module: 'OMNI PRO™' },
  { value: 'disparo',    label: 'Disparo',       description: 'Quando um disparo de campanha é executado', module: 'SENDS PRO™' },
  { value: 'lead_etapa', label: 'Etapa do Lead', description: 'Quando um lead é criado ou muda de etapa no pipeline', module: 'CRM PRO™' },
  { value: 'followup',   label: 'Follow-up',     description: 'Disparado pelo motor de follow-ups automáticos', module: 'Follow-ups PRO™' },
];

export interface SendFilters {
  // Filtros de Lead
  pipeline_id?: string;
  stage_ids?: string[];
  lead_status?: ('in_progress' | 'won' | 'lost')[];
  user_id?: string[];
  team_id?: string[];
  created_from?: string;
  created_to?: string;
  value_min?: number;
  value_max?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  // Filtros de Pessoa
  name?: string;
  email?: string;
  person_status?: ('active' | 'inactive' | 'archived')[];
  service_status?: ('open' | 'closed' | 'in_service')[];
  accepts_calls?: boolean | null;
  ai_enabled?: boolean | null;
  score_matrix_id?: string;
  score_framing_id?: string;
  score_investment_id?: string;
  score_objective_id?: string;
  
  // Filtros de Qualificação (Q-fields B2B — match clients_people columns)
  q1_main_bottleneck?: string;
  q2_lead_volume_month?: string;
  q3_team_size?: string;
  q4_crm_maturity?: string;
  q5_crm_name?: string;
  q6_trigger?: string;
  q19_qualification_status?: string;
  q21_interest_level?: string;
  q22_close_probability?: string;
}

export interface ImportedContact {
  name: string;
  whatsapp: string;
  email?: string;
  [key: string]: any;
}

export interface ContactRef {
  people_id: string;
  whatsapp?: string;
  email?: string;
}

export interface ImportResult {
  new_people: number;
  existing_people: number;
  total: number;
  people_ids: string[];
  contacts: Array<{ people_id: string; whatsapp: string | null; email: string | null }>;
}

export interface FilterResult {
  total: number;
  contacts: Array<{
    people_id: string;
    lead_id: string | null;
    name: string;
    whatsapp?: string;
    email?: string;
    telefone?: string; // For SMS/Phone channels
    lead?: {
      id: string;
      status: string;
      title: string;
      value: number | null;
    } | null;
  }>;
}
