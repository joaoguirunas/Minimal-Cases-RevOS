-- Criar função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar tabela para gerenciar módulos do sistema (single-tenant)
CREATE TABLE IF NOT EXISTS public.crm_system_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 1,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_system_modules ENABLE ROW LEVEL SECURITY;

-- Policy: Todos podem visualizar módulos
CREATE POLICY "Todos podem visualizar módulos"
  ON public.crm_system_modules
  FOR SELECT
  USING (true);

-- Policy: Apenas super_admin pode gerenciar módulos
CREATE POLICY "Apenas super_admin pode gerenciar módulos"
  ON public.crm_system_modules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_usuarios
      WHERE auth_user_id = auth.uid()
      AND super_adm = true
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_system_modules_updated_at
  BEFORE UPDATE ON public.crm_system_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir módulos padrão
INSERT INTO public.crm_system_modules (module_key, module_name, ativo, ordem, icon) VALUES
  ('dashboard', 'Dashboard', true, 1, 'BarChart3'),
  ('negocios', 'Negócios', true, 2, 'PieChart'),
  ('conversas', 'Conversas', true, 3, 'MessageCircle'),
  ('clientes', 'Clientes', true, 4, 'Users'),
  ('agendamentos', 'Agendamentos', true, 5, 'Calendar'),
  ('disparos', 'Disparos', true, 6, 'Megaphone')
ON CONFLICT (module_key) DO NOTHING;