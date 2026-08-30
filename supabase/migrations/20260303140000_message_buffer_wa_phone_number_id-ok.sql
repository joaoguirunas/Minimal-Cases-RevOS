-- =============================================================================
-- AIAGT-4: OMNI PRO Router — canal-aware agent routing
-- Adds wa_phone_number_id to message_buffer so ai-agent-execute knows
-- which WhatsApp channel received the inbound message, enabling
-- Canal + Pipeline + Stage priority routing.
-- =============================================================================

-- Track which WA channel each buffer entry came from
ALTER TABLE message_buffer
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

CREATE INDEX IF NOT EXISTS idx_message_buffer_wa_phone_number_id
  ON message_buffer (wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;

COMMENT ON COLUMN message_buffer.wa_phone_number_id IS
  'Meta WA phone_number_id that received the inbound message — used by ai-agent-execute to select the right agent (Canal + Pipeline routing)';
