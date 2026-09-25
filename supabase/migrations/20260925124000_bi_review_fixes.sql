-- supabase/migrations/20260925124000_bi_review_fixes.sql
-- Correções da revisão final da Onda 1 Zoppy+:
-- (1) notas R/M por cume_dist: clientes empatados recebem a mesma nota (segmento estável entre refreshes);
-- (2) receita dos 12 meses após a 1ª compra pronta na base (LTV 12m sem varrer o histórico a cada chamada);
-- (3) busca por número colado do WhatsApp (+55); (4) overview diz se o custo fixo do CRM está configurado.
ALTER TABLE public.bi_customers ADD COLUMN IF NOT EXISTS revenue_12m numeric(12,2);
CREATE INDEX IF NOT EXISTS idx_bi_customers_first ON public.bi_customers (first_order_at);

CREATE OR REPLACE FUNCTION public.refresh_bi_customers() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_n int;
BEGIN
  DELETE FROM public.bi_customers;
  WITH o AS (
    SELECT customer_yampi_id cid, id, paid_at, value_total, people_id, customer_email, customer_phone, state, city,
           nullif(trim(raw->'customer'->'data'->>'name'), '') AS name,
           row_number() OVER (PARTITION BY customer_yampi_id ORDER BY paid_at DESC, id DESC) rn
      FROM public.orders WHERE is_paid AND customer_yampi_id IS NOT NULL),
  agg AS (
    SELECT cid, min(paid_at) first_at, max(paid_at) last_at, count(*)::int n, sum(value_total) rev,
           (array_agg(people_id ORDER BY paid_at DESC) FILTER (WHERE people_id IS NOT NULL))[1] pid,
           min(paid_at) AS f0
      FROM o GROUP BY cid),
  r12 AS (
    SELECT a.cid, sum(o.value_total) rev12 FROM agg a JOIN o ON o.cid = a.cid AND o.paid_at < a.f0 + interval '12 months' GROUP BY a.cid),
  base AS (
    SELECT a.*, l.name, l.customer_email, l.customer_phone, l.state, l.city,
           ceil(cume_dist() OVER (ORDER BY a.last_at) * 5)::int r, ceil(cume_dist() OVER (ORDER BY a.rev) * 5)::int m,
           CASE WHEN a.n >= 4 THEN 5 WHEN a.n = 3 THEN 4 WHEN a.n = 2 THEN 3 ELSE 1 END f
      FROM agg a JOIN o l ON l.cid = a.cid AND l.rn = 1)
  INSERT INTO public.bi_customers (customer_id, name, email, phone, people_id, state, city, first_order_at, last_order_at,
    orders, revenue, avg_ticket, avg_days_between, r_score, f_score, m_score, segment, refreshed_at, revenue_12m)
  SELECT cid, name, customer_email, customer_phone, pid, state, city, first_at, last_at, n, rev, round(rev / n, 2),
         CASE WHEN n > 1 THEN round((extract(epoch FROM last_at - first_at) / 86400 / (n - 1))::numeric, 1) END,
         r, f, m, public._rfm_segment(r, f, m), now(), r12.rev12
    FROM base JOIN r12 USING (cid);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_bi_customers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_bi_customers() TO service_role;
SELECT public.refresh_bi_customers();

CREATE OR REPLACE FUNCTION public._bi_kpis_plus(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  -- MATERIALIZED: sem isso o Postgres embute o CTE e recalcula _bi_kpis a cada k.j lido
  WITH k AS MATERIALIZED (SELECT public._bi_kpis(p_from, p_to) j),
  wa AS (SELECT count(*) n FROM public.followup_queue
          WHERE coalesce(channel, '') <> 'email' AND status IN ('queued','sent') AND fired_at >= p_from AND fired_at < p_to),
  cost AS (SELECT round(wa.n * public._bi_setting('cost_whatsapp_marketing_usd', 0.0625) * public._bi_setting('usd_brl', 5.40)
                  + public._bi_setting('crm_monthly_cost_brl', 0) * extract(epoch FROM p_to - p_from) / 86400 / 30.44, 2) c, wa.n FROM wa)
  SELECT k.j || jsonb_build_object(
    'retention_share', round((k.j->>'returning_revenue')::numeric / nullif((k.j->>'new_revenue')::numeric + (k.j->>'returning_revenue')::numeric, 0), 4),
    'crm_revenue', (k.j->>'recovered_revenue')::numeric + (k.j->>'influenced_revenue')::numeric,
    'ltv', (SELECT round(sum(value_total) / nullif(count(DISTINCT customer_yampi_id), 0), 2) FROM public.orders WHERE is_paid AND paid_at < p_to),
    -- janela de 12 meses já fechada antes de p_to: vem pronta da base de clientes (recalculada de hora em hora)
    'ltv_12m', (SELECT round(avg(revenue_12m), 2) FROM public.bi_customers WHERE first_order_at < p_to - interval '12 months'),
    'wa_messages', cost.n,
    'crm_cost', cost.c,
    'fixed_cost_configured', public._bi_setting('crm_monthly_cost_brl', 0) > 0,
    'retention_roi', round((k.j->>'recovered_revenue')::numeric / nullif(cost.c, 0), 2))
  FROM k, cost $$;

CREATE OR REPLACE FUNCTION public.bi_customers_list(p_segment text DEFAULT NULL, p_search text DEFAULT NULL, p_sort text DEFAULT 'revenue',
  p_desc boolean DEFAULT true, p_limit int DEFAULT 50, p_offset int DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  v_q text := nullif(trim(p_search), '');
  v_pat text;
  v_digits text;
  v_sort text := CASE WHEN p_sort IN ('revenue','orders','avg_ticket','last_order_at','first_order_at','name') THEN p_sort ELSE 'revenue' END;
  v jsonb;
BEGIN
  IF (SELECT public.is_commercial()) THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501'; END IF;
  -- texto do usuário é literal: escapa \ % _ antes do ILIKE
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_digits := nullif(regexp_replace(coalesce(v_q, ''), '\D', '', 'g'), '');
  IF length(v_digits) < 4 THEN v_digits := NULL; END IF;
  -- número colado do WhatsApp vem com o DDI 55; a base guarda DDD + número
  IF length(v_digits) BETWEEN 12 AND 13 AND left(v_digits, 2) = '55' THEN v_digits := substr(v_digits, 3); END IF;
  WITH f AS (
    SELECT * FROM public.bi_customers c
     WHERE (p_segment IS NULL OR c.segment = p_segment)
       AND (v_q IS NULL OR c.name ILIKE v_pat OR c.email ILIKE v_pat OR (v_digits IS NOT NULL AND c.phone LIKE '%' || v_digits || '%'))),
  pg AS (
    SELECT *, row_number() OVER () rn FROM (SELECT * FROM f ORDER BY
      CASE WHEN p_desc AND v_sort IN ('revenue','orders','avg_ticket') THEN CASE v_sort WHEN 'revenue' THEN revenue WHEN 'orders' THEN orders::numeric ELSE avg_ticket END END DESC NULLS LAST,
      CASE WHEN NOT p_desc AND v_sort IN ('revenue','orders','avg_ticket') THEN CASE v_sort WHEN 'revenue' THEN revenue WHEN 'orders' THEN orders::numeric ELSE avg_ticket END END ASC NULLS LAST,
      CASE WHEN p_desc AND v_sort IN ('last_order_at','first_order_at') THEN CASE v_sort WHEN 'last_order_at' THEN last_order_at ELSE first_order_at END END DESC NULLS LAST,
      CASE WHEN NOT p_desc AND v_sort IN ('last_order_at','first_order_at') THEN CASE v_sort WHEN 'last_order_at' THEN last_order_at ELSE first_order_at END END ASC NULLS LAST,
      CASE WHEN p_desc AND v_sort = 'name' THEN name END DESC NULLS LAST,
      CASE WHEN NOT p_desc AND v_sort = 'name' THEN name END ASC NULLS LAST,
      customer_id
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 1000) OFFSET greatest(coalesce(p_offset, 0), 0)) s)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('customer_id', customer_id, 'name', name, 'email', email, 'phone', phone,
        'people_id', people_id, 'state', state, 'city', city, 'orders', orders, 'revenue', revenue, 'avg_ticket', avg_ticket,
        'first_order_at', first_order_at, 'last_order_at', last_order_at,
        'days_since', floor(extract(epoch FROM now() - last_order_at) / 86400)::int, 'segment', segment) ORDER BY rn) FROM pg), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.bi_customers_list(text, text, text, boolean, int, int) TO authenticated;
