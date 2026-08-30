
-- Criar tabela para follow-ups de agendamentos/reuniões
CREATE TABLE IF NOT EXISTS public.crm_agendamentos_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  status_agendamento text NOT NULL CHECK (status_agendamento IN ('agendado', 'compareceu', 'nao_compareceu', 'cancelado')),
  mensagem text,
  atraso_minutos integer NOT NULL DEFAULT 0,
  canal_envio text NOT NULL DEFAULT 'whatsapp_texto',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_agendamentos_followups ENABLE ROW LEVEL SECURITY;

-- Políticas RLS usando a função existente user_has_tenant_access
CREATE POLICY "Users can view agendamentos followups of their tenant" 
ON public.crm_agendamentos_followups 
FOR SELECT 
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create agendamentos followups in their tenant" 
ON public.crm_agendamentos_followups 
FOR INSERT 
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update agendamentos followups of their tenant" 
ON public.crm_agendamentos_followups 
FOR UPDATE 
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete agendamentos followups of their tenant" 
ON public.crm_agendamentos_followups 
FOR DELETE 
USING (public.user_has_tenant_access(tenant_id));

-- Trigger para updated_at
CREATE TRIGGER trigger_updated_at_agendamentos_followups
  BEFORE UPDATE ON public.crm_agendamentos_followups
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
