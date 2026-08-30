-- Instagram Automations v2
-- Adds action_comment_texts (jsonb array) and action_dm_quick_replies (jsonb array)
-- Already applied to DB as version 20260312022045

ALTER TABLE public.instagram_automations
  ADD COLUMN IF NOT EXISTS action_comment_texts   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_dm_quick_replies JSONB NOT NULL DEFAULT '[]'::jsonb;
