
-- Adicionar constraint UNIQUE para prevenir WhatsApp duplicado no mesmo tenant
ALTER TABLE crm_pessoas ADD CONSTRAINT unique_whatsapp_per_tenant 
UNIQUE (whatsapp, tenant_id) 
DEFERRABLE INITIALLY DEFERRED;

-- Função para debug de autenticação nas políticas RLS
CREATE OR REPLACE FUNCTION debug_auth_context()
RETURNS TABLE(
  current_user_id uuid,
  current_tenant_id uuid,
  session_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1) as current_tenant_id,
    (auth.uid() IS NOT NULL) as session_valid;
END;
$$;

-- Melhorar política RLS para crm_leads com debug
DROP POLICY IF EXISTS "crm_leads_tenant_isolation_insert" ON crm_leads;
CREATE POLICY "crm_leads_tenant_isolation_insert" ON crm_leads
FOR INSERT WITH CHECK (
  -- Log do contexto para debug
  (SELECT debug_auth_context()) IS NOT NULL
  AND
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.tenant_id = crm_leads.tenant_id
    AND crm_usuarios.ativo = true
  )
);

-- Função para verificar se WhatsApp já existe (mais robusta)
CREATE OR REPLACE FUNCTION check_whatsapp_duplicate(
  whatsapp_param text, 
  tenant_id_param uuid, 
  exclude_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_result integer;
BEGIN
  -- Verificar se parâmetros são válidos
  IF whatsapp_param IS NULL OR whatsapp_param = '' OR tenant_id_param IS NULL THEN
    RETURN false;
  END IF;
  
  -- Contar registros existentes
  IF exclude_id_param IS NOT NULL THEN
    SELECT COUNT(*) INTO count_result
    FROM crm_pessoas 
    WHERE whatsapp = whatsapp_param 
    AND tenant_id = tenant_id_param 
    AND status != 'arquivado'
    AND id != exclude_id_param;
  ELSE
    SELECT COUNT(*) INTO count_result
    FROM crm_pessoas 
    WHERE whatsapp = whatsapp_param 
    AND tenant_id = tenant_id_param 
    AND status != 'arquivado';
  END IF;
  
  RETURN count_result > 0;
END;
$$;
