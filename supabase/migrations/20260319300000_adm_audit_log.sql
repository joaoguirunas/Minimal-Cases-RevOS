-- ADM-V2-01: Audit Log no Control Plane
-- Registra todas as operações sensíveis do painel ADM

CREATE TABLE IF NOT EXISTS adm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_adm_audit_log_action ON adm_audit_log(action);
CREATE INDEX idx_adm_audit_log_created_at ON adm_audit_log(created_at DESC);
CREATE INDEX idx_adm_audit_log_entity ON adm_audit_log(entity_type, entity_id);

ALTER TABLE adm_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read audit log"
  ON adm_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE settings_users.auth_user_id = auth.uid()
        AND settings_users.super_admin = true
        AND settings_users.active = true
        AND settings_users.deleted_at IS NULL
    )
  );

CREATE POLICY "System can insert audit log"
  ON adm_audit_log FOR INSERT
  WITH CHECK (true);
