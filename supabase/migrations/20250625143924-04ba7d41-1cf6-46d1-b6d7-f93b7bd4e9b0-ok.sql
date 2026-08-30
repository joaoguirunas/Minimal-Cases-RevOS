
-- Renomear tabela messages para crm_messages
ALTER TABLE public.messages RENAME TO crm_messages;

-- Renomear tabela tenants para crm_tenants
ALTER TABLE public.tenants RENAME TO crm_tenants;

-- Renomear tabela usuarios para crm_usuarios
ALTER TABLE public.usuarios RENAME TO crm_usuarios;

-- Renomear tabela usuarios_globais para crm_usuarios_globais
ALTER TABLE public.usuarios_globais RENAME TO crm_usuarios_globais;

-- Atualizar as constraints de foreign key para refletir os novos nomes das tabelas

-- Para crm_usuarios
ALTER TABLE public.crm_usuarios DROP CONSTRAINT IF EXISTS usuarios_tenant_id_fkey;
ALTER TABLE public.crm_usuarios 
ADD CONSTRAINT crm_usuarios_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Para crm_messages
ALTER TABLE public.crm_messages DROP CONSTRAINT IF EXISTS messages_lead_id_fkey;
ALTER TABLE public.crm_messages DROP CONSTRAINT IF EXISTS messages_tenant_id_fkey;
ALTER TABLE public.crm_messages DROP CONSTRAINT IF EXISTS messages_usuario_id_fkey;

ALTER TABLE public.crm_messages 
ADD CONSTRAINT crm_messages_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE;

ALTER TABLE public.crm_messages 
ADD CONSTRAINT crm_messages_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_messages 
ADD CONSTRAINT crm_messages_usuario_id_fkey 
FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id) ON DELETE SET NULL;

-- Para crm_pipelines
ALTER TABLE public.crm_pipelines DROP CONSTRAINT IF EXISTS crm_pipelines_tenant_id_fkey;
ALTER TABLE public.crm_pipelines 
ADD CONSTRAINT crm_pipelines_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Para crm_stages
ALTER TABLE public.crm_stages DROP CONSTRAINT IF EXISTS crm_stages_tenant_id_fkey;
ALTER TABLE public.crm_stages 
ADD CONSTRAINT crm_stages_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Para crm_campos_personalizados
ALTER TABLE public.crm_campos_personalizados DROP CONSTRAINT IF EXISTS crm_campos_personalizados_tenant_id_fkey;
ALTER TABLE public.crm_campos_personalizados 
ADD CONSTRAINT crm_campos_personalizados_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Para crm_empresas
ALTER TABLE public.crm_empresas DROP CONSTRAINT IF EXISTS crm_empresas_tenant_id_fkey;
ALTER TABLE public.crm_empresas 
ADD CONSTRAINT crm_empresas_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Para crm_pessoas
ALTER TABLE public.crm_pessoas DROP CONSTRAINT IF EXISTS crm_pessoas_tenant_id_fkey;
ALTER TABLE public.crm_pessoas 
ADD CONSTRAINT crm_pessoas_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Para crm_leads
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_tenant_id_fkey;
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_responsavel_fkey;
ALTER TABLE public.crm_leads 
ADD CONSTRAINT crm_leads_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_leads 
ADD CONSTRAINT crm_leads_responsavel_fkey 
FOREIGN KEY (responsavel) REFERENCES public.crm_usuarios(id) ON DELETE SET NULL;

-- Atualizar as políticas RLS para usar os novos nomes das tabelas (se houver)
-- As políticas serão atualizadas automaticamente com a mudança do nome da tabela
