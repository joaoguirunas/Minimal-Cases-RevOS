
-- Corrigir as políticas RLS da tabela crm_negocio_notas para usar auth_user_id corretamente
DROP POLICY IF EXISTS "Usuários podem inserir notas no seu tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Usuários podem ver notas do seu tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Usuários podem atualizar notas do seu tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Usuários podem deletar notas do seu tenant" ON crm_negocio_notas;

-- Criar políticas corretas usando a função user_has_tenant_access
CREATE POLICY "Users can insert notes in their tenant" 
  ON crm_negocio_notas 
  FOR INSERT 
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can view notes from their tenant" 
  ON crm_negocio_notas 
  FOR SELECT 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update notes from their tenant" 
  ON crm_negocio_notas 
  FOR UPDATE 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete notes from their tenant" 
  ON crm_negocio_notas 
  FOR DELETE 
  USING (user_has_tenant_access(tenant_id));
