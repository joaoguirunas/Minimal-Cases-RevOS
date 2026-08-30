
-- Atualizar a função para permitir que super_adm também possa deletar
CREATE OR REPLACE FUNCTION delete_pessoa_and_related_data(pessoa_id_param UUID, tenant_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o usuário atual é gestor, admin ou super_adm
  IF NOT EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      (tenant_id = tenant_id_param AND (gestor = true OR super_adm = true))
      OR super_adm = true
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores e administradores podem executar esta ação';
  END IF;

  -- Deletar agendamentos relacionados aos negócios da pessoa
  DELETE FROM crm_agendamentos
  WHERE negocio_id IN (
    SELECT id FROM crm_leads 
    WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param
  );

  -- Deletar arquivos dos negócios
  DELETE FROM crm_negocio_arquivos
  WHERE negocio_id IN (
    SELECT id FROM crm_leads 
    WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param
  );

  -- Deletar notas dos negócios
  DELETE FROM crm_negocio_notas
  WHERE negocio_id IN (
    SELECT id FROM crm_leads 
    WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param
  );

  -- Deletar mensagens da pessoa
  DELETE FROM crm_messages
  WHERE pessoa_id = pessoa_id_param AND tenant_id = tenant_id_param;

  -- Deletar negócios da pessoa
  DELETE FROM crm_leads
  WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param;

  -- Deletar relacionamentos pessoa-empresa
  DELETE FROM crm_pessoa_empresas
  WHERE pessoa_id = pessoa_id_param AND tenant_id = tenant_id_param;

  -- Deletar a pessoa
  DELETE FROM crm_pessoas
  WHERE id = pessoa_id_param AND tenant_id = tenant_id_param;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao deletar pessoa e dados relacionados: %', SQLERRM;
END;
$$;

-- Atualizar políticas para incluir super_adm
DROP POLICY IF EXISTS "Gestores e admins podem deletar pessoas" ON crm_pessoas;
CREATE POLICY "Gestores e admins podem deletar pessoas" ON crm_pessoas
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      (tenant_id = crm_pessoas.tenant_id AND (gestor = true OR super_adm = true))
      OR super_adm = true
    )
  )
);

DROP POLICY IF EXISTS "Gestores e admins podem deletar negocios" ON crm_leads;
CREATE POLICY "Gestores e admins podem deletar negocios" ON crm_leads
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      (tenant_id = crm_leads.tenant_id AND (gestor = true OR super_adm = true))
      OR super_adm = true
    )
  )
);

DROP POLICY IF EXISTS "Gestores e admins podem deletar agendamentos" ON crm_agendamentos;
CREATE POLICY "Gestores e admins podem deletar agendamentos" ON crm_agendamentos
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      (tenant_id = crm_agendamentos.tenant_id AND (gestor = true OR super_adm = true))
      OR super_adm = true
    )
  )
);
