-- supabase/migrations/20260927100000_flows_core.sql
-- Fluxos em nós: motor (versões, execuções, passos), gatilho, saída na compra, estatísticas e comparação da simulação.
CREATE TABLE IF NOT EXISTS public.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','simulation','live','paused','archived')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('cart_abandoned','payment_pending','payment_refused','purchased','stage_entered','link_clicked','manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  exit_on_purchase boolean NOT NULL DEFAULT true,
  reentry text NOT NULL DEFAULT 'after_exit' CHECK (reentry IN ('never','after_exit')),
  live_version_id uuid,
  draft_graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  version int NOT NULL,
  graph jsonb NOT NULL,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, version));
ALTER TABLE public.flows ADD CONSTRAINT flows_live_version_fk FOREIGN KEY (live_version_id) REFERENCES public.flow_versions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS public.flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.flow_versions(id),
  people_id uuid NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('live','simulation')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','exited','failed')),
  current_node_id text,
  wake_at timestamptz,
  context jsonb NOT NULL DEFAULT '{}',
  attempts int NOT NULL DEFAULT 0,
  exit_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_flow_runs_active ON public.flow_runs (flow_id, people_id, mode) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_flow_runs_wake ON public.flow_runs (status, wake_at);
CREATE INDEX IF NOT EXISTS idx_flow_runs_people ON public.flow_runs (people_id, status);

CREATE TABLE IF NOT EXISTS public.flow_run_steps (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.flow_runs(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL,
  node_id text NOT NULL,
  node_type text NOT NULL,
  action text NOT NULL CHECK (action IN ('entered','waited','branch','enqueued','would_send','skipped','moved_stage','tagged','exited','completed','error')),
  detail jsonb NOT NULL DEFAULT '{}',
  at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow ON public.flow_run_steps (flow_id, node_id, at);
CREATE INDEX IF NOT EXISTS idx_flow_steps_run ON public.flow_run_steps (run_id);

ALTER TABLE public.followup_queue DROP CONSTRAINT IF EXISTS followup_queue_source_type_check;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_source_type_check CHECK (source_type IN ('stage','meeting','flow'));
ALTER TABLE public.followup_queue ADD COLUMN IF NOT EXISTS flow_run_id uuid REFERENCES public.flow_runs(id) ON DELETE SET NULL;
ALTER TABLE public.followup_queue ADD COLUMN IF NOT EXISTS flow_node_id text;
ALTER TABLE public.followup_queue ADD COLUMN IF NOT EXISTS vars jsonb;
CREATE INDEX IF NOT EXISTS idx_followup_queue_flow_run ON public.followup_queue (flow_run_id) WHERE flow_run_id IS NOT NULL;

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_run_steps ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['flows','flow_versions','flow_runs','flow_run_steps'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active) AND NOT (SELECT public.is_commercial()))', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'')', t || '_service', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.flow_engine_for(p_pipeline text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce((SELECT settings -> 'esteira_engine' ->> p_pipeline FROM public.omni_channel_configs WHERE channel = 'whatsapp'), 'rules') $$;

CREATE OR REPLACE FUNCTION public.flow_trigger(p_event text, p_people_id uuid, p_lead_id uuid, p_payload jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE f record; v_mode text; v_n int := 0; v_pipeline text; v_ok boolean;
BEGIN
  IF p_people_id IS NULL THEN RETURN 0; END IF;
  IF p_lead_id IS NOT NULL THEN
    SELECT p.name INTO v_pipeline FROM public.leads l JOIN public.leads_pipelines p ON p.id = l.leads_pipelines_id WHERE l.id = p_lead_id;
  END IF;
  FOR f IN SELECT * FROM public.flows WHERE trigger_type = p_event AND status IN ('live','simulation') AND live_version_id IS NOT NULL LOOP
    -- filtros do gatilho
    v_ok := true;
    IF f.trigger_config ? 'pipeline' AND coalesce(v_pipeline, p_payload->>'pipeline', '') <> f.trigger_config->>'pipeline' AND p_event <> 'manual' THEN v_ok := false; END IF;
    IF f.trigger_config ? 'stage_id' AND coalesce(p_payload->>'stage_id', '') <> f.trigger_config->>'stage_id' THEN v_ok := false; END IF;
    IF f.trigger_config ? 'methods' AND NOT (f.trigger_config->'methods') ? coalesce(p_payload->>'method', '') THEN v_ok := false; END IF;
    IF f.trigger_config ? 'channel' AND f.trigger_config->>'channel' <> 'any' AND coalesce(p_payload->>'channel', '') <> f.trigger_config->>'channel' THEN v_ok := false; END IF;
    IF f.trigger_config ? 'require_active_flow' AND NOT EXISTS (
         SELECT 1 FROM public.flow_runs r WHERE r.flow_id = (f.trigger_config->>'require_active_flow')::uuid AND r.people_id = p_people_id
           AND (r.status = 'active' OR r.ended_at > now() - interval '7 days')) THEN v_ok := false; END IF;
    CONTINUE WHEN NOT v_ok;
    -- modo: live só com fluxo live e (sem pipeline ou pipeline no motor 'flows')
    v_mode := CASE WHEN f.status = 'live' AND (NOT (f.trigger_config ? 'pipeline') OR public.flow_engine_for(f.trigger_config->>'pipeline') = 'flows')
                   THEN 'live' ELSE 'simulation' END;
    CONTINUE WHEN f.reentry = 'never' AND EXISTS (SELECT 1 FROM public.flow_runs WHERE flow_id = f.id AND people_id = p_people_id AND mode = v_mode);
    INSERT INTO public.flow_runs (flow_id, version_id, people_id, lead_id, mode, context)
    VALUES (f.id, f.live_version_id, p_people_id, p_lead_id, v_mode, jsonb_build_object('trigger', p_payload, 'event', p_event))
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION public.flow_claim_runs(p_limit int) RETURNS SETOF public.flow_runs
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.flow_runs r SET updated_at = now(), wake_at = now() + interval '10 minutes'
   WHERE r.id IN (
     SELECT r2.id FROM public.flow_runs r2 JOIN public.flows f ON f.id = r2.flow_id
      WHERE r2.status = 'active' AND (r2.wake_at IS NULL OR r2.wake_at <= now()) AND f.status IN ('live','simulation')
      ORDER BY r2.wake_at NULLS FIRST LIMIT p_limit FOR UPDATE OF r2 SKIP LOCKED)
  RETURNING r.* $$;
-- (o wake_at +10 min é um "lease": se o runner cair no meio, a execução volta sozinha depois)

CREATE OR REPLACE FUNCTION public.flow_exit_person(p_people_id uuid, p_reason text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v int;
BEGIN
  WITH ex AS (
    UPDATE public.flow_runs r SET status = 'exited', exit_reason = p_reason, ended_at = now(), updated_at = now()
      FROM public.flows f
     WHERE f.id = r.flow_id AND r.people_id = p_people_id AND r.status = 'active' AND f.exit_on_purchase
    RETURNING r.id, r.flow_id, r.current_node_id)
  INSERT INTO public.flow_run_steps (run_id, flow_id, node_id, node_type, action, detail)
  SELECT id, flow_id, coalesce(current_node_id, '-'), 'exit', 'exited', jsonb_build_object('reason', p_reason) FROM ex;
  GET DIAGNOSTICS v = ROW_COUNT;
  UPDATE public.followup_queue SET status = 'cancelled', error_message = 'auto-cancel: ' || p_reason, updated_at = now()
   WHERE person_id = p_people_id AND source_type = 'flow' AND status = 'pending';
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.flow_stats(p_flow_id uuid, p_days int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  WITH s AS (
    SELECT node_id,
      count(*) FILTER (WHERE action IN ('entered','waited','branch','enqueued','would_send','skipped','moved_stage','tagged')) entered,
      count(*) FILTER (WHERE action = 'enqueued') enqueued,
      count(*) FILTER (WHERE action = 'would_send') would_send
    FROM public.flow_run_steps WHERE flow_id = p_flow_id AND at > now() - make_interval(days => p_days) GROUP BY node_id),
  w AS (SELECT current_node_id node_id, count(*) waiting FROM public.flow_runs WHERE flow_id = p_flow_id AND status = 'active' GROUP BY 1),
  q AS (
    SELECT q.flow_node_id node_id,
      count(*) FILTER (WHERE q.status IN ('queued','sent')) sent,
      count(DISTINCT c.id) FILTER (WHERE NOT c.is_bot AND NOT c.is_duplicate) clicks,
      count(DISTINCT a.order_id) FILTER (WHERE a.class = 'recuperado') sales,
      coalesce(sum(DISTINCT a.value_total) FILTER (WHERE a.class = 'recuperado'), 0) revenue
    FROM public.followup_queue q
    JOIN public.flow_runs r ON r.id = q.flow_run_id AND r.flow_id = p_flow_id
    LEFT JOIN public.tracked_links l ON l.followup_queue_id = q.id
    LEFT JOIN public.tracked_link_clicks c ON c.tracked_link_id = l.id
    LEFT JOIN public.order_attribution a ON a.followup_queue_id = q.id
    WHERE q.created_at > now() - make_interval(days => p_days) GROUP BY 1)
  SELECT coalesce(jsonb_object_agg(n.node_id, jsonb_build_object(
      'entered', coalesce(s.entered, 0), 'waiting', coalesce(w.waiting, 0), 'enqueued', coalesce(s.enqueued, 0),
      'would_send', coalesce(s.would_send, 0), 'sent', coalesce(q.sent, 0), 'clicks', coalesce(q.clicks, 0),
      'sales', coalesce(q.sales, 0), 'revenue', coalesce(q.revenue, 0))), '{}'::jsonb)
  FROM (SELECT node_id FROM s UNION SELECT node_id FROM w WHERE node_id IS NOT NULL UNION SELECT node_id FROM q WHERE node_id IS NOT NULL) n
  LEFT JOIN s ON s.node_id = n.node_id LEFT JOIN w ON w.node_id = n.node_id LEFT JOIN q ON q.node_id = n.node_id $$;

-- Simulação × regras: por lead, sequência de toques que o fluxo "enviaria" × toques que as regras enviaram.
CREATE OR REPLACE FUNCTION public.flow_sim_compare(p_flow_id uuid, p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  WITH runs AS (
    SELECT r.id, r.lead_id, r.people_id FROM public.flow_runs r
     WHERE r.flow_id = p_flow_id AND r.mode = 'simulation' AND r.started_at >= p_from AND r.started_at < p_to AND r.lead_id IS NOT NULL),
  sim AS (
    SELECT r.lead_id, s.detail->>'key' k, s.at FROM runs r JOIN public.flow_run_steps s ON s.run_id = r.id AND s.action = 'would_send'),
  real AS (
    SELECT q.lead_id, coalesce(q.template_id, f.email_template_id::text, q.subject) k, coalesce(q.fired_at, q.scheduled_for) at
      FROM public.followup_queue q JOIN runs r ON r.lead_id = q.lead_id
      LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
     WHERE q.source_type = 'stage' AND q.status IN ('queued','sent')),
  seq AS (
    SELECT r.lead_id,
      coalesce((SELECT jsonb_agg(jsonb_build_object('k', k, 'at', at) ORDER BY at) FROM sim WHERE sim.lead_id = r.lead_id), '[]') s,
      coalesce((SELECT jsonb_agg(jsonb_build_object('k', k, 'at', at) ORDER BY at) FROM real WHERE real.lead_id = r.lead_id AND real.at <= now()), '[]') q
    FROM runs r),
  cmp AS (
    SELECT lead_id, s, q,
      jsonb_array_length(q) = (SELECT count(*) FROM jsonb_array_elements(s) e WHERE (e->>'at')::timestamptz <= now())
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(q) WITH ORDINALITY a(v, i) JOIN jsonb_array_elements(s) WITH ORDINALITY b(v, i) USING (i)
         WHERE a.v->>'k' <> b.v->>'k' OR abs(extract(epoch FROM (a.v->>'at')::timestamptz - (b.v->>'at')::timestamptz)) > 900) same
    FROM seq)
  SELECT jsonb_build_object(
    'leads', count(*), 'identical', count(*) FILTER (WHERE same),
    'pct', round(100.0 * count(*) FILTER (WHERE same) / nullif(count(*), 0), 1),
    'diffs', coalesce((SELECT jsonb_agg(jsonb_build_object('lead_id', lead_id, 'fluxo', s, 'regras', q)) FROM (SELECT * FROM cmp WHERE NOT same LIMIT 20) d), '[]'))
  FROM cmp $$;

REVOKE EXECUTE ON FUNCTION public.flow_engine_for(text), public.flow_trigger(text, uuid, uuid, jsonb), public.flow_claim_runs(int),
  public.flow_exit_person(uuid, text), public.flow_stats(uuid, int), public.flow_sim_compare(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flow_engine_for(text), public.flow_trigger(text, uuid, uuid, jsonb), public.flow_claim_runs(int),
  public.flow_exit_person(uuid, text), public.flow_stats(uuid, int), public.flow_sim_compare(uuid, timestamptz, timestamptz) TO service_role;

-- Motor por pipeline: começa tudo em 'rules'
UPDATE public.omni_channel_configs SET settings = settings || '{"esteira_engine": {"Esteira Minimal — Loja": "rules", "Esteira Validação": "rules"}}'::jsonb
 WHERE channel = 'whatsapp' AND NOT (settings ? 'esteira_engine');

-- Clique das regras antigas não agenda nada quando o pipeline já roda em fluxos
CREATE OR REPLACE FUNCTION public.schedule_esteira_click_touch(p_lead_id uuid, p_people_id uuid, p_channel text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_lead record; v_stage text; v_rule record; v_col text; v_claimed boolean; v_pipeline text;
BEGIN
  IF p_channel NOT IN ('whatsapp', 'email') THEN RETURN 'canal sem toque de clique'; END IF;
  IF p_lead_id IS NULL OR p_people_id IS NULL THEN RETURN 'link sem lead/pessoa'; END IF;
  SELECT id, status, leads_pipelines_id, leads_stages_id INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN 'lead não encontrado'; END IF;
  IF v_lead.status <> 'in_progress' THEN RETURN 'lead ' || v_lead.status; END IF;
  SELECT name INTO v_pipeline FROM public.leads_pipelines WHERE id = v_lead.leads_pipelines_id;
  IF public.flow_engine_for(v_pipeline) = 'flows' THEN RETURN 'pipeline em fluxos'; END IF;
  SELECT name INTO v_stage FROM public.leads_stages WHERE id = v_lead.leads_stages_id;
  IF v_stage IS NULL OR v_stage NOT IN ('Carrinho abandonado', 'Em recuperação', 'Engajou') THEN
    RETURN 'etapa ' || coalesce(v_stage, '?');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.followup_queue q
    JOIN public.leads_stages_followups f ON f.id = q.followup_id
    WHERE q.lead_id = p_lead_id AND q.status <> 'cancelled' AND f.vars->>'cupom_pessoal' = 'true'
  ) THEN RETURN 'lead fora da esteira v2'; END IF;
  SELECT f.* INTO v_rule
  FROM public.leads_stages_followups f
  JOIN public.leads_stages s ON s.id = f.leads_stages_id
  WHERE s.leads_pipelines_id = v_lead.leads_pipelines_id
    AND f.active = true AND f.trigger_on = 'click_' || p_channel
  ORDER BY f.created_at LIMIT 1;
  IF NOT FOUND THEN RETURN 'sem regra ativa de clique ' || p_channel; END IF;
  v_col := 'esteira_click_' || p_channel || '_at';
  EXECUTE format('UPDATE public.clients_people SET %I = now() WHERE id = $1 AND %I IS NULL RETURNING true', v_col, v_col)
    INTO v_claimed USING p_people_id;
  IF v_claimed IS NOT TRUE THEN RETURN 'já disparou antes'; END IF;
  INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status)
  VALUES (v_rule.id, p_lead_id, p_people_id, v_rule.type, v_rule.template_id, v_rule.message, v_rule.subject, 'stage',
          now() + make_interval(days => coalesce(v_rule.days,0), hours => coalesce(v_rule.hours,0), mins => coalesce(v_rule.minutes,0)),
          'pending');
  RETURN 'agendado';
END $function$;

-- Mudar para etapa fora da esteira cancela também os toques de fluxo e encerra as execuções do lead
CREATE OR REPLACE FUNCTION public.notify_lead_stage_changed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'net' AS $function$
DECLARE v_supabase_url TEXT; v_service_key TEXT; v_new_stage_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN RETURN NEW; END IF;
  IF NEW.leads_stages_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO v_new_stage_name FROM public.leads_stages WHERE id = NEW.leads_stages_id;
  IF v_new_stage_name IS NULL OR v_new_stage_name NOT IN ('Em recuperação', 'Engajou') THEN
    UPDATE public.followup_queue
    SET status = 'cancelled', fired_at = now(), error_message = 'Cancelado: lead mudou de etapa'
    WHERE lead_id = NEW.id AND status = 'pending' AND source_type IN ('stage', 'flow');
    IF TG_OP = 'UPDATE' THEN
      UPDATE public.flow_runs SET status = 'exited', exit_reason = 'lead mudou de etapa: ' || coalesce(v_new_stage_name, '?'), ended_at = now(), updated_at = now()
       WHERE lead_id = NEW.id AND status = 'active';
    END IF;
  END IF;
  SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key  FROM public._app_config WHERE key = 'service_role_key';
  IF v_supabase_url IS NULL OR v_supabase_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('tipo', 'lead_etapa', 'lead_id', NEW.id::text));
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/followup-enqueue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('lead_id', NEW.id::text, 'stage_id', NEW.leads_stages_id::text, 'source_type', 'stage'));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.webhook_logs (webhook_id, status_code, response_body, request_body, created_at)
  VALUES (NULL, 500, jsonb_build_object('error', SQLERRM, 'source', 'notify_lead_stage_changed'), jsonb_build_object('lead_id', NEW.id::text), now());
  RETURN NEW;
END; $function$;

-- Runner a cada minuto (mesmo padrão dos outros crons: net.http_post com a service key do _app_config)
SELECT cron.schedule('flow-runner', '* * * * *', $$
  SELECT net.http_post(
    url := (SELECT value FROM public._app_config WHERE key = 'supabase_url') || '/functions/v1/flow-runner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT value FROM public._app_config WHERE key = 'service_role_key')),
    body := '{}'::jsonb)
  WHERE EXISTS (SELECT 1 FROM public.flows WHERE status IN ('live','simulation'));
$$);

-- Atribuição: toque de fluxo (sem regra) usa assunto/template da própria fila
CREATE OR REPLACE FUNCTION public.compute_order_attribution(p_order_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o record; v_coupon boolean := false; v_click record; v_touch record; v_rec_by uuid;
  v_class text := 'organico'; v_proof text; v_channel text; v_tpl text; v_fq uuid; v_stage text; v_hours numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR NOT o.is_paid OR o.paid_at IS NULL THEN
    DELETE FROM public.order_attribution WHERE order_id = p_order_id; RETURN;
  END IF;

  IF o.people_id IS NOT NULL THEN
    -- 1) cupom nosso
    v_coupon := o.coupon_code IS NOT NULL AND EXISTS (SELECT 1 FROM public.crm_coupons c
      WHERE upper(c.code) = upper(o.coupon_code) AND c.source IN ('esteira','agente','comercial'));
    -- 2) clique humano ≤ 7 d antes
    SELECT c.clicked_at, l.channel, l.template_name, l.followup_queue_id INTO v_click
      FROM public.tracked_link_clicks c JOIN public.tracked_links l ON l.id = c.tracked_link_id
     WHERE c.people_id = o.people_id AND NOT c.is_bot AND NOT c.is_duplicate
       AND c.clicked_at <= o.paid_at AND c.clicked_at >= o.paid_at - interval '7 days'
     ORDER BY c.clicked_at DESC LIMIT 1;
    -- 3) comercial (mantém a decisão já gravada pelo yampi-process-event)
    SELECT r.recovered_by INTO v_rec_by FROM public.esteira_reconversions r WHERE r.order_id = o.id::text AND r.recovered_by IS NOT NULL;
    -- último toque ≤ 7 d antes
    SELECT q.id, q.channel, q.fired_at, coalesce(f.subject, q.subject, q.template_id) AS tpl, s.name AS stage INTO v_touch
      FROM public.followup_queue q
      LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
      LEFT JOIN public.leads_stages s ON s.id = f.leads_stages_id
     WHERE q.person_id = o.people_id AND q.status IN ('queued','sent')
       AND q.fired_at < o.paid_at AND q.fired_at >= o.paid_at - interval '7 days'
     ORDER BY q.fired_at DESC LIMIT 1;

    IF v_coupon THEN
      v_class := 'recuperado'; v_proof := 'cupom';
      v_channel := CASE WHEN v_touch.channel = 'email' THEN 'email' WHEN v_touch.channel IS NOT NULL THEN 'whatsapp' END;
    ELSIF v_click.clicked_at IS NOT NULL THEN
      v_class := 'recuperado'; v_proof := 'clique';
      v_channel := CASE WHEN v_click.channel = 'email' THEN 'email' ELSE 'whatsapp' END;
      v_tpl := v_click.template_name;
      SELECT q.id, s.name INTO v_fq, v_stage FROM public.followup_queue q
        LEFT JOIN public.leads_stages_followups f ON f.id = q.followup_id
        LEFT JOIN public.leads_stages s ON s.id = f.leads_stages_id WHERE q.id = v_click.followup_queue_id;
    ELSIF v_rec_by IS NOT NULL THEN
      v_class := 'recuperado'; v_proof := 'comercial'; v_channel := 'comercial'; v_stage := 'Carrinho abandonado';
    ELSIF v_touch.id IS NOT NULL THEN
      v_class := 'influenciado';
      v_channel := CASE WHEN v_touch.channel = 'email' THEN 'email' ELSE 'whatsapp' END;
    END IF;
    IF v_tpl IS NULL THEN v_tpl := v_touch.tpl; END IF;
    IF v_fq IS NULL THEN v_fq := v_touch.id; END IF;
    IF v_stage IS NULL THEN v_stage := v_touch.stage; END IF;
    IF v_class <> 'organico' THEN
      SELECT extract(epoch FROM (o.paid_at - min(q.fired_at))) / 3600 INTO v_hours FROM public.followup_queue q
       WHERE q.person_id = o.people_id AND q.status IN ('queued','sent') AND q.fired_at < o.paid_at AND q.fired_at >= o.paid_at - interval '7 days';
    END IF;
  END IF;

  INSERT INTO public.order_attribution AS a (order_id, people_id, paid_at, value_total, class, proof, channel, touch_template,
    followup_queue_id, recovered_by, recovery_type, hours_to_recover, computed_at)
  VALUES (o.id, o.people_id, o.paid_at, o.value_total, v_class, v_proof, v_channel,
    CASE WHEN v_class = 'organico' THEN NULL ELSE v_tpl END, CASE WHEN v_class = 'organico' THEN NULL ELSE v_fq END,
    v_rec_by, CASE WHEN v_class = 'organico' THEN NULL ELSE public._recovery_type(v_stage, o.payment_method) END, v_hours, now())
  ON CONFLICT (order_id) DO UPDATE SET people_id = EXCLUDED.people_id, paid_at = EXCLUDED.paid_at, value_total = EXCLUDED.value_total,
    class = EXCLUDED.class, proof = EXCLUDED.proof, channel = EXCLUDED.channel, touch_template = EXCLUDED.touch_template,
    followup_queue_id = EXCLUDED.followup_queue_id, recovered_by = EXCLUDED.recovered_by, recovery_type = EXCLUDED.recovery_type,
    hours_to_recover = EXCLUDED.hours_to_recover, computed_at = now();
END $function$;
