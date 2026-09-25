-- supabase/migrations/20260925122000_bi_rfm_clientes.sql
CREATE OR REPLACE FUNCTION public.bi_rfm() RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF (SELECT public.is_commercial()) THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.bi_customers),
    'refreshed_at', (SELECT max(refreshed_at) FROM public.bi_customers),
    'segments', coalesce((SELECT jsonb_agg(jsonb_build_object('segment', segment, 'customers', n, 'share', round(n::numeric / nullif(t, 0), 4),
        'revenue', rev, 'avg_ticket', round(rev / nullif(ord, 0), 2), 'avg_recency_days', rec) ORDER BY n DESC)
      FROM (SELECT segment, count(*) n, sum(revenue) rev, sum(orders) ord,
                   round(avg(extract(epoch FROM now() - last_order_at) / 86400)) rec, sum(count(*)) OVER () t
              FROM public.bi_customers GROUP BY segment) s), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.bi_rfm() TO authenticated;

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
