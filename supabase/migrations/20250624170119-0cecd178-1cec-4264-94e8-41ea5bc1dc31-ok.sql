
-- Primeiro, criar a tabela para usuários globais
CREATE TABLE public.usuarios_globais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Migrar usuários admin_global existentes para a nova tabela
INSERT INTO public.usuarios_globais (nome, email, senha, ativo, created_at, updated_at)
SELECT nome, email, senha, ativo, created_at, updated_at 
FROM public.usuarios 
WHERE tipo_usuario = 'admin_global';

-- Remover usuários admin_global da tabela usuarios
DELETE FROM public.usuarios WHERE tipo_usuario = 'admin_global';

-- Agora podemos adicionar a constraint
ALTER TABLE public.usuarios 
ADD CONSTRAINT check_no_global_users 
CHECK (tipo_usuario != 'admin_global');

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER trigger_usuarios_globais_updated_at
  BEFORE UPDATE ON public.usuarios_globais
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

-- Habilitar RLS na tabela usuarios_globais
ALTER TABLE public.usuarios_globais ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso apenas a super admins (por enquanto permitir tudo para desenvolvimento)
CREATE POLICY "Allow all for development" ON public.usuarios_globais
  FOR ALL USING (true);
