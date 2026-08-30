-- =====================================================================
-- Arquivo:  07_sends.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  sends, sends_contacts
-- Volumes:  1 send + 20 sends_contacts (14 delivered + 4 read + 2 sent)
-- Depende:  01 (owner), 02 (clients_people existem com marker)
-- Marker:   [DEMO_SEED_2026-05-02] em sends.description
-- =====================================================================

DO $$
DECLARE
  v_owner_id     uuid;
  v_send_id      uuid;
  v_wa_channel   uuid;
  v_pipeline_id  uuid;
  v_existing     int;
  v_seq          int := 0;
  v_now          timestamptz := timestamptz '2026-05-02 18:00:00+00';
  v_started      timestamptz := timestamptz '2026-04-29 10:00:00+00';
  v_completed    timestamptz := timestamptz '2026-04-29 11:30:00+00';
  v_sent_at      timestamptz;
  v_status       text;
  v_pid          uuid;
  v_phone        text;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.settings_users
  WHERE email = 'outreachrelationship@gmail.com'
  LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner não encontrado — rodar 01 antes';
  END IF;

  -- WhatsApp channel ativo (pode ser NULL se não houver — campo nullable em sends)
  SELECT id INTO v_wa_channel
  FROM public.settings_whatsapp_channels
  WHERE active = true
  ORDER BY is_default DESC, created_at
  LIMIT 1;

  -- Pipeline (opcional — sends.pipeline_id é nullable)
  SELECT id INTO v_pipeline_id
  FROM public.leads_pipelines
  WHERE active = true
  ORDER BY order_index, created_at
  LIMIT 1;

  -- Idempotência
  SELECT count(*) INTO v_existing
  FROM public.sends
  WHERE description LIKE '%[DEMO_SEED_2026-05-02]%';

  IF v_existing >= 1 THEN
    RAISE NOTICE '07_sends: já há % sends marker — pulando', v_existing;
    RETURN;
  END IF;

  -- 1) Inserir send
  INSERT INTO public.sends (
    name, description, type, channel, status,
    pipeline_id, wa_channel_id, created_by,
    total_contacts, sent_count, delivered_count, read_count, failed_count, error_count,
    send_interval_seconds,
    scheduled_at, started_at, completed_at,
    created_at, updated_at
  )
  VALUES (
    'Reativação Maio 2026',
    'Disparo demo de reativação. [DEMO_SEED_2026-05-02]',
    'imported',
    'whatsapp',
    'completed',
    v_pipeline_id,
    v_wa_channel,
    v_owner_id,
    20,   -- total_contacts
    20,   -- sent_count (todos saíram)
    18,   -- delivered_count (delivered + read = 14+4)
    4,    -- read_count
    0,    -- failed_count
    0,    -- error_count
    5,    -- send_interval_seconds
    v_started - interval '1 hour',
    v_started,
    v_completed,
    v_started - interval '2 hours',
    v_completed
  )
  RETURNING id INTO v_send_id;

  -- 2) Inserir 20 sends_contacts referenciando os 20 clients_people marker
  FOR v_pid, v_phone IN
    SELECT id, COALESCE(whatsapp, telefone)
    FROM public.clients_people
    WHERE notes LIKE '%[DEMO_SEED_2026-05-02]%'
    ORDER BY created_at, id
    LIMIT 20
  LOOP
    v_seq := v_seq + 1;

    -- Distribuição: 14 delivered (1..14) + 4 read (15..18) + 2 sent (19..20)
    IF v_seq BETWEEN 1 AND 14 THEN
      v_status := 'delivered';
    ELSIF v_seq BETWEEN 15 AND 18 THEN
      v_status := 'read';
    ELSE
      v_status := 'sent';
    END IF;

    -- sent_at espalhado dentro da janela de execução do send
    v_sent_at := v_started + make_interval(secs => (v_seq - 1) * 5);

    INSERT INTO public.sends_contacts (
      send_id, people_id, whatsapp, status, retry_count,
      sent_at, delivered_at, read_at,
      created_at
    )
    VALUES (
      v_send_id,
      v_pid,
      v_phone,
      v_status,
      0,
      v_sent_at,
      CASE WHEN v_status IN ('delivered','read') THEN v_sent_at + interval '4 seconds' ELSE NULL END,
      CASE WHEN v_status = 'read' THEN v_sent_at + interval '12 minutes' ELSE NULL END,
      v_started - interval '30 minutes'
    );
  END LOOP;

  IF v_seq < 20 THEN
    RAISE WARNING '07_sends: só encontrou % pessoas marker (esperado 20)', v_seq;
  END IF;

  RAISE NOTICE '07_sends: 1 send "Reativação Maio 2026" + % contatos (14 delivered + 4 read + 2 sent)', v_seq;
END $$;
