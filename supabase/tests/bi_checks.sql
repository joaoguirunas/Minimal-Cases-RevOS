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
-- R1: soma do by_type recuperado = recuperados do período
with r as (select public.bi_recuperacao('2026-09-16 03:00+00','2026-09-24 03:00+00') j)
select ((select coalesce(sum((x->>'recovered')::int),0) from r, jsonb_array_elements(j->'by_type') x)
       = (select count(*) from order_attribution where class='recuperado' and recovery_type is not null and paid_at >= '2026-09-16 03:00+00' and paid_at < '2026-09-24 03:00+00')) as ok;
-- R2: funil é não-crescente
with r as (select public.bi_recuperacao('2026-09-16 03:00+00','2026-09-24 03:00+00') j),
 f as (select (x->>'value')::int v, row_number() over () n from r, jsonb_array_elements(j->'funnel') x)
select not exists (select 1 from f a join f b on b.n = a.n + 1 where b.v > a.v) as ok;
-- E1: enviados por toque somam os toques enviados do período
with r as (select public.bi_esteira('2026-09-23 03:00+00','2026-09-24 03:00+00') j)
select ((select sum((x->>'sent')::int) from r, jsonb_array_elements(j->'touches') x)
      = (select count(*) from followup_queue where status in ('queued','sent') and fired_at >= '2026-09-23 03:00+00' and fired_at < '2026-09-24 03:00+00')) as ok;
-- F2: todo pedido pago tem is_first_order definido
select not exists (select 1 from orders where is_paid and paid_at is not null and is_first_order is null and coalesce(people_id::text, customer_email, customer_phone) is not null) as ok;
-- F4: série diária soma o faturamento bruto do período (1 ano) e responde
with r as (select public.bi_overview(now()-interval '365 days', now(), now()-interval '730 days', now()-interval '365 days') j)
select (abs((select sum((x->>'organico')::numeric + (x->>'influenciado')::numeric + (x->>'recuperado')::numeric) from r, jsonb_array_elements(j->'daily') x)
          - (select coalesce(sum(value_total),0) from order_attribution where paid_at >= now()-interval '365 days')) < 0.01) as ok;
-- F8: cupons criados = cupons da esteira no período (sem inflar por pedido)
with r as (select public.bi_esteira('2026-09-23 03:00+00','2026-09-24 03:00+00') j)
select ((j->'coupons'->>'created')::int = (select count(*) from crm_coupons where source='esteira' and created_at >= '2026-09-23 03:00+00' and created_at < '2026-09-24 03:00+00')) as ok from r;
-- F9: líquido exclui recusados
with r as (select public.bi_overview(now()-interval '30 days', now(), now()-interval '60 days', now()-interval '30 days') j)
select ((j->'kpis'->'cur'->>'net')::numeric = (select coalesce(sum(value_total),0) from orders where is_paid and paid_at >= now()-interval '30 days' and status not in ('cancelled','refunded','refused'))) as ok from r;
-- F3: função de recálculo em lotes existe e avança
select (public.recompute_attribution_chunk(0, 10) > 0) as ok;
-- C1: um cliente por customer_yampi_id pago, receita total bate
-- (base recalcula de hora em hora: compara com pedidos pagos até o refresh; clientes novos depois disso não contam)
with t as (select max(refreshed_at) at from bi_customers)
select ((select count(*) from bi_customers, t where first_order_at <= t.at) = (select count(distinct customer_yampi_id) from orders, t where is_paid and customer_yampi_id is not null and paid_at <= t.at)
    and abs((select sum(revenue) from bi_customers) - (select sum(value_total) from orders, t where is_paid and customer_yampi_id is not null and paid_at <= t.at)) < 1000) as ok;
-- C2: todo cliente tem segmento válido
select not exists (select 1 from bi_customers where segment is null or segment not in ('Campeões','Leais','Potenciais leais','Novos clientes','Promissores','Precisam de atenção','Quase dormindo','Não pode perder','Em risco','Hibernando','Perdidos')) as ok;
-- C3: regras do segmento
select (_rfm_segment(5,5,5)='Campeões' and _rfm_segment(3,3,1)='Leais' and _rfm_segment(1,5,5)='Não pode perder' and _rfm_segment(2,3,2)='Em risco'
    and _rfm_segment(5,1,1)='Novos clientes' and _rfm_segment(4,1,4)='Potenciais leais' and _rfm_segment(4,1,1)='Promissores'
    and _rfm_segment(3,1,3)='Precisam de atenção' and _rfm_segment(3,1,1)='Quase dormindo' and _rfm_segment(2,1,5)='Hibernando' and _rfm_segment(1,1,1)='Perdidos') as ok;
-- O4: retention_share = receita recorrente / (nova + recorrente)
with r as (select public.bi_overview('2026-08-01 03:00+00','2026-09-01 03:00+00','2026-07-01 03:00+00','2026-08-01 03:00+00') j)
select abs((j->'kpis'->'cur'->>'retention_share')::numeric - (select round(sum(value_total) filter (where is_first_order=false) / nullif(sum(value_total),0),4) from orders where is_paid and paid_at >= '2026-08-01 03:00+00' and paid_at < '2026-09-01 03:00+00')) < 0.0001 as ok from r;
-- O5: monthly tem 12 meses e o mês de agosto/26 bate com a soma direta
with r as (select public.bi_overview('2026-08-01 03:00+00','2026-09-01 03:00+00','2026-07-01 03:00+00','2026-08-01 03:00+00') j),
 m as (select x from r, jsonb_array_elements(j->'monthly') x)
select (select count(*) from m) = 12 and
  (select (x->>'new_revenue')::numeric + (x->>'returning_revenue')::numeric from m where x->>'month'='2026-08')
   = (select sum(value_total) from orders where is_paid and paid_at >= '2026-08-01 03:00+00' and paid_at < '2026-09-01 03:00+00') as ok;
-- O6: sem custo configurado e sem envio → roi null
with r as (select public.bi_overview('2020-01-01','2020-01-02','2019-12-31','2020-01-01') j)
select (j->'kpis'->'cur'->'retention_roi') = 'null'::jsonb as ok from r;
-- O7: weekday_hour soma = pedidos do período
with r as (select public.bi_overview('2026-08-01 03:00+00','2026-09-01 03:00+00','2026-07-01 03:00+00','2026-08-01 03:00+00') j)
select (select sum((x->>'orders')::int) from r, jsonb_array_elements(j->'weekday_hour') x) = (j->'kpis'->'cur'->>'orders')::int as ok from r;
-- C4: busca com curinga digitado é literal
select (public.bi_customers_list(null, '%', 'revenue', true, 10, 0)->>'total')::int = (select count(*) from bi_customers where position('%' in coalesce(name,'')||coalesce(email,'')) > 0) as ok;
-- C5: telefone formatado acha pelos dígitos
with c as (select phone from bi_customers where phone ~ '^\d{10,13}$' limit 1)
select (public.bi_customers_list(null, '(' || substr(right(phone,11),1,2) || ') ' || substr(right(phone,11),3,5) || '-' || right(phone,4), 'revenue', true, 10, 0)->>'total')::int >= 1 as ok from c;
-- C6: segmentos do bi_rfm somam o total
with r as (select public.bi_rfm() j)
select (select sum((x->>'customers')::int) from r, jsonb_array_elements(j->'segments') x) = (j->>'total')::int as ok from r;
-- C7: ordenação por receita desc e paginação sem sobreposição
with a as (select x from jsonb_array_elements(public.bi_customers_list(null,null,'revenue',true,5,0)->'rows') x),
     b as (select x from jsonb_array_elements(public.bi_customers_list(null,null,'revenue',true,5,5)->'rows') x)
select (select min((x->>'revenue')::numeric) from a) >= (select max((x->>'revenue')::numeric) from b)
   and not exists (select 1 from a join b on a.x->>'customer_id' = b.x->>'customer_id') as ok;
