-- =============================================================================
-- FWUP-33: Fix messages RLS — Instagram DMs (lead_id=null) invisible to users
-- =============================================================================
-- Root cause:
--   Policy "users_read_lead_messages" (20260112135432) uses USING clause:
--     is_admin_or_gestor() OR EXISTS (SELECT 1 FROM leads WHERE id = messages.leads_id ...)
--   Instagram DMs and comments are stored with lead_id=NULL (meta-inbound never
--   sets lead_id for IG). The EXISTS always returns false for lead_id=null rows,
--   so non-admin users see zero messages for IG contacts.
--
-- Fix:
--   Replace all restrictive policies on messages with the permissive baseline
--   already established in fwup17_rls_policies_baseline_repair (2026-04-28).
--   Tenant isolation is enforced by Supabase project-level JWT — single-tenant
--   architecture, so USING(true) is correct and safe here.
--
-- Idempotent: all DROPs are IF EXISTS.
-- =============================================================================

-- Drop all known restrictive and stale policies on messages
DROP POLICY IF EXISTS "users_read_lead_messages"    ON public.messages;
DROP POLICY IF EXISTS "users_manage_lead_messages"  ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy"      ON public.messages;
DROP POLICY IF EXISTS "messages_tenant_isolation"   ON public.messages;
DROP POLICY IF EXISTS "authenticated_read"          ON public.messages;
DROP POLICY IF EXISTS "authenticated_write"         ON public.messages;

-- Re-create permissive policies (mirrors fwup17 baseline_repair)
CREATE POLICY "authenticated_read"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_write"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  RAISE NOTICE 'FWUP-33: messages RLS repaired — Instagram DMs now visible to all authenticated users';
END $$;
