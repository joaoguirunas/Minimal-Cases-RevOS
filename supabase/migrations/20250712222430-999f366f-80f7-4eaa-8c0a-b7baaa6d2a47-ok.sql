
-- Adicionar foreign keys que estão faltando na tabela crm_usuario_times
-- Isso permitirá que o Supabase faça as relações automáticas corretamente

-- Primeiro, adicionar foreign key para crm_usuarios
ALTER TABLE public.crm_usuario_times 
ADD CONSTRAINT fk_usuario_times_usuario 
FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id) ON DELETE CASCADE;

-- Segundo, adicionar foreign key para crm_times
ALTER TABLE public.crm_usuario_times 
ADD CONSTRAINT fk_usuario_times_time 
FOREIGN KEY (time_id) REFERENCES public.crm_times(id) ON DELETE CASCADE;

-- Terceiro, adicionar foreign key para crm_tenants
ALTER TABLE public.crm_usuario_times 
ADD CONSTRAINT fk_usuario_times_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Criar índices para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_crm_usuario_times_usuario_id ON public.crm_usuario_times(usuario_id);
CREATE INDEX IF NOT EXISTS idx_crm_usuario_times_time_id ON public.crm_usuario_times(time_id);
CREATE INDEX IF NOT EXISTS idx_crm_usuario_times_tenant_id ON public.crm_usuario_times(tenant_id);
