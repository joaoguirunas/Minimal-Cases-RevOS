-- Allow targeting a specific Instagram post for post_comment automations.
-- NULL = apply to all posts (current behaviour preserved).
ALTER TABLE instagram_automations
  ADD COLUMN IF NOT EXISTS target_post_id text NULL;

-- Partial index — only relevant for post_comment automations targeting a specific post
CREATE INDEX IF NOT EXISTS instagram_automations_post_idx
  ON instagram_automations (target_post_id)
  WHERE target_post_id IS NOT NULL;

COMMENT ON COLUMN instagram_automations.target_post_id IS
  'Instagram post ID to target. NULL = all posts. Only used when trigger_type = ''post_comment''.';
