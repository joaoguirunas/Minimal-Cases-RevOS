
-- Criar tabela de clientes primeiro
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  value TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  modulos_ativos JSONB DEFAULT '{"campanhas": false, "reunioes": false, "visitas": false, "reservas": false}'
);

-- Inserir clientes iniciais (migrando dos dados existentes)
INSERT INTO public.clientes (name, value, created_at) VALUES
('Iatize', 'iatize', now()),
('Strider', 'strider', now()),
('Receita Previsível', 'receita-previsivel', now()),
('Viva América', 'viva-america', now());

-- Criar enum para tipos de usuário
CREATE TYPE public.tipo_usuario AS ENUM ('admin_global', 'admin_cliente', 'usuario_cliente');

-- Criar enum para permissões
CREATE TYPE public.permissao_usuario AS ENUM ('admin', 'leitura', 'suporte');

-- Criar tabela de usuários
CREATE TABLE public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  tipo_usuario tipo_usuario NOT NULL DEFAULT 'usuario_cliente',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de relacionamento usuários-clientes
CREATE TABLE public.usuario_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  permissao permissao_usuario NOT NULL DEFAULT 'leitura',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, cliente_id)
);

-- Inserir usuário inicial
INSERT INTO public.usuarios (nome, email, senha, tipo_usuario, ativo)
VALUES ('João Admin', 'joao@iatize.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin_global', true);

-- Habilitar RLS nas tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_clientes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuários
CREATE POLICY "Usuários podem ver próprio perfil" ON public.usuarios
  FOR SELECT USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

CREATE POLICY "Admin global pode inserir usuários" ON public.usuarios
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

CREATE POLICY "Admin global pode atualizar usuários" ON public.usuarios
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

-- Políticas RLS para usuario_clientes
CREATE POLICY "Usuários podem ver seus próprios vínculos" ON public.usuario_clientes
  FOR SELECT USING (usuario_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

CREATE POLICY "Admin global pode inserir vínculos" ON public.usuario_clientes
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

-- Políticas RLS para clientes
CREATE POLICY "Usuários podem ver clientes vinculados" ON public.clientes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
    ) OR
    EXISTS (
      SELECT 1 FROM public.usuario_clientes uc WHERE uc.cliente_id = id AND uc.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admin global pode inserir clientes" ON public.clientes
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

CREATE POLICY "Admin global pode atualizar clientes" ON public.clientes
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

CREATE POLICY "Admin global pode deletar clientes" ON public.clientes
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.tipo_usuario = 'admin_global'
  ));

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at na tabela usuarios
CREATE TRIGGER handle_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
