
-- Alterar a tabela crm_agendamentos para referenciar negócio ao invés de pessoa
ALTER TABLE public.crm_agendamentos DROP CONSTRAINT IF EXISTS fk_agendamentos_pessoa;
ALTER TABLE public.crm_agendamentos DROP COLUMN pessoa_id;
ALTER TABLE public.crm_agendamentos ADD COLUMN negocio_id uuid NOT NULL;

-- Adicionar foreign key para negócio
ALTER TABLE public.crm_agendamentos 
ADD CONSTRAINT fk_agendamentos_negocio 
FOREIGN KEY (negocio_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX idx_agendamentos_negocio_id ON public.crm_agendamentos(negocio_id);

-- Atualizar as políticas RLS para usar negócio
DROP POLICY IF EXISTS "Users can view agendamentos from their tenant" ON public.crm_agendamentos;
DROP POLICY IF EXISTS "Users can insert agendamentos in their tenant" ON public.crm_agendamentos;
DROP POLICY IF EXISTS "Users can update agendamentos in their tenant" ON public.crm_agendamentos;
DROP POLICY IF EXISTS "Users can delete agendamentos in their tenant" ON public.crm_agendamentos;

-- Recriar políticas RLS
CREATE POLICY "Users can view agendamentos from their tenant" 
ON public.crm_agendamentos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can insert agendamentos in their tenant" 
ON public.crm_agendamentos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can update agendamentos in their tenant" 
ON public.crm_agendamentos 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can delete agendamentos in their tenant" 
ON public.crm_agendamentos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos.tenant_id OR super_adm = true)
  )
);
