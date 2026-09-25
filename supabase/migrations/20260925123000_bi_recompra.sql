-- supabase/migrations/20260925123000_bi_recompra.sql
CREATE OR REPLACE FUNCTION public._bi_cohorts(p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH lastm AS (SELECT date_trunc('month', (p_to - interval '1 second') AT TIME ZONE 'America/Sao_Paulo') lm),
  firsts AS (
    SELECT customer_yampi_id cid, date_trunc('month', min(paid_at) AT TIME ZONE 'America/Sao_Paulo') m0
      FROM public.orders WHERE is_paid AND customer_yampi_id IS NOT NULL AND paid_at < p_to GROUP BY 1),
  coh AS (SELECT m0, count(*) size FROM firsts, lastm WHERE m0 > lm - interval '12 months' GROUP BY m0),
  act AS (
    SELECT f.m0, (extract(year FROM age(date_trunc('month', o.paid_at AT TIME ZONE 'America/Sao_Paulo'), f.m0)) * 12
                + extract(month FROM age(date_trunc('month', o.paid_at AT TIME ZONE 'America/Sao_Paulo'), f.m0)))::int kk,
           count(DISTINCT f.cid) n
      FROM firsts f JOIN public.orders o ON o.customer_yampi_id = f.cid AND o.is_paid AND o.paid_at < p_to, lastm
     WHERE f.m0 > lm - interval '12 months' AND date_trunc('month', o.paid_at AT TIME ZONE 'America/Sao_Paulo') > f.m0
     GROUP BY 1, 2)
  SELECT coalesce(jsonb_agg(jsonb_build_object('month', to_char(c.m0, 'YYYY-MM'), 'size', c.size,
      'retention', (SELECT jsonb_agg(CASE WHEN g.k = 0 THEN 100 ELSE round(100.0 * coalesce(a.n, 0) / c.size, 1) END ORDER BY g.k)
                      FROM generate_series(0, (extract(year FROM age(l.lm, c.m0)) * 12 + extract(month FROM age(l.lm, c.m0)))::int) g(k)
                      LEFT JOIN act a ON a.m0 = c.m0 AND a.kk = g.k)) ORDER BY c.m0), '[]'::jsonb)
    FROM coh c, lastm l $$;

CREATE OR REPLACE FUNCTION public.bi_recompra(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF (SELECT public.is_commercial()) THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501'; END IF;
  WITH per AS (
    SELECT customer_yampi_id cid, count(*) n, sum(value_total) rev FROM public.orders
     WHERE is_paid AND paid_at >= p_from AND paid_at < p_to AND customer_yampi_id IS NOT NULL GROUP BY 1),
  life AS (
    SELECT o.customer_yampi_id cid, count(*) n, (array_agg(o.paid_at ORDER BY o.paid_at))[1:2] firsts
      FROM public.orders o WHERE o.is_paid AND o.paid_at < p_to AND o.customer_yampi_id IN (SELECT cid FROM per) GROUP BY 1),
  cust AS (SELECT per.cid, per.n pn, per.rev, life.n ln, life.firsts FROM per JOIN life USING (cid)),
  gaps AS (
    SELECT extract(epoch FROM o.paid_at - lag(o.paid_at) OVER (PARTITION BY o.customer_yampi_id ORDER BY o.paid_at)) / 86400 d
      FROM public.orders o WHERE o.is_paid AND o.paid_at < p_to AND o.customer_yampi_id IN (SELECT cid FROM cust WHERE ln > 1))
  SELECT jsonb_build_object(
    'customers', (SELECT count(*) FROM cust),
    'repurchase_rate', (SELECT round(count(*) FILTER (WHERE ln >= 2)::numeric / nullif(count(*), 0), 4) FROM cust),
    'avg_frequency', (SELECT round(avg(ln), 2) FROM cust),
    'median_days_to_2nd', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM firsts[2] - firsts[1]) / 86400))::numeric, 1) FROM cust WHERE ln >= 2),
    'avg_days_between', (SELECT round(avg(d)::numeric, 1) FROM gaps WHERE d IS NOT NULL),
    'distribution', coalesce((SELECT jsonb_agg(jsonb_build_object('bucket', b, 'customers', c) ORDER BY b)
        FROM (SELECT least(ln, 4) b, count(*) c FROM cust GROUP BY 1) x), '[]'::jsonb),
    'top', coalesce((SELECT jsonb_agg(jsonb_build_object('customer_id', t.cid, 'name', bc.name, 'people_id', bc.people_id, 'orders', t.pn,
        'revenue', t.rev, 'lifetime_orders', t.ln) ORDER BY t.rev DESC)
        FROM (SELECT * FROM cust ORDER BY rev DESC LIMIT 5) t LEFT JOIN public.bi_customers bc ON bc.customer_id = t.cid), '[]'::jsonb),
    'cohorts', public._bi_cohorts(p_to)
  ) INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.bi_recompra(timestamptz, timestamptz) TO authenticated;
