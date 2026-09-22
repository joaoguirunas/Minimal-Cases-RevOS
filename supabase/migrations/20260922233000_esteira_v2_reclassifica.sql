-- Esteira v2 — reclassificação do histórico (roda uma vez).
--
-- Até hoje todo pedido pago ia para "Recuperado" (1.082 leads) e nenhum lead era
-- marcado ganho/perdido. Aqui:
--   1. recalcula a atribuição de esteira_reconversions contando toques 'queued'
--      (Klaviyo) e aplicando a prova (cupom nosso / clique rastreado / comercial);
--   2. "Recuperado" fica só com prova; o resto vai para "Comprou sozinho";
--   3. status: pago = won, cancelado ("Perdido") = lost.
-- Backup de (lead, etapa, status) antes de mexer. Gatilhos de etapa/conversão
-- desligados na transação: reclassificar não é o lead "entrando" na etapa.

CREATE TABLE IF NOT EXISTS public._bkp_20260922_leads_etapa AS
SELECT id, leads_stages_id, status, won_at, lost_at, now() AS backup_at
FROM public.leads
WHERE leads_pipelines_id = '99269957-2359-4961-82e0-4099c3b033b7';
ALTER TABLE public._bkp_20260922_leads_etapa ENABLE ROW LEVEL SECURITY;

-- ── 1. Atribuição ───────────────────────────────────────────────────────────
WITH t AS (
  SELECT r.id,
    count(q.*) FILTER (WHERE q.channel = 'email')                         AS n_email,
    count(q.*) FILTER (WHERE q.channel = 'sms')                           AS n_sms,
    count(q.*) FILTER (WHERE q.channel NOT IN ('email','sms'))            AS n_wa,
    count(q.*)                                                            AS n_total,
    min(q.fired_at) AS first_at, max(q.fired_at) AS last_at
  FROM public.esteira_reconversions r
  LEFT JOIN public.followup_queue q
    ON q.person_id = r.people_id AND q.status IN ('sent','queued') AND q.fired_at < r.paid_at
  GROUP BY r.id
), p AS (
  SELECT r.id,
    EXISTS (SELECT 1 FROM public.crm_coupons cc
            WHERE cc.code = upper(r.coupon_code) AND cc.source IN ('esteira','agente','comercial')) AS cupom,
    EXISTS (SELECT 1 FROM public.tracked_link_clicks c
            WHERE c.people_id = r.people_id AND c.is_bot = false AND c.is_duplicate = false
              AND c.clicked_at <= r.paid_at AND c.clicked_at >= r.paid_at - interval '7 days') AS clique
  FROM public.esteira_reconversions r
)
UPDATE public.esteira_reconversions r SET
  touches_email = t.n_email, touches_sms = t.n_sms, touches_whatsapp = t.n_wa, touches_total = t.n_total,
  first_touch_at = t.first_at, last_touch_at = t.last_at,
  hours_since_last_touch = CASE WHEN t.last_at IS NULL THEN NULL ELSE extract(epoch FROM (r.paid_at - t.last_at)) / 3600 END,
  attribution_level = CASE WHEN p.cupom THEN 'cupom' WHEN p.clique THEN 'clique'
                           WHEN t.last_at IS NOT NULL AND r.paid_at - t.last_at <= interval '7 days' THEN 'janela' END,
  attributed = p.cupom OR p.clique OR (t.last_at IS NOT NULL AND r.paid_at - t.last_at <= interval '7 days'),
  recovered_by_us = p.cupom OR p.clique OR r.recovered_by IS NOT NULL
FROM t JOIN p ON p.id = t.id
WHERE r.id = t.id;

-- ── 2 e 3. Etapa e status ───────────────────────────────────────────────────
ALTER TABLE public.leads DISABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads DISABLE TRIGGER leads_stage_duplication_trigger;
ALTER TABLE public.leads DISABLE TRIGGER trg_conversion_stage_enter;
ALTER TABLE public.leads DISABLE TRIGGER trg_conversion_lead_won;
ALTER TABLE public.leads DISABLE TRIGGER trg_conversion_lead_lost;

DO $$
DECLARE
  v_pipe uuid := '99269957-2359-4961-82e0-4099c3b033b7';
  v_rec  uuid; v_sozinho uuid; v_perdido uuid;
BEGIN
  SELECT id INTO v_rec     FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Recuperado';
  SELECT id INTO v_sozinho FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Comprou sozinho';
  SELECT id INTO v_perdido FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Perdido';

  -- Pagos sem prova → Comprou sozinho. Prova = reconversão do lead (ou da pessoa,
  -- paga depois do carrinho) com recovered_by_us.
  UPDATE public.leads l
     SET leads_stages_id = v_sozinho
   WHERE l.leads_stages_id = v_rec
     AND NOT EXISTS (
       SELECT 1 FROM public.esteira_reconversions r
        WHERE r.recovered_by_us
          AND (r.lead_id = l.id OR (r.people_id = l.people_id AND r.paid_at >= l.created_at)));

  UPDATE public.leads l
     SET status = 'won',
         won_at = coalesce(l.won_at, (SELECT max(r.paid_at) FROM public.esteira_reconversions r
                                       WHERE r.lead_id = l.id OR r.people_id = l.people_id), now())
   WHERE l.leads_stages_id IN (v_rec, v_sozinho) AND l.status = 'in_progress';

  UPDATE public.leads l
     SET status = 'lost', lost_at = coalesce(l.lost_at, now())
   WHERE l.leads_stages_id = v_perdido AND l.status = 'in_progress';
END $$;

ALTER TABLE public.leads ENABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads ENABLE TRIGGER leads_stage_duplication_trigger;
ALTER TABLE public.leads ENABLE TRIGGER trg_conversion_stage_enter;
ALTER TABLE public.leads ENABLE TRIGGER trg_conversion_lead_won;
ALTER TABLE public.leads ENABLE TRIGGER trg_conversion_lead_lost;
