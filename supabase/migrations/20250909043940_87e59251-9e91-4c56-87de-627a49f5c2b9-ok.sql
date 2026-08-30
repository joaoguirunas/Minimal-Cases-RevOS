-- Migração para estrutura padrão de agentes IA
-- Atualizar tabela crm_basesconhecimento_chunks

-- 1. Renomear coluna chunk para content
ALTER TABLE crm_basesconhecimento_chunks 
RENAME COLUMN chunk TO content;

-- 2. Adicionar coluna metadata (jsonb)
ALTER TABLE crm_basesconhecimento_chunks 
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Migrar dados existentes para incluir metadata básico
UPDATE crm_basesconhecimento_chunks 
SET metadata = jsonb_build_object(
  'chunk_index', ordem_chunk,
  'doc_id', base_id::text,
  'source', 'base_conhecimento',
  'chunk_size', length(content)
)
WHERE metadata = '{}'::jsonb OR metadata IS NULL;

-- 4. Adicionar índice para busca por metadata
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON crm_basesconhecimento_chunks USING GIN (metadata);

-- 5. Adicionar comentários para documentação
COMMENT ON COLUMN crm_basesconhecimento_chunks.content IS 'Conteúdo do chunk de texto';
COMMENT ON COLUMN crm_basesconhecimento_chunks.metadata IS 'Metadados do chunk incluindo origem, índice, localização, etc.';
COMMENT ON COLUMN crm_basesconhecimento_chunks.embedding IS 'Vetor de embedding para busca semântica';