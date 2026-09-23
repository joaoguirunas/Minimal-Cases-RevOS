-- Esteira Validação · Fase 2 — teste da v2 com os carrinhos de 15 a 21/09.
--
-- 1. Status 'held' na fila: toque agendado que o worker NÃO pega (ele só
--    reivindica 'pending'). O lote inteiro é montado assim e liberado de uma vez
--    no go (held → pending, horários recalculados a partir do momento do go).
-- 2. Toque de clique só para quem está na esteira v2 (tem toque de cupom pessoal
--    na fila). A Fase 1 (v1) continua recebendo cliques sem disparar nada novo.
-- 3. Tags "Fase 1" / "Fase 2" para filtrar o pipeline.
-- 4. WhatsApp da esteira com no mínimo 120 s entre um envio e outro.

ALTER TABLE public.followup_queue DROP CONSTRAINT IF EXISTS followup_queue_status_check;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_status_check
  CHECK (status IN ('held', 'pending', 'processing', 'queued', 'sent', 'failed', 'cancelled'));
COMMENT ON COLUMN public.followup_queue.status IS
  'held = agendado e retido (lote aguardando o go; o worker ignora) · pending = na fila · processing · queued/sent = saiu · failed · cancelled';

CREATE OR REPLACE FUNCTION public.schedule_esteira_click_touch(
  p_lead_id uuid, p_people_id uuid, p_channel text
) RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_lead   record;
  v_stage  text;
  v_rule   record;
  v_col    text;
  v_claimed boolean;
BEGIN
  IF p_channel NOT IN ('whatsapp', 'email') THEN RETURN 'canal sem toque de clique'; END IF;
  IF p_lead_id IS NULL OR p_people_id IS NULL THEN RETURN 'link sem lead/pessoa'; END IF;

  SELECT id, status, leads_pipelines_id, leads_stages_id INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN 'lead não encontrado'; END IF;
  IF v_lead.status <> 'in_progress' THEN RETURN 'lead ' || v_lead.status; END IF;

  SELECT name INTO v_stage FROM public.leads_stages WHERE id = v_lead.leads_stages_id;
  IF v_stage IS NULL OR v_stage NOT IN ('Carrinho abandonado', 'Em recuperação', 'Engajou') THEN
    RETURN 'etapa ' || coalesce(v_stage, '?');
  END IF;

  -- Só quem está na esteira v2 (tem toque de cupom pessoal agendado ou enviado).
  IF NOT EXISTS (
    SELECT 1 FROM public.followup_queue q
    JOIN public.leads_stages_followups f ON f.id = q.followup_id
    WHERE q.lead_id = p_lead_id AND q.status <> 'cancelled' AND f.vars->>'cupom_pessoal' = 'true'
  ) THEN RETURN 'lead fora da esteira v2'; END IF;

  SELECT f.* INTO v_rule
  FROM public.leads_stages_followups f
  JOIN public.leads_stages s ON s.id = f.leads_stages_id
  WHERE s.leads_pipelines_id = v_lead.leads_pipelines_id
    AND f.active = true AND f.trigger_on = 'click_' || p_channel
  ORDER BY f.created_at LIMIT 1;
  IF NOT FOUND THEN RETURN 'sem regra ativa de clique ' || p_channel; END IF;

  v_col := 'esteira_click_' || p_channel || '_at';
  EXECUTE format('UPDATE public.clients_people SET %I = now() WHERE id = $1 AND %I IS NULL RETURNING true', v_col, v_col)
    INTO v_claimed USING p_people_id;
  IF v_claimed IS NOT TRUE THEN RETURN 'já disparou antes'; END IF;

  INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status)
  VALUES (v_rule.id, p_lead_id, p_people_id, v_rule.type, v_rule.template_id, v_rule.message, v_rule.subject, 'stage',
          now() + make_interval(days => coalesce(v_rule.days,0), hours => coalesce(v_rule.hours,0), mins => coalesce(v_rule.minutes,0)),
          'pending');
  RETURN 'agendado';
END $$;
REVOKE EXECUTE ON FUNCTION public.schedule_esteira_click_touch(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.schedule_esteira_click_touch(uuid, uuid, text) TO service_role;

INSERT INTO public.lead_tags (name, color)
SELECT v.name, v.color FROM (VALUES ('Fase 1', '#64748B'), ('Fase 2', '#E8632B')) v(name, color)
WHERE NOT EXISTS (SELECT 1 FROM public.lead_tags t WHERE t.name = v.name);

UPDATE public.omni_channel_configs
   SET settings = coalesce(settings, '{}'::jsonb) || '{"esteira_wa_intervalo_segundos": 120}'::jsonb
 WHERE channel = 'whatsapp';
