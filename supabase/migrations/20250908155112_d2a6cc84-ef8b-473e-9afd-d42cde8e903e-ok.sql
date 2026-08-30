-- Adicionar foreign keys para a tabela crm_agencia_usuarios
ALTER TABLE public.crm_agencia_usuarios
ADD CONSTRAINT fk_agencia_usuarios_agencia
FOREIGN KEY (agencia_id) REFERENCES public.crm_agencias(id) ON DELETE CASCADE;

ALTER TABLE public.crm_agencia_usuarios
ADD CONSTRAINT fk_agencia_usuarios_usuario
FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id) ON DELETE CASCADE;

-- Também adicionar foreign key na tabela crm_agencia_tenants se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_agencia_tenants_agencia'
    ) THEN
        ALTER TABLE public.crm_agencia_tenants
        ADD CONSTRAINT fk_agencia_tenants_agencia
        FOREIGN KEY (agencia_id) REFERENCES public.crm_agencias(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_agencia_tenants_tenant'
    ) THEN
        ALTER TABLE public.crm_agencia_tenants
        ADD CONSTRAINT fk_agencia_tenants_tenant
        FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;
    END IF;
END $$;