
-- Primeiro, vamos criar uma nova tabela unificada de usuários
CREATE TABLE public.usuarios_unificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  tipo_usuario tipo_usuario NOT NULL DEFAULT 'usuario_cliente',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Migrar dados da tabela usuarios existente
INSERT INTO public.usuarios_unificados (id, nome, email, senha, tipo_usuario, ativo, created_at, updated_at)
SELECT id, nome, email, senha, tipo_usuario, ativo, created_at, updated_at
FROM public.usuarios;

-- Atualizar as referências na tabela usuario_clientes
ALTER TABLE public.usuario_clientes 
DROP CONSTRAINT IF EXISTS usuario_clientes_usuario_id_fkey;

-- Remover a tabela usuarios antiga
DROP TABLE public.usuarios;

-- Renomear a nova tabela para usuarios
ALTER TABLE public.usuarios_unificados RENAME TO usuarios;

-- Recriar a constraint de foreign key
ALTER TABLE public.usuario_clientes 
ADD CONSTRAINT usuario_clientes_usuario_id_fkey 
FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

-- Habilitar RLS na nova tabela
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Recriar as políticas RLS
CREATE POLICY "Permitir acesso público aos usuários" ON public.usuarios
  FOR ALL USING (true);

-- Recriar o trigger para updated_at
CREATE TRIGGER handle_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
