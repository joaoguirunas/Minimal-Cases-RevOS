-- OMNI PRO™ Channel Configs — Mega Config por Canal
-- Sprint 1 / Phase 2 — Tabela de configuração centralizada por canal
-- Migration: 20260308010000

-- ── 1. Criar tabela omni_channel_configs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_channel_configs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel       text NOT NULL UNIQUE
                  CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone')),
  is_active     boolean DEFAULT false,
  display_name  text NOT NULL,

  -- Credenciais específicas do canal (estrutura flexível por provider)
  -- whatsapp:  { phone_number_id, access_token, app_secret, business_id, verify_token }
  -- email:     { provider: 'smtp'|'sendgrid'|'webhook', host, port, user, pass, api_key, from_email, from_name }
  -- instagram: { page_id, access_token, instagram_business_id }
  -- sms:       { provider: 'twilio'|'webhook', account_sid, auth_token, from_number, webhook_url }
  -- telefone:  { provider: 'twilio'|'webhook', account_sid, auth_token, from_number, webhook_url }
  credentials   jsonb DEFAULT '{}',

  -- Comportamento e regras do canal
  -- Todos: { retry_attempts, retry_delay_ms, rate_limit_per_hour }
  -- whatsapp: { window_hours: 24, require_template_after_window: true, humanizer_min_ms, humanizer_max_ms }
  -- instagram: { window_hours: 168 }
  -- email:     { max_per_hour, track_opens, track_clicks }
  settings      jsonb DEFAULT '{}',

  -- Webhook fallback (quando canal nativo não disponível)
  -- { enabled: false, url: '', method: 'POST', headers: {}, payload_template: '' }
  webhook_fallback jsonb DEFAULT '{}',

  -- Horário comercial
  -- { enabled: false, timezone: 'America/Sao_Paulo', start: '09:00', end: '18:00',
  --   days: [1,2,3,4,5], outside_hours_reply: '' }
  business_hours jsonb DEFAULT '{}',

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE omni_channel_configs IS
  'OMNI PRO™ configuração centralizada por canal de comunicação. '
  'Uma linha por canal — whatsapp, instagram, email, sms, telefone.';

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE omni_channel_configs ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado ativo
CREATE POLICY "omni_channel_configs_read"
  ON omni_channel_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- Escrita: apenas gestor ou super_admin
CREATE POLICY "omni_channel_configs_write"
  ON omni_channel_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ── 3. Trigger updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_omni_channel_configs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_omni_channel_configs_updated_at
  BEFORE UPDATE ON omni_channel_configs
  FOR EACH ROW EXECUTE FUNCTION set_omni_channel_configs_updated_at();

-- ── 4. Seed inicial — um registro por canal ────────────────────────────────────
-- WhatsApp já funciona — is_active=true, settings pré-preenchido
-- Demais canais: is_active=false (aguardam configuração pelo usuário)

INSERT INTO omni_channel_configs (channel, is_active, display_name, settings)
VALUES
  ('whatsapp',  true,  'WhatsApp', '{
    "window_hours": 24,
    "require_template_after_window": true,
    "humanizer_min_ms": 500,
    "humanizer_max_ms": 2000,
    "retry_attempts": 3,
    "retry_delay_ms": 5000
  }'),
  ('instagram', false, 'Instagram', '{
    "window_hours": 168,
    "retry_attempts": 2,
    "retry_delay_ms": 5000
  }'),
  ('email',     false, 'E-mail', '{
    "provider": "webhook",
    "max_per_hour": 100,
    "retry_attempts": 3,
    "retry_delay_ms": 10000,
    "track_opens": false,
    "track_clicks": false
  }'),
  ('sms',       false, 'SMS', '{
    "provider": "webhook",
    "retry_attempts": 2,
    "retry_delay_ms": 5000,
    "rate_limit_per_hour": 50
  }'),
  ('telefone',  false, 'Call', '{
    "provider": "webhook",
    "retry_attempts": 1,
    "retry_delay_ms": 30000
  }')
ON CONFLICT (channel) DO NOTHING;
