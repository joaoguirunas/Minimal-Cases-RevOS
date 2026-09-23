-- BI · correções da revisão final.

-- (1) Ordem dos eventos: guardar o updated_at da Yampi para não deixar um
--     snapshot antigo (reprocesso/reenvio) sobrescrever um estado mais novo.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS yampi_updated_at timestamptz;

-- (2) is_first_order calculado a cada atribuição (não só no fim do backfill).
-- (3) Recálculo do histórico em lotes, retomável.
CREATE OR REPLACE FUNCTION public._set_first_order(p_order_id bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.orders o SET is_first_order = NOT EXISTS (
    SELECT 1 FROM public.orders p
     WHERE p.is_paid AND p.paid_at IS NOT NULL AND p.id <> o.id
       AND (p.paid_at, p.id) < (o.paid_at, o.id)
       AND ((o.people_id IS NOT NULL AND p.people_id = o.people_id)
         OR (o.customer_email IS NOT NULL AND lower(p.customer_email) = lower(o.customer_email))))
  WHERE o.id = p_order_id AND o.is_paid AND o.paid_at IS NOT NULL
    AND coalesce(o.people_id::text, o.customer_email, o.customer_phone) IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public.recompute_attribution_chunk(p_after bigint, p_limit int DEFAULT 1000) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_last bigint := 0;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE is_paid AND id > p_after ORDER BY id LIMIT p_limit LOOP
    PERFORM public._set_first_order(r.id);
    PERFORM public.compute_order_attribution(r.id);
    v_last := r.id;
  END LOOP;
  RETURN v_last;   -- 0 = acabou
END $$;
REVOKE EXECUTE ON FUNCTION public.recompute_attribution_chunk(bigint, int), public._set_first_order(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_attribution_chunk(bigint, int), public._set_first_order(bigint) TO service_role;

-- compute_order_attribution passa a acertar o 1º pedido também.
CREATE OR REPLACE FUNCTION public.compute_order_attribution_and_first(p_order_id bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public._set_first_order(p_order_id); SELECT public.compute_order_attribution(p_order_id); $$;
REVOKE EXECUTE ON FUNCTION public.compute_order_attribution_and_first(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_order_attribution_and_first(bigint) TO service_role;

-- (4) Série diária agregada uma vez (antes: 4 subconsultas por dia).
-- (9) Líquido exclui recusados.
CREATE OR REPLACE FUNCTION public._bi_kpis(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH paid AS (SELECT * FROM public.orders WHERE is_paid AND paid_at >= p_from AND paid_at < p_to),
       att  AS (SELECT * FROM public.order_attribution WHERE paid_at >= p_from AND paid_at < p_to),
       created AS (SELECT * FROM public.orders WHERE created_at >= p_from AND created_at < p_to)
  SELECT jsonb_build_object(
    'gross',   coalesce((SELECT sum(value_total) FROM paid), 0),
    'net',     coalesce((SELECT sum(value_total) FROM paid WHERE status NOT IN ('cancelled','refunded','refused')), 0),
    'orders',  (SELECT count(*) FROM paid),
    'aov',     (SELECT round(avg(value_total), 2) FROM paid),
    'recovered_revenue',  coalesce((SELECT sum(value_total) FROM att WHERE class='recuperado'), 0),
    'recovered_orders',   (SELECT count(*) FROM att WHERE class='recuperado'),
    'recovered_share',    (SELECT round(sum(value_total) FILTER (WHERE class='recuperado') / nullif(sum(value_total), 0), 4) FROM att),
    'influenced_revenue', coalesce((SELECT sum(value_total) FROM att WHERE class='influenciado'), 0),
    'influenced_orders',  (SELECT count(*) FROM att WHERE class='influenciado'),
    'new_revenue',        coalesce((SELECT sum(value_total) FROM paid WHERE is_first_order), 0),
    'returning_revenue',  coalesce((SELECT sum(value_total) FROM paid WHERE is_first_order = false), 0),
    'pix_generated',   (SELECT count(*) FROM created WHERE payment_method IN ('pix','pix_parcelado')),
    'pix_paid',        (SELECT count(*) FROM created WHERE payment_method IN ('pix','pix_parcelado') AND is_paid),
    'billet_generated',(SELECT count(*) FROM created WHERE payment_method = 'billet'),
    'billet_paid',     (SELECT count(*) FROM created WHERE payment_method = 'billet' AND is_paid),
    'card_attempts',   (SELECT count(*) FROM created WHERE payment_method = 'credit_card'),
    'card_paid',       (SELECT count(*) FROM created WHERE payment_method = 'credit_card' AND is_paid)
  ) $$;

CREATE OR REPLACE FUNCTION public.bi_overview(p_from timestamptz, p_to timestamptz, p_cmp_from timestamptz, p_cmp_to timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v jsonb; v_offset interval := p_from - p_cmp_from;
BEGIN
  IF (SELECT public.is_commercial()) THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501'; END IF;
  WITH days AS (
    SELECT d::date AS day FROM generate_series((p_from AT TIME ZONE 'America/Sao_Paulo')::date,
      ((p_to - interval '1 second') AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d),
  cur AS (
    SELECT (paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           sum(value_total) FILTER (WHERE class = 'organico') org,
           sum(value_total) FILTER (WHERE class = 'influenciado') inf,
           sum(value_total) FILTER (WHERE class = 'recuperado') rec
      FROM public.order_attribution WHERE paid_at >= p_from AND paid_at < p_to GROUP BY 1),
  cmp AS (
    SELECT ((paid_at + v_offset) AT TIME ZONE 'America/Sao_Paulo')::date AS day, sum(value_total) tot
      FROM public.orders WHERE is_paid AND paid_at >= p_cmp_from AND paid_at < p_cmp_to GROUP BY 1)
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object('cur', public._bi_kpis(p_from, p_to), 'cmp', public._bi_kpis(p_cmp_from, p_cmp_to)),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', days.day,
        'organico', coalesce(cur.org, 0), 'influenciado', coalesce(cur.inf, 0), 'recuperado', coalesce(cur.rec, 0),
        'cmp_total', coalesce(cmp.tot, 0)) ORDER BY days.day)
      FROM days LEFT JOIN cur ON cur.day = days.day LEFT JOIN cmp ON cmp.day = days.day), '[]'::jsonb),
    'payment_mix', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'revenue')::numeric DESC) FROM (
      SELECT jsonb_build_object('method', coalesce(payment_method,'other'), 'orders', count(*), 'revenue', sum(value_total)) x
      FROM public.orders WHERE is_paid AND paid_at >= p_from AND paid_at < p_to GROUP BY coalesce(payment_method,'other')) s), '[]'::jsonb),
    'device_mix', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT jsonb_build_object('device', coalesce(device,'?'), 'orders', count(*), 'revenue', sum(value_total)) x
      FROM public.orders WHERE is_paid AND paid_at >= p_from AND paid_at < p_to GROUP BY coalesce(device,'?')) s), '[]'::jsonb),
    'top_states', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT jsonb_build_object('state', state, 'orders', count(*), 'revenue', sum(value_total)) x
      FROM public.orders WHERE is_paid AND paid_at >= p_from AND paid_at < p_to AND state IS NOT NULL
      GROUP BY state ORDER BY sum(value_total) DESC LIMIT 5) s), '[]'::jsonb),
    'alerts', public._bi_alerts()
  ) INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.bi_overview(timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_orders_email_paid ON public.orders (lower(customer_email), paid_at) WHERE is_paid;

-- (8) Cupons: um cupom usado em 2 pedidos contava 2 vezes em 'criados'.
CREATE OR REPLACE FUNCTION public.bi_esteira(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH q AS (
  SELECT q.id, CASE WHEN q.channel = 'email' THEN 'email' ELSE 'whatsapp' END ch,
         coalesce(f.subject, q.subject, q.template_id, '(sem nome)') tpl, m.status mstatus
  FROM public.followup_queue q
  LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
  LEFT JOIN public.messages m ON m.id = q.message_id
  WHERE q.status IN ('queued','sent') AND q.fired_at >= p_from AND q.fired_at < p_to),
clicks AS (SELECT l.followup_queue_id, count(*) FILTER (WHERE NOT c.is_bot AND NOT c.is_duplicate) n
           FROM public.tracked_links l JOIN public.tracked_link_clicks c ON c.tracked_link_id = l.id
           WHERE l.followup_queue_id IN (SELECT id FROM q) GROUP BY 1),
rec AS (SELECT followup_queue_id, count(*) n, sum(value_total) r FROM public.order_attribution
        WHERE class = 'recuperado' AND paid_at >= p_from AND paid_at < p_to + interval '7 days' AND followup_queue_id IS NOT NULL GROUP BY 1),
per AS (
  SELECT q.tpl, q.ch, count(*) sent,
    count(*) FILTER (WHERE q.ch = 'email' OR q.mstatus IN ('delivered','read')) delivered,
    count(*) FILTER (WHERE q.mstatus = 'read') readn,
    coalesce(sum(c.n), 0) clicks, coalesce(sum(r.n), 0) rec_orders, coalesce(sum(r.r), 0) revenue,
    CASE WHEN q.ch = 'whatsapp' THEN count(*) * public._bi_setting('cost_whatsapp_marketing_usd', 0.0625) * public._bi_setting('usd_brl', 5.40) ELSE 0 END cost
  FROM q LEFT JOIN clicks c ON c.followup_queue_id = q.id LEFT JOIN rec r ON r.followup_queue_id = q.id
  GROUP BY q.tpl, q.ch)
SELECT jsonb_build_object(
  'touches', (SELECT coalesce(jsonb_agg(jsonb_build_object('template', tpl, 'channel', ch, 'sent', sent, 'delivered', delivered, 'read', readn,
      'clicks', clicks, 'ctr', round(clicks::numeric / nullif(delivered, 0), 4), 'recovered_orders', rec_orders, 'revenue', revenue,
      'rpr', round(revenue / nullif(delivered, 0), 2), 'cost', round(cost, 2), 'roi', round((revenue - cost) / nullif(cost, 0), 2)) ORDER BY sent DESC), '[]'::jsonb) FROM per),
  'channels', (SELECT coalesce(jsonb_agg(jsonb_build_object('channel', ch, 'sent', s, 'clicks', c, 'recovered_orders', o, 'revenue', r, 'cost', round(k, 2))), '[]'::jsonb)
     FROM (SELECT ch, sum(sent) s, sum(clicks) c, sum(rec_orders) o, sum(revenue) r, sum(cost) k FROM per GROUP BY ch) x),
  'coupons', (SELECT jsonb_build_object('created', count(DISTINCT c.id), 'used', count(DISTINCT c.id) FILTER (WHERE o.id IS NOT NULL),
       'use_rate', round(count(DISTINCT c.id) FILTER (WHERE o.id IS NOT NULL)::numeric / nullif(count(DISTINCT c.id), 0), 4), 'revenue', coalesce(sum(o.value_total), 0))
     FROM public.crm_coupons c LEFT JOIN public.orders o ON upper(o.coupon_code) = upper(c.code) AND o.is_paid
     WHERE c.source = 'esteira' AND c.created_at >= p_from AND c.created_at < p_to),
  'wa_health', (SELECT jsonb_build_object('sent', count(*), 'delivered', count(*) FILTER (WHERE mstatus IN ('delivered','read')),
       'read', count(*) FILTER (WHERE mstatus = 'read'),
       'errors', coalesce((SELECT jsonb_agg(jsonb_build_object('code', code, 'title', title, 'count', n) ORDER BY n DESC)
          FROM (SELECT m.metadata->'delivery_error'->>'code' code, max(m.metadata->'delivery_error'->>'title') title, count(*) n
                FROM public.followup_queue q2 JOIN public.messages m ON m.id = q2.message_id
                WHERE q2.fired_at >= p_from AND q2.fired_at < p_to AND m.status = 'error' GROUP BY 1) e), '[]'::jsonb))
     FROM q WHERE ch = 'whatsapp')
) $$;
GRANT EXECUTE ON FUNCTION public.bi_esteira(timestamptz, timestamptz) TO authenticated;
