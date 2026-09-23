-- supabase/migrations/20260924130000_bi_rpc_recuperacao.sql
CREATE OR REPLACE FUNCTION public.bi_recuperacao(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH carts AS (
  SELECT DISTINCT people_id FROM public.yampi_webhook_events
   WHERE trigger = 'carrinho_abandonado' AND people_id IS NOT NULL AND created_at >= p_from AND created_at < p_to),
-- Funil por coorte: quem recebeu toque NO período (o carrinho pode ser anterior —
-- ex.: Fase 2 tocou hoje carrinhos de 15 a 21/09).
touched AS (SELECT DISTINCT q.person_id FROM public.followup_queue q
             WHERE q.status IN ('queued','sent') AND q.fired_at >= p_from AND q.fired_at < p_to AND q.person_id IS NOT NULL),
clicked AS (SELECT DISTINCT k.people_id FROM public.tracked_link_clicks k JOIN touched t ON t.person_id = k.people_id
             WHERE NOT k.is_bot AND NOT k.is_duplicate AND k.clicked_at >= p_from AND k.clicked_at < p_to),
rec AS (SELECT a.*, o.coupon_code, p.name FROM public.order_attribution a LEFT JOIN public.orders o ON o.id = a.order_id  -- LEFT: comercial não lê orders (RLS), mas vê a própria atribuição
          LEFT JOIN public.clients_people p ON p.id = a.people_id
         WHERE a.class = 'recuperado' AND a.paid_at >= p_from AND a.paid_at < p_to),
elig AS (
  SELECT 'carrinho' t, count(*) n FROM carts
  UNION ALL SELECT 'pix', count(*) FROM public.orders WHERE payment_method IN ('pix','pix_parcelado') AND created_at >= p_from AND created_at < p_to
  UNION ALL SELECT 'boleto', count(*) FROM public.orders WHERE payment_method = 'billet' AND created_at >= p_from AND created_at < p_to
  UNION ALL SELECT 'cartao_recusado', count(DISTINCT order_id) FROM public.yampi_webhook_events WHERE trigger = 'pagamento_recusado' AND created_at >= p_from AND created_at < p_to)
SELECT jsonb_build_object(
  'funnel', jsonb_build_array(
    jsonb_build_object('step','Receberam toque','value',(SELECT count(*) FROM touched)),
    jsonb_build_object('step','Clicaram','value',(SELECT count(*) FROM clicked)),
    jsonb_build_object('step','Pagaram (com prova)','value',(SELECT count(DISTINCT people_id) FROM rec WHERE people_id IN (SELECT person_id FROM touched)))),
  'by_type', (SELECT coalesce(jsonb_agg(jsonb_build_object('type', e.t, 'eligible', e.n,
       'recovered', (SELECT count(*) FROM rec WHERE recovery_type = e.t),
       'revenue', coalesce((SELECT sum(value_total) FROM rec WHERE recovery_type = e.t), 0))), '[]'::jsonb) FROM elig e),
  'time_buckets', (SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', b.label, 'orders',
       (SELECT count(*) FROM rec WHERE hours_to_recover >= b.lo AND hours_to_recover < b.hi)) ORDER BY b.lo), '[]'::jsonb)
     FROM (VALUES ('<1h',0,1),('1–6h',1,6),('6–24h',6,24),('1–3d',24,72),('3–7d',72,168.01)) b(label,lo,hi)),
  'median_hours', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY hours_to_recover) FROM rec WHERE hours_to_recover IS NOT NULL),
  'by_channel', (SELECT coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'orders', n, 'revenue', r)), '[]'::jsonb)
     FROM (SELECT coalesce(channel,'?') channel, count(*) n, sum(value_total) r FROM rec GROUP BY 1) s),
  'queue', (SELECT coalesce(jsonb_agg(x ORDER BY (x->>'value')::numeric DESC), '[]'::jsonb) FROM (
     SELECT jsonb_build_object('people_id', l.people_id, 'name', p.name, 'kind', CASE s.name WHEN 'Pagamento pendente' THEN 'pix/boleto' WHEN 'Pagamento recusado' THEN 'cartão recusado' ELSE 'carrinho' END,
       'value', l.value, 'age_hours', round(extract(epoch FROM now() - l.created_at) / 3600),
       'next_touch', (SELECT coalesce(f.subject, q.subject) FROM public.followup_queue q LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
                        WHERE q.lead_id = l.id AND q.status = 'pending' ORDER BY q.scheduled_for LIMIT 1),
       'next_at', (SELECT min(q.scheduled_for) FROM public.followup_queue q WHERE q.lead_id = l.id AND q.status = 'pending')) x
     FROM public.leads l JOIN public.leads_stages s ON s.id = l.leads_stages_id JOIN public.clients_people p ON p.id = l.people_id
     WHERE l.status = 'in_progress' AND s.name IN ('Carrinho abandonado','Em recuperação','Engajou','Pagamento pendente','Pagamento recusado')
       AND EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.lead_id = l.id AND q.status = 'pending')
     LIMIT 200) s),
  'orders', (SELECT coalesce(jsonb_agg(jsonb_build_object('order_id', order_id, 'name', name, 'paid_at', paid_at, 'value', value_total,
       'proof', proof, 'channel', channel, 'template', touch_template, 'coupon', coupon_code, 'hours', round(hours_to_recover, 1)) ORDER BY paid_at DESC), '[]'::jsonb) FROM rec)
) $$;
GRANT EXECUTE ON FUNCTION public.bi_recuperacao(timestamptz, timestamptz) TO authenticated;
