-- ============================================================
-- Instagram Automations v2
-- - action_comment_texts: array of comment reply variations (random pick)
-- - action_dm_quick_replies: array of {title} quick reply buttons for DM
-- ============================================================

ALTER TABLE public.instagram_automations
  ADD COLUMN IF NOT EXISTS action_comment_texts   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_dm_quick_replies JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.instagram_automations.action_comment_texts IS
  'Array of comment reply text variations. Runner picks one randomly at send time. Supports {{nome}} variable. App enforces non-empty strings.';

COMMENT ON COLUMN public.instagram_automations.action_dm_quick_replies IS
  'Array of {title: string} quick reply buttons sent with the DM. Meta API limit: max 13 items, max 20 chars per title.';
