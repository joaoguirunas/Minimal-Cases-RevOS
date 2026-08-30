-- ═══════════════════════════════════════════════════════════════════
-- REL-01 AC3b — adm_client_versions audit trail
-- Applies ONLY to control plane (NOT synced to clients)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS adm_client_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        NOT NULL REFERENCES adm_clients(id) ON DELETE CASCADE,
  from_version   text,
  to_version     text        NOT NULL,
  applied_at     timestamptz NOT NULL DEFAULT now(),
  applied_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status         text        NOT NULL DEFAULT 'success'
                 CHECK (status IN ('success', 'failed', 'partial')),
  error_summary  text,
  sync_job_id    uuid        REFERENCES adm_sync_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS adm_client_versions_client_at_idx
  ON adm_client_versions(client_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS adm_client_versions_status_idx
  ON adm_client_versions(status) WHERE status != 'success';

ALTER TABLE adm_client_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_client_versions_super_admin"
  ON adm_client_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND super_admin = true
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- service_role can INSERT (called by adm-sync-client edge fn on completion)
CREATE POLICY "adm_client_versions_service_role_insert"
  ON adm_client_versions FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMIT;
