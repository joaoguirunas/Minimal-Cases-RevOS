-- Migration: sends_import_sessions
-- Tracks the state of each import session for progress polling (SENDS PRO v3 import feature)

CREATE TABLE sends_import_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id         uuid        REFERENCES sends(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'processing'
                                CHECK (status IN ('processing', 'done', 'failed')),
  total_rows      int         NOT NULL DEFAULT 0,
  processed       int         NOT NULL DEFAULT 0,
  new_people      int         NOT NULL DEFAULT 0,
  existing_people int         NOT NULL DEFAULT 0,
  failed_rows     int         NOT NULL DEFAULT 0,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for polling by send_id
CREATE INDEX idx_sends_import_sessions_send_id
  ON sends_import_sessions(send_id);

-- RLS: isolated by tenant via Supabase project
ALTER TABLE sends_import_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access" ON sends_import_sessions;
CREATE POLICY "tenant_access" ON sends_import_sessions
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sends_import_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sends_import_sessions_updated_at
  BEFORE UPDATE ON sends_import_sessions
  FOR EACH ROW EXECUTE FUNCTION update_sends_import_sessions_updated_at();
