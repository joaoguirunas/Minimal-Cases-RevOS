-- =============================================
-- FOLLOW-UPS PRO™ v2 — Webhook event type
-- Adiciona tipo 'followup' e 'lead_etapa'
-- (lead_etapa já pode existir de migration anterior)
-- =============================================

-- Remover constraint existente (se houver) e recriar com todos os tipos
ALTER TABLE public.webhooks
  DROP CONSTRAINT IF EXISTS webhooks_event_type_check,
  DROP CONSTRAINT IF EXISTS check_event_type;

ALTER TABLE public.webhooks
  ADD CONSTRAINT webhooks_event_type_check
  CHECK (event_type IN (
    'conversa',
    'disparo',
    'novo_lead',
    'lead_etapa',
    'followup'
  ));

COMMENT ON COLUMN public.webhooks.event_type IS
  'Tipo de evento: conversa|disparo|novo_lead|lead_etapa|followup';
