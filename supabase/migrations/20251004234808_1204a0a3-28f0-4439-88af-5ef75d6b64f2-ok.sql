-- Criar tabela de configurações gerais
CREATE TABLE IF NOT EXISTS public.crm_configuracoes_gerais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa text NOT NULL,
  logo_url text,
  cor_principal text DEFAULT '#F26B2F',
  cor_secundaria text DEFAULT '#3B82F6',
  cor_destaque text DEFAULT '#6C16F8',
  fuso_horario text DEFAULT 'America/Sao_Paulo',
  idioma text DEFAULT 'pt-br',
  moeda text DEFAULT 'BRL',
  cnpj text,
  website text,
  email text,
  telefone text,
  endereco text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_configuracoes_gerais ENABLE ROW LEVEL SECURITY;

-- Create policy for access
CREATE POLICY "configuracoes_gerais_access_policy" 
ON public.crm_configuracoes_gerais 
FOR ALL 
USING (true);

-- Insert default configuration if not exists
INSERT INTO public.crm_configuracoes_gerais (nome_empresa)
VALUES ('Minha Empresa')
ON CONFLICT DO NOTHING;

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for logos
CREATE POLICY "Logos são publicamente acessíveis" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'logos');

CREATE POLICY "Usuários autenticados podem fazer upload de logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');