-- KFY (God Node fix): allow source_type='kiwify' on messages.
--
-- kiwify-dispatch-worker inserts messages with source_type='kiwify' (index.ts:171).
-- Live constraint `messages_source_type_check` did NOT include 'kiwify' → every
-- Kiwify automation send would violate the CHECK. This migration widens the CHECK
-- to the existing 7 values + 'kiwify' (additive superset; no data change).
--
-- Live-verified (2026-07-02, wotuyxscsfralqpoiyfv): existing source_type values in use
-- are inbound/manual/ai_agent/campaign/form/appointment_reminder — all within the new
-- superset, so ADD CONSTRAINT validates without error. source_type is nullable and a
-- CHECK ... IN(...) passes on NULL (behavior preserved).
--
-- ⚠️ GOD NODE: `messages` is shared by the whole system. DROP+ADD is atomic inside the
-- transaction; the superset guarantees no existing row is rejected.
--
-- Apply: supabase db query --linked --file <this> ; register in schema_migrations.

BEGIN;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_source_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'inbound'::text,
    'manual'::text,
    'ai_agent'::text,
    'campaign'::text,
    'form'::text,
    'followup'::text,
    'appointment_reminder'::text,
    'kiwify'::text
  ]));

COMMIT;
