-- ═══════════════════════════════════════════════════════════════════
-- REL-01 AC3c — adm_clients version tracking columns
-- Applies ONLY to control plane (NOT synced to clients)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE adm_clients
  ADD COLUMN IF NOT EXISTS current_version text,
  ADD COLUMN IF NOT EXISTS target_version  text;

COMMENT ON COLUMN adm_clients.current_version IS
  'Last release version successfully applied to this tenant. NULL = never updated (pre-REL-01).';
COMMENT ON COLUMN adm_clients.target_version IS
  'Release version queued for next sync. NULL = no pending update.';

COMMIT;
