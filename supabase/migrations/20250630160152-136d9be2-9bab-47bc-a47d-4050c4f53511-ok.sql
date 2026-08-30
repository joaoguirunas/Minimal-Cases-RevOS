
-- Remover colunas desnecessárias da tabela crm_usuarios
ALTER TABLE crm_usuarios 
DROP COLUMN IF EXISTS tipo_usuario,
DROP COLUMN IF EXISTS usuario_global_id,
DROP COLUMN IF EXISTS role,
DROP COLUMN IF EXISTS admin_global,
DROP COLUMN IF EXISTS senha,
DROP COLUMN IF EXISTS super_adm_tenant;

-- Adicionar coluna auth_user_id para vincular com auth.users do Supabase
ALTER TABLE crm_usuarios 
ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_crm_usuarios_auth_user_id ON crm_usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_usuarios_email ON crm_usuarios(email);

-- Habilitar RLS na tabela crm_usuarios
ALTER TABLE crm_usuarios ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios dados ou dados do tenant
CREATE POLICY "Users can view own data or tenant data" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid() OR 
  (tenant_id IN (
    SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid()
  ) AND (
    EXISTS (SELECT 1 FROM crm_usuarios WHERE auth_user_id = auth.uid() AND (gestor = true OR super_adm = true))
  ))
);

-- Política para atualização
CREATE POLICY "Users can update own data or admins can update tenant data" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM crm_usuarios WHERE auth_user_id = auth.uid() AND super_adm = true)
);

-- Política para inserção (apenas super admins)
CREATE POLICY "Super admins can insert users" ON crm_usuarios
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM crm_usuarios WHERE auth_user_id = auth.uid() AND super_adm = true)
);

-- Política para exclusão (apenas super admins)
CREATE POLICY "Super admins can delete users" ON crm_usuarios
FOR DELETE USING (
  EXISTS (SELECT 1 FROM crm_usuarios WHERE auth_user_id = auth.uid() AND super_adm = true)
);

-- Função para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.crm_usuarios (
    auth_user_id,
    nome,
    email,
    super_adm,
    gestor,
    ativo
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    false,
    false,
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
