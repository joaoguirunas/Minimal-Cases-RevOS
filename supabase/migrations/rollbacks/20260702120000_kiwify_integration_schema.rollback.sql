-- Rollback for 20260702120000_kiwify_integration_schema.sql (KFY-1.1)
-- Drops the 5 spec tables + the additive whatsapp_optin column.
-- NOTE: does NOT recreate the 3 abandoned draft tables (they were empty/unreferenced
--       and are considered dead — no restoration value).

BEGIN;

DROP TABLE IF EXISTS public.kiwify_message_jobs        CASCADE;
DROP TABLE IF EXISTS public.kiwify_message_automations CASCADE;
DROP TABLE IF EXISTS public.kiwify_event_mappings      CASCADE;
DROP TABLE IF EXISTS public.kiwify_webhook_events      CASCADE;
DROP TABLE IF EXISTS public.kiwify_connections         CASCADE;

ALTER TABLE public.clients_people DROP COLUMN IF EXISTS whatsapp_optin;

-- 4 stages created for Kiwify trigger coverage (pipeline "Cursos Online").
-- Safe to delete only if no leads were moved into them.
DELETE FROM public.leads_stages WHERE id IN (
  '3130aa19-7d22-4820-b372-d59d1a9a01ec', -- Reembolsado
  '812c33ce-a788-4d6a-b20a-cc1a90027d37', -- Chargeback
  '485dfe05-ed94-445c-99b3-36ed424918fb', -- Assinatura Cancelada
  '1a559fcf-8348-4e10-944c-f7034711cdde'  -- Inadimplente
);

COMMIT;
