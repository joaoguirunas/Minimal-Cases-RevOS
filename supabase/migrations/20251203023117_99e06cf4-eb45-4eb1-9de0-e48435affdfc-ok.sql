-- Tabela de relacionamento pessoas-empresas
CREATE TABLE public.clients_people_companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  people_id uuid REFERENCES public.clients_people(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.clients_companies(id) ON DELETE CASCADE,
  role text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(people_id, company_id)
);

-- Índices para performance
CREATE INDEX idx_people_companies_people ON public.clients_people_companies(people_id);
CREATE INDEX idx_people_companies_company ON public.clients_people_companies(company_id);

-- Habilitar RLS
ALTER TABLE public.clients_people_companies ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "authenticated_read" ON public.clients_people_companies FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people_companies FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_clients_people_companies_updated_at
  BEFORE UPDATE ON public.clients_people_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();