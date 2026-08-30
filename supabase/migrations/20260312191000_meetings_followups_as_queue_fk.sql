-- CP-15a: FK para fila AS em meetings_followups
ALTER TABLE meetings_followups
  ADD COLUMN IF NOT EXISTS as_queue_id UUID REFERENCES call_pro_as_queues(id) ON DELETE SET NULL;
