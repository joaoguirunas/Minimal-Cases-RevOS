-- Correções da revisão final dos fluxos.
-- (1) Fluxo 'live' só envia de verdade quando tem funil definido e o funil está em 'flows'
--     (exceção: gatilhos 'manual' e 'purchased' sem funil). Sem funil → só simula.
-- (10) Config de gatilho inválida não derruba o gatilho dos demais fluxos.
CREATE OR REPLACE FUNCTION public.flow_trigger(p_event text, p_people_id uuid, p_lead_id uuid, p_payload jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE f record; v_mode text; v_n int := 0; v_pipeline text; v_ok boolean; v_req uuid;
BEGIN
  IF p_people_id IS NULL THEN RETURN 0; END IF;
  IF p_lead_id IS NOT NULL THEN
    SELECT p.name INTO v_pipeline FROM public.leads l JOIN public.leads_pipelines p ON p.id = l.leads_pipelines_id WHERE l.id = p_lead_id;
  END IF;
  FOR f IN SELECT * FROM public.flows WHERE trigger_type = p_event AND status IN ('live','simulation') AND live_version_id IS NOT NULL LOOP
    BEGIN
      v_ok := true;
      IF f.trigger_config ? 'pipeline' AND coalesce(v_pipeline, p_payload->>'pipeline', '') <> f.trigger_config->>'pipeline' AND p_event <> 'manual' THEN v_ok := false; END IF;
      IF f.trigger_config ? 'stage_id' AND coalesce(p_payload->>'stage_id', '') <> f.trigger_config->>'stage_id' THEN v_ok := false; END IF;
      IF f.trigger_config ? 'methods' AND NOT (f.trigger_config->'methods') ? coalesce(p_payload->>'method', '') THEN v_ok := false; END IF;
      IF f.trigger_config ? 'channel' AND f.trigger_config->>'channel' <> 'any' AND coalesce(p_payload->>'channel', '') <> f.trigger_config->>'channel' THEN v_ok := false; END IF;
      IF f.trigger_config ? 'require_active_flow' THEN
        v_req := CASE WHEN (f.trigger_config->>'require_active_flow') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      THEN (f.trigger_config->>'require_active_flow')::uuid END;
        IF v_req IS NULL OR NOT EXISTS (
             SELECT 1 FROM public.flow_runs r WHERE r.flow_id = v_req AND r.people_id = p_people_id
               AND (r.status = 'active' OR r.ended_at > now() - interval '7 days')) THEN v_ok := false; END IF;
      END IF;
      CONTINUE WHEN NOT v_ok;
      v_mode := CASE
        WHEN f.status <> 'live' THEN 'simulation'
        WHEN f.trigger_config ? 'pipeline' THEN CASE WHEN public.flow_engine_for(f.trigger_config->>'pipeline') = 'flows' THEN 'live' ELSE 'simulation' END
        WHEN f.trigger_type IN ('manual','purchased') THEN 'live'
        ELSE 'simulation' END;
      CONTINUE WHEN f.reentry = 'never' AND EXISTS (SELECT 1 FROM public.flow_runs WHERE flow_id = f.id AND people_id = p_people_id AND mode = v_mode);
      INSERT INTO public.flow_runs (flow_id, version_id, people_id, lead_id, mode, context)
      VALUES (f.id, f.live_version_id, p_people_id, p_lead_id, v_mode, jsonb_build_object('trigger', p_payload, 'event', p_event))
      ON CONFLICT DO NOTHING;
      IF FOUND THEN v_n := v_n + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      -- um fluxo com configuração ruim não impede os demais
      RAISE WARNING 'flow_trigger: fluxo % ignorado: %', f.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_n;
END $$;

-- (4) um nó de envio entra uma única vez na fila por execução (reprocessamento não duplica)
CREATE UNIQUE INDEX IF NOT EXISTS uq_followup_queue_flow_node ON public.followup_queue (flow_run_id, flow_node_id) WHERE flow_run_id IS NOT NULL;

-- (8) estatísticas sem multiplicar linhas: agrega cliques e vendas por envio antes de somar
CREATE OR REPLACE FUNCTION public.flow_stats(p_flow_id uuid, p_days int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  WITH s AS (
    SELECT node_id,
      count(*) FILTER (WHERE action IN ('entered','waited','branch','enqueued','would_send','skipped','moved_stage','tagged')) entered,
      count(*) FILTER (WHERE action = 'enqueued') enqueued,
      count(*) FILTER (WHERE action = 'would_send') would_send
    FROM public.flow_run_steps WHERE flow_id = p_flow_id AND at > now() - make_interval(days => p_days) GROUP BY node_id),
  w AS (SELECT current_node_id node_id, count(*) waiting FROM public.flow_runs WHERE flow_id = p_flow_id AND status = 'active' GROUP BY 1),
  qq AS (
    SELECT q.id, q.flow_node_id node_id, q.status,
      (SELECT count(*) FROM public.tracked_links l JOIN public.tracked_link_clicks c ON c.tracked_link_id = l.id
        WHERE l.followup_queue_id = q.id AND NOT coalesce(c.is_bot, false) AND NOT coalesce(c.is_duplicate, false)) clicks,
      (SELECT count(*) FROM public.order_attribution a WHERE a.followup_queue_id = q.id AND a.class = 'recuperado') sales,
      (SELECT coalesce(sum(a.value_total), 0) FROM public.order_attribution a WHERE a.followup_queue_id = q.id AND a.class = 'recuperado') revenue
    FROM public.followup_queue q JOIN public.flow_runs r ON r.id = q.flow_run_id AND r.flow_id = p_flow_id
    WHERE q.created_at > now() - make_interval(days => p_days)),
  q AS (SELECT node_id, count(*) FILTER (WHERE status IN ('queued','sent')) sent, sum(clicks) clicks, sum(sales) sales, sum(revenue) revenue FROM qq GROUP BY node_id)
  SELECT coalesce(jsonb_object_agg(n.node_id, jsonb_build_object(
      'entered', coalesce(s.entered, 0), 'waiting', coalesce(w.waiting, 0), 'enqueued', coalesce(s.enqueued, 0),
      'would_send', coalesce(s.would_send, 0), 'sent', coalesce(q.sent, 0), 'clicks', coalesce(q.clicks, 0),
      'sales', coalesce(q.sales, 0), 'revenue', coalesce(q.revenue, 0))), '{}'::jsonb)
  FROM (SELECT node_id FROM s UNION SELECT node_id FROM w WHERE node_id IS NOT NULL UNION SELECT node_id FROM q WHERE node_id IS NOT NULL) n
  LEFT JOIN s ON s.node_id = n.node_id LEFT JOIN w ON w.node_id = n.node_id LEFT JOIN q ON q.node_id = n.node_id $$;

REVOKE EXECUTE ON FUNCTION public.flow_trigger(text, uuid, uuid, jsonb), public.flow_stats(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flow_trigger(text, uuid, uuid, jsonb), public.flow_stats(uuid, int) TO service_role;

-- (6) Fluxos gerados das regras: envios herdam "só em horário comercial" da regra de origem
--     (o worker segura a linha de fluxo quando vars.business_hours_only = true).
DO $$ DECLARE f record; g jsonb; BEGIN
  FOR f IN SELECT id, draft_graph FROM public.flows WHERE name LIKE 'Esteira v2 —%' LOOP
    SELECT jsonb_set(f.draft_graph, '{nodes}', coalesce(jsonb_agg(
      CASE WHEN n->>'type' LIKE 'send_%' AND (n->'data') ? 'rule_id'
           THEN jsonb_set(n, '{data,vars,business_hours_only}',
                  to_jsonb(coalesce((SELECT r.business_hours_only FROM public.leads_stages_followups r WHERE r.id = (n->'data'->>'rule_id')::uuid), false)), true)
           ELSE n END ORDER BY ord), '[]'::jsonb))
      INTO g FROM jsonb_array_elements(f.draft_graph->'nodes') WITH ORDINALITY x(n, ord);
    UPDATE public.flows SET draft_graph = g, updated_at = now() WHERE id = f.id;
    UPDATE public.flow_versions SET graph = g WHERE flow_id = f.id AND id = (SELECT live_version_id FROM public.flows WHERE id = f.id);
  END LOOP;
END $$;
