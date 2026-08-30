-- Data deletion requests (LGPD / Meta compliance)
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  protocol text NOT NULL DEFAULT ('DEL-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Allow anonymous inserts (public form, no auth)
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_deletion_requests" ON public.data_deletion_requests;
CREATE POLICY "anon_insert_deletion_requests"
  ON public.data_deletion_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only authenticated (admin) can read/update
DROP POLICY IF EXISTS "authenticated_full_access_deletion_requests" ON public.data_deletion_requests;
CREATE POLICY "authenticated_full_access_deletion_requests"
  ON public.data_deletion_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
