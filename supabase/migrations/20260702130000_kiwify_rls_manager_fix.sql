-- KFY-1.1 FIX: correct RLS WRITE policy predicate on the 5 Kiwify tables.
--
-- Bug: 20260702120000 used `user_type = 'gestor'` in the `kiwify_write_managers`
-- policies, but the live domain is CHECK (user_type IN ('admin','manager','user')).
-- 'gestor' never matches → only super_admin could write outside service-role.
-- Fix (additive, not a rollback): recreate the 5 write policies with 'manager'.
--
-- Live-verified (2026-07-02, wotuyxscsfralqpoiyfv): settings_users.user_type is text,
-- CHECK IN ('admin','manager','user'); actual values present: admin, manager.
--
-- Apply: supabase db query --linked --file <this> ; register in schema_migrations.

BEGIN;

DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kiwify_connections','kiwify_webhook_events','kiwify_event_mappings',
    'kiwify_message_automations','kiwify_message_jobs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "kiwify_write_managers" ON public.%I;', t);

    EXECUTE format($p$
      CREATE POLICY "kiwify_write_managers" ON public.%I
        FOR ALL USING (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid() AND su.active = true
                    AND (su.super_admin = true OR su.user_type = 'manager'))
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid() AND su.active = true
                    AND (su.super_admin = true OR su.user_type = 'manager'))
        );$p$, t);
  END LOOP;
END
$rls$;

COMMIT;
