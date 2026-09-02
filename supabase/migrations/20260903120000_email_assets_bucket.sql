-- EMAIL-3 — Bucket público de imagens dos e-mails.
--
-- Host canônico das imagens usadas nos templates ({{asset_base}}): bucket
-- público `email-assets` no Storage. URL pública:
--   {SUPABASE_URL}/storage/v1/object/public/email-assets/<arquivo>
--
-- Por que Storage e não public/ do repo ou a Images API do Klaviyo:
--   • repo exige deploy pra cada imagem (não é configurável na UI)
--   • Klaviyo prenderia as imagens a um provider — Resend/SMTP usam as mesmas
--   • upload direto da UI (supabase-js) + reescrita automática no sync

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-assets', 'email-assets', true, 5242880,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email_assets_read') THEN
    CREATE POLICY email_assets_read ON storage.objects FOR SELECT
      USING (bucket_id = 'email-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email_assets_insert') THEN
    CREATE POLICY email_assets_insert ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'email-assets' AND EXISTS (
        SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email_assets_update') THEN
    CREATE POLICY email_assets_update ON storage.objects FOR UPDATE
      USING (bucket_id = 'email-assets' AND EXISTS (
        SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email_assets_delete') THEN
    CREATE POLICY email_assets_delete ON storage.objects FOR DELETE
      USING (bucket_id = 'email-assets' AND EXISTS (
        SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true));
  END IF;
END $$;
