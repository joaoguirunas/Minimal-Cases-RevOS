-- Criar tabela whatsapp_templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  id_template TEXT NOT NULL,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  json_data JSONB NULL,
  CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id),
  CONSTRAINT unique_whatsapp_template_slug UNIQUE (slug)
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Política: Apenas super admins podem inserir/atualizar/deletar
CREATE POLICY "whatsapp_templates_admin_write"
ON public.whatsapp_templates
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Política: Todos podem visualizar
CREATE POLICY "whatsapp_templates_read"
ON public.whatsapp_templates
FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();