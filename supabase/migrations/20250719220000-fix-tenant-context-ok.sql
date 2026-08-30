
-- Função para configurar o tenant context na sessão
CREATE OR REPLACE FUNCTION public.set_config(setting_name text, setting_value text, is_local boolean DEFAULT true)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config(setting_name, setting_value, is_local);
  RETURN setting_value;
END;
$$;

-- Garantir que o tenant_id seja sempre configurado nas queries
CREATE OR REPLACE FUNCTION public.ensure_tenant_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_tenant_id uuid;
BEGIN
  -- Tentar obter o tenant_id do setting atual
  current_tenant_id := current_setting('app.current_tenant_id', true)::uuid;
  
  -- Se não estiver configurado, tentar obter do usuário atual
  IF current_tenant_id IS NULL THEN
    SELECT tenant_id INTO current_tenant_id 
    FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    LIMIT 1;
    
    -- Se encontrou, configurar na sessão
    IF current_tenant_id IS NOT NULL THEN
      PERFORM set_config('app.current_tenant_id', current_tenant_id::text, true);
    END IF;
  END IF;
END;
$$;

-- Atualizar as políticas RLS para serem mais permissivas e usar a nova abordagem
DROP POLICY IF EXISTS "allow_all_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_tenant_isolation" ON public.crm_leads;

CREATE POLICY "crm_leads_user_tenant_access" 
ON public.crm_leads 
FOR ALL 
TO authenticated
USING (
  -- Permitir acesso se o usuário tem acesso ao tenant
  tenant_id IN (
    SELECT COALESCE(
      -- Tenant configurado na sessão
      (current_setting('app.current_tenant_id', true))::uuid,
      -- Tenant do usuário atual
      (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid())
    )
  )
  OR
  -- Super admins têm acesso a tudo
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true
  )
)
WITH CHECK (
  -- Same logic for inserts/updates
  tenant_id IN (
    SELECT COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid())
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true
  )
);

-- Atualizar políticas similares para outras tabelas críticas
DROP POLICY IF EXISTS "allow_all_pessoas" ON public.crm_pessoas;
DROP POLICY IF EXISTS "crm_pessoas_tenant_isolation" ON public.crm_pessoas;

CREATE POLICY "crm_pessoas_user_tenant_access" 
ON public.crm_pessoas 
FOR ALL 
TO authenticated
USING (
  tenant_id IN (
    SELECT COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid())
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid())
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true
  )
);

DROP POLICY IF EXISTS "allow_all_messages" ON public.crm_messages;
DROP POLICY IF EXISTS "messages_tenant_isolation" ON public.crm_messages;

CREATE POLICY "crm_messages_user_tenant_access" 
ON public.crm_messages 
FOR ALL 
TO authenticated
USING (
  tenant_id IN (
    SELECT COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid())
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT COALESCE(
      (current_setting('app.current_tenant_id', true))::uuid,
      (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid())
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true
  )
);
