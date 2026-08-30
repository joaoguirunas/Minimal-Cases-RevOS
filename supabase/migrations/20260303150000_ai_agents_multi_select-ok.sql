-- =============================================================================
-- AI Agents: Add channel_types[] and stage_ids[] for multi-select routing
-- Replaces single wa_channel_id / leads_stages_id with arrays so one agent
-- can cover multiple channels and multiple pipeline stages.
-- =============================================================================

ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS channel_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage_ids     text[] NOT NULL DEFAULT '{}';

-- Backfill: promote the existing single leads_stages_id into stage_ids[]
UPDATE ai_agents
SET stage_ids = ARRAY[leads_stages_id]
WHERE leads_stages_id IS NOT NULL
  AND (stage_ids IS NULL OR stage_ids = '{}');

-- Constraint: only allow valid channel values
ALTER TABLE ai_agents
  ADD CONSTRAINT ai_agents_channel_types_check
  CHECK (channel_types <@ ARRAY['whatsapp', 'instagram', 'email', 'sms']::text[]);

-- GIN indexes for efficient array overlap (&&) queries used in conflict detection
CREATE INDEX IF NOT EXISTS ai_agents_channel_types_gin
  ON ai_agents USING GIN (channel_types);

CREATE INDEX IF NOT EXISTS ai_agents_stage_ids_gin
  ON ai_agents USING GIN (stage_ids);
