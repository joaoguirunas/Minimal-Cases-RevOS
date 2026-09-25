-- supabase/migrations/20260925121000_bi_overview_plus.sql
INSERT INTO public.bi_config (key, value) VALUES ('crm_monthly_cost_brl', '0') ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._bi_kpis_plus(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH k AS (SELECT public._bi_kpis(p_from, p_to) j),
  wa AS (SELECT count(*) n FROM public.followup_queue
          WHERE coalesce(channel, '') <> 'email' AND status IN ('queued','sent') AND fired_at >= p_from AND fired_at < p_to),
  cost AS (SELECT round(wa.n * public._bi_setting('cost_whatsapp_marketing_usd', 0.0625) * public._bi_setting('usd_brl', 5.40)
                  + public._bi_setting('crm_monthly_cost_brl', 0) * extract(epoch FROM p_to - p_from) / 86400 / 30.44, 2) c, wa.n FROM wa),
  firsts AS (SELECT customer_yampi_id cid, min(paid_at) f FROM public.orders WHERE is_paid AND customer_yampi_id IS NOT NULL GROUP BY 1)
  SELECT k.j || jsonb_build_object(
    'retention_share', round((k.j->>'returning_revenue')::numeric / nullif((k.j->>'new_revenue')::numeric + (k.j->>'returning_revenue')::numeric, 0), 4),
    'crm_revenue', (k.j->>'recovered_revenue')::numeric + (k.j->>'influenced_revenue')::numeric,
    'ltv', (SELECT round(sum(value_total) / nullif(count(DISTINCT customer_yampi_id), 0), 2) FROM public.orders WHERE is_paid AND paid_at < p_to),
    'ltv_12m', (SELECT round(avg(r), 2) FROM (
        SELECT sum(o.value_total) r FROM firsts fo JOIN public.orders o
          ON o.customer_yampi_id = fo.cid AND o.is_paid AND o.paid_at < fo.f + interval '12 months'
         WHERE fo.f < p_to - interval '12 months' GROUP BY fo.cid) x),
    'wa_messages', cost.n,
    'crm_cost', cost.c,
    'retention_roi', round((k.j->>'recovered_revenue')::numeric / nullif(cost.c, 0), 2))
  FROM k, cost $$;

CREATE OR REPLACE FUNCTION public.bi_overview(p_from timestamptz, p_to timestamptz, p_cmp_from timestamptz, p_cmp_to timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v jsonb; v_offset interval := p_from - p_cmp_from;
  v_last timestamp := date_trunc('month', (p_to - interval '1 second') AT TIME ZONE 'America/Sao_Paulo');
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
      FROM public.orders WHERE is_paid AND paid_at >= p_cmp_from AND paid_at < p_cmp_to GROUP BY 1),
  months AS (SELECT generate_series(v_last - interval '11 months', v_last, interval '1 month') m),
  mon AS (
    SELECT date_trunc('month', o.paid_at AT TIME ZONE 'America/Sao_Paulo') mm,
           sum(o.value_total) FILTER (WHERE o.is_first_order) nr,
           sum(o.value_total) FILTER (WHERE NOT coalesce(o.is_first_order, false)) rr,
           sum(a.value_total) FILTER (WHERE a.class = 'recuperado') rec,
           sum(a.value_total) FILTER (WHERE a.class = 'influenciado') inf,
           count(*) n
      FROM public.orders o LEFT JOIN public.order_attribution a ON a.order_id = o.id
     WHERE o.is_paid AND o.paid_at >= (v_last - interval '11 months') AT TIME ZONE 'America/Sao_Paulo' AND o.paid_at < p_to
     GROUP BY 1)
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object('cur', public._bi_kpis_plus(p_from, p_to), 'cmp', public._bi_kpis_plus(p_cmp_from, p_cmp_to)),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', days.day,
        'organico', coalesce(cur.org, 0), 'influenciado', coalesce(cur.inf, 0), 'recuperado', coalesce(cur.rec, 0),
        'cmp_total', coalesce(cmp.tot, 0)) ORDER BY days.day)
      FROM days LEFT JOIN cur ON cur.day = days.day LEFT JOIN cmp ON cmp.day = days.day), '[]'::jsonb),
    'monthly', (SELECT jsonb_agg(jsonb_build_object('month', to_char(months.m, 'YYYY-MM'),
        'new_revenue', coalesce(mon.nr, 0), 'returning_revenue', coalesce(mon.rr, 0),
        'recuperado', coalesce(mon.rec, 0), 'influenciado', coalesce(mon.inf, 0), 'orders', coalesce(mon.n, 0)) ORDER BY months.m)
      FROM months LEFT JOIN mon ON mon.mm = months.m),
    'weekday_hour', coalesce((SELECT jsonb_agg(jsonb_build_object('dow', dow, 'hour', hr, 'orders', n, 'revenue', rev)) FROM (
        SELECT extract(dow FROM paid_at AT TIME ZONE 'America/Sao_Paulo')::int dow, extract(hour FROM paid_at AT TIME ZONE 'America/Sao_Paulo')::int hr,
               count(*) n, sum(value_total) rev
          FROM public.orders WHERE is_paid AND paid_at >= p_from AND paid_at < p_to GROUP BY 1, 2) x), '[]'::jsonb),
    'by_source', coalesce((SELECT jsonb_agg(jsonb_build_object('channel', ch, 'recovered_orders', ro, 'recovered_revenue', rr,
        'influenced_orders', io, 'influenced_revenue', ir) ORDER BY rr + ir DESC) FROM (
        SELECT coalesce(channel, 'outro') ch,
               count(*) FILTER (WHERE class = 'recuperado') ro, coalesce(sum(value_total) FILTER (WHERE class = 'recuperado'), 0) rr,
               count(*) FILTER (WHERE class = 'influenciado') io, coalesce(sum(value_total) FILTER (WHERE class = 'influenciado'), 0) ir
          FROM public.order_attribution WHERE class IN ('recuperado','influenciado') AND paid_at >= p_from AND paid_at < p_to GROUP BY 1) x), '[]'::jsonb),
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
