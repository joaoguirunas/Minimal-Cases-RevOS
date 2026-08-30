-- ============================================================
-- Instagram comment automation — one reply per comment
-- ============================================================
-- A single Instagram comment can match MULTIPLE active automations. Each one
-- independently posted a public comment reply AND tried to DM the commenter.
-- Meta allows many public replies but only ONE DM per comment, so the result was:
-- two+ different public replies ("Mandei", "Mandei lá") plus a string of
-- "comment already has a reply — DM skipped (Meta 2534023)" log entries.
-- Webhook retries (Meta re-delivers on slow ACK) compounded it, but the core
-- cause is several automations acting on the same comment.
--
-- Fix: exactly one automation may act per comment (highest priority wins).
-- This unique partial index — keyed on ig_message_id alone for post_comment rows —
-- lets the runner claim a comment atomically with INSERT ... ON CONFLICT DO NOTHING
-- before any automation executes. Subsequent automations and webhook retries
-- conflict on the index and skip without sending anything.

-- Collapse pre-existing duplicate post_comment rows (created by the bug) so the
-- unique index can be built. Keep the earliest-executed row per comment.
DELETE FROM public.instagram_automation_log a
USING public.instagram_automation_log b
WHERE a.trigger_type = 'post_comment'
  AND b.trigger_type = 'post_comment'
  AND a.ig_message_id IS NOT DISTINCT FROM b.ig_message_id
  AND a.ig_message_id IS NOT NULL
  AND (a.executed_at, a.id) > (b.executed_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS instagram_automation_log_comment_claim_idx
  ON public.instagram_automation_log (ig_message_id)
  WHERE trigger_type = 'post_comment';
