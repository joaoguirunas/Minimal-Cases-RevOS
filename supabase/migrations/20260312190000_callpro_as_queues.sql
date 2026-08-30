-- CP-13: Tabela call_pro_as_queues
CREATE TABLE call_pro_as_queues (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  priority_label TEXT,
  color          TEXT DEFAULT '#6366f1',
  as_queue_id    TEXT NOT NULL,
  as_token       TEXT NOT NULL,
  as_api_key     TEXT NOT NULL,
  as_user_id     TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_pro_as_queues_active ON call_pro_as_queues(active);

CREATE OR REPLACE FUNCTION set_call_pro_as_queues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_call_pro_as_queues_updated_at
  BEFORE UPDATE ON call_pro_as_queues
  FOR EACH ROW EXECUTE FUNCTION set_call_pro_as_queues_updated_at();

ALTER TABLE call_pro_as_queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_pro_as_queues_select" ON call_pro_as_queues;
CREATE POLICY "call_pro_as_queues_select" ON call_pro_as_queues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "call_pro_as_queues_write" ON call_pro_as_queues;
CREATE POLICY "call_pro_as_queues_write" ON call_pro_as_queues
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );
