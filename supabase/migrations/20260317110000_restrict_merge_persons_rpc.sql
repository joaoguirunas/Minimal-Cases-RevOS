-- ============================================================
-- SEC-2: Restrict merge_persons & find_duplicate_person to service_role
-- ============================================================
-- These RPCs modify the person graph (re-parent messages, mark
-- records as merged). They must NOT be callable by end-users
-- via PostgREST — only edge functions using service_role key.
-- ============================================================

-- Revoke from public roles
REVOKE EXECUTE ON FUNCTION public.merge_persons(uuid, uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.find_duplicate_person(uuid, text, text, text, text, text)
  FROM public, anon, authenticated;

-- Grant only to service_role (edge functions + pg_cron)
GRANT EXECUTE ON FUNCTION public.merge_persons(uuid, uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.find_duplicate_person(uuid, text, text, text, text, text)
  TO service_role;
