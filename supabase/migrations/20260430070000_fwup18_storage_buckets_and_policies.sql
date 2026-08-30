-- fwup18: Garantir buckets de storage e suas RLS policies em todos os tenants.
--
-- Contexto: adm-sync-client cria os buckets via API de storage, mas as RLS
-- policies em storage.objects nunca foram adicionadas ao manifest de
-- client-migrations — logo nenhum tenant as possui. Upload de logo, omni-media
-- e lp-assets falha com 403 para usuários autenticados.
--
-- SET ROLE supabase_storage_admin: necessário em alguns projetos Supabase onde
-- o postgres user não tem permissão direta para criar policies em storage.objects.
-- O postgres user sempre pode fazer SET ROLE para supabase_storage_admin.
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE POLICY.

SET ROLE supabase_storage_admin;

-- ── logos bucket ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('logos', 'logos', true, 5242880)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Public read access for logos" ON storage.objects;
CREATE POLICY "Public read access for logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');

-- ── omni-media bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('omni-media', 'omni-media', true, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "omni_media_authenticated_upload" ON storage.objects;
CREATE POLICY "omni_media_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'omni-media');

DROP POLICY IF EXISTS "omni_media_public_read" ON storage.objects;
CREATE POLICY "omni_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'omni-media');

DROP POLICY IF EXISTS "omni_media_owner_delete" ON storage.objects;
CREATE POLICY "omni_media_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'omni-media');

-- ── lp-assets bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lp-assets', 'lp-assets', true, 5242880)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "lp_assets_upload" ON storage.objects;
CREATE POLICY "lp_assets_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lp-assets');

DROP POLICY IF EXISTS "lp_assets_update" ON storage.objects;
CREATE POLICY "lp_assets_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lp-assets');

DROP POLICY IF EXISTS "lp_assets_delete" ON storage.objects;
CREATE POLICY "lp_assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lp-assets');

DROP POLICY IF EXISTS "lp_assets_select_public" ON storage.objects;
CREATE POLICY "lp_assets_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'lp-assets');

-- ── negocios bucket (arquivos de negócios — privado) ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('negocios', 'negocios', false, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "negocios_authenticated_upload" ON storage.objects;
CREATE POLICY "negocios_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'negocios');

DROP POLICY IF EXISTS "negocios_authenticated_read" ON storage.objects;
CREATE POLICY "negocios_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'negocios');

DROP POLICY IF EXISTS "negocios_authenticated_delete" ON storage.objects;
CREATE POLICY "negocios_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'negocios');

RESET ROLE;
