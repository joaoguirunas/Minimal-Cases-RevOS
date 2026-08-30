-- Rollback KFY-4.1 — revert client_id column + pending_webhook status.
-- NOTE: rows with status='pending_webhook' must be resolved before running this,
-- or the restored CHECK will reject them.

ALTER TABLE public.kiwify_connections
  DROP CONSTRAINT IF EXISTS kiwify_connections_status_check;

ALTER TABLE public.kiwify_connections
  ADD CONSTRAINT kiwify_connections_status_check
  CHECK (status IN ('disconnected','connected','error'));

ALTER TABLE public.kiwify_connections
  DROP COLUMN IF EXISTS client_id;
