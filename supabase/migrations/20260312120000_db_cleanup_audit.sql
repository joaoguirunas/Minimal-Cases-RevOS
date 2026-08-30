-- ================================================================
-- MIGRATION: 20260312120000_db_cleanup_audit.sql
-- Auditoria completa de 2026-03-12 — remoção de sujeiras do banco
-- ================================================================
-- BLOCOS:
--   1. Funções órfãs do LP PRO (tabelas origem droppadas em 20260310)
--   2. book_meeting() overload legado (colunas date/time não existem mais)
--   3. get_available_slots() — status 'cancelada' legado pré-P7
--   4. handle_meeting_followup_queue() — mapeamentos de status pré-P7
--   5. Tabelas administrativas vazias (resíduo multi-tenant removido)
--   6. user_roles + has_role() + app_role (nunca utilizados)
--   7. _meta_debug — habilitar RLS (única tabela sem RLS no schema)
--   8. Sistema Score legado (3 tabelas + colunas + trigger + funções)
--   9. FK sem índice — adicionar índices faltantes
--  10. Índices com nomenclatura pré-P6 (users_id → user_id)
--  11. Índices em colunas Q sem uso
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- BLOCO 1 — Funções órfãs do LP PRO
-- As tabelas lp_ab_variants, lp_ab_sessions, lp_ab_conversions,
-- lp_form_submissions e lp_page_analytics foram droppadas na
-- migration 20260310000000_form_pro_drop_lp_pages-ok.sql
-- Essas funções retornam erro se chamadas.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_ab_variant(text, uuid);
DROP FUNCTION IF EXISTS public.get_ab_variant_stats(uuid);
DROP FUNCTION IF EXISTS public.get_lp_page_summary(uuid, integer);


-- ────────────────────────────────────────────────────────────────
-- BLOCO 2 — book_meeting() overload legado
-- A assinatura (uuid, uuid, text, timestamptz, int, text) tenta inserir
-- em colunas date DATE + start_time TIME + end_time TIME que não existem
-- mais em meetings (somente start_time/end_time TIMESTAMPTZ).
-- O overload novo (uuid, timestamptz, timestamptz, uuid, int, text)
-- permanece intacto.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.book_meeting(
  p_lead_id            uuid,
  p_user_id            uuid,
  p_title              text,
  p_start_ts           timestamp with time zone,
  p_duration_minutes   integer,
  p_notes              text
);


-- ────────────────────────────────────────────────────────────────
-- BLOCO 3 — get_available_slots(): remover 'cancelada' (legado pré-P7)
-- P7 canonicalizou para 'cancelado'. O valor 'cancelada' não pode mais
-- existir no banco, mas permanecia no filtro NOT IN.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_user_id      uuid,
  p_date         date,
  p_period       text    DEFAULT NULL,
  p_slot_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dow          INT;
  v_user_name    TEXT;
  v_result       JSONB := '[]'::JSONB;
  v_period_start TIME;
  v_period_end   TIME;
  rec            RECORD;
  v_cursor       TIME;
  v_slot_end     TIME;
  v_is_free      BOOLEAN;
BEGIN
  IF p_slot_minutes < 15 OR p_slot_minutes > 480 THEN
    RAISE EXCEPTION 'p_slot_minutes must be between 15 and 480';
  END IF;

  SELECT name INTO v_user_name
  FROM settings_users
  WHERE id = p_user_id AND active = TRUE AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  v_dow := EXTRACT(DOW FROM p_date)::INT;

  IF p_period = 'morning' THEN
    v_period_start := '08:00'::TIME;
    v_period_end   := '12:00'::TIME;
  ELSIF p_period = 'afternoon' THEN
    v_period_start := '12:00'::TIME;
    v_period_end   := '18:00'::TIME;
  ELSIF p_period = 'evening' THEN
    v_period_start := '18:00'::TIME;
    v_period_end   := '22:00'::TIME;
  ELSE
    v_period_start := '00:00'::TIME;
    v_period_end   := '23:59'::TIME;
  END IF;

  FOR rec IN
    SELECT
      GREATEST(ss.start_time, v_period_start) AS win_start,
      LEAST(ss.end_time, v_period_end)        AS win_end
    FROM settings_schedules ss
    WHERE ss.user_id      = p_user_id
      AND ss.day_of_week  = v_dow
      AND ss.is_available = TRUE
      AND ss.start_time   < v_period_end
      AND ss.end_time     > v_period_start
    ORDER BY ss.start_time
  LOOP
    v_cursor := rec.win_start;

    WHILE v_cursor + (p_slot_minutes || ' minutes')::INTERVAL <= rec.win_end LOOP
      v_slot_end := (v_cursor + (p_slot_minutes || ' minutes')::INTERVAL)::TIME;

      SELECT NOT EXISTS (
        SELECT 1
        FROM meetings m
        WHERE m.user_id    = p_user_id
          AND m.status NOT IN ('cancelado')   -- removido 'cancelada' (pré-P7)
          AND m.start_time < (p_date + v_slot_end)::TIMESTAMPTZ
          AND m.end_time   > (p_date + v_cursor)::TIMESTAMPTZ
      ) INTO v_is_free;

      IF v_is_free THEN
        v_result := v_result || jsonb_build_object(
          'slot_start', TO_CHAR(v_cursor, 'HH24:MI'),
          'slot_end',   TO_CHAR(v_slot_end, 'HH24:MI'),
          'user_id',    p_user_id,
          'user_name',  v_user_name
        );
      END IF;

      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 4 — handle_meeting_followup_queue(): remover mapeamentos pré-P7
-- 'agendada' e 'nao_compareceu' não podem mais existir no banco.
-- O ELSE já trata os valores canônicos corretamente.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_meeting_followup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status    text;
  rule_rec    record;
  delay_secs  bigint;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Pós-P7 todos os status já são canônicos — usar diretamente
  v_status := NEW.status;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  IF v_status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
       AND webhook_url IS NOT NULL
       AND webhook_url <> ''
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days,    0) * 86400 +
      COALESCE(rule_rec.hours,   0) * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, people_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      now() + (delay_secs * interval '1 second'),
      rule_rec.channel,
      rule_rec.webhook_url,
      rule_rec.message
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 5 — Tabelas administrativas vazias (resíduo multi-tenant)
-- adm_clients, adm_sync_jobs, adm_sync_logs — todas com 0 rows,
-- criadas para um sistema de administração multi-tenant que foi removido.
-- Ordem: logs → jobs → clients (respeita FK)
-- ────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.adm_sync_logs  CASCADE;
DROP TABLE IF EXISTS public.adm_sync_jobs  CASCADE;
DROP TABLE IF EXISTS public.adm_clients    CASCADE;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 6 — user_roles + has_role() + app_role
-- Tabela vazia (0 rows). O sistema usa settings_users.user_type e
-- super_admin para autorização — nunca usou app_role.
-- Ordem correta: dropar policies dependentes → user_roles CASCADE
-- → has_role() → app_role
-- ────────────────────────────────────────────────────────────────

-- 6a. Dropar policies em settings_users que referenciam has_role()
DROP POLICY IF EXISTS "users_delete_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_update_policy" ON public.settings_users;

-- 6b. Recriar policies usando is_admin_or_manager() (canônico pós-P5)
CREATE POLICY "users_delete_policy" ON public.settings_users
  FOR DELETE USING (public.is_admin_or_manager());

CREATE POLICY "users_insert_policy" ON public.settings_users
  FOR INSERT WITH CHECK (
    (auth.uid() = auth_user_id) OR public.is_admin_or_manager()
  );

CREATE POLICY "users_update_policy" ON public.settings_users
  FOR UPDATE
  USING ((auth.uid() = auth_user_id) OR public.is_admin_or_manager())
  WITH CHECK ((auth.uid() = auth_user_id) OR public.is_admin_or_manager());

-- 6c. Dropar user_roles CASCADE primeiro — remove a policy
--     "Admins can manage all roles" que depende de has_role()
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 6d. Agora seguro dropar has_role() e app_role
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP TYPE  IF EXISTS public.app_role   CASCADE;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 7 — _meta_debug: habilitar RLS
-- Única tabela do schema public sem Row Level Security.
-- Guard: _meta_debug may not exist on new tenants.
-- ────────────────────────────────────────────────────────────────
DO $bloco7$
BEGIN
  ALTER TABLE public._meta_debug ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'BLOCO 7 _meta_debug RLS skipped: %', SQLERRM;
END $bloco7$;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 8 — Sistema Score Legado
--
-- Situação: dois sistemas coexistindo
--   LEGADO:  score_objectives + score_investments + score_framings
--            + colunas score_objective_id/score_investment_id/score_framing_id
--              em clients_people
--            + colunas objective_id[]/investment_id[]/framing_id[]
--              em score_matrix
--            + trigger trigger_auto_link_score_matrix
--            + funções auto_link_score_matrix() e find_score_matrix()
--
--   NOVO:    score_categories + score_category_items
--            + coluna category_selections JSONB em score_matrix
--
-- Verificado: todos os 4 rows de score_matrix têm category_selections
-- preenchido — migração para novo sistema completa.
-- ────────────────────────────────────────────────────────────────

-- 8a. Dropar trigger (usa colunas legadas de clients_people)
DROP TRIGGER IF EXISTS trigger_auto_link_score_matrix ON public.clients_people;

-- 8b. Dropar funções do sistema legado
DROP FUNCTION IF EXISTS public.auto_link_score_matrix();
DROP FUNCTION IF EXISTS public.find_score_matrix(uuid, uuid, uuid);

-- 8c. Dropar colunas legadas de score em clients_people
--     (score_matrix_id e score pertencem ao sistema novo — mantidos)
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS score_objective_id,
  DROP COLUMN IF EXISTS score_investment_id,
  DROP COLUMN IF EXISTS score_framing_id;

-- 8d. Dropar colunas legadas de score_matrix
--     (category_selections JSONB é o sistema novo — mantido)
ALTER TABLE public.score_matrix
  DROP COLUMN IF EXISTS objective_id,
  DROP COLUMN IF EXISTS investment_id,
  DROP COLUMN IF EXISTS framing_id;

-- 8e. Dropar tabelas legadas de score
DROP TABLE IF EXISTS public.score_objectives CASCADE;
DROP TABLE IF EXISTS public.score_investments CASCADE;
DROP TABLE IF EXISTS public.score_framings    CASCADE;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 9 — FK sem índice (degradação em JOIN e DELETE em cascata)
-- ────────────────────────────────────────────────────────────────
DO $bloco9$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_ai_agents_llm_provider_id
    ON public.ai_agents (llm_provider_id)
    WHERE llm_provider_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_ai_agents_llm_provider_id skipped: %', SQLERRM;
END $bloco9$;

DO $bloco9b$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_ai_agents_wa_channel_id
    ON public.ai_agents (wa_channel_id)
    WHERE wa_channel_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_ai_agents_wa_channel_id skipped: %', SQLERRM;
END $bloco9b$;

DO $bloco9c$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_sends_wa_channel_id
    ON public.sends (wa_channel_id)
    WHERE wa_channel_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_sends_wa_channel_id skipped: %', SQLERRM;
END $bloco9c$;

DO $bloco9d$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_settings_omni_new_contact_pipeline_id
    ON public.settings_omni_new_contact (pipeline_id);
  CREATE INDEX IF NOT EXISTS idx_settings_omni_new_contact_stage_id
    ON public.settings_omni_new_contact (stage_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_settings_omni_new_contact skipped: %', SQLERRM;
END $bloco9d$;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 10 — Índices com nomenclatura pré-P6 (users_id → user_id)
-- Após P6 as colunas foram renomeadas mas os índices mantiveram o nome
-- antigo. Dropar e recriar com nome correto.
-- Guard: em novos tenants (ex: ORA) a coluna pode ainda se chamar
-- users_id (renames P6 não rodaram). Wrapar em EXCEPTION para idempotência.
-- ────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_leads_notes_users_id;
DROP INDEX IF EXISTS public.idx_leads_files_users_id;
DROP INDEX IF EXISTS public.idx_leads_updates_users_id;

DO $bloco10a$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_notes_user_id
    ON public.leads_notes (user_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_leads_notes_user_id skipped: %', SQLERRM;
END $bloco10a$;

DO $bloco10b$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_files_user_id
    ON public.leads_files (user_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_leads_files_user_id skipped: %', SQLERRM;
END $bloco10b$;

DO $bloco10c$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_updates_user_id
    ON public.leads_updates (user_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_leads_updates_user_id skipped: %', SQLERRM;
END $bloco10c$;


-- ────────────────────────────────────────────────────────────────
-- BLOCO 11 — Índices em colunas Q sem uso (idx_scan = 0)
-- As colunas Q existem como campos diretos em clients_people mas
-- nunca são filtradas via índice. Os índices ocupam espaço sem
-- nenhum benefício mensurável.
-- ────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_q8_engagement_level;
DROP INDEX IF EXISTS public.idx_q19_qualification_status;
DROP INDEX IF EXISTS public.idx_q21_interest_level;
DROP INDEX IF EXISTS public.idx_q22_close_probability;


COMMIT;
