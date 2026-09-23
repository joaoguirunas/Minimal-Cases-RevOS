-- supabase/migrations/20260924120000_bi_rpc_overview.sql
CREATE OR REPLACE FUNCTION public._bi_kpis(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH paid AS (SELECT * FROM public.orders WHERE is_paid AND paid_at >= p_from AND paid_at < p_to),
       att  AS (SELECT * FROM public.order_attribution WHERE paid_at >= p_from AND paid_at < p_to),
       created AS (SELECT * FROM public.orders WHERE created_at >= p_from AND created_at < p_to)
  SELECT jsonb_build_object(
    'gross',   coalesce((SELECT sum(value_total) FROM paid), 0),
    'net',     coalesce((SELECT sum(value_total) FROM paid WHERE status NOT IN ('cancelled','refunded')), 0),
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
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object('cur', public._bi_kpis(p_from, p_to), 'cmp', public._bi_kpis(p_cmp_from, p_cmp_to)),
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', d::date,
        'organico',     coalesce((SELECT sum(value_total) FROM public.order_attribution a WHERE a.class='organico'     AND (a.paid_at AT TIME ZONE 'America/Sao_Paulo')::date = d::date), 0),
        'influenciado', coalesce((SELECT sum(value_total) FROM public.order_attribution a WHERE a.class='influenciado' AND (a.paid_at AT TIME ZONE 'America/Sao_Paulo')::date = d::date), 0),
        'recuperado',   coalesce((SELECT sum(value_total) FROM public.order_attribution a WHERE a.class='recuperado'   AND (a.paid_at AT TIME ZONE 'America/Sao_Paulo')::date = d::date), 0),
        'cmp_total',    coalesce((SELECT sum(value_total) FROM public.orders o WHERE o.is_paid AND ((o.paid_at + v_offset) AT TIME ZONE 'America/Sao_Paulo')::date = d::date), 0)
      ) ORDER BY d)
      FROM generate_series((p_from AT TIME ZONE 'America/Sao_Paulo')::date, ((p_to - interval '1 second') AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d), '[]'::jsonb),
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

-- Alertas operacionais (agora, independentes do período)
CREATE OR REPLACE FUNCTION public._bi_alerts() RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_agg(a), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('level','warn','text','Esteira sem envio há mais de 2 h em horário comercial') a
     WHERE extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 11 AND 19
       AND EXISTS (SELECT 1 FROM public.followup_queue WHERE status='pending' AND scheduled_for < now() - interval '2 hours')
    UNION ALL
    SELECT jsonb_build_object('level','warn','text', format('Entrega do WhatsApp hoje em %s%%', round(100.0 * ok / nullif(tot,0))))
      FROM (SELECT count(*) FILTER (WHERE status IN ('delivered','read','sent')) ok, count(*) tot FROM public.messages
             WHERE channel='whatsapp' AND source_type='followup' AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') m
     WHERE tot >= 20 AND ok::numeric / tot < 0.8
    UNION ALL
    SELECT jsonb_build_object('level','error','text', format('%s toques falharam por cupom nas últimas 24 h', count(*)))
      FROM public.followup_queue WHERE status='failed' AND error_message ILIKE 'cupom%' AND updated_at > now() - interval '24 hours' HAVING count(*) > 0
  ) s $$;

GRANT EXECUTE ON FUNCTION public.bi_overview(timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;
