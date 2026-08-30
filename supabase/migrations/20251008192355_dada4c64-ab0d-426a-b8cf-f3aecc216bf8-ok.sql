-- Enable RLS on leads_files if not already enabled
ALTER TABLE public.leads_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "leads_files_select_policy" ON public.leads_files;
DROP POLICY IF EXISTS "leads_files_insert_policy" ON public.leads_files;
DROP POLICY IF EXISTS "leads_files_delete_policy" ON public.leads_files;

-- Allow authenticated users to view lead files
CREATE POLICY "leads_files_select_policy"
ON public.leads_files
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert lead files
CREATE POLICY "leads_files_insert_policy"
ON public.leads_files
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete lead files
CREATE POLICY "leads_files_delete_policy"
ON public.leads_files
FOR DELETE
TO authenticated
USING (true);