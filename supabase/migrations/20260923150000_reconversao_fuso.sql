-- paid_at da reconversão ficava 3 h adiantado (horário de SP lido como UTC).
-- Corrige o histórico e recalcula a atribuição com o horário certo.
CREATE TABLE IF NOT EXISTS public._bkp_20260923_reconv_paid_at AS
SELECT id, paid_at, attribution_level, attributed, recovered_by_us FROM public.esteira_reconversions;
ALTER TABLE public._bkp_20260923_reconv_paid_at ENABLE ROW LEVEL SECURITY;

UPDATE public.esteira_reconversions SET paid_at = paid_at + interval '3 hours'
WHERE id IN (SELECT id FROM public._bkp_20260923_reconv_paid_at b WHERE b.paid_at = public.esteira_reconversions.paid_at);

WITH t AS (
  SELECT r.id,
    count(q.*) FILTER (WHERE q.channel = 'email') AS n_email,
    count(q.*) FILTER (WHERE q.channel = 'sms') AS n_sms,
    count(q.*) FILTER (WHERE q.channel NOT IN ('email','sms')) AS n_wa,
    count(q.*) AS n_total, min(q.fired_at) AS first_at, max(q.fired_at) AS last_at
  FROM public.esteira_reconversions r
  LEFT JOIN public.followup_queue q ON q.person_id = r.people_id AND q.status IN ('sent','queued') AND q.fired_at < r.paid_at
  GROUP BY r.id
), p AS (
  SELECT r.id,
    EXISTS (SELECT 1 FROM public.crm_coupons cc WHERE cc.code = upper(r.coupon_code) AND cc.source IN ('esteira','agente','comercial')) AS cupom,
    EXISTS (SELECT 1 FROM public.tracked_link_clicks c WHERE c.people_id = r.people_id AND c.is_bot = false AND c.is_duplicate = false
              AND c.clicked_at <= r.paid_at AND c.clicked_at >= r.paid_at - interval '7 days') AS clique
  FROM public.esteira_reconversions r
)
UPDATE public.esteira_reconversions r SET
  touches_email = t.n_email, touches_sms = t.n_sms, touches_whatsapp = t.n_wa, touches_total = t.n_total,
  first_touch_at = t.first_at, last_touch_at = t.last_at,
  hours_since_last_touch = CASE WHEN t.last_at IS NULL THEN NULL ELSE extract(epoch FROM (r.paid_at - t.last_at)) / 3600 END,
  attribution_level = CASE WHEN p.cupom THEN 'cupom' WHEN p.clique THEN 'clique'
                           WHEN t.last_at IS NOT NULL AND r.paid_at - t.last_at <= interval '7 days' THEN 'janela' END,
  attributed = p.cupom OR p.clique OR (t.last_at IS NOT NULL AND r.paid_at - t.last_at <= interval '7 days'),
  recovered_by_us = p.cupom OR p.clique OR r.recovered_by IS NOT NULL
FROM t JOIN p ON p.id = t.id WHERE r.id = t.id;
