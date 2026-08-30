-- Fix: get_insights_context usa status PT antigos (ganho/perdido/em-andamento)
-- e colunas renomeadas (leads_id → lead_id em messages e meetings).
-- Aplicar via: supabase db query --linked --file fix_get_insights_context.sql

CREATE OR REPLACE FUNCTION public.get_insights_context(
  p_date_from timestamp with time zone DEFAULT NULL,
  p_date_to   timestamp with time zone DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result     jsonb := '{}'::jsonb;
  v_funnel   jsonb;
  v_people   jsonb;
  v_messages jsonb;
  v_meetings jsonb;
  v_calls    jsonb;
  v_marketing jsonb;
  v_prospect jsonb;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 1: FUNNEL
  -- ═══════════════════════════════════════════════════════════════════════
  WITH lead_base AS (
    SELECT l.id, l.status, l.value, l.leads_stages_id, l.leads_pipelines_id,
           l.leads_loss_reasons_id, l.created_at, l.won_at
    FROM leads l
    WHERE (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
  ),
  stages_agg AS (
    SELECT
      ls.name       AS stage_name,
      ls.order_index,
      COUNT(lb.id)  AS lead_count,
      COALESCE(SUM(lb.value), 0) AS total_value,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - lb.created_at)) / 86400)::numeric, 1) AS avg_days
    FROM lead_base lb
    JOIN leads_stages ls ON ls.id = lb.leads_stages_id
    WHERE lb.status = 'in_progress'   -- FIX: era 'em-andamento'
    GROUP BY ls.name, ls.order_index
    ORDER BY ls.order_index
  ),
  loss_reasons AS (
    SELECT
      COALESCE(lr.name, 'Sem motivo') AS reason,
      COUNT(*) AS cnt
    FROM lead_base lb
    LEFT JOIN leads_loss_reasons lr ON lr.id = lb.leads_loss_reasons_id
    WHERE lb.status = 'lost'          -- FIX: era 'perdido'
    GROUP BY lr.name
    ORDER BY cnt DESC
    LIMIT 5
  ),
  funnel_totals AS (
    SELECT
      COUNT(*)                                       AS total,
      COUNT(*) FILTER (WHERE status = 'won')         AS won,    -- FIX: era 'ganho'
      COUNT(*) FILTER (WHERE status = 'lost')        AS lost,   -- FIX: era 'perdido'
      COUNT(*) FILTER (WHERE status = 'in_progress') AS active, -- FIX: era 'em-andamento'
      COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0) AS revenue,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - created_at)) / 86400)
             FILTER (WHERE status = 'won' AND won_at IS NOT NULL))::numeric, 1) AS avg_cycle_days
    FROM lead_base
  )
  SELECT jsonb_build_object(
    'total',          ft.total,
    'won',            ft.won,
    'lost',           ft.lost,
    'active',         ft.active,
    'revenue',        ft.revenue,
    'avg_deal',       CASE WHEN ft.won > 0 THEN ROUND((ft.revenue / ft.won)::numeric, 2) ELSE 0 END,
    'conversion_pct', CASE WHEN ft.total > 0 THEN ROUND((ft.won::numeric / ft.total * 100), 1) ELSE 0 END,
    'avg_cycle_days', COALESCE(ft.avg_cycle_days, 0),
    'stages',         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'name', s.stage_name, 'leads', s.lead_count,
                        'value', s.total_value, 'avg_days', s.avg_days
                      ) ORDER BY s.order_index) FROM stages_agg s), '[]'::jsonb),
    'loss_reasons',   COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'reason', r.reason, 'count', r.cnt
                      )) FROM loss_reasons r), '[]'::jsonb)
  ) INTO v_funnel
  FROM funnel_totals ft;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 2: PEOPLE & COMPANIES
  -- ═══════════════════════════════════════════════════════════════════════
  WITH people_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'ativo')  AS active,
      COUNT(*) FILTER (WHERE status != 'ativo') AS inactive,
      COUNT(*) FILTER (WHERE score BETWEEN 0  AND 25)  AS score_0_25,
      COUNT(*) FILTER (WHERE score BETWEEN 26 AND 50)  AS score_26_50,
      COUNT(*) FILTER (WHERE score BETWEEN 51 AND 75)  AS score_51_75,
      COUNT(*) FILTER (WHERE score BETWEEN 76 AND 100) AS score_76_100
    FROM clients_people
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  top_sources AS (
    SELECT source, COUNT(*) AS cnt
    FROM clients_people
    WHERE source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY source ORDER BY cnt DESC LIMIT 5
  ),
  company_stats AS (
    SELECT COUNT(*) AS total, COUNT(*) AS active  -- clients_companies has no status column
    FROM clients_companies
  )
  SELECT jsonb_build_object(
    'people_total',    ps.total,
    'people_active',   ps.active,
    'people_inactive', ps.inactive,
    'score_distribution', jsonb_build_object(
      '0_25', ps.score_0_25, '26_50', ps.score_26_50,
      '51_75', ps.score_51_75, '76_100', ps.score_76_100
    ),
    'top_sources',      COALESCE((SELECT jsonb_agg(jsonb_build_object('source', ts.source, 'count', ts.cnt)) FROM top_sources ts), '[]'::jsonb),
    'companies_total',  cs.total,
    'companies_active', cs.active
  ) INTO v_people
  FROM people_stats ps, company_stats cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 3: MESSAGES
  -- ═══════════════════════════════════════════════════════════════════════
  WITH msg_base AS (
    SELECT id, channel, from_contact, created_at, lead_id  -- FIX: era leads_id
    FROM messages
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  by_channel AS (
    SELECT channel, COUNT(*) AS cnt FROM msg_base GROUP BY channel ORDER BY cnt DESC
  ),
  by_sender AS (
    SELECT from_contact, COUNT(*) AS cnt FROM msg_base GROUP BY from_contact
  ),
  daily_trend AS (
    SELECT created_at::date AS day, COUNT(*) AS cnt
    FROM msg_base
    WHERE created_at >= (COALESCE(p_date_to, now()) - interval '7 days')
    GROUP BY day ORDER BY day
  ),
  abandoned AS (
    SELECT COUNT(DISTINCT lead_id) AS cnt   -- FIX: era leads_id
    FROM (
      SELECT lead_id,
             from_contact,
             created_at,
             LEAD(from_contact) OVER (PARTITION BY lead_id ORDER BY created_at) AS next_sender,
             LEAD(created_at)   OVER (PARTITION BY lead_id ORDER BY created_at) AS next_at
      FROM msg_base
    ) sub
    WHERE from_contact = 'cliente'
      AND (next_sender IS NULL OR (next_sender != 'cliente' AND next_at - created_at > interval '24 hours'))
  )
  SELECT jsonb_build_object(
    'total',                   (SELECT COUNT(*) FROM msg_base),
    'by_channel',              COALESCE((SELECT jsonb_agg(jsonb_build_object('channel', c.channel, 'count', c.cnt)) FROM by_channel c), '[]'::jsonb),
    'by_sender',               COALESCE((SELECT jsonb_agg(jsonb_build_object('sender', s.from_contact, 'count', s.cnt)) FROM by_sender s), '[]'::jsonb),
    'daily_trend',             COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt)) FROM daily_trend d), '[]'::jsonb),
    'abandoned_conversations', ab.cnt
  ) INTO v_messages
  FROM abandoned ab;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 4: MEETINGS
  -- ═══════════════════════════════════════════════════════════════════════
  WITH mtg_base AS (
    SELECT m.id, m.status, m.start_time, m.user_id,
           l.created_at AS lead_created, l.won_at
    FROM meetings m
    LEFT JOIN leads l ON l.id = m.lead_id   -- FIX: era m.leads_id
    WHERE (p_date_from IS NULL OR m.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR m.created_at <= p_date_to)
  ),
  by_status AS (
    SELECT status, COUNT(*) AS cnt FROM mtg_base GROUP BY status
  ),
  show_rate_by_user AS (
    SELECT
      COALESCE(su.name, 'Sem responsável') AS closer_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE mb.status IN ('compareceu', 'realizado')) AS attended,  -- FIX: era 'realizada'
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE mb.status IN ('compareceu', 'realizado')))::numeric / COUNT(*) * 100, 1)
        ELSE 0 END AS show_rate
    FROM mtg_base mb
    LEFT JOIN settings_users su ON su.id = mb.user_id
    GROUP BY su.name
    ORDER BY total DESC LIMIT 5
  ),
  time_metrics AS (
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (start_time - lead_created)) / 86400)::numeric, 1) AS avg_lead_to_meeting,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - start_time)) / 86400) FILTER (WHERE won_at IS NOT NULL))::numeric, 1) AS avg_meeting_to_close
    FROM mtg_base
    WHERE lead_created IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total',                    (SELECT COUNT(*) FROM mtg_base),
    'by_status',                COALESCE((SELECT jsonb_agg(jsonb_build_object('status', bs.status, 'count', bs.cnt)) FROM by_status bs), '[]'::jsonb),
    'show_rate_by_closer',      COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                  'name', sr.closer_name, 'total', sr.total,
                                  'attended', sr.attended, 'show_rate', sr.show_rate
                                )) FROM show_rate_by_user sr), '[]'::jsonb),
    'avg_lead_to_meeting_days', COALESCE(tm.avg_lead_to_meeting, 0),
    'avg_meeting_to_close_days',COALESCE(tm.avg_meeting_to_close, 0)
  ) INTO v_meetings
  FROM time_metrics tm;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 5: CALLS
  -- ═══════════════════════════════════════════════════════════════════════
  WITH call_base AS (
    SELECT id, direction, status, duration, user_id, outcome, tags
    FROM call_pro_calls
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  call_summary AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE direction = 'inbound')  AS inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound,
      COUNT(*) FILTER (WHERE status IN ('answered', 'handled')) AS answered,
      ROUND((AVG(duration) FILTER (WHERE duration > 0))::numeric, 0) AS avg_duration_sec
    FROM call_base
  ),
  top_operators AS (
    SELECT
      COALESCE(su.name, 'Desconhecido') AS operator_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE cb.status IN ('answered', 'handled')) AS answered
    FROM call_base cb
    LEFT JOIN settings_users su ON su.id = cb.user_id
    WHERE cb.user_id IS NOT NULL
    GROUP BY su.name ORDER BY total DESC LIMIT 3
  ),
  top_outcomes AS (
    SELECT outcome, COUNT(*) AS cnt
    FROM call_base
    WHERE outcome IS NOT NULL AND outcome != ''
    GROUP BY outcome ORDER BY cnt DESC LIMIT 5
  )
  SELECT jsonb_build_object(
    'total',            cs.total,
    'inbound',          cs.inbound,
    'outbound',         cs.outbound,
    'answered',         cs.answered,
    'answer_rate',      CASE WHEN cs.total > 0 THEN ROUND((cs.answered::numeric / cs.total * 100), 1) ELSE 0 END,
    'avg_duration_sec', COALESCE(cs.avg_duration_sec, 0),
    'top_operators',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'name', op.operator_name, 'total', op.total, 'answered', op.answered
                        )) FROM top_operators op), '[]'::jsonb),
    'top_outcomes',     COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'outcome', o.outcome, 'count', o.cnt
                        )) FROM top_outcomes o), '[]'::jsonb)
  ) INTO v_calls
  FROM call_summary cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 6: MARKETING
  -- ═══════════════════════════════════════════════════════════════════════
  WITH sends_summary AS (
    SELECT
      COUNT(*)               AS total_sends,
      SUM(total_contacts)    AS total_contacts,
      SUM(sent_count)        AS total_sent,
      SUM(delivered_count)   AS total_delivered,
      SUM(read_count)        AS total_read
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  sends_by_channel AS (
    SELECT channel,
           COUNT(*) AS cnt,
           SUM(sent_count) AS sent,
           SUM(delivered_count) AS delivered,
           SUM(read_count) AS read_cnt
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY channel
  ),
  lp_stats AS (
    -- lp_analytics_events / lp_pages not installed in this tenant
    SELECT NULL::text AS page_name, 0 AS views, 0 AS submissions WHERE false
  ),
  utm_stats AS (
    SELECT
      COALESCE(utm_source, 'direto') AS source,
      COALESCE(utm_medium, 'none')   AS medium,
      COUNT(*) AS leads,
      COUNT(*) FILTER (WHERE status = 'won') AS won  -- FIX: era 'ganho'
    FROM leads
    WHERE utm_source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR leads_pipelines_id = p_pipeline_id)
    GROUP BY utm_source, utm_medium ORDER BY leads DESC LIMIT 5
  ),
  meta_forms_stats AS (
    -- leads.metadata column not present; skip meta form attribution
    SELECT NULL::text AS form_name, 0 AS leads_count WHERE false
  )
  SELECT jsonb_build_object(
    'sends', jsonb_build_object(
      'total_campaigns',  ss.total_sends,
      'total_sent',       COALESCE(ss.total_sent, 0),
      'total_delivered',  COALESCE(ss.total_delivered, 0),
      'total_read',       COALESCE(ss.total_read, 0),
      'delivery_rate',    CASE WHEN COALESCE(ss.total_sent, 0) > 0
                            THEN ROUND((COALESCE(ss.total_delivered, 0)::numeric / ss.total_sent * 100), 1) ELSE 0 END,
      'read_rate',        CASE WHEN COALESCE(ss.total_delivered, 0) > 0
                            THEN ROUND((COALESCE(ss.total_read, 0)::numeric / ss.total_delivered * 100), 1) ELSE 0 END,
      'by_channel',       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'channel', sc.channel, 'campaigns', sc.cnt,
                            'sent', sc.sent, 'delivered', sc.delivered, 'read', sc.read_cnt
                          )) FROM sends_by_channel sc), '[]'::jsonb)
    ),
    'landing_pages',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'page', lps.page_name, 'views', lps.views, 'submissions', lps.submissions,
                          'conversion_rate', CASE WHEN lps.views > 0 THEN ROUND((lps.submissions::numeric / lps.views * 100), 1) ELSE 0 END
                        )) FROM lp_stats lps), '[]'::jsonb),
    'utm_attribution',  COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'source', u.source, 'medium', u.medium, 'leads', u.leads, 'won', u.won
                        )) FROM utm_stats u), '[]'::jsonb),
    'meta_forms',       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'form', mfs.form_name, 'leads', mfs.leads_count
                        )) FROM meta_forms_stats mfs), '[]'::jsonb)
  ) INTO v_marketing
  FROM sends_summary ss;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 7: PROSPECT PRO
  -- ═══════════════════════════════════════════════════════════════════════
  WITH prospect_campaigns_agg AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'running')   AS running,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM prospect_campaigns
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  prospect_contacts_agg AS (
    -- prospect_contacts table not installed in this tenant
    SELECT 0 AS total, 0 AS raw_cnt, 0 AS filtered_cnt,
           0 AS enriched_cnt, 0 AS approved_cnt, 0 AS rejected_cnt,
           0 AS avg_ai_score
  )
  SELECT jsonb_build_object(
    'campaigns_total',     pca.total,
    'campaigns_running',   pca.running,
    'campaigns_completed', pca.completed,
    'contacts_total',      pcta.total,
    'contacts_by_status',  jsonb_build_object(
      'raw', pcta.raw_cnt, 'filtered', pcta.filtered_cnt,
      'enriched', pcta.enriched_cnt, 'approved', pcta.approved_cnt, 'rejected', pcta.rejected_cnt
    ),
    'avg_ai_score',   COALESCE(pcta.avg_ai_score, 0),
    'approval_rate',  CASE WHEN pcta.total > 0
                        THEN ROUND((pcta.approved_cnt::numeric / pcta.total * 100), 1) ELSE 0 END
  ) INTO v_prospect
  FROM prospect_campaigns_agg pca, prospect_contacts_agg pcta;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ASSEMBLE
  -- ═══════════════════════════════════════════════════════════════════════
  result := jsonb_build_object(
    'funnel',    COALESCE(v_funnel,    '{}'::jsonb),
    'people',    COALESCE(v_people,    '{}'::jsonb),
    'messages',  COALESCE(v_messages,  '{}'::jsonb),
    'meetings',  COALESCE(v_meetings,  '{}'::jsonb),
    'calls',     COALESCE(v_calls,     '{}'::jsonb),
    'marketing', COALESCE(v_marketing, '{}'::jsonb),
    'prospect',  COALESCE(v_prospect,  '{}'::jsonb)
  );

  RETURN result;
END;
$function$;
