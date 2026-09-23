-- supabase/migrations/20260924110000_bi_attribution.sql
CREATE TABLE IF NOT EXISTS public.order_attribution (
  order_id          bigint PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  people_id         uuid,
  paid_at           timestamptz NOT NULL,
  value_total       numeric(12,2) NOT NULL,
  class             text NOT NULL CHECK (class IN ('recuperado','influenciado','organico')),
  proof             text CHECK (proof IN ('cupom','clique','comercial')),
  channel           text,
  touch_template    text,
  followup_queue_id uuid,
  recovered_by      uuid,
  recovery_type     text CHECK (recovery_type IN ('carrinho','pix','boleto','cartao_recusado')),
  hours_to_recover  numeric,
  window_days       int NOT NULL DEFAULT 7,
  computed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_attr_paid  ON public.order_attribution (paid_at);
CREATE INDEX IF NOT EXISTS idx_order_attr_class ON public.order_attribution (class, paid_at);
ALTER TABLE public.order_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_attr_staff ON public.order_attribution FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active) AND NOT (SELECT public.is_commercial()));
CREATE POLICY order_attr_comercial ON public.order_attribution FOR SELECT USING (
  (SELECT public.is_commercial()) AND recovered_by = (SELECT public.get_current_settings_user_id()));
CREATE POLICY order_attr_service ON public.order_attribution FOR ALL USING (auth.role() = 'service_role');

-- Etapa do toque → tipo de recuperação
CREATE OR REPLACE FUNCTION public._recovery_type(p_stage text, p_payment text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_stage = 'Pagamento recusado' THEN 'cartao_recusado'
    WHEN p_stage = 'Pagamento pendente' THEN CASE WHEN p_payment = 'billet' THEN 'boleto' ELSE 'pix' END
    WHEN p_stage IS NULL THEN NULL
    ELSE 'carrinho' END $$;

CREATE OR REPLACE FUNCTION public.compute_order_attribution(p_order_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  o record; v_coupon boolean := false; v_click record; v_touch record; v_rec_by uuid;
  v_class text := 'organico'; v_proof text; v_channel text; v_tpl text; v_fq uuid; v_stage text; v_hours numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR NOT o.is_paid OR o.paid_at IS NULL THEN
    DELETE FROM public.order_attribution WHERE order_id = p_order_id; RETURN;
  END IF;

  IF o.people_id IS NOT NULL THEN
    -- 1) cupom nosso
    v_coupon := o.coupon_code IS NOT NULL AND EXISTS (SELECT 1 FROM public.crm_coupons c
      WHERE upper(c.code) = upper(o.coupon_code) AND c.source IN ('esteira','agente','comercial'));
    -- 2) clique humano ≤ 7 d antes
    SELECT c.clicked_at, l.channel, l.template_name, l.followup_queue_id INTO v_click
      FROM public.tracked_link_clicks c JOIN public.tracked_links l ON l.id = c.tracked_link_id
     WHERE c.people_id = o.people_id AND NOT c.is_bot AND NOT c.is_duplicate
       AND c.clicked_at <= o.paid_at AND c.clicked_at >= o.paid_at - interval '7 days'
     ORDER BY c.clicked_at DESC LIMIT 1;
    -- 3) comercial (mantém a decisão já gravada pelo yampi-process-event)
    SELECT r.recovered_by INTO v_rec_by FROM public.esteira_reconversions r WHERE r.order_id = o.id::text AND r.recovered_by IS NOT NULL;
    -- último toque ≤ 7 d antes
    SELECT q.id, q.channel, q.fired_at, coalesce(f.subject, q.subject) AS tpl, s.name AS stage INTO v_touch
      FROM public.followup_queue q
      LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
      LEFT JOIN public.leads_stages s ON s.id = f.leads_stages_id
     WHERE q.person_id = o.people_id AND q.status IN ('queued','sent')
       AND q.fired_at < o.paid_at AND q.fired_at >= o.paid_at - interval '7 days'
     ORDER BY q.fired_at DESC LIMIT 1;

    IF v_coupon THEN
      v_class := 'recuperado'; v_proof := 'cupom';
      v_channel := CASE WHEN v_touch.channel = 'email' THEN 'email' WHEN v_touch.channel IS NOT NULL THEN 'whatsapp' END;
    ELSIF v_click.clicked_at IS NOT NULL THEN
      v_class := 'recuperado'; v_proof := 'clique';
      v_channel := CASE WHEN v_click.channel = 'email' THEN 'email' ELSE 'whatsapp' END;
      v_tpl := v_click.template_name;
      SELECT q.id, s.name INTO v_fq, v_stage FROM public.followup_queue q
        LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
        LEFT JOIN public.leads_stages s ON s.id = f.leads_stages_id WHERE q.id = v_click.followup_queue_id;
    ELSIF v_rec_by IS NOT NULL THEN
      v_class := 'recuperado'; v_proof := 'comercial'; v_channel := 'comercial'; v_stage := 'Carrinho abandonado';
    ELSIF v_touch.id IS NOT NULL THEN
      v_class := 'influenciado';
      v_channel := CASE WHEN v_touch.channel = 'email' THEN 'email' ELSE 'whatsapp' END;
    END IF;
    IF v_tpl IS NULL THEN v_tpl := v_touch.tpl; END IF;
    IF v_fq IS NULL THEN v_fq := v_touch.id; END IF;
    IF v_stage IS NULL THEN v_stage := v_touch.stage; END IF;
    IF v_class <> 'organico' THEN
      SELECT extract(epoch FROM (o.paid_at - min(q.fired_at))) / 3600 INTO v_hours FROM public.followup_queue q
       WHERE q.person_id = o.people_id AND q.status IN ('queued','sent') AND q.fired_at < o.paid_at AND q.fired_at >= o.paid_at - interval '7 days';
    END IF;
  END IF;

  INSERT INTO public.order_attribution AS a (order_id, people_id, paid_at, value_total, class, proof, channel, touch_template,
    followup_queue_id, recovered_by, recovery_type, hours_to_recover, computed_at)
  VALUES (o.id, o.people_id, o.paid_at, o.value_total, v_class, v_proof, v_channel,
    CASE WHEN v_class = 'organico' THEN NULL ELSE v_tpl END, CASE WHEN v_class = 'organico' THEN NULL ELSE v_fq END,
    v_rec_by, CASE WHEN v_class = 'organico' THEN NULL ELSE public._recovery_type(v_stage, o.payment_method) END, v_hours, now())
  ON CONFLICT (order_id) DO UPDATE SET people_id = EXCLUDED.people_id, paid_at = EXCLUDED.paid_at, value_total = EXCLUDED.value_total,
    class = EXCLUDED.class, proof = EXCLUDED.proof, channel = EXCLUDED.channel, touch_template = EXCLUDED.touch_template,
    followup_queue_id = EXCLUDED.followup_queue_id, recovered_by = EXCLUDED.recovered_by, recovery_type = EXCLUDED.recovery_type,
    hours_to_recover = EXCLUDED.hours_to_recover, computed_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_first_orders() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH r AS (
    SELECT id, row_number() OVER (PARTITION BY coalesce(people_id::text, lower(customer_email), customer_phone) ORDER BY paid_at, id) AS rn
    FROM public.orders WHERE is_paid AND paid_at IS NOT NULL AND coalesce(people_id::text, lower(customer_email), customer_phone) IS NOT NULL)
  , u AS (UPDATE public.orders o SET is_first_order = (r.rn = 1) FROM r WHERE o.id = r.id AND o.is_first_order IS DISTINCT FROM (r.rn = 1) RETURNING 1)
  SELECT count(*)::int FROM u $$;

CREATE OR REPLACE FUNCTION public.recompute_all_attribution() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE is_paid LOOP PERFORM public.compute_order_attribution(r.id); n := n + 1; END LOOP;
  DELETE FROM public.order_attribution a WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = a.order_id AND o.is_paid);
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.compute_order_attribution(bigint), public.recompute_all_attribution(), public.recompute_first_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_order_attribution(bigint), public.recompute_all_attribution(), public.recompute_first_orders() TO service_role;
