-- Adicionar coluna pipeline_id na tabela crm_agentes_ia se não existir
DO $$
BEGIN
  -- Verificar se a coluna pipeline_id existe na tabela crm_agentes_ia
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'crm_agentes_ia' 
    AND column_name = 'pipeline_id'
  ) THEN
    -- Adicionar a coluna pipeline_id
    ALTER TABLE public.crm_agentes_ia 
    ADD COLUMN pipeline_id uuid;
    
    RAISE LOG 'Coluna pipeline_id adicionada na tabela crm_agentes_ia';
  ELSE
    RAISE LOG 'Coluna pipeline_id já existe na tabela crm_agentes_ia';
  END IF;
END $$;