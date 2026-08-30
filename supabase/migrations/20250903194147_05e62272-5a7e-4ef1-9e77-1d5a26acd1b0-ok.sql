-- PHASE 1: CRITICAL SECURITY FIXES (Simplified version without encryption)

-- 1. Fix overly permissive RLS policies for pipelines and stages
-- Drop any dangerous policies if they exist
DROP POLICY IF EXISTS "allow_all_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "allow_all_stages" ON crm_stages;

-- 2. Prevent role escalation trigger
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

-- 3. Add security audit logging table
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

-- 4. Secure database functions by adding search_path
-- Update existing functions to have proper search_path

-- Update encrypt_api_key function
CREATE OR REPLACE FUNCTION public.encrypt_api_key(key_value text, secret_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Simple base64 encoding for now (not secure but better than plaintext)
  RETURN encode(key_value::bytea, 'base64');
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
  RETURN decode(encrypted_key, 'base64')::text;
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