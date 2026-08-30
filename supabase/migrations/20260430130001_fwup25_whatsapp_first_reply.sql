-- fwup25: primeira mensagem recebida WhatsApp → mover lead de etapa
-- Adds on_first_reply_enabled + on_first_reply_stage_id to settings_omni_new_contact
-- Adds first_inbound_at to leads to track per-lead "already processed"

ALTER TABLE settings_omni_new_contact
  ADD COLUMN IF NOT EXISTS on_first_reply_enabled   boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_first_reply_stage_id  uuid     REFERENCES leads_stages(id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_inbound_at timestamptz DEFAULT NULL;
