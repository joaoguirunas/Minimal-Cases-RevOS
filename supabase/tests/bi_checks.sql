-- supabase/tests/bi_checks.sql  (cada SELECT deve devolver ok = true)
-- A1: as 5 recuperações de 23/09 saem como recuperado (4 cupom + 1 clique)
select count(*) = 5 as ok from order_attribution a join orders o on o.id=a.order_id
 where a.class='recuperado' and o.paid_at >= '2026-09-23 03:00+00' and o.paid_at < '2026-09-24 03:00+00'
   and upper(coalesce(o.coupon_code,'')) in ('CLEITON15','MARCOS15','LADIER15','SARA15','VIP15');
-- A2: nenhum pedido pago sem atribuição
select not exists (select 1 from orders o where o.is_paid and not exists (select 1 from order_attribution a where a.order_id=o.id)) as ok;
-- A3: pedido sem pessoa é orgânico
select not exists (select 1 from order_attribution a join orders o on o.id=a.order_id where o.people_id is null and a.class<>'organico') as ok;
-- A4: recuperado sempre tem prova; influenciado nunca tem
select not exists (select 1 from order_attribution where (class='recuperado' and proof is null) or (class<>'recuperado' and proof is not null)) as ok;
select not exists (select 1 from orders o join order_attribution a on a.order_id=o.id where o.status in ('cancelled','refunded') and a.value_total <> o.value_total) as ok;
-- O1: faturamento bruto do overview = soma direta
with r as (select public.bi_overview('2026-09-16 03:00+00','2026-09-23 03:00+00','2026-09-09 03:00+00','2026-09-16 03:00+00') j)
select ((j->'kpis'->'cur'->>'gross')::numeric = (select coalesce(sum(value_total),0) from orders where is_paid and paid_at >= '2026-09-16 03:00+00' and paid_at < '2026-09-23 03:00+00')) as ok from r;
-- O2: recuperado = soma de order_attribution recuperado
with r as (select public.bi_overview('2026-09-16 03:00+00','2026-09-24 03:00+00','2026-09-08 03:00+00','2026-09-16 03:00+00') j)
select ((j->'kpis'->'cur'->>'recovered_revenue')::numeric = (select coalesce(sum(value_total),0) from order_attribution where class='recuperado' and paid_at >= '2026-09-16 03:00+00' and paid_at < '2026-09-24 03:00+00')) as ok from r;
-- O3: período vazio não quebra e aov = null
with r as (select public.bi_overview('2020-01-01','2020-01-02','2019-12-31','2020-01-01') j)
select ((j->'kpis'->'cur'->>'orders')::int = 0 and (j->'kpis'->'cur'->'aov') = 'null'::jsonb) as ok from r;
