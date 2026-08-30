-- =============================================================================
-- N8N-WAA-3: message_buffer + AI fields on clients_people + messages tracking
-- Epic: Native AI Agent Runtime (N8N-WAA)
-- Agent: @data-engineer
--
-- Replaces Redis for inbound message debouncing.
-- messages.from_contact normalized: 'cliente' | 'ia' | 'humano' | 'sistema'
-- =============================================================================

-- ── 1. MESSAGE BUFFER (replaces Redis list) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS message_buffer (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id   uuid        NOT NULL REFERENCES clients_people(id) ON DELETE CASCADE,
  -- Array of {content, message_type, media_url, wa_message_id} objects
  messages    jsonb[]     NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- expires_at = created_at + ai_agents.buffer_ms (set by edge function)
  expires_at  timestamptz NOT NULL,
  processed   boolean     NOT NULL DEFAULT false,
  processed_at timestamptz
);

COMMENT ON TABLE  message_buffer                 IS 'Inbound message debounce buffer. Replaces Redis list. Processed by pg_cron every 5s.';
COMMENT ON COLUMN message_buffer.messages        IS 'Array of {content, message_type, media_url, wa_message_id}';
COMMENT ON COLUMN message_buffer.expires_at      IS 'When this buffer window closes (= created_at + buffer_ms)';
COMMENT ON COLUMN message_buffer.processed       IS 'True once ai-agent-execute has consumed this buffer entry';

-- Index for pg_cron polling (unprocessed entries past expiry)
CREATE INDEX IF NOT EXISTS message_buffer_ready_to_process
  ON message_buffer (people_id, expires_at)
  WHERE processed = false;

-- RLS: only service_role (edge functions) — never called from frontend
ALTER TABLE message_buffer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_buffer_service_role_only"
  ON message_buffer FOR ALL
  USING (auth.role() = 'service_role');


-- ── 2. AI PROCESSING FIELDS ON clients_people ────────────────────────────────

ALTER TABLE clients_people
  ADD COLUMN IF NOT EXISTS ai_last_message_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ai_processing_lock  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clients_people.ai_last_message_at IS 'Timestamp of last inbound message (used by pg_cron debounce check)';
COMMENT ON COLUMN clients_people.ai_processing_lock IS 'Lock flag: prevents concurrent ai-agent-execute runs for same person';


-- ── 3. MESSAGE TRACKING FIELDS ───────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS wa_message_id  text,
  ADD COLUMN IF NOT EXISTS execution_id   uuid
    REFERENCES ai_agents_execution_log(id) ON DELETE SET NULL;

-- Deduplication: prevent storing duplicate inbound WA messages
CREATE UNIQUE INDEX IF NOT EXISTS messages_wa_message_id_unique
  ON messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_execution_id_idx
  ON messages (execution_id)
  WHERE execution_id IS NOT NULL;

COMMENT ON COLUMN messages.wa_message_id IS 'WhatsApp message ID from Meta API — used for deduplication and read receipts';
COMMENT ON COLUMN messages.execution_id  IS 'FK to ai_agents_execution_log — set on AI-generated outbound messages';


-- ── 4. from_contact NORMALIZATION ────────────────────────────────────────────
-- Canonical values: 'cliente' | 'ia' | 'humano' | 'sistema'
-- Note: no CHECK constraint yet as existing rows may have NULL/'false'
-- Migration of legacy values done here before adding constraint.

UPDATE messages
  SET from_contact = 'humano'
  WHERE from_contact IN ('false', 'true')
     OR (from_contact IS NULL AND status IN ('sent', 'delivered', 'read'));

-- Migrate any 'agent' or similar legacy values
UPDATE messages
  SET from_contact = 'ia'
  WHERE from_contact = 'agent';

COMMENT ON COLUMN messages.from_contact IS 'Sender type: cliente (inbound) | ia (AI agent outbound) | humano (human agent outbound) | sistema (automated system)';
