-- Adiciona coluna target_stage_id na tabela leads_stages_followups
-- para permitir mover leads para uma etapa específica ao executar o followup

ALTER TABLE leads_stages_followups 
ADD COLUMN target_stage_id uuid REFERENCES leads_stages(id) ON DELETE SET NULL;

COMMENT ON COLUMN leads_stages_followups.target_stage_id IS 'Etapa de destino opcional para onde o lead será movido ao executar este followup';