-- ── bi_sdr_targets ────────────────────────────────────────────────────────────
-- Daily meeting targets per SDR per month.
-- One row per (user_id, year, month) — daily_target applies uniformly to every
-- working day in that month. The UI multiplies daily_target × days-in-period to
-- compute the period total target.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bi_sdr_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES settings_users(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  daily_target INTEGER NOT NULL DEFAULT 0 CHECK (daily_target >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

-- Index for date-range lookups
CREATE INDEX IF NOT EXISTS bi_sdr_targets_year_month_idx
  ON bi_sdr_targets (year, month);

-- RLS
ALTER TABLE bi_sdr_targets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for BI views)
CREATE POLICY "bi_sdr_targets_select"
  ON bi_sdr_targets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM settings_users
    WHERE auth_user_id = auth.uid()
      AND active = true
      AND deleted_at IS NULL
  ));

-- Only gestor/admin can insert/update/delete
CREATE POLICY "bi_sdr_targets_insert"
  ON bi_sdr_targets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
      AND active = true
      AND deleted_at IS NULL
  ));

CREATE POLICY "bi_sdr_targets_update"
  ON bi_sdr_targets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
      AND active = true
      AND deleted_at IS NULL
  ));

CREATE POLICY "bi_sdr_targets_delete"
  ON bi_sdr_targets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
      AND active = true
      AND deleted_at IS NULL
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_bi_sdr_targets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bi_sdr_targets_updated_at
  BEFORE UPDATE ON bi_sdr_targets
  FOR EACH ROW EXECUTE FUNCTION update_bi_sdr_targets_updated_at();
