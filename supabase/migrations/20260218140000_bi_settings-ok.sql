-- BI PRO™ — Settings table for Ads OAuth credentials
-- Stores Meta App ID/Secret and Google Client ID/Secret/Developer Token
-- Used by: useBIProSettings hook, bi-meta-oauth edge function, bi-google-oauth edge function
-- Created: 2026-02-18

CREATE TABLE IF NOT EXISTS public.bi_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_app_id           text,
  meta_app_secret       text,              -- Server-only, never sent to client
  google_client_id      text,
  google_client_secret  text,              -- Server-only, never sent to client
  google_developer_token text,             -- Server-only, never sent to client
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS: authenticated users can read/write (gestor check is done at application level)
ALTER TABLE public.bi_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bi_settings_all" ON public.bi_settings;
CREATE POLICY "bi_settings_all"
  ON public.bi_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.bi_settings IS 'BI PRO™: Singleton row — OAuth credentials for Meta Ads and Google Ads integrations';
