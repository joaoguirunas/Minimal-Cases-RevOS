-- Esteira v2 — pipeline que mede de verdade + gatilhos de clique por canal.
-- Spec: docs/superpowers/specs/2026-09-22-esteira-v2-cupom-pessoal-pipeline-design.md
--
-- Nada aqui envia mensagem: as regras novas nascem desligadas (active=false) e a
-- reclassificação roda com os gatilhos de etapa desligados na transação.

-- ── 1. Regras disparadas por clique ─────────────────────────────────────────
-- Até aqui toda regra era "ao entrar na etapa". O toque de clique mora na etapa
-- Engajou (é onde o lead está quando ele sai), mas NÃO pode disparar só porque o
-- lead entrou lá: quem decide é o clique, no canal certo, uma vez na vida.
ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS trigger_on text NOT NULL DEFAULT 'stage';
DO $$ BEGIN
  ALTER TABLE public.leads_stages_followups
    ADD CONSTRAINT leads_stages_followups_trigger_on_chk
    CHECK (trigger_on IN ('stage', 'click_whatsapp', 'click_email'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.leads_stages_followups.trigger_on IS
  'stage = dispara ao entrar na etapa (padrão). click_whatsapp/click_email = só pelo 1º clique da pessoa num link da esteira daquele canal (schedule_esteira_click_touch).';

-- Uma vez na vida, por canal.
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS esteira_click_whatsapp_at timestamptz,
  ADD COLUMN IF NOT EXISTS esteira_click_email_at    timestamptz;

-- ── 2. enqueue_stage_followups ignora regras de clique ──────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_stage_followups(p_stage_id uuid, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_leads int := 0; v_pairs int := 0; v_inserted int := 0;
BEGIN
  CREATE TEMP TABLE _esteira_cand ON COMMIT DROP AS
  WITH lv AS (
    SELECT l.id AS lead_id, l.people_id, l.control,
           CASE WHEN p_dry_run THEN NULL ELSE public.assign_esteira_variant(l.id) END AS variant_id
    FROM public.leads l
    WHERE l.leads_stages_id = p_stage_id AND l.status = 'in_progress' AND coalesce(l.control, '') <> 'sem_fup'
  )
  SELECT lv.lead_id, lv.people_id, f.id AS followup_id, f.type AS channel, f.template_id, f.message, f.subject, lv.variant_id,
         now() + make_interval(days => coalesce(f.days,0), hours => coalesce(f.hours,0), mins => coalesce(f.minutes,0)) AS scheduled_for
  FROM lv
  JOIN public.leads_stages_followups f ON f.leads_stages_id = p_stage_id AND f.active = true AND f.trigger_on = 'stage'
  LEFT JOIN public.clients_people p ON p.id = lv.people_id
  WHERE (f.control IS NULL OR f.control = lv.control)
    AND (f.score_matrix_id IS NULL OR f.score_matrix_id = p.score_matrix_id)
    AND (f.ab_variant_id IS NULL OR f.ab_variant_id = COALESCE(lv.variant_id, (SELECT a.variant_id FROM public.esteira_ab_assignments a JOIN public.esteira_ab_experiments e ON e.id = a.experiment_id WHERE a.lead_id = lv.lead_id AND e.status = 'running' LIMIT 1)))
    AND NOT EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.lead_id = lv.lead_id AND q.followup_id = f.id AND q.status <> 'cancelled');

  SELECT count(DISTINCT lead_id), count(*) INTO v_leads, v_pairs FROM _esteira_cand;
  IF NOT p_dry_run THEN
    INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status, ab_variant_id)
    SELECT followup_id, lead_id, people_id, channel, template_id, message, subject, 'stage', scheduled_for, 'pending', variant_id FROM _esteira_cand;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('leads', v_leads, 'entries', v_pairs, 'inserted', v_inserted, 'dry_run', p_dry_run);
END $function$;

-- ── 3. Agendar o toque de clique ────────────────────────────────────────────
-- Chamado pelo redirecionador `r` no 1º clique humano de um link da esteira.
-- Devolve o motivo em texto (vai pro log do `r`). A marca "já disparou" só é
-- gravada quando o toque de fato entra na fila: regra desligada não queima a vez.
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

  SELECT f.* INTO v_rule
  FROM public.leads_stages_followups f
  JOIN public.leads_stages s ON s.id = f.leads_stages_id
  WHERE s.leads_pipelines_id = v_lead.leads_pipelines_id
    AND f.active = true AND f.trigger_on = 'click_' || p_channel
  ORDER BY f.created_at LIMIT 1;
  IF NOT FOUND THEN RETURN 'sem regra ativa de clique ' || p_channel; END IF;

  -- Uma vez na vida: o UPDATE condicional é a trava (dois cliques simultâneos
  -- não agendam dois toques).
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

-- ── 4. Cupom pessoal: um por pessoa na esteira ──────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS crm_coupons_esteira_um_por_pessoa
  ON public.crm_coupons (people_id) WHERE source = 'esteira' AND people_id IS NOT NULL;

-- ── 5. Pipeline Loja: "Com o comercial" e "Comprou sozinho" ─────────────────
DO $$
DECLARE v_pipe uuid := '99269957-2359-4961-82e0-4099c3b033b7';
BEGIN
  UPDATE public.leads_stages SET name = 'Com o comercial'
   WHERE leads_pipelines_id = v_pipe AND name = 'Em negociação';

  IF NOT EXISTS (SELECT 1 FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Comprou sozinho') THEN
    UPDATE public.leads_stages SET order_index = order_index + 1
     WHERE leads_pipelines_id = v_pipe AND name = 'Perdido';
    INSERT INTO public.leads_stages (name, leads_pipelines_id, order_index, color, active)
    SELECT 'Comprou sozinho', v_pipe, order_index + 1, '#64748B', true
      FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Recuperado';
  END IF;

  -- Pedido pago entra como "Comprou sozinho"; yampi-process-event promove para
  -- "Recuperado" só quando há prova (cupom nosso, clique rastreado, comercial).
  UPDATE public.yampi_event_mappings
     SET target_stage_id = (SELECT id FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Comprou sozinho'),
         updated_at = now()
   WHERE trigger = 'pedido_pago';
END $$;

-- claim_lead procurava a etapa pelo nome antigo.
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid := public.get_current_settings_user_id();
  v_stage uuid;
  v_updated integer;
  v_lead public.leads;
BEGIN
  IF v_me IS NULL OR NOT public.is_commercial() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nao_comercial');
  END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF v_lead.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'fora_do_pool'); END IF;
  SELECT s.id INTO v_stage FROM public.leads_stages s
   WHERE s.leads_pipelines_id = v_lead.leads_pipelines_id AND s.name = 'Com o comercial' LIMIT 1;
  IF v_stage IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'fora_do_pool'); END IF;

  -- Assumir é a ÚNICA escrita legítima do comercial em user_id/claimed_at; o trigger
  -- leads_comercial_guard (5b-bis) barra as demais. Válvula local à transação.
  PERFORM set_config('app.bypass_comercial_guard', 'on', true);
  UPDATE public.leads l
     SET user_id = v_me, claimed_at = now(), leads_stages_id = v_stage
   WHERE l.id = p_lead_id AND l.user_id IS NULL AND public.commercial_pool_lead(l);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  PERFORM set_config('app.bypass_comercial_guard', 'off', true);
  IF v_updated = 1 THEN RETURN jsonb_build_object('ok', true); END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF v_lead.user_id IS NOT NULL AND v_lead.user_id <> v_me THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ja_assumido');
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'fora_do_pool');
END $function$

;

-- ── 6. Reconversão: prova explícita ─────────────────────────────────────────
-- attributed (qualquer nível, inclusive "janela") continua existindo e vira o
-- "influenciado" do BI. recovered_by_us = só com prova.
ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS recovered_by_us boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.esteira_reconversions.recovered_by_us IS
  'Recuperado por nós COM PROVA: cupom nosso usado, clique rastreado antes de pagar (7d) ou atribuição ao comercial. Só-janela (recebeu mensagem) não conta.';
