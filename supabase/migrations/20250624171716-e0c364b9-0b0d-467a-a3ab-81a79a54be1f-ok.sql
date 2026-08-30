
-- Renomear tabela clientes para tenants
ALTER TABLE public.clientes RENAME TO tenants;

-- Renomear coluna cliente_id para tenant_id na tabela usuarios
ALTER TABLE public.usuarios RENAME COLUMN cliente_id TO tenant_id;

-- Renomear coluna cliente_id para tenant_id na tabela crm_pipelines
ALTER TABLE public.crm_pipelines RENAME COLUMN cliente_id TO tenant_id;

-- Renomear coluna cliente_id para tenant_id na tabela crm_stages
ALTER TABLE public.crm_stages RENAME COLUMN cliente_id TO tenant_id;

-- Renomear coluna cliente_id para tenant_id na tabela crm_campos_personalizados
ALTER TABLE public.crm_campos_personalizados RENAME COLUMN cliente_id TO tenant_id;

-- Atualizar as constraints de foreign key para refletir a nova nomenclatura
-- Primeiro removemos as constraints existentes
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_cliente_id_fkey;
ALTER TABLE public.crm_pipelines DROP CONSTRAINT IF EXISTS crm_pipelines_cliente_id_fkey;
ALTER TABLE public.crm_stages DROP CONSTRAINT IF EXISTS crm_stages_cliente_id_fkey;
ALTER TABLE public.crm_campos_personalizados DROP CONSTRAINT IF EXISTS crm_campos_personalizados_cliente_id_fkey;

-- Recriar as constraints com a nova nomenclatura
ALTER TABLE public.usuarios 
ADD CONSTRAINT usuarios_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_pipelines 
ADD CONSTRAINT crm_pipelines_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_stages 
ADD CONSTRAINT crm_stages_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_campos_personalizados 
ADD CONSTRAINT crm_campos_personalizados_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Atualizar as políticas RLS para usar a nova nomenclatura
DROP POLICY IF EXISTS "Gestores podem gerenciar pipelines do cliente" ON public.crm_pipelines;
DROP POLICY IF EXISTS "Gestores podem gerenciar stages do cliente" ON public.crm_stages;
DROP POLICY IF EXISTS "Gestores podem gerenciar campos do cliente" ON public.crm_campos_personalizados;

-- Recriar as políticas com a nova nomenclatura
CREATE POLICY "Gestores podem gerenciar pipelines do tenant" 
  ON public.crm_pipelines 
  FOR ALL 
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE value = current_setting('app.current_tenant', true)));

CREATE POLICY "Gestores podem gerenciar stages do tenant" 
  ON public.crm_stages 
  FOR ALL 
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE value = current_setting('app.current_tenant', true)));

CREATE POLICY "Gestores podem gerenciar campos do tenant" 
  ON public.crm_campos_personalizados 
  FOR ALL 
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE value = current_setting('app.current_tenant', true)));
