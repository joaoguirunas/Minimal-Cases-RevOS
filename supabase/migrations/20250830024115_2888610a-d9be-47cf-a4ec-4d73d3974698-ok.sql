-- Adicionar campo ativo à tabela de tenants se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crm_tenants' 
        AND column_name = 'ativo'
    ) THEN
        ALTER TABLE public.crm_tenants 
        ADD COLUMN ativo boolean NOT NULL DEFAULT true;
    END IF;
END $$;