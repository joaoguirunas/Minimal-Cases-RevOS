-- CP-05: Billing & Business Hours columns
-- Adds cost and business_hours_call to call_pro_calls

ALTER TABLE call_pro_calls
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS business_hours_call BOOLEAN;

COMMENT ON COLUMN call_pro_calls.cost IS 'Custo da chamada em BRL, extraído do payload AS call.cost';
COMMENT ON COLUMN call_pro_calls.business_hours_call IS 'Se a chamada foi dentro do horário comercial configurado no AS';
