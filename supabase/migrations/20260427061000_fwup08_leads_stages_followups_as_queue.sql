-- FWUP-08: Adicionar as_queue_id em leads_stages_followups
-- FK opcional para as_queues (Discador Atende Simples).
-- Usado quando canal='ligacao' em followups de stage.

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS as_queue_id uuid REFERENCES public.call_pro_as_queues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_stages_fup_as_queue
  ON public.leads_stages_followups (as_queue_id)
  WHERE as_queue_id IS NOT NULL;
