-- Drop existing storage policies
DROP POLICY IF EXISTS "Permitir upload de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir visualização de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusão de arquivos" ON storage.objects;

-- Create proper storage policies for negocio-arquivos bucket
CREATE POLICY "Users can upload files to negocio-arquivos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'negocio-arquivos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view files from negocio-arquivos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'negocio-arquivos'
);

CREATE POLICY "Users can delete files from negocio-arquivos"  
ON storage.objects FOR DELETE
USING (
  bucket_id = 'negocio-arquivos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update files from negocio-arquivos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'negocio-arquivos' 
  AND auth.uid() IS NOT NULL
);