-- Adicionar coluna logo_url à tabela crm_tenants
ALTER TABLE crm_tenants ADD COLUMN logo_url TEXT;

-- Criar bucket para armazenar logos dos tenants
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-logos', 'tenant-logos', true);

-- Criar políticas RLS para o bucket tenant-logos
-- Permitir visualização pública dos logos
CREATE POLICY "Tenant logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tenant-logos');

-- Apenas gestores/super admins podem fazer upload de logos
CREATE POLICY "Managers can upload tenant logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'tenant-logos' 
  AND EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (gestor = true OR super_adm = true) 
    AND ativo = true
  )
);

-- Apenas gestores/super admins podem atualizar logos
CREATE POLICY "Managers can update tenant logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'tenant-logos' 
  AND EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (gestor = true OR super_adm = true) 
    AND ativo = true
  )
);

-- Apenas gestores/super admins podem deletar logos
CREATE POLICY "Managers can delete tenant logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'tenant-logos' 
  AND EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (gestor = true OR super_adm = true) 
    AND ativo = true
  )
);