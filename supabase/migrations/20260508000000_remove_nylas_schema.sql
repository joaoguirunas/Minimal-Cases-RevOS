-- ═══════════════════════════════════════════════════════════════════
-- 20260508000000_remove_nylas_schema.sql
-- Rollback completo da integração Nylas (NYLAS-02 a NYLAS-09).
-- Remove todas as tabelas, colunas e índices adicionados pelo Nylas.
-- A integração Google Calendar legada permanece intacta.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Índices ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_user_calendar_connections_nylas_grant_id;
DROP INDEX IF EXISTS public.idx_meetings_nylas_event_id;
DROP INDEX IF EXISTS public.idx_nylas_webhook_events_received_at;
DROP INDEX IF EXISTS public.idx_nylas_webhook_events_grant_id;
DROP INDEX IF EXISTS public.idx_nylas_oauth_states_expires_at;

-- ── Tabelas ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.nylas_webhook_events;
DROP TABLE IF EXISTS public.nylas_oauth_states;

-- ── user_calendar_connections — remover colunas Nylas ────────────────
ALTER TABLE public.user_calendar_connections
  DROP COLUMN IF EXISTS nylas_grant_id,
  DROP COLUMN IF EXISTS nylas_grant_status,
  DROP COLUMN IF EXISTS nylas_scopes,
  DROP COLUMN IF EXISTS nylas_synced_at,
  DROP COLUMN IF EXISTS connection_method;

ALTER TABLE public.user_calendar_connections
  DROP CONSTRAINT IF EXISTS user_calendar_connections_nylas_grant_status_check,
  DROP CONSTRAINT IF EXISTS user_calendar_connections_connection_method_check;

-- ── meetings — remover coluna Nylas ──────────────────────────────────
ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS nylas_event_id;

-- ── settings_users — remover flag Nylas ──────────────────────────────
ALTER TABLE public.settings_users
  DROP COLUMN IF EXISTS use_nylas_calendar;

-- ── settings — remover credenciais + provider Nylas ──────────────────
ALTER TABLE public.settings
  DROP COLUMN IF EXISTS nylas_api_key,
  DROP COLUMN IF EXISTS nylas_client_id,
  DROP COLUMN IF EXISTS nylas_client_secret,
  DROP COLUMN IF EXISTS nylas_redirect_uri,
  DROP COLUMN IF EXISTS calendar_provider;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_calendar_provider_check;

COMMIT;
