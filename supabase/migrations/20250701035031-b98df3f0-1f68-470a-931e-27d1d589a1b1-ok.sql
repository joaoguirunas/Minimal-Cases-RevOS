
-- Criar tabela crm_agendamentos
CREATE TABLE public.crm_agendamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  pessoa_id uuid NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  origem text DEFAULT 'manual',
  status text DEFAULT 'agendado',
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  id_calendar text
);

-- Criar tabela crm_horarios
CREATE TABLE public.crm_horarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar foreign keys para crm_agendamentos
ALTER TABLE public.crm_agendamentos 
ADD CONSTRAINT fk_agendamentos_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_agendamentos 
ADD CONSTRAINT fk_agendamentos_pessoa 
FOREIGN KEY (pessoa_id) REFERENCES public.crm_pessoas(id) ON DELETE CASCADE;

ALTER TABLE public.crm_agendamentos 
ADD CONSTRAINT fk_agendamentos_usuario 
FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id) ON DELETE SET NULL;

-- Adicionar foreign keys para crm_horarios
ALTER TABLE public.crm_horarios 
ADD CONSTRAINT fk_horarios_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.crm_horarios 
ADD CONSTRAINT fk_horarios_usuario 
FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id) ON DELETE CASCADE;

-- Habilitar Row Level Security (RLS) para ambas as tabelas
ALTER TABLE public.crm_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_horarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para crm_agendamentos
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

-- Políticas RLS para crm_horarios
CREATE POLICY "Users can view horarios from their tenant" 
ON public.crm_horarios 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_horarios.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can insert horarios in their tenant" 
ON public.crm_horarios 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_horarios.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can update horarios in their tenant" 
ON public.crm_horarios 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_horarios.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can delete horarios in their tenant" 
ON public.crm_horarios 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_horarios.tenant_id OR super_adm = true)
  )
);

-- Criar índices para melhor performance
CREATE INDEX idx_agendamentos_tenant_id ON public.crm_agendamentos(tenant_id);
CREATE INDEX idx_agendamentos_pessoa_id ON public.crm_agendamentos(pessoa_id);
CREATE INDEX idx_agendamentos_usuario_id ON public.crm_agendamentos(usuario_id);
CREATE INDEX idx_agendamentos_data ON public.crm_agendamentos(data);
CREATE INDEX idx_agendamentos_status ON public.crm_agendamentos(status);

CREATE INDEX idx_horarios_tenant_id ON public.crm_horarios(tenant_id);
CREATE INDEX idx_horarios_usuario_id ON public.crm_horarios(usuario_id);
CREATE INDEX idx_horarios_dia_semana ON public.crm_horarios(dia_semana);
CREATE INDEX idx_horarios_ativo ON public.crm_horarios(ativo);
