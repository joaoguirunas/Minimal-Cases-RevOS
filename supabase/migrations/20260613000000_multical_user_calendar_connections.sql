-- MULTI-CAL-01: suporte a múltiplas conexões de calendário por usuário
-- Remove o limite de 1 conexão/user, adiciona flag sync_booking e unicidade por (user_id, email) por provider.
-- Aditivo e não-destrutivo. provider já existe (NOT NULL DEFAULT 'google', CHECK google/microsoft/zoom).
BEGIN;

ALTER TABLE public.user_calendar_connections
  DROP CONSTRAINT IF EXISTS user_calendar_connections_user_id_key;

ALTER TABLE public.user_calendar_connections
  ADD COLUMN IF NOT EXISTS sync_booking boolean NOT NULL DEFAULT true;

-- Unicidade por email dentro de cada provider, sem interferir entre providers (emails NULL ignorados).
CREATE UNIQUE INDEX IF NOT EXISTS user_calendar_connections_user_google_email_uidx
  ON public.user_calendar_connections (user_id, google_email)
  WHERE google_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_calendar_connections_user_ms_email_uidx
  ON public.user_calendar_connections (user_id, ms_email)
  WHERE ms_email IS NOT NULL;

COMMIT;
