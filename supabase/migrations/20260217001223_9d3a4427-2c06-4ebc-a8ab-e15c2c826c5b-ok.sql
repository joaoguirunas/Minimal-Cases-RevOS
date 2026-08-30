-- Drop overly permissive storage policies for logos bucket
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;

-- Only admins/gestors can upload logos (company branding)
CREATE POLICY "Admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (
    -- Allow admin/gestor for company logos
    public.is_admin_or_gestor()
    OR
    -- Allow users who own the lead to upload lead attachments (leads/ prefix)
    (
      (storage.foldername(name))[1] = 'leads'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id::text = (storage.foldername(name))[2]
        AND (
          l.users_id = public.get_current_settings_user_id()
          OR l.teams_id IN (
            SELECT team_id FROM public.settings_users_teams
            WHERE user_id = public.get_current_settings_user_id()
          )
          OR public.is_admin_or_gestor()
        )
      )
    )
  )
);

-- Only admins/gestors can delete logos; lead file owners can delete their lead files
CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    public.is_admin_or_gestor()
    OR
    (
      (storage.foldername(name))[1] = 'leads'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id::text = (storage.foldername(name))[2]
        AND (
          l.users_id = public.get_current_settings_user_id()
          OR l.teams_id IN (
            SELECT team_id FROM public.settings_users_teams
            WHERE user_id = public.get_current_settings_user_id()
          )
          OR public.is_admin_or_gestor()
        )
      )
    )
  )
);

-- Only admins/gestors can update logos
CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND public.is_admin_or_gestor()
)
WITH CHECK (
  bucket_id = 'logos'
  AND public.is_admin_or_gestor()
);