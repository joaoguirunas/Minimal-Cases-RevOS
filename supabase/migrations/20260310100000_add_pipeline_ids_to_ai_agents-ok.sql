-- Add pipeline_ids array column to support multi-pipeline routing in AI Agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS pipeline_ids text[] DEFAULT NULL;

-- Backfill from existing pipeline_id
UPDATE ai_agents
SET pipeline_ids = ARRAY[pipeline_id]
WHERE pipeline_id IS NOT NULL
  AND (pipeline_ids IS NULL OR pipeline_ids = '{}');
