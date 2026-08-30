-- Enable RLS on settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT settings
CREATE POLICY "Allow authenticated users to read settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to UPDATE settings
CREATE POLICY "Allow authenticated users to update settings"
ON public.settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to INSERT settings (for first setup)
CREATE POLICY "Allow authenticated users to insert settings"
ON public.settings
FOR INSERT
TO authenticated
WITH CHECK (true);