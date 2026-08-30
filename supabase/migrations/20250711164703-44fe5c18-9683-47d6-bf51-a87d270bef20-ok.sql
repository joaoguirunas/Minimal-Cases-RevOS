
-- Criar tabela motivo_perda
CREATE TABLE public.motivo_perda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar foreign key para tenant
ALTER TABLE public.motivo_perda 
ADD CONSTRAINT fk_motivo_perda_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- Habilitar RLS
ALTER TABLE public.motivo_perda ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view motivos from their tenant" 
  ON public.motivo_perda 
  FOR SELECT 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert motivos in their tenant" 
  ON public.motivo_perda 
  FOR INSERT 
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update motivos from their tenant" 
  ON public.motivo_perda 
  FOR UPDATE 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete motivos from their tenant" 
  ON public.motivo_perda 
  FOR DELETE 
  USING (user_has_tenant_access(tenant_id));

-- Criar trigger para updated_at
CREATE TRIGGER trigger_motivo_perda_updated_at
  BEFORE UPDATE ON public.motivo_perda
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
