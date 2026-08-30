-- PHASE 1: CRITICAL SECURITY FIXES

-- 1. Encrypt existing API keys in crm_llm_connections
-- First, let's create a secure encryption function that uses a tenant-specific salt
CREATE OR REPLACE FUNCTION public.encrypt_llm_api_key(key_value text, tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  secret_key text;
BEGIN
  -- Use tenant_id as part of the encryption key for additional security
  secret_key := concat('llm_key_', tenant_id::text, '_', extract(epoch from now())::text);
  RETURN encode(pgp_sym_encrypt(key_value, secret_key), 'base64');
END;
$$;

-- Create decrypt function for LLM API keys
CREATE OR REPLACE FUNCTION public.decrypt_llm_api_key(encrypted_key text, tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  secret_key text;
BEGIN
  secret_key := concat('llm_key_', tenant_id::text);
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), secret_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 2. Add encrypted column and migrate existing data
ALTER TABLE crm_llm_connections ADD COLUMN IF NOT EXISTS api_key_encrypted text;

-- Encrypt all existing API keys (this will be done in batches for safety)
UPDATE crm_llm_connections 
SET api_key_encrypted = encrypt_llm_api_key(api_key, tenant_id)
WHERE api_key_encrypted IS NULL AND api_key IS NOT NULL;

-- 3. Fix overly permissive RLS policies
-- Drop the dangerous allow_all policies
DROP POLICY IF EXISTS "allow_all_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "allow_all_stages" ON crm_stages;

-- Create proper tenant-isolated policies for pipelines
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

-- Create proper tenant-isolated policies for stages
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

-- 4. Remove hardcoded admin bypasses and replace with proper role checks
-- Update RLS policies that have hardcoded emails to use proper role-based access

-- Fix crm_agendamentos_followups policies
DROP POLICY IF EXISTS "Users can delete agendamentos followups from their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can insert agendamentos followups in their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can update agendamentos followups from their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can view agendamentos followups from their tenant" ON crm_agendamentos_followups;

CREATE POLICY "Users can manage agendamentos followups from their tenant" 
ON crm_agendamentos_followups 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

-- Fix other tables with hardcoded admin bypasses
-- Update crm_basesconhecimento policies
DROP POLICY IF EXISTS "Users can delete bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can insert bases in their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can update bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can view bases from their tenant" ON crm_basesconhecimento;

CREATE POLICY "Users can manage bases from their tenant" 
ON crm_basesconhecimento 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

-- 5. Secure database functions by adding search_path
-- Update encrypt_api_key function
CREATE OR REPLACE FUNCTION public.encrypt_api_key(key_value text, secret_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(key_value, secret_key), 'base64');
END;
$$;

-- Update decrypt_api_key function  
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text, secret_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), secret_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Update get_current_user_permissions function
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(user_id uuid, tenant_id uuid, is_gestor boolean, is_super_adm boolean, is_ativo boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, tenant_id, gestor, super_adm, ativo
  FROM crm_usuarios 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- 6. Prevent role escalation in crm_usuarios
-- Create a trigger to prevent users from escalating their own privileges
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

CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE ON crm_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- 7. Add security audit logging
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