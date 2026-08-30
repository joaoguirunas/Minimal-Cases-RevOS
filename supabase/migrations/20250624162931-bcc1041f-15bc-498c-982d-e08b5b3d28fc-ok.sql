
-- Primeiro, vamos verificar e criar a coluna tipo_usuario se não existir
DO $$ 
BEGIN
    -- Criar o enum tipo_usuario se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_usuario') THEN
        CREATE TYPE tipo_usuario AS ENUM ('gestor', 'atendente');
    END IF;
    
    -- Adicionar coluna tipo_usuario se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'tipo_usuario') THEN
        ALTER TABLE public.usuarios ADD COLUMN tipo_usuario tipo_usuario DEFAULT 'atendente';
    END IF;
END $$;

-- Atualizar a tabela usuarios para suportar o modelo multi-tenant
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id),
ADD COLUMN IF NOT EXISTS super_adm boolean DEFAULT false;

-- Criar tabela de pipelines CRM
CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  cliente_id uuid REFERENCES public.clientes(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de estágios dos pipelines
CREATE TABLE IF NOT EXISTS public.crm_stages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE CASCADE NOT NULL,
  ordem int NOT NULL,
  cor text DEFAULT '#3B82F6',
  ativo boolean DEFAULT true,
  cliente_id uuid REFERENCES public.clientes(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar enums para campos personalizados se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_campo') THEN
        CREATE TYPE tipo_campo AS ENUM ('texto', 'numero', 'data', 'select');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entidade_campo') THEN
        CREATE TYPE entidade_campo AS ENUM ('pessoa', 'empresa', 'negocio');
    END IF;
END $$;

-- Criar tabela de campos personalizados
CREATE TABLE IF NOT EXISTS public.crm_campos_personalizados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public.clientes(id) NOT NULL,
  entidade entidade_campo NOT NULL,
  nome_exibicao text NOT NULL,
  tipo_campo tipo_campo NOT NULL,
  opcoes jsonb DEFAULT '[]'::jsonb,
  obrigatorio boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar função trigger se não existir
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_crm_pipelines') THEN
        CREATE TRIGGER set_timestamp_crm_pipelines
            BEFORE UPDATE ON public.crm_pipelines
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_crm_stages') THEN
        CREATE TRIGGER set_timestamp_crm_stages
            BEFORE UPDATE ON public.crm_stages
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_crm_campos_personalizados') THEN
        CREATE TRIGGER set_timestamp_crm_campos_personalizados
            BEFORE UPDATE ON public.crm_campos_personalizados
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campos_personalizados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pipelines
CREATE POLICY "Gestores podem gerenciar pipelines do cliente" 
  ON public.crm_pipelines 
  FOR ALL 
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE value = current_setting('app.current_client', true)));

-- Políticas RLS para stages
CREATE POLICY "Gestores podem gerenciar stages do cliente" 
  ON public.crm_stages 
  FOR ALL 
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE value = current_setting('app.current_client', true)));

-- Políticas RLS para campos personalizados
CREATE POLICY "Gestores podem gerenciar campos do cliente" 
  ON public.crm_campos_personalizados 
  FOR ALL 
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE value = current_setting('app.current_client', true)));
