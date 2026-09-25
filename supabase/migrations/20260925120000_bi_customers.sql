-- supabase/migrations/20260925120000_bi_customers.sql
-- Base de clientes do BI (1 linha por cliente Yampi) com RFM. Recalculada de hora em hora.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE TABLE IF NOT EXISTS public.bi_customers (
  customer_id bigint PRIMARY KEY,
  name text, email text, phone text, people_id uuid, state text, city text,
  first_order_at timestamptz NOT NULL, last_order_at timestamptz NOT NULL,
  orders int NOT NULL, revenue numeric(12,2) NOT NULL, avg_ticket numeric(12,2) NOT NULL,
  avg_days_between numeric(8,1),
  r_score smallint NOT NULL, f_score smallint NOT NULL, m_score smallint NOT NULL,
  segment text NOT NULL, refreshed_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bi_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_customers_read ON public.bi_customers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active) AND NOT (SELECT public.is_commercial()));
CREATE POLICY bi_customers_service ON public.bi_customers FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_bi_customers_segment ON public.bi_customers (segment);
CREATE INDEX IF NOT EXISTS idx_bi_customers_revenue ON public.bi_customers (revenue DESC);
CREATE INDEX IF NOT EXISTS idx_bi_customers_last ON public.bi_customers (last_order_at);
CREATE INDEX IF NOT EXISTS idx_bi_customers_name_trgm ON public.bi_customers USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bi_customers_email_trgm ON public.bi_customers USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bi_customers_phone_trgm ON public.bi_customers USING gin (phone extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_customer_paid ON public.orders (customer_yampi_id, paid_at) WHERE is_paid;

-- F: 1 pedido=1, 2=3, 3=4, 4+=5 (92% compram 1 vez; quintis não separariam nada).
CREATE OR REPLACE FUNCTION public._rfm_segment(r int, f int, m int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN r >= 4 AND f >= 4 THEN 'Campeões'
    WHEN r >= 3 AND f >= 3 THEN 'Leais'
    WHEN r <= 2 AND f >= 4 THEN 'Não pode perder'
    WHEN r <= 2 AND f >= 3 THEN 'Em risco'
    WHEN r = 5 THEN 'Novos clientes'
    WHEN r = 4 AND m >= 3 THEN 'Potenciais leais'
    WHEN r = 4 THEN 'Promissores'
    WHEN r = 3 AND m >= 3 THEN 'Precisam de atenção'
    WHEN r = 3 THEN 'Quase dormindo'
    WHEN r = 2 THEN 'Hibernando'
    ELSE 'Perdidos' END $$;

CREATE OR REPLACE FUNCTION public.refresh_bi_customers() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
           (array_agg(people_id ORDER BY paid_at DESC) FILTER (WHERE people_id IS NOT NULL))[1] pid
      FROM o GROUP BY cid),
  base AS (
    SELECT a.*, l.name, l.customer_email, l.customer_phone, l.state, l.city,
           ntile(5) OVER (ORDER BY a.last_at) r, ntile(5) OVER (ORDER BY a.rev) m,
           CASE WHEN a.n >= 4 THEN 5 WHEN a.n = 3 THEN 4 WHEN a.n = 2 THEN 3 ELSE 1 END f
      FROM agg a JOIN o l ON l.cid = a.cid AND l.rn = 1)
  INSERT INTO public.bi_customers (customer_id, name, email, phone, people_id, state, city, first_order_at, last_order_at,
    orders, revenue, avg_ticket, avg_days_between, r_score, f_score, m_score, segment, refreshed_at)
  SELECT cid, name, customer_email, customer_phone, pid, state, city, first_at, last_at, n, rev, round(rev / n, 2),
         CASE WHEN n > 1 THEN round((extract(epoch FROM last_at - first_at) / 86400 / (n - 1))::numeric, 1) END,
         r, f, m, public._rfm_segment(r, f, m), now()
    FROM base;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE EXECUTE ON FUNCTION public.refresh_bi_customers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_bi_customers() TO service_role;

SELECT public.refresh_bi_customers();
SELECT cron.schedule('bi-customers-refresh', '7 * * * *', $$SELECT public.refresh_bi_customers()$$);
