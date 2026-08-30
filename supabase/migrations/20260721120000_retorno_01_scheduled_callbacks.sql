-- RETORNO-01 — Tool "Agendar Retorno": fila dedicada + config por agente/step.
--
-- ADR: docs/smart-memory/decisions/ADR-RETORNO-01-agendar-retorno-arquitetura.md (D1, D2).
-- Cria:
--   1. public.ai_scheduled_callbacks   — fila de retornos ad-hoc agendados pelo agente de IA
--   2. public.ai_agent_callback_configs — config da tool por agente (step_id NULL = default)
--
-- NÃO altera followup_queue nem messages_source_type_check (D5): o worker grava
-- source_type='ai_agent' com metadata.origin='ai_callback'.
--
-- Live-verified (2026-07-21, wotuyxscsfralqpoiyfv):
--   leads.id / clients_people.id / ai_agents.id / ai_agents_steps.id = uuid; messages.id = bigint;
--   settings_users(active boolean, deleted_at timestamptz, super_admin boolean, user_type text
--   CHECK IN ('admin','manager','user')) — usa 'manager', NÃO 'gestor' (bug KFY-1.1).
--   public.update_updated_at_column() existe.
--
-- Apply: supabase db query --linked --file <this> ; registrar em schema_migrations.

BEGIN;

-- ── 1. Fila de retornos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_scheduled_callbacks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  people_id             uuid NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  agent_id              uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  step_id               uuid REFERENCES public.ai_agents_steps(id) ON DELETE SET NULL,

  scheduled_for         timestamptz NOT NULL,
  mode                  text NOT NULL CHECK (mode IN ('direct','agent')),

  template_id           text,
  message_text          text,
  whatsapp_template_name text,

  reason                text NOT NULL,
  channel               text NOT NULL DEFAULT 'whatsapp',

  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','processing','sent','failed','cancelled','skipped')),
  fired_at              timestamptz,
  cancelled_at          timestamptz,
  cancel_reason         text,

  message_id            bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  error_message         text,
  retry_count           integer NOT NULL DEFAULT 0,
  response_data         jsonb,

  created_by_execution_id uuid,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Invariante: no máximo 1 retorno pendente por lead. Reagendar = UPDATE do pendente.
CREATE UNIQUE INDEX IF NOT EXISTS ai_scheduled_callbacks_one_pending_per_lead
  ON public.ai_scheduled_callbacks(lead_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_due
  ON public.ai_scheduled_callbacks(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_people
  ON public.ai_scheduled_callbacks(people_id);
CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_status
  ON public.ai_scheduled_callbacks(status);

DROP TRIGGER IF EXISTS ai_scheduled_callbacks_set_updated_at ON public.ai_scheduled_callbacks;
CREATE TRIGGER ai_scheduled_callbacks_set_updated_at
  BEFORE UPDATE ON public.ai_scheduled_callbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. Config da tool por agente/step ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_agent_callback_configs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                  uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  step_id                   uuid REFERENCES public.ai_agents_steps(id) ON DELETE CASCADE,

  enabled                   boolean NOT NULL DEFAULT false,
  default_mode              text NOT NULL DEFAULT 'direct'
                              CHECK (default_mode IN ('direct','agent')),
  allow_agent_choose_mode   boolean NOT NULL DEFAULT false,
  allow_free_text           boolean NOT NULL DEFAULT false,

  templates                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  free_prompt               text,
  whatsapp_template_fallback text,

  min_delay_minutes         integer NOT NULL DEFAULT 5,
  max_delay_hours           integer NOT NULL DEFAULT 720,
  cancel_on_resume          boolean NOT NULL DEFAULT true,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_agent_callback_configs_agent_step_key UNIQUE (agent_id, step_id)
);

-- UNIQUE(agent_id, step_id) não cobre step_id NULL (NULL nunca colide no Postgres):
-- índice parcial garante 1 única config default por agente.
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_callback_configs_default_per_agent
  ON public.ai_agent_callback_configs(agent_id) WHERE step_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_agent_callback_configs_agent
  ON public.ai_agent_callback_configs(agent_id);

DROP TRIGGER IF EXISTS ai_agent_callback_configs_set_updated_at ON public.ai_agent_callback_configs;
CREATE TRIGGER ai_agent_callback_configs_set_updated_at
  BEFORE UPDATE ON public.ai_agent_callback_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. RLS (SELECT = settings_users ativo; WRITE = super_admin/manager ou service_role) ──
DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_scheduled_callbacks','ai_agent_callback_configs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS "ai_callbacks_select_active_users" ON public.%I;', t);
    EXECUTE format($p$
      CREATE POLICY "ai_callbacks_select_active_users" ON public.%I
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid()
                    AND su.active = true
                    AND su.deleted_at IS NULL)
        );$p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "ai_callbacks_write_managers" ON public.%I;', t);
    EXECUTE format($p$
      CREATE POLICY "ai_callbacks_write_managers" ON public.%I
        FOR ALL USING (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid()
                    AND su.active = true AND su.deleted_at IS NULL
                    AND (su.super_admin = true OR su.user_type = 'manager'))
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid()
                    AND su.active = true AND su.deleted_at IS NULL
                    AND (su.super_admin = true OR su.user_type = 'manager'))
        );$p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "ai_callbacks_service_role" ON public.%I;', t);
    EXECUTE format($p$
      CREATE POLICY "ai_callbacks_service_role" ON public.%I
        FOR ALL USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');$p$, t);
  END LOOP;
END
$rls$;

-- ── 4. Comments ───────────────────────────────────────────────────────────────
COMMENT ON TABLE public.ai_scheduled_callbacks IS
  'Fila de retornos ad-hoc agendados pelo agente de IA (tool agendar_retorno). Consumida pelo ai-callback-worker via pg_cron. Não confundir com followup_queue (regras de etapa/reunião).';
COMMENT ON COLUMN public.ai_scheduled_callbacks.scheduled_for IS
  'Momento do disparo (UTC). Nome alinhado ao followup_queue LIVE para consistência operacional.';
COMMENT ON COLUMN public.ai_scheduled_callbacks.mode IS
  'direct = envia template/texto pré-definido sem LLM; agent = reinvoca ai-agent-execute (stage_trigger) no horário.';
COMMENT ON COLUMN public.ai_scheduled_callbacks.template_id IS
  'id do template escolhido dentro de ai_agent_callback_configs.templates (não é FK).';
COMMENT ON COLUMN public.ai_scheduled_callbacks.message_text IS
  'Texto livre redigido pelo agente (só aceito quando a config tem allow_free_text = true).';
COMMENT ON COLUMN public.ai_scheduled_callbacks.whatsapp_template_name IS
  'Template aprovado da Meta usado quando a janela de 24h está fechada (D6 do ADR).';
COMMENT ON COLUMN public.ai_scheduled_callbacks.reason IS
  'Motivo informado pelo lead/agente; vai para o log e para o prompt de reinvocação em modo agent.';
COMMENT ON COLUMN public.ai_scheduled_callbacks.channel IS
  'Canal da conversa de origem (whatsapp/instagram/...), usado no INSERT em messages.';
COMMENT ON COLUMN public.ai_scheduled_callbacks.status IS
  'pending → processing (claim atômico CAS pelo worker) → sent | failed | cancelled | skipped. Só 1 pending por lead (índice parcial ai_scheduled_callbacks_one_pending_per_lead).';
COMMENT ON COLUMN public.ai_scheduled_callbacks.message_id IS
  'FK para messages.id (bigint) da mensagem efetivamente enfileirada no disparo direct.';
COMMENT ON COLUMN public.ai_scheduled_callbacks.retry_count IS
  'Tentativas de disparo já feitas pelo worker (máx. 3 conforme ADR).';
COMMENT ON COLUMN public.ai_scheduled_callbacks.response_data IS
  'Payload bruto da resposta do caminho de envio (omni-delivery-engine / ai-agent-execute) para debug.';
COMMENT ON COLUMN public.ai_scheduled_callbacks.created_by_execution_id IS
  'id da execução do agente (ai_agents_history) que criou este retorno.';
COMMENT ON INDEX public.ai_scheduled_callbacks_one_pending_per_lead IS
  'Invariante D1: no máximo 1 retorno pendente por lead. Reagendar é UPDATE do pendente, nunca segundo INSERT.';

COMMENT ON TABLE public.ai_agent_callback_configs IS
  'Config da tool agendar_retorno por agente (D2 do ADR). Gate de exposição da tool: enabled = true. ai_agents.enabled_tools NÃO é usada.';
COMMENT ON COLUMN public.ai_agent_callback_configs.step_id IS
  'NULL = config default do agente; preenchido = override para o step específico. Unicidade do default garantida por ai_agent_callback_configs_default_per_agent.';
COMMENT ON COLUMN public.ai_agent_callback_configs.enabled IS
  'Quando false, as tools agendar_retorno/cancelar_retorno não são injetadas em buildToolDefinitions().';
COMMENT ON COLUMN public.ai_agent_callback_configs.default_mode IS
  'Modo aplicado quando o agente não escolhe (ou não pode escolher) — direct | agent.';
COMMENT ON COLUMN public.ai_agent_callback_configs.allow_agent_choose_mode IS
  'Se false, o parâmetro modo enviado pelo LLM é ignorado e vale default_mode.';
COMMENT ON COLUMN public.ai_agent_callback_configs.allow_free_text IS
  'Se false, o parâmetro mensagem (texto livre) do LLM é rejeitado; só template_id é aceito.';
COMMENT ON COLUMN public.ai_agent_callback_configs.templates IS
  'Array JSON de templates permitidos: [{id, label, body, whatsapp_template_name?}].';
COMMENT ON COLUMN public.ai_agent_callback_configs.free_prompt IS
  'Instrução injetada na reinvocação do agente em modo agent.';
COMMENT ON COLUMN public.ai_agent_callback_configs.whatsapp_template_fallback IS
  'Template aprovado usado quando o retorno cai fora da janela de 24h; obrigatório na prática para retornos > 23h.';
COMMENT ON COLUMN public.ai_agent_callback_configs.min_delay_minutes IS
  'Clamp inferior do scheduled_for validado no handler da tool.';
COMMENT ON COLUMN public.ai_agent_callback_configs.max_delay_hours IS
  'Clamp superior do scheduled_for (default 720h = 30 dias).';
COMMENT ON COLUMN public.ai_agent_callback_configs.cancel_on_resume IS
  'Se true, o retorno pendente deve ser cancelado quando o lead retoma a conversa (decisão do LLM via cancelar_retorno).';

COMMIT;

-- ── Rollback (ver rollbacks/20260721120000_retorno_01_scheduled_callbacks.rollback.sql) ──
-- BEGIN;
--   DROP TABLE IF EXISTS public.ai_scheduled_callbacks CASCADE;
--   DROP TABLE IF EXISTS public.ai_agent_callback_configs CASCADE;
-- COMMIT;
