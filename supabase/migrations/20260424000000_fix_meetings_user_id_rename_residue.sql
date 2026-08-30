-- HOTFIX: Restore RPC functions broken by 20260227 rename of meetings.users_id → user_id
-- Migration 20260227140000_p6_fk_column_consistency renamed the column but three functions
-- retained stale references: get_available_slots (m.users_id), get_insights_context
-- (m.users_id and mb.users_id), and get_booking_session (m.users_id in slot filter).
-- All three are re-created with corrected column references.

-- ── 1. get_available_slots ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_user_id      UUID,
  p_date         DATE,
  p_period       TEXT DEFAULT NULL,
  p_slot_minutes INT  DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow         INT;
  v_user_name   TEXT;
  v_result      JSONB := '[]'::JSONB;
  v_period_start TIME;
  v_period_end   TIME;
  rec           RECORD;
  v_cursor      TIME;
  v_slot_end    TIME;
  v_is_free     BOOLEAN;
BEGIN
  -- Validation
  IF p_slot_minutes < 15 OR p_slot_minutes > 480 THEN
    RAISE EXCEPTION 'p_slot_minutes must be between 15 and 480';
  END IF;

  -- Get user name
  SELECT name INTO v_user_name
  FROM settings_users
  WHERE id = p_user_id AND active = TRUE AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Day of week
  v_dow := EXTRACT(DOW FROM p_date)::INT;

  -- Period filter
  IF p_period = 'morning' THEN
    v_period_start := '08:00'::TIME;
    v_period_end   := '12:00'::TIME;
  ELSIF p_period = 'afternoon' THEN
    v_period_start := '12:00'::TIME;
    v_period_end   := '18:00'::TIME;
  ELSIF p_period = 'evening' THEN
    v_period_start := '18:00'::TIME;
    v_period_end   := '22:00'::TIME;
  ELSE
    v_period_start := '00:00'::TIME;
    v_period_end   := '23:59'::TIME;
  END IF;

  -- Generate slots
  FOR rec IN
    SELECT
      GREATEST(ss.start_time, v_period_start) AS win_start,
      LEAST(ss.end_time, v_period_end)        AS win_end
    FROM settings_schedules ss
    WHERE ss.user_id     = p_user_id
      AND ss.day_of_week = v_dow
      AND ss.is_available = TRUE
      AND ss.start_time  < v_period_end
      AND ss.end_time    > v_period_start
    ORDER BY ss.start_time
  LOOP
    v_cursor := rec.win_start;

    WHILE v_cursor + (p_slot_minutes || ' minutes')::INTERVAL <= rec.win_end LOOP
      v_slot_end := (v_cursor + (p_slot_minutes || ' minutes')::INTERVAL)::TIME;

      -- Check if slot is free
      SELECT NOT EXISTS (
        SELECT 1
        FROM meetings m
        WHERE m.user_id = p_user_id
          AND m.status NOT IN ('cancelada', 'cancelado')
          AND m.start_time < (p_date + v_slot_end)::TIMESTAMPTZ
          AND m.end_time   > (p_date + v_cursor)::TIMESTAMPTZ
      ) INTO v_is_free;

      IF v_is_free THEN
        v_result := v_result || jsonb_build_object(
          'slot_start', TO_CHAR(v_cursor, 'HH24:MI'),
          'slot_end',   TO_CHAR(v_slot_end, 'HH24:MI'),
          'user_id',    p_user_id,
          'user_name',  v_user_name
        );
      END IF;

      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, TEXT, INT) TO authenticated, service_role;

-- ── 2. get_insights_context ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_insights_context(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  v_funnel jsonb;
  v_people jsonb;
  v_messages jsonb;
  v_meetings jsonb;
  v_calls jsonb;
  v_marketing jsonb;
  v_prospect jsonb;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 1: FUNNEL (leads by stage, conversion, loss reasons, velocity)
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
      ls.name AS stage_name,
      ls.order_index,
      COUNT(lb.id) AS lead_count,
      COALESCE(SUM(lb.value), 0) AS total_value,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - lb.created_at)) / 86400)::numeric, 1) AS avg_days
    FROM lead_base lb
    JOIN leads_stages ls ON ls.id = lb.leads_stages_id
    WHERE lb.status = 'em-andamento'
    GROUP BY ls.name, ls.order_index
    ORDER BY ls.order_index
  ),
  loss_reasons AS (
    SELECT
      COALESCE(lr.name, 'Sem motivo') AS reason,
      COUNT(*) AS cnt
    FROM lead_base lb
    LEFT JOIN leads_loss_reasons lr ON lr.id = lb.leads_loss_reasons_id
    WHERE lb.status = 'perdido'
    GROUP BY lr.name
    ORDER BY cnt DESC
    LIMIT 5
  ),
  funnel_totals AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'ganho') AS won,
      COUNT(*) FILTER (WHERE status = 'perdido') AS lost,
      COUNT(*) FILTER (WHERE status = 'em-andamento') AS active,
      COALESCE(SUM(value) FILTER (WHERE status = 'ganho'), 0) AS revenue,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - created_at)) / 86400) FILTER (WHERE status = 'ganho' AND won_at IS NOT NULL))::numeric, 1) AS avg_cycle_days
    FROM lead_base
  )
  SELECT jsonb_build_object(
    'total', ft.total,
    'won', ft.won,
    'lost', ft.lost,
    'active', ft.active,
    'revenue', ft.revenue,
    'avg_deal', CASE WHEN ft.won > 0 THEN ROUND((ft.revenue / ft.won)::numeric, 2) ELSE 0 END,
    'conversion_pct', CASE WHEN ft.total > 0 THEN ROUND((ft.won::numeric / ft.total * 100), 1) ELSE 0 END,
    'avg_cycle_days', COALESCE(ft.avg_cycle_days, 0),
    'stages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', s.stage_name, 'leads', s.lead_count, 'value', s.total_value, 'avg_days', s.avg_days
    ) ORDER BY s.order_index) FROM stages_agg s), '[]'::jsonb),
    'loss_reasons', COALESCE((SELECT jsonb_agg(jsonb_build_object(
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
      COUNT(*) FILTER (WHERE status = 'ativo') AS active,
      COUNT(*) FILTER (WHERE status != 'ativo') AS inactive,
      COUNT(*) FILTER (WHERE score BETWEEN 0 AND 25) AS score_0_25,
      COUNT(*) FILTER (WHERE score BETWEEN 26 AND 50) AS score_26_50,
      COUNT(*) FILTER (WHERE score BETWEEN 51 AND 75) AS score_51_75,
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
    GROUP BY source
    ORDER BY cnt DESC
    LIMIT 5
  ),
  company_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'ativo') AS active
    FROM clients_companies
  )
  SELECT jsonb_build_object(
    'people_total', ps.total,
    'people_active', ps.active,
    'people_inactive', ps.inactive,
    'score_distribution', jsonb_build_object(
      '0_25', ps.score_0_25, '26_50', ps.score_26_50,
      '51_75', ps.score_51_75, '76_100', ps.score_76_100
    ),
    'top_sources', COALESCE((SELECT jsonb_agg(jsonb_build_object('source', ts.source, 'count', ts.cnt)) FROM top_sources ts), '[]'::jsonb),
    'companies_total', cs.total,
    'companies_active', cs.active
  ) INTO v_people
  FROM people_stats ps, company_stats cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 3: MESSAGES (volume by channel, IA vs human, trend, abandoned)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH msg_base AS (
    SELECT id, channel, from_contact, created_at, leads_id
    FROM messages
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  by_channel AS (
    SELECT channel, COUNT(*) AS cnt
    FROM msg_base GROUP BY channel ORDER BY cnt DESC
  ),
  by_sender AS (
    SELECT from_contact, COUNT(*) AS cnt
    FROM msg_base GROUP BY from_contact
  ),
  daily_trend AS (
    SELECT created_at::date AS day, COUNT(*) AS cnt
    FROM msg_base
    WHERE created_at >= (COALESCE(p_date_to, now()) - interval '7 days')
    GROUP BY day ORDER BY day
  ),
  abandoned AS (
    SELECT COUNT(DISTINCT leads_id) AS cnt
    FROM (
      SELECT leads_id,
             from_contact,
             created_at,
             LEAD(from_contact) OVER (PARTITION BY leads_id ORDER BY created_at) AS next_sender,
             LEAD(created_at) OVER (PARTITION BY leads_id ORDER BY created_at) AS next_at
      FROM msg_base
    ) sub
    WHERE from_contact = 'cliente'
      AND (next_sender IS NULL OR (next_sender != 'cliente' AND next_at - created_at > interval '24 hours'))
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM msg_base),
    'by_channel', COALESCE((SELECT jsonb_agg(jsonb_build_object('channel', c.channel, 'count', c.cnt)) FROM by_channel c), '[]'::jsonb),
    'by_sender', COALESCE((SELECT jsonb_agg(jsonb_build_object('sender', s.from_contact, 'count', s.cnt)) FROM by_sender s), '[]'::jsonb),
    'daily_trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt)) FROM daily_trend d), '[]'::jsonb),
    'abandoned_conversations', ab.cnt
  ) INTO v_messages
  FROM abandoned ab;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 4: MEETINGS (status, show rate by closer, time metrics)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH mtg_base AS (
    SELECT m.id, m.status, m.start_time, m.user_id, l.created_at AS lead_created, l.won_at
    FROM meetings m
    LEFT JOIN leads l ON l.id = m.leads_id
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
      COUNT(*) FILTER (WHERE mb.status = 'realizada') AS attended,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE mb.status = 'realizada'))::numeric / COUNT(*) * 100, 1)
        ELSE 0 END AS show_rate
    FROM mtg_base mb
    LEFT JOIN settings_users su ON su.id = mb.user_id
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 5
  ),
  time_metrics AS (
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (start_time - lead_created)) / 86400)::numeric, 1) AS avg_lead_to_meeting,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - start_time)) / 86400) FILTER (WHERE won_at IS NOT NULL))::numeric, 1) AS avg_meeting_to_close
    FROM mtg_base
    WHERE lead_created IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM mtg_base),
    'by_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', bs.status, 'count', bs.cnt)) FROM by_status bs), '[]'::jsonb),
    'show_rate_by_closer', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', sr.closer_name, 'total', sr.total, 'attended', sr.attended, 'show_rate', sr.show_rate
    )) FROM show_rate_by_user sr), '[]'::jsonb),
    'avg_lead_to_meeting_days', COALESCE(tm.avg_lead_to_meeting, 0),
    'avg_meeting_to_close_days', COALESCE(tm.avg_meeting_to_close, 0)
  ) INTO v_meetings
  FROM time_metrics tm;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 5: CALLS (inbound/outbound, answer rate, duration, operators)
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
      COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
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
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 3
  ),
  top_outcomes AS (
    SELECT outcome, COUNT(*) AS cnt
    FROM call_base
    WHERE outcome IS NOT NULL AND outcome != ''
    GROUP BY outcome
    ORDER BY cnt DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'total', cs.total,
    'inbound', cs.inbound,
    'outbound', cs.outbound,
    'answered', cs.answered,
    'answer_rate', CASE WHEN cs.total > 0 THEN ROUND((cs.answered::numeric / cs.total * 100), 1) ELSE 0 END,
    'avg_duration_sec', COALESCE(cs.avg_duration_sec, 0),
    'top_operators', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', op.operator_name, 'total', op.total, 'answered', op.answered
    )) FROM top_operators op), '[]'::jsonb),
    'top_outcomes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'outcome', o.outcome, 'count', o.cnt
    )) FROM top_outcomes o), '[]'::jsonb)
  ) INTO v_calls
  FROM call_summary cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 6: MARKETING (sends, LPs, UTM, Meta forms)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH sends_summary AS (
    SELECT
      COUNT(*) AS total_sends,
      SUM(total_contacts) AS total_contacts,
      SUM(sent_count) AS total_sent,
      SUM(delivered_count) AS total_delivered,
      SUM(read_count) AS total_read
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  sends_by_channel AS (
    SELECT channel, COUNT(*) AS cnt, SUM(sent_count) AS sent, SUM(delivered_count) AS delivered, SUM(read_count) AS read_cnt
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY channel
  ),
  lp_stats AS (
    SELECT
      p.name AS page_name,
      COUNT(*) FILTER (WHERE e.event_type = 'page_view') AS views,
      COUNT(*) FILTER (WHERE e.event_type = 'form_submit') AS submissions
    FROM lp_analytics_events e
    JOIN lp_pages p ON p.id = e.page_id
    WHERE (p_date_from IS NULL OR e.occurred_at >= p_date_from)
      AND (p_date_to   IS NULL OR e.occurred_at <= p_date_to)
    GROUP BY p.name
    ORDER BY views DESC
    LIMIT 5
  ),
  utm_stats AS (
    SELECT
      COALESCE(utm_source, 'direto') AS source,
      COALESCE(utm_medium, 'none') AS medium,
      COUNT(*) AS leads,
      COUNT(*) FILTER (WHERE status = 'ganho') AS won
    FROM leads
    WHERE utm_source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR leads_pipelines_id = p_pipeline_id)
    GROUP BY utm_source, utm_medium
    ORDER BY leads DESC
    LIMIT 5
  ),
  meta_forms_stats AS (
    SELECT
      mf.name AS form_name,
      COUNT(l.id) AS leads_count
    FROM meta_lead_forms mf
    LEFT JOIN leads l ON l.metadata->>'meta_form_id' = mf.meta_form_id
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
    WHERE mf.status = 'active'
    GROUP BY mf.name
    ORDER BY leads_count DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'sends', jsonb_build_object(
      'total_campaigns', ss.total_sends,
      'total_sent', COALESCE(ss.total_sent, 0),
      'total_delivered', COALESCE(ss.total_delivered, 0),
      'total_read', COALESCE(ss.total_read, 0),
      'delivery_rate', CASE WHEN COALESCE(ss.total_sent, 0) > 0
        THEN ROUND((COALESCE(ss.total_delivered, 0)::numeric / ss.total_sent * 100), 1) ELSE 0 END,
      'read_rate', CASE WHEN COALESCE(ss.total_delivered, 0) > 0
        THEN ROUND((COALESCE(ss.total_read, 0)::numeric / ss.total_delivered * 100), 1) ELSE 0 END,
      'by_channel', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'channel', sc.channel, 'campaigns', sc.cnt, 'sent', sc.sent, 'delivered', sc.delivered, 'read', sc.read_cnt
      )) FROM sends_by_channel sc), '[]'::jsonb)
    ),
    'landing_pages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'page', lps.page_name, 'views', lps.views, 'submissions', lps.submissions,
      'conversion_rate', CASE WHEN lps.views > 0 THEN ROUND((lps.submissions::numeric / lps.views * 100), 1) ELSE 0 END
    )) FROM lp_stats lps), '[]'::jsonb),
    'utm_attribution', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'source', u.source, 'medium', u.medium, 'leads', u.leads, 'won', u.won
    )) FROM utm_stats u), '[]'::jsonb),
    'meta_forms', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'form', mfs.form_name, 'leads', mfs.leads_count
    )) FROM meta_forms_stats mfs), '[]'::jsonb)
  ) INTO v_marketing
  FROM sends_summary ss;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 7: PROSPECT PRO (campaigns, contacts breakdown, AI score)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH prospect_campaigns_agg AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'running') AS running,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM prospect_campaigns
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  prospect_contacts_agg AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'raw') AS raw_cnt,
      COUNT(*) FILTER (WHERE status = 'filtered') AS filtered_cnt,
      COUNT(*) FILTER (WHERE status = 'enriched') AS enriched_cnt,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved_cnt,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_cnt,
      ROUND((AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL))::numeric, 0) AS avg_ai_score
    FROM prospect_contacts pc
    JOIN prospect_campaigns camp ON camp.id = pc.campaign_id
    WHERE (p_date_from IS NULL OR pc.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR pc.created_at <= p_date_to)
  )
  SELECT jsonb_build_object(
    'campaigns_total', pca.total,
    'campaigns_running', pca.running,
    'campaigns_completed', pca.completed,
    'contacts_total', pcta.total,
    'contacts_by_status', jsonb_build_object(
      'raw', pcta.raw_cnt, 'filtered', pcta.filtered_cnt,
      'enriched', pcta.enriched_cnt, 'approved', pcta.approved_cnt, 'rejected', pcta.rejected_cnt
    ),
    'avg_ai_score', COALESCE(pcta.avg_ai_score, 0),
    'approval_rate', CASE WHEN pcta.total > 0
      THEN ROUND((pcta.approved_cnt::numeric / pcta.total * 100), 1) ELSE 0 END
  ) INTO v_prospect
  FROM prospect_campaigns_agg pca, prospect_contacts_agg pcta;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ASSEMBLE FINAL RESULT
  -- ═══════════════════════════════════════════════════════════════════════
  result := jsonb_build_object(
    'funnel', COALESCE(v_funnel, '{}'::jsonb),
    'people', COALESCE(v_people, '{}'::jsonb),
    'messages', COALESCE(v_messages, '{}'::jsonb),
    'meetings', COALESCE(v_meetings, '{}'::jsonb),
    'calls', COALESCE(v_calls, '{}'::jsonb),
    'marketing', COALESCE(v_marketing, '{}'::jsonb),
    'prospect', COALESCE(v_prospect, '{}'::jsonb)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_insights_context(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_insights_context(timestamptz, timestamptz, uuid) TO service_role;

-- ── 3. get_booking_session ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_booking_session(
  p_lead_id     uuid,
  p_rule_set_id uuid    DEFAULT NULL,
  p_duration    integer DEFAULT 30,
  p_days_ahead  integer DEFAULT 14
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name   text;
  v_user_ids     uuid[];
  v_slots        json;
BEGIN
  -- 1. Lead / person lookup — only first name leaves this function (AC8)
  SELECT split_part(COALESCE(cp.name, 'Cliente'), ' ', 1)
  INTO v_first_name
  FROM public.leads l
  LEFT JOIN public.clients_people cp ON cp.id = l.people_id
  WHERE l.id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Lead not found');
  END IF;

  -- 2. Eligible consultants
  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  -- 3. Available slots (30-min intervals within schedule, excluding booked meetings)
  SELECT json_agg(
    json_build_object(
      'date',       slot_date,
      'start_time', start_time,
      'end_time',   end_time
    )
    ORDER BY slot_date, start_time
  )
  INTO v_slots
  FROM (
    SELECT DISTINCT
      TO_CHAR(dr.d, 'YYYY-MM-DD') AS slot_date,
      TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes'), 'HH24:MI') AS start_time,
      TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute'), 'HH24:MI') AS end_time,
      su.id AS user_id,
      dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes')) AS ts_start,
      dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')) AS ts_end
    FROM
      (SELECT (CURRENT_DATE + s.n)::date AS d
       FROM generate_series(0, p_days_ahead - 1) AS s(n)) AS dr
      CROSS JOIN (SELECT unnest(v_user_ids) AS id) AS cand
      INNER JOIN public.settings_users su ON su.id = cand.id AND su.active = true
      INNER JOIN public.settings_schedules ss
        ON ss.user_id = su.id
        AND ss.day_of_week = EXTRACT(DOW FROM dr.d)::int
        AND ss.is_available = true
      CROSS JOIN LATERAL (
        SELECT s2.n
        FROM generate_series(0,
          GREATEST(0, FLOOR(
            EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800
          )::int - 1)
        ) AS s2(n)
        WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')
              <= ss.end_time::time
      ) AS n
  ) AS all_slots
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.user_id    = all_slots.user_id
      AND m.start_time < all_slots.ts_end::timestamptz
      AND m.end_time   > all_slots.ts_start::timestamptz
      AND m.status NOT IN ('cancelado', 'cancelada')
  );

  RETURN json_build_object(
    'person', json_build_object('name', v_first_name),
    'slots',  COALESCE(v_slots, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_session(uuid, uuid, integer, integer) TO anon, authenticated, service_role;
