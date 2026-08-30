-- FWUP-25: Garantir que lead_field_definitions.category aceita todos os valores da UI
-- O constraint original só tinha 'qualificacao' | 'outros'.
-- O baseline correto (20260224001000) já inclui todos os valores — reaplica de forma idempotente.

ALTER TABLE public.lead_field_definitions
  DROP CONSTRAINT IF EXISTS lead_field_definitions_category_check;

ALTER TABLE public.lead_field_definitions
  ADD CONSTRAINT lead_field_definitions_category_check
    CHECK (category IN ('qualificacao', 'contato', 'comercial', 'custom', 'outros'));

-- Campos de origem do lead → categoria 'Personalizado' (custom)
-- Safe: só afeta tenants onde esses campos existem
UPDATE public.lead_field_definitions
  SET category = 'custom'
  WHERE key IN ('recomendante', 'relacao_recomendante', 'relacao_erika', 'nome_evento');
