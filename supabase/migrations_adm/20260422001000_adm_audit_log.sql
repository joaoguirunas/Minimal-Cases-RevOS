-- ADM-V3-07: Formalize adm_audit_log (previously applied via manual-fixes)
-- Idempotent — safe to re-run on a fresh control plane

CREATE TABLE IF NOT EXISTS adm_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,
  actor_email text        NOT NULL DEFAULT 'unknown',
  action      text        NOT NULL,
  entity_type text        NOT NULL DEFAULT 'adm_client',
  entity_id   uuid,
  entity_name text,
  details     jsonb       NOT NULL DEFAULT '{}',
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes (covered also by ADM-V3-06 migration — idempotent)
CREATE INDEX IF NOT EXISTS adm_audit_log_created_at_idx   ON adm_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS adm_audit_log_actor_id_idx     ON adm_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS adm_audit_log_action_entity_idx ON adm_audit_log (action, entity_type);

-- RLS: super_admin only
ALTER TABLE adm_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'adm_audit_log' AND policyname = 'adm_audit_log_super_admin'
  ) THEN
    CREATE POLICY adm_audit_log_super_admin ON adm_audit_log
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

-- Allow system inserts (cron, edge functions) without RLS
CREATE POLICY adm_audit_log_service_insert ON adm_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);
