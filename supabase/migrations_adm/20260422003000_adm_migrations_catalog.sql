-- ADM-V3-07: Formalize adm_migrations and adm_migration_runs
-- Idempotent — safe to re-run on a fresh control plane

-- Catalog of tenant-facing migrations managed by the control plane
CREATE TABLE IF NOT EXISTS adm_migrations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  sql_content text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Per-client application record
CREATE TABLE IF NOT EXISTS adm_migration_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid        NOT NULL,
  migration_id uuid        NOT NULL REFERENCES adm_migrations(id) ON DELETE CASCADE,
  applied_at   timestamptz NOT NULL DEFAULT now(),
  status       text        NOT NULL DEFAULT 'success'
               CHECK (status IN ('success', 'error')),
  error        text,
  UNIQUE (client_id, migration_id)
);

CREATE INDEX IF NOT EXISTS adm_migration_runs_client_idx
  ON adm_migration_runs (client_id);

-- RLS: super_admin only
ALTER TABLE adm_migrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_migration_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'adm_migrations' AND policyname = 'adm_migrations_super_admin'
  ) THEN
    CREATE POLICY adm_migrations_super_admin ON adm_migrations
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM settings_users
          WHERE auth_user_id = auth.uid()
            AND super_admin = true
            AND active = true
            AND deleted_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'adm_migration_runs' AND policyname = 'adm_migration_runs_super_admin'
  ) THEN
    CREATE POLICY adm_migration_runs_super_admin ON adm_migration_runs
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM settings_users
          WHERE auth_user_id = auth.uid()
            AND super_admin = true
            AND active = true
            AND deleted_at IS NULL
        )
      );
  END IF;
END;
$$;
