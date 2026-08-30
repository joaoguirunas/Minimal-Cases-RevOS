-- Rollback MULTI-CAL-01
-- ATENCAO: restaurar UNIQUE(user_id) so funciona se nao houver >1 conexao por usuario.
-- Se houver multiplas conexoes, remova-as antes de reaplicar este rollback.
BEGIN;

DROP INDEX IF EXISTS public.user_calendar_connections_user_google_email_uidx;
DROP INDEX IF EXISTS public.user_calendar_connections_user_ms_email_uidx;

ALTER TABLE public.user_calendar_connections
  DROP COLUMN IF EXISTS sync_booking;

ALTER TABLE public.user_calendar_connections
  ADD CONSTRAINT user_calendar_connections_user_id_key UNIQUE (user_id);

COMMIT;
