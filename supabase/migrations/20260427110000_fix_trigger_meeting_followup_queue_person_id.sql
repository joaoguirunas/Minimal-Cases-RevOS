-- Fix: handle_meeting_followup_queue trigger uses people_id after FWUP-11b renamed to person_id
-- FWUP-11b (20260427100000) renamed meeting_followup_queue.people_id → person_id but
-- did not update the trigger function body. This migration fixes the INSERT reference.

CREATE OR REPLACE FUNCTION public.handle_meeting_followup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status    text;
  rule_rec    record;
  delay_secs  bigint;
BEGIN
  -- Skip if status didn't change on UPDATE
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Normalize meetings.status → meetings_followups.meeting_status
  -- 'não compareceu' (com acento, legado) → 'nao_compareceu' (canônico)
  v_status := CASE NEW.status
    WHEN 'agendada'         THEN 'agendado'
    WHEN 'agendado'         THEN 'agendado'
    WHEN 'compareceu'       THEN 'compareceu'
    WHEN 'nao_compareceu'   THEN 'nao_compareceu'
    WHEN 'não compareceu'   THEN 'nao_compareceu'
    WHEN 'cancelado'        THEN 'cancelado'
    WHEN 'cancelada'        THEN 'cancelado'
    WHEN 'realizado'        THEN 'realizado'
    ELSE NULL
  END;

  -- Status desconhecido — não enfileirar
  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cancelar entradas pendentes anteriores para este meeting (status mudou)
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  -- Criar entrada na fila para cada regra ativa com o status correspondente
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, person_id, leads_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.leads_id,
      now() + (delay_secs * interval '1 second'),
      rule_rec.channel,
      COALESCE(rule_rec.webhook_url, ''),
      rule_rec.message
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_meeting_followup_queue() IS
  'Trigger: enfileira followup rules quando meeting.status muda. '
  'Normaliza status canonical incluindo ''não compareceu'' (legado) → ''nao_compareceu''. '
  'FWUP-07 + fix pós-FWUP-11b: usa person_id (renamed de people_id).';
