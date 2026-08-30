-- Fix security vulnerability: Enable RLS and create proper policies for pipelines and stages tables

-- Enable Row Level Security on crm_pipelines table
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for crm_pipelines table following the same pattern as other tables
CREATE POLICY "Users can view pipelines from their tenant" 
ON public.crm_pipelines 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can insert pipelines in their tenant" 
ON public.crm_pipelines 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can update pipelines from their tenant" 
ON public.crm_pipelines 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can delete pipelines from their tenant" 
ON public.crm_pipelines 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true 
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);

-- Enable Row Level Security on crm_stages table  
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for crm_stages table
CREATE POLICY "Users can view stages from their tenant" 
ON public.crm_stages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can insert stages in their tenant" 
ON public.crm_stages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can update stages from their tenant" 
ON public.crm_stages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Users can delete stages from their tenant" 
ON public.crm_stages 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR (crm_usuarios.super_adm = true)
    ) 
    AND crm_usuarios.ativo = true 
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);