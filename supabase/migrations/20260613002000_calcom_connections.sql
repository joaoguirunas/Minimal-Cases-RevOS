-- CAL-DB: Cal.com OAuth connections per user + calcom_uid in meetings + calcom_client_id in settings
-- @no-rollback

-- 1. Tabela de conexões Cal.com por usuário (OAuth tokens)
CREATE TABLE IF NOT EXISTS user_calcom_connections (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES settings_users(id) ON DELETE CASCADE,
  calcom_username           TEXT,
  calcom_access_token       TEXT NOT NULL,
  calcom_refresh_token      TEXT NOT NULL,
  calcom_token_expires_at   TIMESTAMPTZ,
  default_event_type_id     INTEGER,
  default_event_type_slug   TEXT,
  default_booking_url       TEXT,
  webhook_id                TEXT,
  webhook_secret            TEXT,
  use_calcom_booking_link   BOOLEAN NOT NULL DEFAULT false,
  sync_booking              BOOLEAN NOT NULL DEFAULT true,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_calcom_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_calcom_connection" ON user_calcom_connections
  FOR ALL USING (
    user_id IN (
      SELECT id FROM settings_users WHERE auth_user_id = auth.uid()
    )
  );

-- Gestores e super_admin podem ver todas as conexões do tenant
-- (necessário para o select de agenda no Schedule PRO)
CREATE POLICY "gestores_see_all_calcom" ON user_calcom_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
    )
  );

-- Service role bypass (para edge functions)
CREATE POLICY "service_role_calcom" ON user_calcom_connections
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Adicionar calcom_uid a meetings (UID do booking no Cal.com)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS calcom_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS meetings_calcom_uid_key
  ON meetings(calcom_uid) WHERE calcom_uid IS NOT NULL;

-- 3. Adicionar calcom_client_id à tabela settings (OAuth client ID global do app)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS calcom_client_id TEXT;
UPDATE settings
  SET calcom_client_id = '3e2ebcc258be7431d30bcd255c4d46ac1fb3171738e3e247caf309f80ed08bd2'
  WHERE calcom_client_id IS NULL;
