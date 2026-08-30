-- Criar função para verificar se WhatsApp existe no tenant específico
CREATE OR REPLACE FUNCTION public.check_whatsapp_exists_in_tenant(
  whatsapp_param text,
  tenant_id_param uuid,
  exclude_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se existe uma pessoa com o WhatsApp no tenant específico
  IF exclude_id_param IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM crm_pessoas 
      WHERE whatsapp = whatsapp_param 
      AND tenant_id = tenant_id_param 
      AND status != 'arquivado'
      AND id != exclude_id_param
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM crm_pessoas 
      WHERE whatsapp = whatsapp_param 
      AND tenant_id = tenant_id_param 
      AND status != 'arquivado'
    );
  END IF;
END;
$$;