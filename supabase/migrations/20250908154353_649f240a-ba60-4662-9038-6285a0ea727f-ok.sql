-- Criar tabela para relacionar agências com usuários globais
CREATE TABLE public.crm_agencia_usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agencia_id UUID NOT NULL,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT crm_agencia_usuarios_unique UNIQUE (agencia_id, usuario_id)
);

-- Adicionar comentário para documentação
COMMENT ON TABLE public.crm_agencia_usuarios IS 'Relaciona agências com usuários globais';

-- Habilitar RLS
ALTER TABLE public.crm_agencia_usuarios ENABLE ROW LEVEL SECURITY;

-- Política RLS para permitir apenas super admins gerenciarem
CREATE POLICY "Super admins can manage agency user relations" 
ON public.crm_agencia_usuarios 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());