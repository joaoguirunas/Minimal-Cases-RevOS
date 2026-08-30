


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."feature_key" AS ENUM (
    'crm_export',
    'crm_delete',
    'score_view',
    'coach_view',
    'coach_edit',
    'sends_create',
    'bi_view',
    'settings_view'
);


ALTER TYPE "public"."feature_key" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'in_app',
    'email',
    'whatsapp'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_event_type" AS ENUM (
    'lead_assigned',
    'followup_due',
    'meeting_scheduled',
    'coach_evaluation_ready',
    'transcript_ready',
    'word_spotting_triggered',
    'inbound_message'
);


ALTER TYPE "public"."notification_event_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_lead_to_pipeline"("p_lead_id" "uuid", "p_target_pipeline_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_people_id uuid;
  v_company_id uuid;
  v_teams_id uuid;
  v_user_id uuid;
  v_title text;
  v_target_pipeline_name text;
  v_first_stage_id uuid;
  v_existing_lead_id uuid;
  v_new_lead_id uuid;
BEGIN
  SELECT people_id, company_id, teams_id, user_id, title
  INTO v_people_id, v_company_id, v_teams_id, v_user_id, v_title
  FROM leads
  WHERE id = p_lead_id;

  IF v_people_id IS NULL THEN
    RAISE EXCEPTION 'Lead de origem não encontrado';
  END IF;

  SELECT name INTO v_target_pipeline_name
  FROM leads_pipelines
  WHERE id = p_target_pipeline_id AND active = true;

  IF v_target_pipeline_name IS NULL THEN
    RAISE EXCEPTION 'Pipeline de destino não encontrado ou inativo';
  END IF;

  SELECT id INTO v_existing_lead_id
  FROM leads
  WHERE people_id = v_people_id
    AND leads_pipelines_id = p_target_pipeline_id
    AND status = 'in_progress';

  IF v_existing_lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lead já está ativo no pipeline "%"', v_target_pipeline_name;
  END IF;

  SELECT id INTO v_first_stage_id
  FROM leads_stages
  WHERE leads_pipelines_id = p_target_pipeline_id AND active = true
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_first_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline "%" não tem nenhuma etapa ativa', v_target_pipeline_name;
  END IF;

  INSERT INTO leads (people_id, company_id, teams_id, user_id, title, leads_pipelines_id, leads_stages_id, status)
  VALUES (v_people_id, v_company_id, v_teams_id, v_user_id, v_title, p_target_pipeline_id, v_first_stage_id, 'in_progress')
  RETURNING id INTO v_new_lead_id;

  RETURN jsonb_build_object('lead_id', v_new_lead_id, 'leads_stages_id', v_first_stage_id, 'pipeline_name', v_target_pipeline_name);
END;
$$;


ALTER FUNCTION "public"."add_lead_to_pipeline"("p_lead_id" "uuid", "p_target_pipeline_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adm_client_decrypted_secrets"("p_client_id" "uuid") RETURNS TABLE("service_role_key" "text", "db_password" "text", "management_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_context TEXT;
BEGIN
  v_context := p_client_id::TEXT;
  RETURN QUERY
    SELECT
      app_decrypt_secret(c.service_role_key, v_context) AS service_role_key,
      app_decrypt_secret(c.db_password, v_context) AS db_password,
      app_decrypt_secret(c.management_token, v_context) AS management_token
    FROM adm_clients c
    WHERE c.id = p_client_id;
END;
$$;


ALTER FUNCTION "public"."adm_client_decrypted_secrets"("p_client_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."adm_client_decrypted_secrets"("p_client_id" "uuid") IS 'Decrypt all secrets for a given adm_client. Used by edge functions via RPC.';



CREATE OR REPLACE FUNCTION "public"."adm_clients_secrets_status"() RETURNS TABLE("id" "uuid", "has_service_role_key" boolean, "has_db_password" boolean, "has_management_token" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    id,
    (service_role_key IS NOT NULL AND service_role_key <> '') AS has_service_role_key,
    (db_password IS NOT NULL AND db_password <> '')           AS has_db_password,
    (management_token IS NOT NULL AND management_token <> '')  AS has_management_token
  FROM adm_clients;
$$;


ALTER FUNCTION "public"."adm_clients_secrets_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."adm_clients_secrets_status"() IS 'Returns boolean presence of encrypted secrets for all adm_clients. SECURITY DEFINER bypasses column-level privilege gaps.';



CREATE OR REPLACE FUNCTION "public"."adm_clients_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."adm_clients_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adm_timeout_stuck_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  timed_out_count INTEGER;
BEGIN
  WITH timed_out AS (
    UPDATE adm_sync_jobs
    SET status = 'failed',
        completed_at = now(),
        error_message = 'Timeout: job excedeu 10 minutos'
    WHERE status = 'running'
      AND started_at < now() - interval '10 minutes'
    RETURNING id, client_id
  ),
  client_updates AS (
    UPDATE adm_clients
    SET sync_status = 'error'
    WHERE id IN (SELECT client_id FROM timed_out)
  )
  SELECT count(*) INTO timed_out_count FROM timed_out;

  -- Insert log for each timed out job
  INSERT INTO adm_sync_logs (job_id, level, message)
  SELECT id, 'error', '[' || now()::text || '] Timeout: job excedeu 10 minutos e foi marcado como failed automaticamente'
  FROM adm_sync_jobs
  WHERE status = 'failed'
    AND error_message = 'Timeout: job excedeu 10 minutos'
    AND completed_at >= now() - interval '1 minute';

  RETURN timed_out_count;
END;
$$;


ALTER FUNCTION "public"."adm_timeout_stuck_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_watchdog"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_stale_count int;
BEGIN
  -- 1. Marca execuções antigas como error
  UPDATE ai_agents_execution_log
  SET
    execution_status  = 'error',
    error_message     = 'watchdog: execution exceeded 90s without completion',
    execution_duration_ms = EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000
  WHERE execution_status = 'running'
    AND created_at < NOW() - INTERVAL '90 seconds';

  GET DIAGNOSTICS v_stale_count = ROW_COUNT;

  -- 2. Libera locks de pessoas cujo execution_log não tem mais nenhum 'running' recente
  UPDATE clients_people cp
  SET ai_processing_lock = false
  WHERE cp.ai_processing_lock = true
    AND NOT EXISTS (
      SELECT 1 FROM ai_agents_execution_log el
      WHERE el.people_id = cp.id
        AND el.execution_status = 'running'
        AND el.created_at >= NOW() - INTERVAL '90 seconds'
    );

  IF v_stale_count > 0 THEN
    RAISE LOG 'ai_agent_watchdog: released % stale execution(s)', v_stale_count;
  END IF;
END;
$$;


ALTER FUNCTION "public"."ai_agent_watchdog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anonymize_person"("p_person_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id   uuid;
  v_hash      text;
  v_tables    text[] := '{}';
BEGIN
  -- Require gestor role
  IF (auth.jwt() -> 'app_metadata' ->> 'user_type') != 'gestor' THEN
    RAISE EXCEPTION 'Permission denied: requires gestor role';
  END IF;

  v_tenant_id := public.get_current_user_tenant_id();
  v_user_id   := auth.uid();
  v_hash      := encode(sha256(p_person_id::text::bytea), 'hex');

  -- Anonymize clients_people
  UPDATE public.clients_people
  SET
    name    = 'REDACTED_' || left(v_hash, 8),
    email   = 'redacted_' || left(v_hash, 8) || '@redacted.invalid',
    whatsapp = NULL,
    cpf     = NULL
  WHERE id = p_person_id AND tenant_id = v_tenant_id;

  IF FOUND THEN
    v_tables := array_append(v_tables, 'clients_people');
  END IF;

  -- Anonymize crm_pessoas (legacy)
  UPDATE public.crm_pessoas
  SET
    nome    = 'REDACTED_' || left(v_hash, 8),
    email   = 'redacted_' || left(v_hash, 8) || '@redacted.invalid',
    celular = NULL,
    cpf     = NULL
  WHERE id = p_person_id AND tenant_id = v_tenant_id;

  IF FOUND THEN
    v_tables := array_append(v_tables, 'crm_pessoas');
  END IF;

  -- Anonymize crm_messages content referencing this person (via leads)
  UPDATE public.crm_messages
  SET message = '[conteúdo removido - LGPD]'
  WHERE lead_id IN (
    SELECT id FROM public.crm_leads
    WHERE person_id = p_person_id AND tenant_id = v_tenant_id
  );

  IF FOUND THEN
    v_tables := array_append(v_tables, 'crm_messages');
  END IF;

  -- Anonymize messages (modern schema)
  UPDATE public.messages
  SET message = '[conteúdo removido - LGPD]'
  WHERE lead_id IN (
    SELECT id FROM public.leads
    WHERE person_id = p_person_id AND tenant_id = v_tenant_id
  );

  IF FOUND THEN
    v_tables := array_append(v_tables, 'messages');
  END IF;

  -- Record in log
  INSERT INTO public.lgpd_anonymization_log(tenant_id, performed_by, person_id, tables_affected)
  VALUES (v_tenant_id, v_user_id, p_person_id, v_tables);

  RETURN jsonb_build_object('ok', true, 'tables_affected', v_tables);
END;
$$;


ALTER FUNCTION "public"."anonymize_person"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_decrypt_secret"("p_encrypted" "text", "p_context" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64'), concat('app_secret_', p_context));
EXCEPTION WHEN OTHERS THEN
  -- If decryption fails (e.g., value was never encrypted / key mismatch),
  -- return the raw value as-is for backwards compatibility during migration
  RETURN p_encrypted;
END;
$$;


ALTER FUNCTION "public"."app_decrypt_secret"("p_encrypted" "text", "p_context" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."app_decrypt_secret"("p_encrypted" "text", "p_context" "text") IS 'Decrypt a secret value using pgp_sym_decrypt. Returns raw value if decryption fails (backwards compat).';



CREATE OR REPLACE FUNCTION "public"."app_encrypt_secret"("p_value" "text", "p_context" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(pgp_sym_encrypt(p_value, concat('app_secret_', p_context)), 'base64');
END;
$$;


ALTER FUNCTION "public"."app_encrypt_secret"("p_value" "text", "p_context" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."app_encrypt_secret"("p_value" "text", "p_context" "text") IS 'Encrypt a secret value using pgp_sym_encrypt. Context is used as salt. Reusable by any module.';



CREATE OR REPLACE FUNCTION "public"."append_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_new_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_definition_id uuid;
  v_current_value text;
  v_trimmed_new   text;
  v_needle        text;
  v_already       boolean;
  v_next_value    text;
  v_lock_key      bigint;
BEGIN
  v_trimmed_new := btrim(coalesce(p_new_value, ''));
  IF v_trimmed_new = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'append_crm_field_value: field_key "%" not found (entity_type=pessoa, active=true)', p_field_key;
    RETURN;
  END IF;

  v_lock_key := hashtextextended(p_person_id::text || '|' || v_definition_id::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT value_text INTO v_current_value
  FROM public.lead_field_values
  WHERE entity_type = 'pessoa'
    AND entity_id = p_person_id
    AND field_definition_id = v_definition_id;

  IF v_current_value IS NULL OR btrim(v_current_value) = '' THEN
    v_next_value := v_trimmed_new;
  ELSE
    v_needle := lower(v_trimmed_new);
    SELECT EXISTS (
      SELECT 1
      FROM regexp_split_to_table(v_current_value, '[[:space:]]*;[[:space:]]*') AS token
      WHERE lower(btrim(token)) = v_needle
        AND btrim(token) <> ''
    ) INTO v_already;

    IF v_already THEN
      RETURN;
    END IF;

    v_next_value := btrim(v_current_value) || '; ' || v_trimmed_new;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, v_next_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."append_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_new_value" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."append_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_new_value" "text") IS 'PIPE-2.1: token-aware append (separator=''; '') with case-insensitive dedup. Atomic via pg_advisory_xact_lock.';



CREATE OR REPLACE FUNCTION "public"."assign_booking_rule_set_url_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.url_id IS NULL THEN
    SELECT COALESCE(MAX(url_id), 0) + 1
    INTO NEW.url_id
    FROM public.booking_rule_sets;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_booking_rule_set_url_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_lead_round_robin"("p_lead_id" "uuid", "p_team_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Pick the active team member with the oldest most-recent lead assignment
  SELECT sut.user_id
    INTO v_user_id
    FROM settings_users_teams sut
    JOIN settings_users su ON su.id = sut.user_id
   WHERE sut.team_id = p_team_id
     AND su.active = true
   ORDER BY (
     SELECT MAX(l.created_at)
       FROM leads l
      WHERE l.user_id = sut.user_id
   ) ASC NULLS FIRST
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assign the lead
  UPDATE public.leads
     SET user_id   = v_user_id,
         teams_id  = p_team_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."assign_lead_round_robin"("p_lead_id" "uuid", "p_team_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_lead_round_robin"("p_lead_id" "uuid", "p_team_id" "uuid") IS 'Assigns lead p_lead_id to the active member of p_team_id who received a lead least recently (round-robin by last lead created_at). Returns assigned user_id.';



CREATE OR REPLACE FUNCTION "public"."audit_value"("col_name" "text", "val" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN val IS NULL THEN NULL
    WHEN public.is_sensitive_column(col_name) THEN encode(sha256(val::bytea), 'hex')
    ELSE val
  END;
$$;


ALTER FUNCTION "public"."audit_value"("col_name" "text", "val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_pause_ai_on_human_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- from_contact != 'cliente' e source_type='manual' é a assinatura exata de
  -- "um atendente digitou e enviou isso agora, no Omni" — automações (campaign,
  -- followup, appointment_reminder, kiwify) e a própria IA (ai_agent) não pausam.
  IF NEW.from_contact <> 'cliente' AND NEW.source_type = 'manual' THEN
    UPDATE public.clients_people
       SET ai_enabled = false,
           ai_paused_reason = 'human_reply',
           ai_paused_at = now()
     WHERE id = NEW.people_id
       AND ai_enabled = true;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- nunca pode derrubar o envio da mensagem em si
END;
$$;


ALTER FUNCTION "public"."auto_pause_ai_on_human_message"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_pause_ai_on_human_message"() IS 'AFTER INSERT em messages: quando um atendente responde manualmente (source_type=manual, from_contact != cliente), desliga ai_enabled pra esse contato — evita a IA responder por cima de quem já está atendendo. Reativação é manual (UI seta ai_enabled=true de volta, o que também deveria limpar ai_paused_reason).';



CREATE OR REPLACE FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_user_id" "uuid", "p_title" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer DEFAULT 30, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_meeting_id UUID;
  v_people_id  UUID;
  v_end_ts     TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'book_meeting: lead % not found', p_lead_id;
  END IF;

  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;
  v_end_ts := p_start_ts + (p_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, notes, status, source
  )
  VALUES (
    p_lead_id, v_people_id, p_user_id, p_title,
    p_start_ts, v_end_ts,
    p_notes,
    'agendado',
    'ai_agent'
  )
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$$;


ALTER FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_user_id" "uuid", "p_title" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_rule_set_id" "uuid" DEFAULT NULL::"uuid", "p_duration" integer DEFAULT 30, "p_notes" "text" DEFAULT NULL::"text", "p_exclude_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id       uuid;
  v_user_name     text;
  v_meeting_id    uuid;
  v_title         text;
  v_people_id     uuid;
  v_pipeline_id   uuid;
  v_eligible_ids  uuid[];
BEGIN
  -- #3 backstop — bloqueia duplo agendamento caso o frontend seja burlado.
  IF EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.lead_id = p_lead_id
      AND m.status NOT IN ('cancelado', 'cancelada')
      AND m.end_time > NOW()
  ) THEN
    RETURN json_build_object('error', 'already_booked');
  END IF;

  -- Resolve people_id e pipeline do lead
  SELECT people_id, leads_pipelines_id INTO v_people_id, v_pipeline_id
    FROM public.leads WHERE id = p_lead_id;

  v_eligible_ids := public.get_booking_eligible_user_ids(p_rule_set_id, v_pipeline_id);

  IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível');
  END IF;

  IF p_rule_set_id IS NOT NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.booking_rules br
    INNER JOIN public.settings_users su
      ON su.id = (br.config->>'user_id')::uuid
      AND su.active = true
      AND su.id = ANY(v_eligible_ids)
      AND su.id <> ALL(p_exclude_user_ids)            -- GCal: pula quem está ocupado externamente
    WHERE br.rule_set_id = p_rule_set_id
      AND br.rule_type   = 'specific_user'
      AND br.is_active   = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY br.order_index ASC
    LIMIT 1;
  END IF;

  -- Prioritário na equipe: tenta antes do load-balance geral. Só é pulado se
  -- estiver ocupado/indisponível no horário (ou excluído por conflito no
  -- Google Calendar). Mais de um prioritário livre → mesmo tie-break do
  -- load-balance geral (menos reuniões futuras, depois mais tempo sem lead).
  IF v_user_id IS NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.settings_users su
    WHERE su.id = ANY(v_eligible_ids)
      AND su.active = true
      AND su.id <> ALL(p_exclude_user_ids)
      AND EXISTS (
        SELECT 1 FROM public.settings_users_teams sut
        WHERE sut.user_id = su.id AND sut.is_priority = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY
      (SELECT COUNT(*) FROM public.meetings m2
       WHERE m2.user_id    = su.id
         AND m2.start_time >= NOW()
         AND m2.status NOT IN ('cancelado', 'cancelada')
      ) ASC,
      COALESCE((
        SELECT MAX(m3.created_at) FROM public.meetings m3
        WHERE m3.user_id = su.id
      ), '1970-01-01'::timestamptz) ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.settings_users su
    WHERE su.id = ANY(v_eligible_ids)
      AND su.active = true
      AND su.id <> ALL(p_exclude_user_ids)            -- GCal: pula quem está ocupado externamente
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY
      (SELECT COUNT(*) FROM public.meetings m2
       WHERE m2.user_id    = su.id
         AND m2.start_time >= NOW()
         AND m2.status NOT IN ('cancelado', 'cancelada')
      ) ASC,
      COALESCE((
        SELECT MAX(m3.created_at) FROM public.meetings m3
        WHERE m3.user_id = su.id
      ), '1970-01-01'::timestamptz) ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Horário não disponível — escolha outro horário');
  END IF;

  v_title := 'Reunião agendada — ' ||
    TO_CHAR(p_start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, status, notes, source
  )
  VALUES (
    p_lead_id, v_people_id, v_user_id, v_title,
    p_start_time, p_end_time,
    'agendado', p_notes, 'public_booking'
  )
  RETURNING id INTO v_meeting_id;

  -- Avança o lead para "Reunião Marcada" do pipeline ATUAL dele (curso ou mentoria).
  UPDATE public.leads l
  SET leads_stages_id = rm.id
  FROM public.leads_stages rm
  WHERE l.id = p_lead_id
    AND rm.leads_pipelines_id = l.leads_pipelines_id
    AND rm.name = 'Reunião Marcada'
    AND rm.active = true;

  RETURN json_build_object(
    'meeting_id', v_meeting_id::text,
    'consultor', json_build_object(
      'id',   v_user_id::text,
      'name', v_user_name
    )
  );
END;
$$;


ALTER FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_rule_set_id" "uuid", "p_duration" integer, "p_notes" "text", "p_exclude_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_clients_people_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_contact = 'cliente' THEN
    SELECT name INTO v_name FROM public.clients_people WHERE id = NEW.people_id;

    INSERT INTO public.notifications
      (event_type, people_id, lead_id, message_id, title, body, channel, unread_messages)
    VALUES
      ('inbound_message', NEW.people_id, NEW.lead_id, NEW.id,
       left(COALESCE(v_name, 'Contato sem nome'), 120),
       left(COALESCE(NEW.content, ''), 280),
       NEW.channel, 1)
    ON CONFLICT (people_id, event_type) WHERE read_at IS NULL
    DO UPDATE SET
      message_id      = EXCLUDED.message_id,
      body            = EXCLUDED.body,
      channel         = EXCLUDED.channel,
      unread_messages = notifications.unread_messages + 1,
      created_at      = now(),
      lead_id         = COALESCE(EXCLUDED.lead_id, notifications.lead_id);
      -- title não é atualizado: preserva o nome de quando a rajada começou.

    UPDATE public.clients_people
       SET updated_at      = now(),
           unread_count    = unread_count + 1,
           first_unread_at = COALESCE(first_unread_at, NEW.created_at, now())
     WHERE id = NEW.people_id;
  ELSE
    UPDATE public.clients_people SET updated_at = now() WHERE id = NEW.people_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- PRESERVAR: falha de contador/notificação nunca derruba a ingestão
END;
$$;


ALTER FUNCTION "public"."bump_clients_people_on_message"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bump_clients_people_on_message"() IS 'AFTER INSERT em messages: bumpa clients_people.updated_at (ordenação do Omni) e, para inbound de cliente, incrementa unread_count e mantém a notificação aberta do sino. Roda no caminho mais quente do sistema — o EXCEPTION WHEN OTHERS THEN RETURN NEW é o que impede um bug aqui de derrubar o webhook de mensagem; não remover.';



CREATE OR REPLACE FUNCTION "public"."check_bi_voice_beta_update"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_gestor boolean;
BEGIN
  SELECT (user_type IN ('gestor') OR super_admin = true)
    INTO v_is_gestor
    FROM public.settings_users
   WHERE auth_user_id = auth.uid()
     AND active = true
   LIMIT 1;

  RETURN COALESCE(v_is_gestor, false);
END;
$$;


ALTER FUNCTION "public"."check_bi_voice_beta_update"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."followup_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "followup_id" "uuid",
    "meeting_followup_id" "uuid",
    "lead_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "channel" "text" NOT NULL,
    "template_id" "text",
    "message" "text",
    "subject" "text",
    "phone_number" "text",
    "source_type" "text" DEFAULT 'stage'::"text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "fired_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message_id" bigint,
    "response_data" "jsonb",
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "held_for_bh" boolean DEFAULT false NOT NULL,
    "original_scheduled_for" timestamp with time zone,
    CONSTRAINT "followup_queue_source_type_check" CHECK (("source_type" = ANY (ARRAY['stage'::"text", 'meeting'::"text"]))),
    CONSTRAINT "followup_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'queued'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."followup_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."followup_queue" IS 'Fila de disparos agendados de follow-ups. Sistema processa entradas com status=pending e scheduled_at <= now().';



COMMENT ON COLUMN "public"."followup_queue"."channel" IS 'Canal de envio: whatsapp_template, whatsapp_texto, email, sms, ligacao';



COMMENT ON COLUMN "public"."followup_queue"."source_type" IS 'Origem: stage=por etapa do pipeline | meeting=por status de reunião';



COMMENT ON COLUMN "public"."followup_queue"."message_id" IS 'Referência à mensagem criada em messages após envio bem-sucedido';



CREATE OR REPLACE FUNCTION "public"."claim_followup_queue_batch"("p_limit" integer DEFAULT 50) RETURNS SETOF "public"."followup_queue"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE public.followup_queue fq
  SET status = 'processing', updated_at = now()
  FROM (
    SELECT id FROM public.followup_queue
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) claimed
  WHERE fq.id = claimed.id
  RETURNING fq.*;
END;
$$;


ALTER FUNCTION "public"."claim_followup_queue_batch"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_followup_queue_batch"("p_limit" integer) IS 'Atomically claims up to p_limit pending+due followup_queue rows by flipping them to processing (FOR UPDATE SKIP LOCKED), so concurrent invocations of followup-trigger-worker never process the same entry twice.';



CREATE OR REPLACE FUNCTION "public"."claim_pending_messages"("p_batch_size" integer DEFAULT 20, "p_max_age_hours" integer DEFAULT 24, "p_people_id" "uuid" DEFAULT NULL::"uuid", "p_channel" "text" DEFAULT NULL::"text") RETURNS TABLE("id" bigint, "channel" "text", "content" "text", "message_type" "text", "media_url" "text", "media_metadata" "jsonb", "people_id" "uuid", "lead_id" "uuid", "user_id" "uuid", "source_type" "text", "module_ref_id" "uuid", "whatsapp_template_id" "text", "wa_phone_number_id" "text", "execution_id" "uuid", "metadata" "jsonb", "sent_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE messages m_upd
    SET status = 'sending'
    WHERE m_upd.id IN (
      SELECT m.id
      FROM messages m
      WHERE m.status = 'pending'
        AND m.from_contact != 'cliente'
        AND m.created_at > now() - (p_max_age_hours || ' hours')::interval
        AND (p_people_id IS NULL OR m.people_id = p_people_id)
        AND (p_channel IS NULL OR m.channel = p_channel)
        AND (
          (m.metadata->>'delay_minutes') IS NULL
          OR (m.metadata->>'delay_minutes')::int = 0
          OR (
            COALESCE(m.sent_at, m.created_at)
            + ((m.metadata->>'delay_minutes')::int * interval '1 minute')
            <= now()
          )
        )
      ORDER BY m.id ASC
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      m_upd.id,
      m_upd.channel,
      m_upd.content,
      m_upd.message_type,
      m_upd.media_url,
      m_upd.media_metadata,
      m_upd.people_id,
      m_upd.lead_id,
      m_upd.user_id,
      m_upd.source_type,
      m_upd.module_ref_id,
      m_upd.whatsapp_template_id,
      m_upd.wa_phone_number_id,
      m_upd.execution_id,
      m_upd.metadata,
      m_upd.sent_at
  )
  SELECT * FROM claimed ORDER BY claimed.id ASC;
END;
$$;


ALTER FUNCTION "public"."claim_pending_messages"("p_batch_size" integer, "p_max_age_hours" integer, "p_people_id" "uuid", "p_channel" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_pending_messages"("p_batch_size" integer, "p_max_age_hours" integer, "p_people_id" "uuid", "p_channel" "text") IS 'Atomicamente transiciona mensagens pending → sending. Usa FOR UPDATE SKIP LOCKED para evitar duplicação quando múltiplas instâncias do omni-delivery-engine correm simultaneamente.';



CREATE OR REPLACE FUNCTION "public"."cleanup_agent_history"("p_agent_id" "uuid", "p_keep_versions" integer DEFAULT 50) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM ai_agents_history
  WHERE ai_agent_id = p_agent_id
    AND id NOT IN (
      SELECT id
      FROM ai_agents_history
      WHERE ai_agent_id = p_agent_id
      ORDER BY created_at DESC
      LIMIT p_keep_versions
    );
END;
$$;


ALTER FUNCTION "public"."cleanup_agent_history"("p_agent_id" "uuid", "p_keep_versions" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_auth_login_attempts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.auth_login_attempts
  WHERE blocked_until IS NOT NULL
    AND blocked_until < now() - interval '1 hour';
END;
$$;


ALTER FUNCTION "public"."cleanup_auth_login_attempts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_bi_voice_token_log"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.bi_voice_token_log
  WHERE issued_at < now() - interval '24 hours';
END;
$$;


ALTER FUNCTION "public"."cleanup_bi_voice_token_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tenant_user"("p_email" "text", "p_password" "text", "p_name" "text", "p_phone" "text" DEFAULT NULL::"text", "p_user_type" "text" DEFAULT 'user'::"text", "p_super_admin" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_service_role_key text;
  v_supabase_url text;
  v_auth_user_id uuid;
  v_user_record jsonb;
  v_request_id bigint;
  v_status int;
  v_body text;
  v_attempts int := 0;
BEGIN
  SET LOCAL statement_timeout = '30s';

  SELECT value INTO v_service_role_key FROM _app_config WHERE key = 'service_role_key';
  SELECT value INTO v_supabase_url FROM _app_config WHERE key = 'supabase_url';

  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Configuração do tenant incompleta. Contacte o administrador.');
  END IF;

  IF NOT v_service_role_key LIKE 'eyJ%' THEN
    RETURN jsonb_build_object('error', 'Service Role Key inválida (não parece um JWT). Re-salve no ADM.');
  END IF;

  SELECT net.http_post(
    url     := v_supabase_url || '/auth/v1/admin/users',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        v_service_role_key,
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'email',         p_email,
      'password',      p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object('full_name', p_name)
    )
  ) INTO v_request_id;

  LOOP
    PERFORM pg_sleep(0.5);
    v_attempts := v_attempts + 1;

    BEGIN
      SELECT status_code, body
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    EXCEPTION WHEN undefined_column THEN
      SELECT status_code, content
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    END;

    EXIT WHEN v_status IS NOT NULL;
    EXIT WHEN v_attempts >= 20;
  END LOOP;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Timeout aguardando resposta do Auth. Tente novamente.');
  END IF;

  IF v_status >= 400 THEN
    RETURN jsonb_build_object('error', COALESCE(
      (v_body::jsonb ->> 'msg'),
      (v_body::jsonb ->> 'message'),
      v_body,
      'Erro ao criar usuário no Auth'
    ));
  END IF;

  v_auth_user_id := (v_body::jsonb ->> 'id')::uuid;

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Auth retornou sem ID de usuário');
  END IF;

  INSERT INTO settings_users (auth_user_id, name, email, phone, user_type, super_admin, active)
  VALUES (v_auth_user_id, p_name, p_email, p_phone, p_user_type, p_super_admin, true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT jsonb_build_object(
    'success',      true,
    'auth_user_id', v_auth_user_id,
    'email',        p_email
  ) INTO v_user_record;

  RETURN v_user_record;
END;
$$;


ALTER FUNCTION "public"."create_tenant_user"("p_email" "text", "p_password" "text", "p_name" "text", "p_phone" "text", "p_user_type" "text", "p_super_admin" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_elevenlabs_key"("encrypted_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF encrypted_key IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), 'elevenlabs_gs_2026');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."decrypt_elevenlabs_key"("encrypted_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_ai_on_atendimento_humano"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.leads_stages_id = '6ba2f54b-223a-4fe6-8afb-c42160e617ea' AND NEW.people_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.leads_stages_id IS DISTINCT FROM OLD.leads_stages_id) THEN
    UPDATE public.clients_people
    SET ai_enabled = false
    WHERE id = NEW.people_id AND ai_enabled IS DISTINCT FROM false;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."disable_ai_on_atendimento_humano"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_new_lead_webhooks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net'
    AS $$
DECLARE
  webhook_record RECORD;
  payload        JSONB;
  client_data    JSONB;
  request_id     BIGINT;
BEGIN
  -- Fetch client data if people_id exists
  IF NEW.people_id IS NOT NULL THEN
    SELECT to_jsonb(cp.*) INTO client_data
    FROM public.clients_people cp
    WHERE cp.id = NEW.people_id;
  END IF;

  -- Build payload
  payload := jsonb_build_object(
    'tipo',      'novo_lead',
    'timestamp', now(),
    'lead',      to_jsonb(NEW),
    'cliente',   COALESCE(client_data, '{}'::jsonb)
  );

  -- Iterate over active webhooks of type 'novo_lead'
  FOR webhook_record IN
    SELECT id, url, name
    FROM public.webhooks
    WHERE event_type = 'novo_lead' AND active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url                  := webhook_record.url,
        body                 := payload,
        params               := '{}'::jsonb,
        headers              := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 10000
      ) INTO request_id;

      INSERT INTO public.webhook_logs (
        webhook_id, status_code, response_body, request_body, created_at
      ) VALUES (
        webhook_record.id,
        202,
        jsonb_build_object('queued', true, 'request_id', request_id),
        payload,
        now()
      );

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.webhook_logs (
        webhook_id, status_code, response_body, request_body, created_at
      ) VALUES (
        webhook_record.id,
        500,
        jsonb_build_object('error', SQLERRM, 'queued', false),
        payload,
        now()
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."dispatch_new_lead_webhooks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_lead_on_stage_enter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rule record;
  v_target_stage_id uuid;
  v_already_active uuid;
BEGIN
  -- Guarda contra encadeamento indefinido: se uma regra mal configurada criar
  -- um ciclo (etapa A duplica pra pipeline B, cuja primeira etapa duplica de
  -- volta pra A...), essa profundidade limita o dano em vez de estourar a
  -- stack do Postgres.
  IF pg_trigger_depth() > 3 THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'in_progress' OR NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.leads_stages_id IS NOT DISTINCT FROM OLD.leads_stages_id THEN
    RETURN NEW;
  END IF;

  FOR v_rule IN
    SELECT * FROM leads_stage_duplication_rules
    WHERE source_stage_id = NEW.leads_stages_id AND active = true
  LOOP
    SELECT id INTO v_already_active
    FROM leads
    WHERE people_id = NEW.people_id
      AND leads_pipelines_id = v_rule.target_pipeline_id
      AND status = 'in_progress';

    IF v_already_active IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_target_stage_id := v_rule.target_stage_id;
    IF v_target_stage_id IS NULL THEN
      SELECT id INTO v_target_stage_id
      FROM leads_stages
      WHERE leads_pipelines_id = v_rule.target_pipeline_id AND active = true
      ORDER BY order_index ASC
      LIMIT 1;
    END IF;

    IF v_target_stage_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO leads (people_id, company_id, teams_id, user_id, title, leads_pipelines_id, leads_stages_id, status)
    VALUES (NEW.people_id, NEW.company_id, NEW.teams_id, NEW.user_id, NEW.title, v_rule.target_pipeline_id, v_target_stage_id, 'in_progress');
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."duplicate_lead_on_stage_enter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_elevenlabs_key"("key_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF key_value IS NULL OR key_value = '' THEN RETURN NULL; END IF;
  RETURN encode(pgp_sym_encrypt(key_value, 'elevenlabs_gs_2026'), 'base64');
END;
$$;


ALTER FUNCTION "public"."encrypt_elevenlabs_key"("key_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_person"("p_exclude_id" "uuid", "p_whatsapp" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_document" "text" DEFAULT NULL::"text", "p_instagram_user_id" "text" DEFAULT NULL::"text", "p_instagram_handle" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.clients_people
  WHERE id <> p_exclude_id
    AND status <> 'merged'
    AND (
      (p_whatsapp          IS NOT NULL AND whatsapp          = p_whatsapp) OR
      (p_email             IS NOT NULL AND LOWER(email)      = LOWER(p_email)) OR
      (p_document          IS NOT NULL AND document          = p_document) OR
      (p_instagram_user_id IS NOT NULL AND instagram_user_id = p_instagram_user_id) OR
      (p_instagram_handle  IS NOT NULL AND LOWER(instagram_handle) = LOWER(p_instagram_handle))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."find_duplicate_person"("p_exclude_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_document" "text", "p_instagram_user_id" "text", "p_instagram_handle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_queue_conversion_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_lead record;
  v_person record;
  v_email_hash text;
  v_phone_hash text;
  v_lead_user_id uuid;
  v_rule record;
  v_normalized_status text;
BEGIN
  -- Normalize status
  v_normalized_status := CASE NEW.status
    WHEN 'agendada'   THEN 'agendado'
    WHEN 'cancelada'  THEN 'cancelado'
    WHEN 'realizada'  THEN 'compareceu'
    ELSE NEW.status
  END;

  -- Get the lead associated with this meeting
  -- FIX: was NEW.leads_id, column renamed to lead_id by P6
  SELECT l.*, su.auth_user_id AS owner_user_id INTO v_lead
  FROM public.leads l
  LEFT JOIN public.settings_users su ON su.id = l.user_id
  WHERE l.id = NEW.lead_id;

  IF v_lead IS NULL OR v_lead.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_lead_user_id := v_lead.owner_user_id;

  -- Hash person data
  IF v_lead.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people WHERE id = v_lead.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Find matching booking_status rules
  FOR v_rule IN
    SELECT *
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND trigger_type = 'booking_status'
      AND (meta_enabled = true OR google_enabled = true)
      AND (trigger_config->>'status') = v_normalized_status
  LOOP
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      v_lead.id,
      v_lead.leads_stages_id,
      COALESCE(v_lead.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',        v_rule.id::text,
        'rule_name',      v_rule.name,
        'trigger_type',   'booking_status',
        'booking_status', v_normalized_status,
        'meeting_id',     NEW.id::text,
        'gclid',          v_lead.gclid,
        'fbclid',         v_lead.fbclid,
        'fbc',            v_lead.fbc,
        'fbp',            v_lead.fbp,
        'fb_lead_id',     v_lead.fb_lead_id,
        'email_hash',     v_email_hash,
        'phone_hash',     v_phone_hash,
        'value',          v_lead.value,
        'timestamp',      extract(epoch from now())::bigint,
        'meta_pixel_id',               v_rule.meta_pixel_id,
        'meta_event_name',             v_rule.meta_event_name,
        'meta_send_value',             v_rule.meta_send_value,
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- Fire conversion-send
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: NEVER block meeting updates due to conversion tracking
  RAISE WARNING 'fn_queue_conversion_booking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_queue_conversion_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_queue_conversion_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_person record;
  v_email_hash text;
  v_phone_hash text;
  v_lead_user_id uuid;
  v_rule record;
  v_event_type text;
BEGIN
  -- Resolve the owner (user_id) of this lead via settings_users
  -- FIX: was NEW.users_id, column renamed to user_id by P6
  SELECT su.auth_user_id INTO v_lead_user_id
  FROM public.settings_users su
  WHERE su.id = NEW.user_id;

  IF v_lead_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine event type
  IF TG_ARGV[0] = 'stage_change' THEN
    v_event_type := 'stage_enter';
  ELSIF TG_ARGV[0] = 'lead_won' THEN
    v_event_type := 'lead_won';
  ELSIF TG_ARGV[0] = 'lead_lost' THEN
    v_event_type := 'lead_lost';
  ELSE
    v_event_type := 'stage_enter';
  END IF;

  -- Fetch person data for hashing
  IF NEW.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people
    WHERE id = NEW.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Find matching rules
  FOR v_rule IN
    SELECT id, name, trigger_type, trigger_config, meta_enabled, meta_event_name, meta_send_value,
           google_enabled, google_conversion_action_id, google_send_value, google_currency,
           meta_pixel_id, google_account_id
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND (meta_enabled = true OR google_enabled = true)
      AND trigger_type = v_event_type
  LOOP
    -- Check trigger_config match
    IF v_event_type = 'stage_enter' AND (v_rule.trigger_config->>'stage_id') IS NOT NULL THEN
      IF (v_rule.trigger_config->>'stage_id') <> NEW.leads_stages_id::text THEN
        CONTINUE;
      END IF;
    END IF;

    -- Insert queue entry for this matched rule
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      NEW.id,
      NEW.leads_stages_id,
      COALESCE(NEW.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',      v_rule.id::text,
        'rule_name',    v_rule.name,
        'trigger_type', v_rule.trigger_type,
        'gclid',        NEW.gclid,
        'fbclid',       NEW.fbclid,
        'fbc',          NEW.fbc,
        'fbp',          NEW.fbp,
        'fb_lead_id',   NEW.fb_lead_id,
        'email_hash',   v_email_hash,
        'phone_hash',   v_phone_hash,
        'value',        NEW.value,
        'timestamp',    extract(epoch from now())::bigint,
        -- Meta-specific
        'meta_pixel_id',     v_rule.meta_pixel_id,
        'meta_event_name',   v_rule.meta_event_name,
        'meta_send_value',   v_rule.meta_send_value,
        -- Google-specific
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- Fire-and-forget: invoke conversion-send edge function
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block lead updates
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: NEVER block lead updates due to conversion tracking
  RAISE WARNING 'fn_queue_conversion_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_queue_conversion_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_schedule_automation_on_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_trigger_status TEXT;
  v_lead_id        UUID;
  v_lead           RECORD;
  v_rule           RECORD;
BEGIN
  -- Only fire on status change (UPDATE) or new meeting (INSERT)
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip bloqueio manual — internal status
  IF NEW.status = 'bloqueio manual' THEN
    RETURN NEW;
  END IF;

  -- Map meetings.status → schedule_automations.trigger_status
  v_trigger_status := CASE NEW.status
    WHEN 'agendado'         THEN 'criado'
    WHEN 'compareceu'       THEN 'realizado'
    WHEN 'cancelado'        THEN 'cancelado'
    WHEN 'não compareceu'   THEN 'no_show'
    WHEN 'confirmado'       THEN 'confirmado'
    WHEN 'reagendado'       THEN 'reagendado'
    ELSE NULL
  END;

  IF v_trigger_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the lead:
  -- 1. Direct FK: meetings.lead_id  (was meetings.leads_id before p6 rename)
  -- 2. Fallback: find lead by meetings.people_id
  v_lead_id := NEW.lead_id;

  IF v_lead_id IS NULL AND NEW.people_id IS NOT NULL THEN
    -- Find the most recent active lead for this person
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE people_id = NEW.people_id
       AND status = 'em-andamento'
       AND archived = false
     ORDER BY updated_at DESC
     LIMIT 1;

    v_lead_id := v_lead.id;
  ELSE
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE id = v_lead_id;
  END IF;

  -- No lead found → nothing to do
  IF v_lead_id IS NULL OR v_lead.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up matching automation rule
  SELECT sa.target_pipeline_id, sa.target_stage_id
    INTO v_rule
    FROM public.schedule_automations sa
   WHERE sa.pipeline_id = v_lead.leads_pipelines_id
     AND sa.trigger_status = v_trigger_status
     AND sa.is_active = true
   LIMIT 1;

  -- No matching rule → nothing to do
  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move the lead: update pipeline + stage
  UPDATE public.leads
     SET leads_pipelines_id = v_rule.target_pipeline_id,
         leads_stages_id    = v_rule.target_stage_id,
         updated_at         = NOW()
   WHERE id = v_lead_id;

  -- Log the move in leads_updates for audit trail
  INSERT INTO public.leads_updates (lead_id, from_stage_id, to_stage_id, notes)
  VALUES (
    v_lead_id,
    v_lead.leads_stages_id,
    v_rule.target_stage_id,
    'Automação Schedule: meeting status → ' || NEW.status
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_schedule_automation_on_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_ai_provider_key"("p_provider" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_key text;
BEGIN
  -- Prefer the explicit default; fall back to any active provider for this type.
  SELECT api_key
    INTO v_key
    FROM public.settings_ai_providers
   WHERE provider = p_provider
     AND active   = true
   ORDER BY is_default DESC, created_at ASC
   LIMIT 1;

  RETURN v_key; -- NULL when not configured at all
END;
$$;


ALTER FUNCTION "public"."get_active_ai_provider_key"("p_provider" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_active_ai_provider_key"("p_provider" "text") IS 'Returns api_key for the provider: prefers is_default=true, falls back to any active row. service_role only.';



CREATE OR REPLACE FUNCTION "public"."get_available_slots"("p_user_id" "uuid", "p_date" "date", "p_period" "text" DEFAULT NULL::"text", "p_slot_minutes" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_dow         INT;
  v_user_name   TEXT;
  v_result      JSONB := '[]'::JSONB;
  v_period_start TIME;
  v_period_end   TIME;
  rec           RECORD;
  v_cursor      TIME;
  v_slot_end    TIME;
  v_is_free     BOOLEAN;
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
    WHERE ss.user_id     = p_user_id
      AND ss.day_of_week = v_dow
      AND ss.is_available = TRUE
      AND ss.start_time  < v_period_end
      AND ss.end_time    > v_period_start
    ORDER BY ss.start_time
  LOOP
    v_cursor := rec.win_start;

    WHILE v_cursor + (p_slot_minutes || ' minutes')::INTERVAL <= rec.win_end LOOP
      v_slot_end := (v_cursor + (p_slot_minutes || ' minutes')::INTERVAL)::TIME;

      -- Slot times are in BRT (local); meetings are stored in UTC.
      -- Adding 3h converts BRT slot boundaries to UTC for a correct overlap check.
      SELECT NOT EXISTS (
        SELECT 1
        FROM meetings m
        WHERE m.user_id = p_user_id
          AND m.status NOT IN ('cancelada', 'cancelado')
          AND m.start_time < (p_date + v_slot_end  + INTERVAL '3 hours')
          AND m.end_time   > (p_date + v_cursor     + INTERVAL '3 hours')
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


ALTER FUNCTION "public"."get_available_slots"("p_user_id" "uuid", "p_date" "date", "p_period" "text", "p_slot_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rs_id           uuid;
  v_rule_team_ids   text[];
  v_found_team_rule boolean := false;
  v_team_user_ids   uuid[];
  v_result          uuid[];
BEGIN
  -- Resolve rule set
  IF p_rule_set_id IS NOT NULL THEN
    v_rs_id := p_rule_set_id;
  ELSE
    SELECT id INTO v_rs_id
    FROM public.booking_rule_sets
    WHERE is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Verifica se existe regra team_priority
  IF v_rs_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(br.config->'team_ids', '[]'::jsonb))
    )
    INTO v_rule_team_ids
    FROM public.booking_rules br
    WHERE br.rule_set_id = v_rs_id
      AND br.rule_type   = 'team_priority'
      AND br.is_active   = true
    ORDER BY br.order_index ASC
    LIMIT 1;

    v_found_team_rule := FOUND;

    IF v_found_team_rule THEN
      IF v_rule_team_ids IS NOT NULL AND array_length(v_rule_team_ids, 1) > 0 THEN
        -- Times específicos
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          WHERE sut.team_id = ANY(v_rule_team_ids::uuid[])
        ) INTO v_team_user_ids;
      ELSE
        -- Qualquer membro de time ativo
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          INNER JOIN public.settings_teams st ON st.id = sut.team_id
          WHERE st.active = true
        ) INTO v_team_user_ids;
      END IF;

      -- Se não encontrou nenhum membro, ignora filtro (evita quebrar tudo)
      IF v_team_user_ids IS NOT NULL AND array_length(v_team_user_ids, 1) > 0 THEN
        -- Filtra para usuários ativos que estão na lista do time
        SELECT ARRAY(
          SELECT su.id
          FROM public.settings_users su
          WHERE su.active = true
            AND (su.deleted_at IS NULL)
            AND su.id = ANY(v_team_user_ids)
        ) INTO v_result;
        RETURN v_result;
      END IF;
    END IF;
  END IF;

  -- Sem filtro de time: todos os usuários ativos
  SELECT ARRAY(
    SELECT su.id
    FROM public.settings_users su
    WHERE su.active = true
      AND (su.deleted_at IS NULL)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid" DEFAULT NULL::"uuid", "p_pipeline_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rs_id           uuid;
  v_rule_team_ids   text[];
  v_found_team_rule boolean := false;
  v_team_user_ids   uuid[];
  v_result          uuid[];
  v_filtered        uuid[];
BEGIN
  -- Resolve rule set
  IF p_rule_set_id IS NOT NULL THEN
    v_rs_id := p_rule_set_id;
  ELSE
    SELECT id INTO v_rs_id
    FROM public.booking_rule_sets
    WHERE is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Verifica se existe regra team_priority
  IF v_rs_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(br.config->'team_ids', '[]'::jsonb))
    )
    INTO v_rule_team_ids
    FROM public.booking_rules br
    WHERE br.rule_set_id = v_rs_id
      AND br.rule_type   = 'team_priority'
      AND br.is_active   = true
    ORDER BY br.order_index ASC
    LIMIT 1;

    v_found_team_rule := FOUND;

    IF v_found_team_rule THEN
      IF v_rule_team_ids IS NOT NULL AND array_length(v_rule_team_ids, 1) > 0 THEN
        -- Times específicos
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          WHERE sut.team_id = ANY(v_rule_team_ids::uuid[])
        ) INTO v_team_user_ids;
      ELSE
        -- Qualquer membro de time ativo
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          INNER JOIN public.settings_teams st ON st.id = sut.team_id
          WHERE st.active = true
        ) INTO v_team_user_ids;
      END IF;

      -- Se não encontrou nenhum membro, ignora filtro (evita quebrar tudo)
      IF v_team_user_ids IS NOT NULL AND array_length(v_team_user_ids, 1) > 0 THEN
        -- Filtra para usuários ativos que estão na lista do time
        SELECT ARRAY(
          SELECT su.id
          FROM public.settings_users su
          WHERE su.active = true
            AND (su.deleted_at IS NULL)
            AND su.id = ANY(v_team_user_ids)
        ) INTO v_result;
      END IF;
    END IF;
  END IF;

  -- Sem filtro de time (ou nenhum membro encontrado): todos os usuários ativos
  IF v_result IS NULL OR array_length(v_result, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT su.id
      FROM public.settings_users su
      WHERE su.active = true
        AND (su.deleted_at IS NULL)
    ) INTO v_result;
  END IF;

  -- Filtro de pipeline: restringe a usuários de equipe(s) elegível(eis) pra
  -- esse pipeline. Equipe sem nenhuma linha em settings_teams_pipelines =
  -- atende todos os pipelines (universal). Se o filtro zerar o pool, ignora
  -- (mesmo princípio defensivo do filtro de time acima — nunca trava o
  -- agendamento por config incompleta).
  IF p_pipeline_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT DISTINCT su.id
      FROM public.settings_users su
      INNER JOIN public.settings_users_teams sut ON sut.user_id = su.id
      INNER JOIN public.settings_teams st ON st.id = sut.team_id
      WHERE su.id = ANY(v_result)
        AND (
          NOT EXISTS (SELECT 1 FROM public.settings_teams_pipelines stp WHERE stp.team_id = st.id)
          OR EXISTS (
            SELECT 1 FROM public.settings_teams_pipelines stp
            WHERE stp.team_id = st.id AND stp.pipeline_id = p_pipeline_id
          )
        )
    ) INTO v_filtered;

    IF v_filtered IS NOT NULL AND array_length(v_filtered, 1) > 0 THEN
      v_result := v_filtered;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid", "p_pipeline_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_session"("p_lead_id" "uuid", "p_rule_set_id" "uuid" DEFAULT NULL::"uuid", "p_duration" integer DEFAULT 30, "p_days_ahead" integer DEFAULT 14) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_first_name text;
  v_has_email  boolean;
  v_pipeline_id uuid;
  v_user_ids uuid[];
  v_slots json;
  v_existing public.meetings%ROWTYPE;
  v_existing_consultor_name text;
BEGIN
  SELECT split_part(COALESCE(cp.name, 'Cliente'), ' ', 1),
         (cp.email IS NOT NULL AND btrim(cp.email) <> ''),
         l.leads_pipelines_id
    INTO v_first_name, v_has_email, v_pipeline_id
    FROM public.leads l
    LEFT JOIN public.clients_people cp ON cp.id = l.people_id
    WHERE l.id = p_lead_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Lead not found'); END IF;
  v_has_email := COALESCE(v_has_email, false);

  -- #3 — reunião ativa futura já marcada para este lead → retorna sem gerar slots
  SELECT m.* INTO v_existing
    FROM public.meetings m
    WHERE m.lead_id = p_lead_id
      AND m.status NOT IN ('cancelado', 'cancelada')
      AND m.end_time > NOW()
    ORDER BY m.start_time ASC
    LIMIT 1;
  IF FOUND THEN
    SELECT su.name INTO v_existing_consultor_name
      FROM public.settings_users su WHERE su.id = v_existing.user_id;
    RETURN json_build_object(
      'person', json_build_object('name', v_first_name, 'has_email', v_has_email),
      'slots', '[]'::json,
      'existing_meeting', json_build_object(
        'meeting_id', v_existing.id::text,
        'start_time', to_char(v_existing.start_time AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS'),
        'end_time',   to_char(v_existing.end_time   AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS'),
        'consultor', json_build_object(
          'id', v_existing.user_id::text,
          'name', v_existing_consultor_name
        )
      )
    );
  END IF;

  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id, v_pipeline_id);
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  SELECT json_agg(json_build_object('date', slot_date, 'start_time', start_time, 'end_time', end_time, 'user_ids', user_ids) ORDER BY slot_date, start_time)
    INTO v_slots
    FROM (
      SELECT g.slot_date, g.start_time, g.end_time,
        ( SELECT json_agg(DISTINCT su.id)
            FROM public.settings_users su
            WHERE su.id = ANY(v_user_ids)
              AND su.active = true
              AND NOT EXISTS (
                SELECT 1 FROM public.meetings m
                WHERE m.user_id = su.id
                  AND m.start_time < g.ts_end::timestamptz
                  AND m.end_time   > g.ts_start::timestamptz
                  AND m.status NOT IN ('cancelado', 'cancelada')
              )
        ) AS user_ids
      FROM (
        SELECT DISTINCT slot_date, start_time, end_time, ts_start, ts_end
        FROM (
          SELECT
            TO_CHAR(dr.d, 'YYYY-MM-DD') AS slot_date,
            TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes'), 'HH24:MI') AS start_time,
            TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute'), 'HH24:MI') AS end_time,
            dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes')) AS ts_start,
            dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')) AS ts_end
          FROM (SELECT (CURRENT_DATE + s.n)::date AS d FROM generate_series(0, p_days_ahead - 1) AS s(n)) AS dr
          CROSS JOIN (SELECT unnest(v_user_ids) AS id) AS cand
          INNER JOIN public.settings_users su ON su.id = cand.id AND su.active = true
          INNER JOIN public.settings_schedules ss ON ss.user_id = su.id AND ss.day_of_week = EXTRACT(DOW FROM dr.d)::int AND ss.is_available = true
          CROSS JOIN LATERAL (
            SELECT s2.n FROM generate_series(0, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800)::int - 1)) AS s2(n)
            WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute') <= ss.end_time::time
          ) AS n
        ) AS raw_slots
        WHERE raw_slots.ts_start > (NOW() AT TIME ZONE 'America/Sao_Paulo')
      ) AS g
    ) AS grouped
    WHERE user_ids IS NOT NULL;

  RETURN json_build_object(
    'person', json_build_object('name', v_first_name, 'has_email', v_has_email),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$$;


ALTER FUNCTION "public"."get_booking_session"("p_lead_id" "uuid", "p_rule_set_id" "uuid", "p_duration" integer, "p_days_ahead" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_settings_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id
  FROM public.settings_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_current_settings_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;


ALTER FUNCTION "public"."get_current_user_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_insights_context"("p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_pipeline_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  result      jsonb := '{}'::jsonb;
  v_funnel    jsonb;
  v_people    jsonb;
  v_messages  jsonb;
  v_meetings  jsonb;
  v_calls     jsonb;
  v_marketing jsonb;
  v_prospect  jsonb;
  v_pipelines jsonb;
  v_has_prospect boolean;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 0: AVAILABLE PIPELINES (for LLM context)
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]'::jsonb)
  INTO v_pipelines
  FROM leads_pipelines
  WHERE active = true;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 1: FUNNEL
  -- ═══════════════════════════════════════════════════════════════════════
  WITH lead_base AS (
    SELECT l.id, l.status, l.value, l.leads_stages_id, l.leads_pipelines_id,
           l.leads_loss_reasons_id, l.created_at, l.won_at
    FROM leads l
    WHERE (p_date_from  IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to    IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
  ),
  stages_agg AS (
    SELECT
      ls.name AS stage_name,
      ls.order_index,
      COUNT(lb.id) AS lead_count,
      COALESCE(SUM(lb.value), 0) AS total_value,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - lb.created_at)) / 86400)::numeric, 1) AS avg_days
    FROM lead_base lb
    JOIN leads_stages ls ON ls.id = lb.leads_stages_id
    WHERE lb.status = 'in_progress'
    GROUP BY ls.name, ls.order_index
    ORDER BY ls.order_index
  ),
  loss_reasons AS (
    SELECT
      COALESCE(lr.name, 'Sem motivo') AS reason,
      COUNT(*) AS cnt
    FROM lead_base lb
    LEFT JOIN leads_loss_reasons lr ON lr.id = lb.leads_loss_reasons_id
    WHERE lb.status = 'lost'
    GROUP BY lr.name
    ORDER BY cnt DESC
    LIMIT 5
  ),
  funnel_totals AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'won')         AS won,
      COUNT(*) FILTER (WHERE status = 'lost')        AS lost,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS active,
      COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0) AS revenue,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - created_at)) / 86400)
             FILTER (WHERE status = 'won' AND won_at IS NOT NULL))::numeric, 1) AS avg_cycle_days
    FROM lead_base
  )
  SELECT jsonb_build_object(
    'total',           ft.total,
    'won',             ft.won,
    'lost',            ft.lost,
    'active',          ft.active,
    'revenue',         ft.revenue,
    'avg_deal',        CASE WHEN ft.won > 0 THEN ROUND((ft.revenue / ft.won)::numeric, 2) ELSE 0 END,
    'conversion_pct',  CASE WHEN ft.total > 0 THEN ROUND((ft.won::numeric / ft.total * 100), 1) ELSE 0 END,
    'avg_cycle_days',  COALESCE(ft.avg_cycle_days, 0),
    'stages',          COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'name', s.stage_name, 'leads', s.lead_count,
                         'value', s.total_value, 'avg_days', s.avg_days
                       ) ORDER BY s.order_index) FROM stages_agg s), '[]'::jsonb),
    'loss_reasons',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'reason', r.reason, 'count', r.cnt
                       )) FROM loss_reasons r), '[]'::jsonb)
  ) INTO v_funnel
  FROM funnel_totals ft;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 2: PEOPLE & COMPANIES
  -- ═══════════════════════════════════════════════════════════════════════
  WITH people_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'ativo')  AS active,
      COUNT(*) FILTER (WHERE status != 'ativo') AS inactive,
      COUNT(*) FILTER (WHERE score BETWEEN 0  AND 25)  AS score_0_25,
      COUNT(*) FILTER (WHERE score BETWEEN 26 AND 50)  AS score_26_50,
      COUNT(*) FILTER (WHERE score BETWEEN 51 AND 75)  AS score_51_75,
      COUNT(*) FILTER (WHERE score BETWEEN 76 AND 100) AS score_76_100
    FROM clients_people
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  top_sources AS (
    SELECT source, COUNT(*) AS cnt
    FROM clients_people
    WHERE source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY source
    ORDER BY cnt DESC
    LIMIT 5
  ),
  company_stats AS (
    SELECT COUNT(*) AS total, COUNT(*) AS active FROM clients_companies
  )
  SELECT jsonb_build_object(
    'people_total',    ps.total,
    'people_active',   ps.active,
    'people_inactive', ps.inactive,
    'score_distribution', jsonb_build_object(
      '0_25', ps.score_0_25, '26_50', ps.score_26_50,
      '51_75', ps.score_51_75, '76_100', ps.score_76_100
    ),
    'top_sources',      COALESCE((SELECT jsonb_agg(jsonb_build_object('source', ts.source, 'count', ts.cnt)) FROM top_sources ts), '[]'::jsonb),
    'companies_total',  cs.total,
    'companies_active', cs.active
  ) INTO v_people
  FROM people_stats ps, company_stats cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 3: MESSAGES
  -- ═══════════════════════════════════════════════════════════════════════
  WITH msg_base AS (
    SELECT id, channel, from_contact, created_at, lead_id
    FROM messages
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  by_channel AS (
    SELECT channel, COUNT(*) AS cnt FROM msg_base GROUP BY channel ORDER BY cnt DESC
  ),
  by_sender AS (
    SELECT from_contact, COUNT(*) AS cnt FROM msg_base GROUP BY from_contact
  ),
  daily_trend AS (
    SELECT created_at::date AS day, COUNT(*) AS cnt
    FROM msg_base
    WHERE created_at >= (COALESCE(p_date_to, now()) - interval '7 days')
    GROUP BY day ORDER BY day
  ),
  abandoned AS (
    SELECT COUNT(DISTINCT lead_id) AS cnt
    FROM (
      SELECT lead_id, from_contact, created_at,
             LEAD(from_contact) OVER (PARTITION BY lead_id ORDER BY created_at) AS next_sender,
             LEAD(created_at)   OVER (PARTITION BY lead_id ORDER BY created_at) AS next_at
      FROM msg_base
    ) sub
    WHERE from_contact = 'cliente'
      AND (next_sender IS NULL OR (next_sender != 'cliente' AND next_at - created_at > interval '24 hours'))
  )
  SELECT jsonb_build_object(
    'total',                   (SELECT COUNT(*) FROM msg_base),
    'by_channel',              COALESCE((SELECT jsonb_agg(jsonb_build_object('channel', c.channel, 'count', c.cnt)) FROM by_channel c), '[]'::jsonb),
    'by_sender',               COALESCE((SELECT jsonb_agg(jsonb_build_object('sender', s.from_contact, 'count', s.cnt)) FROM by_sender s), '[]'::jsonb),
    'daily_trend',             COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt)) FROM daily_trend d), '[]'::jsonb),
    'abandoned_conversations', ab.cnt
  ) INTO v_messages
  FROM abandoned ab;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 4: MEETINGS
  -- ═══════════════════════════════════════════════════════════════════════
  WITH mtg_base AS (
    SELECT m.id, m.status, m.start_time, m.user_id, m.lead_id,
           l.created_at AS lead_created, l.won_at,
           l.utm_campaign, l.utm_source
    FROM meetings m
    LEFT JOIN leads l ON l.id = m.lead_id
    WHERE (p_date_from IS NULL OR m.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR m.created_at <= p_date_to)
      AND (m.source IS NULL OR m.source != 'google')
  ),
  by_status AS (
    SELECT status, COUNT(*) AS cnt FROM mtg_base GROUP BY status
  ),
  show_rate_by_user AS (
    SELECT
      COALESCE(su.name, 'Sem responsável') AS closer_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE mb.status IN ('compareceu', 'realizado')) AS attended,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE mb.status IN ('compareceu', 'realizado')))::numeric / COUNT(*) * 100, 1)
        ELSE 0 END AS show_rate
    FROM mtg_base mb
    LEFT JOIN settings_users su ON su.id = mb.user_id
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 5
  ),
  time_metrics AS (
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (start_time - lead_created)) / 86400)::numeric, 1) AS avg_lead_to_meeting,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - start_time)) / 86400) FILTER (WHERE won_at IS NOT NULL))::numeric, 1) AS avg_meeting_to_close
    FROM mtg_base
    WHERE lead_created IS NOT NULL
  ),
  meetings_by_campaign AS (
    SELECT
      COALESCE(l.utm_campaign, l.utm_source, 'Sem campanha') AS campaign,
      COUNT(DISTINCT l.id) AS leads,
      COUNT(DISTINCT m2.id) AS meetings,
      COUNT(DISTINCT m2.id) FILTER (WHERE m2.status IN ('compareceu', 'realizado')) AS attended,
      COUNT(DISTINCT m2.id) FILTER (WHERE m2.status IN ('nao_compareceu', 'não compareceu', 'cancelado', 'cancelada')) AS no_show,
      COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') AS won
    FROM leads l
    LEFT JOIN meetings m2 ON m2.lead_id = l.id AND (m2.source IS NULL OR m2.source != 'google')
    WHERE (l.utm_source IS NOT NULL OR l.utm_campaign IS NOT NULL)
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
    GROUP BY COALESCE(l.utm_campaign, l.utm_source, 'Sem campanha')
    ORDER BY leads DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total',                    (SELECT COUNT(*) FROM mtg_base),
    'by_status',                COALESCE((SELECT jsonb_agg(jsonb_build_object('status', bs.status, 'count', bs.cnt)) FROM by_status bs), '[]'::jsonb),
    'show_rate_by_closer',      COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                  'name', sr.closer_name, 'total', sr.total,
                                  'attended', sr.attended, 'show_rate', sr.show_rate
                                )) FROM show_rate_by_user sr), '[]'::jsonb),
    'avg_lead_to_meeting_days', COALESCE(tm.avg_lead_to_meeting, 0),
    'avg_meeting_to_close_days',COALESCE(tm.avg_meeting_to_close, 0),
    'by_campaign',              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                  'campaign', mc.campaign, 'leads', mc.leads, 'meetings', mc.meetings,
                                  'attended', mc.attended, 'no_show', mc.no_show, 'won', mc.won
                                )) FROM meetings_by_campaign mc), '[]'::jsonb)
  ) INTO v_meetings
  FROM time_metrics tm;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 5: CALLS
  -- ═══════════════════════════════════════════════════════════════════════
  WITH call_base AS (
    SELECT id, direction, status, duration, user_id, outcome, tags
    FROM call_pro_calls
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  call_summary AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE direction = 'inbound')  AS inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound,
      COUNT(*) FILTER (WHERE status IN ('answered', 'handled')) AS answered,
      ROUND((AVG(duration) FILTER (WHERE duration > 0))::numeric, 0) AS avg_duration_sec
    FROM call_base
  ),
  top_operators AS (
    SELECT
      COALESCE(su.name, 'Desconhecido') AS operator_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE cb.status IN ('answered', 'handled')) AS answered
    FROM call_base cb
    LEFT JOIN settings_users su ON su.id = cb.user_id
    WHERE cb.user_id IS NOT NULL
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 3
  ),
  top_outcomes AS (
    SELECT outcome, COUNT(*) AS cnt
    FROM call_base
    WHERE outcome IS NOT NULL AND outcome != ''
    GROUP BY outcome
    ORDER BY cnt DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'total',           cs.total,
    'inbound',         cs.inbound,
    'outbound',        cs.outbound,
    'answered',        cs.answered,
    'answer_rate',     CASE WHEN cs.total > 0 THEN ROUND((cs.answered::numeric / cs.total * 100), 1) ELSE 0 END,
    'avg_duration_sec',COALESCE(cs.avg_duration_sec, 0),
    'top_operators',   COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'name', op.operator_name, 'total', op.total, 'answered', op.answered
                       )) FROM top_operators op), '[]'::jsonb),
    'top_outcomes',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'outcome', o.outcome, 'count', o.cnt
                       )) FROM top_outcomes o), '[]'::jsonb)
  ) INTO v_calls
  FROM call_summary cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 6: MARKETING
  -- ═══════════════════════════════════════════════════════════════════════
  WITH sends_summary AS (
    SELECT
      COUNT(*) AS total_sends,
      SUM(total_contacts)  AS total_contacts,
      SUM(sent_count)      AS total_sent,
      SUM(delivered_count) AS total_delivered,
      SUM(read_count)      AS total_read
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  sends_by_channel AS (
    SELECT channel, COUNT(*) AS cnt,
           SUM(sent_count) AS sent, SUM(delivered_count) AS delivered, SUM(read_count) AS read_cnt
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY channel
  ),
  lp_stats AS (
    SELECT f.name AS page_name, COUNT(s.id) AS submissions
    FROM form_pro_forms f
    LEFT JOIN form_pro_submissions s ON s.form_id = f.id
      AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
      AND (p_date_to   IS NULL OR s.submitted_at <= p_date_to)
    GROUP BY f.name
    ORDER BY submissions DESC
    LIMIT 5
  ),
  utm_stats AS (
    SELECT
      COALESCE(utm_source, 'direto') AS source,
      COALESCE(utm_medium, 'none')   AS medium,
      COUNT(*) AS leads,
      COUNT(*) FILTER (WHERE status = 'won') AS won
    FROM leads
    WHERE utm_source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR leads_pipelines_id = p_pipeline_id)
    GROUP BY utm_source, utm_medium
    ORDER BY leads DESC
    LIMIT 5
  ),
  meta_forms_stats AS (
    SELECT mf.name AS form_name, COUNT(DISTINCT l.id) AS leads_count
    FROM meta_lead_forms mf
    LEFT JOIN form_pro_submissions fps ON fps.meta_form_id = mf.id
      AND (p_date_from IS NULL OR fps.submitted_at >= p_date_from)
      AND (p_date_to   IS NULL OR fps.submitted_at <= p_date_to)
    LEFT JOIN leads l ON l.id = fps.lead_id
    WHERE mf.status = 'active'
    GROUP BY mf.name
    ORDER BY leads_count DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'sends', jsonb_build_object(
      'total_campaigns', ss.total_sends,
      'total_sent',      COALESCE(ss.total_sent, 0),
      'total_delivered', COALESCE(ss.total_delivered, 0),
      'total_read',      COALESCE(ss.total_read, 0),
      'delivery_rate',   CASE WHEN COALESCE(ss.total_sent, 0) > 0
                           THEN ROUND((COALESCE(ss.total_delivered, 0)::numeric / ss.total_sent * 100), 1) ELSE 0 END,
      'read_rate',       CASE WHEN COALESCE(ss.total_delivered, 0) > 0
                           THEN ROUND((COALESCE(ss.total_read, 0)::numeric / ss.total_delivered * 100), 1) ELSE 0 END,
      'by_channel',      COALESCE((SELECT jsonb_agg(jsonb_build_object(
                           'channel', sc.channel, 'campaigns', sc.cnt,
                           'sent', sc.sent, 'delivered', sc.delivered, 'read', sc.read_cnt
                         )) FROM sends_by_channel sc), '[]'::jsonb)
    ),
    'landing_pages',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'form', lps.page_name, 'submissions', lps.submissions
                        )) FROM lp_stats lps WHERE lps.submissions > 0), '[]'::jsonb),
    'utm_attribution',  COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'source', u.source, 'medium', u.medium, 'leads', u.leads, 'won', u.won
                        )) FROM utm_stats u), '[]'::jsonb),
    'meta_forms',       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'form', mfs.form_name, 'leads', mfs.leads_count
                        )) FROM meta_forms_stats mfs), '[]'::jsonb)
  ) INTO v_marketing
  FROM sends_summary ss;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 7: PROSPECT PRO (guarded — table may not exist)
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'prospect_campaigns' AND n.nspname = 'public'
  ) INTO v_has_prospect;

  IF v_has_prospect THEN
    EXECUTE $prospect$
      WITH prospect_campaigns_agg AS (
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'running')   AS running,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed
        FROM prospect_campaigns
        WHERE ($1 IS NULL OR created_at >= $1)
          AND ($2 IS NULL OR created_at <= $2)
      ),
      prospect_contacts_agg AS (
        SELECT 0 AS total, 0 AS raw_cnt, 0 AS filtered_cnt,
               0 AS enriched_cnt, 0 AS approved_cnt, 0 AS rejected_cnt,
               0 AS avg_ai_score
      )
      SELECT jsonb_build_object(
        'campaigns_total',     pca.total,
        'campaigns_running',   pca.running,
        'campaigns_completed', pca.completed,
        'contacts_total',      pcta.total,
        'contacts_by_status',  jsonb_build_object(
          'raw', pcta.raw_cnt, 'filtered', pcta.filtered_cnt,
          'enriched', pcta.enriched_cnt, 'approved', pcta.approved_cnt, 'rejected', pcta.rejected_cnt
        ),
        'avg_ai_score',  COALESCE(pcta.avg_ai_score, 0),
        'approval_rate', 0
      ) FROM prospect_campaigns_agg pca, prospect_contacts_agg pcta
    $prospect$ INTO v_prospect USING p_date_from, p_date_to;
  ELSE
    v_prospect := jsonb_build_object(
      'campaigns_total', 0, 'campaigns_running', 0, 'campaigns_completed', 0,
      'contacts_total', 0, 'avg_ai_score', 0, 'approval_rate', 0,
      'installed', false
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ASSEMBLE
  -- ═══════════════════════════════════════════════════════════════════════
  result := jsonb_build_object(
    'pipelines', COALESCE(v_pipelines, '[]'::jsonb),
    'funnel',    COALESCE(v_funnel,    '{}'::jsonb),
    'people',    COALESCE(v_people,    '{}'::jsonb),
    'messages',  COALESCE(v_messages,  '{}'::jsonb),
    'meetings',  COALESCE(v_meetings,  '{}'::jsonb),
    'calls',     COALESCE(v_calls,     '{}'::jsonb),
    'marketing', COALESCE(v_marketing, '{}'::jsonb),
    'prospect',  COALESCE(v_prospect,  '{}'::jsonb)
  );

  RETURN result;
END;
$_$;


ALTER FUNCTION "public"."get_insights_context"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_pipeline_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_omni_contacts"("p_search_term" "text" DEFAULT NULL::"text", "p_status_atend" "text" DEFAULT NULL::"text", "p_atend_ia" "text" DEFAULT NULL::"text", "p_filtro_data" "text" DEFAULT NULL::"text", "p_responsavel" "text" DEFAULT NULL::"text", "p_pipeline" "text" DEFAULT NULL::"text", "p_etapa" "text" DEFAULT NULL::"text", "p_time" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_tag" "text" DEFAULT NULL::"text", "p_channel" "text" DEFAULT NULL::"text") RETURNS TABLE("contact" "jsonb", "total_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    to_jsonb(p.*)    AS contact,
    COUNT(*) OVER()  AS total_count
  FROM public.clients_people p
  WHERE
    (
      p.whatsapp               IS NOT NULL
      OR p.instagram_id          IS NOT NULL
      OR p.tiktok_open_id        IS NOT NULL
      OR p.manychat_subscriber_id IS NOT NULL
      OR p.email                 IS NOT NULL
    )
    AND p.status <> 'merged'
    AND (
      p_search_term IS NULL OR p_search_term = '' OR
      p.name              ILIKE '%' || p_search_term || '%' OR
      p.whatsapp          ILIKE '%' || p_search_term || '%' OR
      p.email             ILIKE '%' || p_search_term || '%' OR
      p.instagram_user_id ILIKE '%' || p_search_term || '%'
    )
    AND (
      p_status_atend IS NULL
      OR (p_status_atend = 'open'   AND (p.service_status = 'open'   OR p.service_status IS NULL))
      OR (p_status_atend <> 'open'  AND p.service_status = p_status_atend)
    )
    AND (
      p_atend_ia IS NULL OR
      (p_atend_ia = 'ia_ativa' AND p.ai_enabled = true) OR
      (p_atend_ia = 'humano'   AND p.ai_enabled = false)
    )
    AND (
      p_filtro_data IS NULL OR
      p.updated_at BETWEEN
        (split_part(p_filtro_data, '_', 1) || 'T00:00:00')::timestamptz
        AND (split_part(p_filtro_data, '_', 2) || 'T23:59:59')::timestamptz
    )
    AND (
      p_responsavel IS NULL
      OR NOT EXISTS (
           SELECT 1 FROM public.leads l
           WHERE l.people_id = p.id
             AND l.status NOT IN ('lost', 'archived')
         )
      OR EXISTS (
           SELECT 1 FROM public.leads l
           WHERE l.people_id = p.id
             AND (l.user_id = p_responsavel::uuid OR l.user_id IS NULL)
         )
    )
    AND (
      p_pipeline IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_pipelines_id = p_pipeline::uuid
      )
    )
    AND (
      p_etapa IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_stages_id = p_etapa::uuid
      )
    )
    AND (
      p_time IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.teams_id = p_time::uuid
      )
    )
    AND (
      p_tag IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        JOIN public.leads_tags lt ON lt.lead_id = l.id
        WHERE l.people_id = p.id
          AND lt.tag_id = p_tag::uuid
      )
    )
    AND (
      p_channel IS NULL OR p.active_channel_id = p_channel::uuid
    )
  ORDER BY p.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_omni_contacts"("p_search_term" "text", "p_status_atend" "text", "p_atend_ia" "text", "p_filtro_data" "text", "p_responsavel" "text", "p_pipeline" "text", "p_etapa" "text", "p_time" "text", "p_limit" integer, "p_offset" integer, "p_tag" "text", "p_channel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_settings"() RETURNS TABLE("company_name" "text", "logo_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT company_name, logo_url
  FROM   public.settings
  LIMIT  1;
$$;


ALTER FUNCTION "public"."get_public_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_meeting_followup_queue"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_status    text;
  rule_rec    record;
  delay_secs  bigint;
  fire_at     timestamptz;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  v_status := CASE NEW.status
    WHEN 'agendada'        THEN 'agendado'
    WHEN 'agendado'        THEN 'agendado'
    WHEN 'compareceu'      THEN 'compareceu'
    WHEN 'nao_compareceu'  THEN 'nao_compareceu'
    WHEN 'não compareceu'  THEN 'nao_compareceu'
    WHEN 'cancelado'       THEN 'cancelado'
    WHEN 'cancelada'       THEN 'cancelado'
    WHEN 'realizado'       THEN 'realizado'
    ELSE NULL
  END;

  IF v_status IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id AND status = 'pending';
  END IF;

  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true AND meeting_status = v_status
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    IF v_status = 'agendado' AND delay_secs = 0 THEN
      fire_at := now();
    ELSIF v_status = 'agendado' THEN
      fire_at := NEW.start_time - (delay_secs * interval '1 second');
    ELSE
      fire_at := now() + (delay_secs * interval '1 second');
    END IF;

    -- Skip pre-meeting reminders that would fire in the past at booking time
    -- Always allow immediate triggers (delay_secs = 0) and post-event followups
    IF delay_secs > 0 AND v_status = 'agendado' AND fire_at < now() - interval '10 minutes' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, person_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      fire_at,
      rule_rec.channel,
      COALESCE(rule_rec.webhook_url, ''),
      rule_rec.message
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_meeting_followup_queue"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_meeting_followup_queue"() IS 'Trigger: enqueues followup rules when meeting.status changes. Column names fixed post-FWUP-11b (person_id) and post-FWUP-12 (lead_id). SECURITY DEFINER bypasses RLS for the INSERT into meeting_followup_queue.';



CREATE OR REPLACE FUNCTION "public"."import_pessoa_with_flexible_lead"("pessoa_data" "jsonb", "pipeline_id_param" "uuid", "tenant_id_param" "uuid", "modo_operacao" "text" DEFAULT 'criar'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  nova_pessoa_id uuid;
  pessoa_existente_id uuid;
  primeiro_stage_id uuid;
  novo_lead_id uuid;
  lead_existente_id uuid;
  result jsonb;
  operacao_pessoa text;
  operacao_negocio text;
BEGIN
  -- Validar entrada
  IF pessoa_data IS NULL OR tenant_id_param IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios não fornecidos';
  END IF;
  
  -- Validar modo de operação
  IF modo_operacao NOT IN ('nenhum', 'criar', 'criar-ou-atualizar') THEN
    RAISE EXCEPTION 'Modo de operação inválido: %', modo_operacao;
  END IF;
  
  -- Se modo é 'nenhum', só criar pessoa sem negócio
  IF modo_operacao = 'nenhum' THEN
    -- Verificar se pessoa já existe
    SELECT id INTO pessoa_existente_id
    FROM crm_pessoas 
    WHERE tenant_id = tenant_id_param 
    AND status != 'arquivado'
    AND (
      (whatsapp IS NOT NULL AND whatsapp = pessoa_data->>'whatsapp' AND pessoa_data->>'whatsapp' != '')
      OR (email IS NOT NULL AND email = pessoa_data->>'email' AND pessoa_data->>'email' != '')
    )
    LIMIT 1;
    
    IF pessoa_existente_id IS NOT NULL THEN
      -- Atualizar pessoa existente
      UPDATE crm_pessoas SET
        nome = COALESCE(pessoa_data->>'nome', nome),
        email = COALESCE(NULLIF(pessoa_data->>'email', ''), email),
        whatsapp = COALESCE(NULLIF(pessoa_data->>'whatsapp', ''), whatsapp),
        observacoes = COALESCE(NULLIF(pessoa_data->>'observacoes', ''), observacoes),
        score = CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE score END,
        renda = COALESCE(NULLIF(pessoa_data->>'renda', ''), renda),
        momento = COALESCE(NULLIF(pessoa_data->>'momento', ''), momento),
        objetivo = COALESCE(NULLIF(pessoa_data->>'objetivo', ''), objetivo),
        updated_at = now()
      WHERE id = pessoa_existente_id;
      
      nova_pessoa_id := pessoa_existente_id;
      operacao_pessoa := 'atualizada';
    ELSE
      -- Criar nova pessoa
      INSERT INTO crm_pessoas (
        nome, email, whatsapp, tenant_id, status, aceita_ligacao,
        observacoes, score, renda, momento, objetivo
      ) VALUES (
        pessoa_data->>'nome',
        NULLIF(pessoa_data->>'email', ''),
        NULLIF(pessoa_data->>'whatsapp', ''),
        tenant_id_param,
        COALESCE(pessoa_data->>'status', 'ativo'),
        COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
        NULLIF(pessoa_data->>'observacoes', ''),
        CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE NULL END,
        NULLIF(pessoa_data->>'renda', ''),
        NULLIF(pessoa_data->>'momento', ''),
        NULLIF(pessoa_data->>'objetivo', '')
      ) RETURNING id INTO nova_pessoa_id;
      
      operacao_pessoa := 'criada';
    END IF;
    
    -- Retornar resultado sem negócio
    result := jsonb_build_object(
      'pessoa_id', nova_pessoa_id,
      'lead_id', null,
      'operacao_pessoa', operacao_pessoa,
      'operacao_negocio', 'nenhuma',
      'success', true
    );
    
    RETURN result;
  END IF;
  
  -- Para modos com negócio, validar pipeline
  IF pipeline_id_param IS NULL THEN
    RAISE EXCEPTION 'Pipeline é obrigatório para criar negócios';
  END IF;
  
  -- Buscar primeiro stage do pipeline
  SELECT id INTO primeiro_stage_id
  FROM crm_stages 
  WHERE pipeline_id = pipeline_id_param 
  AND tenant_id = tenant_id_param 
  AND ativo = true 
  ORDER BY ordem ASC 
  LIMIT 1;
  
  IF primeiro_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline não possui etapas ativas';
  END IF;
  
  -- Verificar se pessoa já existe (por WhatsApp ou email)
  SELECT id INTO pessoa_existente_id
  FROM crm_pessoas 
  WHERE tenant_id = tenant_id_param 
  AND status != 'arquivado'
  AND (
    (whatsapp IS NOT NULL AND whatsapp = pessoa_data->>'whatsapp' AND pessoa_data->>'whatsapp' != '')
    OR (email IS NOT NULL AND email = pessoa_data->>'email' AND pessoa_data->>'email' != '')
  )
  LIMIT 1;
  
  -- Tratar pessoa existente baseado no modo
  IF pessoa_existente_id IS NOT NULL THEN
    IF modo_operacao = 'criar' THEN
      RAISE EXCEPTION 'Pessoa já existe no sistema (WhatsApp ou email duplicado)';
    ELSE -- modo 'criar-ou-atualizar'
      -- Atualizar pessoa existente
      UPDATE crm_pessoas SET
        nome = COALESCE(pessoa_data->>'nome', nome),
        email = COALESCE(NULLIF(pessoa_data->>'email', ''), email),
        whatsapp = COALESCE(NULLIF(pessoa_data->>'whatsapp', ''), whatsapp),
        observacoes = COALESCE(NULLIF(pessoa_data->>'observacoes', ''), observacoes),
        score = CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE score END,
        renda = COALESCE(NULLIF(pessoa_data->>'renda', ''), renda),
        momento = COALESCE(NULLIF(pessoa_data->>'momento', ''), momento),
        objetivo = COALESCE(NULLIF(pessoa_data->>'objetivo', ''), objetivo),
        updated_at = now()
      WHERE id = pessoa_existente_id;
      
      nova_pessoa_id := pessoa_existente_id;
      operacao_pessoa := 'atualizada';
    END IF;
  ELSE
    -- Criar nova pessoa
    INSERT INTO crm_pessoas (
      nome, email, whatsapp, tenant_id, status, aceita_ligacao,
      observacoes, score, renda, momento, objetivo
    ) VALUES (
      pessoa_data->>'nome',
      NULLIF(pessoa_data->>'email', ''),
      NULLIF(pessoa_data->>'whatsapp', ''),
      tenant_id_param,
      COALESCE(pessoa_data->>'status', 'ativo'),
      COALESCE((pessoa_data->>'aceita_ligacao')::boolean, true),
      NULLIF(pessoa_data->>'observacoes', ''),
      CASE WHEN pessoa_data->>'score' != '' THEN (pessoa_data->>'score')::integer ELSE NULL END,
      NULLIF(pessoa_data->>'renda', ''),
      NULLIF(pessoa_data->>'momento', ''),
      NULLIF(pessoa_data->>'objetivo', '')
    ) RETURNING id INTO nova_pessoa_id;
    
    operacao_pessoa := 'criada';
  END IF;
  
  -- Verificar se já existe negócio para esta pessoa no pipeline
  SELECT id INTO lead_existente_id
  FROM crm_leads 
  WHERE person_id = nova_pessoa_id 
  AND pipeline_id = pipeline_id_param 
  AND tenant_id = tenant_id_param
  AND status != 'perdido'
  LIMIT 1;
  
  IF lead_existente_id IS NOT NULL THEN
    IF modo_operacao = 'criar' THEN
      RAISE EXCEPTION 'Já existe negócio ativo para esta pessoa no pipeline selecionado';
    ELSE -- modo 'criar-ou-atualizar'
      -- Atualizar negócio existente
      UPDATE crm_leads SET
        updated_at = now(),
        data_ultima_interacao = now()
      WHERE id = lead_existente_id;
      
      novo_lead_id := lead_existente_id;
      operacao_negocio := 'atualizado';
    END IF;
  ELSE
    -- Criar novo negócio
    INSERT INTO crm_leads (
      person_id, pipeline_id, stage_id, tenant_id, status
    ) VALUES (
      nova_pessoa_id, pipeline_id_param, primeiro_stage_id, tenant_id_param, 'em-andamento'
    ) RETURNING id INTO novo_lead_id;
    
    operacao_negocio := 'criado';
  END IF;
  
  -- Retornar resultado completo
  result := jsonb_build_object(
    'pessoa_id', nova_pessoa_id,
    'lead_id', novo_lead_id,
    'operacao_pessoa', operacao_pessoa,
    'operacao_negocio', operacao_negocio,
    'success', true
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro para debug
    RAISE EXCEPTION 'Erro ao importar pessoa com negócio: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."import_pessoa_with_flexible_lead"("pessoa_data" "jsonb", "pipeline_id_param" "uuid", "tenant_id_param" "uuid", "modo_operacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_field"("table_name" "text", "field_name" "text", "row_id" "uuid", "increment_by" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    table_name, field_name, field_name
  )
  USING increment_by, row_id;
END;
$_$;


ALTER FUNCTION "public"."increment_field"("table_name" "text", "field_name" "text", "row_id" "uuid", "increment_by" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'admin')
      AND active = true
      AND deleted_at IS NULL
  )
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_gestor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_admin_or_manager()
$$;


ALTER FUNCTION "public"."is_admin_or_gestor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type IN ('admin', 'manager'))
      AND active = true
      AND deleted_at IS NULL
  )
$$;


ALTER FUNCTION "public"."is_admin_or_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_sensitive_column"("col_name" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT col_name ILIKE '%_secret' OR col_name ILIKE '%_key' OR col_name ILIKE '%_token' OR col_name ILIKE '%_password';
$$;


ALTER FUNCTION "public"."is_sensitive_column"("col_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lead_pipeline_accessible_to_current_user"("p_leads_pipelines_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_team_ids uuid[];
  v_restricted_team_ids uuid[];
  v_has_universal_team boolean;
BEGIN
  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL OR p_leads_pipelines_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ARRAY(SELECT team_id FROM public.settings_users_teams WHERE user_id = v_user_id)
    INTO v_team_ids;

  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) IS NULL THEN
    RETURN true; -- sem equipe = sem restrição (mesma regra do client)
  END IF;

  SELECT ARRAY(SELECT DISTINCT team_id FROM public.settings_teams_pipelines WHERE team_id = ANY(v_team_ids))
    INTO v_restricted_team_ids;

  -- Qualquer equipe do usuário sem NENHUM vínculo em settings_teams_pipelines
  -- é "universal" (atende todos os pipelines) — basta uma pra liberar tudo.
  v_has_universal_team := EXISTS (
    SELECT 1 FROM unnest(v_team_ids) AS t(id)
    WHERE NOT (id = ANY(COALESCE(v_restricted_team_ids, ARRAY[]::uuid[])))
  );
  IF v_has_universal_team THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.settings_teams_pipelines stp
    WHERE stp.team_id = ANY(v_team_ids)
      AND stp.pipeline_id = p_leads_pipelines_id
  );
END;
$$;


ALTER FUNCTION "public"."lead_pipeline_accessible_to_current_user"("p_leads_pipelines_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_pipeline_to_kiwify_product"("p_pipeline_id" "uuid", "p_product_id" "text", "p_product_name" "text", "p_move_existing_leads" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_old_product_id text;
  v_conflicting_pipeline_id uuid;
  v_conflicting_pipeline_name text;
  v_first_stage_id uuid;
  v_trigger text;
  v_mappings_synced int := 0;
  v_leads_moved int := 0;
  v_triggers text[] := ARRAY[
    'boleto_gerado', 'pix_gerado', 'carrinho_abandonado', 'compra_recusada',
    'compra_aprovada', 'compra_reembolsada', 'chargeback',
    'subscription_canceled', 'subscription_late', 'subscription_renewed'
  ];
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'Apenas admin/manager pode vincular pipeline a produto';
  END IF;

  IF p_product_id IS NULL OR trim(p_product_id) = '' THEN
    RAISE EXCEPTION 'p_product_id é obrigatório';
  END IF;

  SELECT id, name INTO v_conflicting_pipeline_id, v_conflicting_pipeline_name
  FROM leads_pipelines
  WHERE kiwify_product_id = p_product_id AND id <> p_pipeline_id;

  IF v_conflicting_pipeline_id IS NOT NULL THEN
    RAISE EXCEPTION 'Produto já vinculado ao pipeline "%" — desvincule primeiro', v_conflicting_pipeline_name;
  END IF;

  SELECT id INTO v_first_stage_id
  FROM leads_stages
  WHERE leads_pipelines_id = p_pipeline_id AND active = true
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_first_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline não tem nenhuma etapa ativa — crie uma etapa antes de vincular um produto';
  END IF;

  SELECT kiwify_product_id INTO v_old_product_id
  FROM leads_pipelines WHERE id = p_pipeline_id;

  IF v_old_product_id IS NOT NULL AND v_old_product_id <> p_product_id THEN
    UPDATE kiwify_event_mappings
    SET active = false, updated_at = now()
    WHERE product_id = v_old_product_id AND target_pipeline_id = p_pipeline_id;
  END IF;

  UPDATE leads_pipelines
  SET kiwify_product_id = p_product_id, kiwify_product_name = p_product_name, updated_at = now()
  WHERE id = p_pipeline_id;

  FOREACH v_trigger IN ARRAY v_triggers LOOP
    INSERT INTO kiwify_event_mappings (product_id, trigger, target_pipeline_id, target_stage_id, active)
    VALUES (p_product_id, v_trigger, p_pipeline_id, v_first_stage_id, true)
    ON CONFLICT (trigger, product_id)
    DO UPDATE SET target_pipeline_id = excluded.target_pipeline_id,
                  target_stage_id = excluded.target_stage_id,
                  active = true,
                  updated_at = now();
    v_mappings_synced := v_mappings_synced + 1;
  END LOOP;

  IF p_move_existing_leads THEN
    WITH moved AS (
      UPDATE leads
      SET leads_pipelines_id = p_pipeline_id, leads_stages_id = v_first_stage_id, updated_at = now()
      WHERE people_id IN (SELECT people_id FROM kiwify_lead_products WHERE product_id = p_product_id)
        AND status NOT IN ('lost', 'archived')
        AND leads_pipelines_id <> p_pipeline_id
      RETURNING id
    )
    SELECT count(*) INTO v_leads_moved FROM moved;
  END IF;

  RETURN jsonb_build_object('mappings_synced', v_mappings_synced, 'leads_moved', v_leads_moved);
END;
$$;


ALTER FUNCTION "public"."link_pipeline_to_kiwify_product"("p_pipeline_id" "uuid", "p_product_id" "text", "p_product_name" "text", "p_move_existing_leads" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE read_at IS NULL
     AND (
       (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
       OR (target_user_id IS NOT NULL AND target_user_id = v_user_id)
     );

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN v_marked;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_all_notifications_read"() IS 'Fecha o feed do sino em uma transação, respeitando a mesma visibilidade da policy de SELECT. Deliberadamente NÃO toca em messages.seen_at nem clients_people.unread_count: marcar o sino em massa não é o mesmo que ter atendido as conversas, e o inbox é compartilhado. Para o caso "abri esta conversa", use mark_conversation_read().';



CREATE OR REPLACE FUNCTION "public"."mark_conversation_read"("p_people_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
  v_max_id  bigint;
BEGIN
  IF p_people_id IS NULL OR v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.person_conversation_accessible_to_current_user(p_people_id) THEN
    RAISE EXCEPTION 'sem acesso a esta conversa';
  END IF;

  WITH marked AS (
    UPDATE public.messages
       SET seen_at = now()
     WHERE people_id = p_people_id
       AND from_contact = 'cliente'
       AND seen_at IS NULL
    RETURNING id
  )
  SELECT count(*), max(id) INTO v_marked, v_max_id FROM marked;

  UPDATE public.clients_people cp
     SET unread_count    = GREATEST(cp.unread_count - v_marked, 0),
         first_unread_at = (
           SELECT min(m.created_at) FROM public.messages m
            WHERE m.people_id = p_people_id
              AND m.from_contact = 'cliente'
              AND m.seen_at IS NULL
         ),
         last_read_at    = now(),
         last_read_by    = v_user_id
   WHERE cp.id = p_people_id;

  IF v_max_id IS NOT NULL THEN
    UPDATE public.notifications
       SET read_at = now(),
           read_by = v_user_id
     WHERE people_id = p_people_id
       AND read_at IS NULL
       AND target_user_id IS NULL
       AND (message_id IS NULL OR message_id <= v_max_id);

    UPDATE public.notifications
       SET unread_messages = GREATEST((
             SELECT count(*) FROM public.messages m
              WHERE m.people_id = p_people_id
                AND m.from_contact = 'cliente'
                AND m.seen_at IS NULL
           ), 1)
     WHERE people_id = p_people_id
       AND read_at IS NULL
       AND target_user_id IS NULL;
  END IF;

  RETURN v_marked;
END;
$$;


ALTER FUNCTION "public"."mark_conversation_read"("p_people_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_conversation_read"("p_people_id" "uuid") IS 'Único caminho de escrita da leitura de uma conversa. Todo estado derivado (unread_count, first_unread_at, notifications.unread_messages) é RECOMPUTADO de messages, nunca zerado nem decrementado: zerar perde a inbound que chega no meio da transação, decrementar nunca converge se o cache já estiver divergido. Fechamento da notificação escopado por message_id.';



CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
BEGIN
  IF p_notification_id IS NULL OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE id = p_notification_id
     AND read_at IS NULL
     AND (
       (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
       OR (target_user_id IS NOT NULL AND target_user_id = v_user_id)
     );

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_persons"("p_canonical_id" "uuid", "p_duplicate_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_canonical  public.clients_people%ROWTYPE;
  v_duplicate  public.clients_people%ROWTYPE;
  v_msg_count      INT := 0;
  v_lead_count     INT := 0;
  v_meeting_count  INT := 0;
  v_call_count     INT := 0;
  v_merge_event    JSONB;
BEGIN
  SELECT * INTO v_canonical FROM public.clients_people WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clients_people WHERE id = p_duplicate_id FOR UPDATE;

  IF v_canonical.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: canonical_id % not found', p_canonical_id;
  END IF;
  IF v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: duplicate_id % not found', p_duplicate_id;
  END IF;
  IF v_duplicate.status = 'merged' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already merged');
  END IF;

  -- 1. Messages
  UPDATE public.messages
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  -- 2. Leads (negócios)
  UPDATE public.leads
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_lead_count = ROW_COUNT;

  -- 3. Meetings (agendamentos)
  UPDATE public.meetings
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_meeting_count = ROW_COUNT;

  -- 4. Calls — REMOVIDO (task #29, 2026-08-13): "public.call_pro_calls"
  -- não existe mais no schema (to_regclass confirma null, sem tabela
  -- substituta). Essa UPDATE quebrava TODA chamada de merge_persons()
  -- com erro 42P01, abortando a transação inteira — ou seja, qualquer
  -- INSERT em clients_people com whatsapp/email/document/instagram
  -- repetido (via trg_identity_auto_merge) falhava, incluindo o
  -- site_lead_gate_create_lead. v_call_count fica fixo em 0 (nunca
  -- havia dado real sendo movido, a tabela já não existia).

  -- 5. Company associations — avoid (people_id, company_id) duplicates
  INSERT INTO public.clients_people_companies (people_id, company_id, role, is_primary, created_at, updated_at)
  SELECT p_canonical_id, company_id, role, is_primary, created_at, updated_at
  FROM   public.clients_people_companies
  WHERE  people_id = p_duplicate_id
    AND  company_id NOT IN (
           SELECT company_id FROM public.clients_people_companies
           WHERE  people_id = p_canonical_id
             AND  company_id IS NOT NULL
         );

  DELETE FROM public.clients_people_companies
  WHERE people_id = p_duplicate_id;

  -- 6. Form PRO Submissions (was: lp_submissions + lp_form_submissions)
  UPDATE public.form_pro_submissions
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 7. Sends contacts
  UPDATE public.sends_contacts
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 8. Followup queue (column name: person_id)
  UPDATE public.followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 9. Meeting followup queue (coluna real é person_id, não people_id —
  -- outro achado da task #29: mesmo bug de referência estava aqui,
  -- só não aparecia porque só é alcançado depois do bloco 4, que
  -- sempre abortava a transação antes de chegar aqui)
  UPDATE public.meeting_followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 10. Message buffer
  UPDATE public.message_buffer
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 11. AI agent execution log
  UPDATE public.ai_agents_execution_log
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 12. Merge identity fields to canonical (keep existing, fill from duplicate)
  UPDATE public.clients_people SET
    email              = COALESCE(email,              v_duplicate.email),
    document           = COALESCE(document,           v_duplicate.document),
    whatsapp           = COALESCE(whatsapp,           v_duplicate.whatsapp),
    telefone           = COALESCE(telefone,           v_duplicate.telefone),
    instagram_user_id  = COALESCE(instagram_user_id,  v_duplicate.instagram_user_id),
    instagram_id       = COALESCE(instagram_id,       v_duplicate.instagram_id),
    instagram_handle   = COALESCE(instagram_handle,   v_duplicate.instagram_handle),
    name = CASE
      WHEN name IN ('WhatsApp User', 'Instagram User', '') THEN COALESCE(NULLIF(v_duplicate.name, ''), name)
      ELSE name
    END,
    merge_history = merge_history || jsonb_build_array(
      jsonb_build_object(
        'merged_at',       NOW(),
        'duplicate_id',    p_duplicate_id,
        'duplicate_name',  v_duplicate.name,
        'messages_moved',  v_msg_count,
        'leads_moved',     v_lead_count,
        'meetings_moved',  v_meeting_count,
        'calls_moved',     v_call_count
      )
    ),
    updated_at = NOW()
  WHERE id = p_canonical_id;

  -- 13. Mark duplicate as merged
  UPDATE public.clients_people SET
    status         = 'merged',
    merged_into_id = p_canonical_id,
    updated_at     = NOW()
  WHERE id = p_duplicate_id;

  v_merge_event := jsonb_build_object(
    'canonical_id',   p_canonical_id,
    'duplicate_id',   p_duplicate_id,
    'messages_moved', v_msg_count,
    'leads_moved',    v_lead_count,
    'meetings_moved', v_meeting_count,
    'calls_moved',    v_call_count
  );

  RETURN v_merge_event;
END;
$$;


ALTER FUNCTION "public"."merge_persons"("p_canonical_id" "uuid", "p_duplicate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mfa_recovery_consume"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth'
    AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_row        public.mfa_recovery_codes%ROWTYPE;
  v_matched    boolean := false;
  v_factor_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find and consume a matching unused recovery code (constant-time bcrypt)
  FOR v_row IN
    SELECT * FROM public.mfa_recovery_codes
     WHERE user_id = v_user_id
       AND used_at IS NULL
     ORDER BY created_at
  LOOP
    IF extensions.crypt(p_code, v_row.code_hash) = v_row.code_hash THEN
      UPDATE public.mfa_recovery_codes
         SET used_at = now()
       WHERE id = v_row.id;

      v_matched := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_matched THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- 2. Resolve the user's totp factor id
  SELECT id INTO v_factor_id
    FROM auth.mfa_factors
   WHERE user_id    = v_user_id
     AND factor_type = 'totp'
   LIMIT 1;

  IF v_factor_id IS NULL THEN
    -- Code was valid but factor already absent — roll back used_at to keep code reusable
    RAISE EXCEPTION 'factor_not_found';
  END IF;

  -- 3. Delete the totp factor atomically (service_role bypasses AAL2 enforcement)
  DELETE FROM auth.mfa_factors
   WHERE id      = v_factor_id
     AND user_id = v_user_id;

  -- 4. Audit log
  INSERT INTO public.adm_audit_log (actor_id, action, details)
  VALUES (
    v_user_id,
    'mfa.recovery_consumed',
    jsonb_build_object(
      'code_id',         v_row.id,
      'recovery_set_id', v_row.recovery_set_id,
      'factor_id',       v_factor_id
    )
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    -- Rolls back used_at update + factor delete automatically (same transaction)
    IF SQLERRM = 'factor_not_found' THEN
      RETURN jsonb_build_object('success', false, 'error', 'factor_not_found');
    END IF;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."mfa_recovery_consume"("p_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mfa_recovery_consume"("p_code" "text") IS 'AUTH-V2-03c-fixup AC1: Validates recovery code + deletes totp factor atomically (SECURITY DEFINER). Returns jsonb {success, error?}. Replaces boolean return of AUTH-V2-03a.';



CREATE OR REPLACE FUNCTION "public"."mfa_recovery_generate"() RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_set_id    uuid := gen_random_uuid();
  v_codes     text[] := '{}';
  v_plaintext text;
  v_has_totp  boolean;
  i           int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller has an enrolled TOTP factor
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = v_user_id
      AND factor_type = 'totp'
      AND status = 'verified'
  ) INTO v_has_totp;

  IF NOT v_has_totp THEN
    RAISE EXCEPTION 'MFA TOTP not enrolled for this user';
  END IF;

  -- Invalidate previous unused codes
  DELETE FROM public.mfa_recovery_codes
   WHERE user_id = v_user_id
     AND used_at IS NULL;

  -- Generate 10 codes: XXXX-XXXX-XXXX-XXXX (4 groups of 4 hex chars, uppercase)
  FOR i IN 1..10 LOOP
    v_plaintext :=
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4)) || '-' ||
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4)) || '-' ||
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4)) || '-' ||
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4));

    INSERT INTO public.mfa_recovery_codes (user_id, code_hash, recovery_set_id)
    VALUES (
      v_user_id,
      extensions.crypt(v_plaintext, extensions.gen_salt('bf', 10)),
      v_set_id
    );

    v_codes := array_append(v_codes, v_plaintext);
  END LOOP;

  RETURN v_codes;
END;
$$;


ALTER FUNCTION "public"."mfa_recovery_generate"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mfa_recovery_generate"() IS 'AUTH-V2-03a AC2: Generates 10 bcrypt-hashed recovery codes for the calling user. Requires enrolled TOTP. Invalidates prior unused codes. Plaintext returned ONCE.';



CREATE OR REPLACE FUNCTION "public"."move_lead_to_stage"("p_lead_id" "uuid", "p_stage_name" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.leads
  SET leads_stages_id = (
    SELECT id FROM public.leads_stages
    WHERE LOWER(name) = LOWER(p_stage_name)
    LIMIT 1
  )
  WHERE id = p_lead_id;
$$;


ALTER FUNCTION "public"."move_lead_to_stage"("p_lead_id" "uuid", "p_stage_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_closer_on_meeting_scheduled"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_lead_name    text;
  v_closer_phone text;
  v_time_label   text;
  v_supabase_url text;
  v_service_key  text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('agendada', 'agendado') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_lead_name FROM public.clients_people WHERE id = NEW.people_id;
  SELECT phone INTO v_closer_phone FROM public.settings_users WHERE id = NEW.user_id;

  v_time_label := to_char(NEW.start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  INSERT INTO public.notifications
    (event_type, people_id, lead_id, target_user_id, title, body, channel, unread_messages)
  VALUES
    ('meeting_scheduled', NEW.people_id, NEW.lead_id, NEW.user_id,
     'Reunião agendada: ' || COALESCE(v_lead_name, 'Lead'),
     'Marcada para ' || v_time_label,
     'meeting', 1);

  -- Envio de WhatsApp isolado num sub-bloco de propósito: EXCEPTION de bloco
  -- PL/pgSQL reverte pro savepoint do INÍCIO do bloco que a contém. Sem isolar
  -- aqui, uma falha no http_post (edge function fora do ar, DNS, timeout)
  -- desfaria também o INSERT em notifications de cima — o sino sumiria junto
  -- com o WhatsApp que falhou. Confirmado via dry-run: sem este sub-bloco, o
  -- teste "insere reunião com notify-closer-meeting ainda não deployado"
  -- resultava em ZERO notificações (não só zero envios de WA).
  BEGIN
    IF v_closer_phone IS NOT NULL AND v_closer_phone <> '' THEN
      SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
      SELECT value INTO v_service_key  FROM public._app_config WHERE key = 'service_role_key';
      IF v_supabase_url IS NOT NULL AND v_supabase_url <> '' AND v_service_key IS NOT NULL AND v_service_key <> '' THEN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/notify-closer-meeting',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object('meeting_id', NEW.id::text)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- WhatsApp é best-effort; o sino já inserido acima sobrevive
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- alerta de reunião nunca pode derrubar o agendamento em si
END;
$$;


ALTER FUNCTION "public"."notify_closer_on_meeting_scheduled"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_closer_on_meeting_scheduled"() IS 'AFTER INSERT em meetings: cria o alerta pessoal (sino) do closer (NEW.user_id) na mesma transação e dispara notify-closer-meeting (fire-and-forget) pro envio de WhatsApp. EXCEPTION WHEN OTHERS THEN RETURN NEW — nunca pode bloquear o INSERT da reunião.';



CREATE OR REPLACE FUNCTION "public"."notify_lead_stage_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net'
    AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;
  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.followup_queue
  SET status = 'cancelled', fired_at = now(), error_message = 'Cancelado: lead mudou de etapa'
  WHERE lead_id = NEW.id AND status = 'pending' AND source_type = 'stage';

  SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key  FROM public._app_config WHERE key = 'service_role_key';
  IF v_supabase_url IS NULL OR v_supabase_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('tipo', 'lead_etapa', 'lead_id', NEW.id::text)
  );
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/followup-enqueue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('lead_id', NEW.id::text, 'stage_id', NEW.leads_stages_id::text, 'source_type', 'stage')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.webhook_logs (webhook_id, status_code, response_body, request_body, created_at)
  VALUES (NULL, 500, jsonb_build_object('error', SQLERRM, 'source', 'notify_lead_stage_changed'), jsonb_build_object('lead_id', NEW.id::text), now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_lead_stage_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."person_conversation_accessible_to_current_user"("p_people_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_people_id IS NULL THEN
    RETURN false;  -- fail-closed: idêntico ao que a policy de messages faz com people_id NULL
  END IF;

  IF public.is_admin_or_manager() THEN
    RETURN true;
  END IF;

  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN
    EXISTS (SELECT 1 FROM public.clients_people cp
             WHERE cp.id = p_people_id AND cp.created_by = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                WHERE l.people_id = p_people_id AND l.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                 JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
                WHERE l.people_id = p_people_id AND sut.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                WHERE l.people_id = p_people_id
                  AND public.lead_pipeline_accessible_to_current_user(l.leads_pipelines_id));
END;
$$;


ALTER FUNCTION "public"."person_conversation_accessible_to_current_user"("p_people_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."person_conversation_accessible_to_current_user"("p_people_id" "uuid") IS 'Extração 1:1 do predicado da policy authenticated_read de messages (20260729231500). Fonte única de "esse usuário pode ver a conversa dessa pessoa?". p_people_id NULL => false (fail-closed), igual ao que a policy de messages faz. Quem adicionar notificação sem pessoa associada precisa de um gate próprio.';



CREATE OR REPLACE FUNCTION "public"."process_message_buffer"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rec           record;
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' OR svc_key IS NULL OR svc_key = '' THEN
    RAISE NOTICE 'process_message_buffer: _app_config incompleta.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT DISTINCT ON (mb.people_id) mb.people_id
    FROM   message_buffer mb
    JOIN   clients_people cp ON cp.id = mb.people_id
    WHERE  mb.processed          = false
      AND  mb.expires_at         < now()
      AND  cp.ai_processing_lock = false
      AND  cp.ai_enabled         = true
    ORDER BY mb.people_id, mb.created_at DESC
  LOOP
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id
        AND ai_processing_lock = false;

    IF FOUND THEN
      PERFORM net.http_post(
        url                  := supabase_url || '/functions/v1/ai-agent-execute',
        headers              := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || svc_key
        ),
        body                 := jsonb_build_object('people_id', rec.people_id, 'lock_preacquired', true),
        timeout_milliseconds := 30000
      );
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_message_buffer"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_message_buffer"() IS 'Chamada pelo pg_cron a cada minuto. Lê credenciais da tabela _app_config.';



CREATE OR REPLACE FUNCTION "public"."propagate_message_status_to_sends"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_rank int;
  v_send_id  uuid;
BEGIN
  IF NEW.source_type IS DISTINCT FROM 'campaign' OR NEW.module_ref_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_send_id := NEW.module_ref_id;

  v_new_rank := CASE NEW.status
    WHEN 'pending'   THEN 0
    WHEN 'sending'   THEN 1
    WHEN 'sent'      THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read'      THEN 4
    WHEN 'error'     THEN 5
    WHEN 'failed'    THEN 5
    ELSE -1
  END;

  IF v_new_rank < 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.sends_contacts sc
  SET
    status = CASE
      WHEN v_new_rank > COALESCE(
        CASE sc.status
          WHEN 'pending'   THEN 0
          WHEN 'sending'   THEN 1
          WHEN 'sent'      THEN 2
          WHEN 'delivered' THEN 3
          WHEN 'read'      THEN 4
          WHEN 'error'     THEN 5
          WHEN 'failed'    THEN 5
          ELSE -1
        END, -1)
      THEN NEW.status
      ELSE sc.status
    END,
    delivered_at = CASE
      WHEN NEW.status IN ('delivered','read') AND sc.delivered_at IS NULL
      THEN COALESCE(NEW.delivered_at, now())
      ELSE sc.delivered_at
    END,
    read_at = CASE
      WHEN NEW.status = 'read' AND sc.read_at IS NULL
      THEN COALESCE(NEW.read_at, now())
      ELSE sc.read_at
    END,
    error_message = CASE
      WHEN NEW.status IN ('error','failed')
      THEN COALESCE(
        NEW.metadata->>'last_error',
        NEW.metadata->'delivery_error'->>'title',
        NEW.metadata->'delivery_error'->>'code',
        sc.error_message
      )
      ELSE sc.error_message
    END
  WHERE sc.send_id   = v_send_id
    AND sc.people_id = NEW.people_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_message_status_to_sends"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."propagate_message_status_to_sends"() IS 'Trigger fn — propaga messages.status → sends_contacts quando source_type=campaign. Idempotente via STATUS_RANK. Story: FIX-SENDS-STATUS-BRIDGE-01.';



CREATE OR REPLACE FUNCTION "public"."recalc_unread_count"("p_people_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.clients_people cp
     SET unread_count    = COALESCE(agg.n, 0),
         first_unread_at = agg.first_at
    FROM (
      SELECT p.id,
             COUNT(m.id)       AS n,
             MIN(m.created_at) AS first_at
        FROM public.clients_people p
        LEFT JOIN public.messages m
               ON m.people_id = p.id
              AND m.from_contact = 'cliente'
              AND m.seen_at IS NULL
       WHERE p_people_id IS NULL OR p.id = p_people_id
       GROUP BY p.id
    ) agg
   WHERE cp.id = agg.id;
$$;


ALTER FUNCTION "public"."recalc_unread_count"("p_people_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recalc_unread_count"("p_people_id" "uuid") IS 'Reparo idempotente do cache clients_people.unread_count/first_unread_at a partir de messages. Ferramenta de operação — roda como service_role, sem GRANT para authenticated.';



CREATE OR REPLACE FUNCTION "public"."release_stale_ai_locks"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE clients_people
    SET ai_processing_lock = false
    WHERE ai_processing_lock = true
      AND ai_last_message_at < now() - interval '2 minutes';
END;
$$;


ALTER FUNCTION "public"."release_stale_ai_locks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."release_stale_ai_locks"() IS 'Safety valve: libera ai_processing_lock preso por mais de 2 minutos (crash recovery do ai-agent-execute).';



CREATE OR REPLACE FUNCTION "public"."reorder_leads_stage"("p_stage_id" "uuid", "p_pipeline_id" "uuid", "p_new_position" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_pos integer;
  v_max_pos integer;
  v_target_pos integer;
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS pos
    FROM public.leads_stages
    WHERE leads_pipelines_id = p_pipeline_id AND active = true
  )
  SELECT pos, (SELECT MAX(pos) FROM ordered)
  INTO v_current_pos, v_max_pos
  FROM ordered
  WHERE id = p_stage_id;

  IF v_current_pos IS NULL OR v_max_pos IS NULL THEN
    RETURN;
  END IF;

  v_target_pos := GREATEST(1, LEAST(p_new_position, v_max_pos));

  IF v_target_pos = v_current_pos THEN
    RETURN;
  END IF;

  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS pos
    FROM public.leads_stages
    WHERE leads_pipelines_id = p_pipeline_id AND active = true
  ),
  moved AS (
    SELECT
      id,
      CASE
        WHEN pos = v_current_pos THEN v_target_pos
        WHEN v_target_pos < v_current_pos
             AND pos >= v_target_pos
             AND pos < v_current_pos
          THEN pos + 1
        WHEN v_target_pos > v_current_pos
             AND pos <= v_target_pos
             AND pos > v_current_pos
          THEN pos - 1
        ELSE pos
      END AS new_pos
    FROM ordered
  )
  UPDATE public.leads_stages ls
  SET order_index = m.new_pos
  FROM moved m
  WHERE ls.id = m.id;
END;
$$;


ALTER FUNCTION "public"."reorder_leads_stage"("p_stage_id" "uuid", "p_pipeline_id" "uuid", "p_new_position" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_stale_sending_messages"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE messages
  SET status = 'pending'
  WHERE status = 'sending'
    AND created_at < now() - interval '5 minutes';
END;
$$;


ALTER FUNCTION "public"."reset_stale_sending_messages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_agent_version"("p_agent_id" "uuid", "p_history_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_history    record;
  v_parsed     jsonb;
  v_step       jsonb;
BEGIN
  -- Fetch history record
  SELECT * INTO v_history
  FROM ai_agents_history
  WHERE id = p_history_id AND ai_agent_id = p_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record % not found for agent %', p_history_id, p_agent_id;
  END IF;

  v_parsed := v_history.data;

  -- Restore agent fields
  UPDATE ai_agents SET
    name             = v_parsed->>'name',
    description      = v_parsed->>'description',
    identity         = v_parsed->>'identity',
    general_rules    = v_parsed->>'general_rules',
    input_data       = v_parsed->>'input_data',
    use_stages       = (v_parsed->>'use_stages')::boolean,
    active           = (v_parsed->>'active')::boolean,
    pipeline_id      = (v_parsed->>'pipeline_id')::uuid,
    leads_stages_id  = (v_parsed->>'leads_stages_id')::uuid,
    score_matrix_ids = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_parsed->'score_matrix_ids'))::uuid[],
      '{}'::uuid[]
    ),
    score_value      = (v_parsed->>'score_value')::integer,
    updated_at       = now()
  WHERE id = p_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent % not found', p_agent_id;
  END IF;

  -- Restore steps atomically
  DELETE FROM ai_agents_steps WHERE ai_agent_id = p_agent_id;

  IF v_parsed->'steps' IS NOT NULL AND jsonb_array_length(v_parsed->'steps') > 0 THEN
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_parsed->'steps')
    LOOP
      INSERT INTO ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
      VALUES (
        p_agent_id,
        COALESCE(v_step->>'name', v_step->>'nome'),
        v_step->>'prompt',
        COALESCE(v_step->>'control', v_step->>'controle'),
        COALESCE((v_step->>'order_index')::integer, (v_step->>'ordem')::integer, 0),
        COALESCE((v_step->>'active')::boolean, (v_step->>'ativo')::boolean, true)
      );
    END LOOP;
  END IF;
END;
$$;


ALTER FUNCTION "public"."restore_agent_version"("p_agent_id" "uuid", "p_history_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_agent_complete"("p_agent_id" "uuid", "p_agent_data" "jsonb", "p_steps_data" "jsonb" DEFAULT NULL::"jsonb", "p_changelog" "jsonb" DEFAULT NULL::"jsonb", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_version  integer;
  v_new_version      integer;
  v_snapshot         jsonb;
  v_step             jsonb;
  v_step_id          uuid;
  v_resolved_user_id uuid;
BEGIN
  -- ── 1. Lock agent row + read current version and snapshot ───────────────────
  SELECT current_version, to_jsonb(a)
  INTO   v_current_version, v_snapshot
  FROM   public.ai_agents a
  WHERE  id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent not found: %', p_agent_id;
  END IF;

  -- Attach current steps to snapshot (needed by restore_agent_version)
  v_snapshot := jsonb_set(
    v_snapshot,
    '{steps}',
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.order_index)
       FROM public.ai_agents_steps s
       WHERE s.ai_agent_id = p_agent_id),
      '[]'::jsonb
    )
  );

  v_new_version := v_current_version + 1;

  -- ── 2. Resolve created_by to a valid settings_users.id ──────────────────────
  -- Accept either a settings_users.id or an auth.users.id from the caller.
  -- Fall back to auth.uid() when nothing was provided.
  -- Store NULL if no settings_users row maps to the caller (FK allows NULL).
  IF p_created_by IS NOT NULL THEN
    SELECT id INTO v_resolved_user_id
    FROM public.settings_users
    WHERE id = p_created_by;

    IF v_resolved_user_id IS NULL THEN
      SELECT id INTO v_resolved_user_id
      FROM public.settings_users
      WHERE auth_user_id = p_created_by;
    END IF;
  END IF;

  IF v_resolved_user_id IS NULL THEN
    SELECT id INTO v_resolved_user_id
    FROM public.settings_users
    WHERE auth_user_id = auth.uid();
  END IF;

  -- ── 3. Write history entry (state BEFORE the update) ────────────────────────
  INSERT INTO public.ai_agents_history (ai_agent_id, version, data, changelog, created_by)
  VALUES (p_agent_id, v_current_version, v_snapshot, COALESCE(p_changelog, '{}'::jsonb), v_resolved_user_id);

  -- ── 4. Update agent row ──────────────────────────────────────────────────────
  UPDATE public.ai_agents SET
    name                = CASE WHEN p_agent_data ? 'name'
                               THEN p_agent_data->>'name'
                               ELSE name END,
    description         = CASE WHEN p_agent_data ? 'description'
                               THEN p_agent_data->>'description'
                               ELSE description END,
    identity            = CASE WHEN p_agent_data ? 'identity'
                               THEN p_agent_data->>'identity'
                               ELSE identity END,
    general_rules       = CASE WHEN p_agent_data ? 'general_rules'
                               THEN p_agent_data->>'general_rules'
                               ELSE general_rules END,
    input_data          = CASE WHEN p_agent_data ? 'input_data'
                               THEN p_agent_data->>'input_data'
                               ELSE input_data END,
    use_stages          = COALESCE((p_agent_data->>'use_stages')::boolean, use_stages),
    active              = COALESCE((p_agent_data->>'active')::boolean,     active),
    pipeline_id         = CASE WHEN p_agent_data ? 'pipeline_id'
                               THEN NULLIF(p_agent_data->>'pipeline_id', '')::uuid
                               ELSE pipeline_id END,
    pipeline_ids        = CASE WHEN p_agent_data ? 'pipeline_ids'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'pipeline_ids'))
                               ELSE pipeline_ids END,
    leads_stages_id     = CASE WHEN p_agent_data ? 'leads_stages_id'
                               THEN NULLIF(p_agent_data->>'leads_stages_id', '')::uuid
                               ELSE leads_stages_id END,
    score_matrix_ids    = CASE WHEN p_agent_data ? 'score_matrix_ids'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'score_matrix_ids'))::uuid[]
                               ELSE score_matrix_ids END,
    score_allow_empty   = COALESCE((p_agent_data->>'score_allow_empty')::boolean, score_allow_empty),
    score_value         = COALESCE((p_agent_data->>'score_value')::integer,       score_value),
    channel_types       = CASE WHEN p_agent_data ? 'channel_types'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'channel_types'))
                               ELSE channel_types END,
    stage_ids           = CASE WHEN p_agent_data ? 'stage_ids'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'stage_ids'))::uuid[]
                               ELSE stage_ids END,
    origem_lista_filters = CASE WHEN p_agent_data ? 'origem_lista_filters'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_agent_data->'origem_lista_filters'))
                               ELSE origem_lista_filters END,
    llm_provider        = COALESCE((p_agent_data->>'llm_provider'),        llm_provider),
    llm_model           = COALESCE((p_agent_data->>'llm_model'),           llm_model),
    llm_temperature     = COALESCE((p_agent_data->>'llm_temperature')::numeric,  llm_temperature),
    llm_max_tokens      = COALESCE((p_agent_data->>'llm_max_tokens')::integer,   llm_max_tokens),
    llm_provider_id     = CASE WHEN p_agent_data ? 'llm_provider_id'
                               THEN NULLIF(p_agent_data->>'llm_provider_id', '')::uuid
                               ELSE llm_provider_id END,
    memory_window       = COALESCE((p_agent_data->>'memory_window')::integer,    memory_window),
    wa_phone_number_id  = CASE WHEN p_agent_data ? 'wa_phone_number_id'
                               THEN NULLIF(p_agent_data->>'wa_phone_number_id', '')
                               ELSE wa_phone_number_id END,
    wa_channel_id       = CASE WHEN p_agent_data ? 'wa_channel_id'
                               THEN NULLIF(p_agent_data->>'wa_channel_id', '')::uuid
                               ELSE wa_channel_id END,
    buffer_ms           = COALESCE((p_agent_data->>'buffer_ms')::integer,  buffer_ms),
    humanizacao         = COALESCE((p_agent_data->>'humanizacao'),         humanizacao),
    agent_type          = COALESCE((p_agent_data->>'agent_type'),          agent_type),
    voice_enabled       = COALESCE((p_agent_data->>'voice_enabled')::boolean,    voice_enabled),
    voice_response_mode = COALESCE((p_agent_data->>'voice_response_mode'), voice_response_mode),
    voice_id            = CASE WHEN p_agent_data ? 'voice_id'
                               THEN NULLIF(p_agent_data->>'voice_id', '')
                               ELSE voice_id END,
    voice_first_message = CASE WHEN p_agent_data ? 'voice_first_message'
                               THEN p_agent_data->>'voice_first_message'
                               ELSE voice_first_message END,
    voice_language      = CASE WHEN p_agent_data ? 'voice_language'
                               THEN p_agent_data->>'voice_language'
                               ELSE voice_language END,
    voice_model_id      = CASE WHEN p_agent_data ? 'voice_model_id'
                               THEN p_agent_data->>'voice_model_id'
                               ELSE voice_model_id END,
    voice_stability     = CASE WHEN p_agent_data ? 'voice_stability'
                               THEN (p_agent_data->>'voice_stability')::numeric
                               ELSE voice_stability END,
    voice_similarity    = CASE WHEN p_agent_data ? 'voice_similarity'
                               THEN (p_agent_data->>'voice_similarity')::numeric
                               ELSE voice_similarity END,
    voice_speed         = CASE WHEN p_agent_data ? 'voice_speed'
                               THEN (p_agent_data->>'voice_speed')::numeric
                               ELSE voice_speed END,
    el_sync_status      = CASE WHEN p_agent_data ? 'el_sync_status'
                               THEN p_agent_data->>'el_sync_status'
                               ELSE el_sync_status END,
    current_version     = v_new_version,
    updated_at          = now()
  WHERE id = p_agent_id;

  -- ── 5. Upsert steps (if provided) ───────────────────────────────────────────
  IF p_steps_data IS NOT NULL THEN
    DELETE FROM public.ai_agents_steps
    WHERE ai_agent_id = p_agent_id
      AND id NOT IN (
        SELECT (step->>'id')::uuid
        FROM jsonb_array_elements(p_steps_data) AS step
        WHERE step ? 'id'
      );

    FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps_data)
    LOOP
      IF v_step ? 'id' THEN
        v_step_id := (v_step->>'id')::uuid;
        INSERT INTO public.ai_agents_steps (id, ai_agent_id, name, prompt, control, order_index, active)
        VALUES (
          v_step_id,
          p_agent_id,
          v_step->>'name',
          v_step->>'prompt',
          v_step->>'control',
          COALESCE((v_step->>'order_index')::integer, 1),
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          prompt      = EXCLUDED.prompt,
          control     = EXCLUDED.control,
          order_index = EXCLUDED.order_index,
          updated_at  = now();
      ELSE
        INSERT INTO public.ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
        VALUES (
          p_agent_id,
          v_step->>'name',
          v_step->>'prompt',
          v_step->>'control',
          COALESCE((v_step->>'order_index')::integer, 1),
          true
        );
      END IF;
    END LOOP;
  END IF;

  -- ── 6. Return new version ────────────────────────────────────────────────────
  RETURN jsonb_build_object('ok', true, 'version', v_new_version);
END;
$$;


ALTER FUNCTION "public"."save_agent_complete"("p_agent_id" "uuid", "p_agent_data" "jsonb", "p_steps_data" "jsonb", "p_changelog" "jsonb", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."score_settings_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."score_settings_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_http_post"("secret_name" "text", "url" "text", "body" "jsonb", "caller_context" "text" DEFAULT 'unknown'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = secret_name;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', secret_name;
  END IF;

  INSERT INTO public.secret_access_log (secret_name, caller_context)
  VALUES (secret_name, caller_context);

  PERFORM net.http_post(
    url     := url,
    body    := body,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    )
  );
END;
$$;


ALTER FUNCTION "public"."secure_http_post"("secret_name" "text", "url" "text", "body" "jsonb", "caller_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_tenant_roles"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_gestor_id    uuid;
  v_atendente_id uuid;
  fk             public.feature_key;
BEGIN
  -- Gestor role (system — all features enabled)
  INSERT INTO public.tenant_roles (tenant_id, name, description, is_system)
  VALUES (p_tenant_id, 'gestor', 'Acesso total', true)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_gestor_id;

  IF v_gestor_id IS NOT NULL THEN
    FOR fk IN SELECT unnest(enum_range(NULL::public.feature_key)) LOOP
      INSERT INTO public.tenant_role_permissions (role_id, feature_key, enabled)
      VALUES (v_gestor_id, fk, true)
      ON CONFLICT (role_id, feature_key) DO NOTHING;
    END LOOP;
  END IF;

  -- Atendente role (system — restricted features)
  INSERT INTO public.tenant_roles (tenant_id, name, description, is_system)
  VALUES (p_tenant_id, 'atendente', 'Acesso padrão', true)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_atendente_id;

  IF v_atendente_id IS NOT NULL THEN
    -- Atendente: can view score and BI, cannot export/delete/edit coach/create sends/view settings
    INSERT INTO public.tenant_role_permissions (role_id, feature_key, enabled) VALUES
      (v_atendente_id, 'crm_export',   false),
      (v_atendente_id, 'crm_delete',   false),
      (v_atendente_id, 'score_view',   true),
      (v_atendente_id, 'coach_view',   true),
      (v_atendente_id, 'coach_edit',   false),
      (v_atendente_id, 'sends_create', false),
      (v_atendente_id, 'bi_view',      true),
      (v_atendente_id, 'settings_view',false)
    ON CONFLICT (role_id, feature_key) DO NOTHING;
  END IF;
END;
$$;


ALTER FUNCTION "public"."seed_default_tenant_roles"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_adm_clients_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_adm_clients_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_lead_email"("p_lead_id" "uuid", "p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_people_id uuid;
  v_existing  text;
  v_clean     text;
BEGIN
  v_clean := lower(btrim(p_email));
  -- validação de formato server-side (a coluna não tem CHECK; rejeita lixo)
  IF v_clean IS NULL OR v_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('error', 'invalid_email');
  END IF;

  -- escopo anti-IDOR: a pessoa é a do LEAD do link, nunca um people_id arbitrário
  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;
  IF v_people_id IS NULL THEN
    RETURN json_build_object('error', 'lead_not_found');
  END IF;

  SELECT email INTO v_existing FROM public.clients_people WHERE id = v_people_id;
  -- não sobrescreve email válido pré-existente (anti-vazamento). '' conta como vazio.
  IF v_existing IS NOT NULL AND btrim(v_existing) <> '' THEN
    RETURN json_build_object('ok', true, 'skipped', 'already_has_email');
  END IF;

  UPDATE public.clients_people SET email = v_clean, updated_at = NOW() WHERE id = v_people_id;
  RETURN json_build_object('ok', true, 'people_id', v_people_id::text);
END;
$_$;


ALTER FUNCTION "public"."set_booking_lead_email"("p_lead_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_dead_letter_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_dead_letter_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_elevenlabs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_elevenlabs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_instagram_automation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_instagram_automation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_omni_channel_configs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_omni_channel_configs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_omni_outbound_webhooks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_omni_outbound_webhooks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_schedule_automation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_schedule_automation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settings_ai_providers_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."settings_ai_providers_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settings_audit_trigger_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  _tenant_id uuid;
  _user_id   uuid;
  _col       text;
  _old_val   text;
  _new_val   text;
  _section   text := TG_ARGV[0];
BEGIN
  _tenant_id := (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
  _user_id   := auth.uid();

  FOREACH _col IN ARRAY (
    SELECT array_agg(column_name::text)
    FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA
      AND table_name   = TG_TABLE_NAME
      AND column_name NOT IN ('id', 'created_at', 'updated_at', 'tenant_id')
  ) LOOP
    EXECUTE format('SELECT ($1).%I::text', _col) INTO _old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::text', _col) INTO _new_val USING NEW;
    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.settings_audit_log
        (tenant_id, user_id, section, field, old_value, new_value, is_sensitive)
      VALUES (
        _tenant_id,
        _user_id,
        _section,
        _col,
        public.audit_value(_col, _old_val),
        public.audit_value(_col, _new_val),
        public.is_sensitive_column(_col)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."settings_audit_trigger_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settings_users_set_mfa_grace"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_policy  text;
  v_applies boolean := false;
BEGIN
  SELECT mfa_policy INTO v_policy
    FROM public.settings
   LIMIT 1;

  IF v_policy = 'required_all' THEN
    v_applies := true;
  ELSIF v_policy = 'required_gestores' AND NEW.user_type = 'gestor' THEN
    v_applies := true;
  END IF;

  IF v_applies THEN
    NEW.mfa_grace_until := now() + interval '7 days';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."settings_users_set_mfa_grace"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settings_users_sync_admin_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.super_admin = true AND (NEW.user_type IS DISTINCT FROM 'admin') THEN
    NEW.user_type := 'admin';
  ELSIF NEW.user_type = 'admin' AND (NEW.super_admin IS NOT TRUE) THEN
    NEW.super_admin := true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."settings_users_sync_admin_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settings_whatsapp_channels_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."settings_whatsapp_channels_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."site_lead_gate_create_lead"("p_name" "text", "p_whatsapp" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_lead_source" "text" DEFAULT 'site_form'::"text", "p_utm_source" "text" DEFAULT NULL::"text", "p_utm_medium" "text" DEFAULT NULL::"text", "p_utm_campaign" "text" DEFAULT NULL::"text", "p_utm_content" "text" DEFAULT NULL::"text", "p_utm_term" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_person_id        uuid;
  v_canonical_id      uuid;
  v_lead_id           uuid;
  v_stage_ok          boolean;
  v_existing_lead_id  uuid;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'p_name é obrigatório';
  END IF;
  IF p_whatsapp IS NULL OR btrim(p_whatsapp) = '' THEN
    RAISE EXCEPTION 'p_whatsapp é obrigatório';
  END IF;
  IF p_pipeline_id IS NULL OR p_stage_id IS NULL THEN
    RAISE EXCEPTION 'p_pipeline_id e p_stage_id são obrigatórios';
  END IF;

  -- Sanidade: a stage precisa pertencer ao pipeline informado e as duas
  -- precisam estar ativas — evita lead órfão/mal-parentado por engano de
  -- quem chama a função.
  SELECT EXISTS (
    SELECT 1
    FROM public.leads_stages ls
    JOIN public.leads_pipelines lp ON lp.id = ls.leads_pipelines_id
    WHERE ls.id = p_stage_id
      AND ls.leads_pipelines_id = p_pipeline_id
      AND ls.active = true
      AND lp.active = true
  ) INTO v_stage_ok;

  IF NOT v_stage_ok THEN
    RAISE EXCEPTION 'p_stage_id % não pertence a um pipeline/stage ativo válido (p_pipeline_id %)', p_stage_id, p_pipeline_id;
  END IF;

  INSERT INTO public.clients_people (name, whatsapp, source)
  VALUES (btrim(p_name), btrim(p_whatsapp), COALESCE(p_lead_source, 'site_form'))
  RETURNING id INTO v_person_id;

  -- trg_identity_auto_merge (AFTER INSERT em clients_people) já pode ter
  -- rodado aqui e marcado v_person_id como merged pra um contato mais
  -- antigo com o mesmo whatsapp. Resolver o canônico ANTES de criar o
  -- lead — é exatamente o race condition documentado na task #12/#18.
  SELECT COALESCE(merged_into_id, id) INTO v_canonical_id
  FROM public.clients_people
  WHERE id = v_person_id;

  -- Dedup de lead (task #29): se a mesma pessoa (já resolvida pro id
  -- canônico) já tem um lead 'in_progress' pra este exato
  -- pipeline+stage, não cria um segundo — reaproveita o existente.
  -- Cobre reenvio de formulário / duplo clique / retry de rede do
  -- lead-gate. Leads 'won'/'lost'/'archived' NÃO bloqueiam (pessoa que
  -- já converteu ou saiu do funil pode entrar de novo legitimamente).
  SELECT id INTO v_existing_lead_id
  FROM public.leads
  WHERE people_id = v_canonical_id
    AND leads_pipelines_id = p_pipeline_id
    AND leads_stages_id = p_stage_id
    AND status = 'in_progress'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'person_id',  v_canonical_id,
      'lead_id',    v_existing_lead_id,
      'merged',     v_canonical_id <> v_person_id,
      'duplicate',  true
    );
  END IF;

  INSERT INTO public.leads (
    people_id, leads_pipelines_id, leads_stages_id, status, lead_source,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, description
  )
  VALUES (
    v_canonical_id, p_pipeline_id, p_stage_id, 'in_progress', COALESCE(p_lead_source, 'site_form'),
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_description
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object(
    'person_id',  v_canonical_id,
    'lead_id',    v_lead_id,
    'merged',     v_canonical_id <> v_person_id,
    'duplicate',  false
  );
END;
$$;


ALTER FUNCTION "public"."site_lead_gate_create_lead"("p_name" "text", "p_whatsapp" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_lead_source" "text", "p_utm_source" "text", "p_utm_medium" "text", "p_utm_campaign" "text", "p_utm_content" "text", "p_utm_term" "text", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."site_lead_gate_create_lead"("p_name" "text", "p_whatsapp" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_lead_source" "text", "p_utm_source" "text", "p_utm_medium" "text", "p_utm_campaign" "text", "p_utm_content" "text", "p_utm_term" "text", "p_description" "text") IS 'Único ponto de entrada pro site joao-guirunas-site criar contato+lead no CRM. SECURITY DEFINER — roda com privilégio do owner (postgres, BYPASSRLS), não do caller. Resolve merge de identidade (whatsapp duplicado) antes de criar o lead, pra não deixar lead pendurado em pessoa já mergeada.';



CREATE OR REPLACE FUNCTION "public"."sync_active_channel_from_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  resolved_channel_id uuid;
BEGIN
  IF NEW.channel <> 'whatsapp' OR NEW.wa_phone_number_id IS NULL OR NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- campaign é broadcast pontual pra um canal escolhido pelo admin — não
  -- reflete "o cliente passou a usar esse canal", então não reatribui.
  IF NEW.source_type = 'campaign' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO resolved_channel_id
    FROM public.settings_whatsapp_channels
   WHERE phone_number_id = NEW.wa_phone_number_id OR id::text = NEW.wa_phone_number_id
   LIMIT 1;

  IF resolved_channel_id IS NOT NULL THEN
    UPDATE public.clients_people
       SET active_channel_id = resolved_channel_id
     WHERE id = NEW.people_id
       AND (active_channel_id IS DISTINCT FROM resolved_channel_id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- nunca pode derrubar o envio/recebimento da mensagem em si
END;
$$;


ALTER FUNCTION "public"."sync_active_channel_from_message"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_active_channel_from_message"() IS 'AFTER INSERT em messages: resolve o canal (Meta ou Evolution) a partir de wa_phone_number_id e atualiza clients_people.active_channel_id. Ignora campaign (broadcast não deve redefinir o canal "de conversa" do lead).';



CREATE OR REPLACE FUNCTION "public"."sync_custom_domain_to_adm"("p_tenant_id" "uuid", "p_custom_domain" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_adm_url  text;
  v_adm_key  text;
BEGIN
  -- Read control plane credentials from _app_config
  SELECT value INTO v_adm_url FROM public._app_config WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO v_adm_key FROM public._app_config WHERE key = 'service_role_key' LIMIT 1;

  IF v_adm_url IS NULL OR v_adm_key IS NULL THEN
    RETURN; -- control plane credentials not available, skip sync
  END IF;

  -- Fire-and-forget HTTP update to control plane via pg_net
  PERFORM net.http_patch(
    url    := v_adm_url || '/rest/v1/adm_clients?tenant_id=eq.' || p_tenant_id::text,
    body   := jsonb_build_object('custom_domain', p_custom_domain)::text,
    headers := jsonb_build_object(
      'apikey',        v_adm_key,
      'Authorization', 'Bearer ' || v_adm_key,
      'Content-Type',  'application/json',
      'Prefer',        'return=minimal'
    )
  );
END;
$$;


ALTER FUNCTION "public"."sync_custom_domain_to_adm"("p_tenant_id" "uuid", "p_custom_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_service_role_from_vault"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_key text;
BEGIN
  SELECT decrypted_secret INTO v_new_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_cron'
  LIMIT 1;

  IF v_new_key IS NULL THEN
    RAISE EXCEPTION 'FWUP-01: Vault secret service_role_cron not found. '
      'Create it in Supabase Dashboard → Vault before applying this migration.';
  END IF;

  -- Update _app_config with the Vault value (idempotent)
  INSERT INTO public._app_config (key, value)
  VALUES ('service_role_key', v_new_key)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- Audit log
  INSERT INTO public.secret_access_log (secret_name, caller_context)
  VALUES ('service_role_cron', 'fwup01-rotation');

  RAISE NOTICE 'FWUP-01: _app_config.service_role_key synced from Vault (service_role_cron).';
END;
$$;


ALTER FUNCTION "public"."sync_service_role_from_vault"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_service_role_from_vault"() IS 'FWUP-01: Reads service_role JWT from vault.decrypted_secrets (name=service_role_cron) and updates _app_config.service_role_key. Call after each JWT rotation.';



CREATE OR REPLACE FUNCTION "public"."tag_accessible_to_current_user"("p_tag_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_team_ids uuid[];
  v_restricted_team_ids uuid[];
  v_has_universal_team boolean;
BEGIN
  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL OR p_tag_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ARRAY(SELECT team_id FROM public.settings_users_teams WHERE user_id = v_user_id)
    INTO v_team_ids;

  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) IS NULL THEN
    RETURN true; -- sem equipe = sem restrição (mesma regra do pipeline)
  END IF;

  SELECT ARRAY(SELECT DISTINCT team_id FROM public.settings_teams_tags WHERE team_id = ANY(v_team_ids))
    INTO v_restricted_team_ids;

  -- Qualquer equipe do usuário sem NENHUM vínculo em settings_teams_tags
  -- é "universal" (enxerga todas as tags) — basta uma pra liberar tudo.
  v_has_universal_team := EXISTS (
    SELECT 1 FROM unnest(v_team_ids) AS t(id)
    WHERE NOT (id = ANY(COALESCE(v_restricted_team_ids, ARRAY[]::uuid[])))
  );
  IF v_has_universal_team THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.settings_teams_tags stt
    WHERE stt.team_id = ANY(v_team_ids)
      AND stt.tag_id = p_tag_id
  );
END;
$$;


ALTER FUNCTION "public"."tag_accessible_to_current_user"("p_tag_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."tag_accessible_to_current_user"("p_tag_id" "uuid") IS 'Espelha lead_pipeline_accessible_to_current_user(): time sem vínculo em settings_teams_tags enxerga todas as tags; time com algum vínculo só enxerga as tags explicitamente vinculadas.';



CREATE OR REPLACE FUNCTION "public"."track_leads_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track stage changes with from/to stage IDs
    IF OLD.leads_stages_id IS DISTINCT FROM NEW.leads_stages_id THEN
      INSERT INTO leads_updates (
        lead_id,
        user_id,
        from_stage_id,
        to_stage_id,
        notes,
        created_at
      ) VALUES (
        NEW.id,
        (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
        OLD.leads_stages_id,
        NEW.leads_stages_id,
        'stage_change',
        NOW()
      );
    END IF;

    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO leads_updates (
        lead_id,
        user_id,
        notes,
        created_at
      ) VALUES (
        NEW.id,
        (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
        'status_change: ' || COALESCE(OLD.status, 'null') || ' → ' || COALESCE(NEW.status, 'null'),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER block lead updates due to audit trail failures
  RAISE WARNING 'track_leads_changes failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."track_leads_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_advance_stage_on_first_ai_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_lead_pipeline_id uuid;
  v_lead_stage_id    uuid;
  v_current_order    integer;
  v_next_stage_id    uuid;
  v_ai_msg_count     integer;
BEGIN
  IF NEW.from_contact != 'agente_ia' OR NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_ai_msg_count
  FROM public.messages
  WHERE lead_id = NEW.lead_id AND from_contact = 'agente_ia';

  IF v_ai_msg_count != 1 THEN RETURN NEW; END IF;

  SELECT leads_stages_id, leads_pipelines_id INTO v_lead_stage_id, v_lead_pipeline_id
  FROM public.leads WHERE id = NEW.lead_id;

  IF v_lead_stage_id IS NULL OR v_lead_pipeline_id IS NULL THEN RETURN NEW; END IF;

  SELECT order_index INTO v_current_order FROM public.leads_stages WHERE id = v_lead_stage_id;
  IF v_current_order IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_next_stage_id
  FROM public.leads_stages
  WHERE leads_pipelines_id = v_lead_pipeline_id
    AND order_index = v_current_order + 1
    AND active = true
  LIMIT 1;

  IF v_next_stage_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.leads SET leads_stages_id = v_next_stage_id, updated_at = NOW()
  WHERE id = NEW.lead_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_advance_stage_on_first_ai_message: % (lead_id=%)', SQLERRM, NEW.lead_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_advance_stage_on_first_ai_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_merge_on_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_dup_id         UUID;
  v_canonical      UUID;
  v_duplicate      UUID;
  v_dup_created_at TIMESTAMPTZ;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'merged' THEN
    RETURN NEW;
  END IF;

  IF NEW.whatsapp IS NULL
    AND NEW.email IS NULL
    AND NEW.document IS NULL
    AND NEW.instagram_user_id IS NULL
    AND NEW.instagram_handle IS NULL
  THEN
    RETURN NEW;
  END IF;

  v_dup_id := public.find_duplicate_person(
    NEW.id,
    NEW.whatsapp,
    NEW.email,
    NEW.document,
    NEW.instagram_user_id,
    NEW.instagram_handle
  );

  IF v_dup_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_at INTO v_dup_created_at
  FROM public.clients_people WHERE id = v_dup_id;

  IF v_dup_created_at <= NEW.created_at THEN
    v_canonical := v_dup_id;
    v_duplicate := NEW.id;
  ELSE
    v_canonical := NEW.id;
    v_duplicate := v_dup_id;
  END IF;

  PERFORM public.merge_persons(v_canonical, v_duplicate);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_auto_merge_on_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_cleanup_agent_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM cleanup_agent_history(NEW.ai_agent_id, 50);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_cleanup_agent_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_ai_on_buffer_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE url text; svc text;
BEGIN
  SELECT value INTO url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc FROM _app_config WHERE key = 'service_role_key';
  IF url IS NOT NULL AND svc IS NOT NULL THEN
    PERFORM net.http_post(
      url     := url || '/functions/v1/ai-agent-execute',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||svc),
      body    := jsonb_build_object('people_id', NEW.people_id),
      timeout_milliseconds := 30000
    );
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."trigger_ai_on_buffer_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_followup_retry_worker"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_stale_threshold timestamptz := now() - interval '15 minutes';
  v_supabase_url text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.followup_queue
    WHERE status = 'queued'
      AND updated_at < v_stale_threshold
      AND retry_count < 3
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN;
  END IF;

  PERFORM public.secure_http_post(
    'service_role_key',
    v_supabase_url || '/functions/v1/followup-retry-worker',
    jsonb_build_object('source', 'pg_cron'),
    'trigger_followup_retry_worker'
  );
END;
$$;


ALTER FUNCTION "public"."trigger_followup_retry_worker"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_followup_retry_worker"() IS 'Called by pg_cron every 10 minutes. Invokes followup-retry-worker edge fn only when there are stale queued entries in followup_queue (status=queued, updated_at older than 15 min). Uses secure_http_post (ADR-SP-05). FWUP-06.';



CREATE OR REPLACE FUNCTION "public"."trigger_followup_worker"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.followup_queue
    WHERE status = 'pending' AND scheduled_for <= now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM public.secure_http_post(
    'service_role_cron',
    'https://wotuyxscsfralqpoiyfv.supabase.co/functions/v1/followup-trigger-worker',
    jsonb_build_object('source', 'pg_cron'),
    'trigger_followup_worker'
  );
END;
$$;


ALTER FUNCTION "public"."trigger_followup_worker"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_followup_worker"() IS 'Chamada pelo pg_cron a cada minuto. Só invoca followup-trigger-worker quando há entradas pending vencidas na fila (evita invocações vazias).';



CREATE OR REPLACE FUNCTION "public"."trigger_fwup01_smoke_test"() RETURNS TABLE("check_name" "text", "status" "text", "detail" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_vault_key   text;
  v_config_key  text;
BEGIN
  -- Check 1: Vault secret exists
  SELECT decrypted_secret INTO v_vault_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_cron' LIMIT 1;

  check_name := 'vault_secret_exists';
  status     := CASE WHEN v_vault_key IS NOT NULL THEN 'PASS' ELSE 'FAIL' END;
  detail     := CASE WHEN v_vault_key IS NOT NULL
                  THEN 'service_role_cron found in vault (' || length(v_vault_key) || ' chars)'
                  ELSE 'service_role_cron NOT FOUND in vault.decrypted_secrets' END;
  RETURN NEXT;

  -- Check 2: _app_config matches Vault
  SELECT value INTO v_config_key FROM public._app_config WHERE key = 'service_role_key' LIMIT 1;

  check_name := 'app_config_synced';
  status     := CASE WHEN v_config_key = v_vault_key THEN 'PASS' ELSE 'FAIL' END;
  detail     := CASE
    WHEN v_config_key IS NULL THEN '_app_config missing service_role_key row'
    WHEN v_config_key = v_vault_key THEN '_app_config.service_role_key matches Vault'
    ELSE '_app_config.service_role_key DIFFERS from Vault — sync failed'
  END;
  RETURN NEXT;

  -- Check 3: cron job 'process-meeting-followups' uses secure_http_post
  check_name := 'cron_uses_secure_http_post';
  status     := CASE
    WHEN EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'process-meeting-followups'
        AND command LIKE '%secure_http_post%'
    ) THEN 'PASS' ELSE 'FAIL'
  END;
  detail     := CASE
    WHEN EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'process-meeting-followups'
        AND command LIKE '%secure_http_post%'
    ) THEN 'process-meeting-followups uses secure_http_post (no JWT literal)'
    ELSE 'process-meeting-followups cron NOT found or still using JWT literal'
  END;
  RETURN NEXT;

  -- Check 4: No JWT literal in active cron commands
  check_name := 'no_jwt_in_cron_commands';
  DECLARE
    v_count int;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM cron.job
    WHERE command ~ 'eyJ[A-Za-z0-9_\-]{30,}';

    status := CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END;
    detail := CASE WHEN v_count = 0
      THEN 'No JWT literals found in active cron.job commands'
      ELSE v_count || ' cron job(s) still contain JWT literals — check cron.job table'
    END;
  END;
  RETURN NEXT;

  -- Check 5: Rotation logged in secret_access_log
  check_name := 'rotation_audit_logged';
  status     := CASE
    WHEN EXISTS (
      SELECT 1 FROM public.secret_access_log
      WHERE secret_name = 'service_role_cron'
        AND caller_context = 'fwup01-rotation'
    ) THEN 'PASS' ELSE 'WARN'
  END;
  detail     := CASE
    WHEN EXISTS (
      SELECT 1 FROM public.secret_access_log
      WHERE secret_name = 'service_role_cron'
        AND caller_context = 'fwup01-rotation'
    ) THEN 'Rotation logged in secret_access_log'
    ELSE 'No rotation log entry found — secret_access_log may be missing'
  END;
  RETURN NEXT;

END;
$$;


ALTER FUNCTION "public"."trigger_fwup01_smoke_test"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_fwup01_smoke_test"() IS 'FWUP-01 post-rotation validator. Returns one row per check with PASS/FAIL/WARN. All checks should be PASS after rotation + migration apply.';



CREATE OR REPLACE FUNCTION "public"."trigger_google_calendar_sync"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public._app_config WHERE key = 'service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'trigger_google_calendar_sync: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/google-cal-sync-to-db',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_google_calendar_sync"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_google_calendar_sync"() IS 'Disparada pelo pg_cron a cada 15min. Lê credenciais de _app_config (SECURITY DEFINER). Story: FIX-SENDS-CRON-LEGACY-URLS.';



CREATE OR REPLACE FUNCTION "public"."trigger_instagram_token_refresh"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_instagram_token_refresh: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Only trigger if instagram channel is active
  IF NOT EXISTS (
    SELECT 1 FROM omni_channel_configs
    WHERE channel = 'instagram' AND is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/instagram-token-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_instagram_token_refresh"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_instagram_token_refresh"() IS 'Disparada pelo pg_cron diariamente às 03:00 UTC. Só chama a edge function se canal Instagram estiver ativo. Lê credenciais de _app_config (SECURITY DEFINER).';



CREATE OR REPLACE FUNCTION "public"."trigger_omni_channel_health_check"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_omni_channel_health_check: _app_config missing';
    RETURN;
  END IF;

  -- Only trigger if there are active channels
  IF NOT EXISTS (
    SELECT 1 FROM omni_channel_configs
    WHERE is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-channel-health-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_omni_channel_health_check"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_omni_channel_health_check"() IS 'Disparada pelo pg_cron a cada 15 minutos. Probes de conectividade para canais ativos (WhatsApp, Instagram, Email, SMS, Telefone).';



CREATE OR REPLACE FUNCTION "public"."trigger_omni_delivery_engine"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_omni_delivery_engine: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Só dispara se houver mensagens pending (evita chamadas desnecessárias)
  IF NOT EXISTS (
    SELECT 1 FROM messages
    WHERE status = 'pending'
      AND from_contact != 'cliente'
      AND created_at > now() - interval '24 hours'
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-delivery-engine',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_omni_delivery_engine"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_omni_delivery_engine"() IS 'Disparada pelo pg_cron a cada minuto. Só chama a edge function omni-delivery-engine se houver mensagens status=pending. Lê credenciais de _app_config (SECURITY DEFINER).';



CREATE OR REPLACE FUNCTION "public"."trigger_omni_retry_dead_letter"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_omni_retry_dead_letter: _app_config missing';
    RETURN;
  END IF;

  -- Only trigger if there are entries ready for retry
  IF NOT EXISTS (
    SELECT 1 FROM omni_delivery_dead_letter
    WHERE status = 'pending'
      AND next_retry_at <= now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-retry-dead-letter',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_omni_retry_dead_letter"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_omni_retry_dead_letter"() IS 'Disparada pelo pg_cron a cada 5 minutos. Só chama a edge function se houver dead-letter entries prontas para retry.';



CREATE OR REPLACE FUNCTION "public"."trigger_process_meeting_followups"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public._app_config WHERE key = 'service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'trigger_process_meeting_followups: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/process-meeting-followups',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_process_meeting_followups"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_process_meeting_followups"() IS 'Disparada pelo pg_cron a cada 5min. Lê credenciais de _app_config (SECURITY DEFINER). Story: FIX-SENDS-CRON-LEGACY-URLS.';



CREATE OR REPLACE FUNCTION "public"."trigger_sends_dispatch_batch"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' OR svc_key IS NULL OR svc_key = '' THEN
    RAISE NOTICE 'trigger_sends_dispatch_batch: _app_config missing supabase_url or service_role_key. '
                 'Run: INSERT INTO _app_config VALUES (''supabase_url'', ''https://xxx.supabase.co''), '
                 '(''service_role_key'', ''...'') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;';
    RETURN;
  END IF;

  -- Only fire if there are running sends to process (skip wasted HTTP call)
  IF NOT EXISTS (SELECT 1 FROM public.sends WHERE status = 'running' LIMIT 1) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/sends-dispatch-batch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := jsonb_build_object('source', 'pg_cron')
  );
END;
$$;


ALTER FUNCTION "public"."trigger_sends_dispatch_batch"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_sends_dispatch_batch"() IS 'Called by pg_cron every minute. Fires sends-dispatch-batch edge fn only when there are running sends. Requires _app_config to have supabase_url and service_role_key.';



CREATE OR REPLACE FUNCTION "public"."trigger_zoom_token_refresh"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  supabase_url text;
  svc_key      text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_zoom_token_refresh: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Only trigger if there are active Zoom connections
  IF NOT EXISTS (
    SELECT 1 FROM user_calendar_connections
    WHERE provider = 'zoom' AND is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/zoom-token-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_zoom_token_refresh"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_zoom_token_refresh"() IS 'Disparada pelo pg_cron a cada 30 minutos. Renova tokens Zoom que expiram em menos de 45 minutos. Só chama a edge function se houver conexão Zoom ativa.';



CREATE OR REPLACE FUNCTION "public"."unlink_pipeline_kiwify_product"("p_pipeline_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_product_id text;
  v_mappings_deactivated int := 0;
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'Apenas admin/manager pode desvincular pipeline de produto';
  END IF;

  SELECT kiwify_product_id INTO v_product_id FROM leads_pipelines WHERE id = p_pipeline_id;

  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object('mappings_deactivated', 0);
  END IF;

  UPDATE leads_pipelines
  SET kiwify_product_id = NULL, kiwify_product_name = NULL, updated_at = now()
  WHERE id = p_pipeline_id;

  WITH deactivated AS (
    UPDATE kiwify_event_mappings
    SET active = false, updated_at = now()
    WHERE product_id = v_product_id AND target_pipeline_id = p_pipeline_id AND active = true
    RETURNING id
  )
  SELECT count(*) INTO v_mappings_deactivated FROM deactivated;

  RETURN jsonb_build_object('mappings_deactivated', v_mappings_deactivated);
END;
$$;


ALTER FUNCTION "public"."unlink_pipeline_kiwify_product"("p_pipeline_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bi_ad_tables_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_bi_ad_tables_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bi_sdr_targets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bi_sdr_targets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lp_tables_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_lp_tables_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_status" "text", "p_start_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_duration_minutes" integer DEFAULT NULL::integer, "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_date       DATE;
  v_start_time TIME;
  v_end_time   TIME;
BEGIN
  -- Validate meeting exists
  IF NOT EXISTS (SELECT 1 FROM public.meetings WHERE id = p_meeting_id) THEN
    RAISE EXCEPTION 'update_meeting: meeting % not found', p_meeting_id;
  END IF;

  IF p_start_ts IS NOT NULL THEN
    v_date       := p_start_ts::DATE;
    v_start_time := p_start_ts::TIME;
    v_end_time   := (p_start_ts + (COALESCE(p_duration_minutes, 30) || ' minutes')::INTERVAL)::TIME;

    UPDATE public.meetings
    SET
      status     = p_status,
      date       = v_date,
      start_time = v_start_time,
      end_time   = v_end_time,
      notes      = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END
    WHERE id = p_meeting_id;
  ELSE
    UPDATE public.meetings
    SET
      status = p_status,
      notes  = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END
    WHERE id = p_meeting_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_status" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_status" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") IS 'N8N MCP: Updates meeting status, time, or notes from AI agent.';



CREATE OR REPLACE FUNCTION "public"."update_qualification_field"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_definition_id UUID;
BEGIN
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'update_qualification_field: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
    RETURN;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, p_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."update_qualification_field"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sends_import_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sends_import_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.upsert_field_value(p_person_id, p_field_key, p_value);
END;
$$;


ALTER FUNCTION "public"."upsert_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") IS 'N8N MCP tool "Atualizar Campo Qualificação" — writes to lead_field_values (unified field store)';



CREATE OR REPLACE FUNCTION "public"."upsert_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_definition_id UUID;
BEGIN
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'upsert_field_value: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
    RETURN;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, p_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_tenant_access"("target_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_tenants
    WHERE id = target_tenant_id
      AND (
        -- Check if current user is associated via settings_users
        EXISTS (
          SELECT 1 FROM public.settings_users
          WHERE auth_user_id = auth.uid()
            AND active = true
        )
        -- Super admin emails (fallback)
        OR auth.email() IN ('joao@growthsales.ai', 'rafaela@iatize.com', 'joao@iatize.com')
      )
  );
$$;


ALTER FUNCTION "public"."user_has_tenant_access"("target_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_stage_ids"("p_stage_ids" "uuid"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_stage_ids IS NULL OR array_length(p_stage_ids, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- All provided stage UUIDs must exist in leads_stages
  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(p_stage_ids) s(stage_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM leads_stages ls WHERE ls.id = s.stage_id
    )
  );
END;
$$;


ALTER FUNCTION "public"."validate_stage_ids"("p_stage_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_stage_ids"("p_stage_ids" "uuid"[]) IS 'Validates that all UUIDs in an array exist in leads_stages. Used as CHECK constraint for sends.stage_ids.';



CREATE TABLE IF NOT EXISTS "public"."_app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."_app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_meta_debug" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "raw_body" "text",
    "object" "text",
    "entry_count" integer,
    "first_entry" "jsonb"
);


ALTER TABLE "public"."_meta_debug" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_meta_debug_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_meta_debug_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_meta_debug_id_seq" OWNED BY "public"."_meta_debug"."id";



CREATE TABLE IF NOT EXISTS "public"."action_token_consumed" (
    "jti" "text" NOT NULL,
    "consumed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text",
    "meeting_id" "text",
    "resource_id" "text",
    "tenant_id" "text",
    "token_exp" timestamp with time zone
);


ALTER TABLE "public"."action_token_consumed" OWNER TO "postgres";


COMMENT ON TABLE "public"."action_token_consumed" IS 'ADR-SP-02: Single-use enforcement for edge action tokens (confirm, cancel, reschedule). INSERT on first use; duplicate jti = token already consumed. GC cron purges expired entries.';



CREATE TABLE IF NOT EXISTS "public"."adm_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "actor_email" "text" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "entity_name" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adm_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adm_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "supabase_url" "text" NOT NULL,
    "anon_key" "text" NOT NULL,
    "service_role_key" "text",
    "db_password" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "sync_status" "text" DEFAULT 'never'::"text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "contact_name" "text",
    "contact_email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_domain" "text",
    "enabled_modules" "jsonb",
    "db_version" "text",
    "app_version" "text",
    "management_token" "text",
    "service_role_key_hint" "text",
    "db_password_hint" "text",
    "management_token_hint" "text",
    "management_token_rotated_at" timestamp with time zone,
    "last_health_check_at" timestamp with time zone,
    "last_health_status" "text",
    "deleted_at" timestamp with time zone,
    "delete_requested_by" "uuid",
    CONSTRAINT "adm_clients_last_health_status_check" CHECK (("last_health_status" = ANY (ARRAY['healthy'::"text", 'degraded'::"text", 'down'::"text", 'unknown'::"text"]))),
    CONSTRAINT "adm_clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"]))),
    CONSTRAINT "adm_clients_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['never'::"text", 'pending'::"text", 'syncing'::"text", 'synced'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."adm_clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."adm_clients"."custom_domain" IS 'Domínio customizado do cliente (ex: crm.empresa.com.br). Opcional — além do subdomínio padrão *.revos.growthsales.ai';



COMMENT ON COLUMN "public"."adm_clients"."enabled_modules" IS 'Array de module_keys habilitados para este cliente. NULL = todos habilitados. Ex: ["dashboard","negocios","conversas"]';



COMMENT ON COLUMN "public"."adm_clients"."db_version" IS 'Versão do banco do cliente após último sync bem-sucedido. Ex: 1.03';



COMMENT ON COLUMN "public"."adm_clients"."app_version" IS 'Versão do sistema quando o cliente foi criado/atualizado. Ex: 1.07';



COMMENT ON COLUMN "public"."adm_clients"."management_token" IS 'Supabase Management API token. Encrypted via pgcrypto.';



CREATE TABLE IF NOT EXISTS "public"."adm_migration_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "migration_id" "uuid" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error" "text",
    CONSTRAINT "adm_migration_runs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."adm_migration_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adm_migrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sql_content" "text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."adm_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adm_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "triggered_by" "text" DEFAULT 'manual'::"text" NOT NULL,
    "type" "text" DEFAULT 'full'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "adm_sync_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'success'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "adm_sync_jobs_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['manual'::"text", 'auto'::"text", 'github_actions'::"text", 'webhook'::"text"]))),
    CONSTRAINT "adm_sync_jobs_type_check" CHECK (("type" = ANY (ARRAY['full'::"text", 'migrations'::"text", 'functions'::"text"])))
);


ALTER TABLE "public"."adm_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adm_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "adm_sync_logs_level_check" CHECK (("level" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'success'::"text"])))
);


ALTER TABLE "public"."adm_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_callback_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "enabled" boolean DEFAULT false NOT NULL,
    "default_mode" "text" DEFAULT 'direct'::"text" NOT NULL,
    "allow_agent_choose_mode" boolean DEFAULT false NOT NULL,
    "allow_free_text" boolean DEFAULT false NOT NULL,
    "templates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "free_prompt" "text",
    "whatsapp_template_fallback" "text",
    "min_delay_minutes" integer DEFAULT 5 NOT NULL,
    "max_delay_hours" integer DEFAULT 720 NOT NULL,
    "cancel_on_resume" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_agent_callback_configs_default_mode_check" CHECK (("default_mode" = ANY (ARRAY['direct'::"text", 'agent'::"text"])))
);


ALTER TABLE "public"."ai_agent_callback_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_agent_callback_configs" IS 'Config da tool agendar_retorno por agente (D2 do ADR). Gate de exposição da tool: enabled = true. ai_agents.enabled_tools NÃO é usada.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."step_id" IS 'NULL = config default do agente; preenchido = override para o step específico. Unicidade do default garantida por ai_agent_callback_configs_default_per_agent.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."enabled" IS 'Quando false, as tools agendar_retorno/cancelar_retorno não são injetadas em buildToolDefinitions().';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."default_mode" IS 'Modo aplicado quando o agente não escolhe (ou não pode escolher) — direct | agent.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."allow_agent_choose_mode" IS 'Se false, o parâmetro modo enviado pelo LLM é ignorado e vale default_mode.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."allow_free_text" IS 'Se false, o parâmetro mensagem (texto livre) do LLM é rejeitado; só template_id é aceito.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."templates" IS 'Array JSON de templates permitidos: [{id, label, body, whatsapp_template_name?}].';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."free_prompt" IS 'Instrução injetada na reinvocação do agente em modo agent.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."whatsapp_template_fallback" IS 'Template aprovado usado quando o retorno cai fora da janela de 24h; obrigatório na prática para retornos > 23h.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."min_delay_minutes" IS 'Clamp inferior do scheduled_for validado no handler da tool.';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."max_delay_hours" IS 'Clamp superior do scheduled_for (default 720h = 30 dias).';



COMMENT ON COLUMN "public"."ai_agent_callback_configs"."cancel_on_resume" IS 'Se true, o retorno pendente deve ser cancelado quando o lead retoma a conversa (decisão do LLM via cancelar_retorno).';



CREATE TABLE IF NOT EXISTS "public"."ai_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "identity" "text",
    "input_data" "text",
    "general_rules" "text",
    "pipeline_id" "uuid",
    "score_value" integer,
    "current_version" integer DEFAULT 1,
    "use_stages" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "leads_stages_id" "uuid",
    "score_matrix_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "is_template" boolean DEFAULT false,
    "template_type" "text",
    "prompt_blocks" "jsonb",
    "enabled_tools" "text"[],
    "llm_provider" "text" DEFAULT 'openai'::"text" NOT NULL,
    "llm_model" "text" DEFAULT 'gpt-4o-mini'::"text" NOT NULL,
    "llm_temperature" double precision DEFAULT 0.7 NOT NULL,
    "llm_max_tokens" integer DEFAULT 1024 NOT NULL,
    "llm_provider_id" "uuid",
    "memory_window" integer DEFAULT 20 NOT NULL,
    "wa_phone_number_id" "text",
    "buffer_ms" integer DEFAULT 3000 NOT NULL,
    "wa_channel_id" "uuid",
    "channel_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "stage_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "score_allow_empty" boolean DEFAULT false NOT NULL,
    "pipeline_ids" "text"[],
    "humanizacao" "text" DEFAULT 'media'::"text" NOT NULL,
    "elevenlabs_agent_id" "uuid",
    "voice_enabled" boolean DEFAULT false,
    "voice_id" "text",
    "agent_type" "text" DEFAULT 'text'::"text",
    "voice_first_message" "text",
    "voice_language" "text" DEFAULT 'pt'::"text",
    "voice_model_id" "text",
    "voice_stability" real DEFAULT 0.5,
    "voice_similarity" real DEFAULT 0.75,
    "voice_speed" real DEFAULT 1.0,
    "el_sync_status" "text" DEFAULT 'not_applicable'::"text",
    "el_last_synced_at" timestamp with time zone,
    "voice_response_mode" "text" DEFAULT 'mirror'::"text" NOT NULL,
    "origem_lista_filters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "ai_agents_agent_type_check" CHECK (("agent_type" = ANY (ARRAY['text'::"text", 'voice'::"text"]))),
    CONSTRAINT "ai_agents_buffer_ms_check" CHECK ((("buffer_ms" >= 0) AND ("buffer_ms" <= 30000))),
    CONSTRAINT "ai_agents_channel_types_check" CHECK (("channel_types" <@ ARRAY['whatsapp'::"text", 'instagram_dm'::"text", 'instagram_post'::"text", 'email'::"text", 'sms'::"text"])),
    CONSTRAINT "ai_agents_el_sync_status_check" CHECK (("el_sync_status" = ANY (ARRAY['pending'::"text", 'synced'::"text", 'error'::"text", 'not_applicable'::"text"]))),
    CONSTRAINT "ai_agents_humanizacao_check" CHECK (("humanizacao" = ANY (ARRAY['alta'::"text", 'media'::"text", 'nenhuma'::"text"]))),
    CONSTRAINT "ai_agents_llm_max_tokens_check" CHECK ((("llm_max_tokens" > 0) AND ("llm_max_tokens" <= 32768))),
    CONSTRAINT "ai_agents_llm_provider_check" CHECK (("llm_provider" = ANY (ARRAY['openai'::"text", 'anthropic'::"text", 'groq'::"text", 'gemini'::"text"]))),
    CONSTRAINT "ai_agents_llm_temperature_check" CHECK ((("llm_temperature" >= (0.0)::double precision) AND ("llm_temperature" <= (2.0)::double precision))),
    CONSTRAINT "ai_agents_memory_window_check" CHECK ((("memory_window" > 0) AND ("memory_window" <= 200))),
    CONSTRAINT "ai_agents_voice_response_mode_check" CHECK (("voice_response_mode" = ANY (ARRAY['mirror'::"text", 'always'::"text"])))
);


ALTER TABLE "public"."ai_agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_agents"."prompt_blocks" IS '[DEPRECATED in v2.0] Use ai_agents_steps table instead for step-based prompts. This column was never populated and will be removed in v3.0. Retention period: until 2026-12-31.';



COMMENT ON COLUMN "public"."ai_agents"."llm_provider" IS 'LLM provider: openai | anthropic | groq | gemini';



COMMENT ON COLUMN "public"."ai_agents"."llm_model" IS 'Model ID (e.g. gpt-4o-mini, claude-3-5-haiku-20241022)';



COMMENT ON COLUMN "public"."ai_agents"."llm_temperature" IS 'Sampling temperature 0.0–2.0 (default 0.7)';



COMMENT ON COLUMN "public"."ai_agents"."llm_max_tokens" IS 'Max output tokens per LLM call (default 1024)';



COMMENT ON COLUMN "public"."ai_agents"."llm_provider_id" IS 'FK to settings_ai_providers — global API key store';



COMMENT ON COLUMN "public"."ai_agents"."memory_window" IS 'Number of past messages loaded as conversation context';



COMMENT ON COLUMN "public"."ai_agents"."wa_phone_number_id" IS 'Meta WhatsApp Business phone_number_id for this agent';



COMMENT ON COLUMN "public"."ai_agents"."buffer_ms" IS 'Inbound message debounce window in ms (0 = process immediately)';



COMMENT ON COLUMN "public"."ai_agents"."wa_channel_id" IS 'FK to settings_whatsapp_channels — which WA number this agent sends from';



COMMENT ON COLUMN "public"."ai_agents"."score_allow_empty" IS 'When true, the G2 score gate also fires for leads with no score (null/0). Replaces the __empty__ string sentinel that was illegally stored in the uuid[] score_matrix_ids array.';



COMMENT ON COLUMN "public"."ai_agents"."agent_type" IS 'Agent type: text (default, current behavior) or voice (ElevenLabs Conversational AI)';



COMMENT ON COLUMN "public"."ai_agents"."voice_first_message" IS 'Initial greeting for voice agent (what it says when answering)';



COMMENT ON COLUMN "public"."ai_agents"."voice_language" IS 'Language code for voice conversations (pt, en, es, etc.)';



COMMENT ON COLUMN "public"."ai_agents"."voice_model_id" IS 'ElevenLabs TTS model override (null = use default from settings_elevenlabs)';



COMMENT ON COLUMN "public"."ai_agents"."voice_stability" IS 'Voice stability 0.0-1.0 (higher = more consistent)';



COMMENT ON COLUMN "public"."ai_agents"."voice_similarity" IS 'Voice similarity boost 0.0-1.0 (higher = more faithful to original)';



COMMENT ON COLUMN "public"."ai_agents"."voice_speed" IS 'Voice speed 0.5-2.0 (1.0 = normal)';



COMMENT ON COLUMN "public"."ai_agents"."el_sync_status" IS 'ElevenLabs sync status: not_applicable (text agents), pending, synced, error';



COMMENT ON COLUMN "public"."ai_agents"."el_last_synced_at" IS 'Timestamp of last successful sync with ElevenLabs API';



COMMENT ON COLUMN "public"."ai_agents"."origem_lista_filters" IS 'Se não vazio, agente só dispara para leads cuja origem_lista esteja neste array. Vazio = sem filtro (todos).';



CREATE TABLE IF NOT EXISTS "public"."ai_agents_execution_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_agent_id" "uuid" NOT NULL,
    "people_id" "uuid" NOT NULL,
    "prompt_rendered" "text" NOT NULL,
    "tools_used" "text"[] DEFAULT '{}'::"text"[],
    "execution_status" "text" NOT NULL,
    "execution_duration_ms" integer,
    "response_data" "jsonb",
    "error_message" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" "uuid",
    "lead_id" "uuid"
);


ALTER TABLE "public"."ai_agents_execution_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_agents_execution_log" IS 'Audit trail for AI agent executions. Tracks which agents ran, what they did, and outcomes. Retention: 30 days.';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."ai_agent_id" IS 'Reference to the agent that was executed';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."people_id" IS 'Reference to the person (lead/contact) being processed';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."prompt_rendered" IS 'The final prompt sent to the LLM (with all variables interpolated)';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."tools_used" IS 'Array of tool names that were called: e.g., ["Atualizar Pessoa", "Atualizar Lead"]';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."execution_status" IS 'Outcome: "success" (tools executed), "error" (LLM/tool error), "timeout" (>30s)';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."response_data" IS 'JSON response from LLM including selected tools and their outputs';



COMMENT ON COLUMN "public"."ai_agents_execution_log"."lead_id" IS 'Reference to the lead/deal (optional, from leads table)';



CREATE TABLE IF NOT EXISTS "public"."ai_agents_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_agent_id" "uuid",
    "created_by" "uuid",
    "version" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "changelog" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_agents_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agents_score_matrix" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_agent_id" "uuid",
    "score_matrix_id" "uuid",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_agents_score_matrix" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agents_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_agent_id" "uuid",
    "name" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "control" "text",
    "order_index" integer NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_agents_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agents_steps_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "step_id" "uuid",
    "lead_id" "uuid",
    "success" boolean,
    "result" "jsonb",
    "error_message" "text",
    "executed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_agents_steps_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_scheduled_callbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "people_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "step_id" "uuid",
    "scheduled_for" timestamp with time zone NOT NULL,
    "mode" "text" NOT NULL,
    "template_id" "text",
    "message_text" "text",
    "whatsapp_template_name" "text",
    "reason" "text" NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "fired_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text",
    "message_id" bigint,
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "response_data" "jsonb",
    "created_by_execution_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_scheduled_callbacks_mode_check" CHECK (("mode" = ANY (ARRAY['direct'::"text", 'agent'::"text"]))),
    CONSTRAINT "ai_scheduled_callbacks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."ai_scheduled_callbacks" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_scheduled_callbacks" IS 'Fila de retornos ad-hoc agendados pelo agente de IA (tool agendar_retorno). Consumida pelo ai-callback-worker via pg_cron. Não confundir com followup_queue (regras de etapa/reunião).';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."scheduled_for" IS 'Momento do disparo (UTC). Nome alinhado ao followup_queue LIVE para consistência operacional.';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."mode" IS 'direct = envia template/texto pré-definido sem LLM; agent = reinvoca ai-agent-execute (stage_trigger) no horário.';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."template_id" IS 'id do template escolhido dentro de ai_agent_callback_configs.templates (não é FK).';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."message_text" IS 'Texto livre redigido pelo agente (só aceito quando a config tem allow_free_text = true).';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."whatsapp_template_name" IS 'Template aprovado da Meta usado quando a janela de 24h está fechada (D6 do ADR).';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."reason" IS 'Motivo informado pelo lead/agente; vai para o log e para o prompt de reinvocação em modo agent.';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."channel" IS 'Canal da conversa de origem (whatsapp/instagram/...), usado no INSERT em messages.';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."status" IS 'pending → processing (claim atômico CAS pelo worker) → sent | failed | cancelled | skipped. Só 1 pending por lead (índice parcial ai_scheduled_callbacks_one_pending_per_lead).';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."message_id" IS 'FK para messages.id (bigint) da mensagem efetivamente enfileirada no disparo direct.';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."retry_count" IS 'Tentativas de disparo já feitas pelo worker (máx. 3 conforme ADR).';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."response_data" IS 'Payload bruto da resposta do caminho de envio (omni-delivery-engine / ai-agent-execute) para debug.';



COMMENT ON COLUMN "public"."ai_scheduled_callbacks"."created_by_execution_id" IS 'id da execução do agente (ai_agents_history) que criou este retorno.';



CREATE TABLE IF NOT EXISTS "public"."auth_events_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "ip_hash" "text",
    "user_agent_hash" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_events_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_login_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_hash" "text" NOT NULL,
    "email_hash" "text" NOT NULL,
    "tenant_id" "uuid",
    "attempts" integer DEFAULT 0 NOT NULL,
    "blocked_until" timestamp with time zone,
    "last_attempt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_login_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_ad_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "account_name" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sync_at" timestamp with time zone,
    CONSTRAINT "bi_ad_accounts_platform_check" CHECK (("platform" = ANY (ARRAY['meta'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."bi_ad_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_ad_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "status" "text",
    "objective" "text",
    "spend" numeric(12,2) DEFAULT 0,
    "impressions" bigint DEFAULT 0,
    "clicks" bigint DEFAULT 0,
    "conversions" bigint DEFAULT 0,
    "revenue" numeric(12,2) DEFAULT 0,
    "date_start" "date",
    "date_end" "date",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ad_account_id" "uuid",
    "platform" "text",
    "utm_campaign" "text"
);


ALTER TABLE "public"."bi_ad_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_ad_daily_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "stat_date" "date" NOT NULL,
    "spend" numeric(12,2) DEFAULT 0,
    "impressions" bigint DEFAULT 0,
    "clicks" bigint DEFAULT 0,
    "conversions" bigint DEFAULT 0,
    "revenue" numeric(12,2) DEFAULT 0,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bi_ad_daily_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_ad_spend" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ad_account_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "platform" "text" NOT NULL,
    "date" "date" NOT NULL,
    "spend" numeric(12,2) DEFAULT 0 NOT NULL,
    "impressions" integer,
    "clicks" integer,
    "leads" integer,
    "currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "raw_data" "jsonb",
    "source" "text" DEFAULT 'api'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bi_ad_spend_platform_check" CHECK (("platform" = ANY (ARRAY['meta'::"text", 'google'::"text"]))),
    CONSTRAINT "bi_ad_spend_source_check" CHECK (("source" = ANY (ARRAY['api'::"text", 'csv'::"text"])))
);


ALTER TABLE "public"."bi_ad_spend" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_sdr_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "daily_target" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bi_sdr_targets_daily_target_check" CHECK (("daily_target" >= 0)),
    CONSTRAINT "bi_sdr_targets_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."bi_sdr_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meta_app_id" "text",
    "meta_app_secret" "text",
    "google_developer_token" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ms_client_id" "text",
    "ms_client_secret" "text",
    "singleton" boolean DEFAULT true NOT NULL,
    "tiktok_app_id" "text",
    "tiktok_app_secret" "text",
    "tiktok_access_token" "text",
    "tiktok_refresh_token" "text",
    "tiktok_token_expires_at" timestamp with time zone,
    "tiktok_ad_account_ids" "text"[],
    "tiktok_numeric_app_id" "text",
    "meta_system_token" "text",
    "meta_system_token_saved_at" timestamp with time zone,
    "zoom_client_id" "text",
    "zoom_client_secret" "text",
    "zoom_account_id" "text"
);


ALTER TABLE "public"."bi_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."bi_settings" IS 'BI PRO™: Singleton row — OAuth credentials for Meta Ads, Google Ads, Microsoft, and Zoom integrations. Google Calendar OAuth (google_client_id/secret) lives in the settings table.';



COMMENT ON COLUMN "public"."bi_settings"."meta_system_token" IS 'Meta System User Token (permanente, gerado no Business Manager). Não expira.';



COMMENT ON COLUMN "public"."bi_settings"."meta_system_token_saved_at" IS 'Timestamp de quando o operador salvou o System User Token. Referência para auditoria.';



CREATE TABLE IF NOT EXISTS "public"."bi_tiktok_ad_spend" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "advertiser_id" "text" NOT NULL,
    "advertiser_name" "text",
    "campaign_id" "text",
    "campaign_name" "text",
    "adgroup_id" "text",
    "adgroup_name" "text",
    "spend" numeric(12,4) DEFAULT 0,
    "spend_brl" numeric(12,4),
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "cpc" numeric(10,4),
    "cpm" numeric(10,4),
    "ctr" numeric(6,4),
    "conversions" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bi_tiktok_ad_spend" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_voice_session_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer,
    "total_tokens_in" bigint,
    "total_tokens_out" bigint,
    "error_msg" "text"
);


ALTER TABLE "public"."bi_voice_session_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_voice_token_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "model_id" "text" NOT NULL
);


ALTER TABLE "public"."bi_voice_token_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bi_voice_tool_invocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "tool_name" "text" NOT NULL,
    "args" "jsonb",
    "latency_ms" integer,
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bi_voice_tool_invocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_rule_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "url_id" smallint
);


ALTER TABLE "public"."booking_rule_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_set_id" "uuid" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "rule_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['team_priority'::"text", 'random'::"text", 'least_busy'::"text", 'specific_user'::"text", 'round_robin'::"text"])))
);


ALTER TABLE "public"."booking_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_token_jti_usage" (
    "jti" "text" NOT NULL,
    "revoked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text"
);


ALTER TABLE "public"."booking_token_jti_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_token_jti_usage" IS 'ADR-SP-01: Denylist of revoked booking JWT tokens (opt-in revocation). Checked on every public-booking request. GC cron purges entries older than token TTL.';



CREATE TABLE IF NOT EXISTS "public"."canned_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "shortcut" "text",
    "content" "text" NOT NULL,
    "channels" "text"[] DEFAULT ARRAY['whatsapp'::"text", 'instagram'::"text"],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."canned_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trade_name" "text" NOT NULL,
    "legal_name" "text",
    "tax_id" "text",
    "email" "text",
    "phone" "text",
    "website" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients_companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "whatsapp" "text",
    "document" "text",
    "type" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text",
    "service_status" "text" DEFAULT 'open'::"text",
    "source" "text",
    "accepts_calls" boolean DEFAULT true,
    "ai_enabled" boolean DEFAULT true,
    "archived" boolean DEFAULT false,
    "archived_at" timestamp with time zone,
    "score" integer,
    "score_matrix_id" "uuid",
    "income" "text",
    "moment" "text",
    "goal" "text",
    "disc_profile" "text",
    "disc_summary" "text",
    "conversation_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "q1_main_bottleneck" "text",
    "q2_lead_volume_month" "text",
    "q3_team_size" "text",
    "q4_crm_maturity" "text",
    "q5_crm_name" "text",
    "q6_trigger" "text",
    "q7_problem_impact" "text",
    "q8_engagement_level" "text",
    "q9_decision_authority" "text",
    "q10_stakeholders" "text",
    "q11_budget_approved" "text",
    "q12_timeline" "text",
    "q13_urgency_reason" "text",
    "q14_data_ready" "text",
    "q15_minimum_volume" "text",
    "q16_expected_roi" "text",
    "q17_objections" "text",
    "q18_real_fit" "text",
    "q19_qualification_status" "text",
    "q20_rejection_reason" "text",
    "q21_interest_level" "text",
    "q22_close_probability" "text",
    "q23_behavioral_tags" "text",
    "q24_last_update_by_agent" "text",
    "q25_disc_profile" "text",
    "q26_disc_analysis" "text",
    "instagram_user_id" "text",
    "instagram_id" "text",
    "telefone" "text",
    "ai_last_message_at" timestamp with time zone,
    "ai_processing_lock" boolean DEFAULT false NOT NULL,
    "instagram_handle" "text",
    "merged_into_id" "uuid",
    "merge_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "instagram_business_id" "text",
    "profile_picture" "text",
    "instagram_followers" integer,
    "instagram_verified" boolean DEFAULT false,
    "google_place_id" "text",
    "google_maps_url" "text",
    "google_rating" numeric(2,1),
    "google_review_count" integer,
    "website" "text",
    "address" "text",
    "business_category" "text",
    "linkedin_url" "text",
    "facebook_url" "text",
    "youtube_url" "text",
    "company_description" "text",
    "enrichment_layers" "text"[],
    "identity_collection_opted_out" boolean DEFAULT false,
    "tiktok_open_id" "text",
    "ai_processing_lock_at" timestamp with time zone,
    "manychat_subscriber_id" bigint,
    "tiktok_username" "text",
    "kiwify_customer_id" "text",
    "whatsapp_optin" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" DEFAULT "public"."get_current_settings_user_id"(),
    "unread_count" integer DEFAULT 0 NOT NULL,
    "first_unread_at" timestamp with time zone,
    "last_read_at" timestamp with time zone,
    "last_read_by" "uuid",
    "ai_paused_reason" "text",
    "ai_paused_at" timestamp with time zone,
    "active_channel_id" "uuid",
    CONSTRAINT "clients_people_service_status_check" CHECK ((("service_status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'in_service'::"text"])) OR ("service_status" IS NULL))),
    CONSTRAINT "clients_people_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'archived'::"text", 'merged'::"text"])))
);

ALTER TABLE ONLY "public"."clients_people" REPLICA IDENTITY FULL;


ALTER TABLE "public"."clients_people" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients_people"."q1_main_bottleneck" IS 'Q1: Gargalo principal identificado';



COMMENT ON COLUMN "public"."clients_people"."q2_lead_volume_month" IS 'Q2: Volume de leads por mês';



COMMENT ON COLUMN "public"."clients_people"."q3_team_size" IS 'Q3: Tamanho da equipe comercial';



COMMENT ON COLUMN "public"."clients_people"."q4_crm_maturity" IS 'Q4: Maturidade do CRM/Dados';



COMMENT ON COLUMN "public"."clients_people"."q5_crm_name" IS 'Q5: Nome do CRM utilizado';



COMMENT ON COLUMN "public"."clients_people"."q6_trigger" IS 'Q6: Gatilho que motivou a busca';



COMMENT ON COLUMN "public"."clients_people"."q7_problem_impact" IS 'Q7: Impacto do problema atual';



COMMENT ON COLUMN "public"."clients_people"."q8_engagement_level" IS 'Q8: Nível de engajamento';



COMMENT ON COLUMN "public"."clients_people"."q9_decision_authority" IS 'Q9: Autoridade de decisão';



COMMENT ON COLUMN "public"."clients_people"."q10_stakeholders" IS 'Q10: Outros stakeholders envolvidos';



COMMENT ON COLUMN "public"."clients_people"."q11_budget_approved" IS 'Q11: Budget está aprovado?';



COMMENT ON COLUMN "public"."clients_people"."q12_timeline" IS 'Q12: Timeline de implementação';



COMMENT ON COLUMN "public"."clients_people"."q13_urgency_reason" IS 'Q13: Razão da urgência real';



COMMENT ON COLUMN "public"."clients_people"."q14_data_ready" IS 'Q14: CRM e dados organizados?';



COMMENT ON COLUMN "public"."clients_people"."q15_minimum_volume" IS 'Q15: Volume mínimo de leads';



COMMENT ON COLUMN "public"."clients_people"."q16_expected_roi" IS 'Q16: ROI ou resultado esperado';



COMMENT ON COLUMN "public"."clients_people"."q17_objections" IS 'Q17: Principais objeções';



COMMENT ON COLUMN "public"."clients_people"."q18_real_fit" IS 'Q18: Fit real - avaliação do agente';



COMMENT ON COLUMN "public"."clients_people"."q19_qualification_status" IS 'Q19: Status da qualificação';



COMMENT ON COLUMN "public"."clients_people"."q20_rejection_reason" IS 'Q20: Motivo se não aprovado';



COMMENT ON COLUMN "public"."clients_people"."q21_interest_level" IS 'Q21: Nível de interesse (0-10)';



COMMENT ON COLUMN "public"."clients_people"."q22_close_probability" IS 'Q22: Probabilidade de fechar (0-100%)';



COMMENT ON COLUMN "public"."clients_people"."q23_behavioral_tags" IS 'Q23: Tags comportamentais';



COMMENT ON COLUMN "public"."clients_people"."q24_last_update_by_agent" IS 'Q24: Última atualização por agente';



COMMENT ON COLUMN "public"."clients_people"."q25_disc_profile" IS 'Q25: Perfil DISC identificado';



COMMENT ON COLUMN "public"."clients_people"."q26_disc_analysis" IS 'Q26: Análise DISC e recomendações';



COMMENT ON COLUMN "public"."clients_people"."ai_last_message_at" IS 'Timestamp of last inbound message (used by pg_cron debounce check)';



COMMENT ON COLUMN "public"."clients_people"."ai_processing_lock" IS 'Lock flag: prevents concurrent ai-agent-execute runs for same person';



COMMENT ON COLUMN "public"."clients_people"."profile_picture" IS 'Profile picture URL (from Instagram, WhatsApp, etc.)';



COMMENT ON COLUMN "public"."clients_people"."instagram_followers" IS 'Instagram follower count at time of last enrichment';



COMMENT ON COLUMN "public"."clients_people"."instagram_verified" IS 'Whether the Instagram account has a verified badge';



COMMENT ON COLUMN "public"."clients_people"."google_place_id" IS 'ID do estabelecimento no Google Maps (via Apify)';



COMMENT ON COLUMN "public"."clients_people"."google_rating" IS 'Nota média no Google (ex: 4.2). Fonte: Apify compass/crawler-google-places';



COMMENT ON COLUMN "public"."clients_people"."enrichment_layers" IS 'Camadas de enriquecimento aplicadas (ex: [''google_maps'', ''contact_scraper''])';



COMMENT ON COLUMN "public"."clients_people"."ai_processing_lock_at" IS 'FIX-AGENT-DUP-01 camada-3: timestamp do acquire do ai_processing_lock. TTL anti-lock-preso — um lock mais velho que o TTL (LOCK_TTL_SECONDS no ai-agent-execute) é reclaimável, para não silenciar conversas após crash/timeout do worker. Aditivo: o CAS no boolean funciona sem esta coluna.';



COMMENT ON COLUMN "public"."clients_people"."whatsapp_optin" IS 'Explicit WhatsApp marketing opt-in. KFY-1.5 gate: UTILITY templates send always; MARKETING (or missing category) only when true.';



COMMENT ON COLUMN "public"."clients_people"."unread_count" IS 'Cache de COUNT(*) de messages inbound com seen_at IS NULL. Mantido pelo trigger bump_clients_people_on_message (insert) e zerado por mark_conversation_read(). Reparável via recalc_unread_count().';



COMMENT ON COLUMN "public"."clients_people"."first_unread_at" IS 'created_at da mensagem que abriu a rajada não lida atual — usado pra "esperando há Xh" no Omni/Kanban.';



COMMENT ON COLUMN "public"."clients_people"."last_read_by" IS 'Último atendente que abriu a thread. Inbox é compartilhado, então isso é o único sinal de "quem pegou essa conversa".';



COMMENT ON COLUMN "public"."clients_people"."ai_paused_reason" IS 'Motivo do último auto-pause da IA (ex: human_reply). NULL = nunca pausado automaticamente ou já reativado. Distinto de ai_enabled=false manual: aqui o sistema decidiu, não o admin.';



COMMENT ON COLUMN "public"."clients_people"."active_channel_id" IS 'Canal WhatsApp (settings_whatsapp_channels) que esse lead está usando agora — Meta ou Evolution, quando os dois coexistem. Atualizado automaticamente por trg_sync_active_channel a cada mensagem de conversa real (exceto campaign, que não deve reatribuir); sobrescrevível manualmente na UI.';



CREATE TABLE IF NOT EXISTS "public"."clients_people_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "people_id" "uuid",
    "company_id" "uuid",
    "role" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients_people_companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients_people_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "people_id" "uuid",
    "user_id" "uuid",
    "field_name" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients_people_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversion_event_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "meta_enabled" boolean DEFAULT false NOT NULL,
    "meta_pixel_id" "text",
    "meta_event_name" "text",
    "meta_send_value" boolean DEFAULT false NOT NULL,
    "google_enabled" boolean DEFAULT false NOT NULL,
    "google_account_id" "text",
    "google_conversion_action_id" "text",
    "google_conversion_action_name" "text",
    "google_send_value" boolean DEFAULT false NOT NULL,
    "google_currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversion_event_rules_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['stage_enter'::"text", 'lead_won'::"text", 'lead_lost'::"text", 'lead_created'::"text", 'booking_status'::"text"])))
);


ALTER TABLE "public"."conversion_event_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversion_event_rules" IS 'Flexible conversion event rules: maps CRM events to ad platform conversion events';



CREATE TABLE IF NOT EXISTS "public"."conversion_events_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "lead_source" "text",
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "meta_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "meta_response" "jsonb",
    "meta_sent_at" timestamp with time zone,
    "google_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "google_response" "jsonb",
    "google_sent_at" timestamp with time zone,
    "skip_reason" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversion_events_queue_google_status_check" CHECK (("google_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "conversion_events_queue_meta_status_check" CHECK (("meta_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."conversion_events_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversion_events_queue" IS 'Queue for ad platform conversion events triggered by lead stage changes';



CREATE TABLE IF NOT EXISTS "public"."conversion_platform_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "credentials" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversion_platform_credentials_platform_check" CHECK (("platform" = ANY (ARRAY['meta'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."conversion_platform_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversion_platform_credentials" IS 'Ad platform credentials for conversion tracking (Meta CAPI, Google Ads)';



COMMENT ON COLUMN "public"."conversion_platform_credentials"."credentials" IS 'Meta: {pixel_id, access_token, test_event_code}. Google: {customer_id, developer_token, oauth_refresh_token, login_customer_id, conversion_action}';



CREATE TABLE IF NOT EXISTS "public"."conversion_stage_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "meta_enabled" boolean DEFAULT false NOT NULL,
    "meta_event_name" "text",
    "meta_send_value" boolean DEFAULT false NOT NULL,
    "google_enabled" boolean DEFAULT false NOT NULL,
    "google_conversion_action" "text",
    "google_send_value" boolean DEFAULT false NOT NULL,
    "google_currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversion_stage_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversion_stage_mappings" IS 'Maps pipeline stages to ad platform conversion events';



CREATE TABLE IF NOT EXISTS "public"."crm_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modulos_ativos" "jsonb" DEFAULT '{"visitas": false, "reservas": false, "reunioes": false, "campanhas": false}'::"jsonb",
    "webhook_conversas" "text",
    "disc_config" "jsonb" DEFAULT '{"model": "gpt-4o-mini", "api_key": null, "enabled": false, "temperature": 0.7}'::"jsonb",
    "resumo_config" "jsonb" DEFAULT '{"model": "gpt-4o-mini", "api_key": null, "enabled": false, "temperature": 0.7}'::"jsonb",
    "ativo" boolean DEFAULT true NOT NULL,
    "logo_url" "text",
    "tenant_slug" "text",
    "primary_color" "text",
    "secondary_color" "text",
    CONSTRAINT "crm_tenants_webhook_conversas_check" CHECK ((("webhook_conversas" IS NULL) OR ("webhook_conversas" ~ '^https?://[^\s/$.?#].[^\s]*$'::"text")))
);


ALTER TABLE "public"."crm_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "protocol" "text" DEFAULT ((('DEL-'::"text" || "to_char"("now"(), 'YYYYMMDD'::"text")) || '-'::"text") || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "data_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."data_deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_export_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "requested_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "download_url" "text",
    "expires_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_export_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."data_export_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."elevenlabs_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "elevenlabs_agent_id" "text" NOT NULL,
    "name" "text",
    "voice_id" "text",
    "llm_provider" "text",
    "llm_model" "text",
    "phone_number_id" "text",
    "phone_number" "text",
    "first_message" "text",
    "status" "text" DEFAULT 'active'::"text",
    "ai_agent_id" "uuid",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."elevenlabs_agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."elevenlabs_agents" IS 'ElevenLabs: Conversational AI agents linked to CRM ai_agents';



CREATE TABLE IF NOT EXISTS "public"."elevenlabs_voices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voice_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "language" "text",
    "description" "text",
    "stability" numeric(4,3) DEFAULT 0.500,
    "similarity_boost" numeric(4,3) DEFAULT 0.750,
    "style" numeric(4,3) DEFAULT 0.000,
    "speed" numeric(4,3) DEFAULT 1.000,
    "preview_url" "text",
    "is_default" boolean DEFAULT false,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gender" "text",
    "use_case" "text",
    "labels" "jsonb" DEFAULT '{}'::"jsonb",
    "source" "text" DEFAULT 'workspace'::"text"
);


ALTER TABLE "public"."elevenlabs_voices" OWNER TO "postgres";


COMMENT ON TABLE "public"."elevenlabs_voices" IS 'ElevenLabs: Cached voice catalog synced from workspace API';



COMMENT ON COLUMN "public"."elevenlabs_voices"."gender" IS 'Voice gender: male, female, neutral';



COMMENT ON COLUMN "public"."elevenlabs_voices"."use_case" IS 'Primary use case: narration, conversational, characters, etc.';



COMMENT ON COLUMN "public"."elevenlabs_voices"."labels" IS 'Full labels object from ElevenLabs API (language, accent, age, etc.)';



COMMENT ON COLUMN "public"."elevenlabs_voices"."source" IS 'workspace = user library, shared = ElevenLabs shared library';



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "html_body" "text" NOT NULL,
    "variables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "category" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_templates" IS 'Reusable HTML email template library (ADR-EMAIL-01 §4). Referenced optionally by leads_stages_followups.email_template_id; no Meta-style approval. Mirror concept of whatsapp_templates.';



COMMENT ON COLUMN "public"."email_templates"."name" IS 'Internal template name shown in the picker/list.';



COMMENT ON COLUMN "public"."email_templates"."subject" IS 'Email subject line. Accepts {{var}} tokens rendered by _shared/email-provider.ts.';



COMMENT ON COLUMN "public"."email_templates"."html_body" IS 'HTML email body. Accepts {{var}} tokens; lead-supplied values must be escaped at render time.';



COMMENT ON COLUMN "public"."email_templates"."variables" IS 'Declared variable names for preview substitution and validation (e.g. {nome,produto}).';



COMMENT ON COLUMN "public"."email_templates"."category" IS 'Free-form label to group templates (e.g. pos-venda, recuperacao). Nullable.';



COMMENT ON COLUMN "public"."email_templates"."active" IS 'Soft on/off flag; inactive templates are hidden from pickers but not deleted.';



CREATE OR REPLACE VIEW "public"."followup_queue_legacy" AS
 SELECT "id",
    "followup_id",
    "meeting_followup_id",
    "lead_id",
    "person_id",
    "channel",
    "template_id",
    "message",
    "subject",
    "phone_number",
    "source_type",
    "scheduled_for",
    "fired_at",
    "status",
    "message_id",
    "response_data",
    "error_message",
    "retry_count",
    "created_at",
    "updated_at",
    "channel" AS "canal",
    "subject" AS "assunto",
    "scheduled_for" AS "scheduled_at"
   FROM "public"."followup_queue";


ALTER VIEW "public"."followup_queue_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_pro_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "pipeline_id" "uuid",
    "fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "webhook_url" "text",
    "webhook_secret" "text",
    "create_contact" boolean DEFAULT true NOT NULL,
    "create_lead" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."form_pro_forms" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_pro_forms" IS 'FORM PRO™: Smart form definitions. Post-submit actions via settings.post_submit_actions (whatsapp_auto deprecated/disabled as of 2026-03-14).';



COMMENT ON COLUMN "public"."form_pro_forms"."fields" IS 'Array of field configs: {id, type, label, placeholder, required, crm_field, validation, conditions, order}';



COMMENT ON COLUMN "public"."form_pro_forms"."settings" IS 'Form settings: {submit_text, success_message, redirect_url}';



COMMENT ON COLUMN "public"."form_pro_forms"."webhook_url" IS 'POST target URL — called on every form submission with full payload';



COMMENT ON COLUMN "public"."form_pro_forms"."webhook_secret" IS 'Optional HMAC-SHA256 secret — sent as X-LP-Signature header';



COMMENT ON COLUMN "public"."form_pro_forms"."create_contact" IS 'When true, upsert a clients_people record from submission data';



COMMENT ON COLUMN "public"."form_pro_forms"."create_lead" IS 'When true, create/update a leads record from submission data';



CREATE TABLE IF NOT EXISTS "public"."form_pro_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip" "text" NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_pro_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_pro_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid",
    "form_id" "uuid",
    "lead_id" "uuid",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_content" "text",
    "utm_term" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "people_id" "uuid",
    "source" "text" DEFAULT 'site'::"text" NOT NULL,
    "meta_form_id" "uuid",
    "gclid" "text",
    "fbclid" "text",
    "fbc" "text",
    "fbp" "text",
    "meta_leadgen_id" "text",
    "meta_adgroup_id" "text",
    CONSTRAINT "form_pro_submissions_source_check" CHECK (("source" = ANY (ARRAY['site'::"text", 'meta'::"text"])))
);


ALTER TABLE "public"."form_pro_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_pro_submissions" IS 'LP PRO™: Form submissions with UTM attribution and CRM lead linkage';



COMMENT ON COLUMN "public"."form_pro_submissions"."form_id" IS 'FK to form_pro_forms for source=site submissions (no hard FK to allow meta_form_id usage)';



COMMENT ON COLUMN "public"."form_pro_submissions"."lead_id" IS 'FK to leads table — set after CRM upsert via Edge Function';



COMMENT ON COLUMN "public"."form_pro_submissions"."data" IS 'Raw form field values keyed by field id';



COMMENT ON COLUMN "public"."form_pro_submissions"."people_id" IS 'FK to clients_people — set after CRM upsert via Edge Function';



COMMENT ON COLUMN "public"."form_pro_submissions"."source" IS 'Origin: site (Form Site / lp-submit) or meta (Meta Lead Ads / webhook)';



COMMENT ON COLUMN "public"."form_pro_submissions"."meta_form_id" IS 'FK to meta_lead_forms for source=meta submissions';



COMMENT ON COLUMN "public"."form_pro_submissions"."gclid" IS 'Google Ads click ID captured from URL';



COMMENT ON COLUMN "public"."form_pro_submissions"."fbclid" IS 'Facebook click ID captured from URL';



COMMENT ON COLUMN "public"."form_pro_submissions"."fbc" IS 'Meta fbc cookie value for CAPI';



COMMENT ON COLUMN "public"."form_pro_submissions"."fbp" IS 'Meta fbp browser ID cookie for CAPI';



COMMENT ON COLUMN "public"."form_pro_submissions"."meta_leadgen_id" IS 'Meta Lead Ads leadgen_id (used as lead_id in CAPI)';



COMMENT ON COLUMN "public"."form_pro_submissions"."meta_adgroup_id" IS 'Meta ad-level ID from leadgen webhook';



CREATE TABLE IF NOT EXISTS "public"."inbound_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "field_mapping" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "create_mode" "text" DEFAULT 'criar'::"text" NOT NULL,
    "trigger_config" "jsonb",
    CONSTRAINT "inbound_webhooks_create_mode_check" CHECK (("create_mode" = ANY (ARRAY['criar'::"text", 'criar_se_nao_existir'::"text", 'atualizar_etapa'::"text", 'somente_etapa'::"text"])))
);


ALTER TABLE "public"."inbound_webhooks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inbound_webhooks"."create_mode" IS 'Controla comportamento ao receber payload: criar | criar_se_nao_existir | atualizar_etapa | somente_etapa';



COMMENT ON COLUMN "public"."inbound_webhooks"."trigger_config" IS 'Disparo automatico opcional. JSONB shape: {enabled, template_id, template_name, channel, delay_minutes}. NULL = desabilitado.';



CREATE TABLE IF NOT EXISTS "public"."instagram_automation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid",
    "automation_name" "text",
    "trigger_type" "text",
    "person_id" "uuid",
    "person_name" "text",
    "ig_message_id" "text",
    "message_text" "text",
    "filters_matched" "jsonb",
    "action_executed" "text",
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "executed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "instagram_automation_log_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'skipped'::"text", 'cooldown'::"text"])))
);


ALTER TABLE "public"."instagram_automation_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instagram_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "trigger_type" "text" NOT NULL,
    "filter_operator" "text" DEFAULT 'any'::"text" NOT NULL,
    "filters" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_dm_text" "text",
    "action_comment_text" "text",
    "cooldown_hours" integer DEFAULT 24 NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action_comment_texts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "action_dm_quick_replies" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "target_post_id" "text",
    CONSTRAINT "instagram_automations_action_type_check" CHECK (("action_type" = ANY (ARRAY['send_dm'::"text", 'reply_comment'::"text", 'reply_and_dm'::"text"]))),
    CONSTRAINT "instagram_automations_filter_operator_check" CHECK (("filter_operator" = ANY (ARRAY['any'::"text", 'all'::"text"]))),
    CONSTRAINT "instagram_automations_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['incoming_dm'::"text", 'post_comment'::"text", 'story_mention'::"text", 'story_reply'::"text"])))
);


ALTER TABLE "public"."instagram_automations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."instagram_automations"."action_comment_texts" IS 'Array of comment reply text variations. Runner picks one randomly at send time. Supports {{nome}} variable.';



COMMENT ON COLUMN "public"."instagram_automations"."action_dm_quick_replies" IS 'Array of {title: string} quick reply buttons sent with the DM. Meta API limit: max 13 items, max 20 chars per title.';



COMMENT ON COLUMN "public"."instagram_automations"."target_post_id" IS 'Instagram post ID to target. NULL = all posts. Only used when trigger_type = ''post_comment''.';



CREATE TABLE IF NOT EXISTS "public"."kiwify_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "text" NOT NULL,
    "client_secret_enc" "text" NOT NULL,
    "access_token_enc" "text",
    "token_expires_at" timestamp with time zone,
    "webhook_id" "text",
    "webhook_token_enc" "text",
    "enforce_signature" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'disconnected'::"text" NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "text" NOT NULL,
    CONSTRAINT "kiwify_connections_status_check" CHECK (("status" = ANY (ARRAY['disconnected'::"text", 'connected'::"text", 'error'::"text", 'pending_webhook'::"text"])))
);


ALTER TABLE "public"."kiwify_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiwify_connections" IS 'Kiwify account connection (single-tenant). Secrets encrypted via app_encrypt_secret with context ''kiwify_''||account_id.';



COMMENT ON COLUMN "public"."kiwify_connections"."client_secret_enc" IS 'Encrypted OAuth client_secret. Never store plaintext.';



COMMENT ON COLUMN "public"."kiwify_connections"."enforce_signature" IS 'When true, kiwify-inbound rejects invalid signatures with 401 (KFY-1.4). Default false until signature mechanism is confirmed against a real webhook.';



COMMENT ON COLUMN "public"."kiwify_connections"."client_id" IS 'Kiwify OAuth client_id (UUID from dashboard). Distinct from account_id. Not a secret — plaintext text.';



CREATE TABLE IF NOT EXISTS "public"."kiwify_event_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "text",
    "trigger" "text" NOT NULL,
    "target_pipeline_id" "uuid" NOT NULL,
    "target_stage_id" "uuid" NOT NULL,
    "tags_to_add" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "tags_to_remove" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kiwify_event_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiwify_event_mappings" IS 'Maps a Kiwify trigger (optionally per product_id) to a target pipeline/stage. product_id NULL = default.';



CREATE TABLE IF NOT EXISTS "public"."kiwify_lead_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "people_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "connection_id" "uuid",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kiwify_lead_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiwify_lead_products" IS 'M-N junction: which Kiwify products a contact owns. Populated by kiwify-process-event on ownership events (compra_aprovada/subscription_renewed).';



COMMENT ON COLUMN "public"."kiwify_lead_products"."product_id" IS 'Kiwify product id (text).';



COMMENT ON COLUMN "public"."kiwify_lead_products"."product_name" IS 'Snapshot of product name at last ownership event.';



COMMENT ON COLUMN "public"."kiwify_lead_products"."first_seen_at" IS 'First ownership event — never updated on upsert.';



COMMENT ON COLUMN "public"."kiwify_lead_products"."last_seen_at" IS 'Most recent ownership event — refreshed on upsert.';



CREATE TABLE IF NOT EXISTS "public"."kiwify_message_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "text",
    "trigger" "text" NOT NULL,
    "steps" "jsonb" NOT NULL,
    "cancel_on_triggers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kiwify_message_automations" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiwify_message_automations" IS 'WhatsApp automation flows per trigger. steps = ordered [{delay_minutes, template_id, variables}]; cancel_on_triggers halts pending jobs when a later trigger arrives.';



COMMENT ON COLUMN "public"."kiwify_message_automations"."steps" IS 'template_id may be null in seeds until the real WhatsApp template is assigned (KFY-1.5 config).';



CREATE TABLE IF NOT EXISTS "public"."kiwify_message_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "automation_id" "uuid",
    "people_id" "uuid",
    "lead_id" "uuid",
    "order_id" "text",
    "trigger" "text" NOT NULL,
    "step_index" integer NOT NULL,
    "template_id" "text",
    "variables" "jsonb",
    "cancel_on_triggers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message_id" bigint,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "fired_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kiwify_message_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text", 'skipped_no_optin'::"text"])))
);


ALTER TABLE "public"."kiwify_message_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiwify_message_jobs" IS 'Runtime WhatsApp job queue for Kiwify automations. Dedicated (not followup_queue) per ADR-KFY-01. Dispatched by kiwify-dispatch-worker (pg_cron 1min) via whatsapp-outbound.';



CREATE TABLE IF NOT EXISTS "public"."kiwify_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "trigger" "text",
    "event_type" "text" NOT NULL,
    "order_id" "text",
    "subscription_id" "text",
    "dedup_key" "text" NOT NULL,
    "raw_payload" "jsonb" NOT NULL,
    "signature_valid" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "processed_at" timestamp with time zone,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kiwify_webhook_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'processed'::"text", 'failed'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."kiwify_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiwify_webhook_events" IS 'Raw inbound webhook log + idempotency. UNIQUE(connection_id,event_type,dedup_key) dedupes Kiwify retries while allowing legit status transitions of the same order_id.';



COMMENT ON COLUMN "public"."kiwify_webhook_events"."dedup_key" IS 'order_id (orders) | subscription_id||''|''||charge_date (subscriptions) | md5(email||product_id||checkout_id?) (cart). Stable-field for cart is TODO(verify) against real payload.';



CREATE TABLE IF NOT EXISTS "public"."lead_field_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "key" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "pipeline_id" "uuid",
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "required" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entity_type" "text" DEFAULT 'negocio'::"text" NOT NULL,
    "agent_managed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "lead_field_definitions_category_check" CHECK (("category" = ANY (ARRAY['qualificacao'::"text", 'contato'::"text", 'comercial'::"text", 'custom'::"text", 'outros'::"text"]))),
    CONSTRAINT "lead_field_definitions_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['negocio'::"text", 'pessoa'::"text", 'empresa'::"text"]))),
    CONSTRAINT "lead_field_definitions_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'number'::"text", 'single_select'::"text", 'select'::"text", 'boolean'::"text", 'date'::"text", 'textarea'::"text"])))
);


ALTER TABLE "public"."lead_field_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_field_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "field_definition_id" "uuid" NOT NULL,
    "value_text" "text",
    "value_number" numeric,
    "value_boolean" boolean,
    "value_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entity_type" "text" DEFAULT 'negocio'::"text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    CONSTRAINT "lead_field_values_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['negocio'::"text", 'pessoa'::"text", 'empresa'::"text"])))
);


ALTER TABLE "public"."lead_field_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#3B82F6'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "csv_headers" "text"[] DEFAULT '{nome,whatsapp}'::"text"[] NOT NULL,
    "csv_example" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "whatsapp_template_id" "uuid"
);


ALTER TABLE "public"."lead_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "control" "text" DEFAULT '1'::"text",
    "value" numeric DEFAULT 0,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "people_id" "uuid",
    "company_id" "uuid",
    "leads_pipelines_id" "uuid",
    "leads_stages_id" "uuid",
    "leads_loss_reasons_id" "uuid",
    "loss_reason" "text",
    "teams_id" "uuid",
    "user_id" "uuid",
    "archived" boolean DEFAULT false,
    "archived_at" timestamp with time zone,
    "won_at" timestamp with time zone,
    "lost_at" timestamp with time zone,
    "last_interaction_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "gclid" "text",
    "fbclid" "text",
    "fb_lead_id" "text",
    "fbc" "text",
    "fbp" "text",
    "lead_source" "text",
    "pre_sale_temperature" smallint,
    "close_probability" smallint,
    "lifecycle_stage" "text" DEFAULT 'lead'::"text",
    "recomendante" "text",
    "relacao_recomendante" "text",
    "relacao_corretor" "text",
    "nome_evento" "text",
    "origem_lista" "text",
    "first_inbound_at" timestamp with time zone,
    CONSTRAINT "leads_close_probability_check" CHECK ((("close_probability" IS NULL) OR (("close_probability" >= 1) AND ("close_probability" <= 5)))),
    CONSTRAINT "leads_lifecycle_stage_check" CHECK (("lifecycle_stage" = ANY (ARRAY['lead'::"text", 'mql'::"text", 'sql'::"text", 'opportunity'::"text", 'customer'::"text", 'churned'::"text"]))),
    CONSTRAINT "leads_pre_sale_temperature_check" CHECK ((("pre_sale_temperature" IS NULL) OR (("pre_sale_temperature" >= 1) AND ("pre_sale_temperature" <= 5)))),
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'won'::"text", 'lost'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads"."utm_source" IS 'Campaign Source - identifies search engine, newsletter name, or other source';



COMMENT ON COLUMN "public"."leads"."utm_medium" IS 'Campaign Medium - identifies medium such as email or cost-per-click';



COMMENT ON COLUMN "public"."leads"."utm_campaign" IS 'Campaign Name - identifies specific product promotion or strategic campaign';



COMMENT ON COLUMN "public"."leads"."utm_term" IS 'Campaign Term - used for paid search keywords';



COMMENT ON COLUMN "public"."leads"."utm_content" IS 'Campaign Content - used for A/B testing and content-targeted ads';



COMMENT ON COLUMN "public"."leads"."gclid" IS 'Google Click Identifier - Google Ads tracking';



COMMENT ON COLUMN "public"."leads"."fbclid" IS 'Facebook Click Identifier - Facebook Ads tracking';



COMMENT ON COLUMN "public"."leads"."fb_lead_id" IS 'Facebook Lead ID - Lead Ads form submission identifier';



COMMENT ON COLUMN "public"."leads"."fbc" IS 'Meta fbc cookie value (fb.1.{ts}.{fbclid}) for CAPI matching';



COMMENT ON COLUMN "public"."leads"."fbp" IS 'Meta fbp cookie value (browser ID) for CAPI matching';



COMMENT ON COLUMN "public"."leads"."lead_source" IS 'Lead origin: site_form, meta_lead_ad, whatsapp, manual, organic';



COMMENT ON COLUMN "public"."leads"."pre_sale_temperature" IS 'Pre-sale temperature (1-5 🔥). How warm the lead is before commercial contact.';



COMMENT ON COLUMN "public"."leads"."close_probability" IS 'Close probability (1-5 ⭐ → 20/40/60/80/100%). Likelihood of closing the deal.';



COMMENT ON COLUMN "public"."leads"."lifecycle_stage" IS 'Customer journey stage: lead → mql → sql → opportunity → customer | churned. Set manually, used by BI for funnel analytics.';



COMMENT ON COLUMN "public"."leads"."recomendante" IS 'Nome de quem indicou o lead';



COMMENT ON COLUMN "public"."leads"."relacao_recomendante" IS 'Relação do lead com o recomendante';



COMMENT ON COLUMN "public"."leads"."relacao_corretor" IS 'Relação do lead com o corretor';



COMMENT ON COLUMN "public"."leads"."nome_evento" IS 'Nome do evento de origem do lead';



COMMENT ON COLUMN "public"."leads"."origem_lista" IS 'Lista ou campanha de origem do lead';



CREATE TABLE IF NOT EXISTS "public"."leads_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "user_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_loss_reasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads_loss_reasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "user_id" "uuid",
    "title" "text",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "order_index" integer DEFAULT 0 NOT NULL,
    "kiwify_product_id" "text",
    "kiwify_product_name" "text"
);


ALTER TABLE "public"."leads_pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_stage_duplication_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_stage_id" "uuid" NOT NULL,
    "target_pipeline_id" "uuid" NOT NULL,
    "target_stage_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leads_stage_duplication_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leads_pipelines_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ai_priority" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."leads_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_stages_followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text" NOT NULL,
    "whatsapp_template_id" "text",
    "score_matrix_id" "uuid",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "target_stage_id" "uuid",
    "leads_stages_id" "uuid",
    "type" "text" DEFAULT 'texto'::"text" NOT NULL,
    "subject" "text",
    "template_id" "text",
    "audio_file" "text",
    "days" integer DEFAULT 0 NOT NULL,
    "hours" integer DEFAULT 0 NOT NULL,
    "minutes" integer DEFAULT 0 NOT NULL,
    "lead_type" "text",
    "business_hours_only" boolean DEFAULT false NOT NULL,
    "bh_only_last" boolean DEFAULT true NOT NULL,
    "control" "text",
    "as_queue_id" "uuid",
    "email_template_id" "uuid"
);


ALTER TABLE "public"."leads_stages_followups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads_stages_followups"."target_stage_id" IS 'Etapa destino opcional: lead é movido após envio';



COMMENT ON COLUMN "public"."leads_stages_followups"."email_template_id" IS 'Optional reference to an email_templates row. When set, the follow-up inherits subject+html from the template; when NULL, the inline subject+message HTML is used (backward-compat).';



CREATE TABLE IF NOT EXISTS "public"."leads_tags" (
    "lead_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."leads_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "user_id" "uuid",
    "from_stage_id" "uuid",
    "to_stage_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lgpd_anonymization_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "performed_by" "uuid",
    "person_id" "uuid" NOT NULL,
    "tables_affected" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lgpd_anonymization_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_followup_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_id" "uuid" NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "lead_id" "uuid",
    "scheduled_for" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "channel" "text" NOT NULL,
    "webhook_url" "text",
    "message_snapshot" "text",
    "fired_at" timestamp with time zone,
    "response_status" integer,
    "response_body" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_id" "uuid",
    "as_queue_id" "uuid",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "held_for_bh" boolean DEFAULT false NOT NULL,
    "original_scheduled_for" timestamp with time zone,
    CONSTRAINT "meeting_followup_queue_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'webhook'::"text", 'ligacao'::"text"]))),
    CONSTRAINT "meeting_followup_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."meeting_followup_queue" REPLICA IDENTITY FULL;


ALTER TABLE "public"."meeting_followup_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."meeting_followup_queue" IS 'Fila de follow-ups agendados por status de reunião. Processada a cada 5 min pela Edge Function process-meeting-followups.';



COMMENT ON COLUMN "public"."meeting_followup_queue"."retry_count" IS 'Number of retry attempts after N8N/webhook callback timeout (max 3). FWUP-06.';



CREATE TABLE IF NOT EXISTS "public"."meeting_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "record_type" "text" NOT NULL,
    "source" "text",
    "url" "text",
    "duration_seconds" integer,
    "thumbnail_url" "text",
    "title" "text",
    "content" "text",
    "content_format" "text" DEFAULT 'markdown'::"text",
    "ai_sentiment" "text",
    "ai_score" integer,
    "ai_key_topics" "text"[],
    "ai_next_steps" "text"[],
    "ai_objections" "text"[],
    "ai_metadata" "jsonb",
    "recorded_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meeting_records_ai_score_check" CHECK ((("ai_score" >= 0) AND ("ai_score" <= 100))),
    CONSTRAINT "meeting_records_ai_sentiment_check" CHECK (("ai_sentiment" = ANY (ARRAY['positivo'::"text", 'neutro'::"text", 'negativo'::"text", 'misto'::"text"]))),
    CONSTRAINT "meeting_records_content_format_check" CHECK (("content_format" = ANY (ARRAY['text'::"text", 'markdown'::"text", 'html'::"text", 'json'::"text"]))),
    CONSTRAINT "meeting_records_record_type_check" CHECK (("record_type" = ANY (ARRAY['recording'::"text", 'transcript'::"text", 'summary'::"text", 'ai_summary'::"text", 'ai_analysis'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."meeting_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "meeting_link" "text",
    "notes" "text",
    "status" "text" DEFAULT 'agendada'::"text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "people_id" "uuid",
    "lead_id" "uuid",
    "user_id" "uuid",
    "teams_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "google_event_id" "text",
    "google_last_synced_at" timestamp with time zone,
    "source" "text",
    "outcome" "text",
    "ms_meeting_id" "text",
    "attendee_emails" "text"[] DEFAULT '{}'::"text"[],
    "gcal_sync_error" "text",
    "meeting_type" "text" DEFAULT 'discovery'::"text",
    "zoom_meeting_id" "text",
    "zoom_join_url" "text",
    "zoom_sync_error" "text",
    "calcom_uid" "text",
    CONSTRAINT "meetings_meeting_type_check" CHECK (("meeting_type" = ANY (ARRAY['discovery'::"text", 'demo'::"text", 'closing'::"text", 'consulting'::"text", 'mentoring'::"text", 'qbr'::"text", 'followup'::"text", 'other'::"text"]))),
    CONSTRAINT "meetings_outcome_check" CHECK (("outcome" = ANY (ARRAY['venda'::"text", 'follow_up'::"text", 'sem_interesse'::"text", 'reagendada'::"text", 'nao_compareceu'::"text"]))),
    CONSTRAINT "meetings_status_check" CHECK (("status" = ANY (ARRAY['agendado'::"text", 'agendada'::"text", 'compareceu'::"text", 'nao_compareceu'::"text", 'não compareceu'::"text", 'cancelado'::"text", 'cancelada'::"text", 'realizado'::"text", 'bloqueio manual'::"text"])))
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings_followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_status" "text" NOT NULL,
    "type" "text" DEFAULT 'texto'::"text" NOT NULL,
    "message" "text",
    "subject" "text",
    "template_id" "text",
    "audio_file" "text",
    "days" integer DEFAULT 0 NOT NULL,
    "hours" integer DEFAULT 0 NOT NULL,
    "minutes" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "control" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "webhook_url" "text",
    "as_queue_id" "uuid",
    "whatsapp_template_id" "uuid",
    "source" "text" DEFAULT 'channel'::"text" NOT NULL,
    "business_hours_only" boolean DEFAULT false NOT NULL,
    "bh_only_last" boolean DEFAULT true NOT NULL,
    CONSTRAINT "meetings_followups_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'webhook'::"text", 'ligacao'::"text"]))),
    CONSTRAINT "meetings_followups_meeting_status_check" CHECK (("meeting_status" = ANY (ARRAY['agendado'::"text", 'compareceu'::"text", 'nao_compareceu'::"text", 'cancelado'::"text", 'realizado'::"text"]))),
    CONSTRAINT "meetings_followups_source_check" CHECK (("source" = ANY (ARRAY['webhook'::"text", 'channel'::"text"])))
);


ALTER TABLE "public"."meetings_followups" OWNER TO "postgres";


COMMENT ON TABLE "public"."meetings_followups" IS 'Follow-ups automáticos disparados por status de reunião';



COMMENT ON COLUMN "public"."meetings_followups"."name" IS 'Label da regra (ex: Lembrete pré-reunião)';



COMMENT ON COLUMN "public"."meetings_followups"."channel" IS 'Canal de envio: email, sms, whatsapp, phone';



COMMENT ON COLUMN "public"."meetings_followups"."webhook_url" IS 'URL do webhook que receberá o disparo (ex: N8N)';



COMMENT ON COLUMN "public"."meetings_followups"."source" IS 'Discriminator: webhook = dispatch via webhook_url (N8N/external); channel = dispatch via direct channel (WA template, AS, email, SMS)';



CREATE TABLE IF NOT EXISTS "public"."message_buffer" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "people_id" "uuid" NOT NULL,
    "messages" "jsonb"[] DEFAULT '{}'::"jsonb"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "processed_at" timestamp with time zone,
    "wa_phone_number_id" "text",
    "channel_type" "text"
);


ALTER TABLE "public"."message_buffer" OWNER TO "postgres";


COMMENT ON TABLE "public"."message_buffer" IS 'Inbound message debounce buffer. Replaces Redis list. Processed by pg_cron every 5s.';



COMMENT ON COLUMN "public"."message_buffer"."messages" IS 'Array of {content, message_type, media_url, wa_message_id}';



COMMENT ON COLUMN "public"."message_buffer"."expires_at" IS 'When this buffer window closes (= created_at + buffer_ms)';



COMMENT ON COLUMN "public"."message_buffer"."processed" IS 'True once ai-agent-execute has consumed this buffer entry';



COMMENT ON COLUMN "public"."message_buffer"."wa_phone_number_id" IS 'Meta WA phone_number_id que recebeu a mensagem inbound — usado por ai-agent-execute para routing e como fallback de phoneNumberId no outbound';



COMMENT ON COLUMN "public"."message_buffer"."channel_type" IS 'Inbound channel that triggered this buffer entry — used by ai-agent-execute for P1/P2 agent matching (e.g. whatsapp, instagram)';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" bigint NOT NULL,
    "content" "text" NOT NULL,
    "from_contact" "text" DEFAULT 'cliente'::"text",
    "message_type" "text" DEFAULT 'texto'::"text",
    "status" "text" DEFAULT 'sent'::"text",
    "channel" "text" DEFAULT 'whatsapp'::"text",
    "media_url" "text",
    "whatsapp_template_id" "text",
    "followup_id" "uuid",
    "people_id" "uuid",
    "lead_id" "uuid",
    "user_id" "uuid",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "media_metadata" "jsonb",
    "instagram_interaction_type" "text",
    "post_id" "text",
    "parent_message_id" bigint,
    "metadata" "jsonb",
    "wa_message_id" "text",
    "execution_id" "uuid",
    "wa_phone_number_id" "text",
    "source_type" "text",
    "module_ref_id" "uuid",
    "ig_message_id" "text",
    "seen_at" timestamp with time zone,
    CONSTRAINT "messages_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'instagram'::"text", 'email'::"text", 'sms'::"text", 'telefone'::"text", 'tiktok'::"text", 'tiktok-manychat'::"text", 'instagram-manychat'::"text"]))),
    CONSTRAINT "messages_from_contact_check" CHECK (("from_contact" = ANY (ARRAY['cliente'::"text", 'humano'::"text", 'ia'::"text", 'agente_ia'::"text", 'sistema'::"text"]))),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['texto'::"text", 'audio'::"text", 'imagem'::"text", 'video'::"text", 'documento'::"text", 'chamada'::"text", 'comentario'::"text", 'story_reply'::"text", 'story_mention'::"text", 'reply_comentario'::"text", 'arquivo'::"text", 'private_reply'::"text", 'email'::"text"]))),
    CONSTRAINT "messages_source_type_check" CHECK (("source_type" = ANY (ARRAY['inbound'::"text", 'manual'::"text", 'ai_agent'::"text", 'campaign'::"text", 'form'::"text", 'followup'::"text", 'appointment_reminder'::"text", 'kiwify'::"text"]))),
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Messages table extended for Omni PRO with multimedia and Instagram support';



COMMENT ON COLUMN "public"."messages"."from_contact" IS 'cliente=inbound do cliente | humano=agente manual OMNI | sistema=outbound sistema/campanha | agente_ia=AI agent | ia=legado';



COMMENT ON COLUMN "public"."messages"."wa_message_id" IS 'WhatsApp message ID from Meta API — used for deduplication and read receipts';



COMMENT ON COLUMN "public"."messages"."execution_id" IS 'FK to ai_agents_execution_log — set on AI-generated outbound messages';



COMMENT ON COLUMN "public"."messages"."source_type" IS 'Módulo de origem da mensagem. NULL = legado. inbound=cliente enviou | manual=usuário OMNI | ai_agent=agente IA | campaign=SENDS PRO | form=LP Submit | followup=Followup Etapa | appointment_reminder=Lembrete Reunião';



COMMENT ON COLUMN "public"."messages"."module_ref_id" IS 'ID do registro de origem no módulo gerador (polimórfico, sem FK). campaign → sends.id | form → lp_forms.id | appointment_reminder → meetings.id';



COMMENT ON COLUMN "public"."messages"."ig_message_id" IS 'Instagram message ID (mid) for deduplication of inbound DMs';



COMMENT ON COLUMN "public"."messages"."seen_at" IS 'Quando um atendente HUMANO abriu a thread e viu esta mensagem inbound. NÃO confundir com read_at, que é o recibo de leitura do WhatsApp (cliente leu nossa mensagem outbound). Só é preenchida para from_contact = ''cliente''.';



CREATE SEQUENCE IF NOT EXISTS "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."messages_id_seq" OWNED BY "public"."messages"."id";



CREATE TABLE IF NOT EXISTS "public"."meta_lead_form_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "text" NOT NULL,
    "page_name" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "subscribed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meta_lead_form_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."meta_lead_form_pages_safe" AS
 SELECT "id",
    "page_id",
    "page_name",
    "subscribed",
    "created_at",
    "updated_at"
   FROM "public"."meta_lead_form_pages";


ALTER VIEW "public"."meta_lead_form_pages_safe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meta_lead_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "text" NOT NULL,
    "meta_form_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "field_mapping" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pipeline_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone,
    "raw_questions" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "meta_lead_forms_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'unmapped'::"text"])))
);


ALTER TABLE "public"."meta_lead_forms" OWNER TO "postgres";


COMMENT ON COLUMN "public"."meta_lead_forms"."raw_questions" IS 'Raw questions array from Meta Graph API — used for auto-mapping suggestions during sync';



CREATE TABLE IF NOT EXISTS "public"."mfa_recovery_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "recovery_set_id" "uuid" NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mfa_recovery_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."mfa_recovery_codes" IS 'AUTH-V2-03a: bcrypt-hashed MFA recovery codes. Plaintext returned once at generation, never stored. RPCs: mfa_recovery_generate() / mfa_recovery_consume().';



COMMENT ON COLUMN "public"."mfa_recovery_codes"."code_hash" IS 'bcrypt hash via crypt(plaintext, gen_salt(''bf'', 10)). Constant-time verify: crypt(input, code_hash) = code_hash.';



COMMENT ON COLUMN "public"."mfa_recovery_codes"."recovery_set_id" IS 'Groups codes from the same generation call. All codes in a set are invalidated together on regeneration.';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "public"."notification_event_type" NOT NULL,
    "people_id" "uuid",
    "lead_id" "uuid",
    "message_id" bigint,
    "title" "text" NOT NULL,
    "body" "text",
    "channel" "text",
    "unread_messages" integer DEFAULT 1 NOT NULL,
    "read_at" timestamp with time zone,
    "read_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target_user_id" "uuid"
);

ALTER TABLE ONLY "public"."notifications" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Feed do sino (DashLayout). Linha GLOBAL: read_at/read_by são únicos, não por usuário — inbox compartilhado, quem atende limpa pra todo mundo. Visibilidade (não leitura) é por usuário via RLS.';



COMMENT ON COLUMN "public"."notifications"."message_id" IS 'bigint — messages.id é serial, não uuid.';



COMMENT ON COLUMN "public"."notifications"."title" IS 'Nome do contato no momento do evento. Denormalizado de propósito: embed via RLS pode voltar null (bug conhecido, 20260717130000).';



COMMENT ON COLUMN "public"."notifications"."unread_messages" IS 'Quantas mensagens inbound essa notificação representa após o colapso da rajada.';



COMMENT ON COLUMN "public"."notifications"."target_user_id" IS 'Alerta PESSOAL pra um settings_users específico (ex: closer avisado de reunião marcada), distinto da visibilidade por conversa via people_id. Uma linha pode ter os dois: people_id dá acesso a quem vê a conversa do lead, target_user_id garante que o destinatário específico sempre vê, mesmo sem acesso à conversa.';



CREATE TABLE IF NOT EXISTS "public"."omni_channel_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" "text" NOT NULL,
    "alert_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "omni_channel_alerts_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'instagram'::"text", 'email'::"text", 'sms'::"text", 'telefone'::"text", 'system'::"text", 'tiktok-manychat'::"text", 'instagram-manychat'::"text"]))),
    CONSTRAINT "omni_channel_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."omni_channel_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."omni_channel_alerts" IS 'OMNI PRO™ alertas de canais — token refresh, health checks, rate limits. Usado por OP-03 (token refresh), OP-05 (health monitor), OP-09 (rate limiting).';



CREATE TABLE IF NOT EXISTS "public"."omni_channel_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" "text" NOT NULL,
    "is_active" boolean DEFAULT false,
    "display_name" "text" NOT NULL,
    "credentials" "jsonb" DEFAULT '{}'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "webhook_fallback" "jsonb" DEFAULT '{}'::"jsonb",
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "omni_channel_configs_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'instagram'::"text", 'email'::"text", 'sms'::"text", 'telefone'::"text", 'identity_collection'::"text", 'tldv'::"text", 'tiktok'::"text", 'tiktok-manychat'::"text", 'instagram-manychat'::"text", 'kiwify'::"text"])))
);


ALTER TABLE "public"."omni_channel_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."omni_channel_configs" IS 'OMNI PRO™ configuração centralizada por canal de comunicação. Uma linha por canal.';



CREATE TABLE IF NOT EXISTS "public"."omni_delivery_dead_letter" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" integer NOT NULL,
    "channel" "text" NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 5,
    "next_retry_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "omni_delivery_dead_letter_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'retrying'::"text", 'exhausted'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."omni_delivery_dead_letter" OWNER TO "postgres";


COMMENT ON TABLE "public"."omni_delivery_dead_letter" IS 'OMNI PRO™ dead-letter queue para mensagens que falharam no delivery engine. Retry exponencial: 1min, 5min, 30min, 2h, 12h (max 5 tentativas).';



CREATE TABLE IF NOT EXISTS "public"."omni_outbound_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "url" "text" NOT NULL,
    "method" "text" DEFAULT 'POST'::"text",
    "headers" "jsonb" DEFAULT '{}'::"jsonb",
    "payload_template" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "omni_outbound_webhooks_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'sms'::"text"]))),
    CONSTRAINT "omni_outbound_webhooks_method_check" CHECK (("method" = ANY (ARRAY['POST'::"text", 'PUT'::"text"])))
);


ALTER TABLE "public"."omni_outbound_webhooks" OWNER TO "postgres";


COMMENT ON TABLE "public"."omni_outbound_webhooks" IS 'OMNI PRO outbound webhooks for email/SMS delivery (non-WhatsApp channels)';



CREATE TABLE IF NOT EXISTS "public"."schedule_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trigger_status" "text" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "target_pipeline_id" "uuid" NOT NULL,
    "target_stage_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_automations_trigger_status_check" CHECK (("trigger_status" = ANY (ARRAY['criado'::"text", 'confirmado'::"text", 'cancelado'::"text", 'reagendado'::"text", 'realizado'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."schedule_automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."score_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_category_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."score_category_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_matrix" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "score_number" integer NOT NULL,
    "profile_score" "text",
    "pre_description_score" "text",
    "detail_score" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_selections" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."score_matrix" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."score_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."score_settings" IS 'Configurações globais do sistema de score. Chaves: objectives_label, investments_label, framings_label.';



CREATE TABLE IF NOT EXISTS "public"."secret_access_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "secret_name" "text" NOT NULL,
    "caller_context" "text",
    "accessed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet"
);


ALTER TABLE "public"."secret_access_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."secret_access_log" IS 'ADR-SP-05: Append-only audit trail for Vault secret access. Each row records which secret was read and by which function/edge context. Retention 90 days — GC cron purges entries where accessed_at < now() - interval ''90 days''.';



CREATE TABLE IF NOT EXISTS "public"."sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "template_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "pipeline_id" "uuid",
    "stage_ids" "uuid"[],
    "team_id" "uuid",
    "created_by" "uuid",
    "total_contacts" integer DEFAULT 0,
    "sent_count" integer DEFAULT 0,
    "delivered_count" integer DEFAULT 0,
    "read_count" integer DEFAULT 0,
    "error_count" integer DEFAULT 0,
    "scheduled_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "filter_config" "jsonb",
    "type" "text" DEFAULT 'filtered'::"text" NOT NULL,
    "send_interval_seconds" integer DEFAULT 30 NOT NULL,
    "webhook_id" "uuid",
    "failed_count" integer DEFAULT 0 NOT NULL,
    "message_content" "text",
    "wa_channel_id" "uuid",
    "last_batch_at" timestamp with time zone,
    CONSTRAINT "sends_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'sms'::"text", 'phone'::"text"]))),
    CONSTRAINT "sends_interval_check" CHECK (("send_interval_seconds" = ANY (ARRAY[5, 10, 30, 60, 300, 600, 1800, 3600]))),
    CONSTRAINT "sends_stage_ids_valid" CHECK ("public"."validate_stage_ids"("stage_ids")),
    CONSTRAINT "sends_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'running'::"text", 'paused'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "sends_type_check" CHECK (("type" = ANY (ARRAY['imported'::"text", 'filtered'::"text"])))
);


ALTER TABLE "public"."sends" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sends"."template_id" IS 'FK → whatsapp_templates. NULL when template deleted or for non-WhatsApp channels.';



COMMENT ON COLUMN "public"."sends"."stage_ids" IS 'Array of stage UUIDs. All must exist in leads_stages (enforced via CHECK constraint).';



COMMENT ON COLUMN "public"."sends"."message_content" IS 'Message body for non-WhatsApp channels (Email, SMS, Phone). For WhatsApp, use whatsapp_template_id instead.';



COMMENT ON COLUMN "public"."sends"."wa_channel_id" IS 'FK to settings_whatsapp_channels — WhatsApp number used for direct Meta API dispatch';



COMMENT ON COLUMN "public"."sends"."last_batch_at" IS 'Timestamp of last batch dispatch. Used by sends-dispatch-batch (pg_cron) to enforce send_interval_seconds cadence server-side.';



CREATE TABLE IF NOT EXISTS "public"."sends_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "send_id" "uuid",
    "people_id" "uuid",
    "whatsapp" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "retry_count" integer DEFAULT 0 NOT NULL,
    "claimed_at" timestamp with time zone,
    CONSTRAINT "sends_contacts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."sends_contacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sends_contacts"."retry_count" IS 'Number of webhook dispatch retry attempts (0 = first try, max 3)';



CREATE TABLE IF NOT EXISTS "public"."sends_import_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "send_id" "uuid",
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "processed" integer DEFAULT 0 NOT NULL,
    "new_people" integer DEFAULT 0 NOT NULL,
    "existing_people" integer DEFAULT 0 NOT NULL,
    "failed_rows" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sends_import_sessions_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sends_import_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#6366f1'::"text",
    "secondary_color" "text" DEFAULT '#8b5cf6'::"text",
    "accent_color" "text" DEFAULT '#ec4899'::"text",
    "email" "text",
    "phone" "text",
    "website" "text",
    "address" "text",
    "tax_id" "text",
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text",
    "language" "text" DEFAULT 'pt-br'::"text",
    "currency" "text" DEFAULT 'BRL'::"text",
    "whatsapp_provider" "text" DEFAULT 'whatsapp-oficial'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "apify_token" "text",
    "google_client_id" "text",
    "google_client_secret" "text",
    "explorium_api_key" "text",
    "apollo_api_key" "text",
    "pdl_api_key" "text",
    "login_max_attempts" integer DEFAULT 5,
    "require_mfa_for_gestores" boolean DEFAULT false,
    "custom_domain" "text",
    "brand_primary_color" character varying(7),
    "brand_secondary_color" character varying(7),
    "product_name" "text",
    "mfa_policy" "text" DEFAULT 'opt_in'::"text",
    "bi_voice_chat_beta_enabled" boolean DEFAULT false NOT NULL,
    "calcom_client_id" "text",
    CONSTRAINT "settings_mfa_policy_check" CHECK (("mfa_policy" = ANY (ARRAY['opt_in'::"text", 'required_gestores'::"text", 'required_all'::"text"])))
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."settings"."require_mfa_for_gestores" IS 'Deprecated 2026-04-24 — use mfa_policy instead. Kept for backwards compatibility until UI is updated.';



COMMENT ON COLUMN "public"."settings"."mfa_policy" IS 'MFA enforcement level: opt_in | required_gestores | required_all. Supersedes require_mfa_for_gestores.';



CREATE TABLE IF NOT EXISTS "public"."settings_ai_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "label" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "settings_ai_providers_provider_check" CHECK (("provider" = ANY (ARRAY['openai'::"text", 'anthropic'::"text", 'groq'::"text", 'gemini'::"text"])))
);


ALTER TABLE "public"."settings_ai_providers" OWNER TO "postgres";


COMMENT ON TABLE "public"."settings_ai_providers" IS 'Global LLM API keys. api_key never exposed to frontend — service_role only.';



COMMENT ON COLUMN "public"."settings_ai_providers"."provider" IS 'Provider: openai | anthropic | groq | gemini';



COMMENT ON COLUMN "public"."settings_ai_providers"."label" IS 'Human-readable label (e.g. "OpenAI Produção")';



COMMENT ON COLUMN "public"."settings_ai_providers"."api_key" IS 'Raw API key — service_role read only, never SELECT via RLS';



COMMENT ON COLUMN "public"."settings_ai_providers"."is_default" IS 'Fallback provider when ai_agents.llm_provider_id is null';



CREATE TABLE IF NOT EXISTS "public"."settings_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "section" "text" NOT NULL,
    "field" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "is_sensitive" boolean DEFAULT false NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."settings_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "start_hour" smallint DEFAULT 8 NOT NULL,
    "end_hour" smallint DEFAULT 18 NOT NULL,
    "days_of_week" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bh_only_last" boolean DEFAULT true NOT NULL,
    CONSTRAINT "settings_business_hours_end_hour_check" CHECK ((("end_hour" >= 1) AND ("end_hour" <= 24))),
    CONSTRAINT "settings_business_hours_start_hour_check" CHECK ((("start_hour" >= 0) AND ("start_hour" <= 23)))
);


ALTER TABLE "public"."settings_business_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_elevenlabs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key" "text",
    "api_key_encrypted" "text",
    "workspace_id" "text",
    "default_model_id" "text" DEFAULT 'eleven_flash_v2_5'::"text",
    "default_voice_id" "text",
    "default_output_format" "text" DEFAULT 'mp3_44100_128'::"text",
    "webhook_secret" "text",
    "monthly_char_limit" integer DEFAULT 100000,
    "monthly_char_used" integer DEFAULT 0,
    "monthly_reset_at" timestamp with time zone,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."settings_elevenlabs" OWNER TO "postgres";


COMMENT ON TABLE "public"."settings_elevenlabs" IS 'ElevenLabs: Singleton — API key, TTS model, voice defaults, webhook, usage tracking';



CREATE TABLE IF NOT EXISTS "public"."settings_omni_new_contact" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" "text" NOT NULL,
    "auto_create_negocio" boolean DEFAULT false NOT NULL,
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "title_template" "text" DEFAULT 'Nova conversa - {{nome}}'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "on_first_reply_enabled" boolean DEFAULT false NOT NULL,
    "on_first_reply_stage_id" "uuid",
    CONSTRAINT "settings_omni_new_contact_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'instagram_dm'::"text", 'instagram_comment'::"text"])))
);


ALTER TABLE "public"."settings_omni_new_contact" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "settings_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."settings_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_system_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_key" "text" NOT NULL,
    "module_name" "text" NOT NULL,
    "icon" "text",
    "order_index" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settings_system_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "team_type" "text" DEFAULT 'vendas'::"text",
    "priority" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "settings_teams_team_type_check" CHECK (("team_type" = ANY (ARRAY['vendas'::"text", 'atendimento'::"text", 'suporte'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."settings_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_teams_pipelines" (
    "team_id" "uuid" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."settings_teams_pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_teams_tags" (
    "team_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."settings_teams_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "avatar_url" "text",
    "user_type" "text" DEFAULT 'user'::"text",
    "super_admin" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_id" "uuid",
    "mfa_grace_until" timestamp with time zone,
    "agente" "text",
    CONSTRAINT "settings_users_user_type_check" CHECK (("user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'user'::"text", 'comercial'::"text"])))
);


ALTER TABLE "public"."settings_users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."settings_users"."mfa_grace_until" IS 'AUTH-V2-03a AC6: MFA enrollment deadline. Set to now()+7d on INSERT when tenant mfa_policy requires this role. NULL = no active grace period.';



CREATE TABLE IF NOT EXISTS "public"."settings_users_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "team_id" "uuid",
    "is_leader" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_priority" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."settings_users_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_whatsapp_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "phone_number_id" "text",
    "access_token" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_secret" "text",
    "waba_id" "text",
    "provider" "text" DEFAULT 'meta'::"text" NOT NULL,
    "evolution_base_url" "text",
    "evolution_api_key" "text",
    "evolution_webhook_token" "text",
    "evolution_instance_name" "text",
    "evolution_status" "text",
    "evolution_last_seen_at" timestamp with time zone,
    CONSTRAINT "settings_whatsapp_channels_evolution_status_check" CHECK ((("evolution_status" IS NULL) OR ("evolution_status" = ANY (ARRAY['STOPPED'::"text", 'STARTING'::"text", 'SCAN_QR_CODE'::"text", 'WORKING'::"text", 'FAILED'::"text", 'BANNED'::"text"])))),
    CONSTRAINT "settings_whatsapp_channels_provider_check" CHECK (("provider" = ANY (ARRAY['meta'::"text", 'evolution'::"text"]))),
    CONSTRAINT "settings_whatsapp_channels_provider_fields_check" CHECK (((("provider" = 'meta'::"text") AND ("phone_number_id" IS NOT NULL) AND ("access_token" IS NOT NULL)) OR (("provider" = 'evolution'::"text") AND ("evolution_base_url" IS NOT NULL) AND ("evolution_api_key" IS NOT NULL) AND ("evolution_webhook_token" IS NOT NULL) AND ("evolution_instance_name" IS NOT NULL))))
);


ALTER TABLE "public"."settings_whatsapp_channels" OWNER TO "postgres";


COMMENT ON COLUMN "public"."settings_whatsapp_channels"."phone_number_id" IS 'Meta WhatsApp Business phone_number_id';



COMMENT ON COLUMN "public"."settings_whatsapp_channels"."access_token" IS 'Meta Graph API access token for this number';



COMMENT ON COLUMN "public"."settings_whatsapp_channels"."app_secret" IS 'Meta App Secret para validação de assinatura HMAC-SHA256 dos webhooks (x-hub-signature-256). Se nulo, usa WHATSAPP_APP_SECRET env var como fallback.';



COMMENT ON COLUMN "public"."settings_whatsapp_channels"."waba_id" IS 'WhatsApp Business Account ID — required for template management via Meta Graph API';



COMMENT ON COLUMN "public"."settings_whatsapp_channels"."provider" IS 'meta = Cloud API oficial (existente). evolution = Evolution API self-hosted (Baileys), tenant-wide, sem template/janela 24h. Múltiplos canais evolution podem coexistir (cada um = um número/servidor distinto).';



COMMENT ON COLUMN "public"."settings_whatsapp_channels"."evolution_api_key" IS 'Cleartext — mesmo débito já aceito pra access_token do Meta nesta tabela. Rotacionar via UI se exposto.';



CREATE TABLE IF NOT EXISTS "public"."tenant_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" character varying(12) NOT NULL,
    "created_by" "uuid",
    "last_used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "feature_key" "public"."feature_key" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."tenant_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_calcom_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "calcom_username" "text",
    "calcom_access_token" "text" NOT NULL,
    "calcom_refresh_token" "text" NOT NULL,
    "calcom_token_expires_at" timestamp with time zone,
    "default_event_type_id" integer,
    "default_event_type_slug" "text",
    "default_booking_url" "text",
    "webhook_id" "text",
    "webhook_secret" "text",
    "use_calcom_booking_link" boolean DEFAULT false NOT NULL,
    "sync_booking" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_calcom_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_calendar_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "google_email" "text",
    "google_access_token" "text",
    "google_refresh_token" "text",
    "google_token_expires_at" timestamp with time zone,
    "google_calendar_id" "text" DEFAULT 'primary'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text" DEFAULT 'google'::"text" NOT NULL,
    "ms_access_token" "text",
    "ms_refresh_token" "text",
    "ms_token_expires_at" timestamp with time zone,
    "ms_user_id" "text",
    "ms_email" "text",
    "zoom_access_token" "text",
    "zoom_refresh_token" "text",
    "zoom_token_expires_at" timestamp with time zone,
    "zoom_user_id" "text",
    "zoom_account_id" "text",
    "zoom_email" "text",
    "sync_booking" boolean DEFAULT true NOT NULL,
    CONSTRAINT "user_calendar_connections_provider_check" CHECK (("provider" = ANY (ARRAY['google'::"text", 'microsoft'::"text", 'zoom'::"text"])))
);


ALTER TABLE "public"."user_calendar_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "public"."notification_event_type" NOT NULL,
    "channel" "public"."notification_channel" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "snoozed_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_id" "uuid",
    "request_body" "jsonb",
    "response_body" "jsonb",
    "status_code" integer,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source" "text",
    "channel" "text",
    "event" "text",
    "subscriber_id" "text",
    "people_id" "uuid",
    "message_id" "uuid",
    "payload" "jsonb",
    "error_detail" "text"
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "headers" "jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pipeline_id" "uuid",
    "stage_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    CONSTRAINT "webhooks_event_type_check" CHECK (("event_type" = ANY (ARRAY['conversa'::"text", 'disparo'::"text", 'lead_etapa'::"text", 'followup'::"text"])))
);


ALTER TABLE "public"."webhooks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."webhooks"."event_type" IS 'Tipo de evento: conversa|disparo|lead_etapa|followup';



COMMENT ON COLUMN "public"."webhooks"."pipeline_id" IS 'Para lead_etapa: filtra por pipeline (NULL = todos os pipelines)';



COMMENT ON COLUMN "public"."webhooks"."stage_ids" IS 'Para lead_etapa: array de stage IDs (vazio = todas as etapas)';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_template" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "system_enabled" boolean DEFAULT true,
    "json_data" "jsonb",
    "variables" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "meta_template_name" "text",
    "last_synced_at" timestamp with time zone,
    "purpose" "text",
    "provider" "text" DEFAULT 'meta'::"text" NOT NULL,
    CONSTRAINT "whatsapp_templates_provider_check" CHECK (("provider" = ANY (ARRAY['meta'::"text", 'evolution'::"text"]))),
    CONSTRAINT "whatsapp_templates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'approved'::"text", 'rejected'::"text", 'pending'::"text", 'submitted'::"text", 'paused'::"text", 'disabled'::"text", 'deleted'::"text", 'in_appeal'::"text", 'flagged'::"text"])))
);


ALTER TABLE "public"."whatsapp_templates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."whatsapp_templates"."purpose" IS 'Tag interna opcional do CRM (nao e campo da Meta). Ex: retomada = template usado pelo comercial pra reabrir conversa fora da janela de 24h.';



ALTER TABLE ONLY "public"."_meta_debug" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_meta_debug_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_app_config"
    ADD CONSTRAINT "_app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."_meta_debug"
    ADD CONSTRAINT "_meta_debug_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_token_consumed"
    ADD CONSTRAINT "action_token_consumed_pkey" PRIMARY KEY ("jti");



ALTER TABLE ONLY "public"."adm_audit_log"
    ADD CONSTRAINT "adm_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adm_clients"
    ADD CONSTRAINT "adm_clients_custom_domain_key" UNIQUE ("custom_domain");



ALTER TABLE ONLY "public"."adm_clients"
    ADD CONSTRAINT "adm_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adm_clients"
    ADD CONSTRAINT "adm_clients_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."adm_migration_runs"
    ADD CONSTRAINT "adm_migration_runs_client_id_migration_id_key" UNIQUE ("client_id", "migration_id");



ALTER TABLE ONLY "public"."adm_migration_runs"
    ADD CONSTRAINT "adm_migration_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adm_migrations"
    ADD CONSTRAINT "adm_migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."adm_migrations"
    ADD CONSTRAINT "adm_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adm_sync_jobs"
    ADD CONSTRAINT "adm_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adm_sync_logs"
    ADD CONSTRAINT "adm_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agent_callback_configs"
    ADD CONSTRAINT "ai_agent_callback_configs_agent_step_key" UNIQUE ("agent_id", "step_id");



ALTER TABLE ONLY "public"."ai_agent_callback_configs"
    ADD CONSTRAINT "ai_agent_callback_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents_execution_log"
    ADD CONSTRAINT "ai_agents_execution_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents_history"
    ADD CONSTRAINT "ai_agents_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents_score_matrix"
    ADD CONSTRAINT "ai_agents_score_matrix_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents_steps_history"
    ADD CONSTRAINT "ai_agents_steps_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents_steps"
    ADD CONSTRAINT "ai_agents_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_scheduled_callbacks"
    ADD CONSTRAINT "ai_scheduled_callbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_events_log"
    ADD CONSTRAINT "auth_events_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_login_attempts"
    ADD CONSTRAINT "auth_login_attempts_ip_hash_email_hash_key" UNIQUE ("ip_hash", "email_hash");



ALTER TABLE ONLY "public"."auth_login_attempts"
    ADD CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_ad_accounts"
    ADD CONSTRAINT "bi_ad_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_ad_campaigns"
    ADD CONSTRAINT "bi_ad_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_ad_campaigns"
    ADD CONSTRAINT "bi_ad_campaigns_platform_campaign_id_key" UNIQUE ("platform", "campaign_id");



ALTER TABLE ONLY "public"."bi_ad_daily_stats"
    ADD CONSTRAINT "bi_ad_daily_stats_campaign_id_stat_date_key" UNIQUE ("campaign_id", "stat_date");



ALTER TABLE ONLY "public"."bi_ad_daily_stats"
    ADD CONSTRAINT "bi_ad_daily_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_ad_spend"
    ADD CONSTRAINT "bi_ad_spend_campaign_id_date_key" UNIQUE ("campaign_id", "date");



ALTER TABLE ONLY "public"."bi_ad_spend"
    ADD CONSTRAINT "bi_ad_spend_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_sdr_targets"
    ADD CONSTRAINT "bi_sdr_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_sdr_targets"
    ADD CONSTRAINT "bi_sdr_targets_user_id_year_month_key" UNIQUE ("user_id", "year", "month");



ALTER TABLE ONLY "public"."bi_settings"
    ADD CONSTRAINT "bi_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_settings"
    ADD CONSTRAINT "bi_settings_singleton_key" UNIQUE ("singleton");



ALTER TABLE ONLY "public"."bi_tiktok_ad_spend"
    ADD CONSTRAINT "bi_tiktok_ad_spend_date_advertiser_id_campaign_id_adgroup_i_key" UNIQUE ("date", "advertiser_id", "campaign_id", "adgroup_id");



ALTER TABLE ONLY "public"."bi_tiktok_ad_spend"
    ADD CONSTRAINT "bi_tiktok_ad_spend_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_voice_session_log"
    ADD CONSTRAINT "bi_voice_session_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_voice_token_log"
    ADD CONSTRAINT "bi_voice_token_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_voice_tool_invocations"
    ADD CONSTRAINT "bi_voice_tool_invocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_rule_sets"
    ADD CONSTRAINT "booking_rule_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_rules"
    ADD CONSTRAINT "booking_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_token_jti_usage"
    ADD CONSTRAINT "booking_token_jti_usage_pkey" PRIMARY KEY ("jti");



ALTER TABLE ONLY "public"."canned_responses"
    ADD CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients_companies"
    ADD CONSTRAINT "clients_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients_companies"
    ADD CONSTRAINT "clients_companies_tax_id_key" UNIQUE ("tax_id");



ALTER TABLE ONLY "public"."clients_people_companies"
    ADD CONSTRAINT "clients_people_companies_people_id_company_id_key" UNIQUE ("people_id", "company_id");



ALTER TABLE ONLY "public"."clients_people_companies"
    ADD CONSTRAINT "clients_people_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients_people"
    ADD CONSTRAINT "clients_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients_people_updates"
    ADD CONSTRAINT "clients_people_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversion_event_rules"
    ADD CONSTRAINT "conversion_event_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversion_events_queue"
    ADD CONSTRAINT "conversion_events_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversion_platform_credentials"
    ADD CONSTRAINT "conversion_platform_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversion_stage_mappings"
    ADD CONSTRAINT "conversion_stage_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_tenants"
    ADD CONSTRAINT "crm_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_tenants"
    ADD CONSTRAINT "crm_tenants_value_key" UNIQUE ("value");



ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_export_jobs"
    ADD CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."elevenlabs_agents"
    ADD CONSTRAINT "elevenlabs_agents_agent_id_unique" UNIQUE ("elevenlabs_agent_id");



ALTER TABLE ONLY "public"."elevenlabs_agents"
    ADD CONSTRAINT "elevenlabs_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."elevenlabs_voices"
    ADD CONSTRAINT "elevenlabs_voices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."elevenlabs_voices"
    ADD CONSTRAINT "elevenlabs_voices_voice_id_unique" UNIQUE ("voice_id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_queue"
    ADD CONSTRAINT "followup_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_pro_rate_limits"
    ADD CONSTRAINT "form_pro_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_webhooks"
    ADD CONSTRAINT "inbound_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_webhooks"
    ADD CONSTRAINT "inbound_webhooks_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."instagram_automation_log"
    ADD CONSTRAINT "instagram_automation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instagram_automations"
    ADD CONSTRAINT "instagram_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiwify_connections"
    ADD CONSTRAINT "kiwify_connections_account_id_key" UNIQUE ("account_id");



ALTER TABLE ONLY "public"."kiwify_connections"
    ADD CONSTRAINT "kiwify_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiwify_event_mappings"
    ADD CONSTRAINT "kiwify_event_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiwify_event_mappings"
    ADD CONSTRAINT "kiwify_event_mappings_trigger_product_uq" UNIQUE ("trigger", "product_id");



ALTER TABLE ONLY "public"."kiwify_lead_products"
    ADD CONSTRAINT "kiwify_lead_products_people_product_uq" UNIQUE ("people_id", "product_id");



ALTER TABLE ONLY "public"."kiwify_lead_products"
    ADD CONSTRAINT "kiwify_lead_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiwify_message_automations"
    ADD CONSTRAINT "kiwify_message_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiwify_message_jobs"
    ADD CONSTRAINT "kiwify_message_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiwify_webhook_events"
    ADD CONSTRAINT "kiwify_webhook_events_idem" UNIQUE ("connection_id", "event_type", "dedup_key");



ALTER TABLE ONLY "public"."kiwify_webhook_events"
    ADD CONSTRAINT "kiwify_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_field_definitions"
    ADD CONSTRAINT "lead_field_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_field_values"
    ADD CONSTRAINT "lead_field_values_entity_def_uniq" UNIQUE ("entity_type", "entity_id", "field_definition_id");



ALTER TABLE ONLY "public"."lead_field_values"
    ADD CONSTRAINT "lead_field_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_tags"
    ADD CONSTRAINT "lead_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."lead_tags"
    ADD CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_types"
    ADD CONSTRAINT "lead_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_files"
    ADD CONSTRAINT "leads_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_loss_reasons"
    ADD CONSTRAINT "leads_loss_reasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_notes"
    ADD CONSTRAINT "leads_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_pipelines"
    ADD CONSTRAINT "leads_pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_stage_duplication_rules"
    ADD CONSTRAINT "leads_stage_duplication_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_stage_duplication_rules"
    ADD CONSTRAINT "leads_stage_duplication_rules_source_stage_id_target_pipeli_key" UNIQUE ("source_stage_id", "target_pipeline_id");



ALTER TABLE ONLY "public"."leads_stages_followups"
    ADD CONSTRAINT "leads_stages_followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_stages"
    ADD CONSTRAINT "leads_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_tags"
    ADD CONSTRAINT "leads_tags_pkey" PRIMARY KEY ("lead_id", "tag_id");



ALTER TABLE ONLY "public"."leads_updates"
    ADD CONSTRAINT "leads_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lgpd_anonymization_log"
    ADD CONSTRAINT "lgpd_anonymization_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_pro_forms"
    ADD CONSTRAINT "lp_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_pro_submissions"
    ADD CONSTRAINT "lp_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_followup_queue"
    ADD CONSTRAINT "meeting_followup_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_records"
    ADD CONSTRAINT "meeting_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings_followups"
    ADD CONSTRAINT "meetings_followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_buffer"
    ADD CONSTRAINT "message_buffer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_lead_form_pages"
    ADD CONSTRAINT "meta_lead_form_pages_page_id_key" UNIQUE ("page_id");



ALTER TABLE ONLY "public"."meta_lead_form_pages"
    ADD CONSTRAINT "meta_lead_form_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_lead_forms"
    ADD CONSTRAINT "meta_lead_forms_meta_form_id_key" UNIQUE ("meta_form_id");



ALTER TABLE ONLY "public"."meta_lead_forms"
    ADD CONSTRAINT "meta_lead_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."omni_channel_alerts"
    ADD CONSTRAINT "omni_channel_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."omni_channel_configs"
    ADD CONSTRAINT "omni_channel_configs_channel_key" UNIQUE ("channel");



ALTER TABLE ONLY "public"."omni_channel_configs"
    ADD CONSTRAINT "omni_channel_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."omni_delivery_dead_letter"
    ADD CONSTRAINT "omni_delivery_dead_letter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."omni_outbound_webhooks"
    ADD CONSTRAINT "omni_outbound_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_automations"
    ADD CONSTRAINT "schedule_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_categories"
    ADD CONSTRAINT "score_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_categories"
    ADD CONSTRAINT "score_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."score_category_items"
    ADD CONSTRAINT "score_category_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_matrix"
    ADD CONSTRAINT "score_matrix_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_settings"
    ADD CONSTRAINT "score_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."secret_access_log"
    ADD CONSTRAINT "secret_access_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sends_contacts"
    ADD CONSTRAINT "sends_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sends_import_sessions"
    ADD CONSTRAINT "sends_import_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sends"
    ADD CONSTRAINT "sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_ai_providers"
    ADD CONSTRAINT "settings_ai_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_audit_log"
    ADD CONSTRAINT "settings_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_business_hours"
    ADD CONSTRAINT "settings_business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_elevenlabs"
    ADD CONSTRAINT "settings_elevenlabs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_omni_new_contact"
    ADD CONSTRAINT "settings_omni_new_contact_channel_key" UNIQUE ("channel");



ALTER TABLE ONLY "public"."settings_omni_new_contact"
    ADD CONSTRAINT "settings_omni_new_contact_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_schedules"
    ADD CONSTRAINT "settings_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_system_modules"
    ADD CONSTRAINT "settings_system_modules_module_key_key" UNIQUE ("module_key");



ALTER TABLE ONLY "public"."settings_system_modules"
    ADD CONSTRAINT "settings_system_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_teams_pipelines"
    ADD CONSTRAINT "settings_teams_pipelines_pkey" PRIMARY KEY ("team_id", "pipeline_id");



ALTER TABLE ONLY "public"."settings_teams"
    ADD CONSTRAINT "settings_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_teams_tags"
    ADD CONSTRAINT "settings_teams_tags_pkey" PRIMARY KEY ("team_id", "tag_id");



ALTER TABLE ONLY "public"."settings_users"
    ADD CONSTRAINT "settings_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."settings_users"
    ADD CONSTRAINT "settings_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."settings_users"
    ADD CONSTRAINT "settings_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_users_teams"
    ADD CONSTRAINT "settings_users_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_users_teams"
    ADD CONSTRAINT "settings_users_teams_user_id_team_id_key" UNIQUE ("user_id", "team_id");



ALTER TABLE ONLY "public"."settings_whatsapp_channels"
    ADD CONSTRAINT "settings_whatsapp_channels_phone_number_id_key" UNIQUE ("phone_number_id");



ALTER TABLE ONLY "public"."settings_whatsapp_channels"
    ADD CONSTRAINT "settings_whatsapp_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_api_keys"
    ADD CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_role_permissions"
    ADD CONSTRAINT "tenant_role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_role_permissions"
    ADD CONSTRAINT "tenant_role_permissions_role_id_feature_key_key" UNIQUE ("role_id", "feature_key");



ALTER TABLE ONLY "public"."tenant_roles"
    ADD CONSTRAINT "tenant_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_roles"
    ADD CONSTRAINT "tenant_roles_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."omni_delivery_dead_letter"
    ADD CONSTRAINT "uq_dead_letter_message_id" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."conversion_platform_credentials"
    ADD CONSTRAINT "uq_user_platform" UNIQUE ("user_id", "platform");



ALTER TABLE ONLY "public"."conversion_stage_mappings"
    ADD CONSTRAINT "uq_user_stage" UNIQUE ("user_id", "stage_id");



ALTER TABLE ONLY "public"."user_calcom_connections"
    ADD CONSTRAINT "user_calcom_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_calcom_connections"
    ADD CONSTRAINT "user_calcom_connections_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_calendar_connections"
    ADD CONSTRAINT "user_calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_event_type_channel_key" UNIQUE ("user_id", "event_type", "channel");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhooks"
    ADD CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_slug_key" UNIQUE ("slug");



CREATE INDEX "adm_migration_runs_client_idx" ON "public"."adm_migration_runs" USING "btree" ("client_id");



CREATE UNIQUE INDEX "ai_agent_callback_configs_default_per_agent" ON "public"."ai_agent_callback_configs" USING "btree" ("agent_id") WHERE ("step_id" IS NULL);



CREATE INDEX "ai_agents_channel_types_gin" ON "public"."ai_agents" USING "gin" ("channel_types");



CREATE INDEX "ai_agents_origem_lista_gin" ON "public"."ai_agents" USING "gin" ("origem_lista_filters");



CREATE INDEX "ai_agents_stage_ids_gin" ON "public"."ai_agents" USING "gin" ("stage_ids");



CREATE UNIQUE INDEX "ai_scheduled_callbacks_one_pending_per_lead" ON "public"."ai_scheduled_callbacks" USING "btree" ("lead_id") WHERE ("status" = 'pending'::"text");



COMMENT ON INDEX "public"."ai_scheduled_callbacks_one_pending_per_lead" IS 'Invariante D1: no máximo 1 retorno pendente por lead. Reagendar é UPDATE do pendente, nunca segundo INSERT.';



CREATE INDEX "auth_login_attempts_blocked_until_idx" ON "public"."auth_login_attempts" USING "btree" ("blocked_until") WHERE ("blocked_until" IS NOT NULL);



CREATE INDEX "auth_login_attempts_lookup_idx" ON "public"."auth_login_attempts" USING "btree" ("ip_hash", "email_hash");



CREATE INDEX "bi_sdr_targets_year_month_idx" ON "public"."bi_sdr_targets" USING "btree" ("year", "month");



CREATE INDEX "bi_voice_session_log_tenant_started_idx" ON "public"."bi_voice_session_log" USING "btree" ("tenant_id", "started_at" DESC);



CREATE INDEX "bi_voice_token_log_cleanup_idx" ON "public"."bi_voice_token_log" USING "btree" ("issued_at");



CREATE INDEX "bi_voice_token_log_tenant_issued_idx" ON "public"."bi_voice_token_log" USING "btree" ("tenant_id", "issued_at" DESC);



CREATE INDEX "bi_voice_tool_invocations_tenant_called_idx" ON "public"."bi_voice_tool_invocations" USING "btree" ("tenant_id", "called_at" DESC);



CREATE INDEX "bi_voice_tool_invocations_tool_called_idx" ON "public"."bi_voice_tool_invocations" USING "btree" ("tool_name", "called_at" DESC);



CREATE UNIQUE INDEX "clients_people_instagram_id_key" ON "public"."clients_people" USING "btree" ("instagram_id") WHERE ("instagram_id" IS NOT NULL);



CREATE INDEX "idx_action_token_consumed_at" ON "public"."action_token_consumed" USING "btree" ("consumed_at");



CREATE INDEX "idx_adm_audit_log_action" ON "public"."adm_audit_log" USING "btree" ("action");



CREATE INDEX "idx_adm_audit_log_created_at" ON "public"."adm_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_adm_audit_log_entity" ON "public"."adm_audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_adm_sync_jobs_client_id" ON "public"."adm_sync_jobs" USING "btree" ("client_id");



CREATE INDEX "idx_adm_sync_jobs_status" ON "public"."adm_sync_jobs" USING "btree" ("status");



CREATE INDEX "idx_adm_sync_logs_job_id" ON "public"."adm_sync_logs" USING "btree" ("job_id");



CREATE INDEX "idx_ai_agent_callback_configs_agent" ON "public"."ai_agent_callback_configs" USING "btree" ("agent_id");



CREATE INDEX "idx_ai_agents_active" ON "public"."ai_agents" USING "btree" ("active");



CREATE INDEX "idx_ai_agents_exec_agent_time" ON "public"."ai_agents_execution_log" USING "btree" ("ai_agent_id", "created_at" DESC);



CREATE INDEX "idx_ai_agents_exec_people_time" ON "public"."ai_agents_execution_log" USING "btree" ("people_id", "created_at" DESC);



CREATE INDEX "idx_ai_agents_exec_status" ON "public"."ai_agents_execution_log" USING "btree" ("execution_status", "created_at" DESC);



CREATE INDEX "idx_ai_agents_history_ai_agent_id" ON "public"."ai_agents_history" USING "btree" ("ai_agent_id");



CREATE INDEX "idx_ai_agents_history_created_by" ON "public"."ai_agents_history" USING "btree" ("created_by");



CREATE INDEX "idx_ai_agents_leads_stages_id" ON "public"."ai_agents" USING "btree" ("leads_stages_id");



CREATE INDEX "idx_ai_agents_llm_provider_id" ON "public"."ai_agents" USING "btree" ("llm_provider_id") WHERE ("llm_provider_id" IS NOT NULL);



CREATE INDEX "idx_ai_agents_pipeline_id" ON "public"."ai_agents" USING "btree" ("pipeline_id");



CREATE INDEX "idx_ai_agents_score_matrix_ai_agent_id" ON "public"."ai_agents_score_matrix" USING "btree" ("ai_agent_id");



CREATE INDEX "idx_ai_agents_score_matrix_score_matrix_id" ON "public"."ai_agents_score_matrix" USING "btree" ("score_matrix_id");



CREATE INDEX "idx_ai_agents_steps_agent_id" ON "public"."ai_agents_steps" USING "btree" ("ai_agent_id");



CREATE INDEX "idx_ai_agents_steps_history_leads_id" ON "public"."ai_agents_steps_history" USING "btree" ("lead_id");



CREATE INDEX "idx_ai_agents_steps_history_step_id" ON "public"."ai_agents_steps_history" USING "btree" ("step_id");



CREATE INDEX "idx_ai_agents_wa_channel_id" ON "public"."ai_agents" USING "btree" ("wa_channel_id") WHERE ("wa_channel_id" IS NOT NULL);



CREATE INDEX "idx_ai_exec_log_ai_agent_id" ON "public"."ai_agents_execution_log" USING "btree" ("ai_agent_id");



CREATE INDEX "idx_ai_exec_log_created_by" ON "public"."ai_agents_execution_log" USING "btree" ("created_by");



CREATE INDEX "idx_ai_exec_log_lead_id" ON "public"."ai_agents_execution_log" USING "btree" ("lead_id");



CREATE INDEX "idx_ai_scheduled_callbacks_due" ON "public"."ai_scheduled_callbacks" USING "btree" ("scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_ai_scheduled_callbacks_people" ON "public"."ai_scheduled_callbacks" USING "btree" ("people_id");



CREATE INDEX "idx_ai_scheduled_callbacks_status" ON "public"."ai_scheduled_callbacks" USING "btree" ("status");



CREATE INDEX "idx_auth_events_log_tenant" ON "public"."auth_events_log" USING "btree" ("tenant_id", "occurred_at" DESC);



CREATE INDEX "idx_auth_events_log_user" ON "public"."auth_events_log" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_bi_ad_campaigns_account" ON "public"."bi_ad_campaigns" USING "btree" ("account_id");



CREATE INDEX "idx_bi_ad_campaigns_ad_account" ON "public"."bi_ad_campaigns" USING "btree" ("ad_account_id") WHERE ("ad_account_id" IS NOT NULL);



CREATE INDEX "idx_bi_ad_campaigns_platform" ON "public"."bi_ad_campaigns" USING "btree" ("platform");



CREATE INDEX "idx_bi_ad_campaigns_utm_campaign" ON "public"."bi_ad_campaigns" USING "btree" ("utm_campaign") WHERE ("utm_campaign" IS NOT NULL);



CREATE INDEX "idx_bi_ad_daily_campaign_date" ON "public"."bi_ad_daily_stats" USING "btree" ("campaign_id", "stat_date" DESC);



CREATE INDEX "idx_bi_ad_spend_account_date" ON "public"."bi_ad_spend" USING "btree" ("ad_account_id", "date" DESC);



CREATE INDEX "idx_bi_ad_spend_campaign_date" ON "public"."bi_ad_spend" USING "btree" ("campaign_id", "date" DESC) WHERE ("campaign_id" IS NOT NULL);



CREATE INDEX "idx_bi_tiktok_ad_spend_campaign" ON "public"."bi_tiktok_ad_spend" USING "btree" ("campaign_id");



CREATE INDEX "idx_bi_tiktok_ad_spend_date" ON "public"."bi_tiktok_ad_spend" USING "btree" ("date");



CREATE INDEX "idx_booking_rule_sets_is_default" ON "public"."booking_rule_sets" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE UNIQUE INDEX "idx_booking_rule_sets_url_id" ON "public"."booking_rule_sets" USING "btree" ("url_id") WHERE ("url_id" IS NOT NULL);



CREATE INDEX "idx_booking_rules_rule_set_id" ON "public"."booking_rules" USING "btree" ("rule_set_id");



CREATE INDEX "idx_booking_token_jti_revoked_at" ON "public"."booking_token_jti_usage" USING "btree" ("revoked_at");



CREATE INDEX "idx_clients_people_archived" ON "public"."clients_people" USING "btree" ("archived");



CREATE INDEX "idx_clients_people_email" ON "public"."clients_people" USING "btree" ("email");



CREATE INDEX "idx_clients_people_email_not_null" ON "public"."clients_people" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "idx_clients_people_kiwify_customer_id" ON "public"."clients_people" USING "btree" ("kiwify_customer_id") WHERE ("kiwify_customer_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_clients_people_manychat_subscriber_id" ON "public"."clients_people" USING "btree" ("manychat_subscriber_id") WHERE ("manychat_subscriber_id" IS NOT NULL);



CREATE INDEX "idx_clients_people_score_matrix" ON "public"."clients_people" USING "btree" ("score_matrix_id");



CREATE INDEX "idx_clients_people_status" ON "public"."clients_people" USING "btree" ("status");



CREATE INDEX "idx_clients_people_telefone_not_null" ON "public"."clients_people" USING "btree" ("telefone") WHERE ("telefone" IS NOT NULL);



CREATE INDEX "idx_clients_people_tiktok_open_id" ON "public"."clients_people" USING "btree" ("tiktok_open_id") WHERE ("tiktok_open_id" IS NOT NULL);



CREATE INDEX "idx_clients_people_unread" ON "public"."clients_people" USING "btree" ("unread_count") WHERE ("unread_count" > 0);



CREATE INDEX "idx_clients_people_updates_people_id" ON "public"."clients_people_updates" USING "btree" ("people_id");



CREATE INDEX "idx_clients_people_updates_user_id" ON "public"."clients_people_updates" USING "btree" ("user_id");



CREATE INDEX "idx_clients_people_whatsapp" ON "public"."clients_people" USING "btree" ("whatsapp");



CREATE INDEX "idx_clients_people_whatsapp_not_null" ON "public"."clients_people" USING "btree" ("whatsapp") WHERE ("whatsapp" IS NOT NULL);



CREATE INDEX "idx_conv_queue_lead" ON "public"."conversion_events_queue" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_conv_queue_pending" ON "public"."conversion_events_queue" USING "btree" ("created_at") WHERE (("meta_status" = 'pending'::"text") OR ("google_status" = 'pending'::"text"));



CREATE INDEX "idx_data_export_jobs_tenant_id" ON "public"."data_export_jobs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_dead_letter_retry" ON "public"."omni_delivery_dead_letter" USING "btree" ("status", "next_retry_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_followup_queue_followup_id" ON "public"."followup_queue" USING "btree" ("followup_id");



CREATE INDEX "idx_followup_queue_meeting_followup_id" ON "public"."followup_queue" USING "btree" ("meeting_followup_id");



CREATE INDEX "idx_followup_queue_message_id" ON "public"."followup_queue" USING "btree" ("message_id");



CREATE INDEX "idx_followup_queue_pessoa_id" ON "public"."followup_queue" USING "btree" ("person_id");



CREATE INDEX "idx_form_pro_rate_limits_ip_ts" ON "public"."form_pro_rate_limits" USING "btree" ("ip", "ts" DESC);



CREATE INDEX "idx_form_pro_submissions_meta_form" ON "public"."form_pro_submissions" USING "btree" ("meta_form_id") WHERE ("meta_form_id" IS NOT NULL);



CREATE INDEX "idx_form_pro_submissions_source" ON "public"."form_pro_submissions" USING "btree" ("source");



CREATE INDEX "idx_fq_bh_dedup" ON "public"."followup_queue" USING "btree" ("lead_id", "original_scheduled_for") WHERE ("held_for_bh" = true);



CREATE INDEX "idx_fup_queue_created" ON "public"."followup_queue" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_fup_queue_lead" ON "public"."followup_queue" USING "btree" ("lead_id");



CREATE INDEX "idx_fup_queue_pending" ON "public"."followup_queue" USING "btree" ("scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_fup_queue_retry" ON "public"."followup_queue" USING "btree" ("status", "updated_at", "retry_count") WHERE ("status" = 'queued'::"text");



CREATE INDEX "idx_fup_queue_status" ON "public"."followup_queue" USING "btree" ("status");



CREATE INDEX "idx_inbound_webhooks_active" ON "public"."inbound_webhooks" USING "btree" ("active") WHERE ("active" = true);



CREATE UNIQUE INDEX "idx_inbound_webhooks_token" ON "public"."inbound_webhooks" USING "btree" ("token");



CREATE INDEX "idx_lead_field_definitions_active" ON "public"."lead_field_definitions" USING "btree" ("active", "category", "order_index");



CREATE UNIQUE INDEX "idx_lead_field_definitions_key_entity_pipeline" ON "public"."lead_field_definitions" USING "btree" ("key", "entity_type", "pipeline_id") NULLS NOT DISTINCT;



CREATE INDEX "idx_lead_field_definitions_pipeline" ON "public"."lead_field_definitions" USING "btree" ("pipeline_id") WHERE ("pipeline_id" IS NOT NULL);



CREATE INDEX "idx_lead_field_values_definition" ON "public"."lead_field_values" USING "btree" ("field_definition_id");



CREATE INDEX "idx_lead_field_values_entity" ON "public"."lead_field_values" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_lead_field_values_lead" ON "public"."lead_field_values" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_archived" ON "public"."leads" USING "btree" ("archived");



CREATE INDEX "idx_leads_companies_id" ON "public"."leads" USING "btree" ("company_id");



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_files_leads_id" ON "public"."leads_files" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_files_user_id" ON "public"."leads_files" USING "btree" ("user_id");



CREATE INDEX "idx_leads_lifecycle_stage" ON "public"."leads" USING "btree" ("lifecycle_stage") WHERE ("lifecycle_stage" IS NOT NULL);



CREATE INDEX "idx_leads_loss_reason_id" ON "public"."leads" USING "btree" ("leads_loss_reasons_id");



CREATE INDEX "idx_leads_notes_leads_id" ON "public"."leads_notes" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_notes_user_id" ON "public"."leads_notes" USING "btree" ("user_id");



CREATE INDEX "idx_leads_people_id" ON "public"."leads" USING "btree" ("people_id");



CREATE INDEX "idx_leads_pipeline_id" ON "public"."leads" USING "btree" ("leads_pipelines_id");



CREATE INDEX "idx_leads_stage_id" ON "public"."leads" USING "btree" ("leads_stages_id");



CREATE INDEX "idx_leads_stages_followups_email_template_id" ON "public"."leads_stages_followups" USING "btree" ("email_template_id") WHERE ("email_template_id" IS NOT NULL);



CREATE INDEX "idx_leads_stages_followups_target_stage_id" ON "public"."leads_stages_followups" USING "btree" ("target_stage_id");



CREATE INDEX "idx_leads_stages_fup_score" ON "public"."leads_stages_followups" USING "btree" ("score_matrix_id") WHERE ("score_matrix_id" IS NOT NULL);



CREATE INDEX "idx_leads_stages_fup_stage_active" ON "public"."leads_stages_followups" USING "btree" ("leads_stages_id", "active") WHERE ("active" = true);



CREATE INDEX "idx_leads_stages_fup_target" ON "public"."leads_stages_followups" USING "btree" ("target_stage_id") WHERE ("target_stage_id" IS NOT NULL);



CREATE INDEX "idx_leads_stages_order" ON "public"."leads_stages" USING "btree" ("order_index");



CREATE INDEX "idx_leads_stages_pipeline_id" ON "public"."leads_stages" USING "btree" ("leads_pipelines_id");



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_tags_tag_id" ON "public"."leads_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_leads_team_id" ON "public"."leads" USING "btree" ("teams_id");



CREATE INDEX "idx_leads_updates_created_at" ON "public"."leads_updates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_updates_from_stage_id" ON "public"."leads_updates" USING "btree" ("from_stage_id");



CREATE INDEX "idx_leads_updates_leads_id" ON "public"."leads_updates" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_updates_to_stage_id" ON "public"."leads_updates" USING "btree" ("to_stage_id");



CREATE INDEX "idx_leads_updates_user_id" ON "public"."leads_updates" USING "btree" ("user_id");



CREATE INDEX "idx_leads_user_id" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "idx_lgpd_anon_log_tenant" ON "public"."lgpd_anonymization_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_lp_forms_pipeline" ON "public"."form_pro_forms" USING "btree" ("pipeline_id") WHERE ("pipeline_id" IS NOT NULL);



CREATE INDEX "idx_lp_submissions_form_id" ON "public"."form_pro_submissions" USING "btree" ("form_id");



CREATE INDEX "idx_lp_submissions_lead" ON "public"."form_pro_submissions" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_lp_submissions_page_submitted" ON "public"."form_pro_submissions" USING "btree" ("page_id", "submitted_at" DESC);



CREATE INDEX "idx_lp_submissions_people" ON "public"."form_pro_submissions" USING "btree" ("people_id") WHERE ("people_id" IS NOT NULL);



CREATE INDEX "idx_lp_submissions_utm_source" ON "public"."form_pro_submissions" USING "btree" ("utm_source") WHERE ("utm_source" IS NOT NULL);



CREATE INDEX "idx_meeting_followup_queue_leads_id" ON "public"."meeting_followup_queue" USING "btree" ("lead_id");



CREATE INDEX "idx_meeting_records_created_by" ON "public"."meeting_records" USING "btree" ("created_by");



CREATE INDEX "idx_meetings_followups_source" ON "public"."meetings_followups" USING "btree" ("source") WHERE ("active" = true);



CREATE INDEX "idx_meetings_leads_id" ON "public"."meetings" USING "btree" ("lead_id");



CREATE INDEX "idx_meetings_people_id" ON "public"."meetings" USING "btree" ("people_id");



CREATE INDEX "idx_meetings_start_time" ON "public"."meetings" USING "btree" ("start_time");



CREATE INDEX "idx_meetings_status" ON "public"."meetings" USING "btree" ("status");



CREATE INDEX "idx_meetings_teams_id" ON "public"."meetings" USING "btree" ("teams_id");



CREATE INDEX "idx_meetings_users_id" ON "public"."meetings" USING "btree" ("user_id");



CREATE INDEX "idx_message_buffer_wa_phone_number_id" ON "public"."message_buffer" USING "btree" ("wa_phone_number_id") WHERE ("wa_phone_number_id" IS NOT NULL);



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_followup_id" ON "public"."messages" USING "btree" ("followup_id");



CREATE INDEX "idx_messages_leads_id" ON "public"."messages" USING "btree" ("lead_id");



CREATE INDEX "idx_messages_module_ref_id" ON "public"."messages" USING "btree" ("module_ref_id") WHERE ("module_ref_id" IS NOT NULL);



CREATE INDEX "idx_messages_parent" ON "public"."messages" USING "btree" ("parent_message_id");



CREATE INDEX "idx_messages_pending_delivery" ON "public"."messages" USING "btree" ("channel", "created_at") WHERE (("status" = 'pending'::"text") AND ("from_contact" <> 'cliente'::"text"));



CREATE INDEX "idx_messages_people_id" ON "public"."messages" USING "btree" ("people_id");



CREATE INDEX "idx_messages_source_type" ON "public"."messages" USING "btree" ("source_type") WHERE ("source_type" IS NOT NULL);



CREATE INDEX "idx_messages_status" ON "public"."messages" USING "btree" ("status");



CREATE INDEX "idx_messages_unread_by_person" ON "public"."messages" USING "btree" ("people_id") WHERE (("from_contact" = 'cliente'::"text") AND ("seen_at" IS NULL));



CREATE INDEX "idx_messages_users_id" ON "public"."messages" USING "btree" ("user_id");



CREATE INDEX "idx_messages_wa_phone_number_id" ON "public"."messages" USING "btree" ("wa_phone_number_id") WHERE ("wa_phone_number_id" IS NOT NULL);



CREATE INDEX "idx_meta_lead_forms_page_id" ON "public"."meta_lead_forms" USING "btree" ("page_id");



CREATE INDEX "idx_mfa_recovery_codes_user_unused" ON "public"."mfa_recovery_codes" USING "btree" ("user_id") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_mfq_bh_dedup" ON "public"."meeting_followup_queue" USING "btree" ("meeting_id", "original_scheduled_for") WHERE ("held_for_bh" = true);



CREATE INDEX "idx_mfq_meeting" ON "public"."meeting_followup_queue" USING "btree" ("meeting_id");



CREATE INDEX "idx_mfq_people" ON "public"."meeting_followup_queue" USING "btree" ("person_id");



CREATE INDEX "idx_mfq_retry" ON "public"."meeting_followup_queue" USING "btree" ("status", "scheduled_for", "retry_count") WHERE ("status" = 'queued'::"text");



CREATE INDEX "idx_mfq_rule" ON "public"."meeting_followup_queue" USING "btree" ("rule_id");



CREATE INDEX "idx_mfq_status_scheduled" ON "public"."meeting_followup_queue" USING "btree" ("status", "scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_notif_pref_user_id" ON "public"."user_notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_feed" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_notifications_open" ON "public"."notifications" USING "btree" ("people_id", "event_type") WHERE ("read_at" IS NULL);



COMMENT ON INDEX "public"."idx_notifications_open" IS 'UNIQUE de propósito: garante no banco a invariante "no máximo 1 notificação aberta por (pessoa, tipo)". É o alvo do ON CONFLICT do trigger bump_clients_people_on_message.';



CREATE INDEX "idx_notifications_target_user" ON "public"."notifications" USING "btree" ("target_user_id") WHERE ("target_user_id" IS NOT NULL);



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("created_at" DESC) WHERE ("read_at" IS NULL);



CREATE INDEX "idx_omni_channel_alerts_channel_type" ON "public"."omni_channel_alerts" USING "btree" ("channel", "alert_type", "created_at" DESC);



CREATE INDEX "idx_omni_channel_alerts_severity" ON "public"."omni_channel_alerts" USING "btree" ("severity", "created_at" DESC) WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_people_companies_company" ON "public"."clients_people_companies" USING "btree" ("company_id");



CREATE INDEX "idx_people_companies_people" ON "public"."clients_people_companies" USING "btree" ("people_id");



CREATE INDEX "idx_people_document" ON "public"."clients_people" USING "btree" ("document") WHERE ("document" IS NOT NULL);



CREATE INDEX "idx_people_email" ON "public"."clients_people" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_people_instagram_handle" ON "public"."clients_people" USING "btree" ("lower"("instagram_handle")) WHERE ("instagram_handle" IS NOT NULL);



CREATE INDEX "idx_people_instagram_user_id" ON "public"."clients_people" USING "btree" ("instagram_user_id") WHERE ("instagram_user_id" IS NOT NULL);



CREATE INDEX "idx_people_merged_into_id" ON "public"."clients_people" USING "btree" ("merged_into_id") WHERE ("merged_into_id" IS NOT NULL);



CREATE INDEX "idx_people_whatsapp" ON "public"."clients_people" USING "btree" ("whatsapp") WHERE ("whatsapp" IS NOT NULL);



CREATE INDEX "idx_secret_access_log_accessed_at" ON "public"."secret_access_log" USING "btree" ("accessed_at");



CREATE INDEX "idx_sends_channel" ON "public"."sends" USING "btree" ("channel");



CREATE INDEX "idx_sends_contacts_people_id" ON "public"."sends_contacts" USING "btree" ("people_id");



CREATE INDEX "idx_sends_contacts_send_id" ON "public"."sends_contacts" USING "btree" ("send_id");



CREATE INDEX "idx_sends_contacts_status" ON "public"."sends_contacts" USING "btree" ("status");



CREATE INDEX "idx_sends_created_by" ON "public"."sends" USING "btree" ("created_by");



CREATE INDEX "idx_sends_import_sessions_send_id" ON "public"."sends_import_sessions" USING "btree" ("send_id");



CREATE INDEX "idx_sends_pipeline_id" ON "public"."sends" USING "btree" ("pipeline_id");



CREATE INDEX "idx_sends_status" ON "public"."sends" USING "btree" ("status");



CREATE INDEX "idx_sends_team_id" ON "public"."sends" USING "btree" ("team_id");



CREATE INDEX "idx_sends_wa_channel_id" ON "public"."sends" USING "btree" ("wa_channel_id") WHERE ("wa_channel_id" IS NOT NULL);



CREATE INDEX "idx_settings_omni_new_contact_pipeline_id" ON "public"."settings_omni_new_contact" USING "btree" ("pipeline_id");



CREATE INDEX "idx_settings_omni_new_contact_stage_id" ON "public"."settings_omni_new_contact" USING "btree" ("stage_id");



CREATE INDEX "idx_settings_schedules_user_id" ON "public"."settings_schedules" USING "btree" ("user_id");



CREATE INDEX "idx_settings_teams_tags_tag_id" ON "public"."settings_teams_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_settings_users_active" ON "public"."settings_users" USING "btree" ("active");



CREATE INDEX "idx_settings_users_auth_user_id" ON "public"."settings_users" USING "btree" ("auth_user_id");



CREATE INDEX "idx_settings_users_email" ON "public"."settings_users" USING "btree" ("email");



CREATE INDEX "idx_settings_users_teams_team_id" ON "public"."settings_users_teams" USING "btree" ("team_id");



CREATE INDEX "idx_settings_users_teams_user_id" ON "public"."settings_users_teams" USING "btree" ("user_id");



CREATE INDEX "idx_tenant_api_keys_key_hash" ON "public"."tenant_api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_tenant_api_keys_tenant_id" ON "public"."tenant_api_keys" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "idx_wa_channels_evolution_server_instance_unique" ON "public"."settings_whatsapp_channels" USING "btree" ("evolution_base_url", "evolution_instance_name") WHERE ("provider" = 'evolution'::"text");



CREATE UNIQUE INDEX "idx_wa_channels_evolution_token_unique" ON "public"."settings_whatsapp_channels" USING "btree" ("evolution_webhook_token") WHERE ("provider" = 'evolution'::"text");



CREATE INDEX "idx_webhook_logs_channel" ON "public"."webhook_logs" USING "btree" ("channel", "created_at" DESC);



CREATE INDEX "idx_webhook_logs_created_at" ON "public"."webhook_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_webhook_logs_event" ON "public"."webhook_logs" USING "btree" ("event", "created_at" DESC);



CREATE INDEX "idx_webhook_logs_subscriber" ON "public"."webhook_logs" USING "btree" ("subscriber_id") WHERE ("subscriber_id" IS NOT NULL);



CREATE INDEX "idx_webhook_logs_webhook_id" ON "public"."webhook_logs" USING "btree" ("webhook_id");



CREATE INDEX "idx_webhooks_active" ON "public"."webhooks" USING "btree" ("active");



CREATE INDEX "idx_webhooks_event_type" ON "public"."webhooks" USING "btree" ("event_type");



CREATE INDEX "idx_webhooks_pipeline_id" ON "public"."webhooks" USING "btree" ("pipeline_id");



CREATE INDEX "instagram_automation_log_automation_idx" ON "public"."instagram_automation_log" USING "btree" ("automation_id", "executed_at" DESC);



CREATE UNIQUE INDEX "instagram_automation_log_comment_claim_idx" ON "public"."instagram_automation_log" USING "btree" ("ig_message_id") WHERE ("trigger_type" = 'post_comment'::"text");



CREATE INDEX "instagram_automation_log_person_idx" ON "public"."instagram_automation_log" USING "btree" ("person_id", "automation_id", "executed_at" DESC);



CREATE INDEX "instagram_automations_post_idx" ON "public"."instagram_automations" USING "btree" ("target_post_id") WHERE ("target_post_id" IS NOT NULL);



CREATE INDEX "instagram_automations_trigger_idx" ON "public"."instagram_automations" USING "btree" ("trigger_type", "is_active", "priority");



CREATE UNIQUE INDEX "kiwify_event_mappings_default_uq" ON "public"."kiwify_event_mappings" USING "btree" ("trigger") WHERE ("product_id" IS NULL);



CREATE UNIQUE INDEX "kiwify_event_mappings_product_uq" ON "public"."kiwify_event_mappings" USING "btree" ("product_id", "trigger") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "kiwify_lead_products_people_idx" ON "public"."kiwify_lead_products" USING "btree" ("people_id");



CREATE UNIQUE INDEX "kiwify_message_automations_default_uq" ON "public"."kiwify_message_automations" USING "btree" ("trigger") WHERE ("product_id" IS NULL);



CREATE UNIQUE INDEX "kiwify_message_automations_product_uq" ON "public"."kiwify_message_automations" USING "btree" ("product_id", "trigger") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "kiwify_message_jobs_due_idx" ON "public"."kiwify_message_jobs" USING "btree" ("scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "kiwify_message_jobs_event_idx" ON "public"."kiwify_message_jobs" USING "btree" ("event_id");



CREATE INDEX "kiwify_message_jobs_order_idx" ON "public"."kiwify_message_jobs" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE INDEX "kiwify_message_jobs_people_idx" ON "public"."kiwify_message_jobs" USING "btree" ("people_id");



CREATE INDEX "kiwify_webhook_events_created_idx" ON "public"."kiwify_webhook_events" USING "btree" ("created_at" DESC);



CREATE INDEX "kiwify_webhook_events_order_id_idx" ON "public"."kiwify_webhook_events" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE INDEX "kiwify_webhook_events_status_idx" ON "public"."kiwify_webhook_events" USING "btree" ("status");



CREATE UNIQUE INDEX "lead_types_name_key" ON "public"."lead_types" USING "btree" ("name");



CREATE INDEX "lead_types_sort_order_idx" ON "public"."lead_types" USING "btree" ("sort_order", "name");



CREATE UNIQUE INDEX "leads_pipelines_kiwify_product_id_uq" ON "public"."leads_pipelines" USING "btree" ("kiwify_product_id") WHERE ("kiwify_product_id" IS NOT NULL);



CREATE INDEX "meeting_records_meeting_id_idx" ON "public"."meeting_records" USING "btree" ("meeting_id");



CREATE INDEX "meeting_records_source_idx" ON "public"."meeting_records" USING "btree" ("source");



CREATE INDEX "meeting_records_type_idx" ON "public"."meeting_records" USING "btree" ("meeting_id", "record_type");



CREATE UNIQUE INDEX "meetings_calcom_uid_key" ON "public"."meetings" USING "btree" ("calcom_uid") WHERE ("calcom_uid" IS NOT NULL);



CREATE UNIQUE INDEX "meetings_google_event_id_idx" ON "public"."meetings" USING "btree" ("google_event_id") WHERE ("google_event_id" IS NOT NULL);



CREATE UNIQUE INDEX "meetings_ms_meeting_id_idx" ON "public"."meetings" USING "btree" ("ms_meeting_id") WHERE ("ms_meeting_id" IS NOT NULL);



CREATE INDEX "meetings_source_idx" ON "public"."meetings" USING "btree" ("source") WHERE ("source" IS NOT NULL);



CREATE UNIQUE INDEX "meetings_zoom_meeting_id_idx" ON "public"."meetings" USING "btree" ("zoom_meeting_id") WHERE ("zoom_meeting_id" IS NOT NULL);



CREATE INDEX "message_buffer_ready_to_process" ON "public"."message_buffer" USING "btree" ("people_id", "expires_at") WHERE ("processed" = false);



CREATE INDEX "messages_execution_id_idx" ON "public"."messages" USING "btree" ("execution_id") WHERE ("execution_id" IS NOT NULL);



CREATE UNIQUE INDEX "messages_ig_message_id_key" ON "public"."messages" USING "btree" ("ig_message_id") WHERE ("ig_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "messages_wa_message_id_unique" ON "public"."messages" USING "btree" ("wa_message_id") WHERE ("wa_message_id" IS NOT NULL);



CREATE INDEX "schedule_automations_pipeline_idx" ON "public"."schedule_automations" USING "btree" ("pipeline_id", "is_active");



CREATE UNIQUE INDEX "schedule_automations_unique_rule" ON "public"."schedule_automations" USING "btree" ("pipeline_id", "trigger_status") WHERE ("is_active" = true);



CREATE INDEX "score_category_items_category_id_idx" ON "public"."score_category_items" USING "btree" ("category_id");



CREATE INDEX "score_category_items_order_idx" ON "public"."score_category_items" USING "btree" ("category_id", "order_index");



CREATE INDEX "score_matrix_category_selections_gin_idx" ON "public"."score_matrix" USING "gin" ("category_selections");



CREATE UNIQUE INDEX "settings_ai_providers_one_default_per_provider" ON "public"."settings_ai_providers" USING "btree" ("provider") WHERE (("is_default" = true) AND ("active" = true));



CREATE INDEX "settings_audit_log_section_idx" ON "public"."settings_audit_log" USING "btree" ("tenant_id", "section");



CREATE INDEX "settings_audit_log_tenant_changed_idx" ON "public"."settings_audit_log" USING "btree" ("tenant_id", "changed_at" DESC);



CREATE INDEX "settings_audit_log_user_idx" ON "public"."settings_audit_log" USING "btree" ("tenant_id", "user_id");



CREATE UNIQUE INDEX "settings_elevenlabs_singleton" ON "public"."settings_elevenlabs" USING "btree" ((true));



CREATE INDEX "settings_users_role_id_idx" ON "public"."settings_users" USING "btree" ("role_id");



CREATE INDEX "tenant_role_permissions_role_idx" ON "public"."tenant_role_permissions" USING "btree" ("role_id");



CREATE INDEX "tenant_roles_tenant_idx" ON "public"."tenant_roles" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "user_calendar_connections_user_google_email_uidx" ON "public"."user_calendar_connections" USING "btree" ("user_id", "google_email") WHERE ("google_email" IS NOT NULL);



CREATE UNIQUE INDEX "user_calendar_connections_user_ms_email_uidx" ON "public"."user_calendar_connections" USING "btree" ("user_id", "ms_email") WHERE ("ms_email" IS NOT NULL);



CREATE UNIQUE INDEX "whatsapp_channels_one_default" ON "public"."settings_whatsapp_channels" USING "btree" ("is_default") WHERE (("is_default" = true) AND ("active" = true));



CREATE OR REPLACE TRIGGER "ai_agent_callback_configs_set_updated_at" BEFORE UPDATE ON "public"."ai_agent_callback_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "ai_buffer_insert_trigger" AFTER INSERT ON "public"."message_buffer" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_ai_on_buffer_insert"();



CREATE OR REPLACE TRIGGER "ai_scheduled_callbacks_set_updated_at" BEFORE UPDATE ON "public"."ai_scheduled_callbacks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "bi_sdr_targets_updated_at" BEFORE UPDATE ON "public"."bi_sdr_targets" FOR EACH ROW EXECUTE FUNCTION "public"."update_bi_sdr_targets_updated_at"();



CREATE OR REPLACE TRIGGER "bi_settings_audit" AFTER UPDATE ON "public"."bi_settings" FOR EACH ROW EXECUTE FUNCTION "public"."settings_audit_trigger_fn"('integracoes');



CREATE OR REPLACE TRIGGER "bump_clients_people_on_message_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."bump_clients_people_on_message"();



CREATE OR REPLACE TRIGGER "cleanup_history_after_insert" AFTER INSERT ON "public"."ai_agents_history" FOR EACH ROW EXECUTE FUNCTION "public"."trg_cleanup_agent_history"();



CREATE OR REPLACE TRIGGER "email_templates_set_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "instagram_automations_updated_at" BEFORE UPDATE ON "public"."instagram_automations" FOR EACH ROW EXECUTE FUNCTION "public"."set_instagram_automation_updated_at"();



CREATE OR REPLACE TRIGGER "kiwify_connections_set_updated_at" BEFORE UPDATE ON "public"."kiwify_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "kiwify_event_mappings_set_updated_at" BEFORE UPDATE ON "public"."kiwify_event_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "kiwify_lead_products_set_updated_at" BEFORE UPDATE ON "public"."kiwify_lead_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "kiwify_message_automations_set_updated_at" BEFORE UPDATE ON "public"."kiwify_message_automations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "kiwify_message_jobs_set_updated_at" BEFORE UPDATE ON "public"."kiwify_message_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "leads_stage_duplication_trigger" AFTER INSERT OR UPDATE OF "leads_stages_id" ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."duplicate_lead_on_stage_enter"();



CREATE OR REPLACE TRIGGER "messages_status_to_sends_contacts" AFTER UPDATE OF "status" ON "public"."messages" FOR EACH ROW WHEN (("new"."status" IS DISTINCT FROM "old"."status")) EXECUTE FUNCTION "public"."propagate_message_status_to_sends"();



COMMENT ON TRIGGER "messages_status_to_sends_contacts" ON "public"."messages" IS 'Bridge para sends_contacts. WHEN clause evita re-fire em UPDATEs que não tocam status (R1 mitigation).';



CREATE OR REPLACE TRIGGER "omni_channel_configs_audit" AFTER UPDATE ON "public"."omni_channel_configs" FOR EACH ROW EXECUTE FUNCTION "public"."settings_audit_trigger_fn"('omni');



CREATE OR REPLACE TRIGGER "on_lead_stage_changed" AFTER INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."notify_lead_stage_changed"();



CREATE OR REPLACE TRIGGER "schedule_automations_updated_at" BEFORE UPDATE ON "public"."schedule_automations" FOR EACH ROW EXECUTE FUNCTION "public"."set_schedule_automation_updated_at"();



CREATE OR REPLACE TRIGGER "score_categories_updated_at" BEFORE UPDATE ON "public"."score_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "score_category_items_updated_at" BEFORE UPDATE ON "public"."score_category_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_elevenlabs_agents_updated_at" BEFORE UPDATE ON "public"."elevenlabs_agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_elevenlabs_updated_at"();



CREATE OR REPLACE TRIGGER "set_elevenlabs_voices_updated_at" BEFORE UPDATE ON "public"."elevenlabs_voices" FOR EACH ROW EXECUTE FUNCTION "public"."set_elevenlabs_updated_at"();



CREATE OR REPLACE TRIGGER "set_settings_elevenlabs_updated_at" BEFORE UPDATE ON "public"."settings_elevenlabs" FOR EACH ROW EXECUTE FUNCTION "public"."set_elevenlabs_updated_at"();



CREATE OR REPLACE TRIGGER "settings_ai_providers_updated_at" BEFORE UPDATE ON "public"."settings_ai_providers" FOR EACH ROW EXECUTE FUNCTION "public"."settings_ai_providers_set_updated_at"();



CREATE OR REPLACE TRIGGER "settings_audit" AFTER UPDATE ON "public"."settings" FOR EACH ROW EXECUTE FUNCTION "public"."settings_audit_trigger_fn"('geral');



CREATE OR REPLACE TRIGGER "trg_adm_clients_updated_at" BEFORE UPDATE ON "public"."adm_clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_adm_clients_updated_at"();



CREATE OR REPLACE TRIGGER "trg_advance_stage_on_first_ai_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_advance_stage_on_first_ai_message"();



CREATE OR REPLACE TRIGGER "trg_auto_pause_ai_on_human_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."auto_pause_ai_on_human_message"();



CREATE OR REPLACE TRIGGER "trg_booking_rule_sets_url_id" BEFORE INSERT ON "public"."booking_rule_sets" FOR EACH ROW EXECUTE FUNCTION "public"."assign_booking_rule_set_url_id"();



CREATE OR REPLACE TRIGGER "trg_conversion_booking_status" AFTER UPDATE OF "status" ON "public"."meetings" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."fn_queue_conversion_booking"();



CREATE OR REPLACE TRIGGER "trg_conversion_lead_lost" AFTER UPDATE ON "public"."leads" FOR EACH ROW WHEN ((("old"."lost_at" IS NULL) AND ("new"."lost_at" IS NOT NULL))) EXECUTE FUNCTION "public"."fn_queue_conversion_event"('lead_lost');



CREATE OR REPLACE TRIGGER "trg_conversion_lead_won" AFTER UPDATE ON "public"."leads" FOR EACH ROW WHEN ((("old"."won_at" IS NULL) AND ("new"."won_at" IS NOT NULL))) EXECUTE FUNCTION "public"."fn_queue_conversion_event"('lead_won');



CREATE OR REPLACE TRIGGER "trg_conversion_stage_enter" AFTER UPDATE ON "public"."leads" FOR EACH ROW WHEN (("old"."leads_stages_id" IS DISTINCT FROM "new"."leads_stages_id")) EXECUTE FUNCTION "public"."fn_queue_conversion_event"('stage_change');



CREATE OR REPLACE TRIGGER "trg_dead_letter_updated_at" BEFORE UPDATE ON "public"."omni_delivery_dead_letter" FOR EACH ROW EXECUTE FUNCTION "public"."set_dead_letter_updated_at"();



CREATE OR REPLACE TRIGGER "trg_disable_ai_on_atendimento_humano" AFTER INSERT OR UPDATE OF "leads_stages_id" ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."disable_ai_on_atendimento_humano"();



CREATE OR REPLACE TRIGGER "trg_identity_auto_merge" AFTER INSERT OR UPDATE OF "email", "document", "whatsapp", "instagram_user_id", "instagram_handle" ON "public"."clients_people" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_merge_on_identity"();



CREATE OR REPLACE TRIGGER "trg_lp_forms_updated_at" BEFORE UPDATE ON "public"."form_pro_forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_lp_tables_updated_at"();



CREATE OR REPLACE TRIGGER "trg_meeting_followup_queue" AFTER INSERT OR UPDATE OF "status" ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_meeting_followup_queue"();



CREATE OR REPLACE TRIGGER "trg_notify_closer_on_meeting_scheduled" AFTER INSERT ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_closer_on_meeting_scheduled"();



CREATE OR REPLACE TRIGGER "trg_omni_channel_configs_updated_at" BEFORE UPDATE ON "public"."omni_channel_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_omni_channel_configs_updated_at"();



CREATE OR REPLACE TRIGGER "trg_omni_outbound_webhooks_updated_at" BEFORE UPDATE ON "public"."omni_outbound_webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."set_omni_outbound_webhooks_updated_at"();



CREATE OR REPLACE TRIGGER "trg_schedule_automation" AFTER INSERT OR UPDATE OF "status" ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."fn_schedule_automation_on_status_change"();



CREATE OR REPLACE TRIGGER "trg_score_settings_updated_at" BEFORE UPDATE ON "public"."score_settings" FOR EACH ROW EXECUTE FUNCTION "public"."score_settings_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sends_import_sessions_updated_at" BEFORE UPDATE ON "public"."sends_import_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_sends_import_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "trg_settings_users_mfa_grace" BEFORE INSERT ON "public"."settings_users" FOR EACH ROW EXECUTE FUNCTION "public"."settings_users_set_mfa_grace"();



CREATE OR REPLACE TRIGGER "trg_settings_users_sync_admin_flag" BEFORE INSERT OR UPDATE OF "super_admin", "user_type" ON "public"."settings_users" FOR EACH ROW EXECUTE FUNCTION "public"."settings_users_sync_admin_flag"();



CREATE OR REPLACE TRIGGER "trg_sync_active_channel" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."sync_active_channel_from_message"();



CREATE OR REPLACE TRIGGER "trigger_dispatch_new_lead_webhooks" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_new_lead_webhooks"();



CREATE OR REPLACE TRIGGER "trigger_update_meeting_records_updated_at" BEFORE UPDATE ON "public"."meeting_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ai_agents_steps_updated_at" BEFORE UPDATE ON "public"."ai_agents_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ai_agents_updated_at" BEFORE UPDATE ON "public"."ai_agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_companies_updated_at" BEFORE UPDATE ON "public"."clients_companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_people_companies_updated_at" BEFORE UPDATE ON "public"."clients_people_companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_people_updated_at" BEFORE UPDATE ON "public"."clients_people" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_followup_queue_updated_at" BEFORE UPDATE ON "public"."followup_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inbound_webhooks_updated_at" BEFORE UPDATE ON "public"."inbound_webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lead_tags_updated_at" BEFORE UPDATE ON "public"."lead_tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_loss_reasons_updated_at" BEFORE UPDATE ON "public"."leads_loss_reasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_notes_updated_at" BEFORE UPDATE ON "public"."leads_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_pipelines_updated_at" BEFORE UPDATE ON "public"."leads_pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_stages_followups_updated_at" BEFORE UPDATE ON "public"."leads_stages_followups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_stages_updated_at" BEFORE UPDATE ON "public"."leads_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_meetings_followups_updated_at" BEFORE UPDATE ON "public"."meetings_followups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_meetings_updated_at" BEFORE UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_score_matrix_updated_at" BEFORE UPDATE ON "public"."score_matrix" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sends_updated_at" BEFORE UPDATE ON "public"."sends" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_settings_schedules_updated_at" BEFORE UPDATE ON "public"."settings_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_settings_system_modules_updated_at" BEFORE UPDATE ON "public"."settings_system_modules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_settings_teams_updated_at" BEFORE UPDATE ON "public"."settings_teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_settings_updated_at" BEFORE UPDATE ON "public"."settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_settings_users_updated_at" BEFORE UPDATE ON "public"."settings_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_webhooks_updated_at" BEFORE UPDATE ON "public"."webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_templates_updated_at" BEFORE UPDATE ON "public"."whatsapp_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "whatsapp_channels_updated_at" BEFORE UPDATE ON "public"."settings_whatsapp_channels" FOR EACH ROW EXECUTE FUNCTION "public"."settings_whatsapp_channels_set_updated_at"();



ALTER TABLE ONLY "public"."adm_migration_runs"
    ADD CONSTRAINT "adm_migration_runs_migration_id_fkey" FOREIGN KEY ("migration_id") REFERENCES "public"."adm_migrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adm_sync_jobs"
    ADD CONSTRAINT "adm_sync_jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."adm_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adm_sync_logs"
    ADD CONSTRAINT "adm_sync_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."adm_sync_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agent_callback_configs"
    ADD CONSTRAINT "ai_agent_callback_configs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agent_callback_configs"
    ADD CONSTRAINT "ai_agent_callback_configs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."ai_agents_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_elevenlabs_agent_id_fkey" FOREIGN KEY ("elevenlabs_agent_id") REFERENCES "public"."elevenlabs_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents_execution_log"
    ADD CONSTRAINT "ai_agents_execution_log_ai_agent_id_fkey" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_execution_log"
    ADD CONSTRAINT "ai_agents_execution_log_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents_execution_log"
    ADD CONSTRAINT "ai_agents_execution_log_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents_execution_log"
    ADD CONSTRAINT "ai_agents_execution_log_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_history"
    ADD CONSTRAINT "ai_agents_history_ai_agent_id_fkey" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_history"
    ADD CONSTRAINT "ai_agents_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_leads_stages_id_fkey" FOREIGN KEY ("leads_stages_id") REFERENCES "public"."leads_stages"("id");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_llm_provider_id_fkey" FOREIGN KEY ("llm_provider_id") REFERENCES "public"."settings_ai_providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agents_score_matrix"
    ADD CONSTRAINT "ai_agents_score_matrix_ai_agent_id_fkey" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_score_matrix"
    ADD CONSTRAINT "ai_agents_score_matrix_score_matrix_id_fkey" FOREIGN KEY ("score_matrix_id") REFERENCES "public"."score_matrix"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_steps"
    ADD CONSTRAINT "ai_agents_steps_ai_agent_id_fkey" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_steps_history"
    ADD CONSTRAINT "ai_agents_steps_history_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents_steps_history"
    ADD CONSTRAINT "ai_agents_steps_history_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."ai_agents_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_wa_channel_id_fkey" FOREIGN KEY ("wa_channel_id") REFERENCES "public"."settings_whatsapp_channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_scheduled_callbacks"
    ADD CONSTRAINT "ai_scheduled_callbacks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_scheduled_callbacks"
    ADD CONSTRAINT "ai_scheduled_callbacks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_scheduled_callbacks"
    ADD CONSTRAINT "ai_scheduled_callbacks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_scheduled_callbacks"
    ADD CONSTRAINT "ai_scheduled_callbacks_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_scheduled_callbacks"
    ADD CONSTRAINT "ai_scheduled_callbacks_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."ai_agents_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_events_log"
    ADD CONSTRAINT "auth_events_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."crm_tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_login_attempts"
    ADD CONSTRAINT "auth_login_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_ad_campaigns"
    ADD CONSTRAINT "bi_ad_campaigns_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."bi_ad_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_ad_campaigns"
    ADD CONSTRAINT "bi_ad_campaigns_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "public"."bi_ad_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_ad_daily_stats"
    ADD CONSTRAINT "bi_ad_daily_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bi_ad_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_ad_spend"
    ADD CONSTRAINT "bi_ad_spend_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bi_ad_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bi_sdr_targets"
    ADD CONSTRAINT "bi_sdr_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_voice_session_log"
    ADD CONSTRAINT "bi_voice_session_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_voice_session_log"
    ADD CONSTRAINT "bi_voice_session_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bi_voice_token_log"
    ADD CONSTRAINT "bi_voice_token_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_voice_tool_invocations"
    ADD CONSTRAINT "bi_voice_tool_invocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bi_voice_tool_invocations"
    ADD CONSTRAINT "bi_voice_tool_invocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_rules"
    ADD CONSTRAINT "booking_rules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "public"."booking_rule_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients_people"
    ADD CONSTRAINT "clients_people_active_channel_id_fkey" FOREIGN KEY ("active_channel_id") REFERENCES "public"."settings_whatsapp_channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients_people_companies"
    ADD CONSTRAINT "clients_people_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."clients_companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients_people_companies"
    ADD CONSTRAINT "clients_people_companies_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients_people"
    ADD CONSTRAINT "clients_people_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients_people"
    ADD CONSTRAINT "clients_people_last_read_by_fkey" FOREIGN KEY ("last_read_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients_people"
    ADD CONSTRAINT "clients_people_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients_people_updates"
    ADD CONSTRAINT "clients_people_updates_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients_people_updates"
    ADD CONSTRAINT "clients_people_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversion_event_rules"
    ADD CONSTRAINT "conversion_event_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_events_queue"
    ADD CONSTRAINT "conversion_events_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_events_queue"
    ADD CONSTRAINT "conversion_events_queue_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_events_queue"
    ADD CONSTRAINT "conversion_events_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_platform_credentials"
    ADD CONSTRAINT "conversion_platform_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_stage_mappings"
    ADD CONSTRAINT "conversion_stage_mappings_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_stage_mappings"
    ADD CONSTRAINT "conversion_stage_mappings_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_stage_mappings"
    ADD CONSTRAINT "conversion_stage_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_export_jobs"
    ADD CONSTRAINT "data_export_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."data_export_jobs"
    ADD CONSTRAINT "data_export_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."crm_tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."elevenlabs_agents"
    ADD CONSTRAINT "elevenlabs_agents_ai_agent_id_fkey" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients_people"
    ADD CONSTRAINT "fk_score_matrix" FOREIGN KEY ("score_matrix_id") REFERENCES "public"."score_matrix"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."followup_queue"
    ADD CONSTRAINT "followup_queue_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "public"."leads_stages_followups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_queue"
    ADD CONSTRAINT "followup_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_queue"
    ADD CONSTRAINT "followup_queue_meeting_followup_id_fkey" FOREIGN KEY ("meeting_followup_id") REFERENCES "public"."meetings_followups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_queue"
    ADD CONSTRAINT "followup_queue_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."followup_queue"
    ADD CONSTRAINT "followup_queue_pessoa_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_pro_submissions"
    ADD CONSTRAINT "form_pro_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."form_pro_forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_pro_submissions"
    ADD CONSTRAINT "form_pro_submissions_meta_form_id_fkey" FOREIGN KEY ("meta_form_id") REFERENCES "public"."meta_lead_forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_webhooks"
    ADD CONSTRAINT "inbound_webhooks_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_webhooks"
    ADD CONSTRAINT "inbound_webhooks_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."instagram_automation_log"
    ADD CONSTRAINT "instagram_automation_log_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."instagram_automations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."instagram_automation_log"
    ADD CONSTRAINT "instagram_automation_log_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiwify_event_mappings"
    ADD CONSTRAINT "kiwify_event_mappings_target_pipeline_id_fkey" FOREIGN KEY ("target_pipeline_id") REFERENCES "public"."leads_pipelines"("id");



ALTER TABLE ONLY "public"."kiwify_event_mappings"
    ADD CONSTRAINT "kiwify_event_mappings_target_stage_id_fkey" FOREIGN KEY ("target_stage_id") REFERENCES "public"."leads_stages"("id");



ALTER TABLE ONLY "public"."kiwify_lead_products"
    ADD CONSTRAINT "kiwify_lead_products_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."kiwify_connections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiwify_lead_products"
    ADD CONSTRAINT "kiwify_lead_products_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiwify_message_jobs"
    ADD CONSTRAINT "kiwify_message_jobs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."kiwify_message_automations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiwify_message_jobs"
    ADD CONSTRAINT "kiwify_message_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."kiwify_webhook_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiwify_message_jobs"
    ADD CONSTRAINT "kiwify_message_jobs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiwify_message_jobs"
    ADD CONSTRAINT "kiwify_message_jobs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiwify_message_jobs"
    ADD CONSTRAINT "kiwify_message_jobs_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiwify_webhook_events"
    ADD CONSTRAINT "kiwify_webhook_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."kiwify_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_field_definitions"
    ADD CONSTRAINT "lead_field_definitions_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_field_values"
    ADD CONSTRAINT "lead_field_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "public"."lead_field_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_field_values"
    ADD CONSTRAINT "lead_field_values_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_types"
    ADD CONSTRAINT "lead_types_whatsapp_template_id_fkey" FOREIGN KEY ("whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."clients_companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_files"
    ADD CONSTRAINT "leads_files_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_files"
    ADD CONSTRAINT "leads_files_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_leads_loss_reasons_id_fkey" FOREIGN KEY ("leads_loss_reasons_id") REFERENCES "public"."leads_loss_reasons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_leads_pipelines_id_fkey" FOREIGN KEY ("leads_pipelines_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_leads_stages_id_fkey" FOREIGN KEY ("leads_stages_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_notes"
    ADD CONSTRAINT "leads_notes_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_notes"
    ADD CONSTRAINT "leads_notes_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_stage_duplication_rules"
    ADD CONSTRAINT "leads_stage_duplication_rules_source_stage_id_fkey" FOREIGN KEY ("source_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_stage_duplication_rules"
    ADD CONSTRAINT "leads_stage_duplication_rules_target_pipeline_id_fkey" FOREIGN KEY ("target_pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_stage_duplication_rules"
    ADD CONSTRAINT "leads_stage_duplication_rules_target_stage_id_fkey" FOREIGN KEY ("target_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_stages_followups"
    ADD CONSTRAINT "leads_stages_followups_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_stages_followups"
    ADD CONSTRAINT "leads_stages_followups_leads_stages_id_fkey" FOREIGN KEY ("leads_stages_id") REFERENCES "public"."leads_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_stages_followups"
    ADD CONSTRAINT "leads_stages_followups_target_stage_id_fkey" FOREIGN KEY ("target_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_stages"
    ADD CONSTRAINT "leads_stages_leads_pipelines_id_fkey" FOREIGN KEY ("leads_pipelines_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_tags"
    ADD CONSTRAINT "leads_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."settings_users"("id");



ALTER TABLE ONLY "public"."leads_tags"
    ADD CONSTRAINT "leads_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_tags"
    ADD CONSTRAINT "leads_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."lead_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_teams_id_fkey" FOREIGN KEY ("teams_id") REFERENCES "public"."settings_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_updates"
    ADD CONSTRAINT "leads_updates_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_updates"
    ADD CONSTRAINT "leads_updates_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads_updates"
    ADD CONSTRAINT "leads_updates_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads_updates"
    ADD CONSTRAINT "leads_updates_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lgpd_anonymization_log"
    ADD CONSTRAINT "lgpd_anonymization_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lgpd_anonymization_log"
    ADD CONSTRAINT "lgpd_anonymization_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."crm_tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_pro_forms"
    ADD CONSTRAINT "lp_forms_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_pro_submissions"
    ADD CONSTRAINT "lp_submissions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_pro_submissions"
    ADD CONSTRAINT "lp_submissions_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_followup_queue"
    ADD CONSTRAINT "meeting_followup_queue_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_followup_queue"
    ADD CONSTRAINT "meeting_followup_queue_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_followup_queue"
    ADD CONSTRAINT "meeting_followup_queue_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_followup_queue"
    ADD CONSTRAINT "meeting_followup_queue_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."meetings_followups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_followup_queue"
    ADD CONSTRAINT "meeting_followup_queue_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_records"
    ADD CONSTRAINT "meeting_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_records"
    ADD CONSTRAINT "meeting_records_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings_followups"
    ADD CONSTRAINT "meetings_followups_whatsapp_template_id_fkey" FOREIGN KEY ("whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_teams_id_fkey" FOREIGN KEY ("teams_id") REFERENCES "public"."settings_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_buffer"
    ADD CONSTRAINT "message_buffer_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."ai_agents_execution_log"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "public"."leads_stages_followups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meta_lead_forms"
    ADD CONSTRAINT "meta_lead_forms_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."meta_lead_form_pages"("page_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_lead_forms"
    ADD CONSTRAINT "meta_lead_forms_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_read_by_fkey" FOREIGN KEY ("read_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."omni_delivery_dead_letter"
    ADD CONSTRAINT "omni_delivery_dead_letter_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_automations"
    ADD CONSTRAINT "schedule_automations_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_automations"
    ADD CONSTRAINT "schedule_automations_target_pipeline_id_fkey" FOREIGN KEY ("target_pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_automations"
    ADD CONSTRAINT "schedule_automations_target_stage_id_fkey" FOREIGN KEY ("target_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_category_items"
    ADD CONSTRAINT "score_category_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."score_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sends_contacts"
    ADD CONSTRAINT "sends_contacts_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sends_contacts"
    ADD CONSTRAINT "sends_contacts_send_id_fkey" FOREIGN KEY ("send_id") REFERENCES "public"."sends"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sends"
    ADD CONSTRAINT "sends_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sends_import_sessions"
    ADD CONSTRAINT "sends_import_sessions_send_id_fkey" FOREIGN KEY ("send_id") REFERENCES "public"."sends"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sends"
    ADD CONSTRAINT "sends_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sends"
    ADD CONSTRAINT "sends_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."settings_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sends"
    ADD CONSTRAINT "sends_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sends"
    ADD CONSTRAINT "sends_wa_channel_id_fkey" FOREIGN KEY ("wa_channel_id") REFERENCES "public"."settings_whatsapp_channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settings_audit_log"
    ADD CONSTRAINT "settings_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settings_omni_new_contact"
    ADD CONSTRAINT "settings_omni_new_contact_on_first_reply_stage_id_fkey" FOREIGN KEY ("on_first_reply_stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settings_omni_new_contact"
    ADD CONSTRAINT "settings_omni_new_contact_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settings_omni_new_contact"
    ADD CONSTRAINT "settings_omni_new_contact_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."leads_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settings_schedules"
    ADD CONSTRAINT "settings_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_teams_pipelines"
    ADD CONSTRAINT "settings_teams_pipelines_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_teams_pipelines"
    ADD CONSTRAINT "settings_teams_pipelines_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."settings_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_teams_tags"
    ADD CONSTRAINT "settings_teams_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."lead_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_teams_tags"
    ADD CONSTRAINT "settings_teams_tags_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."settings_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_users"
    ADD CONSTRAINT "settings_users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_users"
    ADD CONSTRAINT "settings_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."tenant_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settings_users_teams"
    ADD CONSTRAINT "settings_users_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."settings_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_users_teams"
    ADD CONSTRAINT "settings_users_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_api_keys"
    ADD CONSTRAINT "tenant_api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."settings_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_api_keys"
    ADD CONSTRAINT "tenant_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."crm_tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_role_permissions"
    ADD CONSTRAINT "tenant_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."tenant_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_calcom_connections"
    ADD CONSTRAINT "user_calcom_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_calendar_connections"
    ADD CONSTRAINT "user_calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."settings_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_people_id_fkey" FOREIGN KEY ("people_id") REFERENCES "public"."clients_people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhooks"
    ADD CONSTRAINT "webhooks_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."leads_pipelines"("id") ON DELETE SET NULL;



CREATE POLICY "Service role full access on conversion_events_queue" ON "public"."conversion_events_queue" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Super admin can read audit log" ON "public"."adm_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."super_admin" = true) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "System can insert audit log" ON "public"."adm_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can manage own conversion rules" ON "public"."conversion_event_rules" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own credentials" ON "public"."conversion_platform_credentials" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own stage mappings" ON "public"."conversion_stage_mappings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own conversion events" ON "public"."conversion_events_queue" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."_app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_meta_debug" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."action_token_consumed" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_token_service_role_only" ON "public"."action_token_consumed" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."adm_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adm_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adm_clients_super_admin" ON "public"."adm_clients" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."super_admin" = true) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."adm_migration_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adm_migration_runs_super_admin" ON "public"."adm_migration_runs" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."super_admin" = true) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."adm_migrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adm_migrations_super_admin" ON "public"."adm_migrations" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."super_admin" = true) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."adm_sync_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adm_sync_jobs_super_admin" ON "public"."adm_sync_jobs" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."super_admin" = true) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."adm_sync_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adm_sync_logs_super_admin" ON "public"."adm_sync_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."super_admin" = true) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "admins_delete_clients" ON "public"."clients_people" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "admins_delete_leads" ON "public"."leads" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "admins_manage_ai_agents" ON "public"."ai_agents" TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "admins_manage_ai_agents_history" ON "public"."ai_agents_history" TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "admins_manage_ai_agents_steps" ON "public"."ai_agents_steps" TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "admins_read_webhook_logs" ON "public"."webhook_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "admins_write_webhook_logs" ON "public"."webhook_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "agents_exec_log_select" ON "public"."ai_agents_execution_log" FOR SELECT TO "authenticated" USING ("public"."is_admin_or_manager"());



ALTER TABLE "public"."ai_agent_callback_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents_execution_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents_score_matrix" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agents_steps_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_callbacks_select_active_users" ON "public"."ai_agent_callback_configs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL)))));



CREATE POLICY "ai_callbacks_select_active_users" ON "public"."ai_scheduled_callbacks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL)))));



CREATE POLICY "ai_callbacks_service_role" ON "public"."ai_agent_callback_configs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "ai_callbacks_service_role" ON "public"."ai_scheduled_callbacks" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "ai_callbacks_write_managers" ON "public"."ai_agent_callback_configs" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "ai_callbacks_write_managers" ON "public"."ai_scheduled_callbacks" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "ai_providers_delete_admin" ON "public"."settings_ai_providers" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "ai_providers_insert_admin" ON "public"."settings_ai_providers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "ai_providers_select_admin" ON "public"."settings_ai_providers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "ai_providers_update_admin" ON "public"."settings_ai_providers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."ai_scheduled_callbacks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allow_anon_read_form_pro_forms" ON "public"."form_pro_forms" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_read_settings" ON "public"."settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_insert_deletion_requests" ON "public"."data_deletion_requests" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "auth_events_insert" ON "public"."auth_events_log" FOR INSERT TO "anon", "authenticated" WITH CHECK (true);



ALTER TABLE "public"."auth_events_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_events_select" ON "public"."auth_events_log" FOR SELECT TO "authenticated" USING ((("tenant_id" IS NULL) OR "public"."user_has_tenant_access"("tenant_id") OR (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid" = "tenant_id")));



ALTER TABLE "public"."auth_login_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_all" ON "public"."instagram_automation_log" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."instagram_automations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."schedule_automations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_can_manage_business_hours" ON "public"."settings_business_hours" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_delete" ON "public"."inbound_webhooks" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated_delete" ON "public"."messages" FOR DELETE USING (true);



CREATE POLICY "authenticated_full_access_deletion_requests" ON "public"."data_deletion_requests" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_insert" ON "public"."inbound_webhooks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated_insert" ON "public"."messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "authenticated_read" ON "public"."ai_agents_score_matrix" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."ai_agents_steps_history" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."clients_companies" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."clients_people_companies" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."clients_people_updates" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."leads_loss_reasons" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."leads_pipelines" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."leads_stages" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."leads_updates" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."messages" FOR SELECT USING (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."clients_people" "cp"
  WHERE (("cp"."id" = "messages"."people_id") AND ("cp"."created_by" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "messages"."people_id") AND ("l"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."leads" "l"
     JOIN "public"."settings_users_teams" "sut" ON (("sut"."team_id" = "l"."teams_id")))
  WHERE (("l"."people_id" = "messages"."people_id") AND ("sut"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "messages"."people_id") AND "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id"))))));



CREATE POLICY "authenticated_read" ON "public"."score_matrix" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."sends" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."sends_contacts" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."settings" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."settings_system_modules" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."settings_teams" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."settings_teams_pipelines" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."settings_users_teams" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."webhooks" FOR SELECT USING (true);



CREATE POLICY "authenticated_read" ON "public"."whatsapp_templates" FOR SELECT USING (true);



CREATE POLICY "authenticated_read_duplication_rules" ON "public"."leads_stage_duplication_rules" FOR SELECT USING (true);



CREATE POLICY "authenticated_select" ON "public"."inbound_webhooks" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated_update" ON "public"."inbound_webhooks" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated_update" ON "public"."messages" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."ai_agents_score_matrix" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."ai_agents_steps_history" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."clients_companies" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."clients_people_companies" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."clients_people_updates" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."leads_loss_reasons" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."leads_updates" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."score_matrix" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."sends" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."sends_contacts" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."settings_system_modules" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."settings_teams" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."settings_teams_pipelines" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."settings_users_teams" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."webhooks" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_write" ON "public"."whatsapp_templates" USING (true) WITH CHECK (true);



ALTER TABLE "public"."bi_ad_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_ad_accounts_delete" ON "public"."bi_ad_accounts" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "bi_ad_accounts_insert" ON "public"."bi_ad_accounts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "bi_ad_accounts_select" ON "public"."bi_ad_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bi_ad_accounts_update" ON "public"."bi_ad_accounts" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager"());



ALTER TABLE "public"."bi_ad_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_ad_campaigns_insert" ON "public"."bi_ad_campaigns" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "bi_ad_campaigns_select" ON "public"."bi_ad_campaigns" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bi_ad_daily_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_ad_daily_stats_insert" ON "public"."bi_ad_daily_stats" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "bi_ad_daily_stats_select" ON "public"."bi_ad_daily_stats" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bi_ad_spend" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_ad_spend_all" ON "public"."bi_ad_spend" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."bi_sdr_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_sdr_targets_delete" ON "public"."bi_sdr_targets" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "bi_sdr_targets_insert" ON "public"."bi_sdr_targets" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "bi_sdr_targets_select" ON "public"."bi_sdr_targets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "bi_sdr_targets_update" ON "public"."bi_sdr_targets" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."bi_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_settings_admin_only" ON "public"."bi_settings" TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "bi_settings_all" ON "public"."bi_settings" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."bi_tiktok_ad_spend" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bi_voice_session_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_voice_session_log_own_update" ON "public"."bi_voice_session_log" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "bi_voice_session_log_tenant_insert" ON "public"."bi_voice_session_log" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" IN ( SELECT "settings"."id"
   FROM "public"."settings"
 LIMIT 1)));



CREATE POLICY "bi_voice_session_log_tenant_select" ON "public"."bi_voice_session_log" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "settings"."id"
   FROM "public"."settings"
 LIMIT 1)));



ALTER TABLE "public"."bi_voice_token_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bi_voice_tool_invocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bi_voice_tool_invocations_tenant_insert" ON "public"."bi_voice_tool_invocations" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" IN ( SELECT "settings"."id"
   FROM "public"."settings"
 LIMIT 1)));



CREATE POLICY "bi_voice_tool_invocations_tenant_select" ON "public"."bi_voice_tool_invocations" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "settings"."id"
   FROM "public"."settings"
 LIMIT 1)));



CREATE POLICY "booking_jti_service_role_only" ON "public"."booking_token_jti_usage" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."booking_rule_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_rule_sets_anon_read" ON "public"."booking_rule_sets" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "booking_rule_sets_auth_all" ON "public"."booking_rule_sets" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("booking_rule_sets"."is_active" = true)))));



ALTER TABLE "public"."booking_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_rules_anon_read" ON "public"."booking_rules" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."booking_rule_sets"
  WHERE (("booking_rule_sets"."id" = "booking_rules"."rule_set_id") AND ("booking_rule_sets"."is_active" = true)))));



CREATE POLICY "booking_rules_auth_all" ON "public"."booking_rules" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("booking_rules"."is_active" = true)))));



ALTER TABLE "public"."booking_token_jti_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_connection_self" ON "public"."user_calendar_connections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND (("su"."id" = "user_calendar_connections"."user_id") OR ("su"."super_admin" = true) OR ("su"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("su"."active" = true)))));



ALTER TABLE "public"."canned_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "canned_responses_all" ON "public"."canned_responses" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."clients_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients_people_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients_people_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversion_event_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversion_events_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversion_platform_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversion_stage_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_tenants_select_own" ON "public"."crm_tenants" FOR SELECT TO "authenticated" USING (("id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."data_deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_export_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "data_export_jobs_insert" ON "public"."data_export_jobs" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_current_user_tenant_id"()));



CREATE POLICY "data_export_jobs_select" ON "public"."data_export_jobs" FOR SELECT TO "authenticated" USING ("public"."user_has_tenant_access"("tenant_id"));



ALTER TABLE "public"."elevenlabs_agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "elevenlabs_agents_delete" ON "public"."elevenlabs_agents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "elevenlabs_agents_insert" ON "public"."elevenlabs_agents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "elevenlabs_agents_select" ON "public"."elevenlabs_agents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "elevenlabs_agents_update" ON "public"."elevenlabs_agents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."elevenlabs_voices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "elevenlabs_voices_all" ON "public"."elevenlabs_voices" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_templates_select_active_users" ON "public"."email_templates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL)))));



CREATE POLICY "email_templates_service_role" ON "public"."email_templates" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "email_templates_write_managers" ON "public"."email_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND ("su"."deleted_at" IS NULL) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "exec_log_admin_all" ON "public"."ai_agents_execution_log" TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "exec_log_service_role_all" ON "public"."ai_agents_execution_log" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."followup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_pro_forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_pro_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_pro_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fup_queue_select" ON "public"."followup_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "fup_queue_write" ON "public"."followup_queue" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "fup_rules_select" ON "public"."leads_stages_followups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "fup_rules_write" ON "public"."leads_stages_followups" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "gestores_see_all_calcom" ON "public"."user_calcom_connections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = 'gestor'::"text"))))));



ALTER TABLE "public"."inbound_webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instagram_automation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instagram_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kiwify_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kiwify_event_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kiwify_lead_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kiwify_message_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kiwify_message_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiwify_select_active_users" ON "public"."kiwify_connections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true)))));



CREATE POLICY "kiwify_select_active_users" ON "public"."kiwify_event_mappings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true)))));



CREATE POLICY "kiwify_select_active_users" ON "public"."kiwify_lead_products" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true)))));



CREATE POLICY "kiwify_select_active_users" ON "public"."kiwify_message_automations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true)))));



CREATE POLICY "kiwify_select_active_users" ON "public"."kiwify_message_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true)))));



CREATE POLICY "kiwify_select_active_users" ON "public"."kiwify_webhook_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true)))));



CREATE POLICY "kiwify_service_role" ON "public"."kiwify_connections" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "kiwify_service_role" ON "public"."kiwify_event_mappings" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "kiwify_service_role" ON "public"."kiwify_lead_products" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "kiwify_service_role" ON "public"."kiwify_message_automations" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "kiwify_service_role" ON "public"."kiwify_message_jobs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "kiwify_service_role" ON "public"."kiwify_webhook_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."kiwify_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiwify_write_managers" ON "public"."kiwify_connections" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "kiwify_write_managers" ON "public"."kiwify_event_mappings" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "kiwify_write_managers" ON "public"."kiwify_lead_products" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "kiwify_write_managers" ON "public"."kiwify_message_automations" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "kiwify_write_managers" ON "public"."kiwify_message_jobs" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



CREATE POLICY "kiwify_write_managers" ON "public"."kiwify_webhook_events" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users" "su"
  WHERE (("su"."auth_user_id" = "auth"."uid"()) AND ("su"."active" = true) AND (("su"."super_admin" = true) OR ("su"."user_type" = 'manager'::"text"))))));



ALTER TABLE "public"."lead_field_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_field_definitions_delete" ON "public"."lead_field_definitions" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "lead_field_definitions_insert" ON "public"."lead_field_definitions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "lead_field_definitions_select" ON "public"."lead_field_definitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lead_field_definitions_update" ON "public"."lead_field_definitions" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



ALTER TABLE "public"."lead_field_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_field_values_delete" ON "public"."lead_field_values" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "lead_field_values_insert" ON "public"."lead_field_values" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "lead_field_values_select" ON "public"."lead_field_values" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lead_field_values_update" ON "public"."lead_field_values" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."lead_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_types_select" ON "public"."lead_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lead_types_write" ON "public"."lead_types" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."user_type" = ANY (ARRAY['manager'::"text", 'admin'::"text"])) AND ("settings_users"."active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."user_type" = ANY (ARRAY['manager'::"text", 'admin'::"text"])) AND ("settings_users"."active" = true)))));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_loss_reasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_pipelines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_stage_duplication_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_stages_followups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_tags_delete" ON "public"."leads_tags" FOR DELETE USING (("public"."tag_accessible_to_current_user"("tag_id") AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_tags"."lead_id") AND ("public"."is_admin_or_manager"() OR ("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id")))))));



CREATE POLICY "leads_tags_read" ON "public"."leads_tags" FOR SELECT USING (("public"."tag_accessible_to_current_user"("tag_id") AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE ("l"."id" = "leads_tags"."lead_id")))));



CREATE POLICY "leads_tags_write" ON "public"."leads_tags" FOR INSERT WITH CHECK (("public"."tag_accessible_to_current_user"("tag_id") AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_tags"."lead_id") AND ("public"."is_admin_or_manager"() OR ("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id")))))));



ALTER TABLE "public"."leads_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lgpd_anon_log_select" ON "public"."lgpd_anonymization_log" FOR SELECT TO "authenticated" USING ("public"."user_has_tenant_access"("tenant_id"));



ALTER TABLE "public"."lgpd_anonymization_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lp_forms_delete" ON "public"."form_pro_forms" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "lp_forms_insert" ON "public"."form_pro_forms" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "lp_forms_select" ON "public"."form_pro_forms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lp_forms_update" ON "public"."form_pro_forms" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "lp_submissions_delete" ON "public"."form_pro_submissions" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager"());



CREATE POLICY "lp_submissions_insert" ON "public"."form_pro_submissions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "lp_submissions_select" ON "public"."form_pro_submissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "managers_write_duplication_rules" ON "public"."leads_stage_duplication_rules" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "managers_write_pipelines" ON "public"."leads_pipelines" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "managers_write_stages" ON "public"."leads_stages" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "meet_fup_select" ON "public"."meetings_followups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "meet_fup_write" ON "public"."meetings_followups" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."meeting_followup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meeting_records_all" ON "public"."meeting_records" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings_followups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_buffer" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_buffer_service_role_only" ON "public"."message_buffer" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_lead_form_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meta_lead_form_pages_select" ON "public"."meta_lead_form_pages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "meta_lead_form_pages_service_delete" ON "public"."meta_lead_form_pages" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "meta_lead_form_pages_service_insert" ON "public"."meta_lead_form_pages" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "meta_lead_form_pages_service_update" ON "public"."meta_lead_form_pages" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."meta_lead_forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meta_lead_forms_delete" ON "public"."meta_lead_forms" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "meta_lead_forms_insert" ON "public"."meta_lead_forms" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "meta_lead_forms_select" ON "public"."meta_lead_forms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "meta_lead_forms_service_all" ON "public"."meta_lead_forms" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "meta_lead_forms_update" ON "public"."meta_lead_forms" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mfa_recovery_codes_delete_own" ON "public"."mfa_recovery_codes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "mfa_recovery_codes_select_own" ON "public"."mfa_recovery_codes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "mfq_insert" ON "public"."meeting_followup_queue" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "mfq_select" ON "public"."meeting_followup_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "mfq_write" ON "public"."meeting_followup_queue" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "notif_pref_all" ON "public"."user_notification_preferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete" ON "public"."notifications" FOR DELETE USING ("public"."is_admin_or_manager"());



CREATE POLICY "notifications_read" ON "public"."notifications" FOR SELECT USING (((("people_id" IS NOT NULL) AND "public"."person_conversation_accessible_to_current_user"("people_id")) OR (("target_user_id" IS NOT NULL) AND ("target_user_id" = "public"."get_current_settings_user_id"()))));



ALTER TABLE "public"."omni_channel_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "omni_channel_alerts_read" ON "public"."omni_channel_alerts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."omni_channel_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "omni_channel_configs_read" ON "public"."omni_channel_configs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "omni_channel_configs_write" ON "public"."omni_channel_configs" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "omni_dead_letter_read" ON "public"."omni_delivery_dead_letter" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "omni_dead_letter_update" ON "public"."omni_delivery_dead_letter" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."omni_delivery_dead_letter" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."omni_outbound_webhooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "omni_outbound_webhooks_auth_users" ON "public"."omni_outbound_webhooks" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."schedule_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."score_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "score_categories_read" ON "public"."score_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "score_categories_write" ON "public"."score_categories" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."score_category_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "score_category_items_read" ON "public"."score_category_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "score_category_items_write" ON "public"."score_category_items" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."score_matrix" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."score_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "score_settings_all" ON "public"."score_settings" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."secret_access_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "secret_access_log_insert" ON "public"."secret_access_log" FOR INSERT TO "service_role" WITH CHECK (true);



ALTER TABLE "public"."sends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sends_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sends_import_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_calcom" ON "public"."user_calcom_connections" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_only" ON "public"."form_pro_rate_limits" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_ai_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_audit_log_service_insert" ON "public"."settings_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "settings_audit_log_tenant_read" ON "public"."settings_audit_log" FOR SELECT USING (("tenant_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."settings_business_hours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_delete" ON "public"."settings" FOR DELETE TO "authenticated" USING (true);



ALTER TABLE "public"."settings_elevenlabs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_elevenlabs_delete" ON "public"."settings_elevenlabs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "settings_elevenlabs_insert" ON "public"."settings_elevenlabs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "settings_elevenlabs_select" ON "public"."settings_elevenlabs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "settings_elevenlabs_update" ON "public"."settings_elevenlabs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



CREATE POLICY "settings_insert" ON "public"."settings" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."settings_omni_new_contact" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_omni_new_contact_select" ON "public"."settings_omni_new_contact" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "settings_omni_new_contact_write" ON "public"."settings_omni_new_contact" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."super_admin" = true) OR ("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL)))));



ALTER TABLE "public"."settings_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_system_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_teams_pipelines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_teams_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_update_with_bi_voice_guard" ON "public"."settings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (((NOT ("bi_voice_chat_beta_enabled" IS DISTINCT FROM ( SELECT "s"."bi_voice_chat_beta_enabled"
   FROM "public"."settings" "s"
  WHERE ("s"."id" = "settings"."id")
 LIMIT 1))) OR "public"."check_bi_voice_beta_update"()));



ALTER TABLE "public"."settings_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_users_delete_admin_only" ON "public"."settings_users" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "settings_users_insert_admin_only" ON "public"."settings_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "settings_users_select_authenticated" ON "public"."settings_users" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."settings_users_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_users_update_owner_or_admin" ON "public"."settings_users" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR ("auth_user_id" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR (("auth_user_id" = "auth"."uid"()) AND ("super_admin" IS NOT TRUE) AND ("user_type" IS DISTINCT FROM 'admin'::"text"))));



ALTER TABLE "public"."settings_whatsapp_channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_read" ON "public"."lead_tags" FOR SELECT USING (("public"."is_admin_or_manager"() OR "public"."tag_accessible_to_current_user"("id")));



CREATE POLICY "tags_write" ON "public"."lead_tags" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "team_tags_read" ON "public"."settings_teams_tags" FOR SELECT USING (true);



CREATE POLICY "team_tags_write" ON "public"."settings_teams_tags" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "tenant_access" ON "public"."bi_tiktok_ad_spend" USING (true);



CREATE POLICY "tenant_access" ON "public"."sends_import_sessions" USING (true);



ALTER TABLE "public"."tenant_api_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_api_keys_delete" ON "public"."tenant_api_keys" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_current_user_tenant_id"()));



CREATE POLICY "tenant_api_keys_insert" ON "public"."tenant_api_keys" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_current_user_tenant_id"()));



CREATE POLICY "tenant_api_keys_select" ON "public"."tenant_api_keys" FOR SELECT TO "authenticated" USING ("public"."user_has_tenant_access"("tenant_id"));



CREATE POLICY "tenant_api_keys_update" ON "public"."tenant_api_keys" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_current_user_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_current_user_tenant_id"()));



ALTER TABLE "public"."tenant_role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_role_permissions_gestor_write" ON "public"."tenant_role_permissions" USING (((EXISTS ( SELECT 1
   FROM "public"."tenant_roles" "tr"
  WHERE (("tr"."id" = "tenant_role_permissions"."role_id") AND ("tr"."tenant_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid") AND ("tr"."is_system" = false)))) AND (EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("settings_users"."super_admin" = true)) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))));



CREATE POLICY "tenant_role_permissions_read" ON "public"."tenant_role_permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_roles" "tr"
  WHERE (("tr"."id" = "tenant_role_permissions"."role_id") AND ("tr"."tenant_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid")))));



ALTER TABLE "public"."tenant_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_roles_gestor_write" ON "public"."tenant_roles" USING ((("tenant_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid") AND (EXISTS ( SELECT 1
   FROM "public"."settings_users"
  WHERE (("settings_users"."auth_user_id" = "auth"."uid"()) AND (("settings_users"."user_type" = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("settings_users"."super_admin" = true)) AND ("settings_users"."active" = true) AND ("settings_users"."deleted_at" IS NULL))))));



CREATE POLICY "tenant_roles_read" ON "public"."tenant_roles" FOR SELECT USING (("tenant_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."user_calcom_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_calendar_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete_own_schedules" ON "public"."settings_schedules" FOR DELETE TO "authenticated" USING ((("user_id" = "public"."get_current_settings_user_id"()) OR "public"."is_admin_or_manager"()));



CREATE POLICY "users_insert_clients" ON "public"."clients_people" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "users_insert_leads" ON "public"."leads" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "users_insert_schedules" ON "public"."settings_schedules" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "public"."get_current_settings_user_id"()) OR "public"."is_admin_or_manager"()));



CREATE POLICY "users_manage_lead_files" ON "public"."leads_files" TO "authenticated" USING (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_files"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))))))))) WITH CHECK (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_files"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"())))))))));



CREATE POLICY "users_manage_lead_notes" ON "public"."leads_notes" TO "authenticated" USING (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_notes"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))))))))) WITH CHECK (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_notes"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"())))))))));



CREATE POLICY "users_manage_own_meetings" ON "public"."meetings" USING (("public"."is_admin_or_manager"() OR ("user_id" = "public"."get_current_settings_user_id"()) OR ("teams_id" IN ( SELECT "settings_users_teams"."team_id"
   FROM "public"."settings_users_teams"
  WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "meetings"."lead_id") AND "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id")))))) WITH CHECK (("public"."is_admin_or_manager"() OR ("user_id" = "public"."get_current_settings_user_id"()) OR ("teams_id" IN ( SELECT "settings_users_teams"."team_id"
   FROM "public"."settings_users_teams"
  WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "meetings"."lead_id") AND "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id"))))));



CREATE POLICY "users_own_calcom_connection" ON "public"."user_calcom_connections" USING (("user_id" IN ( SELECT "settings_users"."id"
   FROM "public"."settings_users"
  WHERE ("settings_users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "users_read_active_agent_steps" ON "public"."ai_agents_steps" FOR SELECT TO "authenticated" USING ((("active" = true) OR "public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."ai_agents" "a"
  WHERE (("a"."id" = "ai_agents_steps"."ai_agent_id") AND ("a"."active" = true))))));



CREATE POLICY "users_read_active_agents" ON "public"."ai_agents" FOR SELECT TO "authenticated" USING ((("active" = true) OR "public"."is_admin_or_manager"()));



CREATE POLICY "users_read_lead_files" ON "public"."leads_files" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_files"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"())))))))));



CREATE POLICY "users_read_lead_notes" ON "public"."leads_notes" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "leads_notes"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"())))))))));



CREATE POLICY "users_read_own_clients" ON "public"."clients_people" FOR SELECT USING (("public"."is_admin_or_manager"() OR ("created_by" = "public"."get_current_settings_user_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "clients_people"."id") AND ("l"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."leads" "l"
     JOIN "public"."settings_users_teams" "sut" ON (("sut"."team_id" = "l"."teams_id")))
  WHERE (("l"."people_id" = "clients_people"."id") AND ("sut"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "clients_people"."id") AND "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id"))))));



CREATE POLICY "users_read_own_leads" ON "public"."leads" FOR SELECT USING (("public"."is_admin_or_manager"() OR ("user_id" = "public"."get_current_settings_user_id"()) OR ("teams_id" IN ( SELECT "settings_users_teams"."team_id"
   FROM "public"."settings_users_teams"
  WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR "public"."lead_pipeline_accessible_to_current_user"("leads_pipelines_id")));



CREATE POLICY "users_read_own_meetings" ON "public"."meetings" FOR SELECT USING (("public"."is_admin_or_manager"() OR ("user_id" = "public"."get_current_settings_user_id"()) OR ("teams_id" IN ( SELECT "settings_users_teams"."team_id"
   FROM "public"."settings_users_teams"
  WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "meetings"."lead_id") AND (("l"."user_id" = "public"."get_current_settings_user_id"()) OR ("l"."teams_id" IN ( SELECT "settings_users_teams"."team_id"
           FROM "public"."settings_users_teams"
          WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id")))))));



CREATE POLICY "users_read_own_schedules" ON "public"."settings_schedules" FOR SELECT TO "authenticated" USING ((("user_id" = "public"."get_current_settings_user_id"()) OR "public"."is_admin_or_manager"()));



CREATE POLICY "users_select_all_authenticated" ON "public"."settings_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "users_update_own_clients" ON "public"."clients_people" FOR UPDATE USING (("public"."is_admin_or_manager"() OR ("created_by" = "public"."get_current_settings_user_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "clients_people"."id") AND ("l"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."leads" "l"
     JOIN "public"."settings_users_teams" "sut" ON (("sut"."team_id" = "l"."teams_id")))
  WHERE (("l"."people_id" = "clients_people"."id") AND ("sut"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "clients_people"."id") AND "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id")))))) WITH CHECK (("public"."is_admin_or_manager"() OR ("created_by" = "public"."get_current_settings_user_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "clients_people"."id") AND ("l"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."leads" "l"
     JOIN "public"."settings_users_teams" "sut" ON (("sut"."team_id" = "l"."teams_id")))
  WHERE (("l"."people_id" = "clients_people"."id") AND ("sut"."user_id" = "public"."get_current_settings_user_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."people_id" = "clients_people"."id") AND "public"."lead_pipeline_accessible_to_current_user"("l"."leads_pipelines_id"))))));



CREATE POLICY "users_update_own_leads" ON "public"."leads" FOR UPDATE USING (("public"."is_admin_or_manager"() OR ("user_id" = "public"."get_current_settings_user_id"()) OR ("teams_id" IN ( SELECT "settings_users_teams"."team_id"
   FROM "public"."settings_users_teams"
  WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR "public"."lead_pipeline_accessible_to_current_user"("leads_pipelines_id"))) WITH CHECK (("public"."is_admin_or_manager"() OR ("user_id" = "public"."get_current_settings_user_id"()) OR ("teams_id" IN ( SELECT "settings_users_teams"."team_id"
   FROM "public"."settings_users_teams"
  WHERE ("settings_users_teams"."user_id" = "public"."get_current_settings_user_id"()))) OR "public"."lead_pipeline_accessible_to_current_user"("leads_pipelines_id")));



CREATE POLICY "users_update_own_schedules" ON "public"."settings_schedules" FOR UPDATE TO "authenticated" USING ((("user_id" = "public"."get_current_settings_user_id"()) OR "public"."is_admin_or_manager"())) WITH CHECK ((("user_id" = "public"."get_current_settings_user_id"()) OR "public"."is_admin_or_manager"()));



CREATE POLICY "wa_channels_admin_all" ON "public"."settings_whatsapp_channels" TO "authenticated" USING ("public"."is_admin_or_manager"()) WITH CHECK ("public"."is_admin_or_manager"());



CREATE POLICY "wa_channels_authenticated_read" ON "public"."settings_whatsapp_channels" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_templates" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_lead_to_pipeline"("p_lead_id" "uuid", "p_target_pipeline_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_lead_to_pipeline"("p_lead_id" "uuid", "p_target_pipeline_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_lead_to_pipeline"("p_lead_id" "uuid", "p_target_pipeline_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."adm_client_decrypted_secrets"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."adm_client_decrypted_secrets"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adm_client_decrypted_secrets"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."adm_clients_secrets_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."adm_clients_secrets_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."adm_clients_secrets_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."adm_clients_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."adm_clients_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."adm_clients_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."adm_timeout_stuck_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."adm_timeout_stuck_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."adm_timeout_stuck_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_watchdog"() TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_watchdog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_watchdog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."anonymize_person"("p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."anonymize_person"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anonymize_person"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."app_decrypt_secret"("p_encrypted" "text", "p_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."app_decrypt_secret"("p_encrypted" "text", "p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_decrypt_secret"("p_encrypted" "text", "p_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."app_encrypt_secret"("p_value" "text", "p_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."app_encrypt_secret"("p_value" "text", "p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_encrypt_secret"("p_value" "text", "p_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."append_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_new_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."append_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_new_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_new_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_booking_rule_set_url_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_booking_rule_set_url_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_booking_rule_set_url_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_lead_round_robin"("p_lead_id" "uuid", "p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_lead_round_robin"("p_lead_id" "uuid", "p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_lead_round_robin"("p_lead_id" "uuid", "p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_value"("col_name" "text", "val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."audit_value"("col_name" "text", "val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_value"("col_name" "text", "val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_pause_ai_on_human_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_pause_ai_on_human_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_pause_ai_on_human_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_user_id" "uuid", "p_title" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_user_id" "uuid", "p_title" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_user_id" "uuid", "p_title" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_rule_set_id" "uuid", "p_duration" integer, "p_notes" "text", "p_exclude_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_rule_set_id" "uuid", "p_duration" integer, "p_notes" "text", "p_exclude_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."book_meeting"("p_lead_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_rule_set_id" "uuid", "p_duration" integer, "p_notes" "text", "p_exclude_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_clients_people_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_clients_people_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_clients_people_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_bi_voice_beta_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_bi_voice_beta_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_bi_voice_beta_update"() TO "service_role";



GRANT ALL ON TABLE "public"."followup_queue" TO "anon";
GRANT ALL ON TABLE "public"."followup_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_queue" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_followup_queue_batch"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_followup_queue_batch"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_followup_queue_batch"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_pending_messages"("p_batch_size" integer, "p_max_age_hours" integer, "p_people_id" "uuid", "p_channel" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_pending_messages"("p_batch_size" integer, "p_max_age_hours" integer, "p_people_id" "uuid", "p_channel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_messages"("p_batch_size" integer, "p_max_age_hours" integer, "p_people_id" "uuid", "p_channel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_messages"("p_batch_size" integer, "p_max_age_hours" integer, "p_people_id" "uuid", "p_channel" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_agent_history"("p_agent_id" "uuid", "p_keep_versions" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_agent_history"("p_agent_id" "uuid", "p_keep_versions" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_agent_history"("p_agent_id" "uuid", "p_keep_versions" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_auth_login_attempts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_auth_login_attempts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_auth_login_attempts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_bi_voice_token_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_bi_voice_token_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_bi_voice_token_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_tenant_user"("p_email" "text", "p_password" "text", "p_name" "text", "p_phone" "text", "p_user_type" "text", "p_super_admin" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_tenant_user"("p_email" "text", "p_password" "text", "p_name" "text", "p_phone" "text", "p_user_type" "text", "p_super_admin" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tenant_user"("p_email" "text", "p_password" "text", "p_name" "text", "p_phone" "text", "p_user_type" "text", "p_super_admin" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_elevenlabs_key"("encrypted_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_elevenlabs_key"("encrypted_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_elevenlabs_key"("encrypted_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_ai_on_atendimento_humano"() TO "anon";
GRANT ALL ON FUNCTION "public"."disable_ai_on_atendimento_humano"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_ai_on_atendimento_humano"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_new_lead_webhooks"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_new_lead_webhooks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_new_lead_webhooks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_lead_on_stage_enter"() TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_lead_on_stage_enter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_lead_on_stage_enter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_elevenlabs_key"("key_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_elevenlabs_key"("key_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_elevenlabs_key"("key_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_duplicate_person"("p_exclude_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_document" "text", "p_instagram_user_id" "text", "p_instagram_handle" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_duplicate_person"("p_exclude_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_document" "text", "p_instagram_user_id" "text", "p_instagram_handle" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_duplicate_person"("p_exclude_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_document" "text", "p_instagram_user_id" "text", "p_instagram_handle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_duplicate_person"("p_exclude_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_document" "text", "p_instagram_user_id" "text", "p_instagram_handle" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_queue_conversion_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_queue_conversion_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_queue_conversion_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_queue_conversion_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_queue_conversion_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_queue_conversion_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_schedule_automation_on_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_schedule_automation_on_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_schedule_automation_on_status_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_active_ai_provider_key"("p_provider" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_ai_provider_key"("p_provider" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_slots"("p_user_id" "uuid", "p_date" "date", "p_period" "text", "p_slot_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_user_id" "uuid", "p_date" "date", "p_period" "text", "p_slot_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_user_id" "uuid", "p_date" "date", "p_period" "text", "p_slot_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid", "p_pipeline_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid", "p_pipeline_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_eligible_user_ids"("p_rule_set_id" "uuid", "p_pipeline_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booking_session"("p_lead_id" "uuid", "p_rule_set_id" "uuid", "p_duration" integer, "p_days_ahead" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_booking_session"("p_lead_id" "uuid", "p_rule_set_id" "uuid", "p_duration" integer, "p_days_ahead" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_session"("p_lead_id" "uuid", "p_rule_set_id" "uuid", "p_duration" integer, "p_days_ahead" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_settings_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_settings_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_settings_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_insights_context"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_pipeline_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_insights_context"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_pipeline_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_insights_context"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_pipeline_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_omni_contacts"("p_search_term" "text", "p_status_atend" "text", "p_atend_ia" "text", "p_filtro_data" "text", "p_responsavel" "text", "p_pipeline" "text", "p_etapa" "text", "p_time" "text", "p_limit" integer, "p_offset" integer, "p_tag" "text", "p_channel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_omni_contacts"("p_search_term" "text", "p_status_atend" "text", "p_atend_ia" "text", "p_filtro_data" "text", "p_responsavel" "text", "p_pipeline" "text", "p_etapa" "text", "p_time" "text", "p_limit" integer, "p_offset" integer, "p_tag" "text", "p_channel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_omni_contacts"("p_search_term" "text", "p_status_atend" "text", "p_atend_ia" "text", "p_filtro_data" "text", "p_responsavel" "text", "p_pipeline" "text", "p_etapa" "text", "p_time" "text", "p_limit" integer, "p_offset" integer, "p_tag" "text", "p_channel" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_meeting_followup_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_meeting_followup_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_meeting_followup_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."import_pessoa_with_flexible_lead"("pessoa_data" "jsonb", "pipeline_id_param" "uuid", "tenant_id_param" "uuid", "modo_operacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."import_pessoa_with_flexible_lead"("pessoa_data" "jsonb", "pipeline_id_param" "uuid", "tenant_id_param" "uuid", "modo_operacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_pessoa_with_flexible_lead"("pessoa_data" "jsonb", "pipeline_id_param" "uuid", "tenant_id_param" "uuid", "modo_operacao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_field"("table_name" "text", "field_name" "text", "row_id" "uuid", "increment_by" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_field"("table_name" "text", "field_name" "text", "row_id" "uuid", "increment_by" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_field"("table_name" "text", "field_name" "text", "row_id" "uuid", "increment_by" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_gestor"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_gestor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_gestor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_sensitive_column"("col_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_sensitive_column"("col_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_sensitive_column"("col_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lead_pipeline_accessible_to_current_user"("p_leads_pipelines_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."lead_pipeline_accessible_to_current_user"("p_leads_pipelines_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lead_pipeline_accessible_to_current_user"("p_leads_pipelines_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_pipeline_to_kiwify_product"("p_pipeline_id" "uuid", "p_product_id" "text", "p_product_name" "text", "p_move_existing_leads" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."link_pipeline_to_kiwify_product"("p_pipeline_id" "uuid", "p_product_id" "text", "p_product_name" "text", "p_move_existing_leads" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_pipeline_to_kiwify_product"("p_pipeline_id" "uuid", "p_product_id" "text", "p_product_name" "text", "p_move_existing_leads" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_people_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_people_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_people_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."merge_persons"("p_canonical_id" "uuid", "p_duplicate_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."merge_persons"("p_canonical_id" "uuid", "p_duplicate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_persons"("p_canonical_id" "uuid", "p_duplicate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_persons"("p_canonical_id" "uuid", "p_duplicate_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mfa_recovery_consume"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mfa_recovery_consume"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mfa_recovery_consume"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mfa_recovery_consume"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mfa_recovery_generate"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mfa_recovery_generate"() TO "anon";
GRANT ALL ON FUNCTION "public"."mfa_recovery_generate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mfa_recovery_generate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."move_lead_to_stage"("p_lead_id" "uuid", "p_stage_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."move_lead_to_stage"("p_lead_id" "uuid", "p_stage_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_lead_to_stage"("p_lead_id" "uuid", "p_stage_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_closer_on_meeting_scheduled"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_closer_on_meeting_scheduled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_closer_on_meeting_scheduled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_lead_stage_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_lead_stage_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_lead_stage_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."person_conversation_accessible_to_current_user"("p_people_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."person_conversation_accessible_to_current_user"("p_people_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."person_conversation_accessible_to_current_user"("p_people_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_message_buffer"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_message_buffer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_message_buffer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_message_status_to_sends"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_message_status_to_sends"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_message_status_to_sends"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalc_unread_count"("p_people_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalc_unread_count"("p_people_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_stale_ai_locks"() TO "anon";
GRANT ALL ON FUNCTION "public"."release_stale_ai_locks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_stale_ai_locks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_leads_stage"("p_stage_id" "uuid", "p_pipeline_id" "uuid", "p_new_position" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_leads_stage"("p_stage_id" "uuid", "p_pipeline_id" "uuid", "p_new_position" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_leads_stage"("p_stage_id" "uuid", "p_pipeline_id" "uuid", "p_new_position" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_stale_sending_messages"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_stale_sending_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_stale_sending_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_stale_sending_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_agent_version"("p_agent_id" "uuid", "p_history_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_agent_version"("p_agent_id" "uuid", "p_history_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_agent_version"("p_agent_id" "uuid", "p_history_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_agent_complete"("p_agent_id" "uuid", "p_agent_data" "jsonb", "p_steps_data" "jsonb", "p_changelog" "jsonb", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."save_agent_complete"("p_agent_id" "uuid", "p_agent_data" "jsonb", "p_steps_data" "jsonb", "p_changelog" "jsonb", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_agent_complete"("p_agent_id" "uuid", "p_agent_data" "jsonb", "p_steps_data" "jsonb", "p_changelog" "jsonb", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."score_settings_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."score_settings_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."score_settings_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."secure_http_post"("secret_name" "text", "url" "text", "body" "jsonb", "caller_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."secure_http_post"("secret_name" "text", "url" "text", "body" "jsonb", "caller_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."secure_http_post"("secret_name" "text", "url" "text", "body" "jsonb", "caller_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_tenant_roles"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_tenant_roles"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_tenant_roles"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_adm_clients_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_adm_clients_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_adm_clients_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_lead_email"("p_lead_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_booking_lead_email"("p_lead_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_booking_lead_email"("p_lead_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_dead_letter_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_dead_letter_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_dead_letter_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_elevenlabs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_elevenlabs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_elevenlabs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_instagram_automation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_instagram_automation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_instagram_automation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_omni_channel_configs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_omni_channel_configs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_omni_channel_configs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_omni_outbound_webhooks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_omni_outbound_webhooks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_omni_outbound_webhooks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_schedule_automation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_schedule_automation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_schedule_automation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."settings_ai_providers_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."settings_ai_providers_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."settings_ai_providers_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."settings_audit_trigger_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."settings_audit_trigger_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."settings_audit_trigger_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."settings_users_set_mfa_grace"() TO "anon";
GRANT ALL ON FUNCTION "public"."settings_users_set_mfa_grace"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."settings_users_set_mfa_grace"() TO "service_role";



GRANT ALL ON FUNCTION "public"."settings_users_sync_admin_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."settings_users_sync_admin_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."settings_users_sync_admin_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."settings_whatsapp_channels_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."settings_whatsapp_channels_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."settings_whatsapp_channels_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."site_lead_gate_create_lead"("p_name" "text", "p_whatsapp" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_lead_source" "text", "p_utm_source" "text", "p_utm_medium" "text", "p_utm_campaign" "text", "p_utm_content" "text", "p_utm_term" "text", "p_description" "text") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."sync_active_channel_from_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_active_channel_from_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_active_channel_from_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_custom_domain_to_adm"("p_tenant_id" "uuid", "p_custom_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_custom_domain_to_adm"("p_tenant_id" "uuid", "p_custom_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_custom_domain_to_adm"("p_tenant_id" "uuid", "p_custom_domain" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_service_role_from_vault"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_service_role_from_vault"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_service_role_from_vault"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_service_role_from_vault"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tag_accessible_to_current_user"("p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."tag_accessible_to_current_user"("p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tag_accessible_to_current_user"("p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."track_leads_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_leads_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_leads_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_advance_stage_on_first_ai_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_advance_stage_on_first_ai_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_advance_stage_on_first_ai_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_auto_merge_on_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_auto_merge_on_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_auto_merge_on_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_cleanup_agent_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_cleanup_agent_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_cleanup_agent_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_ai_on_buffer_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_ai_on_buffer_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_ai_on_buffer_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_followup_retry_worker"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_followup_retry_worker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_followup_retry_worker"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_followup_worker"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_followup_worker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_followup_worker"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_fwup01_smoke_test"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_fwup01_smoke_test"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_fwup01_smoke_test"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_fwup01_smoke_test"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_google_calendar_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_google_calendar_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_google_calendar_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_instagram_token_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_instagram_token_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_instagram_token_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_omni_channel_health_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_omni_channel_health_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_omni_channel_health_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_omni_delivery_engine"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_omni_delivery_engine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_omni_delivery_engine"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_omni_retry_dead_letter"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_omni_retry_dead_letter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_omni_retry_dead_letter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_meeting_followups"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_meeting_followups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_meeting_followups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sends_dispatch_batch"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sends_dispatch_batch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sends_dispatch_batch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_zoom_token_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_zoom_token_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_zoom_token_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlink_pipeline_kiwify_product"("p_pipeline_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unlink_pipeline_kiwify_product"("p_pipeline_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlink_pipeline_kiwify_product"("p_pipeline_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bi_ad_tables_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bi_ad_tables_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bi_ad_tables_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bi_sdr_targets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bi_sdr_targets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bi_sdr_targets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lp_tables_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lp_tables_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lp_tables_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_status" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_status" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_status" "text", "p_start_ts" timestamp with time zone, "p_duration_minutes" integer, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_qualification_field"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_qualification_field"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_qualification_field"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sends_import_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sends_import_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sends_import_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_crm_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_field_value"("p_person_id" "uuid", "p_field_key" "text", "p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_tenant_access"("target_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_tenant_access"("target_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_tenant_access"("target_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_stage_ids"("p_stage_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_stage_ids"("p_stage_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_stage_ids"("p_stage_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."_app_config" TO "anon";
GRANT ALL ON TABLE "public"."_app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."_app_config" TO "service_role";



GRANT ALL ON TABLE "public"."_meta_debug" TO "anon";
GRANT ALL ON TABLE "public"."_meta_debug" TO "authenticated";
GRANT ALL ON TABLE "public"."_meta_debug" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_meta_debug_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_meta_debug_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_meta_debug_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."action_token_consumed" TO "anon";
GRANT ALL ON TABLE "public"."action_token_consumed" TO "authenticated";
GRANT ALL ON TABLE "public"."action_token_consumed" TO "service_role";



GRANT ALL ON TABLE "public"."adm_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."adm_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."adm_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."adm_clients" TO "anon";
GRANT ALL ON TABLE "public"."adm_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."adm_clients" TO "service_role";



GRANT ALL ON TABLE "public"."adm_migration_runs" TO "anon";
GRANT ALL ON TABLE "public"."adm_migration_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."adm_migration_runs" TO "service_role";



GRANT ALL ON TABLE "public"."adm_migrations" TO "anon";
GRANT ALL ON TABLE "public"."adm_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."adm_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."adm_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."adm_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."adm_sync_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."adm_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."adm_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."adm_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agent_callback_configs" TO "anon";
GRANT ALL ON TABLE "public"."ai_agent_callback_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agent_callback_configs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents_execution_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents_execution_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents_execution_log" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents_history" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents_history" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents_score_matrix" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents_score_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents_score_matrix" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents_steps" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents_steps" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents_steps_history" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents_steps_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents_steps_history" TO "service_role";



GRANT ALL ON TABLE "public"."ai_scheduled_callbacks" TO "anon";
GRANT ALL ON TABLE "public"."ai_scheduled_callbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_scheduled_callbacks" TO "service_role";



GRANT ALL ON TABLE "public"."auth_events_log" TO "anon";
GRANT ALL ON TABLE "public"."auth_events_log" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_events_log" TO "service_role";



GRANT ALL ON TABLE "public"."auth_login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."auth_login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."bi_ad_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bi_ad_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_ad_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."bi_ad_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."bi_ad_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_ad_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."bi_ad_daily_stats" TO "anon";
GRANT ALL ON TABLE "public"."bi_ad_daily_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_ad_daily_stats" TO "service_role";



GRANT ALL ON TABLE "public"."bi_ad_spend" TO "anon";
GRANT ALL ON TABLE "public"."bi_ad_spend" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_ad_spend" TO "service_role";



GRANT ALL ON TABLE "public"."bi_sdr_targets" TO "anon";
GRANT ALL ON TABLE "public"."bi_sdr_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_sdr_targets" TO "service_role";



GRANT ALL ON TABLE "public"."bi_settings" TO "anon";
GRANT ALL ON TABLE "public"."bi_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_settings" TO "service_role";



GRANT ALL ON TABLE "public"."bi_tiktok_ad_spend" TO "anon";
GRANT ALL ON TABLE "public"."bi_tiktok_ad_spend" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_tiktok_ad_spend" TO "service_role";



GRANT ALL ON TABLE "public"."bi_voice_session_log" TO "anon";
GRANT ALL ON TABLE "public"."bi_voice_session_log" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_voice_session_log" TO "service_role";



GRANT ALL ON TABLE "public"."bi_voice_token_log" TO "anon";
GRANT ALL ON TABLE "public"."bi_voice_token_log" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_voice_token_log" TO "service_role";



GRANT ALL ON TABLE "public"."bi_voice_tool_invocations" TO "anon";
GRANT ALL ON TABLE "public"."bi_voice_tool_invocations" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_voice_tool_invocations" TO "service_role";



GRANT ALL ON TABLE "public"."booking_rule_sets" TO "anon";
GRANT ALL ON TABLE "public"."booking_rule_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_rule_sets" TO "service_role";



GRANT ALL ON TABLE "public"."booking_rules" TO "anon";
GRANT ALL ON TABLE "public"."booking_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_rules" TO "service_role";



GRANT ALL ON TABLE "public"."booking_token_jti_usage" TO "anon";
GRANT ALL ON TABLE "public"."booking_token_jti_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_token_jti_usage" TO "service_role";



GRANT ALL ON TABLE "public"."canned_responses" TO "anon";
GRANT ALL ON TABLE "public"."canned_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."canned_responses" TO "service_role";



GRANT ALL ON TABLE "public"."clients_companies" TO "anon";
GRANT ALL ON TABLE "public"."clients_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."clients_companies" TO "service_role";



GRANT ALL ON TABLE "public"."clients_people" TO "anon";
GRANT ALL ON TABLE "public"."clients_people" TO "authenticated";
GRANT ALL ON TABLE "public"."clients_people" TO "service_role";



GRANT ALL ON TABLE "public"."clients_people_companies" TO "anon";
GRANT ALL ON TABLE "public"."clients_people_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."clients_people_companies" TO "service_role";



GRANT ALL ON TABLE "public"."clients_people_updates" TO "anon";
GRANT ALL ON TABLE "public"."clients_people_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."clients_people_updates" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_event_rules" TO "anon";
GRANT ALL ON TABLE "public"."conversion_event_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_event_rules" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_events_queue" TO "anon";
GRANT ALL ON TABLE "public"."conversion_events_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_events_queue" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_platform_credentials" TO "anon";
GRANT ALL ON TABLE "public"."conversion_platform_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_platform_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_stage_mappings" TO "anon";
GRANT ALL ON TABLE "public"."conversion_stage_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_stage_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."crm_tenants" TO "anon";
GRANT ALL ON TABLE "public"."crm_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_tenants" TO "service_role";



GRANT ALL ON TABLE "public"."data_deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."data_export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."data_export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."data_export_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."elevenlabs_agents" TO "anon";
GRANT ALL ON TABLE "public"."elevenlabs_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."elevenlabs_agents" TO "service_role";



GRANT ALL ON TABLE "public"."elevenlabs_voices" TO "anon";
GRANT ALL ON TABLE "public"."elevenlabs_voices" TO "authenticated";
GRANT ALL ON TABLE "public"."elevenlabs_voices" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."followup_queue_legacy" TO "anon";
GRANT ALL ON TABLE "public"."followup_queue_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_queue_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."form_pro_forms" TO "anon";
GRANT ALL ON TABLE "public"."form_pro_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."form_pro_forms" TO "service_role";



GRANT ALL ON TABLE "public"."form_pro_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."form_pro_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."form_pro_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."form_pro_submissions" TO "anon";
GRANT ALL ON TABLE "public"."form_pro_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_pro_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."inbound_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."instagram_automation_log" TO "anon";
GRANT ALL ON TABLE "public"."instagram_automation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."instagram_automation_log" TO "service_role";



GRANT ALL ON TABLE "public"."instagram_automations" TO "anon";
GRANT ALL ON TABLE "public"."instagram_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."instagram_automations" TO "service_role";



GRANT ALL ON TABLE "public"."kiwify_connections" TO "anon";
GRANT ALL ON TABLE "public"."kiwify_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."kiwify_connections" TO "service_role";



GRANT ALL ON TABLE "public"."kiwify_event_mappings" TO "anon";
GRANT ALL ON TABLE "public"."kiwify_event_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."kiwify_event_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."kiwify_lead_products" TO "anon";
GRANT ALL ON TABLE "public"."kiwify_lead_products" TO "authenticated";
GRANT ALL ON TABLE "public"."kiwify_lead_products" TO "service_role";



GRANT ALL ON TABLE "public"."kiwify_message_automations" TO "anon";
GRANT ALL ON TABLE "public"."kiwify_message_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."kiwify_message_automations" TO "service_role";



GRANT ALL ON TABLE "public"."kiwify_message_jobs" TO "anon";
GRANT ALL ON TABLE "public"."kiwify_message_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."kiwify_message_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."kiwify_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."kiwify_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."kiwify_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."lead_field_definitions" TO "anon";
GRANT ALL ON TABLE "public"."lead_field_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_field_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."lead_field_values" TO "anon";
GRANT ALL ON TABLE "public"."lead_field_values" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_field_values" TO "service_role";



GRANT ALL ON TABLE "public"."lead_tags" TO "anon";
GRANT ALL ON TABLE "public"."lead_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_tags" TO "service_role";



GRANT ALL ON TABLE "public"."lead_types" TO "anon";
GRANT ALL ON TABLE "public"."lead_types" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_types" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."leads_files" TO "anon";
GRANT ALL ON TABLE "public"."leads_files" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_files" TO "service_role";



GRANT ALL ON TABLE "public"."leads_loss_reasons" TO "anon";
GRANT ALL ON TABLE "public"."leads_loss_reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_loss_reasons" TO "service_role";



GRANT ALL ON TABLE "public"."leads_notes" TO "anon";
GRANT ALL ON TABLE "public"."leads_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_notes" TO "service_role";



GRANT ALL ON TABLE "public"."leads_pipelines" TO "anon";
GRANT ALL ON TABLE "public"."leads_pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."leads_stage_duplication_rules" TO "anon";
GRANT ALL ON TABLE "public"."leads_stage_duplication_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_stage_duplication_rules" TO "service_role";



GRANT ALL ON TABLE "public"."leads_stages" TO "anon";
GRANT ALL ON TABLE "public"."leads_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_stages" TO "service_role";



GRANT ALL ON TABLE "public"."leads_stages_followups" TO "anon";
GRANT ALL ON TABLE "public"."leads_stages_followups" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_stages_followups" TO "service_role";



GRANT ALL ON TABLE "public"."leads_tags" TO "anon";
GRANT ALL ON TABLE "public"."leads_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_tags" TO "service_role";



GRANT ALL ON TABLE "public"."leads_updates" TO "anon";
GRANT ALL ON TABLE "public"."leads_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_updates" TO "service_role";



GRANT ALL ON TABLE "public"."lgpd_anonymization_log" TO "anon";
GRANT ALL ON TABLE "public"."lgpd_anonymization_log" TO "authenticated";
GRANT ALL ON TABLE "public"."lgpd_anonymization_log" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_followup_queue" TO "anon";
GRANT ALL ON TABLE "public"."meeting_followup_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_followup_queue" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_records" TO "anon";
GRANT ALL ON TABLE "public"."meeting_records" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_records" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."meetings_followups" TO "anon";
GRANT ALL ON TABLE "public"."meetings_followups" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings_followups" TO "service_role";



GRANT ALL ON TABLE "public"."message_buffer" TO "anon";
GRANT ALL ON TABLE "public"."message_buffer" TO "authenticated";
GRANT ALL ON TABLE "public"."message_buffer" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meta_lead_form_pages" TO "anon";
GRANT ALL ON TABLE "public"."meta_lead_form_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_lead_form_pages" TO "service_role";



GRANT ALL ON TABLE "public"."meta_lead_form_pages_safe" TO "anon";
GRANT ALL ON TABLE "public"."meta_lead_form_pages_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_lead_form_pages_safe" TO "service_role";



GRANT ALL ON TABLE "public"."meta_lead_forms" TO "anon";
GRANT ALL ON TABLE "public"."meta_lead_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_lead_forms" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_recovery_codes" TO "anon";
GRANT ALL ON TABLE "public"."mfa_recovery_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_recovery_codes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."omni_channel_alerts" TO "anon";
GRANT ALL ON TABLE "public"."omni_channel_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."omni_channel_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."omni_channel_configs" TO "anon";
GRANT ALL ON TABLE "public"."omni_channel_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."omni_channel_configs" TO "service_role";



GRANT ALL ON TABLE "public"."omni_delivery_dead_letter" TO "anon";
GRANT ALL ON TABLE "public"."omni_delivery_dead_letter" TO "authenticated";
GRANT ALL ON TABLE "public"."omni_delivery_dead_letter" TO "service_role";



GRANT ALL ON TABLE "public"."omni_outbound_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."omni_outbound_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."omni_outbound_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_automations" TO "anon";
GRANT ALL ON TABLE "public"."schedule_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_automations" TO "service_role";



GRANT ALL ON TABLE "public"."score_categories" TO "anon";
GRANT ALL ON TABLE "public"."score_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."score_categories" TO "service_role";



GRANT ALL ON TABLE "public"."score_category_items" TO "anon";
GRANT ALL ON TABLE "public"."score_category_items" TO "authenticated";
GRANT ALL ON TABLE "public"."score_category_items" TO "service_role";



GRANT ALL ON TABLE "public"."score_matrix" TO "anon";
GRANT ALL ON TABLE "public"."score_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."score_matrix" TO "service_role";



GRANT ALL ON TABLE "public"."score_settings" TO "anon";
GRANT ALL ON TABLE "public"."score_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."score_settings" TO "service_role";



GRANT ALL ON TABLE "public"."secret_access_log" TO "anon";
GRANT ALL ON TABLE "public"."secret_access_log" TO "authenticated";
GRANT ALL ON TABLE "public"."secret_access_log" TO "service_role";



GRANT ALL ON TABLE "public"."sends" TO "anon";
GRANT ALL ON TABLE "public"."sends" TO "authenticated";
GRANT ALL ON TABLE "public"."sends" TO "service_role";



GRANT ALL ON TABLE "public"."sends_contacts" TO "anon";
GRANT ALL ON TABLE "public"."sends_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."sends_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."sends_import_sessions" TO "anon";
GRANT ALL ON TABLE "public"."sends_import_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sends_import_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."settings_ai_providers" TO "anon";
GRANT ALL ON TABLE "public"."settings_ai_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_ai_providers" TO "service_role";



GRANT ALL ON TABLE "public"."settings_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."settings_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."settings_business_hours" TO "anon";
GRANT ALL ON TABLE "public"."settings_business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."settings_elevenlabs" TO "anon";
GRANT ALL ON TABLE "public"."settings_elevenlabs" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_elevenlabs" TO "service_role";



GRANT ALL ON TABLE "public"."settings_omni_new_contact" TO "anon";
GRANT ALL ON TABLE "public"."settings_omni_new_contact" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_omni_new_contact" TO "service_role";



GRANT ALL ON TABLE "public"."settings_schedules" TO "anon";
GRANT ALL ON TABLE "public"."settings_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."settings_system_modules" TO "anon";
GRANT ALL ON TABLE "public"."settings_system_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_system_modules" TO "service_role";



GRANT ALL ON TABLE "public"."settings_teams" TO "anon";
GRANT ALL ON TABLE "public"."settings_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_teams" TO "service_role";



GRANT ALL ON TABLE "public"."settings_teams_pipelines" TO "anon";
GRANT ALL ON TABLE "public"."settings_teams_pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_teams_pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."settings_teams_tags" TO "anon";
GRANT ALL ON TABLE "public"."settings_teams_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_teams_tags" TO "service_role";



GRANT ALL ON TABLE "public"."settings_users" TO "anon";
GRANT ALL ON TABLE "public"."settings_users" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_users" TO "service_role";



GRANT ALL ON TABLE "public"."settings_users_teams" TO "anon";
GRANT ALL ON TABLE "public"."settings_users_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_users_teams" TO "service_role";



GRANT ALL ON TABLE "public"."settings_whatsapp_channels" TO "anon";
GRANT ALL ON TABLE "public"."settings_whatsapp_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_whatsapp_channels" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."tenant_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."tenant_role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_roles" TO "anon";
GRANT ALL ON TABLE "public"."tenant_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_calcom_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_calcom_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_calcom_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."webhooks" TO "anon";
GRANT ALL ON TABLE "public"."webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_templates" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_templates" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







