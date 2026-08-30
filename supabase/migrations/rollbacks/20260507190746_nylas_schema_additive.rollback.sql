-- ═══════════════════════════════════════════════════════════════════
-- 20260507190746_nylas_schema_additive.rollback.sql
-- Rollback aditivo NYLAS-02 — restaura estado pré-migration.
--
-- ATENÇÃO: rollback executa DROP COLUMN — perde dados Nylas.
-- Só executar em emergência, e só antes de ter grants Nylas reais.
-- ═══════════════════════════════════════════════════════════════════
-- @allow-destructive reason: rollback de schema-aditivo aprovado pelo ADR-NYLAS-01

BEGIN;

-- ── Drop tabela nylas_webhook_events ────────────────────────────────
DROP TABLE IF EXISTS public.nylas_webhook_events;

-- ── settings_users.use_nylas_calendar ───────────────────────────────
ALTER TABLE public.settings_users
  DROP COLUMN IF EXISTS use_nylas_calendar;

-- ── settings (credenciais Nylas) ────────────────────────────────────
ALTER TABLE public.settings
  DROP COLUMN IF EXISTS nylas_api_key,
  DROP COLUMN IF EXISTS nylas_client_id,
  DROP COLUMN IF EXISTS nylas_client_secret,
  DROP COLUMN IF EXISTS nylas_redirect_uri;

-- ── meetings.nylas_event_id ─────────────────────────────────────────
ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS nylas_event_id;

-- ── user_calendar_connections (drop CHECK constraints + colunas) ────
ALTER TABLE public.user_calendar_connections
  DROP CONSTRAINT IF EXISTS user_calendar_connections_nylas_grant_status_check,
  DROP CONSTRAINT IF EXISTS user_calendar_connections_connection_method_check;

ALTER TABLE public.user_calendar_connections
  DROP COLUMN IF EXISTS nylas_grant_id,
  DROP COLUMN IF EXISTS nylas_grant_status,
  DROP COLUMN IF EXISTS nylas_scopes,
  DROP COLUMN IF EXISTS nylas_synced_at,
  DROP COLUMN IF EXISTS connection_method;

COMMIT;
