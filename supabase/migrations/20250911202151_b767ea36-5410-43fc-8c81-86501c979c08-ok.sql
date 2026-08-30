-- CORREÇÃO CRÍTICA DE SEGURANÇA: Habilitar RLS em tabelas do tenant Iatize
-- Erro: Múltiplas tabelas estão públicas sem Row Level Security

-- 1. HABILITAR RLS na tabela crm_pessoas
ALTER TABLE public.crm_pessoas ENABLE ROW LEVEL SECURITY;

-- 2. HABILITAR RLS na tabela crm_empresas  
ALTER TABLE public.crm_empresas ENABLE ROW LEVEL SECURITY;

-- 3. HABILITAR RLS na tabela crm_leads
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- 4. HABILITAR RLS na tabela crm_messages
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;

-- 5. HABILITAR RLS na tabela crm_negocio_notas
ALTER TABLE public.crm_negocio_notas ENABLE ROW LEVEL SECURITY;

-- 6. HABILITAR RLS na tabela crm_agendamentos
ALTER TABLE public.crm_agendamentos ENABLE ROW LEVEL SECURITY;

-- 7. HABILITAR RLS na tabela crm_negocio_arquivos
ALTER TABLE public.crm_negocio_arquivos ENABLE ROW LEVEL SECURITY;

-- VERIFICAR SE TODAS AS POLÍTICAS NECESSÁRIAS EXISTEM
-- Se não existirem, criar políticas básicas de segurança

-- Políticas para crm_pessoas (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_pessoas' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_pessoas_tenant_isolation_select"
        ON public.crm_pessoas
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_pessoas_tenant_isolation_insert"
        ON public.crm_pessoas
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_pessoas_tenant_isolation_update"
        ON public.crm_pessoas
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_pessoas_tenant_isolation_delete"
        ON public.crm_pessoas
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_pessoas.tenant_id OR super_adm = true)
            AND ativo = true
            AND (gestor = true OR super_adm = true)
          )
        );
    END IF;
END $$;

-- Políticas para crm_empresas (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_empresas' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_empresas_tenant_isolation_select"
        ON public.crm_empresas
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_empresas_tenant_isolation_insert"
        ON public.crm_empresas
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_empresas_tenant_isolation_update"
        ON public.crm_empresas
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_empresas_tenant_isolation_delete"
        ON public.crm_empresas
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
            AND ativo = true
            AND (gestor = true OR super_adm = true)
          )
        );
    END IF;
END $$;

-- Políticas para crm_leads (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_leads' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_leads_tenant_isolation_select"
        ON public.crm_leads
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_leads.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_leads_tenant_isolation_insert"
        ON public.crm_leads
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_leads.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_leads_tenant_isolation_update"
        ON public.crm_leads
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_leads.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );

        CREATE POLICY "crm_leads_tenant_isolation_delete"
        ON public.crm_leads
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_leads.tenant_id OR super_adm = true)
            AND ativo = true
            AND (gestor = true OR super_adm = true)
          )
        );
    END IF;
END $$;

-- Políticas para crm_messages (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_messages' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_messages_tenant_isolation"
        ON public.crm_messages
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_messages.tenant_id OR super_adm = true)
            AND ativo = true
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_messages.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );
    END IF;
END $$;

-- Políticas para crm_negocio_notas (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_negocio_notas' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_negocio_notas_tenant_isolation"
        ON public.crm_negocio_notas
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_negocio_notas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_negocio_notas.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );
    END IF;
END $$;

-- Políticas para crm_agendamentos (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_agendamentos' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_agendamentos_tenant_isolation"
        ON public.crm_agendamentos
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_agendamentos.tenant_id OR super_adm = true)
            AND ativo = true
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_agendamentos.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );
    END IF;
END $$;

-- Políticas para crm_negocio_arquivos (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_negocio_arquivos' 
        AND policyname LIKE '%tenant%'
    ) THEN
        CREATE POLICY "crm_negocio_arquivos_tenant_isolation"
        ON public.crm_negocio_arquivos
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_negocio_arquivos.tenant_id OR super_adm = true)
            AND ativo = true
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios
            WHERE auth_user_id = auth.uid()
            AND (tenant_id = crm_negocio_arquivos.tenant_id OR super_adm = true)
            AND ativo = true
          )
        );
    END IF;
END $$;