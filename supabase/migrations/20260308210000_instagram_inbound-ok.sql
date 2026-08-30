-- Instagram DM inbound: add ig_message_id to messages for deduplication
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ig_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_ig_message_id_key
  ON messages (ig_message_id)
  WHERE ig_message_id IS NOT NULL;

COMMENT ON COLUMN messages.ig_message_id IS 'Instagram message ID (mid) for deduplication of inbound DMs';
