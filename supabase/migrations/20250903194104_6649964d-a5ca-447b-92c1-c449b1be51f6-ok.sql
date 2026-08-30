-- PHASE 1: CRITICAL SECURITY FIXES (Fixed version)

-- 1. Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add encrypted column for LLM connections
ALTER TABLE crm_llm_connections ADD COLUMN IF NOT EXISTS api_key_encrypted text;

-- 3. Simple encryption function for LLM API keys using a simpler approach
CREATE OR REPLACE FUNCTION public.encrypt_llm_api_key(key_value text, tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use a tenant-specific salt for additional security
  RETURN encode(pgp_sym_encrypt(key_value, concat('llm_', tenant_id::text)), 'base64');
END;
$$;

-- Decrypt function for LLM API keys
CREATE OR REPLACE FUNCTION public.decrypt_llm_api_key(encrypted_key text, tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), concat('llm_', tenant_id::text));
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 4. Migrate existing API keys to encrypted format
UPDATE crm_llm_connections 
SET api_key_encrypted = encrypt_llm_api_key(api_key, tenant_id)
WHERE api_key_encrypted IS NULL AND api_key IS NOT NULL AND api_key != '';

-- 5. Fix overly permissive RLS policies for pipelines and stages
-- Drop any dangerous policies if they exist
DROP POLICY IF EXISTS "allow_all_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "allow_all_stages" ON crm_stages;

-- Ensure proper RLS policies exist for pipelines
DO $$
BEGIN
  -- Check if proper policies already exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Users can view pipelines from their tenant') THEN
    CREATE POLICY "Users can view pipelines from their tenant" 
    ON crm_pipelines 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_pipelines.tenant_id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_pipelines' AND policyname = 'Managers can manage pipelines in their tenant') THEN
    CREATE POLICY "Managers can manage pipelines in their tenant" 
    ON crm_pipelines 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_pipelines.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_pipelines.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
END
$$;

-- Ensure proper RLS policies exist for stages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Users can view stages from their tenant') THEN
    CREATE POLICY "Users can view stages from their tenant" 
    ON crm_stages 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_stages.tenant_id OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'Managers can manage stages in their tenant') THEN
    CREATE POLICY "Managers can manage stages in their tenant" 
    ON crm_stages 
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_stages.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM crm_usuarios 
        WHERE auth_user_id = auth.uid() 
        AND (tenant_id = crm_stages.tenant_id OR super_adm = true)
        AND (gestor = true OR super_adm = true)
        AND ativo = true
      )
    );
  END IF;
END
$$;

-- 6. Prevent role escalation trigger
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
  current_user_is_super_adm boolean;
  current_user_is_gestor boolean;
BEGIN
  -- Get current user info
  SELECT id, super_adm, gestor INTO current_user_id, current_user_is_super_adm, current_user_is_gestor
  FROM crm_usuarios 
  WHERE auth_user_id = auth.uid();
  
  -- If user is trying to modify their own record
  IF NEW.id = current_user_id THEN
    -- Prevent self-escalation to super_adm unless already super_adm
    IF NEW.super_adm = true AND OLD.super_adm = false AND current_user_is_super_adm = false THEN
      RAISE EXCEPTION 'Cannot escalate own super_adm privileges';
    END IF;
    
    -- Prevent self-escalation to gestor unless already super_adm or gestor
    IF NEW.gestor = true AND OLD.gestor = false AND current_user_is_super_adm = false AND current_user_is_gestor = false THEN
      RAISE EXCEPTION 'Cannot escalate own gestor privileges';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON crm_usuarios;
CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE ON crm_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- 7. Add security audit logging table
CREATE TABLE IF NOT EXISTS crm_security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE crm_security_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON crm_security_audit_log;
DROP POLICY IF EXISTS "Managers can view audit logs from their tenant" ON crm_security_audit_log;

CREATE POLICY "Super admins can view all audit logs" 
ON crm_security_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true
    AND ativo = true
  )
);

CREATE POLICY "Managers can view audit logs from their tenant" 
ON crm_security_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND tenant_id = crm_security_audit_log.tenant_id
    AND (gestor = true OR super_adm = true)
    AND ativo = true
  )
);

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_tenant uuid;
  current_user_id uuid;
BEGIN
  SELECT tenant_id, id INTO current_user_tenant, current_user_id
  FROM crm_usuarios 
  WHERE auth_user_id = auth.uid();
  
  INSERT INTO crm_security_audit_log (
    tenant_id, user_id, action, resource_type, resource_id, details
  ) VALUES (
    current_user_tenant, current_user_id, p_action, p_resource_type, p_resource_id, p_details
  );
END;
$$;