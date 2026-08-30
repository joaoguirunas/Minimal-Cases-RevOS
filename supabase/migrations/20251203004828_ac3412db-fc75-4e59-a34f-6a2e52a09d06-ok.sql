-- ============================================
-- ETAPA 7: STORAGE BUCKET
-- ============================================

-- Criar bucket para logos (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- Política para leitura pública de logos
CREATE POLICY "Public read access for logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'logos');

-- Política para upload de logos (usuários autenticados)
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
);

-- Política para atualização de logos (usuários autenticados)
CREATE POLICY "Authenticated users can update logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
);

-- Política para deleção de logos (usuários autenticados)
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
);