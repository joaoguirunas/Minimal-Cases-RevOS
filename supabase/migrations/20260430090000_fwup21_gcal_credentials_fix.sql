-- FWUP-21: Fix Google Calendar credentials save in new tenants
--
-- Two root causes:
-- 1. settings table has no seed row in baseline → useUpdateSettings falls into
--    insert path requiring company_name, but Step4Credentials only sends
--    google_client_id/google_client_secret → throws "company_name é obrigatório"
-- 2. user_calendar_connections has RLS enabled but zero policies in any
--    client migration → frontend reads blocked → connections never appear

-- ── 1. Seed settings row if missing ──────────────────────────────────────────
-- settings has no UNIQUE constraint besides id (PK with gen_random_uuid) so
-- ON CONFLICT DO NOTHING never fires — use WHERE NOT EXISTS to guard instead.
INSERT INTO public.settings (company_name, timezone, language, currency)
SELECT 'Minha Empresa', 'America/Sao_Paulo', 'pt-br', 'BRL'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- ── 2. RLS policies for user_calendar_connections ─────────────────────────────
ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_connection_self" ON public.user_calendar_connections;
CREATE POLICY "calendar_connection_self"
  ON public.user_calendar_connections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND (
          su.id = user_calendar_connections.user_id
          OR su.super_admin = true
          OR su.user_type = 'gestor'
        )
        AND su.active = true
    )
  );
