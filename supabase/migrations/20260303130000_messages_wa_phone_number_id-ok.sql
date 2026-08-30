-- Add wa_phone_number_id as a direct column for efficient filtering
ALTER TABLE messages ADD COLUMN IF NOT EXISTS wa_phone_number_id text;

-- Backfill inbound messages (metadata already carries the value)
UPDATE messages
SET wa_phone_number_id = metadata->>'wa_phone_number_id'
WHERE channel = 'whatsapp'
  AND metadata IS NOT NULL
  AND metadata->>'wa_phone_number_id' IS NOT NULL
  AND wa_phone_number_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_wa_phone_number_id
  ON messages(wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;
