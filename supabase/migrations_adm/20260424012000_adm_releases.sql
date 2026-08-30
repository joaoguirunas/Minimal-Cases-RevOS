-- ═══════════════════════════════════════════════════════════════════
-- REL-01 AC3a — adm_releases catalog
-- Applies ONLY to control plane (NOT synced to clients)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS adm_releases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version         text        NOT NULL UNIQUE,
  git_sha         text        NOT NULL,
  migrations      jsonb       NOT NULL DEFAULT '[]',
  min_compat_from text        NOT NULL DEFAULT '1.0',
  changelog       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS adm_releases_created_at_idx ON adm_releases(created_at DESC);
CREATE INDEX IF NOT EXISTS adm_releases_version_idx    ON adm_releases(version);

ALTER TABLE adm_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_releases_super_admin"
  ON adm_releases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND super_admin = true
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- service_role can INSERT (called by CI edge fn adm-releases-register)
CREATE POLICY "adm_releases_service_role_insert"
  ON adm_releases FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMIT;
