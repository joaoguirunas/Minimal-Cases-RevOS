-- supabase/migrations/20260926100000_correio_infra.sql
-- Correio próprio · Parte 1: contatos/supressão, registro de envios, eventos do Resend, freio.
CREATE TABLE IF NOT EXISTS public.email_contacts (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  people_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed','bounced','complained')),
  consent_source text,
  consent_at timestamptz,
  status_reason text,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_email_contacts_people ON public.email_contacts (people_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_status ON public.email_contacts (status);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  people_id uuid,
  kind text NOT NULL CHECK (kind IN ('esteira','campaign','flow','test','other')),
  followup_queue_id uuid,
  template_name text,
  subject text,
  provider text CHECK (provider IN ('resend','klaviyo')),
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('suppressed','sent','delivered','opened','clicked','bounced','complained','failed')),
  error text,
  sent_at timestamptz, delivered_at timestamptz, opened_at timestamptz, clicked_at timestamptz,
  bounced_at timestamptz, complained_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_email_messages_provider_id ON public.email_messages (provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_people ON public.email_messages (people_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_created ON public.email_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON public.email_messages (status, created_at);

CREATE TABLE IF NOT EXISTS public.email_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  provider_message_id text,
  payload jsonb NOT NULL,
  occurred_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_email_events_msg ON public.email_events (provider_message_id);

ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_contacts_read ON public.email_contacts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active) AND NOT (SELECT public.is_commercial()));
CREATE POLICY email_messages_read ON public.email_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active) AND NOT (SELECT public.is_commercial()));
CREATE POLICY email_contacts_service ON public.email_contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY email_messages_service ON public.email_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY email_events_service ON public.email_events FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.email_norm(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim(p)) $$;

CREATE OR REPLACE FUNCTION public.email_status_rank(p text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4
                WHEN 'bounced' THEN 9 WHEN 'complained' THEN 10 ELSE 0 END $$;

CREATE OR REPLACE FUNCTION public.email_event_status(p_type text, p_payload jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'email.delivered' THEN 'delivered'
    WHEN 'email.opened' THEN 'opened'
    WHEN 'email.clicked' THEN 'clicked'
    WHEN 'email.complained' THEN 'complained'
    WHEN 'email.failed' THEN 'failed'
    WHEN 'email.bounced' THEN CASE WHEN p_payload #>> '{data,bounce,type}' = 'Permanent' THEN 'bounced' END
  END $$;

CREATE OR REPLACE FUNCTION public.email_contact_status(p_email text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce((SELECT status FROM public.email_contacts WHERE email = public.email_norm(p_email)), 'subscribed') $$;

CREATE OR REPLACE FUNCTION public.email_cancel_pending(p_email text, p_reason text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v int;
BEGIN
  UPDATE public.followup_queue q SET status = 'cancelled', error_message = p_reason, updated_at = now()
   WHERE q.channel = 'email' AND q.status IN ('pending','held')
     AND q.person_id IN (SELECT id FROM public.clients_people WHERE public.email_norm(email) = public.email_norm(p_email));
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.email_set_contact_status(p_email text, p_status text, p_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_email text := public.email_norm(p_email); v_cur text;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RETURN NULL; END IF;
  SELECT status INTO v_cur FROM public.email_contacts WHERE email = v_email FOR UPDATE;
  -- bounced/complained são mais fortes: descadastro não rebaixa
  IF v_cur IN ('bounced','complained') AND p_status = 'unsubscribed' THEN RETURN v_cur; END IF;
  INSERT INTO public.email_contacts (email, people_id, status, status_reason, status_changed_at)
  VALUES (v_email, (SELECT id FROM public.clients_people WHERE public.email_norm(email) = v_email LIMIT 1), p_status, p_reason, now())
  ON CONFLICT (email) DO UPDATE SET status = excluded.status, status_reason = excluded.status_reason,
    status_changed_at = now(), updated_at = now();
  IF p_status <> 'subscribed' THEN
    PERFORM public.email_cancel_pending(v_email, CASE p_status WHEN 'unsubscribed' THEN 'descadastrou do e-mail'
      WHEN 'bounced' THEN 'e-mail inválido (bounce)' ELSE 'marcou e-mail como spam' END);
  END IF;
  RETURN p_status;
END $$;

CREATE OR REPLACE FUNCTION public.email_unsubscribe(p_email text, p_reason text) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT public.email_set_contact_status(p_email, 'unsubscribed', p_reason) $$;

CREATE OR REPLACE FUNCTION public.email_apply_event(p_id text, p_type text, p_msg_id text, p_payload jsonb, p_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_status text := public.email_event_status(p_type, p_payload); v_to text; v_n int;
BEGIN
  INSERT INTO public.email_events (id, type, provider_message_id, payload, occurred_at)
  VALUES (p_id, p_type, p_msg_id, p_payload, p_at) ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('duplicate', true); END IF;
  IF v_status IS NULL THEN RETURN jsonb_build_object('duplicate', false, 'status', null); END IF;

  UPDATE public.email_messages m SET
    status = CASE WHEN public.email_status_rank(v_status) > public.email_status_rank(m.status) THEN v_status ELSE m.status END,
    delivered_at  = CASE WHEN v_status = 'delivered'  THEN coalesce(m.delivered_at, p_at)  ELSE m.delivered_at END,
    opened_at     = CASE WHEN v_status = 'opened'     THEN coalesce(m.opened_at, p_at)     ELSE m.opened_at END,
    clicked_at    = CASE WHEN v_status = 'clicked'    THEN coalesce(m.clicked_at, p_at)    ELSE m.clicked_at END,
    bounced_at    = CASE WHEN v_status = 'bounced'    THEN coalesce(m.bounced_at, p_at)    ELSE m.bounced_at END,
    complained_at = CASE WHEN v_status = 'complained' THEN coalesce(m.complained_at, p_at) ELSE m.complained_at END,
    error         = CASE WHEN v_status = 'failed' THEN coalesce(p_payload #>> '{data,failed,reason}', 'failed') ELSE m.error END
  WHERE m.provider_message_id = p_msg_id
  RETURNING m.to_email INTO v_to;

  IF v_status IN ('bounced','complained') THEN
    v_to := coalesce(v_to, p_payload #>> '{data,to,0}');
    PERFORM public.email_set_contact_status(v_to, v_status, 'resend:' || p_type);
  END IF;
  RETURN jsonb_build_object('duplicate', false, 'status', v_status);
END $$;

CREATE OR REPLACE FUNCTION public.email_import_suppression(p_rows jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r jsonb; v int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    IF (r->>'status') NOT IN ('unsubscribed','bounced','complained') THEN CONTINUE; END IF;
    IF public.email_contact_status(r->>'email') <> 'subscribed' THEN CONTINUE; END IF;
    INSERT INTO public.email_contacts (email, people_id, status, status_reason, consent_source, status_changed_at)
    VALUES (public.email_norm(r->>'email'),
            (SELECT id FROM public.clients_people WHERE public.email_norm(email) = public.email_norm(r->>'email') LIMIT 1),
            r->>'status', r->>'reason', 'klaviyo_import', now())
    ON CONFLICT (email) DO UPDATE SET status = excluded.status, status_reason = excluded.status_reason,
      consent_source = excluded.consent_source, status_changed_at = now(), updated_at = now()
    WHERE public.email_contacts.status = 'subscribed';
    PERFORM public.email_cancel_pending(r->>'email', 'suprimido no Klaviyo');
    v := v + 1;
  END LOOP;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.email_guard_eval(p_n int, p_bounced int, p_complained int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_n < 50 THEN NULL
    WHEN p_bounced::numeric / p_n >= 0.04 THEN format('bounce %s%% em 24 h (%s de %s)', round(100.0 * p_bounced / p_n, 1), p_bounced, p_n)
    WHEN p_complained::numeric / p_n >= 0.001 THEN format('spam %s%% em 24 h (%s de %s)', round(100.0 * p_complained / p_n, 2), p_complained, p_n)
  END $$;

CREATE OR REPLACE FUNCTION public.email_guard_check() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_n int; v_b int; v_c int; v_reason text;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'bounced'), count(*) FILTER (WHERE status = 'complained')
    INTO v_n, v_b, v_c
    FROM public.email_messages WHERE provider = 'resend' AND sent_at > now() - interval '24 hours';
  v_reason := public.email_guard_eval(v_n, v_b, v_c);
  IF v_reason IS NOT NULL THEN
    UPDATE public.omni_channel_configs
       SET credentials = credentials || jsonb_build_object('resend_share_pct', 0,
             'resend_guard_tripped_at', now(), 'resend_guard_reason', v_reason)
     WHERE channel = 'email' AND coalesce((credentials->>'resend_share_pct')::int, 0) > 0;
  END IF;
  RETURN jsonb_build_object('sent', v_n, 'bounced', v_b, 'complained', v_c, 'tripped', v_reason);
END $$;

CREATE OR REPLACE FUNCTION public.email_stats(p_hours int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(jsonb_object_agg(coalesce(provider, 'nenhum'), x), '{}'::jsonb) FROM (
    SELECT provider, jsonb_build_object(
      'sent', count(*) FILTER (WHERE status NOT IN ('suppressed','failed')),
      'delivered', count(*) FILTER (WHERE email_status_rank(status) >= 2 AND status NOT IN ('bounced','complained')),
      'opened', count(*) FILTER (WHERE opened_at IS NOT NULL),
      'bounced', count(*) FILTER (WHERE status = 'bounced'),
      'complained', count(*) FILTER (WHERE status = 'complained'),
      'failed', count(*) FILTER (WHERE status = 'failed'),
      'suppressed', count(*) FILTER (WHERE status = 'suppressed')) x
    FROM public.email_messages WHERE created_at > now() - make_interval(hours => p_hours) GROUP BY provider) s $$;

REVOKE EXECUTE ON FUNCTION public.email_contact_status(text), public.email_cancel_pending(text, text),
  public.email_set_contact_status(text, text, text), public.email_unsubscribe(text, text),
  public.email_apply_event(text, text, text, jsonb, timestamptz), public.email_import_suppression(jsonb),
  public.email_guard_check(), public.email_stats(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_contact_status(text), public.email_cancel_pending(text, text),
  public.email_set_contact_status(text, text, text), public.email_unsubscribe(text, text),
  public.email_apply_event(text, text, text, jsonb, timestamptz), public.email_import_suppression(jsonb),
  public.email_guard_check(), public.email_stats(int) TO service_role;

UPDATE public.omni_channel_configs SET credentials = credentials || '{"resend_share_pct": 0}'::jsonb
 WHERE channel = 'email' AND NOT (credentials ? 'resend_share_pct');

SELECT cron.schedule('email-guard-check', '*/15 * * * *', $$SELECT public.email_guard_check()$$);

-- Alerta do freio do Resend no BI
CREATE OR REPLACE FUNCTION public._bi_alerts() RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_agg(a), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('level','warn','text','Esteira sem envio há mais de 2 h em horário comercial') a
     WHERE extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 11 AND 19
       AND EXISTS (SELECT 1 FROM public.followup_queue WHERE status='pending' AND scheduled_for < now() - interval '2 hours')
    UNION ALL
    SELECT jsonb_build_object('level','warn','text', format('Entrega do WhatsApp hoje em %s%%', round(100.0 * ok / nullif(tot,0))))
      FROM (SELECT count(*) FILTER (WHERE status IN ('delivered','read','sent')) ok, count(*) tot FROM public.messages
             WHERE channel='whatsapp' AND source_type='followup' AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') m
     WHERE tot >= 20 AND ok::numeric / tot < 0.8
    UNION ALL
    SELECT jsonb_build_object('level','error','text', format('%s toques falharam por cupom nas últimas 24 h', count(*)))
      FROM public.followup_queue WHERE status='failed' AND error_message ILIKE 'cupom%' AND updated_at > now() - interval '24 hours' HAVING count(*) > 0
    UNION ALL
    SELECT jsonb_build_object('level','error','text', 'Envio pelo Resend pausado pelo freio: ' || (credentials->>'resend_guard_reason'))
      FROM public.omni_channel_configs
     WHERE channel = 'email' AND (credentials->>'resend_guard_tripped_at') IS NOT NULL
       AND (credentials->>'resend_guard_tripped_at')::timestamptz > now() - interval '7 days'
       AND coalesce((credentials->>'resend_share_pct')::int, 0) = 0
  ) s $$;
