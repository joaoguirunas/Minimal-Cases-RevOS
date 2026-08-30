/**
 * AI-AGENT-EXECUTE — N8N-WAA Phase 2 (N8N-WAA-6 + N8N-WAA-7 + N8N-WAA-8)
 *
 * Core AI Agent Runtime. Called by pg_cron via pg_net when message_buffer expires.
 *
 * Flow:
 *   1. Receive { people_id } from pg_net (process_message_buffer cron)
 *   2. Find active lead → find agent via pipeline_id
 *   3. Fetch API key from settings_ai_providers
 *   4. Load full context (person, lead, company, Q-fields, meetings, score)
 *   5. Build conversation memory from messages table
 *   6. Render system prompt (identity + general_rules + input_data + step)
 *   7. Run agentic loop: LLM → tool_calls → execute → repeat until done
 *   8. Call whatsapp-outbound with final response text
 *   9. Persist AI messages to messages table
 *  10. Mark message_buffer as processed + release ai_processing_lock
 *  11. Log to ai_agents_execution_log
 *
 * Supports: openai, groq (openai-compat), anthropic, gemini (openai-compat)
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   APP_URL — public app URL (e.g. https://app.growthsales.com.br), required for enviar_link_agendamento
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TOOL_ITERATIONS = 8;
const LLM_TIMEOUT_MS = 30_000; // 30s — leaves ~30s for setup + cleanup within 60s edge function limit

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentConfig {
  id: string;
  identity: string | null;
  general_rules: string | null;
  input_data: string | null;
  use_stages: boolean;
  llm_provider: string;
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  llm_provider_id: string | null;
  memory_window: number;
  wa_phone_number_id: string | null;
  buffer_ms: number;
  pipeline_id: string | null;
  pipeline_ids: string[]; // multi-pipeline support
  channel_types: string[];
  stage_ids: string[];
  // G2: Score gate routing — only fire if person.score matches a configured matrix
  score_matrix_ids: string[];
  score_allow_empty: boolean; // if true, also fires for leads with no score (null/0)
  // G3: Origem lista gate — only fire for leads with matching origem_lista
  origem_lista_filters: string[]; // [] = no filter (all leads pass)
  humanizacao: string; // 'alta' | 'media' | 'nenhuma' — controls message splitting
  voice_enabled: boolean;
  voice_response_mode: string; // 'mirror' | 'always'
  voice_id: string | null;
  voice_stability: number | null;
  voice_similarity: number | null;
  voice_speed: number | null;
  voice_model_id: string | null;
}

interface AgentStep {
  id: string;
  name: string;
  prompt: string;
  control: string | null;
  order_index: number;
}

interface ContextData {
  // Lead
  lead_id: string;
  lead_titulo: string;
  lead_control: string;
  lead_status: string;
  lead_valor: string;
  lead_etapa_nome: string;
  lead_etapa_id: string;
  lead_responsavel_id: string;
  lead_responsavel_nome: string;
  lead_responsavel_email: string;
  lead_responsavel_telefone: string;
  lead_ultima_interacao: string;
  lead_temperatura: string;
  lead_prob_fechamento: string;
  pipeline_etapas: string;
  // Pessoa
  pessoa_id: string;
  nome: string;
  email: string;
  whatsapp: string;
  cargo: string;
  score: string;
  objetivo: string;
  momento: string;
  resumo_conversa: string;
  instagram_handle: string;
  document: string;
  identity_collection_opted_out: string;
  // Empresa
  empresa_id: string;
  empresa_nome: string;
  empresa_segmento: string;
  empresa_porte: string;
  empresa_website: string;
  empresa_cnpj: string;
  // Score
  score_number: string;
  score_framing_name: string;
  score_investment_name: string;
  score_objective_name: string;
  // Q-fields (flat map)
  [key: string]: string;
  // Agenda
  reunioes_proximas: string;
  slots_disponiveis: string;
  // Metadata
  criado_em: string;
  atualizado_em: string;
  hoje: string;
  // RETORNO-02 — data/hora corrente em BRT (ISO com offset) + retorno agendado pendente
  agora: string;
  retorno_pendente: string;
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

interface AnthropicContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface LeadFieldDef {
  id: string;
  key: string;
  name: string | null;
  type: string;
  entity_type: string;
}

// ── Tool Schemas ──────────────────────────────────────────────────────────────

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'atualizar_etapa',
    description: 'Move the lead to a different stage (kanban column) in the pipeline. Optionally updates the agent control value.',
    parameters: {
      type: 'object',
      properties: {
        leads_stages_id: { type: 'string', description: 'UUID of the target pipeline stage' },
        control: { type: 'string', description: 'New agent control value (e.g. "2", "agendamento")' },
      },
      required: ['leads_stages_id'],
    },
  },
  {
    name: 'atualizar_control',
    description: 'Updates only the agent control value on the lead without moving stages.',
    parameters: {
      type: 'object',
      properties: {
        control: { type: 'string', description: 'New control value for the agent execution flow' },
      },
      required: ['control'],
    },
  },
  {
    name: 'atualizar_lead',
    description: 'Updates lead fields: title, value, status, loss_reason, user_id, pre_sale_temperature (1-5 🔥), close_probability (1-5 ⭐).',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Fields to update (include only what changes)',
          properties: {
            title: { type: 'string' },
            value: { type: 'number' },
            status: { type: 'string', enum: ['in_progress', 'won', 'lost'] },
            loss_reason: { type: 'string' },
            user_id: { type: 'string' },
            pre_sale_temperature: { type: 'integer', description: 'Pre-sale temperature 1-5 (1=cold, 2=warm, 3=heating, 4=hot, 5=very hot)', enum: [1, 2, 3, 4, 5] },
            close_probability: { type: 'integer', description: 'Close probability 1-5 (1=20%, 2=40%, 3=60%, 4=80%, 5=100%)', enum: [1, 2, 3, 4, 5] },
          },
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'atualizar_pessoa',
    description: 'Updates person contact data: name, email, whatsapp, notes, telefone. For qualification fields (cargo, etc.), use salvar_qualificacao instead.',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Fields to update on clients_people',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            whatsapp: { type: 'string' },
            telefone: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'atualizar_empresa',
    description: 'Updates company data in clients_companies. Use empresa_id from context as company_id.',
    parameters: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'UUID of the company — use {{empresa_id}} from context' },
        fields: {
          type: 'object',
          description: 'Fields to update (include only what changes)',
          properties: {
            trade_name: { type: 'string', description: 'Commercial name (nome fantasia)' },
            legal_name: { type: 'string', description: 'Legal/registered name (razão social)' },
            tax_id:     { type: 'string', description: 'CNPJ or tax identifier' },
            email:      { type: 'string', description: 'Company contact email' },
            phone:      { type: 'string', description: 'Company phone' },
            website:    { type: 'string', description: 'Company website URL' },
            address:    { type: 'string', description: 'Physical address' },
          },
        },
      },
      required: ['company_id', 'fields'],
    },
  },
  {
    name: 'salvar_qualificacao',
    description: 'Saves a qualification field on the person record. Call this IMMEDIATELY after the person answers each qualification question — do not wait. Use the exact field key from the list below.',
    parameters: {
      type: 'object',
      properties: {
        p_field_key: {
          type: 'string',
          description: `Field key to save. Choose the best match:
- q1_main_bottleneck: main problem / bottleneck ("gargalo principal", "problema principal", "dor")
- q2_lead_volume_month: monthly lead volume ("quantos leads por mês", "volume de leads")
- q3_team_size: commercial team size ("quantas pessoas no comercial", "tamanho do time", "número de vendedores")
- q4_crm_maturity: CRM maturity level ("maturidade em CRM", "usa CRM", "nível de CRM")
- q5_crm_name: CRM tool name ("qual CRM usa", "nome do CRM")
- q6_trigger: trigger / what brought them here ("o que te trouxe aqui", "gatilho")
- q7_problem_impact: impact of the problem ("impacto do problema", "quanto perde")
- q8_engagement_level: engagement level ("nível de engajamento")
- q9_decision_authority: decision authority ("quem decide", "autoridade de decisão")
- q10_stakeholders: stakeholders involved ("outros envolvidos", "stakeholders")
- q11_budget_approved: budget approved ("orçamento aprovado", "budget")
- q12_timeline: decision timeline ("prazo", "quando quer resolver")
- q13_urgency_reason: reason for urgency ("por que urgente", "motivo da urgência")
- q14_data_ready: data readiness ("dados prontos", "base de dados")
- q15_minimum_volume: minimum viable volume ("volume mínimo")
- q16_expected_roi: expected ROI ("ROI esperado", "retorno esperado")
- q17_objections: objections raised ("objeções", "resistências")
- q18_real_fit: real fit assessment ("fit real", "adequação")
- q19_qualification_status: qualification status ("status de qualificação": "qualificado", "desqualificado", "em análise")
- q20_rejection_reason: rejection reason ("motivo de rejeição")
- q21_interest_level: interest level 1-10 ("nível de interesse", "interesse")
- q22_close_probability: close probability % ("probabilidade de fechamento")
- q23_behavioral_tags: behavioral tags ("tags comportamentais", "perfil comportamental")
- q25_disc_profile: DISC profile ("perfil DISC")
- conversation_summary: conversation summary ("resumo da conversa")
- goal: person's main goal/objective ("objetivo principal", "meta", "o que quer alcançar")
- moment: current moment/situation ("momento atual", "situação atual", "segmento", "área de atuação")`,
        },
        p_value: { type: 'string', description: 'Value to store (always string)' },
      },
      required: ['p_field_key', 'p_value'],
    },
  },
  {
    name: 'bloquear_ia',
    description: 'Disables AI for this person (ai_enabled=false). ONLY use when the person explicitly rejects the AI or asks for the real human by name. NEVER use for scheduling meetings — use enviar_link_agendamento instead.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for disabling AI (stored in notes)' },
      },
      required: [],
    },
  },
  {
    name: 'enviar_audio_convite_growth_experience',
    description: 'Sends the real audio (voice note) recorded by João explaining the Growth Experience event, followed automatically by the registration-link message. Call this ONCE, only on the FIRST clearly positive response to the invite. After calling it, your text reply must contain ONLY the orientation message and the audio-hook message — never the price, spot count, or the link; those follow automatically right after the audio.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'criar_agendamento',
    description: 'Creates a meeting (INSERT into meetings). System auto-creates Google Calendar / Teams event.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start_time: { type: 'string', description: 'ISO 8601 e.g. 2026-03-15T14:00:00' },
        end_time: { type: 'string', description: 'ISO 8601 e.g. 2026-03-15T15:00:00' },
        description: { type: 'string' },
        notes: { type: 'string', description: 'Internal context note' },
        user_id: { type: 'string', description: 'Responsible salesperson UUID' },
        meeting_link: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['title', 'start_time', 'end_time'],
    },
  },
  {
    name: 'consultar_disponibilidade',
    description: 'Returns available time slots for a salesperson on a given date.',
    parameters: {
      type: 'object',
      properties: {
        p_user_id: { type: 'string', description: 'Salesperson UUID' },
        p_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        p_period: { type: 'string', enum: ['morning', 'afternoon', 'evening'], description: 'Time of day filter — use ONLY when showing a curated list of options to the lead (e.g. they chose "comercial"). OMIT when the lead asked about a specific time, so all slots for the day are returned and the exact time can be verified.' },
        p_slot_minutes: { type: 'number', description: 'Slot duration in minutes (15|30|45|60). Default: 60' },
      },
      required: ['p_user_id', 'p_date'],
    },
  },
  {
    name: 'consultar_agenda',
    description: 'Lists meetings. Use PostgREST query_params to filter by date, status, etc.',
    parameters: {
      type: 'object',
      properties: {
        query_params: { type: 'string', description: 'PostgREST filter e.g. "status=eq.agendado&order=start_time.asc&limit=5"' },
      },
      required: ['query_params'],
    },
  },
  {
    name: 'remarcar_agendamento',
    description: 'Reschedules an existing meeting: updates start_time, end_time, and optionally notes/description.',
    parameters: {
      type: 'object',
      properties: {
        meeting_id:  { type: 'string', description: 'UUID of the meeting to reschedule' },
        start_time:  { type: 'string', description: 'New start time ISO 8601 e.g. 2026-03-20T14:00:00' },
        end_time:    { type: 'string', description: 'New end time ISO 8601 e.g. 2026-03-20T15:00:00' },
        notes:       { type: 'string', description: 'Optional internal note about the reschedule reason' },
      },
      required: ['meeting_id', 'start_time', 'end_time'],
    },
  },
  {
    name: 'cancelar_agendamento',
    description: 'Cancels a meeting by setting its status to "cancelado".',
    parameters: {
      type: 'object',
      properties: {
        meeting_id: { type: 'string', description: 'UUID of the meeting to cancel' },
        reason:     { type: 'string', description: 'Cancellation reason stored in notes' },
      },
      required: ['meeting_id'],
    },
  },
  {
    name: 'criar_nota',
    description: 'Creates an internal note on the lead (leads_notes table).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'enviar_link_agendamento',
    description: 'Use ONLY when the lead EXPLICITLY requests a meeting, call, or link ("me manda o link", "quero agendar", "pode marcar"). Do NOT call on generic affirmatives ("sim", "vamos lá", "ok", "claro") or commercial interest alone — follow the qualification script first. Builds the public self-scheduling link for this lead (always 30 min).',
    parameters: {
      type: 'object',
      properties: {
        leads_stages_id: { type: 'string', description: 'UUID of the "Agendamento Reunião" stage from {{pipeline_etapas}} — use ONLY the agendamento stage, never the "Reunião Agendada" stage. Leave empty if unsure.' },
      },
      required: [],
    },
  },
  {
    name: 'collect_identity',
    description: 'Saves an identity field (email, phone, instagram, CPF/CNPJ) on the contact. Triggers automatic deduplication if a duplicate is found. Use this when the contact provides identity info during conversation.',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          enum: ['email', 'whatsapp', 'instagram_handle', 'document'],
          description: 'Identity field to save',
        },
        value: {
          type: 'string',
          description: 'Value to save (will be normalized automatically)',
        },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'collect_identity_optout',
    description: 'Registers that the contact opted out of identity collection. After this, never ask for identity fields again.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the contact opted out (e.g. "Recusou fornecer Instagram")' },
      },
      required: [],
    },
  },
  {
    name: 'obter_reuniao',
    description: 'Returns the upcoming scheduled meeting for this lead: date, time, meeting link, and status. Use ONLY when the lead explicitly asks about their meeting details (date, time, link, etc.).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'iniciar_conversa_whatsapp',
    description: 'Sends an approved WhatsApp template to start a conversation with the lead on WhatsApp. Call ONLY after collect_identity(whatsapp) AND atualizar_etapa have been called in the same turn. Template by product: Mentoria→"start_mentoria_util_v2", Curso→"start_curso_online_util_v2", Consultoria→"start_diagnostico".',
    parameters: {
      type: 'object',
      properties: {
        template_name: {
          type: 'string',
          description: 'Approved Meta template name to send. Use "start_mentoria_util_v2" for Mentoria, "start_curso_online_util_v2" for Curso, "start_diagnostico" for Consultoria.',
        },
      },
      required: ['template_name'],
    },
  },
  {
    name: 'enviar_link_compra',
    description: 'Sends the Kiwify checkout link for a product directly to the lead as a separate message. Use ONLY after the lead has explicitly decided which product to buy and confirmed they want the link ("me manda o link", "quero comprar", "como faço pra assinar"). Do NOT call for generic interest alone — confirm the specific product first.',
    parameters: {
      type: 'object',
      properties: {
        produto: {
          type: 'string',
          enum: ['squad_social', 'squad_dev', 'squad_sites', 'mentoria'],
          description: 'Which product checkout link to send.',
        },
      },
      required: ['produto'],
    },
  },
  {
    name: 'consultar_pagamento_pendente',
    description: 'Looks up whether this contact has a pending Pix or boleto payment generated via Kiwify (e.g. they started checkout but did not finish). Returns the copy-paste Pix code or boleto barcode/link if found and not yet paid. Use ONLY when the lead asks about a payment they already started (e.g. "cadê o código pix", "perdi o link do boleto", "onde pago").',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'enviar_opcoes_horario',
    description: 'Sends WhatsApp interactive quick-reply buttons with time slot options. Use this INSTEAD of listing slots as text. Call after consultar_disponibilidade returns available slots. Use exactly the 2 slots returned — do not add more. Max 20 chars per option.',
    parameters: {
      type: 'object',
      properties: {
        body: { type: 'string', description: 'Message body shown above the buttons (e.g. "Temos esses horários na segunda:")' },
        opcoes: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of 2-3 time options (e.g. ["09:30 - 10:00", "10:00 - 10:30"]). Max 3 items, each max 20 characters.',
        },
      },
      required: ['body', 'opcoes'],
    },
  },
  {
    name: 'atualizar_score',
    description: 'Sets the lead score by selecting one item from each of the 3 score categories: Objetivo (objective/goal), Investimento (investment range), and Enquadramento/Intenção (framing/intent). The score is auto-calculated from the score matrix after all 3 are set. Pass the EXACT name of each item as configured in the tenant\'s score settings.',
    parameters: {
      type: 'object',
      properties: {
        objective: { type: 'string', description: 'Name of the Objetivo item (e.g. "Cidadania Italiana", "EB-2 NIW")' },
        investment: { type: 'string', description: 'Name of the Investimento item (e.g. "R$ 10k-30k", "Acima de R$ 50k")' },
        framing: { type: 'string', description: 'Name of the Enquadramento/Intenção item (e.g. "Pesquisando", "Pronto para iniciar")' },
      },
      required: ['objective', 'investment', 'framing'],
    },
  },
];

// ── RETORNO-02 — Tools condicionais de retorno agendado (ADR-RETORNO-01 D2/D3) ──
//
// NÃO fazem parte de TOOL_DEFINITIONS: só são concatenadas por buildToolDefinitions()
// quando existe ai_agent_callback_configs.enabled = true para o agente/step corrente.
// As 22 tools estáticas permanecem inalteradas.

interface CallbackTemplate {
  id: string;
  label?: string | null;
  body?: string | null;
  whatsapp_template_name?: string | null;
}

interface CallbackConfig {
  id: string;
  agent_id: string;
  step_id: string | null;
  enabled: boolean;
  default_mode: 'direct' | 'agent';
  allow_agent_choose_mode: boolean;
  allow_free_text: boolean;
  templates: CallbackTemplate[];
  free_prompt: string | null;
  whatsapp_template_fallback: string | null;
  min_delay_minutes: number;
  max_delay_hours: number;
  cancel_on_resume: boolean;
}

const CALLBACK_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'agendar_retorno',
    description:
      'Agenda um retorno (callback) para falar com o lead mais tarde. Use SOMENTE quando o lead pedir explicitamente para ser chamado depois ("me chama em 15 minutos", "me chama amanhã de manhã", "fala comigo semana que vem"). ' +
      'Resolva a data/hora ANTES de chamar, usando {{agora}} (data+hora atual em BRT) e {{hoje}} (calendário dos próximos 8 dias) — o backend NÃO interpreta linguagem natural. ' +
      'NUNCA invente um horário que o lead não pediu. Existe no máximo UM retorno pendente por lead: uma nova chamada substitui (reagenda) o anterior.',
    parameters: {
      type: 'object',
      properties: {
        scheduled_for: {
          type: 'string',
          description: 'Momento do retorno em ISO-8601 COM offset, ex: "2026-07-22T14:30:00-03:00". Calcule a partir de {{agora}}.',
        },
        motivo: {
          type: 'string',
          description: 'Por que o lead pediu o retorno (ex: "pediu para retomar depois da reunião dele às 14h").',
        },
        template_id: {
          type: 'string',
          description: 'Opcional. id de um dos templates permitidos na configuração do agente.',
        },
        mensagem: {
          type: 'string',
          description: 'Opcional. Texto livre da mensagem de retorno (só aceito se a configuração permitir texto livre).',
        },
        modo: {
          type: 'string',
          enum: ['direct', 'agent'],
          description: 'Opcional. "direct" envia a mensagem pronta; "agent" reinvoca o agente no horário. Só é respeitado se a configuração permitir.',
        },
      },
      required: ['scheduled_for', 'motivo'],
    },
  },
  {
    name: 'cancelar_retorno',
    description:
      'Cancela o retorno agendado pendente deste lead. Use quando o lead retomar a conversa antes do horário combinado (pergunta, objeção, resposta com conteúdo, mudança de assunto) ou quando ele desistir do retorno. ' +
      'NÃO cancele por confirmação genérica sem conteúdo ("ok", "beleza", "tá bom", emoji solto). Se o lead pedir OUTRO horário, use agendar_retorno (que substitui o pendente) em vez de cancelar.',
    parameters: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Por que o retorno está sendo cancelado.' },
      },
      required: ['motivo'],
    },
  },
];

// ── OpenAI-compatible tool format ─────────────────────────────────────────────

function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function toAnthropicTools(tools: ToolDefinition[]) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

// ── Dynamic Field Definitions Cache ──────────────────────────────────────────

const fieldDefsCache = new Map<string, { defs: LeadFieldDef[]; ts: number }>();

async function getLeadFieldDefs(
  supabase: ReturnType<typeof createClient>,
  pipelineId: string | null,
): Promise<LeadFieldDef[]> {
  const cacheKey = pipelineId ?? '__global__';
  const cached = fieldDefsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.defs;

  const baseQuery = supabase
    .from('lead_field_definitions')
    .select('id, key, name, type, entity_type')
    .eq('active', true);

  const { data, error } = pipelineId
    ? await baseQuery.or(`pipeline_id.eq.${pipelineId},pipeline_id.is.null`)
    : await baseQuery.is('pipeline_id', null);

  // FIX-AGENT-FIELDDEFS-CACHE-01: never cache an empty list on a query error.
  // A transient failure (timeout/blip) returns data=null; caching [] for the
  // 5-min TTL made salvar_qualificacao + buildToolDefinitions reject every
  // custom field during the window. On error, fall back to the last known-good
  // cache (even if expired) and do NOT overwrite it, so a recovered query can
  // repopulate on the next call. Only a successful fetch updates the cache.
  if (error) {
    console.warn(`getLeadFieldDefs: query failed (cacheKey=${cacheKey}) — not caching: ${error.message}`);
    return cached?.defs ?? [];
  }

  const defs = (data ?? []) as LeadFieldDef[];
  fieldDefsCache.set(cacheKey, { defs, ts: Date.now() });
  return defs;
}

// ── RETORNO-02 — Config de callback + helpers de data/hora BRT ────────────────

const callbackLog = createLogger('ai-agent-execute');

/** Brasil não observa horário de verão desde 2019 → offset fixo -03:00. */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

function brtParts(d: Date): { dd: string; mm: string; yyyy: string; HH: string; MI: string; SS: string } {
  const b = new Date(d.getTime() + BRT_OFFSET_MS);
  return {
    dd: String(b.getUTCDate()).padStart(2, '0'),
    mm: String(b.getUTCMonth() + 1).padStart(2, '0'),
    yyyy: String(b.getUTCFullYear()),
    HH: String(b.getUTCHours()).padStart(2, '0'),
    MI: String(b.getUTCMinutes()).padStart(2, '0'),
    SS: String(b.getUTCSeconds()).padStart(2, '0'),
  };
}

/** "22/07/2026 às 14:30" */
function formatBrtHuman(d: Date): string {
  const p = brtParts(d);
  return `${p.dd}/${p.mm}/${p.yyyy} às ${p.HH}:${p.MI}`;
}

/** "2026-07-22T14:30:00-03:00" */
function formatBrtIso(d: Date): string {
  const p = brtParts(d);
  return `${p.yyyy}-${p.mm}-${p.dd}T${p.HH}:${p.MI}:${p.SS}-03:00`;
}

/**
 * Config da tool de retorno para o agente/step corrente.
 * Fallback step_id IS NULL é OBRIGATÓRIO: com use_stages=true o step só resolve
 * quando lead.control casa — sem o default do agente a tool sumiria em silêncio
 * (memória: ai-agent-use-stages-control-trap).
 */
async function loadCallbackConfig(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  stepId: string | null,
): Promise<CallbackConfig | null> {
  // Tabela criada na RETORNO-01 e ausente de types.ts → cast de fronteira (padrão kiwify_*).
  const { data, error } = await (supabase as any)
    .from('ai_agent_callback_configs')
    .select('*')
    .eq('agent_id', agentId);

  if (error) {
    callbackLog.error('callback_config_load_failed', { agent_id: agentId, error: error.message });
    return null;
  }

  const rows = (data ?? []) as CallbackConfig[];
  if (rows.length === 0) return null;

  const stepRow = stepId ? rows.find(r => r.step_id === stepId) : undefined;
  const defaultRow = rows.find(r => r.step_id === null);
  const chosen = stepRow ?? defaultRow ?? null;
  if (!chosen) return null;

  return {
    ...chosen,
    templates: Array.isArray(chosen.templates) ? chosen.templates : [],
    min_delay_minutes: Number(chosen.min_delay_minutes ?? 5),
    max_delay_hours: Number(chosen.max_delay_hours ?? 720),
  };
}

/** A config viaja no ctx (mesmo padrão dos flags internos __agendamento_criado/__interactive_sent). */
function callbackConfigFromCtx(ctx: ContextData): CallbackConfig | null {
  const raw = (ctx as unknown as Record<string, string>).__callback_config;
  if (!raw) return null;
  try { return JSON.parse(raw) as CallbackConfig; } catch { return null; }
}

async function buildToolDefinitions(
  supabase: ReturnType<typeof createClient>,
  pipelineId: string | null,
  callbackConfig: CallbackConfig | null = null,
): Promise<ToolDefinition[]> {
  // RETORNO-02: tools condicionais — só entram quando a config existe e está habilitada.
  const conditional: ToolDefinition[] = callbackConfig?.enabled ? CALLBACK_TOOL_DEFINITIONS : [];
  const customDefs = await getLeadFieldDefs(supabase, pipelineId);
  if (customDefs.length === 0) {
    return conditional.length > 0 ? [...TOOL_DEFINITIONS, ...conditional] : TOOL_DEFINITIONS;
  }

  const customProps: Record<string, unknown> = {};
  for (const def of customDefs) {
    customProps[def.key] = {
      type: def.type === 'number' ? 'number' : def.type === 'boolean' ? 'boolean' : 'string',
      description: def.name ?? def.key,
    };
  }

  const extraQKeysDesc = `\nCustom tenant fields: ${customDefs.map(d => d.key).join(', ')}`;

  const enriched = TOOL_DEFINITIONS.map(t => {
    if (t.name === 'atualizar_lead' || t.name === 'atualizar_pessoa' || t.name === 'atualizar_empresa') {
      const params = JSON.parse(JSON.stringify(t.parameters)) as Record<string, unknown>;
      const fieldsObj = (params.properties as Record<string, unknown>).fields as Record<string, unknown>;
      const existing = (fieldsObj.properties as Record<string, unknown>) ?? {};
      fieldsObj.properties = { ...existing, ...customProps };
      return { ...t, parameters: params };
    }
    if (t.name === 'salvar_qualificacao') {
      const params = JSON.parse(JSON.stringify(t.parameters)) as Record<string, unknown>;
      const pFieldKeyProp = (params.properties as Record<string, unknown>).p_field_key as Record<string, unknown>;
      pFieldKeyProp.description = String(pFieldKeyProp.description ?? '') + extraQKeysDesc;
      return { ...t, parameters: params };
    }
    return t;
  });

  return conditional.length > 0 ? [...enriched, ...conditional] : enriched;
}

async function upsertCustomFieldValue(
  supabase: ReturnType<typeof createClient>,
  leadId: string | null,
  def: LeadFieldDef,
  rawValue: unknown,
  pessoaId?: string | null,
): Promise<string | null> {
  let coercedValue: unknown;
  let colName: string;

  if (def.type === 'number') {
    const n = Number(rawValue);
    if (isNaN(n)) return `Error: "${def.key}" expects a number, got "${rawValue}"`;
    coercedValue = n;
    colName = 'value_number';
  } else if (def.type === 'boolean') {
    coercedValue = ['true', '1', 'sim', 'yes', true, 1].includes(rawValue as string | boolean | number);
    colName = 'value_boolean';
  } else if (def.type === 'date') {
    coercedValue = String(rawValue ?? '');
    colName = 'value_date';
  } else {
    coercedValue = String(rawValue ?? '').slice(0, 2000);
    colName = 'value_text';
  }

  const entityType = (def.entity_type === 'pessoa' && pessoaId) ? 'pessoa' : 'negocio';
  const entityId = entityType === 'pessoa' ? pessoaId! : (leadId ?? '');
  const row: Record<string, unknown> = {
    entity_type: entityType,
    entity_id: entityId,
    field_definition_id: def.id,
    [colName]: coercedValue,
  };
  if (entityType === 'negocio' && leadId) row.lead_id = leadId;

  const { error } = await supabase
    .from('lead_field_values')
    .upsert(row, { onConflict: 'entity_type,entity_id,field_definition_id' });
  return error ? `Error saving "${def.key}": ${error.message}` : null;
}

// ── Context Loader ────────────────────────────────────────────────────────────

async function loadContext(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
): Promise<{ context: ContextData; leadId: string | null; companyId: string | null; aiEnabled: boolean }> {
  const ctx: Partial<ContextData> = {};
  let aiEnabled = true; // G1: default to true (safe — only block if explicitly false)

  // Batch 1: 3 independent queries in parallel (all need only peopleId)
  const [personResult, leadResult, meetingsResult] = await Promise.all([
    supabase
      .from('clients_people')
      .select(`
        id, name, email, whatsapp, score, score_matrix_id, notes, created_at, updated_at, ai_enabled,
        goal, moment, conversation_summary,
        instagram_handle, document, identity_collection_opted_out,
        income, telefone, disc_profile, disc_summary, source,
        q1_main_bottleneck, q2_lead_volume_month, q3_team_size, q4_crm_maturity, q5_crm_name,
        q6_trigger, q7_problem_impact, q8_engagement_level, q9_decision_authority, q10_stakeholders,
        q11_budget_approved, q12_timeline, q13_urgency_reason, q14_data_ready, q15_minimum_volume,
        q16_expected_roi, q17_objections, q18_real_fit, q19_qualification_status, q20_rejection_reason,
        q21_interest_level, q22_close_probability, q23_behavioral_tags, q24_last_update_by_agent,
        q25_disc_profile
      `)
      .eq('id', peopleId)
      .single(),
    supabase
      .from('leads')
      .select(`
        id, title, control, status, value, user_id, leads_stages_id, leads_pipelines_id,
        created_at, last_interaction_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        pre_sale_temperature, close_probability, lead_source, lifecycle_stage, description,
        recomendante, relacao_recomendante, relacao_corretor, nome_evento, origem_lista,
        stage:leads_stages!leads_leads_stages_id_fkey(id, name, ai_priority)
      `)
      .eq('people_id', peopleId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('id, title, start_time, end_time, status, notes, meeting_link')
      .eq('people_id', peopleId)
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(3),
  ]);

  const person = personResult.data;
  // MULTI-PIPELINE-01: um people_id pode ter mais de um lead 'in_progress'
  // simultâneo (leads em pipelines diferentes — ex. via kiwify-process-event
  // criando um lead novo por pipeline). Quando isso acontece, a IA só deve
  // agir pelo pipeline cuja etapa atual do lead está marcada como
  // "prioridade da IA" (leads_stages.ai_priority). Sem marcação clara
  // (nenhuma ou mais de uma etapa marcada), cai no comportamento anterior:
  // o lead criado mais recentemente (activeLeads já vem ordenado desc).
  const activeLeads = (leadResult.data ?? []) as unknown as Array<Record<string, any>>;
  let lead = activeLeads[0] ?? null;
  if (activeLeads.length > 1) {
    const priorityLeads = activeLeads.filter((l) => (l.stage as any)?.ai_priority === true);
    if (priorityLeads.length === 1) {
      lead = priorityLeads[0];
    } else {
      console.warn(
        `loadContext: people_id=${peopleId} tem ${activeLeads.length} leads ativos em pipelines diferentes e ` +
        `${priorityLeads.length} com ai_priority — sem resolução única, usando o mais recente (lead_id=${lead?.id}).`
      );
    }
  }
  const meetings = meetingsResult.data;

  // Populate person ctx
  const companyId: string | null = null; // company_id column not present in this schema
  const leadId: string | null = lead?.id ?? null;

  if (person) {
    ctx.pessoa_id = person.id ?? '';
    ctx.nome = person.name ?? '';
    ctx.email = person.email ?? '';
    ctx.whatsapp = person.whatsapp ?? '';
    ctx.score = String(person.score ?? '');
    ctx.cargo = '';
    ctx.criado_em = person.created_at ?? '';
    ctx.atualizado_em = person.updated_at ?? '';
    // Build a 7-day calendar so ORA can resolve relative dates (amanhã, segunda, etc.) without arithmetic
    const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const nowBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const calLines: string[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(nowBrt);
      d.setDate(nowBrt.getDate() + i);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[d.getDay()];
      calLines.push(`${label}: ${dd}/${mm}/${yyyy} (${dayNames[d.getDay()]})`);
    }
    // RETORNO-02: hora corrente — sem ela o agente não resolve "em 15 minutos"
    // nem valida "hoje às 16h" (ADR-RETORNO-01 D3).
    const nowUtc = new Date();
    ctx.agora = formatBrtIso(nowUtc);
    ctx.hoje = [`Agora: ${formatBrtHuman(nowUtc).replace(' às ', ' ')} (BRT)`, ...calLines].join('\n');
    aiEnabled = person.ai_enabled !== false; // G1
    ctx.objetivo = (person as any).goal ?? '';
    ctx.momento = (person as any).moment ?? '';
    ctx.resumo_conversa = (person as any).conversation_summary ?? '';
    ctx.instagram_handle = (person as any).instagram_handle ?? '';
    ctx.document = (person as any).document ?? '';
    ctx.identity_collection_opted_out = String((person as any).identity_collection_opted_out ?? false);
    ctx.renda = (person as any).income ?? '';
    ctx.telefone = (person as any).telefone ?? '';
    ctx.disc_profile = (person as any).disc_profile ?? '';
    ctx.disc_summary = (person as any).disc_summary ?? '';
    ctx.pessoa_source = (person as any).source ?? '';
    ctx.notas = (person as any).notes ?? '';

    const Q_DIRECT = [
      'q1_main_bottleneck', 'q2_lead_volume_month', 'q3_team_size', 'q4_crm_maturity',
      'q5_crm_name', 'q6_trigger', 'q7_problem_impact', 'q8_engagement_level',
      'q9_decision_authority', 'q10_stakeholders', 'q11_budget_approved', 'q12_timeline',
      'q13_urgency_reason', 'q14_data_ready', 'q15_minimum_volume', 'q16_expected_roi',
      'q17_objections', 'q18_real_fit', 'q19_qualification_status', 'q20_rejection_reason',
      'q21_interest_level', 'q22_close_probability', 'q23_behavioral_tags',
      'q24_last_update_by_agent', 'q25_disc_profile',
    ] as const;
    for (const col of Q_DIRECT) {
      ctx[col] = String((person as any)[col] ?? '');
    }
  }

  // Populate lead ctx
  if (lead) {
    ctx.lead_id = lead.id ?? '';
    ctx.lead_titulo = lead.title ?? '';
    ctx.lead_control = lead.control ?? '1';
    ctx.lead_status = lead.status ?? '';
    ctx.lead_valor = lead.value ? String(lead.value) : '';
    ctx.lead_etapa_nome = (lead.stage as any)?.name ?? '';
    ctx.lead_etapa_id = (lead.stage as any)?.id ?? lead.leads_stages_id ?? '';
    ctx.lead_responsavel_id = lead.user_id ?? '';
    if (lead?.user_id) {
      const { data: responsavel } = await supabase
        .from('settings_users')
        .select('id, name, email, phone')
        .eq('id', lead.user_id)
        .single();
      ctx.lead_responsavel_nome = responsavel?.name ?? '';
      ctx.lead_responsavel_email = responsavel?.email ?? '';
      ctx.lead_responsavel_telefone = responsavel?.phone ?? '';
    } else {
      ctx.lead_responsavel_nome = '';
      ctx.lead_responsavel_email = '';
      ctx.lead_responsavel_telefone = '';
    }
    ctx.lead_ultima_interacao = lead.last_interaction_at ?? lead.created_at ?? '';
    ctx.lead_temperatura = String((lead as any).pre_sale_temperature ?? '');
    ctx.lead_prob_fechamento = String((lead as any).close_probability ?? '');
    ctx.lead_utm_source = lead.utm_source ?? '';
    ctx.lead_utm_medium = (lead as any).utm_medium ?? '';
    ctx.lead_utm_campaign = (lead as any).utm_campaign ?? '';
    ctx.lead_utm_term = (lead as any).utm_term ?? '';
    ctx.lead_utm_content = (lead as any).utm_content ?? '';
    ctx.lead_source = (lead as any).lead_source ?? '';
    ctx.lead_lifecycle = (lead as any).lifecycle_stage ?? '';
    ctx.lead_descricao = (lead as any).description ?? '';
    ctx.recomendante = (lead as any).recomendante ?? '';
    ctx.relacao_recomendante = (lead as any).relacao_recomendante ?? '';
    ctx.relacao_corretor = (lead as any).relacao_corretor ?? '';
    ctx.nome_evento = (lead as any).nome_evento ?? '';
    ctx.origem_lista = (lead as any).origem_lista ?? '';
    ctx['lead_pipeline_id'] = lead.leads_pipelines_id ?? '';
  } else {
    ctx.lead_id = '';
    ctx.lead_titulo = '';
    ctx.lead_control = '1';
    ctx.lead_status = '';
    ctx.lead_valor = '';
    ctx.lead_etapa_nome = '';
    ctx.lead_etapa_id = '';
    ctx.lead_responsavel_id = '';
    ctx.lead_responsavel_nome = '';
    ctx.lead_responsavel_email = '';
    ctx.lead_responsavel_telefone = '';
    ctx.lead_ultima_interacao = '';
    ctx.lead_temperatura = '';
    ctx.lead_prob_fechamento = '';
    ctx.pipeline_etapas = '';
  }

  // Populate meetings ctx
  ctx.reunioes_proximas = meetings && meetings.length > 0
    ? JSON.stringify(meetings.map(m => ({ id: m.id, titulo: m.title, data: m.start_time, fim: m.end_time, link: m.meeting_link ?? null, status: m.status })))
    : '';
  ctx.slots_disponiveis = '';

  // Batch 2: pipeline stages + company (via junction) + score category names
  const [stagesResult, companyResult, scoreItemsResult] = await Promise.all([
    lead?.leads_pipelines_id
      ? supabase.from('leads_stages').select('id, name, order_index').eq('leads_pipelines_id', lead.leads_pipelines_id).eq('active', true).order('order_index')
      : Promise.resolve({ data: null, error: null }),
    // Resolve company via junction table clients_people_companies
    supabase
      .from('clients_people_companies')
      .select('company:clients_companies!inner(id, trade_name, website, tax_id)')
      .eq('people_id', peopleId)
      .limit(1)
      .maybeSingle(),
    // Resolve score category item names for context (objetivo, investimento, enquadramento)
    person?.score_matrix_id
      ? supabase
          .from('score_matrix')
          .select('category_selections')
          .eq('id', (person as any).score_matrix_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Company ctx — resolved via junction
  const company = (companyResult?.data as any)?.company;
  ctx.empresa_id = company?.id ?? '';
  ctx.empresa_nome = company?.trade_name ?? '';
  ctx.empresa_segmento = '';  // not a native column yet
  ctx.empresa_porte = '';
  ctx.empresa_website = company?.website ?? '';
  ctx.empresa_cnpj = company?.tax_id ?? '';

  // Score ctx — resolve category item names from matrix selections
  ctx.score_number = ctx.score ?? '';
  ctx.score_framing_name = '';
  ctx.score_investment_name = '';
  ctx.score_objective_name = '';

  if (scoreItemsResult?.data?.category_selections) {
    const selections = (scoreItemsResult.data as any).category_selections as Record<string, string[]>;
    const allItemIds = Object.values(selections).flat();
    if (allItemIds.length > 0) {
      const { data: items } = await supabase
        .from('score_category_items')
        .select('id, name, category:score_categories!inner(slug)')
        .in('id', allItemIds);
      if (items) {
        for (const item of items) {
          const slug = (item.category as any)?.slug ?? '';
          if (slug === 'objectives' || slug === 'objetivo') ctx.score_objective_name = item.name;
          else if (slug === 'investments' || slug === 'investimento') ctx.score_investment_name = item.name;
          else if (slug === 'framing' || slug === 'enquadramento') ctx.score_framing_name = item.name;
        }
      }
    }
  }

  // Pipeline stages ctx
  const stages = stagesResult.data as any[] | null;
  ctx.pipeline_etapas = stages && stages.length > 0
    ? stages.map((s: any) => `${s.name} (${s.id})`).join(' | ')
    : ctx.pipeline_etapas ?? '';

  // Batch 2b: Custom field definitions + values for this lead/pipeline
  const pipelineId = lead?.leads_pipelines_id ?? null;
  const [fieldDefsResult, fieldValsResult] = await Promise.all([
    pipelineId
      ? supabase
          .from('lead_field_definitions')
          .select('id, key, type')
          .eq('active', true)
          .or(`pipeline_id.eq.${pipelineId},pipeline_id.is.null`)
      : supabase
          .from('lead_field_definitions')
          .select('id, key, type')
          .eq('active', true)
          .is('pipeline_id', null),
    leadId
      ? supabase
          .from('lead_field_values')
          .select('field_definition_id, value_text, value_number, value_boolean, value_date')
          .eq('lead_id', leadId)
      : Promise.resolve({ data: [] as Array<{ field_definition_id: string; value_text: string | null; value_number: number | null; value_boolean: boolean | null; value_date: string | null }>, error: null }),
  ]);

  if (fieldDefsResult.data && fieldDefsResult.data.length > 0) {
    const valuesMap = new Map<string, { value_text: string | null; value_number: number | null; value_boolean: boolean | null; value_date: string | null }>(
      (fieldValsResult.data ?? []).map((v) => [v.field_definition_id, v]),
    );
    for (const def of fieldDefsResult.data as Array<{ id: string; key: string; type: string }>) {
      const val = valuesMap.get(def.id);
      let strVal = '';
      if (val) {
        switch (def.type) {
          case 'number': strVal = val.value_number != null ? String(val.value_number) : ''; break;
          case 'boolean': strVal = val.value_boolean != null ? String(val.value_boolean) : ''; break;
          case 'date': strVal = val.value_date ?? ''; break;
          default: strVal = val.value_text ?? '';
        }
      }
      (ctx as Record<string, string>)['lead.' + def.key] = strVal;
    }
  }

  // RETORNO-02: retorno agendado pendente deste lead (alimenta o bloco de prompt de cancelamento).
  ctx.retorno_pendente = '';
  if (leadId) {
    // ai_scheduled_callbacks é da RETORNO-01 e não está em types.ts → cast de fronteira.
    const { data: pendingCb, error: pendingErr } = await (supabase as any)
      .from('ai_scheduled_callbacks')
      .select('id, scheduled_for, reason, mode')
      .eq('lead_id', leadId)
      .eq('status', 'pending')
      .order('scheduled_for')
      .limit(1)
      .maybeSingle();
    if (pendingErr) {
      callbackLog.error('pending_callback_load_failed', { lead_id: leadId, error: pendingErr.message });
    } else if (pendingCb) {
      const when = new Date(pendingCb.scheduled_for as string);
      ctx.retorno_pendente = isNaN(when.getTime())
        ? ''
        : `${formatBrtHuman(when)} (BRT) — motivo: ${pendingCb.reason ?? ''}`;
    }
  }

  return { context: ctx as ContextData, leadId, companyId: null, aiEnabled };
}

// ── Agent Loader ──────────────────────────────────────────────────────────────

const AGENT_SELECT = 'id, identity, general_rules, input_data, use_stages, llm_provider, llm_model, llm_temperature, llm_max_tokens, llm_provider_id, memory_window, wa_phone_number_id, buffer_ms, pipeline_id, pipeline_ids, channel_types, stage_ids, score_matrix_ids, score_allow_empty, humanizacao, voice_enabled, voice_response_mode, voice_id, voice_stability, voice_similarity, voice_speed, voice_model_id, origem_lista_filters';

async function loadAgent(
  supabase: ReturnType<typeof createClient>,
  leadPipelineId: string | null,
  leadStageId: string | null = null,
  inboundChannel: string | null = null,
): Promise<AgentConfig | null> {
  // IMPORTANT: Supabase JS v2 query builders are mutable — each filter call mutates the object.
  // We MUST create a fresh builder for every priority query, never reuse a shared base.
  const q = () => supabase
    .from('ai_agents')
    .select(AGENT_SELECT)
    .eq('active', true)
    .eq('is_template', false) as any;

  // P1: Canal + Pipeline + Stage (most specific)
  if (inboundChannel && leadPipelineId && leadStageId) {
    const { data } = await q()
      .eq('pipeline_id', leadPipelineId)
      .contains('channel_types', [inboundChannel])
      .contains('stage_ids', [leadStageId])
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P2: Canal + Pipeline (sem stage)
  if (inboundChannel && leadPipelineId) {
    const { data } = await q()
      .eq('pipeline_id', leadPipelineId)
      .contains('channel_types', [inboundChannel])
      .eq('stage_ids', '{}')
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P3: Pipeline + Stage (qualquer canal — only agents with NO channel constraint)
  if (leadPipelineId && leadStageId) {
    const { data } = await q()
      .eq('pipeline_id', leadPipelineId)
      .contains('stage_ids', [leadStageId])
      .eq('channel_types', '{}')
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P4: Pipeline apenas (catch-all — only agents with NO channel AND NO stage constraints)
  if (leadPipelineId) {
    const { data } = await q()
      .eq('pipeline_id', leadPipelineId)
      .eq('channel_types', '{}')
      .eq('stage_ids', '{}')
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P5-P8: Same priorities but via pipeline_ids[] array (multi-pipeline agents)
  // P5: Canal + pipeline_ids[] + Stage
  if (inboundChannel && leadPipelineId && leadStageId) {
    const { data } = await q()
      .contains('pipeline_ids', [leadPipelineId])
      .contains('channel_types', [inboundChannel])
      .contains('stage_ids', [leadStageId])
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P6: Canal + pipeline_ids[] (sem stage)
  if (inboundChannel && leadPipelineId) {
    const { data } = await q()
      .contains('pipeline_ids', [leadPipelineId])
      .contains('channel_types', [inboundChannel])
      .eq('stage_ids', '{}')
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P7: pipeline_ids[] + Stage (qualquer canal — only agents with NO channel constraint)
  if (leadPipelineId && leadStageId) {
    const { data } = await q()
      .contains('pipeline_ids', [leadPipelineId])
      .contains('stage_ids', [leadStageId])
      .eq('channel_types', '{}')
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // P8: pipeline_ids[] apenas (catch-all — only agents with NO channel AND NO stage constraints)
  if (leadPipelineId) {
    const { data } = await q()
      .contains('pipeline_ids', [leadPipelineId])
      .eq('channel_types', '{}')
      .eq('stage_ids', '{}')
      .limit(1)
      .maybeSingle();
    return data as AgentConfig | null;
  }

  return null;
}

// Stage-entry proactive lookup: find any agent targeting this stage, regardless of channel.
// Used when a lead enters a stage and the agent should proactively send the first message.
async function loadAgentForStageEntry(
  supabase: ReturnType<typeof createClient>,
  leadPipelineId: string | null,
  leadStageId: string | null,
): Promise<AgentConfig | null> {
  if (!leadStageId) return null;
  const q = () => supabase
    .from('ai_agents')
    .select(AGENT_SELECT)
    .eq('active', true)
    .eq('is_template', false) as any;

  // scalar pipeline_id + stage
  if (leadPipelineId) {
    const { data } = await q()
      .eq('pipeline_id', leadPipelineId)
      .contains('stage_ids', [leadStageId])
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // pipeline_ids[] + stage
  if (leadPipelineId) {
    const { data } = await q()
      .contains('pipeline_ids', [leadPipelineId])
      .contains('stage_ids', [leadStageId])
      .limit(1)
      .maybeSingle();
    if (data) return data as AgentConfig;
  }

  // stage only (pipeline-agnostic agent)
  const { data } = await q()
    .contains('stage_ids', [leadStageId])
    .limit(1)
    .maybeSingle();
  return data as AgentConfig | null;
}

async function loadAgentById(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
): Promise<AgentConfig | null> {
  // No active filter — test mode works on both active and inactive agents
  const { data } = await supabase
    .from('ai_agents')
    .select('id, identity, general_rules, input_data, use_stages, llm_provider, llm_model, llm_temperature, llm_max_tokens, llm_provider_id, memory_window, wa_phone_number_id, buffer_ms, pipeline_id, humanizacao, voice_enabled, voice_response_mode, voice_id, voice_stability, voice_similarity, voice_speed, voice_model_id')
    .eq('id', agentId)
    .limit(1)
    .single();
  return data as AgentConfig | null;
}

async function loadStep(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  control: string,
): Promise<AgentStep | null> {
  const { data } = await supabase
    .from('ai_agents_steps')
    .select('id, name, prompt, control, order_index')
    .eq('ai_agent_id', agentId)
    .eq('control', control)
    .eq('active', true)
    .limit(1)
    .single();
  return data as AgentStep | null;
}

async function getApiKey(
  supabase: ReturnType<typeof createClient>,
  agent: AgentConfig,
): Promise<string> {
  // Prefer explicit provider record
  if (agent.llm_provider_id) {
    const { data } = await supabase
      .from('settings_ai_providers')
      .select('api_key')
      .eq('id', agent.llm_provider_id)
      .single();
    if (data?.api_key) return data.api_key;
  }

  // Fall back to default for this provider
  const { data } = await supabase
    .from('settings_ai_providers')
    .select('api_key')
    .eq('provider', agent.llm_provider)
    .eq('is_default', true)
    .eq('active', true)
    .single();

  if (!data?.api_key) throw new Error(`No API key configured for provider: ${agent.llm_provider}`);
  return data.api_key;
}

// ── Prompt Renderer ───────────────────────────────────────────────────────────

function renderTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => ctx[key] ?? '');
}

function buildSystemPrompt(
  agent: AgentConfig,
  ctx: ContextData,
  step: AgentStep | null,
  hasInteractiveReply = false,
  callbackConfig: CallbackConfig | null = null,
): string {
  const parts: string[] = [];

  // ── Safety guardrail: personal contact & loop detection (PRIORITY OVER ALL) ──
  parts.push(
    '## REGRAS DE SEGURANÇA — PRIORIDADE MÁXIMA (INEGOCIÁVEL)\n\n' +
    'Estas regras SEMPRE vencem qualquer instrução comercial, fluxo de diagnóstico, etapa ou CTA.\n\n' +
    '### DISTINÇÃO CRÍTICA: AGENDAMENTO COMERCIAL vs TRANSFERÊNCIA PARA HUMANO\n' +
    'IMPORTANTE — são situações COMPLETAMENTE DIFERENTES:\n' +
    '- Lead quer REUNIÃO/CALL/CONVERSA sobre o produto/serviço → é AGENDAMENTO COMERCIAL → use `enviar_link_agendamento`, NUNCA `bloquear_ia`\n' +
    '- Lead quer falar com o HUMANO REAL porque rejeitou a IA → é TRANSFERÊNCIA → use `bloquear_ia`\n\n' +
    'Exemplos de AGENDAMENTO (use enviar_link_agendamento):\n' +
    '"bora marcar uma call", "quero agendar", "me manda o link", "quero saber mais numa reunião",\n' +
    '"pode ser amanhã?", "quero ver uma demo", "vamos agendar com o consultor", "pode me mandar o link de agendamento"\n\n' +
    'NÃO são AGENDAMENTO: "sim", "vamos lá", "ok", "pode ser", "tenho interesse", "claro", afirmativas genéricas de início de conversa.\n' +
    'Quando há um roteiro de qualificação no step, siga-o antes de enviar o link.\n\n' +
    'Exemplos de TRANSFERÊNCIA (use bloquear_ia):\n' +
    '"quero falar com o João de verdade", "me passa pro João", "para com essa IA", "você é um robô",\n' +
    '"não quero falar com IA", "cadê o João real"\n\n' +
    'NA DÚVIDA: se o lead pediu EXPLICITAMENTE uma reunião/call/link, é AGENDAMENTO. Afirmativas genéricas ("sim", "vamos lá", "ok") ou interesse implícito não são pedidos de agendamento. Siga o roteiro do step.\n\n' +
    'Ao chamar `enviar_link_agendamento`, chame TAMBÉM `salvar_qualificacao(p_field_key="conversation_summary", p_value="[resumo da conversa até agora]")` no mesmo turno para registrar o contexto do lead antes do handoff.\n\n' +
    '### 1. PEDIDO DE FALAR COM O HUMANO REAL (rejeição explícita da IA)\n' +
    'SOMENTE quando a pessoa explicitamente rejeita a IA ou pede o humano pelo nome:\n' +
    '- Exemplos: "me passa pro João", "cadê o João de verdade", "para com essa IA", "não quero falar com robô"\n' +
    '- Parar IMEDIATAMENTE qualquer fluxo comercial\n' +
    '- Responder: "Tranquilo! Vou pedir pro time te chamar."\n' +
    '- Chamar `bloquear_ia` com reason "Pediu para falar com humano real"\n' +
    '- NUNCA diga "vou desligar a IA" — o lead não precisa saber que é IA\n\n' +
    '### 2. CONTATO PESSOAL / NÃO-COMERCIAL\n' +
    'Se a conversa for claramente pessoal (amigo, familiar, conhecido perguntando algo pessoal):\n' +
    '- Responder de forma breve: "Oi! Vou pedir pro time te retornar 😊"\n' +
    '- Chamar `bloquear_ia` com reason "Contato pessoal, não comercial"\n\n' +
    '' +
    '### 4. DETECÇÃO DE LOOP COM BOT/AUTOMAÇÃO\n' +
    'Se detectar troca circular com outro bot ou mensagens repetitivas sem intenção humana:\n' +
    '- Encerrar: "Parece que estamos em loop. Vou pausar aqui e o time retoma se necessário."\n' +
    '- Chamar `bloquear_ia` com reason "Loop detectado com automação/bot"\n\n' +
    '### 5. ERROS INTERNOS DE FERRAMENTAS — NUNCA EXPOR AO CLIENTE\n' +
    'Se uma tool retornar erro (ex: "Error: invalid field", "Error: no active lead", qualquer mensagem de erro técnico):\n' +
    '- NUNCA mencione o erro ao cliente. Nunca diga que "houve um problema", "não consegui salvar", "tive dificuldades", etc.\n' +
    '- Continue a conversa normalmente como se a tool tivesse sido dispensável naquele momento.\n' +
    '- Erros de ferramentas são problemas internos do sistema — o cliente não deve saber nem ser impactado por eles.'
  );

  // RETORNO-02 fix (2026-07-22): a instrução detalhada de como calcular o horário
  // fica lá embaixo (perto do fim do prompt), mas SEM uma prioridade explícita ela
  // perdia pro roteiro rígido do step (ex: script fixo do Passo 1) sempre que o
  // pedido de retorno vinha na mesma mensagem que ativava esse roteiro — o agente
  // simplesmente seguia o script e ignorava o pedido. Injetado aqui, logo depois das
  // regras de segurança (topo do prompt = prioridade alta), só um pointer curto.
  if (callbackConfig?.enabled) {
    parts.push(
      '## AGENDAMENTO DE RETORNO — PRIORIDADE ALTA\n' +
      'Se a mensagem ATUAL do lead pedir explicitamente para ser chamado/contatado depois ' +
      '(ex: "me chama em 15 minutos", "me chama amanhã", "me liga semana que vem", "me chama daqui a pouco"), ' +
      'isso tem prioridade sobre o roteiro do step abaixo — inclusive se for a primeira mensagem da conversa ' +
      'ou o meio de um fluxo scriptado. Chame `agendar_retorno` neste turno em vez de seguir o roteiro normal. ' +
      'Detalhes de como calcular o horário estão na seção "RETORNO AGENDADO (CALLBACK)" mais abaixo.'
    );
  }

  if (agent.identity) parts.push(renderTemplate(agent.identity.trim(), ctx as unknown as Record<string, string>));
  if (agent.general_rules) parts.push(renderTemplate(agent.general_rules.trim(), ctx as unknown as Record<string, string>));
  if (agent.input_data) parts.push(renderTemplate(agent.input_data, ctx as unknown as Record<string, string>));
  if (step?.prompt) parts.push(renderTemplate(step.prompt.trim(), ctx as unknown as Record<string, string>));

  // ── Interactive reply override — injected LAST so it wins over step prompt ──
  if (hasInteractiveReply) {
    const hasEmail = Boolean(ctx.email);
    // Extract ISO slots from summary if agent saved them there
    const summaryIso = (() => {
      const m = String(ctx.resumo_conversa ?? '').match(/HORARIOS_ISO:\s*(\[[\s\S]*?\])/);
      if (!m) return null;
      try { return JSON.parse(m[1]) as Array<{ start: string; end: string }>; } catch { return null; }
    })();
    const isoHint = summaryIso && summaryIso.length > 0
      ? `\nISO dos horários enviados (extraído do summary): ${JSON.stringify(summaryIso)}. Use o slot correspondente ao botão clicado para start_time e end_time.`
      : '\nUse o histórico da conversa + {{hoje}} para montar start_time ISO (ex: "amanhã dia 04 às 12:00" → "2026-05-04T12:00:00").';
    parts.push(
      '## ⚠️ OVERRIDE ABSOLUTO — RESPOSTA DE BOTÃO INTERATIVO\n' +
      'A mensagem atual começa com [SELEÇÃO DE BOTÃO]. O lead acabou de clicar num botão e selecionou o horário.\n' +
      'IGNORE qualquer instrução de passo anterior. Execute APENAS:\n' +
      '1. Confirme o horário escolhido em UMA frase: "Ótimo! Reservei [horário] pra você."' + isoHint + '\n' +
      (hasEmail
        ? '2. Email já disponível: ' + ctx.email + '. Chame ESTAS 3 TOOLS AGORA NA ORDEM:\n' +
          '   a) criar_agendamento(title="Conversa com Erika — ' + (ctx.nome ?? '{{nome}}') + '", start_time=[ISO slot clicado], end_time=[start+60min], user_id="' + (ctx.lead_responsavel_id ?? '{{lead_responsavel_id}}') + '")\n' +
          '   b) atualizar_etapa(leads_stages_id="59cc4888-0a23-41e4-a180-2dd349beb30e")\n' +
          '   c) bloquear_ia(reason="Reunião agendada — handoff humano")\n' +
          '3. Após as tools: "Perfeito! Sua conversa com a Erika está confirmada. Te envio o link no dia combinado 🎉"\n' +
          '4. NÃO peça email. NÃO chame consultar_disponibilidade nem enviar_opcoes_horario.'
        : '2. Email ausente. Pergunte: "Você trabalha com Invite? Qual seu email?"\n' +
          '3. NÃO chame criar_agendamento ainda — aguarde o email na próxima mensagem.\n' +
          '4. NÃO chame consultar_disponibilidade nem enviar_opcoes_horario.')
    );
  }

  // ── RETORNO-02 — Bloco de agendamento de retorno (só quando as tools estão expostas) ──
  if (callbackConfig?.enabled) {
    const tplList = (callbackConfig.templates ?? [])
      .map(t => `- id "${t.id}"${t.label ? `: ${t.label}` : ''}`)
      .join('\n');
    parts.push(
      '## RETORNO AGENDADO (CALLBACK)\n' +
      'Você pode agendar um retorno quando o lead pedir explicitamente para ser chamado depois.\n\n' +
      '### Como resolver o horário\n' +
      'Agora é: ' + (ctx.agora ?? '') + ' (fuso America/Sao_Paulo, offset -03:00).\n' +
      'O parâmetro `scheduled_for` deve ir SEMPRE resolvido em ISO-8601 com offset — o sistema não interpreta linguagem natural.\n' +
      'Exemplos:\n' +
      '- "me chama em 15 minutos" → some 15 minutos a ' + (ctx.agora ?? '{{agora}}') + ' e envie o ISO resultante.\n' +
      '- "me chama semana que vem" → use o calendário em {{hoje}} para achar a data (+7 dias) e combine um horário comercial (ex: 10:00), enviando "AAAA-MM-DDT10:00:00-03:00".\n' +
      'Se o lead não disser a hora, pergunte antes — NUNCA invente um horário.\n' +
      'Limites: no mínimo ' + callbackConfig.min_delay_minutes + ' minutos e no máximo ' + callbackConfig.max_delay_hours + ' horas a partir de agora. ' +
      'Ao calcular o mínimo, arredonde SEMPRE pra cima (ex: se pediram o mínimo de ' + callbackConfig.min_delay_minutes + ' min, agende pra ' + (callbackConfig.min_delay_minutes + 1) + ' min) — nunca corte em cima da hora exata.\n' +
      (tplList ? '\n### Templates disponíveis (parâmetro template_id)\n' + tplList + '\n' : '') +
      (callbackConfig.allow_free_text ? '\nVocê pode redigir a mensagem do retorno em `mensagem` (texto livre permitido).\n' : '\nTexto livre NÃO é permitido — use apenas `template_id`.\n') +
      '\nExiste no máximo UM retorno pendente por lead: chamar `agendar_retorno` de novo apenas reagenda o existente.\n\n' +
      '### Se a tool retornar erro\n' +
      'A regra geral de "nunca exponha erro de tool ao cliente" NÃO significa fingir que o retorno foi agendado. ' +
      'Se `agendar_retorno` retornar `Error: ...`, NÃO diga ao lead que vai te chamar — corrija o horário (some mais alguns minutos ao que você tentou) e chame a tool de novo, silenciosamente, antes de responder. ' +
      'Só confirme o retorno ao lead DEPOIS que a tool retornar sucesso (a mensagem de resultado NÃO começa com "Error:").'
    );
  }

  // ── RETORNO-02 — Retorno pendente: regra de cancelamento por retomada (ADR §D4) ──
  if (callbackConfig?.enabled && ctx.retorno_pendente) {
    if (callbackConfig.cancel_on_resume) {
      parts.push(
        '## ⚠️ RETORNO PENDENTE — REGRA DE CANCELAMENTO\n' +
        'Existe um retorno agendado para ' + ctx.retorno_pendente + '.\n' +
        'Se a mensagem atual do lead RETOMA a conversa — pergunta, objeção, resposta com conteúdo, mudança de assunto, pedido de reagendamento — chame `cancelar_retorno` ANTES de responder.\n' +
        'Se for apenas confirmação genérica sem conteúdo ("ok", "beleza", "tá bom", "👍", emoji solto), NÃO cancele.\n' +
        'Se o lead pedir outro horário, chame `agendar_retorno` de novo (substitui o pendente) — não é preciso cancelar antes.'
      );
    } else {
      parts.push(
        '## RETORNO PENDENTE\n' +
        'Existe um retorno agendado para ' + ctx.retorno_pendente + '.\n' +
        'Ele NÃO deve ser cancelado automaticamente quando o lead retoma a conversa — só chame `cancelar_retorno` se o próprio lead pedir para cancelar/desmarcar o retorno.\n' +
        'Se o lead pedir outro horário, chame `agendar_retorno` de novo (substitui o pendente).'
      );
    }
  }

  // ── Identity Collection — proactive cross-channel enrichment ──
  if (ctx.identity_collection_opted_out !== 'true') {
    const missingFields: string[] = [];
    if (!ctx.whatsapp) missingFields.push('whatsapp');
    if (!ctx.email) missingFields.push('email');

    if (missingFields.length > 0) {
      let identityRules = '## REGRAS DE COLETA DE IDENTIDADE\n\n' +
        'O contato ainda não tem os seguintes campos de identidade: ' + missingFields.join(', ') + '.\n' +
        'Siga as regras abaixo para coletar proativamente:\n\n';

      if (!ctx.whatsapp) {
        identityRules +=
          '### Instagram → WhatsApp\n' +
          'Se o canal desta conversa é Instagram, pergunte pelo WhatsApp na primeira oportunidade natural.\n' +
          'Exemplo: "Para te atendermos melhor, qual é o seu WhatsApp? (Opcional, responda \'não\' para pular)"\n' +
          'Se o contato responder com um número de telefone, use `collect_identity` com field="whatsapp".\n\n';
      }
      if (!ctx.email) {
        identityRules +=
          '### Coleta de Email\n' +
          'Se o contato mencionar um email em qualquer momento da conversa, use `collect_identity` com field="email" para salvar.\n\n';
      }

      identityRules +=
        '### Opt-Out\n' +
        'SOMENTE se o contato usar frases explícitas de opt-out como: "me tira da lista", "sair da lista", "me tira aí", ' +
        '"não quero mais isso", "para de me encher", "não tenho interesse em nada", "chega de mensagem", "me remove daí", ' +
        '"cancelar inscrição", "descadastrar", "remover meu número", "para de me mandar mensagem", "não me mande mais nada", ' +
        '"me deixa em paz", "stop", "unsubscribe", "opt out", "sair", "SAIR":\n' +
        '- Use a ferramenta `collect_identity_optout` para registrar o opt-out.\n' +
        '- NUNCA insista. Aceite e continue a conversa normalmente.\n' +
        '- Nunca mais pergunte por campos de identidade para este contato.\n' +
        'Um simples "não" ou "nao" NÃO é opt-out — continue a conversa normalmente.';

      parts.push(identityRules);
    }
  }

  // Inject formatting instruction based on humanizacao setting
  const humanizacao = agent.humanizacao ?? 'media';
  if (humanizacao === 'alta') {
    parts.push(
      '## FORMATAÇÃO DE RESPOSTA (OBRIGATÓRIO)\n' +
      'Escreva cada frase ou ideia em uma linha separada usando quebra de linha simples (\\n).\n' +
      'NUNCA coloque mais de uma frase na mesma linha.\n' +
      'Cada linha vira uma mensagem separada no WhatsApp — isso cria naturalidade.\n\n' +
      'Exemplo correto:\n' +
      'Com 1 pessoa pra 60 peças por mês, vocês tão deixando escala na mesa.\n' +
      'Um sistema com IA faz isso automaticamente.\n' +
      'Quer marcar uma conversa com a equipe?'
    );
  } else if (humanizacao === 'media') {
    parts.push(
      '## FORMATAÇÃO DE RESPOSTA (OBRIGATÓRIO)\n' +
      'Separe ideias diferentes com uma linha em branco (parágrafo duplo).\n' +
      'Cada bloco separado por linha em branco será enviado como mensagem separada no WhatsApp.\n' +
      'Máximo 2 parágrafos por resposta.'
    );
  }
  // 'nenhuma' → no formatting instruction, LLM decides freely

  return parts.join('\n\n---\n\n');
}

// ── Memory Builder ────────────────────────────────────────────────────────────

async function buildMemory(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  memoryWindow: number,
  channel: string = 'whatsapp',
): Promise<LLMMessage[]> {
  const { data: msgs } = await supabase
    .from('messages')
    .select('id, content, from_contact, created_at')
    .eq('people_id', peopleId)
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(memoryWindow);

  if (!msgs || msgs.length === 0) return [];

  return msgs
    .reverse()
    .map(m => ({
      role: m.from_contact === 'cliente' ? 'user' : 'assistant',
      content: m.content ?? '',
    })) as LLMMessage[];
}

// ── Buffer Reader ─────────────────────────────────────────────────────────────

async function getBufferMessages(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
): Promise<{ bufferIds: string[]; combinedText: string; waPhoneNumberId: string | null; channelType: string | null; hasInboundAudio: boolean; hasInteractiveReply: boolean }> {
  // FIX-AGENT-DUP-03 — read-only SELECT (reverts the DUP-02 atomic claim).
  // The DUP-02 UPDATE...RETURNING marked processed=true BEFORE the LLM ran, so any
  // failure after the claim (loadContext throw, LLM timeout, network error) discarded
  // the message with no retry path. The buffer is now only marked processed=true at
  // step 13, after the reply is persisted. Concurrent double-execution is prevented
  // upstream by the CAS lock on clients_people.ai_processing_lock (see caller).
  const { data: buffers } = await supabase
    .from('message_buffer')
    .select('id, messages, wa_phone_number_id, channel_type')
    .eq('people_id', peopleId)
    .eq('processed', false)
    .order('created_at');

  if (!buffers || buffers.length === 0) {
    return { bufferIds: [], combinedText: '', waPhoneNumberId: null, channelType: null, hasInboundAudio: false, hasInteractiveReply: false };
  }

  const bufferIds = buffers.map(b => b.id);
  const allMessages: string[] = [];

  for (const buf of buffers) {
    const msgs = (buf.messages as Array<{ content?: string; text?: string; message_type?: string }>) ?? [];
    for (const m of msgs) {
      const text = m.content || m.text;
      if (text) allMessages.push(text);
    }
  }

  // Determine inbound audio from the LAST message in the LAST buffer only
  // (the most recent customer message that triggered this processing)
  const lastBuf = buffers[buffers.length - 1];
  const lastBufMsgs = (lastBuf.messages as Array<{ content?: string; text?: string; message_type?: string }>) ?? [];
  const lastMsg = lastBufMsgs.length > 0 ? lastBufMsgs[lastBufMsgs.length - 1] : null;
  const lastMessageType = lastMsg?.message_type;

  // Use the first buffer entry's channel
  const firstBuf = buffers[0] as { wa_phone_number_id?: string | null; channel_type?: string | null };
  const waPhoneNumberId = firstBuf.wa_phone_number_id ?? null;
  // Prefer explicit channel_type; fallback to wa_phone_number_id heuristic for legacy entries
  const channelType = firstBuf.channel_type ?? (waPhoneNumberId ? 'whatsapp' : null);

  return {
    bufferIds,
    combinedText: allMessages.join('\n'),
    waPhoneNumberId,
    channelType,
    hasInboundAudio: lastMessageType === 'audio',
    hasInteractiveReply: lastMessageType === 'interactive' || lastMessageType === 'button',
  };
}

// ── LLM Callers ───────────────────────────────────────────────────────────────

interface LLMResponse {
  text: string | null;
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  finishReason: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface ToolCallDetail {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  messages: LLMMessage[],
  tools: ToolDefinition[],
  toolChoice: 'auto' | 'required' = 'auto',
): Promise<LLMResponse> {
  // GPT-5.x+ models require max_completion_tokens instead of max_tokens
  const useNewTokenParam = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
  const body: Record<string, unknown> = {
    model,
    temperature,
    messages,
    tools: toOpenAITools(tools),
    tool_choice: toolChoice,
    ...(useNewTokenParam ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
  };

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), LLM_TIMEOUT_MS);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abort.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;

  return {
    text: msg?.content ?? null,
    toolCalls: (msg?.tool_calls ?? []).map((tc: OpenAIToolCall) => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments || '{}'),
    })),
    finishReason: choice?.finish_reason ?? 'stop',
    usage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens ?? 0,
      completion_tokens: data.usage.completion_tokens ?? 0,
      total_tokens: data.usage.total_tokens ?? 0,
    } : undefined,
  };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  system: string,
  messages: AnthropicMessage[],
  tools: ToolDefinition[],
  forceToolUse = false,
): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    temperature,
    max_tokens: maxTokens,
    system,
    messages,
    tools: toAnthropicTools(tools),
    ...(forceToolUse ? { tool_choice: { type: 'any' } } : {}),
  };

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), LLM_TIMEOUT_MS);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: abort.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  let text: string | null = null;
  const toolCalls: LLMResponse['toolCalls'] = [];

  for (const block of data.content ?? []) {
    if (block.type === 'text') text = (text ?? '') + block.text;
    if (block.type === 'tool_use') {
      toolCalls.push({ id: block.id, name: block.name, args: block.input ?? {} });
    }
  }

  return {
    text,
    toolCalls,
    finishReason: data.stop_reason ?? 'end_turn',
    usage: data.usage ? {
      prompt_tokens: data.usage.input_tokens ?? 0,
      completion_tokens: data.usage.output_tokens ?? 0,
      total_tokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
    } : undefined,
  };
}

function getLLMEndpoint(provider: string): string {
  if (provider === 'anthropic') return ''; // handled separately
  if (provider === 'groq') return 'https://api.groq.com/openai/v1/chat/completions';
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  return 'https://api.openai.com/v1/chat/completions'; // openai default
}

// ── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
  ctx: ContextData,
  leadId: string | null,
): Promise<string> {
  try {
    switch (name) {
      case 'atualizar_etapa': {
        if (!leadId) return 'Error: no active lead';
        if (args.leads_stages_id === '59cc4888-0a23-41e4-a180-2dd349beb30e' && !ctx.__agendamento_criado) return 'Error: cannot move lead to booked stage without a successful criar_agendamento in the same turn. Create the booking first.';
        // Resolve pipeline from target stage — supports cross-pipeline moves (e.g. curso → mentoria upsell)
        const { data: stageRow } = await supabase
          .from('leads_stages')
          .select('leads_pipelines_id')
          .eq('id', args.leads_stages_id)
          .maybeSingle();
        const updates: Record<string, unknown> = { leads_stages_id: args.leads_stages_id };
        if (stageRow?.leads_pipelines_id) updates.leads_pipelines_id = stageRow.leads_pipelines_id;
        if (args.control) updates.control = args.control;
        const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
        if (error) return `Error: ${error.message}`;
        // Update local context
        if (args.control) ctx.lead_control = String(args.control);
        return `Stage updated to ${args.leads_stages_id}${stageRow?.leads_pipelines_id ? ` (pipeline: ${stageRow.leads_pipelines_id})` : ''}${args.control ? `, control=${args.control}` : ''}`;
      }

      case 'atualizar_control': {
        if (!leadId) return 'Error: no active lead';
        const { error } = await supabase.from('leads').update({ control: args.control }).eq('id', leadId);
        if (error) return `Error: ${error.message}`;
        ctx.lead_control = String(args.control);
        return `Control updated to "${args.control}"`;
      }

      case 'atualizar_lead': {
        if (!leadId) return 'Error: no active lead';
        const fields = args.fields as Record<string, unknown>;
        if (!fields || Object.keys(fields).length === 0) return 'Error: no fields provided';
        const STATIC_LEAD_FIELDS = ['title', 'value', 'status', 'loss_reason', 'user_id', 'description', 'pre_sale_temperature', 'close_probability'];
        const customDefs = await getLeadFieldDefs(supabase, ctx['lead_pipeline_id'] || null);
        const customDefsMap = new Map(customDefs.map(d => [d.key, d]));
        const staticDbFields: Record<string, unknown> = {};
        for (const key of STATIC_LEAD_FIELDS) {
          if (fields[key] != null) staticDbFields[key] = fields[key];
        }
        if (Object.keys(staticDbFields).length > 0) {
          const { error } = await supabase.from('leads').update(staticDbFields).eq('id', leadId);
          if (error) return `Error: ${error.message}`;
        }
        const updatedKeys: string[] = [...Object.keys(staticDbFields)];
        for (const [key, val] of Object.entries(fields)) {
          if (val == null || STATIC_LEAD_FIELDS.includes(key)) continue;
          const def = customDefsMap.get(key);
          if (!def) continue;
          const err = await upsertCustomFieldValue(supabase, leadId, def, val, ctx.pessoa_id);
          if (err) return err;
          updatedKeys.push(key);
        }
        if (updatedKeys.length === 0) return 'Error: no valid fields provided';
        if (staticDbFields.pre_sale_temperature != null) ctx.lead_temperatura = String(staticDbFields.pre_sale_temperature);
        if (staticDbFields.close_probability != null) ctx.lead_prob_fechamento = String(staticDbFields.close_probability);
        return `Lead updated: ${updatedKeys.join(', ')}`;
      }

      case 'atualizar_pessoa': {
        const fields = args.fields as Record<string, unknown>;
        if (!fields || Object.keys(fields).length === 0) return 'Error: no fields provided';
        const STATIC_PESSOA_FIELDS = ['name', 'email', 'whatsapp', 'notes', 'telefone'];
        const customDefs = await getLeadFieldDefs(supabase, ctx['lead_pipeline_id'] || null);
        const customDefsMap = new Map(customDefs.map(d => [d.key, d]));
        const staticDbFields: Record<string, unknown> = {};
        for (const key of STATIC_PESSOA_FIELDS) {
          if (fields[key] != null) staticDbFields[key] = fields[key];
        }
        if (Object.keys(staticDbFields).length > 0) {
          const { error } = await supabase.from('clients_people').update(staticDbFields).eq('id', ctx.pessoa_id);
          if (error) return `Error: ${error.message}`;
        }
        const updatedKeys: string[] = [...Object.keys(staticDbFields)];
        if (leadId) {
          for (const [key, val] of Object.entries(fields)) {
            if (val == null || STATIC_PESSOA_FIELDS.includes(key)) continue;
            const def = customDefsMap.get(key);
            if (!def) continue;
            const err = await upsertCustomFieldValue(supabase, leadId, def, val, ctx.pessoa_id);
            if (err) return err;
            updatedKeys.push(key);
          }
        }
        if (updatedKeys.length === 0) return 'Error: no valid fields provided';
        return `Person updated: ${updatedKeys.join(', ')}`;
      }

      case 'atualizar_empresa': {
        if (!args.company_id) return 'Error: company_id required';
        const fields = args.fields as Record<string, unknown>;
        if (!fields || Object.keys(fields).length === 0) return 'Error: no fields provided';
        const STATIC_EMPRESA_FIELDS = ['trade_name', 'legal_name', 'tax_id', 'email', 'phone', 'website', 'address'];
        const customDefs = await getLeadFieldDefs(supabase, ctx['lead_pipeline_id'] || null);
        const customDefsMap = new Map(customDefs.map(d => [d.key, d]));
        const staticDbFields: Record<string, unknown> = {};
        for (const key of STATIC_EMPRESA_FIELDS) {
          if (fields[key] != null) staticDbFields[key] = fields[key];
        }
        if (Object.keys(staticDbFields).length > 0) {
          const { error } = await supabase.from('clients_companies').update(staticDbFields).eq('id', args.company_id);
          if (error) return `Error: ${error.message}`;
        }
        const updatedKeys: string[] = [...Object.keys(staticDbFields)];
        if (leadId) {
          for (const [key, val] of Object.entries(fields)) {
            if (val == null || STATIC_EMPRESA_FIELDS.includes(key)) continue;
            const def = customDefsMap.get(key);
            if (!def) continue;
            const err = await upsertCustomFieldValue(supabase, leadId, def, val, ctx.pessoa_id);
            if (err) return err;
            updatedKeys.push(key);
          }
        }
        if (updatedKeys.length === 0) return 'Error: no valid fields provided';
        return `Company updated: ${updatedKeys.join(', ')}`;
      }

      case 'salvar_qualificacao': {
        const ALLOWED_Q_COLS = new Set([
          'q1_main_bottleneck', 'q2_lead_volume_month', 'q3_team_size', 'q4_crm_maturity',
          'q5_crm_name', 'q6_trigger', 'q7_problem_impact', 'q8_engagement_level',
          'q9_decision_authority', 'q10_stakeholders', 'q11_budget_approved', 'q12_timeline',
          'q13_urgency_reason', 'q14_data_ready', 'q15_minimum_volume', 'q16_expected_roi',
          'q17_objections', 'q18_real_fit', 'q19_qualification_status', 'q20_rejection_reason',
          'q21_interest_level', 'q22_close_probability', 'q23_behavioral_tags',
          'q24_last_update_by_agent', 'q25_disc_profile',
          'conversation_summary', 'goal', 'moment',
        ]);
        const colName = String(args.p_field_key);
        const val = String(args.p_value ?? '').trim();

        if (ALLOWED_Q_COLS.has(colName)) {
          if (!val) return `Skipped: empty value for "${colName}" — nothing to save`;
          const { error } = await supabase
            .from('clients_people')
            .update({ [colName]: val })
            .eq('id', ctx.pessoa_id);
          if (error) return `Error: ${error.message}`;
          // Dual-write to lead_field_values so the UI sidebars (Omni + NegocioSingle) display the data.
          await supabase.rpc('upsert_crm_field_value', {
            p_person_id: ctx.pessoa_id,
            p_field_key: colName,
            p_value: val,
          });
          ctx[colName] = val;
          if (colName === 'conversation_summary') ctx.resumo_conversa = val;
          if (colName === 'goal') ctx.objetivo = val;
          if (colName === 'moment') ctx.momento = val;
          return `Field "${colName}" saved on person`;
        }

        // Check custom tenant fields from lead_field_definitions
        const customDefs = await getLeadFieldDefs(supabase, ctx['lead_pipeline_id'] || null);
        const customDef = customDefs.find(d => d.key === colName);
        if (customDef) {
          if (!val) return `Skipped: empty value for "${colName}" — nothing to save`;
          if (leadId) {
            const err = await upsertCustomFieldValue(supabase, leadId, customDef, val, ctx.pessoa_id);
            if (err) return err;
          } else {
            // No active lead — save as entity_type=pessoa so the value is not lost
            const colEntry = customDef.type === 'number' ? 'value_number'
              : customDef.type === 'boolean' ? 'value_boolean'
              : customDef.type === 'date' ? 'value_date'
              : 'value_text';
            await supabase.from('lead_field_values').upsert(
              { entity_type: 'pessoa', entity_id: ctx.pessoa_id, field_definition_id: customDef.id, [colEntry]: val },
              { onConflict: 'entity_type,entity_id,field_definition_id' },
            );
          }
          ctx['lead.' + colName] = val;
          return `Field "${colName}" saved (custom field)`;
        }

        console.warn(`[salvar_qualificacao] FIELD_REJECTED: "${colName}". Expected q1-q25, conversation_summary, goal, moment, or a custom tenant field.`);
        return `Error: invalid field "${colName}". Use column names like q1_main_bottleneck, conversation_summary, goal, moment, or a configured custom field. Full list in tool description.`;
      }

      case 'bloquear_ia': {
        const updates: Record<string, unknown> = { ai_enabled: false };
        if (args.reason) {
          // Append to existing notes instead of overwriting
          const { data: personRow } = await supabase
            .from('clients_people').select('notes').eq('id', ctx.pessoa_id).single();
          const existingNotes = (personRow as any)?.notes ?? '';
          updates.notes = existingNotes
            ? `${existingNotes}\n[AI_DESABILITADO] ${args.reason}`
            : `[AI_DESABILITADO] ${args.reason}`;
        }
        const { error } = await supabase.from('clients_people').update(updates).eq('id', ctx.pessoa_id);
        if (error) return `Error: ${error.message}`;
        supabase.from('omni_channel_alerts').insert({
          channel: ctx.instagram_handle ? 'instagram' : 'whatsapp',
          alert_type: 'handoff_humano',
          severity: 'info',
          title: 'Handoff para humano solicitado',
          details: {
            people_id: ctx.pessoa_id,
            lead_id: leadId ?? null,
            reason: args.reason ?? 'não especificado',
          },
        }).then(() => {}); // fire-and-forget
        return 'AI disabled for this person — human takeover';
      }

      case 'criar_agendamento': {
        if (!ctx.email) return 'Error: lead email is required before booking. Ask the lead for their email first ("Você trabalha com Invite? Qual seu email?") and wait for PRIORIDADE 0 to collect it.';
        // Slots from get_available_slots are BRT (UTC-3). If the LLM passes a naive
        // datetime (no TZ suffix), treat it as BRT and convert to UTC for storage.
        const toBrtUtc = (dt: string) => {
          if (!dt) return dt;
          if (/[Zz]$/.test(dt) || /[+-]\d{2}:\d{2}$/.test(dt)) return dt; // already has TZ
          return dt.replace('T', 'T').replace(/(\d{2}:\d{2}(:\d{2})?)$/, '$1-03:00');
        };
        const meeting: Record<string, unknown> = {
          title: args.title,
          start_time: toBrtUtc(args.start_time),
          end_time: toBrtUtc(args.end_time),
          status: 'agendado',
          people_id: ctx.pessoa_id,
          lead_id: leadId,
        };
        if (args.description) meeting.description = args.description;
        if (args.notes) meeting.notes = args.notes;
        if (args.user_id) meeting.user_id = args.user_id;
        else if (ctx.lead_responsavel_id) meeting.user_id = ctx.lead_responsavel_id;
        if (args.meeting_link) meeting.meeting_link = args.meeting_link;
        if (args.location) meeting.location = args.location;

        const { data, error } = await supabase.from('meetings').insert(meeting).select('id').single();
        if (error) return `Error: ${error.message}`;
        // Fire Google Calendar sync (fire-and-forget — don't block LLM response)
        if (data?.id) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          fetch(`${supabaseUrl}/functions/v1/google-cal-upsert-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ meeting_id: data.id, action: 'create' }),
          }).catch(err => console.warn('[criar_agendamento] google-cal-upsert-event error:', err));
        }
        // Refresh upcoming meetings in context so LLM sees the new meeting in the same loop
        const nowAfterCreate = new Date().toISOString();
        const { data: updatedMeetings } = await supabase
          .from('meetings').select('id, title, start_time, end_time, status, meeting_link')
          .eq('people_id', ctx.pessoa_id).gte('start_time', nowAfterCreate)
          .order('start_time').limit(3);
        ctx.reunioes_proximas = updatedMeetings && updatedMeetings.length > 0
          ? JSON.stringify(updatedMeetings.map(m => ({ titulo: m.title, data: m.start_time, status: m.status })))
          : '';
        ctx.__agendamento_criado = 'true';
        return `Meeting created: id=${data?.id}, start=${args.start_time}`;
      }

      case 'consultar_disponibilidade': {
        if (args.p_date) {
          const dow = new Date(`${args.p_date}T12:00:00`).getUTCDay();
          if (dow === 0 || dow === 6) return `Error: ${args.p_date} is a weekend (${dow === 6 ? 'Saturday' : 'Sunday'}). Choose a weekday (Monday–Friday) instead.`;
        }
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_user_id: args.p_user_id ?? ctx.lead_responsavel_id,
          p_date: args.p_date,
          p_period: args.p_period ?? null,
          p_slot_minutes: args.p_slot_minutes ?? 60,
        });
        if (error) return `Error: ${error.message}`;
        const slots = (data ?? []) as Array<{ slot_start: string; slot_end: string }>;
        ctx.slots_disponiveis = JSON.stringify(slots);
        return slots.length > 0
          ? `Available slots on ${args.p_date}: ${slots.map(s => s.slot_start).join(', ')}. Use one of these exact start times when booking. IMPORTANT: If the lead asked for a specific time and it appears in this list, ask for confirmation only ("Consigo encaixar você às [hora] na [dia]! Gostaria de confirmar?") — do not book yet. If no specific time was requested, suggest ONLY 2 of these times at random — never list all of them.`
          : `NO SLOTS AVAILABLE on ${args.p_date} for period "${args.p_period ?? 'any'}". Do NOT suggest any times for this date. Ask the lead to choose a different day or period.`;
      }

      case 'consultar_agenda': {
        const params = String(args.query_params ?? '');
        const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/meetings?people_id=eq.${ctx.pessoa_id}&${params}`;
        const res = await fetch(url, {
          headers: {
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
          },
        });
        if (!res.ok) return `Error: ${res.status}`;
        const meetings = await res.json();
        return `Meetings: ${JSON.stringify(meetings)}`;
      }

      case 'remarcar_agendamento': {
        if (!args.meeting_id) return 'Error: meeting_id required';
        const updates: Record<string, unknown> = {
          start_time: args.start_time,
          end_time: args.end_time,
          status: 'agendado',
        };
        if (args.notes) {
          // Append to existing notes instead of overwriting
          const { data: meetingRow } = await supabase
            .from('meetings').select('notes').eq('id', args.meeting_id).single();
          const existingNotes = (meetingRow as any)?.notes ?? '';
          updates.notes = existingNotes ? `${existingNotes}\n[REMARCADO] ${args.notes}` : `[REMARCADO] ${args.notes}`;
        }
        const { error } = await supabase.from('meetings').update(updates).eq('id', args.meeting_id);
        if (error) return `Error: ${error.message}`;
        // Refresh upcoming meetings in context
        const now = new Date().toISOString();
        const { data: meetings } = await supabase
          .from('meetings').select('id, title, start_time, end_time, status, meeting_link')
          .eq('people_id', ctx.pessoa_id).gte('start_time', now)
          .order('start_time').limit(3);
        ctx.reunioes_proximas = meetings && meetings.length > 0
          ? JSON.stringify(meetings.map(m => ({ id: m.id, titulo: m.title, data: m.start_time, fim: m.end_time, link: m.meeting_link ?? null, status: m.status })))
          : '';
        return `Meeting ${args.meeting_id} rescheduled to ${args.start_time}`;
      }

      case 'cancelar_agendamento': {
        if (!args.meeting_id) return 'Error: meeting_id required';
        const updates: Record<string, unknown> = { status: 'cancelado' };
        if (args.reason) {
          // Append to existing notes instead of overwriting
          const { data: meetingRow } = await supabase
            .from('meetings').select('notes').eq('id', args.meeting_id).single();
          const existingNotes = (meetingRow as any)?.notes ?? '';
          updates.notes = existingNotes ? `${existingNotes}\n[CANCELADO] ${args.reason}` : `[CANCELADO] ${args.reason}`;
        }
        const { error } = await supabase.from('meetings').update(updates).eq('id', args.meeting_id);
        if (error) return `Error: ${error.message}`;
        // Refresh upcoming meetings in context
        const now = new Date().toISOString();
        const { data: meetings } = await supabase
          .from('meetings').select('id, title, start_time, end_time, status, meeting_link')
          .eq('people_id', ctx.pessoa_id).gte('start_time', now)
          .order('start_time').limit(3);
        ctx.reunioes_proximas = meetings && meetings.length > 0
          ? JSON.stringify(meetings.map(m => ({ id: m.id, titulo: m.title, data: m.start_time, fim: m.end_time, link: m.meeting_link ?? null, status: m.status })))
          : '';
        return `Meeting ${args.meeting_id} cancelled`;
      }

      case 'criar_nota': {
        if (!leadId) return 'Error: no active lead';
        const { error } = await supabase.from('leads_notes').insert({
          lead_id: leadId,
          title: args.title,
          content: args.content,
        });
        if (error) return `Error: ${error.message}`;
        return `Note created: "${args.title}"`;
      }

      case 'obter_reuniao': {
        if (!leadId) return 'Nenhuma reunião encontrada — lead não identificado.';
        const { data: mtg } = await supabase
          .from('meetings')
          .select('id, title, start_time, end_time, meeting_link, status')
          .eq('lead_id', leadId)
          .in('status', ['agendado', 'confirmado', 'pendente'])
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!mtg) return 'Nenhuma reunião agendada encontrada para este lead.';

        const dt = new Date(mtg.start_time);
        const dtf = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const parts = dtf.formatToParts(dt);
        const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
        const date = `${p('day')}/${p('month')}/${p('year')}`;
        const time = `${p('hour')}:${p('minute')}`;

        return JSON.stringify({
          data: date,
          horario: time,
          link: mtg.meeting_link ?? 'Não disponível',
          status: mtg.status,
          duracao: '30 minutos',
        });
      }

      case 'enviar_link_agendamento': {
        if (!leadId) return 'Error: no active lead to generate booking link';
        const baseUrl = Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? '';
        if (!baseUrl) return 'Error: SITE_URL env var not configured';
        const duration = 30; // Fixed 30-min meetings — no LLM override
        const fallbackUrl = `${baseUrl}/agendar/${leadId}?d=${duration}`;

        // Se o consultor responsável tem Cal.com ativo como link preferido,
        // usa a URL pública do Cal.com com dados do lead pré-preenchidos.
        let calcomUrl: string | null = null;
        const consultorUserId = ctx.lead_responsavel_id;
        if (consultorUserId) {
          const { data: calcomConn } = await supabase
            .from('user_calcom_connections')
            .select('calcom_username, default_event_type_slug')
            .eq('user_id', consultorUserId)
            .eq('is_active', true)
            .eq('use_calcom_booking_link', true)
            .maybeSingle();

          if (calcomConn?.calcom_username && calcomConn?.default_event_type_slug) {
            const qs = new URLSearchParams();
            if (ctx.nome) qs.set('name', String(ctx.nome));
            if (ctx.email) qs.set('email', String(ctx.email));
            if (ctx.whatsapp) qs.set('phone', String(ctx.whatsapp));
            const query = qs.toString();
            calcomUrl = `https://cal.com/${calcomConn.calcom_username}/${calcomConn.default_event_type_slug}${query ? '?' + query : ''}`;
          }
        }

        const url = calcomUrl ?? fallbackUrl;
        // Store URL for direct delivery after agentic loop (bypass LLM text to avoid UUID corruption)
        ctx.__pending_booking_url = url;
        // Optionally move the lead to a new stage after sending the link
        if (args.leads_stages_id && leadId) {
          await supabase.from('leads').update({ leads_stages_id: args.leads_stages_id }).eq('id', leadId);
          ctx.lead_etapa_id = String(args.leads_stages_id);
        }
        return `Link de agendamento gerado (${duration} min). O link será enviado automaticamente ao cliente em uma mensagem separada. NÃO inclua o link na sua resposta — apenas confirme ao cliente que ele receberá o link.`;
      }

      case 'enviar_link_compra': {
        // Static Kiwify checkout links — update here if a product's URL changes.
        const CHECKOUT_LINKS: Record<string, string> = {
          squad_social: 'https://pay.kiwify.com.br/B8q7vHm',
          squad_dev: 'https://pay.kiwify.com.br/AY2hGbT',
          squad_sites: 'https://pay.kiwify.com.br/RdGPf8R',
          mentoria: 'https://kiwify.app/umE37Yf',
        };
        const produto = String(args.produto ?? '');
        const url = CHECKOUT_LINKS[produto];
        if (!url) return `Error: produto inválido "${produto}". Use squad_social, squad_dev, squad_sites ou mentoria.`;
        ctx.__pending_purchase_url = url;
        return 'Link de compra gerado. O link será enviado automaticamente ao cliente em uma mensagem separada. NÃO inclua o link na sua resposta — apenas confirme ao cliente que ele receberá o link.';
      }

      case 'enviar_audio_convite_growth_experience': {
        // Fixed campaign asset — same pattern as CHECKOUT_LINKS in enviar_link_compra.
        // Placeholder: suba o áudio no seu próprio bucket (omni-media) e troque a URL abaixo antes de ativar esta tool.
        ctx.__pending_audio_url = 'REPLACE_WITH_YOUR_SUPABASE_STORAGE_URL/omni-media/<pasta>/<arquivo>.ogg';
        ctx.__pending_link_text = 'Aqui estão os detalhes e a inscrição:\nREPLACE_WITH_YOUR_EVENT_LINK\n\nTe espero lá!';
        const { error } = await supabase.from('clients_people').update({ ai_enabled: false }).eq('id', ctx.pessoa_id);
        if (error) return `Error: ${error.message}`;
        return 'Áudio e mensagem de inscrição serão enviados automaticamente, em sequência, logo depois da sua resposta de texto. Responda AGORA só com a mensagem de orientação (o que é, quando, onde) e a mensagem de gancho pro áudio — NÃO inclua o link, preço ou vagas, isso chega automaticamente depois. O atendimento de IA para este contato já foi desativado após esta etapa.';
      }

      case 'consultar_pagamento_pendente': {
        if (!ctx.email && !ctx.whatsapp) return 'Não foi possível identificar o contato (sem e-mail nem WhatsApp salvo).';

        const { data: events } = await supabase
          .from('kiwify_webhook_events')
          .select('order_id, trigger, raw_payload, created_at')
          .in('trigger', ['pix_gerado', 'boleto_gerado'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (!events || events.length === 0) return 'Nenhum pagamento pendente encontrado para este contato.';

        const normalizedEmail = ctx.email?.toLowerCase().trim();
        const normalizedPhoneTail = ctx.whatsapp?.replace(/\D/g, '').slice(-8);
        const match = (events as Array<{ order_id: string; trigger: string; raw_payload: Record<string, unknown>; created_at: string }>).find((e) => {
          const customer = (e.raw_payload?.Customer ?? e.raw_payload?.customer ?? {}) as Record<string, unknown>;
          const evEmail = String(customer.email ?? '').toLowerCase().trim();
          const evPhoneTail = String(customer.mobile ?? '').replace(/\D/g, '').slice(-8);
          return (!!normalizedEmail && evEmail === normalizedEmail) || (!!normalizedPhoneTail && evPhoneTail === normalizedPhoneTail);
        });

        if (!match) return 'Nenhum pagamento pendente encontrado para este contato.';

        // A later compra_aprovada for the same order_id means it's already been paid.
        const { data: approved } = await supabase
          .from('kiwify_webhook_events')
          .select('id')
          .eq('order_id', match.order_id)
          .eq('trigger', 'compra_aprovada')
          .limit(1)
          .maybeSingle();

        if (approved) return 'Este pagamento já foi aprovado — não há pendência.';

        const payload = match.raw_payload as Record<string, unknown>;
        const product = (payload.Product ?? payload.product ?? {}) as Record<string, unknown>;
        if (match.trigger === 'pix_gerado') {
          return JSON.stringify({
            tipo: 'pix',
            codigo_copia_cola: payload.pix_code ?? 'não disponível',
            produto: product.product_name ?? '',
          });
        }
        return JSON.stringify({
          tipo: 'boleto',
          link: payload.boleto_URL ?? 'não disponível',
          linha_digitavel: payload.boleto_barcode ?? 'não disponível',
          vencimento: payload.boleto_expiry_date ?? '',
          produto: product.product_name ?? '',
        });
      }

      case 'collect_identity': {
        const ALLOWED_IDENTITY_FIELDS = new Set(['email', 'whatsapp', 'instagram_handle', 'document']);
        const field = String(args.field ?? '');
        const rawValue = String(args.value ?? '').trim();
        if (!ALLOWED_IDENTITY_FIELDS.has(field)) {
          return `Error: invalid identity field "${field}". Allowed: ${[...ALLOWED_IDENTITY_FIELDS].join(', ')}`;
        }
        if (!rawValue) return 'Error: value is empty';

        // Normalize value
        let normalized = rawValue;
        if (field === 'email') {
          normalized = rawValue.toLowerCase().trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return `Error: invalid email format "${rawValue}"`;
        } else if (field === 'whatsapp') {
          normalized = rawValue.replace(/\D/g, '');
          if (normalized.length >= 10 && normalized.length <= 11 && !normalized.startsWith('55')) {
            normalized = '55' + normalized;
          }
          if (normalized.length < 12 || normalized.length > 13) return `Error: invalid phone format "${rawValue}"`;
          normalized = '+' + normalized;
        } else if (field === 'instagram_handle') {
          // Extract handle from @handle or instagram.com/handle
          const igMatch = rawValue.match(/(?:instagram\.com\/|@?)([a-zA-Z0-9_.]+)/);
          normalized = igMatch ? igMatch[1].toLowerCase() : rawValue.toLowerCase().replace(/^@/, '');
          if (!/^[a-zA-Z0-9_.]{1,30}$/.test(normalized)) return `Error: invalid Instagram handle "${rawValue}"`;
        } else if (field === 'document') {
          normalized = rawValue.replace(/\D/g, '');
          if (normalized.length !== 11 && normalized.length !== 14) return `Error: invalid CPF/CNPJ "${rawValue}" (need 11 or 14 digits)`;
        }

        // Save to clients_people — the DB trigger trg_identity_auto_merge handles dedup
        const { error: updateErr } = await supabase
          .from('clients_people')
          .update({ [field]: normalized })
          .eq('id', ctx.pessoa_id);
        if (updateErr) return `Error: ${updateErr.message}`;

        // Update local context
        ctx[field] = normalized;

        // Check if auto-merge happened (trigger may have set merged_into_id)
        const { data: postUpdate } = await supabase
          .from('clients_people')
          .select('status, merged_into_id, name')
          .eq('id', ctx.pessoa_id)
          .single();

        if (postUpdate?.status === 'merged' && postUpdate.merged_into_id) {
          // Fetch canonical person name
          const { data: canonical } = await supabase
            .from('clients_people')
            .select('name')
            .eq('id', postUpdate.merged_into_id)
            .single();
          return `Identity saved: ${field} = ${normalized}. Contact merged with "${canonical?.name ?? 'unknown'}" (duplicate detected).`;
        }

        return `Identity saved: ${field} = ${normalized}`;
      }

      case 'collect_identity_optout': {
        const reason = String(args.reason ?? 'Contact declined identity collection');
        const { error: optErr } = await supabase
          .from('clients_people')
          .update({ identity_collection_opted_out: true })
          .eq('id', ctx.pessoa_id);
        if (optErr) return `Error: ${optErr.message}`;
        ctx.identity_collection_opted_out = 'true';
        return `Opt-out registered: ${reason}. Will not ask for identity fields again.`;
      }

      case 'iniciar_conversa_whatsapp': {
        const templateName = String(args.template_name ?? '').trim();
        const toNumber = ctx.whatsapp ?? '';
        if (!templateName) return 'Error: template_name is required';
        if (!toNumber) return 'Error: person has no whatsapp saved — call collect_identity(field="whatsapp") first';
        // Não resolve canal aqui — whatsapp-outbound resolve (active_channel_id da
        // pessoa > canal padrão > ...), certo pra Meta OU Evolution automaticamente.
        const waRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-outbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            to: toNumber,
            people_id: ctx.pessoa_id,
            lead_id: leadId ?? null,
            messages: [{ type: 'template', template_name: templateName }],
          }),
        });
        if (!waRes.ok) {
          const errBody = await waRes.text().catch(() => '');
          return `Error: whatsapp-outbound responded ${waRes.status}: ${errBody.slice(0, 200)}`;
        }
        return `WhatsApp conversation initiated with template "${templateName}" to ${toNumber}`;
      }

      case 'enviar_opcoes_horario': {
        const btnBody = String(args.body ?? 'Escolha um horário:');
        // If slots are available from the last consultar_disponibilidade call, use them
        // (shuffle + pick 2) instead of trusting the agent to pass the right ones.
        let btnOpcoes: string[];
        const rawSlots: Array<{ slot_start: string; slot_end: string }> = ctx.slots_disponiveis
          ? (() => { try { return JSON.parse(ctx.slots_disponiveis); } catch { return []; } })()
          : [];
        if (rawSlots.length > 0) {
          const shuffled = [...rawSlots].sort(() => Math.random() - 0.5).slice(0, 2);
          btnOpcoes = shuffled.map(s => `${s.slot_start} - ${s.slot_end}`.slice(0, 20));
          ctx.slots_disponiveis = ''; // clear so next call gets fresh slots
        } else {
          btnOpcoes = ((args.opcoes as string[]) ?? []).slice(0, 2).map((o: string) => String(o).slice(0, 20));
        }
        if (btnOpcoes.length === 0) return 'Error: opcoes must have at least 1 item';
        const toNumber = ctx.whatsapp ?? '';
        if (!toNumber) return 'Error: missing WhatsApp phone context (whatsapp)';
        // Não resolve canal aqui — whatsapp-outbound resolve via active_channel_id da
        // pessoa, garantindo que vai pro canal (Meta OU Evolution) que ela está usando.
        const outboundRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-outbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            to: toNumber,
            people_id: ctx.pessoa_id,
            lead_id: leadId,
            messages: [{ type: 'interactive', body: btnBody, buttons: btnOpcoes }],
          }),
        });
        if (!outboundRes.ok) return `Error: whatsapp-outbound responded ${outboundRes.status}`;
        ctx.__interactive_sent = 'true';
        return `Interactive buttons sent successfully: ${btnOpcoes.join(' | ')}`;
      }

      case 'atualizar_score': {
        if (!args.objective || !args.investment || !args.framing) {
          return 'Error: objective, investment, and framing are all required';
        }

        // Look up category item IDs by name + category slug (3 separate queries to avoid .or() escaping issues)
        const [objectiveRes, investmentRes, framingRes] = await Promise.all([
          supabase
            .from('score_category_items')
            .select('id, name, score_categories!inner(slug)')
            .eq('name', args.objective)
            .eq('score_categories.slug', 'objectives')
            .maybeSingle(),
          supabase
            .from('score_category_items')
            .select('id, name, score_categories!inner(slug)')
            .eq('name', args.investment)
            .eq('score_categories.slug', 'investments')
            .maybeSingle(),
          supabase
            .from('score_category_items')
            .select('id, name, score_categories!inner(slug)')
            .eq('name', args.framing)
            .eq('score_categories.slug', 'framings')
            .maybeSingle(),
        ]);

        if (objectiveRes.error) return `Error looking up score items: ${objectiveRes.error.message}`;
        if (investmentRes.error) return `Error looking up score items: ${investmentRes.error.message}`;
        if (framingRes.error) return `Error looking up score items: ${framingRes.error.message}`;

        const objectiveItem = objectiveRes.data;
        const investmentItem = investmentRes.data;
        const framingItem = framingRes.data;

        if (!objectiveItem) return `Error: objective "${args.objective}" not found in score settings`;
        if (!investmentItem) return `Error: investment "${args.investment}" not found in score settings`;
        if (!framingItem) return `Error: framing "${args.framing}" not found in score settings`;

        // Update clients_people — existing trigger auto-calculates score
        const { error: scoreErr } = await supabase
          .from('clients_people')
          .update({
            score_objective_id: objectiveItem.id,
            score_investment_id: investmentItem.id,
            score_framing_id: framingItem.id,
          })
          .eq('id', ctx.pessoa_id);

        if (scoreErr) return `Error updating score: ${scoreErr.message}`;

        // Refresh context with updated score
        const { data: updated } = await supabase
          .from('clients_people')
          .select('score, score_matrix_id')
          .eq('id', ctx.pessoa_id)
          .single();

        ctx.score_objective_name = args.objective;
        ctx.score_investment_name = args.investment;
        ctx.score_framing_name = args.framing;
        if (updated) ctx.score_number = String((updated as any).score ?? '');

        return `Score updated: Objetivo="${args.objective}", Investimento="${args.investment}", Enquadramento="${args.framing}". Score: ${(updated as any)?.score ?? 'calculating...'}`;
      }

      // ── RETORNO-02 — Retorno agendado (ADR-RETORNO-01 D3) ──────────────────
      case 'agendar_retorno': {
        const cfg = callbackConfigFromCtx(ctx);
        if (!cfg || !cfg.enabled) return 'Error: agendamento de retorno não está habilitado para este agente';
        if (!leadId) return 'Error: no active lead';

        const motivo = String(args.motivo ?? '').trim();
        if (!motivo) return 'Error: motivo é obrigatório';

        const rawWhen = String(args.scheduled_for ?? '').trim();
        const when = new Date(rawWhen);
        if (!rawWhen || isNaN(when.getTime())) {
          return 'Error: scheduled_for inválido — use ISO-8601 com offset, ex 2026-07-22T14:30:00-03:00';
        }

        const diffMinutes = (when.getTime() - Date.now()) / 60_000;
        if (diffMinutes <= 0) return `Error: scheduled_for está no passado — hoje é ${ctx.agora ?? ''}`;

        // O LLM calcula scheduled_for em cima de ctx.agora (o "agora" renderizado no
        // prompt) — não de Date.now(). Entre o render do prompt e a execução da tool
        // passa a latência de inferência (alguns segundos), então "exatamente
        // min_delay_minutes a partir de ctx.agora" sempre virava "um pouco menos que
        // min_delay_minutes a partir de Date.now()" e era rejeitado — mesmo quando o
        // LLM fez a conta certa. O piso usa ctx.agora como referência (mesmo relógio
        // que o LLM viu); "no passado" acima e o teto abaixo continuam em Date.now(),
        // que é o que importa de verdade pra essas duas checagens.
        const agoraRef = ctx.agora ? new Date(String(ctx.agora)) : null;
        const diffFromAgora = agoraRef && !isNaN(agoraRef.getTime())
          ? (when.getTime() - agoraRef.getTime()) / 60_000
          : diffMinutes;
        // Folga de 90s: o LLM arredonda pra um horário "redondo" (ex: 08:45:00) em vez
        // de fazer a soma exata ao segundo (08:40:25 + 5min = 08:45:25) — visto em teste
        // real (2026-07-22), rejeitava por 25s mesmo com ctx.agora como referência.
        // Sem essa folga o piso é praticamente impossível de acertar de primeira.
        const MIN_DELAY_GRACE_MINUTES = 1.5;
        if (diffFromAgora < cfg.min_delay_minutes - MIN_DELAY_GRACE_MINUTES) {
          return `Error: scheduled_for muito próximo — o mínimo é ${cfg.min_delay_minutes} minutos a partir de agora (${ctx.agora ?? ''})`;
        }
        if (diffMinutes > cfg.max_delay_hours * 60) {
          return `Error: scheduled_for muito distante — o máximo é ${cfg.max_delay_hours} horas a partir de agora (${ctx.agora ?? ''})`;
        }

        // Modo: só respeita a escolha do LLM quando o admin permitiu.
        const requestedMode = String(args.modo ?? '');
        const mode: 'direct' | 'agent' =
          cfg.allow_agent_choose_mode && (requestedMode === 'direct' || requestedMode === 'agent')
            ? requestedMode
            : (cfg.default_mode === 'agent' ? 'agent' : 'direct');

        // Conteúdo: template_id > mensagem (se permitida) > primeiro template (modo direct).
        const templates = Array.isArray(cfg.templates) ? cfg.templates : [];
        const rawTemplateId = args.template_id ? String(args.template_id).trim() : '';
        const rawMensagem = args.mensagem ? String(args.mensagem).trim() : '';
        let templateId: string | null = null;
        let messageText: string | null = null;
        let waTemplateName: string | null = null;

        if (rawTemplateId) {
          const tpl = templates.find(t => String(t.id) === rawTemplateId);
          if (!tpl) {
            const valid = templates.map(t => `"${t.id}"`).join(', ');
            return `Error: template_id "${rawTemplateId}" não existe — ids válidos: ${valid || '(nenhum template configurado)'}`;
          }
          templateId = String(tpl.id);
          messageText = tpl.body ?? null;
          waTemplateName = tpl.whatsapp_template_name ?? null;
        } else if (rawMensagem) {
          if (!cfg.allow_free_text) return 'Error: texto livre não permitido nesta configuração — informe template_id';
          messageText = rawMensagem;
        } else if (mode === 'direct') {
          if (templates.length === 0) {
            return 'Error: nenhum template configurado — não é possível agendar retorno em modo direct sem template_id ou mensagem';
          }
          const tpl = templates[0];
          templateId = String(tpl.id);
          messageText = tpl.body ?? null;
          waTemplateName = tpl.whatsapp_template_name ?? null;
        }
        if (!waTemplateName) waTemplateName = cfg.whatsapp_template_fallback ?? null;

        const hidden = ctx as unknown as Record<string, string>;
        const channel = hidden.__callback_channel === 'instagram' ? 'instagram' : 'whatsapp';
        const row: Record<string, unknown> = {
          lead_id: leadId,
          people_id: ctx.pessoa_id,
          agent_id: hidden.__callback_agent_id || null,
          step_id: hidden.__callback_step_id || null,
          scheduled_for: when.toISOString(), // normalizado para UTC
          mode,
          template_id: templateId,
          message_text: messageText,
          whatsapp_template_name: waTemplateName,
          reason: motivo,
          channel,
          status: 'pending',
          created_by_execution_id: hidden.__callback_execution_id || null,
        };

        // Invariante D1: 1 pendente por lead → reagendar é UPDATE, nunca segundo INSERT.
        const { data: existing, error: findErr } = await (supabase as any)
          .from('ai_scheduled_callbacks')
          .select('id')
          .eq('lead_id', leadId)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle();
        if (findErr) {
          callbackLog.error('agendar_retorno_lookup_failed', { lead_id: leadId, error: findErr.message });
          return `Error: falha ao consultar retorno pendente: ${findErr.message}`;
        }

        if (existing?.id) {
          const { error: updErr } = await (supabase as any)
            .from('ai_scheduled_callbacks')
            .update({ ...row, retry_count: 0, error_message: null, fired_at: null, message_id: null })
            .eq('id', existing.id)
            .eq('status', 'pending');
          if (updErr) {
            callbackLog.error('agendar_retorno_update_failed', { lead_id: leadId, callback_id: existing.id, error: updErr.message });
            return `Error: falha ao reagendar retorno: ${updErr.message}`;
          }
        } else {
          const { error: insErr } = await (supabase as any)
            .from('ai_scheduled_callbacks')
            .insert(row);
          if (insErr) {
            callbackLog.error('agendar_retorno_insert_failed', { lead_id: leadId, error: insErr.message });
            return `Error: falha ao agendar retorno: ${insErr.message}`;
          }
        }

        ctx.retorno_pendente = `${formatBrtHuman(when)} (BRT) — motivo: ${motivo}`;
        callbackLog.info('agendar_retorno_ok', { lead_id: leadId, scheduled_for: when.toISOString(), mode, template_id: templateId, reschedule: Boolean(existing?.id) });
        return `Retorno agendado para ${formatBrtHuman(when)} (modo: ${mode})`;
      }

      case 'cancelar_retorno': {
        if (!leadId) return 'Error: no active lead';
        const motivo = String(args.motivo ?? '').trim() || 'cancelado pelo agente';
        const { data: cancelled, error: cancelErr } = await (supabase as any)
          .from('ai_scheduled_callbacks')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: motivo })
          .eq('lead_id', leadId)
          .eq('status', 'pending')
          .select('id');
        if (cancelErr) {
          callbackLog.error('cancelar_retorno_failed', { lead_id: leadId, error: cancelErr.message });
          return `Error: falha ao cancelar retorno: ${cancelErr.message}`;
        }
        if (!cancelled || cancelled.length === 0) return 'Nenhum retorno pendente para cancelar';
        ctx.retorno_pendente = '';
        callbackLog.info('cancelar_retorno_ok', { lead_id: leadId, count: cancelled.length });
        return `Retorno cancelado (motivo: ${motivo})`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool execution error: ${(err as Error).message}`;
  }
}

// ── Agentic Loop ──────────────────────────────────────────────────────────────

async function runAgenticLoop(
  supabase: ReturnType<typeof createClient>,
  agent: AgentConfig,
  apiKey: string,
  systemPrompt: string,
  memory: LLMMessage[],
  currentMessage: string,
  ctx: ContextData,
  leadId: string | null,
  log?: ReturnType<typeof createLogger>,
): Promise<{ finalText: string; toolsUsed: string[]; toolCallDetails: ToolCallDetail[]; totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const toolsUsed: string[] = [];
  const toolCallDetails: ToolCallDetail[] = [];
  const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const isAnthropic = agent.llm_provider === 'anthropic';
  const endpoint = getLLMEndpoint(agent.llm_provider);

  // Build initial messages
  const openaiMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...memory,
    { role: 'user', content: currentMessage },
  ];

  // Anthropic tracks messages separately (no system in messages array)
  const anthropicMessages: AnthropicMessage[] = [
    ...memory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' })),
    { role: 'user', content: currentMessage },
  ];

  let finalText = '';
  let iteration = 0;

  const pipelineId = ctx['lead_pipeline_id'] || agent.pipeline_id || null;
  // RETORNO-02: a config de callback viaja no ctx (setada no handler principal);
  // quando ausente/desabilitada, buildToolDefinitions devolve exatamente as 22 tools de sempre.
  const toolDefinitions = await buildToolDefinitions(supabase, pipelineId, callbackConfigFromCtx(ctx));

  // Detect specific time reference in user message (e.g. "às 16h", "16:00", "10h").
  // Exclude button clicks — they already contain time strings but are handled by OVERRIDE ABSOLUTO.
  const isButtonClick = currentMessage.startsWith('[SELEÇÃO DE BOTÃO]');
  // Matches "16h", "16:00", "às 16", "as 16" (no accent common in WhatsApp), "9 horas"
  const TIME_PATTERN = /\b\d{1,2}[:h]\d*\b|\bàs?\s+\d{1,2}\b|\bas\s+\d{1,2}\b|\b\d{1,2}\s*horas?\b/i;
  const messageHasTimeRef = !isButtonClick && TIME_PATTERN.test(currentMessage);

  log?.info('loop_start', { provider: agent.llm_provider, model: agent.llm_model, memory_msgs: memory.length, msg_len: currentMessage.length, force_tool_iter1: messageHasTimeRef });

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;
    const iterStart = Date.now();

    // On the first iteration, if the lead mentioned a specific time and we haven't
    // queried availability yet, force a tool call so the LLM can't respond with plain text.
    const forceTools = messageHasTimeRef && iteration === 1 && !toolsUsed.includes('consultar_disponibilidade');

    log?.debug('loop_iter', { iteration, max: MAX_TOOL_ITERATIONS, force_tools: forceTools });

    let response: LLMResponse;

    if (isAnthropic) {
      response = await callAnthropic(
        apiKey,
        agent.llm_model,
        agent.llm_temperature,
        agent.llm_max_tokens,
        systemPrompt,
        anthropicMessages,
        toolDefinitions,
        forceTools,
      );
    } else {
      response = await callOpenAICompat(
        endpoint,
        apiKey,
        agent.llm_model,
        agent.llm_temperature,
        agent.llm_max_tokens,
        openaiMessages,
        toolDefinitions,
        forceTools ? 'required' : 'auto',
      );
    }

    if (response.text) finalText = response.text;
    if (response.usage) {
      totalUsage.prompt_tokens += response.usage.prompt_tokens;
      totalUsage.completion_tokens += response.usage.completion_tokens;
      totalUsage.total_tokens += response.usage.total_tokens;
    }

    log?.info('llm_response', { iteration, finish_reason: response.finishReason, tool_calls: response.toolCalls.length, has_text: !!response.text, elapsed_ms: Date.now() - iterStart, usage: response.usage });

    // No tool calls → done
    if (response.toolCalls.length === 0) {
      log?.info('loop_done', { reason: 'no_tool_calls', iteration });
      break;
    }

    // Execute each tool call
    const toolResults: Array<{ id: string; name: string; result: string }> = [];

    for (const tc of response.toolCalls) {
      toolsUsed.push(tc.name);
      const toolStart = Date.now();
      const result = await executeTool(supabase, tc.name, tc.args, ctx, leadId);
      const isToolError = result.startsWith('Error:') || result.startsWith('Tool execution error:');
      log?.info('tool_call', { tool: tc.name, elapsed_ms: Date.now() - toolStart, error: isToolError ? result : undefined });
      if (isToolError) log?.warn('tool_error', { tool: tc.name, result });
      toolResults.push({ id: tc.id, name: tc.name, result });
      toolCallDetails.push({ name: tc.name, args: tc.args, result });
    }

    // Append tool calls + results to message arrays for next iteration
    if (isAnthropic) {
      // Assistant message with tool_use blocks
      const assistantContent: AnthropicContent[] = [];
      if (response.text) assistantContent.push({ type: 'text', text: response.text });
      for (const tc of response.toolCalls) {
        assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
      }
      anthropicMessages.push({ role: 'assistant', content: assistantContent });

      // User message with tool_result blocks
      const toolResultContent: AnthropicContent[] = toolResults.map(tr => ({
        type: 'tool_result',
        tool_use_id: tr.id,
        content: tr.result,
      }));
      anthropicMessages.push({ role: 'user', content: toolResultContent });
    } else {
      // OpenAI: add assistant message + tool result messages
      openaiMessages.push({
        role: 'assistant',
        content: response.text ?? null,
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });

      for (const tr of toolResults) {
        openaiMessages.push({ role: 'tool', content: tr.result, tool_call_id: tr.id });
      }
    }

    // If finish reason was 'stop' or 'end_turn' with text (no more tools), break
    if (response.toolCalls.length === 0 || response.finishReason === 'stop' || response.finishReason === 'end_turn') {
      log?.info('loop_done', { reason: response.finishReason, iteration });
      break;
    }
  }

  log?.info('loop_complete', { iterations: iteration, tools_used: toolsUsed, final_text_len: finalText.trim().length });

  return { finalText: finalText.trim(), toolsUsed, toolCallDetails, totalUsage };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startAt = Date.now();
  const log = createLogger('ai-agent-execute');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let peopleId: string | null = null;
  let executionId: string | null = null;
  let agentId: string | null = null;
  let leadId: string | null = null;
  let testMode = false;
  let bufferIds: string[] = [];

  try {
    const body = await req.json();
    peopleId = body.people_id;
    testMode = body.test_mode === true;
    const stageTrigger: boolean = body.stage_trigger === true;
    const testAgentId: string | null = body.agent_id ?? null;
    const directMessage: string | null = body.direct_message ?? null;
    // FIX-AGENT-DUP-03: the process_message_buffer cron acquires ai_processing_lock before
    // calling us, so it sets lock_preacquired=true → skip the inline CAS (the lock is already
    // ours). Direct inbound triggers omit this flag → we acquire the lock ourselves.
    const lockPreacquired: boolean = body.lock_preacquired === true;

    log.info('start', { people_id: peopleId, test_mode: testMode, stage_trigger: stageTrigger, agent_id: testAgentId ?? undefined });

    if (!peopleId) {
      return new Response(JSON.stringify({ error: 'people_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FIX-AGENT-DUP-03: serialization is back on the CAS lock (clients_people.ai_processing_lock),
    // acquired just before getBufferMessages in the buffer branch below. The DUP-02 atomic-claim
    // approach (marking the buffer processed=true up front) was reverted because it discarded the
    // message on any post-claim failure. The CAS lock serializes concurrent executions WITHOUT
    // marking the buffer processed before the LLM runs, so a failed run leaves the buffer retryable.

    // 1. Get message to process (buffer in normal mode, direct_message in test mode, empty in stage_trigger mode)
    let combinedText: string;
    let inboundWaPhoneNumberId: string | null = null;
    let inboundChannelType: string | null = null; // G3: explicit channel from buffer
    let hasInboundAudio = false; // Track if client sent audio → respond with audio
    let hasInteractiveReply = false; // Track if client clicked a WhatsApp button → prefix message + inject prompt rule

    if (testMode) {
      if (!directMessage) {
        return new Response(JSON.stringify({ error: 'direct_message required in test_mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      combinedText = directMessage;
    } else if (stageTrigger) {
      // Stage-entry proactive trigger: no inbound message — agent sends the opening message.
      // combinedText is empty; the agent's identity/prompt must handle the proactive greeting.
      combinedText = directMessage ?? '';
    } else {
      // FIX-AGENT-DUP-03: CAS lock to serialize concurrent executions for the same people_id.
      // Skip it when the cron already acquired the lock (lock_preacquired) — otherwise we'd see
      // the lock as true (set by the cron before calling us) and abort every cron-triggered run.
      // UPDATE ai_processing_lock false→true; if 0 rows came back, another execution holds the
      // lock → abort WITHOUT releasing it (we never acquired it) and WITHOUT touching the buffer
      // (it stays processed=false → retried by the in-flight holder or a later trigger).
      // The buffer is only marked processed=true at step 13, after the reply is persisted, so an
      // aborted/failed run never silences the message.
      if (!lockPreacquired) {
        const { data: casRows, error: casError } = await supabase
          .from('clients_people')
          .update({ ai_processing_lock: true })
          .eq('id', peopleId)
          .eq('ai_processing_lock', false)
          .select('id');

        if (!casError && (!casRows || casRows.length === 0)) {
          log.silent('lock_not_acquired', { people_id: peopleId });
          return new Response(JSON.stringify({ status: 'lock_not_acquired' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // casError → fail-open: continue without the lock. An infra error on the lock table must
        // not silence the agent; a rare duplicate reply is preferable to total silence.
      }

      const bufferResult = await getBufferMessages(supabase, peopleId);
      bufferIds = bufferResult.bufferIds;
      combinedText = bufferResult.combinedText;
      inboundWaPhoneNumberId = bufferResult.waPhoneNumberId;
      inboundChannelType = bufferResult.channelType; // G3
      hasInboundAudio = bufferResult.hasInboundAudio;
      hasInteractiveReply = bufferResult.hasInteractiveReply ?? false;
      if (hasInteractiveReply && combinedText) {
        combinedText = `[SELEÇÃO DE BOTÃO] ${combinedText}`;
      }
      log.info('buffer_read', { buffer_count: bufferIds.length, msg_len: combinedText.length, wa_phone_number_id: inboundWaPhoneNumberId ?? undefined, channel_type: inboundChannelType ?? undefined, has_inbound_audio: hasInboundAudio, has_interactive_reply: hasInteractiveReply });
      if (!combinedText || bufferIds.length === 0) {
        log.warn('nothing_to_process', { people_id: peopleId, buffer_ids: bufferIds.length });
        // Mark buffer as processed (if entries exist) to prevent infinite retry loop
        if (bufferIds.length > 0) {
          await supabase
            .from('message_buffer')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .in('id', bufferIds);
        }
        await supabase
          .from('clients_people')
          .update({ ai_processing_lock: false })
          .eq('id', peopleId);
        return new Response(JSON.stringify({ status: 'nothing_to_process' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Load context (person + lead + company + Q-fields + meetings)
    const { context: ctx, leadId: resolvedLeadId, companyId, aiEnabled } = await loadContext(supabase, peopleId);
    leadId = resolvedLeadId;
    log.info('context_loaded', { lead_id: leadId ?? undefined, company_id: companyId ?? undefined, person_name: ctx.nome, ai_enabled: aiEnabled });

    // G1: Gate — AI desabilitada para essa pessoa (human takeover ativo)
    if (!testMode && !aiEnabled) {
      log.warn('ai_skipped_human_takeover', { people_id: peopleId });
      if (bufferIds.length > 0) {
        await supabase
          .from('message_buffer')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .in('id', bufferIds);
      }
      await supabase
        .from('clients_people')
        .update({ ai_processing_lock: false })
        .eq('id', peopleId);
      return new Response(JSON.stringify({ status: 'ai_disabled_for_person' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Find agent
    let agent: AgentConfig | null = null;
    if (testMode && testAgentId) {
      agent = await loadAgentById(supabase, testAgentId);
    } else {
      const { data: leadPipelineRow } = await supabase
        .from('leads')
        .select('leads_pipelines_id, leads_stages_id')
        .eq('id', leadId ?? '')
        .maybeSingle();
      if (stageTrigger) {
        // Stage-entry proactive: look up agent by stage regardless of channel.
        // The outbound channel will be determined by agent.wa_phone_number_id.
        agent = await loadAgentForStageEntry(
          supabase,
          leadPipelineRow?.leads_pipelines_id ?? null,
          leadPipelineRow?.leads_stages_id ?? null,
        );
      } else {
        // G3: use explicit channel_type from buffer; fallback to wa_phone_number_id heuristic
        // Normalize: message_buffer stores 'instagram' but ai_agents.channel_types uses 'instagram_dm'
        const rawChannel = inboundChannelType ?? (inboundWaPhoneNumberId ? 'whatsapp' : null);
        const inboundChannel = rawChannel === 'instagram' ? 'instagram_dm' : rawChannel;
        agent = await loadAgent(
          supabase,
          leadPipelineRow?.leads_pipelines_id ?? null,
          leadPipelineRow?.leads_stages_id ?? null,
          inboundChannel,
        );
      }
      if (!agent) {
        // Graceful exit — no agent configured for this pipeline/stage/channel.
        // Mark buffer as processed so pg_cron does not retry endlessly.
        log.warn('agent_not_found_no_retry', { pipeline_id: leadPipelineRow?.leads_pipelines_id, stage_id: leadPipelineRow?.leads_stages_id, stage_trigger: stageTrigger });
        if (bufferIds.length > 0) {
          await supabase
            .from('message_buffer')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .in('id', bufferIds);
        }
        await supabase
          .from('clients_people')
          .update({ ai_processing_lock: false })
          .eq('id', peopleId);
        return new Response(JSON.stringify({ status: 'no_agent_configured', pipeline_id: leadPipelineRow?.leads_pipelines_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    if (!agent) {
      log.error('agent_not_found', { people_id: peopleId });
      throw new Error('No active AI agent found');
    }
    agentId = agent.id;
    log.info('agent_found', { agent_id: agentId, provider: agent.llm_provider, model: agent.llm_model, use_stages: agent.use_stages });

    // G2: Gate — Score da pessoa não está nas matrizes configuradas no agente
    // score_matrix_ids=[] AND score_allow_empty=false → todos os scores passam (sem filtro)
    // score_allow_empty=true → inclui leads sem score (null/0)
    // score_matrix_ids com UUIDs → inclui leads cujo score_number bate com a matriz
    const hasScoreFilter = (agent.score_matrix_ids?.length > 0) || agent.score_allow_empty;
    if (!testMode && hasScoreFilter) {
      const allowEmpty = agent.score_allow_empty;
      const realMatrixIds = agent.score_matrix_ids || [];

      const personScore = ctx.score ? Number(ctx.score) : null;
      const personHasNoScore = personScore === null || personScore === 0;

      let qualifies = false;

      // Sem score → passa se score_allow_empty estiver configurado
      if (personHasNoScore && allowEmpty) qualifies = true;

      // Com score → checa se bate com alguma matriz real configurada
      if (!qualifies && !personHasNoScore && realMatrixIds.length > 0) {
        const { data: matrices } = await supabase
          .from('score_matrix')
          .select('score_number')
          .in('id', realMatrixIds);
        const allowedScores = (matrices ?? []).map(m => Number(m.score_number));
        if (allowedScores.includes(personScore!)) qualifies = true;
      }

      if (!qualifies) {
        log.warn('agent_skipped_score_matrix_mismatch', {
          agent_id: agentId,
          person_score: personScore,
          allow_empty: allowEmpty,
          real_matrix_ids: realMatrixIds,
        });
        if (bufferIds.length > 0) {
          await supabase
            .from('message_buffer')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .in('id', bufferIds);
        }
        await supabase
          .from('clients_people')
          .update({ ai_processing_lock: false })
          .eq('id', peopleId);
        return new Response(JSON.stringify({ status: 'score_matrix_not_matched', person_score: personScore }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // G3: Gate — origem_lista do lead não está nos filtros configurados no agente
    // origem_lista_filters=[] → sem filtro, todos os leads passam
    const hasOrigemFilter = agent.origem_lista_filters?.length > 0;
    if (!testMode && hasOrigemFilter) {
      const leadOrigem = ctx.origem_lista || '';
      if (!agent.origem_lista_filters.includes(leadOrigem)) {
        log.warn('agent_skipped_origem_lista_mismatch', {
          agent_id: agentId,
          lead_origem_lista: leadOrigem,
          allowed: agent.origem_lista_filters,
        });
        if (bufferIds.length > 0) {
          await supabase
            .from('message_buffer')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .in('id', bufferIds);
        }
        await supabase
          .from('clients_people')
          .update({ ai_processing_lock: false })
          .eq('id', peopleId);
        return new Response(JSON.stringify({ status: 'origem_lista_not_matched', lead_origem: leadOrigem }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Get API key
    const apiKey = await getApiKey(supabase, agent);

    // 5. Find matching step
    let step: AgentStep | null = null;
    if (agent.use_stages && ctx.lead_control) {
      step = await loadStep(supabase, agent.id, ctx.lead_control);
    }
    log.info('step_resolved', { use_stages: agent.use_stages, control: ctx.lead_control ?? undefined, step_id: step?.id ?? undefined, step_name: step?.name ?? undefined });

    // 5b. RETORNO-02: config da tool de retorno (agente + step, fallback step_id IS NULL).
    // Sem config habilitada, nada muda: as tools não são expostas e nenhum bloco é injetado.
    const callbackConfig = await loadCallbackConfig(supabase, agent.id, step?.id ?? null);
    if (callbackConfig?.enabled) {
      const hiddenCtx = ctx as unknown as Record<string, string>;
      hiddenCtx.__callback_config = JSON.stringify(callbackConfig);
      hiddenCtx.__callback_agent_id = agent.id;
      hiddenCtx.__callback_step_id = step?.id ?? '';
      hiddenCtx.__callback_channel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';
      log.info('callback_config_loaded', { agent_id: agent.id, step_id: step?.id ?? undefined, config_step_id: callbackConfig.step_id ?? undefined, mode: callbackConfig.default_mode });
    }

    // 6. Build system prompt
    ctx['mensagem'] = combinedText;
    const systemPrompt = buildSystemPrompt(agent, ctx, step, hasInteractiveReply, callbackConfig);

    // 7. Build memory — use raw inboundChannelType ('instagram' or 'whatsapp') as stored in messages.channel
    const memoryChannel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';
    const memory = await buildMemory(supabase, peopleId, agent.memory_window, memoryChannel);

    // 8. Create execution log entry (initial)
    const { data: execLog } = await supabase
      .from('ai_agents_execution_log')
      .insert({
        ai_agent_id: agentId,
        people_id: peopleId,
        lead_id: leadId,
        prompt_rendered: systemPrompt,
        execution_status: 'running',
        tools_used: [],
      })
      .select('id')
      .single();
    executionId = execLog?.id ?? null;
    // RETORNO-02: rastreabilidade da origem do retorno (ai_scheduled_callbacks.created_by_execution_id)
    if (callbackConfig?.enabled && executionId) {
      (ctx as unknown as Record<string, string>).__callback_execution_id = executionId;
    }

    // 9a. Fire typing indicator to client's WhatsApp + keep renewing every 20s during LLM call
    // WhatsApp typing indicator expires after ~25s — renew while the agent is thinking.
    const sendTyping = () => {
      if (!inboundWaPhoneNumberId) return;
      fetch(`${supabaseUrl}/functions/v1/whatsapp-outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ action: 'typing', people_id: peopleId }),
      }).catch(() => {});
    };
    sendTyping();
    const typingInterval = inboundWaPhoneNumberId ? setInterval(sendTyping, 20_000) : null;

    // Inject phone context into ctx so tools can send interactive messages
    ctx.wa_phone_number_id = inboundWaPhoneNumberId ?? agent.wa_phone_number_id ?? '';

    // 9b. Agentic loop
    let finalText: string, toolsUsed: string[], toolCallDetails: ToolCallDetail[], totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    try {
      ({ finalText, toolsUsed, toolCallDetails, totalUsage } = await runAgenticLoop(
        supabase,
        agent,
        apiKey,
        systemPrompt,
        memory,
        combinedText,
        ctx,
        leadId,
        log,
      ));
    } finally {
      if (typingInterval) clearInterval(typingInterval);
    }

    const durationMs = Date.now() - startAt;

    // If interactive buttons were already sent via enviar_opcoes_horario, suppress finalText
    // entirely — the buttons already carry the body + options, no plain-text echo needed.
    if (ctx.__interactive_sent === 'true') {
      finalText = '';
    }

    if (testMode) {
      // Test mode: persist AI message for conversation memory, return response directly
      // Append booking/purchase URL if a tool generated one (test mode shows it inline for debugging)
      const pendingUrl = ctx.__pending_booking_url ?? ctx.__pending_purchase_url;
      const testFinalText = pendingUrl
        ? `${finalText}\n\n${pendingUrl}`
        : finalText;

      if (testFinalText) {
        await supabase.from('messages').insert({
          people_id: peopleId,
          lead_id: leadId,
          content: testFinalText,
          from_contact: 'agente_ia',
          source_type: 'ai_agent',
          channel: inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp',
          status: 'sent',
          message_type: 'texto',
          wa_phone_number_id: inboundWaPhoneNumberId ?? agent?.wa_phone_number_id ?? null,
        });
      }

      await supabase
        .from('ai_agents_execution_log')
        .update({
          execution_status: 'completed',
          execution_duration_ms: durationMs,
          tools_used: toolsUsed,
          response_data: { text: testFinalText, test_mode: true, usage: totalUsage, tool_call_details: toolCallDetails, booking_url: ctx.__pending_booking_url ?? null, purchase_url: ctx.__pending_purchase_url ?? null },
        })
        .eq('id', executionId ?? '');

      return new Response(
        JSON.stringify({
          status: 'ok',
          response: testFinalText,
          tools_used: toolsUsed,
          tool_calls: toolCallDetails,
          duration_ms: durationMs,
          booking_url: ctx.__pending_booking_url ?? null,
          purchase_url: ctx.__pending_purchase_url ?? null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 9.5. TTS — Voice response based on voice_response_mode:
    //   'mirror' (default): audio only when client sent audio
    //   'always': always respond with audio
    let ttsResult: { url: string; characters_used: number; duration_ms: number; mime_type?: string; output_format?: string } | null = null;
    const voiceMode = agent.voice_response_mode || 'mirror';
    const shouldUseVoice = agent.voice_enabled === true
      && (voiceMode === 'always' || hasInboundAudio)
      && finalText && finalText.trim().length > 0;
    console.log(`step9.5 TTS check: voice_enabled=${agent.voice_enabled}, voice_mode=${voiceMode}, voice_id=${agent.voice_id}, hasInboundAudio=${hasInboundAudio}, shouldUseVoice=${shouldUseVoice}, textLen=${finalText?.length ?? 0}`);
    if (shouldUseVoice) {
      // Strip URLs from text before sending to TTS — URLs sound terrible when spoken
      const ttsUrlPattern = /https?:\/\/[^\s),]+/gi;
      const ttsCleanText = finalText.replace(ttsUrlPattern, '').replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim();
      console.log(`step9.5 TTS text cleaned: originalLen=${finalText.length}, cleanLen=${ttsCleanText.length}, urlsRemoved=${(finalText.match(ttsUrlPattern) || []).length}`);
      try {
        const ttsAbort = new AbortController();
        const ttsTimeout = setTimeout(() => ttsAbort.abort(), 15_000);
        const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            text: ttsCleanText || finalText, // fallback to full text if cleaning removed everything
            voice_id: agent.voice_id || undefined,
            model_id: agent.voice_model_id || undefined,
            output_format: 'opus_48000_128', // OGG Opus — required for WhatsApp voice notes (voice:true only works with audio/ogg codecs=opus)
            voice_settings: {
              stability: agent.voice_stability ?? undefined,
              similarity_boost: agent.voice_similarity ?? undefined,
              speed: agent.voice_speed ?? undefined,
            },
          }),
          signal: ttsAbort.signal,
        });
        clearTimeout(ttsTimeout);
        console.log(`step9.5 TTS response: status=${ttsResponse.status}`);
        const ttsBody = await ttsResponse.json();
        if (ttsBody.url) {
          ttsResult = ttsBody;
          log.info('tts_success', {
            voice_id: agent.voice_id,
            chars: ttsBody.characters_used,
            duration_ms: ttsBody.duration_ms,
            url: ttsBody.url,
          });
        } else {
          throw new Error(ttsBody.error || 'TTS returned no URL');
        }
      } catch (ttsErr) {
        console.error(`step9.5 TTS FAILED with agent voice: ${(ttsErr as Error).message}`);
        log.warn('tts_agent_voice_failed', { voice_id: agent.voice_id, error: (ttsErr as Error).message });

        // Retry with global default voice (no voice_id override → settings_elevenlabs.default_voice_id)
        if (agent.voice_id) {
          try {
            console.log('step9.5 TTS retry with default voice (no voice_id override)');
            const retryAbort = new AbortController();
            const retryTimeout = setTimeout(() => retryAbort.abort(), 15_000);
            const retryResponse = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({
                text: finalText,
                // omit voice_id → elevenlabs-tts falls back to settings_elevenlabs.default_voice_id
                output_format: 'opus_48000_128',
              }),
              signal: retryAbort.signal,
            });
            clearTimeout(retryTimeout);
            console.log(`step9.5 TTS retry response: status=${retryResponse.status}`);
            const retryBody = await retryResponse.json();
            if (retryBody.url) {
              ttsResult = retryBody;
              log.info('tts_success_default_voice', {
                chars: retryBody.characters_used,
                duration_ms: retryBody.duration_ms,
                url: retryBody.url,
              });
            } else {
              throw new Error(retryBody.error || 'TTS retry returned no URL');
            }
          } catch (retryErr) {
            console.error(`step9.5 TTS retry ALSO FAILED: ${(retryErr as Error).message}`);
            log.warn('tts_default_voice_failed_fallback_text', { error: (retryErr as Error).message });
            // Continue with text response (final fallback)
          }
        }
      }
    }

    // 10. Persist AI response as 'pending' so omni-delivery-engine dispatches via correct channel
    if (finalText) {
      const waPhoneId = inboundWaPhoneNumberId ?? agent.wa_phone_number_id ?? null;
      // Map inbound channel to delivery channel:
      // instagram_dm (message_buffer) → instagram (omni-delivery-engine routing)
      // everything else defaults to whatsapp
      const deliveryChannel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';

      // If TTS succeeded, send audio message + separate text for any URLs found
      if (ttsResult) {
        // Extract URLs from text — TTS should NOT speak URLs (sounds terrible)
        const urlPattern = /https?:\/\/[^\s),]+/gi;
        const extractedUrls = finalText.match(urlPattern) || [];
        // Text for TTS: remove URLs and clean up leftover whitespace/punctuation
        const ttsText = finalText.replace(urlPattern, '').replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim();

        const audioInsert = {
          people_id: peopleId,
          lead_id: leadId,
          content: finalText, // preserve FULL text (with URLs) for history/search
          from_contact: 'agente_ia',
          source_type: 'ai_agent',
          channel: deliveryChannel,
          status: 'pending',
          message_type: 'audio',
          media_url: ttsResult.url,
          media_metadata: {
            mime_type: ttsResult.mime_type || 'audio/ogg',
            output_format: ttsResult.output_format,
            source: 'elevenlabs-tts',
            characters: ttsResult.characters_used,
            duration_ms: ttsResult.duration_ms,
          },
          execution_id: executionId,
          wa_phone_number_id: waPhoneId,
        };
        console.log('step10 insert audio message:', { url: ttsResult.url, chars: ttsResult.characters_used, extractedUrls: extractedUrls.length });
        const { error: msgInsertError } = await supabase.from('messages').insert(audioInsert);
        if (msgInsertError) {
          log.error('messages_insert_failed', { error: msgInsertError.message, details: msgInsertError.details, hint: msgInsertError.hint });
        }

        // Send extracted URLs as separate text messages (so user gets clickable links)
        if (extractedUrls.length > 0) {
          const linkText = extractedUrls.join('\n');
          const linkInsert = {
            people_id: peopleId,
            lead_id: leadId,
            content: linkText,
            from_contact: 'agente_ia',
            source_type: 'ai_agent',
            channel: deliveryChannel,
            status: 'pending',
            message_type: 'texto',
            execution_id: executionId,
            wa_phone_number_id: waPhoneId,
          };
          console.log('step10 insert link text message:', { urls: extractedUrls });
          const { error: linkInsertError } = await supabase.from('messages').insert(linkInsert);
          if (linkInsertError) {
            log.error('link_message_insert_failed', { error: linkInsertError.message });
          }
        }
      } else {
      // Text response (default or TTS fallback)
      const humanizacao = agent.humanizacao ?? 'media';
      let messageParts: string[];
      if (humanizacao === 'nenhuma') {
        messageParts = [finalText.trim()].filter(Boolean);
      } else if (humanizacao === 'alta') {
        messageParts = finalText.split(/\n+/).map(p => p.trim()).filter(Boolean);
      } else {
        // 'media' — split only on double (or more) newlines
        messageParts = finalText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      }
      // FIX-DUP-REPLY-01: LLM occasionally repeats its own output (e.g. [A,B,A,B]).
      // Deduplicate while preserving order — never send the same message twice.
      {
        const seen = new Set<string>();
        const before = messageParts.length;
        messageParts = messageParts.filter(p => { if (seen.has(p)) return false; seen.add(p); return true; });
        if (messageParts.length !== before) {
          log.warn('dup_reply_dedup', { before, after: messageParts.length });
        }
      }
      console.log('step10 insert messages:', { messageParts: messageParts.length, humanizacao, waPhoneId, deliveryChannel });

      const messageInserts = messageParts.map(p => ({
        people_id: peopleId,
        lead_id: leadId,
        content: p,
        from_contact: 'agente_ia',
        source_type: 'ai_agent',
        channel: deliveryChannel,
        status: 'pending',
        message_type: 'texto',
        execution_id: executionId,
        wa_phone_number_id: waPhoneId,
      }));
      const { error: msgInsertError } = await supabase.from('messages').insert(messageInserts);
      if (msgInsertError) {
        log.error('messages_insert_failed', { error: msgInsertError.message, details: msgInsertError.details, hint: msgInsertError.hint });
        if (executionId) {
          await supabase.from('ai_agents_execution_log').update({
            error_message: `msg_insert: ${msgInsertError.message} | ${msgInsertError.details ?? ''} | ${msgInsertError.hint ?? ''}`,
          }).eq('id', executionId);
        }
      }
      } // close else (text fallback)
    }

    // 10b. Send booking URL as a separate message (bypasses LLM to avoid UUID corruption)
    if (ctx.__pending_booking_url) {
      const waPhoneIdForBooking = inboundWaPhoneNumberId ?? agent.wa_phone_number_id ?? null;
      const bookingChannel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';
      const { error: bookingInsertError } = await supabase.from('messages').insert({
        people_id: peopleId,
        lead_id: leadId,
        content: ctx.__pending_booking_url,
        from_contact: 'agente_ia',
        source_type: 'ai_agent',
        channel: bookingChannel,
        status: 'pending',
        message_type: 'texto',
        execution_id: executionId,
        wa_phone_number_id: waPhoneIdForBooking,
      });
      if (bookingInsertError) {
        log.error('booking_url_insert_failed', { error: bookingInsertError.message });
      } else {
        log.info('booking_url_sent', { url: ctx.__pending_booking_url });
      }
    }

    // 10c. Send purchase URL as a separate message (same rationale as 10b — bypasses LLM text)
    if (ctx.__pending_purchase_url) {
      const waPhoneIdForPurchase = inboundWaPhoneNumberId ?? agent.wa_phone_number_id ?? null;
      const purchaseChannel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';
      const { error: purchaseInsertError } = await supabase.from('messages').insert({
        people_id: peopleId,
        lead_id: leadId,
        content: ctx.__pending_purchase_url,
        from_contact: 'agente_ia',
        source_type: 'ai_agent',
        channel: purchaseChannel,
        status: 'pending',
        message_type: 'texto',
        execution_id: executionId,
        wa_phone_number_id: waPhoneIdForPurchase,
      });
      if (purchaseInsertError) {
        log.error('purchase_url_insert_failed', { error: purchaseInsertError.message });
      } else {
        log.info('purchase_url_sent', { url: ctx.__pending_purchase_url });
      }
    }

    // 10d. Send pending Growth Experience audio (voice note), after the main text
    if (ctx.__pending_audio_url) {
      const waPhoneIdForAudio = inboundWaPhoneNumberId ?? agent.wa_phone_number_id ?? null;
      const audioChannel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';
      const { error: audioInsertError } = await supabase.from('messages').insert({
        people_id: peopleId,
        lead_id: leadId,
        content: '[áudio] Growth Experience — explicação do João',
        from_contact: 'agente_ia',
        source_type: 'ai_agent',
        channel: audioChannel,
        status: 'pending',
        message_type: 'audio',
        media_url: ctx.__pending_audio_url,
        media_metadata: { mime_type: 'audio/ogg', source: 'growth_experience_convite' },
        execution_id: executionId,
        wa_phone_number_id: waPhoneIdForAudio,
      });
      if (audioInsertError) {
        log.error('pending_audio_insert_failed', { error: audioInsertError.message });
      } else {
        log.info('pending_audio_sent', { url: ctx.__pending_audio_url });
      }
    }

    // 10e. Send pending registration-link text, right after the audio above
    if (ctx.__pending_link_text) {
      const waPhoneIdForLink = inboundWaPhoneNumberId ?? agent.wa_phone_number_id ?? null;
      const linkChannel = inboundChannelType === 'instagram' ? 'instagram' : 'whatsapp';
      const { error: linkInsertError } = await supabase.from('messages').insert({
        people_id: peopleId,
        lead_id: leadId,
        content: ctx.__pending_link_text,
        from_contact: 'agente_ia',
        source_type: 'ai_agent',
        channel: linkChannel,
        status: 'pending',
        message_type: 'texto',
        execution_id: executionId,
        wa_phone_number_id: waPhoneIdForLink,
      });
      if (linkInsertError) {
        log.error('pending_link_insert_failed', { error: linkInsertError.message });
      } else {
        log.info('pending_link_sent', { text: ctx.__pending_link_text });
      }
    }

    // 11. Mark buffer as processed BEFORE releasing the lock.
    //     FIX-AGENT-DUP-03: order matters. The CAS filter (and the cron's
    //     `WHERE ai_processing_lock=false AND processed=false`) matches a buffer that is both
    //     unlocked AND unprocessed. If the lock were released first, a concurrent execution B
    //     could acquire it and re-read this still-unprocessed buffer in the gap → duplicate
    //     reply. Setting processed=true first closes that window: once true, B's read finds
    //     nothing to process even with the lock free.
    await supabase
      .from('message_buffer')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .in('id', bufferIds);

    // 12. Release lock after the buffer is marked processed.
    //     Still released before the cleanup steps below so a timeout there does not leave the
    //     lock stuck (the UI would otherwise show "responding" forever). Worst case if the
    //     function dies between steps 11 and 12 is a briefly-stuck lock, recovered by
    //     release_stale_ai_locks() (cron, every 10 min) — and never a duplicate, since the
    //     buffer is already processed=true.
    await supabase
      .from('clients_people')
      .update({ ai_processing_lock: false })
      .eq('id', peopleId);

    // 13. Trigger omni-delivery-engine directly (eliminates pg_cron latency ~30-60s)
    if (finalText && peopleId) {
      fetch(`${supabaseUrl}/functions/v1/omni-delivery-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ people_id: peopleId, trigger: 'ai_agent' }),
      }).catch(() => {});
    }

    // 14. Update execution log (final)
    await supabase
      .from('ai_agents_execution_log')
      .update({
        execution_status: 'completed',
        execution_duration_ms: durationMs,
        tools_used: toolsUsed,
        response_data: { text: finalText, usage: totalUsage, tool_call_details: toolCallDetails },
      })
      .eq('id', executionId ?? '');

    log.info('completed', { duration_ms: durationMs, tools_used: toolsUsed, paragraphs: finalText ? finalText.split(/\n\n+/).length : 0, execution_id: executionId ?? undefined });

    return new Response(
      JSON.stringify({ status: 'ok', duration_ms: durationMs, tools_used: toolsUsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const errorMessage = (err as Error).message;
    log.error('unhandled_error', { error: errorMessage, people_id: peopleId ?? undefined, agent_id: agentId ?? undefined, lead_id: leadId ?? undefined, elapsed_ms: Date.now() - startAt });

    // FIX-AGENT-DUP-03: release the lock but DO NOT mark the buffer processed on a transient
    // failure. The exception here is a network/LLM/runtime error, not a deterministic decision —
    // leaving processed=false keeps the message retryable on the next trigger (the CAS lock is
    // released below so the retry can re-acquire it). Marking processed=true here was the DUP-02
    // regression that silenced the agent on any failure (skip in test mode — no lock is set there).
    if (peopleId && !testMode) {
      await supabase
        .from('clients_people')
        .update({ ai_processing_lock: false })
        .eq('id', peopleId)
        .catch(e => log.silent('lock_release_failed', { people_id: peopleId, error: (e as Error).message }));
    }

    // Update execution log with error
    if (executionId) {
      await supabase
        .from('ai_agents_execution_log')
        .update({
          execution_status: 'error',
          execution_duration_ms: Date.now() - startAt,
          error_message: errorMessage,
        })
        .eq('id', executionId)
        .catch(e => log.silent('exec_log_update_failed', { execution_id: executionId, error: (e as Error).message }));
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
