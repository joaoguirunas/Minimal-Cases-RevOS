import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight, BookOpen, Database, Zap, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

// ── Collapsible module card ────────────────────────────────────────────────────
const ModuleCard = ({
  title,
  description,
  tables,
  features,
  edgeFunctions,
  hooks,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  tables: { name: string; purpose: string; key_columns: string }[];
  features: string[];
  edgeFunctions?: string[];
  hooks?: string[];
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{description}</p>
        </div>
        <span className="text-[10px] text-muted-foreground/40 shrink-0">
          {tables.length} tabelas
        </span>
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Features */}
          <div className="px-5 py-3 bg-muted border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
              Funcionalidades
            </p>
            <ul className="space-y-1">
              {features.map((f, i) => (
                <li key={i} className="text-[12px] text-muted-foreground flex items-start gap-2">
                  <span className="text-primary/60 mt-0.5">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Tables */}
          <div className="px-5 py-3 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-1.5">
              <Database className="w-3 h-3" /> Tabelas
            </p>
            <div className="space-y-2">
              {tables.map((t, i) => (
                <div key={i} className="text-[12px]">
                  <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-primary">
                    {t.name}
                  </code>
                  <span className="text-muted-foreground ml-2">— {t.purpose}</span>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 ml-0.5">
                    Colunas-chave: {t.key_columns}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Edge Functions */}
          {edgeFunctions && edgeFunctions.length > 0 && (
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                <Server className="w-3 h-3" /> Edge Functions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {edgeFunctions.map((fn, i) => (
                  <code
                    key={i}
                    className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground"
                  >
                    {fn}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Hooks */}
          {hooks && hooks.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Hooks (Frontend)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {hooks.map((h, i) => (
                  <code
                    key={i}
                    className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground"
                  >
                    {h}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Module data ────────────────────────────────────────────────────────────────
const MODULES = [
  {
    title: "BI PRO™ — Business Intelligence",
    description:
      "Dashboard analítico com KPIs de funil, RevOps, marketing attribution (Meta/Google Ads), insights IA e métricas comerciais.",
    features: [
      "KPIs de funil: leads, conversão, ticket médio, ciclo de venda",
      "RevOps: receita recorrente, pipeline velocity, forecast",
      "Marketing Attribution: integração Meta Ads e Google Ads com sync diário",
      "BI Insights Chat: perguntas em linguagem natural sobre dados do sistema via IA",
      "Comercial: performance por closer, taxa de show, taxa de conversão",
      "Filtros por período, pipeline e equipe",
    ],
    tables: [
      { name: "bi_ad_accounts", purpose: "Contas de anúncio conectadas (Meta/Google)", key_columns: "platform, account_id, access_token" },
      { name: "bi_ad_campaigns", purpose: "Campanhas de anúncio rastreadas", key_columns: "account_id, campaign_id, campaign_name, status" },
      { name: "bi_ad_daily_stats", purpose: "Métricas diárias de performance de ads", key_columns: "campaign_id, date, impressions, clicks, spend, conversions" },
      { name: "bi_sdr_targets", purpose: "Metas de performance SDR", key_columns: "user_id, metric, target_value, period" },
    ],
    edgeFunctions: ["bi-insights-chat", "bi-sync-meta-ads", "bi-sync-google-ads", "bi-meta-oauth", "bi-google-oauth"],
    hooks: ["useBIProKPIs", "useBIProFunnel", "useBIProRevOps", "useBIProAttribution", "useBIProCRM", "useBIProOmni", "useBIProSends", "useBIProSchedules", "useBIProAdAccounts"],
  },
  {
    title: "CRM PRO™ — Gestão de Negócios",
    description:
      "Pipeline Kanban/Lista com stages customizáveis, campos extras, scoring de leads, automação de follow-ups, qualificação IA e notas.",
    features: [
      "Kanban board drag-and-drop com stages customizáveis",
      "Vista de lista com filtros avançados e busca",
      "Campos extras (custom fields) por pipeline",
      "Score de leads com matrizes configuráveis",
      "Follow-ups automáticos por stage/status",
      "Motivos de perda configuráveis com analytics",
      "Notas e arquivos por negócio",
      "Atribuição automática de leads por equipe",
      "Audit trail de mudanças de stage (leads_updates)",
    ],
    tables: [
      { name: "leads", purpose: "Negócios/deals do CRM", key_columns: "id, title, status, value, people_id, leads_pipelines_id, leads_stages_id, user_id, utm_source, gclid, fbclid" },
      { name: "leads_pipelines", purpose: "Definição de pipelines", key_columns: "id, name, order_index" },
      { name: "leads_stages", purpose: "Stages dentro de cada pipeline", key_columns: "id, name, order_index, leads_pipelines_id" },
      { name: "leads_updates", purpose: "Audit trail de mudanças de stage/status", key_columns: "lead_id, user_id, from_stage_id, to_stage_id, notes" },
      { name: "leads_loss_reasons", purpose: "Motivos de perda", key_columns: "id, name" },
      { name: "leads_notes", purpose: "Notas e atividades por lead", key_columns: "lead_id, user_id, content" },
      { name: "leads_files", purpose: "Arquivos anexos", key_columns: "lead_id, file_name, file_path" },
      { name: "lead_field_definitions", purpose: "Schema de campos extras", key_columns: "id, name, type, is_required" },
      { name: "lead_field_values", purpose: "Valores de campos extras por lead", key_columns: "lead_id, field_definition_id, value" },
    ],
    hooks: ["useNegocios", "useNegociosPaginados", "useLeads", "useLeadFieldValues", "useLeadFieldDefinitions", "useFollowups", "useUpdateNegocioStage"],
  },
  {
    title: "OMNI PRO™ — Comunicação Multicanal",
    description:
      "Hub unificado de conversas WhatsApp, Instagram, Email e SMS com respostas automáticas IA, respostas rápidas e deduplicação de contatos.",
    features: [
      "Inbox unificado com todos os canais (WhatsApp, Instagram, Email, SMS)",
      "Agentes IA para resposta automática com humanização",
      "Respostas rápidas (canned responses) com categorias",
      "Sidebar de contexto com dados do contato e negócio",
      "Deduplicação inteligente de contatos (merge)",
      "Status de entrega: enviado, entregue, lido",
      "Buffer de mensagens para agrupamento de respostas IA",
      "Suporte a mídia (imagens, áudio, documentos)",
    ],
    tables: [
      { name: "messages", purpose: "Log unificado de mensagens de todos os canais", key_columns: "id, content, channel, message_type, lead_id, people_id, status, wa_message_id, ig_message_id" },
      { name: "message_buffer", purpose: "Staging temporário de mensagens", key_columns: "id, lead_id, content" },
      { name: "canned_responses", purpose: "Respostas rápidas pré-escritas", key_columns: "id, title, content, category" },
      { name: "whatsapp_templates", purpose: "Templates de mensagem WhatsApp aprovados", key_columns: "id, name, content, is_approved" },
      { name: "settings_whatsapp_channels", purpose: "Canais WhatsApp Business API conectados", key_columns: "business_account_id, phone_number_id, access_token" },
    ],
    edgeFunctions: ["whatsapp-inbound", "whatsapp-outbound", "whatsapp-templates-manage", "whatsapp-templates-sync", "instagram-outbound", "instagram-comment-reply", "instagram-comment-like", "instagram-token-refresh", "instagram-automation-runner", "instagram-oauth", "meta-inbound", "omni-channel-health-check", "omni-delivery-engine", "omni-merge-person", "omni-retry-dead-letter"],
    hooks: ["useConversas", "useConversasPaginadas", "useConversasPessoas", "useOmniChannelHealth", "useOmniChannelConfig", "useOmniDeadLetter", "useOmniMensagens"],
  },
  {
    title: "SENDS PRO™ — Campanhas de Disparo",
    description:
      "Envio em massa via WhatsApp, Email e SMS com filtros visuais avançados, controle de status e analytics de entrega.",
    features: [
      "Criação de campanhas com filtro visual de contatos",
      "Envio via WhatsApp (templates), Email e SMS",
      "Tracking de status: enviado, entregue, lido, erro",
      "Retry automático com contagem de tentativas",
      "Analytics: taxa de entrega, leitura e bounce",
      "Agendamento de envios programados",
    ],
    tables: [
      { name: "sends", purpose: "Campanhas de disparo", key_columns: "id, name, status, channel, total_contacts, sent_count, delivered_count, read_count" },
      { name: "sends_contacts", purpose: "Status individual de cada contato por envio", key_columns: "send_id, contact_id, status, sent_at, delivered_at, read_at, retry_count" },
    ],
    edgeFunctions: ["send-dispatch-worker", "send-status-callback", "filter-leads-for-send", "channel-test-send"],
    hooks: ["useSends", "useSendContacts", "useSendMutations", "useSendContactMutations"],
  },
  {
    title: "SCHEDULE PRO™ — Agendamentos",
    description:
      "Sistema de reuniões com integração Google Calendar e MS Teams, distribuição automática de slots e link público de booking.",
    features: [
      "Calendário visual (semanal e mensal)",
      "Integração bidirecional com Google Calendar",
      "Integração com Microsoft Teams",
      "Distribuição automática de horários por equipe (round-robin)",
      "Link público de agendamento (booking page)",
      "Follow-ups automáticos pós-reunião",
      "Tracking de show rate por closer",
      "Confirmação automática via WhatsApp/Email",
    ],
    tables: [
      { name: "meetings", purpose: "Eventos de reunião", key_columns: "id, title, start_time, end_time, status, outcome, lead_id, people_id, user_id, google_event_id" },
      { name: "meetings_followups", purpose: "Follow-ups pós-reunião", key_columns: "meeting_id, content, status, due_at" },
      { name: "meeting_followup_queue", purpose: "Fila de follow-ups agendados", key_columns: "meeting_id, scheduled_for, content, status" },
      { name: "booking_rule_sets", purpose: "Regras de booking automatizado", key_columns: "id, name, config" },
      { name: "user_calendar_connections", purpose: "Conexões Google Calendar por usuário", key_columns: "user_id, calendar_id, access_token, refresh_token" },
    ],
    edgeFunctions: ["google-cal-connect", "google-cal-availability", "google-cal-pull-event", "google-cal-sync-events", "google-cal-sync-to-db", "google-cal-upsert-event", "ms-teams-connect", "ms-teams-upsert-event", "public-booking", "process-meeting-followups", "meeting-followup-auto-setup", "send-meeting-confirmation"],
    hooks: ["useMeetingRecords", "useMeetingSingle", "useBookingRuleSets", "useCalendarConnectedUsers", "useGoogleCalendarStatus", "useGoogleCalendarEvents"],
  },
  {
    title: "FORM PRO™ — Landing Pages & Formulários",
    description:
      "Builder de formulários e landing pages com catálogo de templates, integração Meta Lead Ads e rastreamento UTM completo.",
    features: [
      "Form builder visual drag-and-drop",
      "Catálogo de templates pré-prontos",
      "Publicação de formulários com link público",
      "Integração Meta Lead Ads (webhook automático)",
      "Rastreamento UTM completo (source, medium, campaign, content, term)",
      "Captura de gclid/fbclid para attribution",
      "Submissões com dados JSON flexíveis",
    ],
    tables: [
      { name: "form_pro_forms", purpose: "Definição de formulários/landing pages", key_columns: "id, name, description, form_config, fields" },
      { name: "form_pro_submissions", purpose: "Submissões de formulários", key_columns: "form_id, lead_id, submission_data, gclid, fbclid, meta_form_id, submitted_at" },
      { name: "meta_lead_form_pages", purpose: "Páginas Facebook com Lead Ads", key_columns: "page_id, page_name, access_token, subscribed" },
      { name: "meta_lead_forms", purpose: "Formulários Meta Lead Ads sincronizados", key_columns: "meta_form_id, name, status, field_mapping, pipeline_id" },
    ],
    edgeFunctions: ["lp-submit", "meta-leadgen-create", "meta-leadgen-sync", "meta-pages-list", "meta-pages-subscribe"],
    hooks: ["useLpForms", "useLpFormCatalog", "useMetaLeadForms"],
  },
  {
    title: "SCORE PRO™ — Scoring de Leads",
    description:
      "Motor de scoring configurável com categorias, itens de pontuação e matrizes atribuíveis a agentes IA.",
    features: [
      "Categorias de scoring com peso configurável",
      "Itens de pontuação por categoria",
      "Matrizes de scoring atribuíveis a agentes IA",
      "Score visível no sidebar de conversas e CRM",
      "Distribuição de scores (0-25, 26-50, 51-75, 76-100)",
    ],
    tables: [
      { name: "score_categories", purpose: "Dimensões de scoring", key_columns: "id, name, description" },
      { name: "score_category_items", purpose: "Critérios individuais de pontuação", key_columns: "category_id, name, score_value" },
      { name: "score_matrix", purpose: "Conjuntos de regras de scoring", key_columns: "id, name, description" },
    ],
    hooks: ["useScoreMatrix"],
  },
  {
    title: "Agentes IA — Automação Inteligente",
    description:
      "Agentes de texto e voz (ElevenLabs) com prompt blocks, ferramentas, humanização, buffer de mensagens e histórico de execução.",
    features: [
      "Agentes de texto e voz (ElevenLabs TTS)",
      "Prompt blocks editáveis com versionamento",
      "Ferramentas (tools) configuráveis por agente",
      "Humanização de respostas com delays configuráveis",
      "Buffer de mensagens para agrupar respostas",
      "Qualificação automática de leads (26 campos Q1-Q26)",
      "Integração com score matrix para pontuação",
      "Histórico de execução com tokens e custo",
      "Suporte a múltiplos providers LLM (OpenAI, Anthropic)",
    ],
    tables: [
      { name: "ai_agents", purpose: "Configuração de agentes IA", key_columns: "id, name, agent_type, voice_enabled, llm_provider, llm_model, prompt_blocks, enabled_tools, channel_types" },
      { name: "ai_agents_execution_log", purpose: "Log de execuções de agentes", key_columns: "ai_agent_id, lead_id, prompt, response, tokens_used, cost, status" },
      { name: "ai_agents_history", purpose: "Histórico de versões de agentes", key_columns: "ai_agent_id, version, config" },
      { name: "ai_agents_score_matrix", purpose: "Matrizes de scoring por agente", key_columns: "ai_agent_id, score_matrix_id" },
      { name: "settings_ai_providers", purpose: "Credenciais de providers LLM", key_columns: "name, provider, credentials" },
      { name: "settings_elevenlabs", purpose: "Configuração ElevenLabs TTS", key_columns: "api_key, config" },
    ],
    edgeFunctions: ["ai-agent-execute", "elevenlabs-agent-sync", "elevenlabs-sync", "elevenlabs-tts"],
    hooks: ["useAgentesIA", "useAgentesIAReal", "useAgentEligibility", "useElevenLabsConfig", "useElevenLabsTTS"],
  },
  {
    title: "Conversões — Tracking de Ads",
    description:
      "Regras flexíveis de conversão para Meta CAPI e Google Ads com triggers por stage, status ou booking e fila assíncrona.",
    features: [
      "Regras de conversão configuráveis por stage, status ou booking",
      "Integração Meta Conversions API (CAPI) com pixel_id",
      "Integração Google Ads Offline Conversions",
      "Fila assíncrona de eventos com retry",
      "Hashing de email e telefone (SHA256) para matching",
      "Fire-and-forget edge function para envio",
      "Captura de gclid, fbclid, fbc, fbp para attribution",
    ],
    tables: [
      { name: "conversion_event_rules", purpose: "Regras de conversão (triggers flexíveis)", key_columns: "trigger_type, trigger_config, meta_enabled, meta_pixel_id, google_enabled, google_conversion_action_id" },
      { name: "conversion_events_queue", purpose: "Fila de eventos de conversão para processamento", key_columns: "lead_id, event_data, meta_status, google_status, retry_count" },
      { name: "conversion_platform_credentials", purpose: "Credenciais de plataformas de ads", key_columns: "platform, credentials, is_active" },
    ],
    edgeFunctions: ["conversion-send", "conversion-fetch-platforms"],
    hooks: ["useConversionConfig", "useConversionEvents"],
  },
  {
    title: "Pessoas & Empresas — Base de Contatos",
    description:
      "Cadastro de contatos com 26 campos de qualificação IA, enriquecimento social, merge/dedup e vínculo com empresas.",
    features: [
      "Cadastro completo com dados pessoais, profissionais e sociais",
      "26 campos de qualificação IA (Q1-Q26): gargalo, volume, equipe, maturidade CRM, budget, timeline, etc.",
      "DISC profile automático por conversa",
      "Enriquecimento social: Instagram, Facebook, LinkedIn, YouTube, Google Maps",
      "Merge/deduplicação com histórico",
      "Score individual com score_matrix_id",
      "Vínculo N:N com empresas",
    ],
    tables: [
      { name: "clients_people", purpose: "Base de contatos principal", key_columns: "id, name, email, whatsapp, status, score, score_matrix_id, instagram_handle, disc" },
      { name: "clients_companies", purpose: "Cadastro de empresas", key_columns: "id, trade_name, legal_name, tax_id, email, phone, website" },
      { name: "clients_people_companies", purpose: "Vínculo N:N pessoas ↔ empresas", key_columns: "people_id, company_id, role" },
      { name: "clients_people_updates", purpose: "Audit trail de mudanças em contatos", key_columns: "people_id, changed_field, old_value, new_value" },
    ],
    hooks: ["usePessoas", "usePessoasPaginadas", "usePessoasReal", "useCriarPessoa", "useAtualizarPessoa"],
  },
  {
    title: "Configurações do Sistema",
    description:
      "Gerenciamento de usuários, equipes, módulos, integrações, webhooks, providers IA e configurações gerais do tenant.",
    features: [
      "Configurações gerais: nome, logo, timezone, moeda, idioma",
      "Gerenciamento de usuários com roles (admin, gestor, operador)",
      "Equipes com atribuição de membros",
      "Módulos ativáveis/desativáveis (feature toggles)",
      "Integrações centralizadas (Google, Meta, WhatsApp, Instagram)",
      "Webhooks configuráveis com logs de entrega",
      "Providers IA (OpenAI, Anthropic) com credenciais",
      "Logs de sistema com viewer",
    ],
    tables: [
      { name: "settings", purpose: "Configurações globais do sistema", key_columns: "company_name, timezone, language, currency" },
      { name: "settings_users", purpose: "Perfis de usuário do sistema", key_columns: "auth_user_id, name, email, role, active" },
      { name: "settings_teams", purpose: "Equipes/departamentos", key_columns: "id, name, description" },
      { name: "settings_users_teams", purpose: "Membership usuário ↔ equipe", key_columns: "user_id, team_id" },
      { name: "settings_system_modules", purpose: "Feature toggles de módulos", key_columns: "module_name, enabled" },
      { name: "webhooks", purpose: "Definições de webhooks", key_columns: "name, url, events, active" },
      { name: "webhook_logs", purpose: "Logs de entrega de webhooks", key_columns: "webhook_id, event, payload, response, status" },
    ],
    hooks: ["useSettings", "useConfiguracoesGerais", "useSystemModules", "useUserPermissions", "useWebhooks"],
  },
];

// ── Generate MD ────────────────────────────────────────────────────────────────
function generateMarkdown(): string {
  const lines: string[] = [];
  lines.push("# GrowthSales App — Documentação Completa do Sistema");
  lines.push("");
  lines.push("## Visão Geral");
  lines.push("");
  lines.push(
    "GrowthSales é uma plataforma B2B de aceleração de vendas com arquitetura modular. " +
    "Stack: React + TypeScript (frontend), Supabase (PostgreSQL + Edge Functions + Auth + Realtime + Storage), " +
    "Vercel (deploy). Multi-tenant, multi-equipe, com integrações Meta, Google, WhatsApp Business API, " +
    "Instagram, ElevenLabs e providers LLM (OpenAI, Anthropic)."
  );
  lines.push("");
  lines.push("## Arquitetura");
  lines.push("");
  lines.push("- **Frontend:** React 18 + Vite + TailwindCSS + shadcn/ui + React Query + React Router");
  lines.push("- **Backend:** Supabase Edge Functions (Deno/TypeScript) + PostgreSQL + RLS + Realtime");
  lines.push("- **Auth:** Supabase Auth (email/password + OAuth Meta/Google/Microsoft)");
  lines.push("- **Storage:** Supabase Storage (logos, arquivos, gravações)");
  lines.push("- **Deploy:** Vercel (auto-deploy from main branch)");
  lines.push("- **Integrações:** Meta Business API, Google Ads/Calendar, ElevenLabs, ActivSystem (telefonia)");
  lines.push("");
  lines.push("## Módulos do Sistema");
  lines.push("");

  for (const mod of MODULES) {
    lines.push(`### ${mod.title}`);
    lines.push("");
    lines.push(mod.description);
    lines.push("");
    lines.push("**Funcionalidades:**");
    for (const f of mod.features) {
      lines.push(`- ${f}`);
    }
    lines.push("");
    lines.push("**Tabelas:**");
    lines.push("");
    lines.push("| Tabela | Descrição | Colunas-chave |");
    lines.push("|--------|-----------|---------------|");
    for (const t of mod.tables) {
      lines.push(`| \`${t.name}\` | ${t.purpose} | ${t.key_columns} |`);
    }
    lines.push("");

    if (mod.edgeFunctions && mod.edgeFunctions.length > 0) {
      lines.push(`**Edge Functions:** ${mod.edgeFunctions.map((f) => "`" + f + "`").join(", ")}`);
      lines.push("");
    }

    if (mod.hooks && mod.hooks.length > 0) {
      lines.push(`**Hooks (Frontend):** ${mod.hooks.map((h) => "`" + h + "`").join(", ")}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  lines.push("## Banco de Dados — Funções Importantes");
  lines.push("");
  lines.push("| Função | Descrição |");
  lines.push("|--------|-----------|");
  lines.push("| `get_insights_context()` | Retorna JSON completo com dados de todos os módulos para BI Insights Chat |");
  lines.push("| `track_leads_changes()` | Trigger que registra mudanças de stage/status em leads_updates |");
  lines.push("| `fn_queue_conversion_event()` | Trigger que enfileira eventos de conversão quando leads mudam de stage |");
  lines.push("| `fn_queue_conversion_booking()` | Trigger que enfileira eventos quando status de reunião muda |");
  lines.push("");

  lines.push("## Rotas da Aplicação");
  lines.push("");
  lines.push("| Rota | Módulo |");
  lines.push("|------|--------|");
  lines.push("| `/bipro` | BI PRO™ |");
  lines.push("| `/crm/kanban`, `/crm/list` | CRM PRO™ |");
  lines.push("| `/omni` | OMNI PRO™ |");
  lines.push("| `/send` | SENDS PRO™ |");
  lines.push("| `/call` | CALL PRO™ |");
  lines.push("| `/schedule` | SCHEDULE PRO™ |");
  lines.push("| `/lp` | FORM PRO™ |");
  lines.push("| `/score` | SCORE PRO™ |");
  lines.push("| `/settings/*` | Configurações |");
  lines.push("| `/adm` | ADM (Super Admin) |");
  lines.push("| `/f/:formId` | Formulário Público |");
  lines.push("| `/agendar/:leadId` | Booking Público |");
  lines.push("");

  lines.push("## Configurações Disponíveis (Settings)");
  lines.push("");
  lines.push("| Área | Seções |");
  lines.push("|------|--------|");
  lines.push("| CRM PRO™ | Pipelines, Motivos de Perda, Follow-ups, Campos Extras, Score, Agentes IA, Conversões |");
  lines.push("| OMNI PRO™ | WhatsApp, Email, Instagram, SMS, Call, Dedup Health |");
  lines.push("| SCHEDULE PRO™ | Distribuição de Horários |");
  lines.push("| Geral | Config Geral, Usuários, Times, Módulos, Integrações, Logs, Documentação |");
  lines.push("");

  lines.push("---");
  lines.push("*Gerado automaticamente pela página de Documentação do Sistema — GrowthSales App*");

  return lines.join("\n");
}

// ── Main Component ─────────────────────────────────────────────────────────────
const SystemDocConfig = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const md = generateMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("Markdown copiado para o clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Erro ao copiar. Tente novamente.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Documentação do Sistema
          </h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            Mapa completo de módulos, funcionalidades, banco de dados e configurações.
          </p>
        </div>
        <Button
          size="sm"
          variant={copied ? "default" : "outline"}
          onClick={handleCopy}
          className={cn("gap-1.5 transition-all", copied && "bg-emerald-600 hover:bg-emerald-600 text-white")}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copiar MD completo
            </>
          )}
        </Button>
      </div>

      {/* Architecture overview */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        <SectionHeader title="Arquitetura" />
        <div className="px-5 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <span className="text-muted-foreground/60">Frontend:</span>{" "}
              <span className="text-foreground">React 18 + Vite + TailwindCSS + shadcn/ui</span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Backend:</span>{" "}
              <span className="text-foreground">Supabase Edge Functions (Deno)</span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Database:</span>{" "}
              <span className="text-foreground">PostgreSQL + RLS + Realtime</span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Deploy:</span>{" "}
              <span className="text-foreground">Vercel (auto-deploy from main)</span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Auth:</span>{" "}
              <span className="text-foreground">Supabase Auth (email + OAuth)</span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Integrações:</span>{" "}
              <span className="text-foreground">Meta, Google, ElevenLabs, ActivSystem</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Módulos", value: String(MODULES.length) },
          { label: "Tabelas", value: String(MODULES.reduce((acc, m) => acc + m.tables.length, 0)) + "+" },
          { label: "Edge Functions", value: "67" },
          { label: "Hooks", value: "180+" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border border-border rounded-[2px] px-4 py-3 text-center"
          >
            <p className="text-[20px] font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground/60">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div>
        <SectionHeader title="Módulos do Sistema" />
        <div className="mt-3 space-y-2">
          {MODULES.map((mod) => (
            <ModuleCard key={mod.title} {...mod} />
          ))}
        </div>
      </div>

      {/* DB Functions */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        <SectionHeader title="Funções de Banco (Triggers & Stored Procedures)" />
        <div className="divide-y divide-border/30">
          {[
            { name: "get_insights_context()", desc: "Retorna JSON completo com dados de todos os módulos para BI Insights Chat" },
            { name: "track_leads_changes()", desc: "Trigger que registra mudanças de stage/status em leads_updates" },
            { name: "fn_queue_conversion_event()", desc: "Trigger que enfileira eventos de conversão quando leads mudam de stage" },
            { name: "fn_queue_conversion_booking()", desc: "Trigger que enfileira eventos quando status de reunião muda" },
          ].map((fn) => (
            <div key={fn.name} className="px-5 py-3">
              <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-primary">
                {fn.name}
              </code>
              <p className="text-[12px] text-muted-foreground mt-1">{fn.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground/40 text-center pb-4">
        Use o botão "Copiar MD completo" para colar em outras IAs como contexto do sistema.
      </p>
    </div>
  );
};

export default SystemDocConfig;
