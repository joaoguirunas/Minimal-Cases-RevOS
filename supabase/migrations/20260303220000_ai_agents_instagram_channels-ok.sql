-- AI Agents: Split 'instagram' → 'instagram_dm' + 'instagram_post'
-- Drop old constraint and add updated one with new channel types

ALTER TABLE ai_agents
  DROP CONSTRAINT IF EXISTS ai_agents_channel_types_check;

ALTER TABLE ai_agents
  ADD CONSTRAINT ai_agents_channel_types_check
  CHECK (channel_types <@ ARRAY[
    'whatsapp', 'instagram_dm', 'instagram_post', 'email', 'sms'
  ]::text[]);

-- Migrate existing 'instagram' → 'instagram_dm' (DM is the primary use case)
UPDATE ai_agents
SET channel_types = array_replace(channel_types, 'instagram', 'instagram_dm')
WHERE 'instagram' = ANY(channel_types);
