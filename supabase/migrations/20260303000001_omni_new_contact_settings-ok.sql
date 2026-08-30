-- Migration: settings_omni_new_contact
-- Stores per-channel config for auto-creating a negócio when a new contact messages in

CREATE TABLE IF NOT EXISTS settings_omni_new_contact (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel             text NOT NULL CHECK (channel IN ('whatsapp','email','instagram_dm','instagram_comment')),
  auto_create_negocio boolean NOT NULL DEFAULT false,
  pipeline_id         uuid REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  stage_id            uuid REFERENCES leads_stages(id) ON DELETE SET NULL,
  title_template      text NOT NULL DEFAULT 'Nova conversa - {{nome}}',
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (channel)
);

ALTER TABLE settings_omni_new_contact ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (edge functions use service role, but SELECT policy is good practice)
CREATE POLICY "settings_omni_new_contact_select" ON settings_omni_new_contact
  FOR SELECT TO authenticated USING (true);

-- Only managers/admins can write
CREATE POLICY "settings_omni_new_contact_write" ON settings_omni_new_contact
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
      AND active = true AND deleted_at IS NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
      AND active = true AND deleted_at IS NULL
  ));

-- Seed default rows (disabled by default for all channels)
INSERT INTO settings_omni_new_contact (channel) VALUES
  ('whatsapp'),
  ('email'),
  ('instagram_dm'),
  ('instagram_comment')
ON CONFLICT (channel) DO NOTHING;
