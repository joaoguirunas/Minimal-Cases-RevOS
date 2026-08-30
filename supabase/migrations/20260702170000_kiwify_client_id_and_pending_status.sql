-- KFY-4.1 — Kiwify connection: real OAuth client_id + manual-webhook status
--
-- 1. client_id: Kiwify's OAuth client_id is a DISTINCT UUID, NOT the account_id
--    (the KFY-1.2/1.3 assumption client_id==account_id was wrong; real dashboard
--    exposes account_id, client_id and client_secret as three separate values).
--    Same sensitivity as account_id (plaintext id, not a secret) → stored as text.
-- 2. status 'pending_webhook': credentials saved but the webhook token not yet
--    registered (manual flow — save_credentials before register_manual_webhook_token).

ALTER TABLE public.kiwify_connections
  ADD COLUMN IF NOT EXISTS client_id text NOT NULL;

COMMENT ON COLUMN public.kiwify_connections.client_id IS 'Kiwify OAuth client_id (UUID from dashboard). Distinct from account_id. Not a secret — plaintext text.';

ALTER TABLE public.kiwify_connections
  DROP CONSTRAINT IF EXISTS kiwify_connections_status_check;

ALTER TABLE public.kiwify_connections
  ADD CONSTRAINT kiwify_connections_status_check
  CHECK (status IN ('disconnected','connected','error','pending_webhook'));
