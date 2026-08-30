-- ============================================================
-- Booking Distribution — RLS repair (idempotent)
-- Drop all existing policies on these tables, then recreate.
-- ============================================================

-- Step 1: drop every policy on both tables (dynamic, catches any name)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('booking_rule_sets', 'booking_rules')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Step 2: recreate policies
CREATE POLICY "booking_rule_sets_auth_all"
  ON public.booking_rule_sets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "booking_rules_auth_all"
  ON public.booking_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "booking_rule_sets_anon_read"
  ON public.booking_rule_sets FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "booking_rules_anon_read"
  ON public.booking_rules FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.booking_rule_sets
      WHERE id = booking_rules.rule_set_id AND is_active = true
    )
  );
