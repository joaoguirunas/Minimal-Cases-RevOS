-- LP PRO™ — Make lp_submissions.page_id nullable
-- Standalone/embedded forms (not tied to a published LP page) also need submission records.
-- The lp-submit edge function sets page_id=null when no _page_id is provided (e.g. Form Builder simulator).

ALTER TABLE public.lp_submissions
  ALTER COLUMN page_id DROP NOT NULL;
