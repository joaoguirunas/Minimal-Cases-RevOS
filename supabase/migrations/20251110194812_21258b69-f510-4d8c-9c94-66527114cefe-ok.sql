-- Criar tabela de configurações gerais
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  logo_url text,
  whatsapp_provider text DEFAULT 'whatsapp-oficial',
  primary_color text DEFAULT '#6366f1',
  secondary_color text DEFAULT '#8b5cf6',
  accent_color text DEFAULT '#ec4899',
  timezone text DEFAULT 'America/Sao_Paulo',
  language text DEFAULT 'pt-br',
  currency text DEFAULT 'BRL',
  tax_id text,
  website text,
  email text,
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Política RLS para leitura autenticada
CREATE POLICY "authenticated_read" ON public.settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Política RLS para escrita autenticada
CREATE POLICY "authenticated_write" ON public.settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Criar bucket de storage para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir uploads autenticados
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Política para atualização de logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos')
WITH CHECK (bucket_id = 'logos');

-- Política para leitura pública de logos
CREATE POLICY "Public can read logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Política para deletar logos autenticados
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos');

-- Inserir configuração padrão inicial (apenas se a tabela estiver vazia)
INSERT INTO public.settings (company_name)
SELECT 'Minha Empresa'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);