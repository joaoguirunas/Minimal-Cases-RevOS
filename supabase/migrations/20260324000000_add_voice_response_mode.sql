-- Add voice_response_mode to ai_agents
-- 'mirror' (default): respond with audio only when client sends audio
-- 'always': always respond with audio regardless of client input type
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS voice_response_mode text NOT NULL DEFAULT 'mirror'
  CHECK (voice_response_mode IN ('mirror', 'always'));
