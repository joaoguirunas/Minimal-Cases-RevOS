
-- Criar tabela para arquivos dos negócios
CREATE TABLE public.crm_negocio_arquivos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id integer NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  tamanho_arquivo bigint,
  tipo_arquivo text,
  url_arquivo text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.crm_tenants(id),
  usuario_id uuid REFERENCES public.crm_usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para notas dos negócios
CREATE TABLE public.crm_negocio_notas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id integer NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text,
  tenant_id uuid NOT NULL REFERENCES public.crm_tenants(id),
  usuario_id uuid REFERENCES public.crm_usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar bucket para arquivos dos negócios
INSERT INTO storage.buckets (id, name, public) 
VALUES ('negocio-arquivos', 'negocio-arquivos', true);

-- Criar índices para performance
CREATE INDEX idx_crm_negocio_arquivos_negocio_id ON public.crm_negocio_arquivos(negocio_id);
CREATE INDEX idx_crm_negocio_arquivos_tenant_id ON public.crm_negocio_arquivos(tenant_id);
CREATE INDEX idx_crm_negocio_notas_negocio_id ON public.crm_negocio_notas(negocio_id);
CREATE INDEX idx_crm_negocio_notas_tenant_id ON public.crm_negocio_notas(tenant_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER trigger_crm_negocio_arquivos_updated_at
  BEFORE UPDATE ON public.crm_negocio_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_crm_negocio_notas_updated_at
  BEFORE UPDATE ON public.crm_negocio_notas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Políticas RLS para arquivos
ALTER TABLE public.crm_negocio_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver arquivos do seu tenant" 
  ON public.crm_negocio_arquivos 
  FOR SELECT 
  USING (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

CREATE POLICY "Usuários podem inserir arquivos no seu tenant" 
  ON public.crm_negocio_arquivos 
  FOR INSERT 
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

CREATE POLICY "Usuários podem deletar arquivos do seu tenant" 
  ON public.crm_negocio_arquivos 
  FOR DELETE 
  USING (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

-- Políticas RLS para notas
ALTER TABLE public.crm_negocio_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver notas do seu tenant" 
  ON public.crm_negocio_notas 
  FOR SELECT 
  USING (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

CREATE POLICY "Usuários podem inserir notas no seu tenant" 
  ON public.crm_negocio_notas 
  FOR INSERT 
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

CREATE POLICY "Usuários podem atualizar notas do seu tenant" 
  ON public.crm_negocio_notas 
  FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

CREATE POLICY "Usuários podem deletar notas do seu tenant" 
  ON public.crm_negocio_notas 
  FOR DELETE 
  USING (tenant_id IN (SELECT tenant_id FROM public.crm_usuarios WHERE id = auth.uid()));

-- Políticas para o bucket de arquivos
CREATE POLICY "Permitir visualização de arquivos" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'negocio-arquivos');

CREATE POLICY "Permitir upload de arquivos" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'negocio-arquivos');

CREATE POLICY "Permitir exclusão de arquivos" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'negocio-arquivos');
