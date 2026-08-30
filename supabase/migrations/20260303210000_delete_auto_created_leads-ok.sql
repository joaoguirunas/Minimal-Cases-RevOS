-- ============================================================
-- Cleanup: delete leads auto-created by OMNI PRO send handler
-- These were created with title "Lead - <name>" pattern when
-- an outbound message was sent to a person without a deal.
-- Run in Supabase SQL Editor (service_role bypasses RLS).
-- ============================================================

-- PREVIEW first — check what will be deleted before running DELETE
SELECT id, title, created_at, status
FROM public.leads
WHERE title LIKE 'Lead - %'
ORDER BY created_at DESC;

-- Once confirmed, run the DELETE (uncomment):
-- DELETE FROM public.leads
-- WHERE title LIKE 'Lead - %';
