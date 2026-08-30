
-- Habilitar extensão pgvector para embeddings vetoriais
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal das bases de conhecimento
CREATE TABLE public.crm_basesconhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  conteudo_original TEXT NOT NULL,
  origem TEXT DEFAULT 'upload_manual' CHECK (origem IN ('upload_manual', 'editado_manual')),
  arquivo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para chunks com embeddings
CREATE TABLE public.crm_basesconhecimento_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES public.crm_basesconhecimento(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  chunk TEXT NOT NULL,
  ordem_chunk INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embeddings dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para otimização
CREATE INDEX idx_basesconhecimento_tenant ON public.crm_basesconhecimento(tenant_id);
CREATE INDEX idx_basesconhecimento_chunks_base ON public.crm_basesconhecimento_chunks(base_id);
CREATE INDEX idx_basesconhecimento_chunks_tenant ON public.crm_basesconhecimento_chunks(tenant_id);
CREATE INDEX idx_basesconhecimento_chunks_embedding ON public.crm_basesconhecimento_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_basesconhecimento
    BEFORE UPDATE ON public.crm_basesconhecimento
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_basesconhecimento_chunks
    BEFORE UPDATE ON public.crm_basesconhecimento_chunks
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.crm_basesconhecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_basesconhecimento_chunks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para crm_basesconhecimento
CREATE POLICY "Users can view bases from their tenant" 
  ON public.crm_basesconhecimento 
  FOR SELECT 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert bases in their tenant" 
  ON public.crm_basesconhecimento 
  FOR INSERT 
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update bases from their tenant" 
  ON public.crm_basesconhecimento 
  FOR UPDATE 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete bases from their tenant" 
  ON public.crm_basesconhecimento 
  FOR DELETE 
  USING (user_has_tenant_access(tenant_id));

-- Políticas RLS para crm_basesconhecimento_chunks
CREATE POLICY "Users can view chunks from their tenant" 
  ON public.crm_basesconhecimento_chunks 
  FOR SELECT 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert chunks in their tenant" 
  ON public.crm_basesconhecimento_chunks 
  FOR INSERT 
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update chunks from their tenant" 
  ON public.crm_basesconhecimento_chunks 
  FOR UPDATE 
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete chunks from their tenant" 
  ON public.crm_basesconhecimento_chunks 
  FOR DELETE 
  USING (user_has_tenant_access(tenant_id));
