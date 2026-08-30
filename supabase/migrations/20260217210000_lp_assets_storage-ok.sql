-- LP PRO™ — Storage bucket for uploaded assets (images, etc.)
-- Creates lp-assets public bucket and RLS policies

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lp-assets',
  'lp-assets',
  true,             -- public so images can be served via CDN URL
  5242880,          -- 5 MB limit per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to upload
CREATE POLICY "lp_assets_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lp-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "lp_assets_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lp-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "lp_assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lp-assets');

-- Allow public (anon) to read all assets (needed for public LP pages)
CREATE POLICY "lp_assets_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'lp-assets');
