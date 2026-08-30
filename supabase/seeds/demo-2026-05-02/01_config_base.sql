-- =====================================================================
-- Arquivo:  01_config_base.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  leads_loss_reasons, settings_users, settings_teams,
--           settings_users_teams
-- Volumes:  4 motivos de perda + 2 usuários demo + 1 time + 2 vínculos
-- Depende:  nenhum (primeiro lote)
-- Marker:   [DEMO_SEED_2026-05-02]
-- =====================================================================

-- 1) Motivos de perda (idempotente via UNIQUE NAME — usa name como chave lógica)
INSERT INTO public.leads_loss_reasons (name, description, active)
VALUES
  ('Preço',          'Cliente considerou valor acima do orçamento. [DEMO_SEED_2026-05-02]',  true),
  ('Concorrência',   'Optou por solução concorrente. [DEMO_SEED_2026-05-02]',                true),
  ('Sem budget',     'Sem orçamento aprovado neste ciclo. [DEMO_SEED_2026-05-02]',           true),
  ('Timing ruim',    'Momento inadequado, retomar em Q3. [DEMO_SEED_2026-05-02]',            true)
ON CONFLICT DO NOTHING;

-- 2) Usuários demo (SDR + closer) — auth_user_id NULL (sem login real)
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.settings_users
  WHERE email = 'outreachrelationship@gmail.com'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner outreachrelationship@gmail.com não encontrado em settings_users — abortando seed';
  END IF;

  INSERT INTO public.settings_users (name, email, phone, user_type, active, auth_user_id)
  VALUES
    ('Marina SDR Demo',     'marina.sdr.demo@ora-demo.local',     '+5511988880001', 'user', true, NULL),
    ('Rafael Closer Demo',  'rafael.closer.demo@ora-demo.local',  '+5511988880002', 'user', true, NULL)
  ON CONFLICT (email) DO NOTHING;
END $$;

-- 3) Time "Vendas Demo" + vínculos (owner + 2 demos)
DO $$
DECLARE
  v_team_id   uuid;
  v_owner_id  uuid;
  v_sdr_id    uuid;
  v_closer_id uuid;
BEGIN
  SELECT id INTO v_owner_id  FROM public.settings_users WHERE email = 'outreachrelationship@gmail.com'    LIMIT 1;
  SELECT id INTO v_sdr_id    FROM public.settings_users WHERE email = 'marina.sdr.demo@ora-demo.local'    LIMIT 1;
  SELECT id INTO v_closer_id FROM public.settings_users WHERE email = 'rafael.closer.demo@ora-demo.local' LIMIT 1;

  -- Time: criar somente se não houver time com este nome
  SELECT id INTO v_team_id
  FROM public.settings_teams
  WHERE name = 'Vendas Demo'
  LIMIT 1;

  IF v_team_id IS NULL THEN
    INSERT INTO public.settings_teams (name, description, team_type, active, priority)
    VALUES ('Vendas Demo', 'Time de vendas para apresentação. [DEMO_SEED_2026-05-02]', 'vendas', true, 1)
    RETURNING id INTO v_team_id;
  END IF;

  -- Vínculos (idempotente via NOT EXISTS)
  IF v_owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.settings_users_teams WHERE team_id = v_team_id AND user_id = v_owner_id
  ) THEN
    INSERT INTO public.settings_users_teams (team_id, user_id, is_leader)
    VALUES (v_team_id, v_owner_id, true);
  END IF;

  IF v_sdr_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.settings_users_teams WHERE team_id = v_team_id AND user_id = v_sdr_id
  ) THEN
    INSERT INTO public.settings_users_teams (team_id, user_id, is_leader)
    VALUES (v_team_id, v_sdr_id, false);
  END IF;

  IF v_closer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.settings_users_teams WHERE team_id = v_team_id AND user_id = v_closer_id
  ) THEN
    INSERT INTO public.settings_users_teams (team_id, user_id, is_leader)
    VALUES (v_team_id, v_closer_id, false);
  END IF;
END $$;
