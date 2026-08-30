-- Rollback for 20260510190000_inbound_webhooks.sql

BEGIN;

DROP TRIGGER IF EXISTS update_inbound_webhooks_updated_at ON public.inbound_webhooks;
DROP POLICY IF EXISTS "authenticated_select" ON public.inbound_webhooks;
DROP POLICY IF EXISTS "authenticated_insert" ON public.inbound_webhooks;
DROP POLICY IF EXISTS "authenticated_update" ON public.inbound_webhooks;
DROP POLICY IF EXISTS "authenticated_delete" ON public.inbound_webhooks;
DROP INDEX IF EXISTS public.idx_inbound_webhooks_token;
DROP INDEX IF EXISTS public.idx_inbound_webhooks_active;
DROP TABLE IF EXISTS public.inbound_webhooks;

COMMIT;
