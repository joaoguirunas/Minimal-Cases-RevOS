-- Verificar se a função is_super_admin existe e criar se necessário
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar as políticas RLS para crm_agencias para permitir que usuários super_adm e gestores possam atualizar
DROP POLICY IF EXISTS "Super admins can manage agencies" ON crm_agencias;

CREATE POLICY "Super admins can manage agencies" ON crm_agencias
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND (super_adm = true OR gestor = true)
      AND ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND (super_adm = true OR gestor = true)
      AND ativo = true
    )
  );