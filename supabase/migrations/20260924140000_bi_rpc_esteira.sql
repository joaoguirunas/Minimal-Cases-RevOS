-- supabase/migrations/20260924140000_bi_rpc_esteira.sql
-- bi_settings é uma linha de credenciais, não chave/valor: parâmetros do BI moram aqui.
CREATE TABLE IF NOT EXISTS public.bi_config (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bi_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_config_read ON public.bi_config FOR SELECT USING (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active));
CREATE POLICY bi_config_service ON public.bi_config FOR ALL USING (auth.role() = 'service_role');
INSERT INTO public.bi_config (key, value) VALUES ('cost_whatsapp_marketing_usd', '0.0625'), ('usd_brl', '5.40') ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._bi_setting(p_key text, p_default numeric) RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT value::numeric FROM public.bi_config WHERE key = p_key), p_default) $$;

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
  'coupons', (SELECT jsonb_build_object('created', count(*), 'used', count(o.id),
       'use_rate', round(count(o.id)::numeric / nullif(count(*), 0), 4), 'revenue', coalesce(sum(o.value_total), 0))
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
