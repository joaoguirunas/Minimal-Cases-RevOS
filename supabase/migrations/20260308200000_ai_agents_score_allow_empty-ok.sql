-- =============================================================================
-- AI Agents: Add score_allow_empty boolean column
-- Fixes: score_matrix_ids uuid[] can't store '__empty__' sentinel string
-- The sentinel is now stored as a dedicated boolean flag.
-- =============================================================================

ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS score_allow_empty boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ai_agents.score_allow_empty IS
  'When true, the G2 score gate also fires for leads with no score (null/0). Replaces the __empty__ string sentinel that was illegally stored in the uuid[] score_matrix_ids array.';
