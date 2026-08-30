-- OMNI PRO™ Channel Alerts — Alertas e logs de canais
-- Epic: EPIC-OMNI-PRO-V2 | Story: OP-03 (Instagram OAuth Auto-Renewal)
-- Tabela reutilizada por: OP-05 (Channel Health Monitor), OP-09 (Rate Limiting)

-- ── 1. Criar tabela omni_channel_alerts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_channel_alerts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel     text NOT NULL
                CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone', 'system')),
  alert_type  text NOT NULL,
  severity    text NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info', 'warning', 'error')),
  title       text NOT NULL,
  details     jsonb DEFAULT '{}',
  resolved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE omni_channel_alerts IS
  'OMNI PRO™ alertas de canais — token refresh, health checks, rate limits. '
  'Usado por OP-03 (token refresh), OP-05 (health monitor), OP-09 (rate limiting).';

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX idx_omni_channel_alerts_channel_type
  ON omni_channel_alerts (channel, alert_type, created_at DESC);

CREATE INDEX idx_omni_channel_alerts_severity
  ON omni_channel_alerts (severity, created_at DESC)
  WHERE resolved_at IS NULL;

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE omni_channel_alerts ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado ativo
DROP POLICY IF EXISTS "omni_channel_alerts_read" ON omni_channel_alerts;
CREATE POLICY "omni_channel_alerts_read"
  ON omni_channel_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- Escrita: apenas service_role (edge functions via pg_cron)
-- Não criar policy de INSERT/UPDATE para authenticated — apenas service_role bypassa RLS
