-- =====================================================================
-- Arquivo:  06_campaigns_bi.sql
-- Time:     ora-sim-dados-apresentacao
-- Tabelas:  bi_ad_accounts, bi_ad_campaigns, bi_ad_spend
-- Volumes:  2 contas + 4 campanhas + 28 rows de spend (7 dias × 4)
-- Depende:  nenhum (independente de leads/pessoas)
-- Marker:   [DEMO_SEED_2026-05-02] em account_name
--
-- bi_ad_spend.platform aceita apenas 'meta' | 'google'.
-- UNIQUE(campaign_id, date) — garantir 1 row por dia/campanha.
-- =====================================================================

DO $$
DECLARE
  v_meta_account   uuid;
  v_google_account uuid;

  v_camp_lead_gen     uuid;
  v_camp_remarketing  uuid;
  v_camp_brand        uuid;
  v_camp_pmax         uuid;

  v_existing_acc int;
  v_existing_cmp int;
  v_existing_spd int;

  v_day date;
  v_d   int;
BEGIN
  -- 1) bi_ad_accounts
  SELECT count(*) INTO v_existing_acc
  FROM public.bi_ad_accounts
  WHERE account_name LIKE '%[DEMO_SEED_2026-05-02]%';

  IF v_existing_acc >= 2 THEN
    RAISE NOTICE '06_campaigns_bi: contas marker já existem (% encontradas)', v_existing_acc;
    SELECT id INTO v_meta_account
    FROM public.bi_ad_accounts
    WHERE account_id = 'act_demo_meta_001' LIMIT 1;
    SELECT id INTO v_google_account
    FROM public.bi_ad_accounts
    WHERE account_id = 'demo_google_001' LIMIT 1;
  ELSE
    INSERT INTO public.bi_ad_accounts (account_id, account_name, platform, is_active)
    SELECT 'act_demo_meta_001', 'Meta Ads ORA [DEMO_SEED_2026-05-02]', 'meta', true
    WHERE NOT EXISTS (SELECT 1 FROM public.bi_ad_accounts WHERE account_id = 'act_demo_meta_001')
    RETURNING id INTO v_meta_account;

    IF v_meta_account IS NULL THEN
      SELECT id INTO v_meta_account FROM public.bi_ad_accounts WHERE account_id = 'act_demo_meta_001' LIMIT 1;
    END IF;

    INSERT INTO public.bi_ad_accounts (account_id, account_name, platform, is_active)
    SELECT 'demo_google_001', 'Google Ads ORA [DEMO_SEED_2026-05-02]', 'google', true
    WHERE NOT EXISTS (SELECT 1 FROM public.bi_ad_accounts WHERE account_id = 'demo_google_001')
    RETURNING id INTO v_google_account;

    IF v_google_account IS NULL THEN
      SELECT id INTO v_google_account FROM public.bi_ad_accounts WHERE account_id = 'demo_google_001' LIMIT 1;
    END IF;
  END IF;

  IF v_meta_account IS NULL OR v_google_account IS NULL THEN
    RAISE EXCEPTION 'Falha ao obter ids das contas Meta/Google';
  END IF;

  -- 2) bi_ad_campaigns (4)
  SELECT count(*) INTO v_existing_cmp
  FROM public.bi_ad_campaigns
  WHERE campaign_id IN ('demo_meta_lead_gen','demo_meta_remarketing','demo_google_brand','demo_google_pmax');

  IF v_existing_cmp >= 4 THEN
    RAISE NOTICE '06_campaigns_bi: 4 campanhas marker já existem';
    SELECT id INTO v_camp_lead_gen    FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_meta_lead_gen' LIMIT 1;
    SELECT id INTO v_camp_remarketing FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_meta_remarketing' LIMIT 1;
    SELECT id INTO v_camp_brand       FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_google_brand' LIMIT 1;
    SELECT id INTO v_camp_pmax        FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_google_pmax' LIMIT 1;
  ELSE
    INSERT INTO public.bi_ad_campaigns
      (account_id, ad_account_id, campaign_id, campaign_name, platform, objective, status,
       date_start, date_end, utm_campaign, spend, revenue, impressions, clicks, conversions)
    VALUES
      (v_meta_account,   v_meta_account,   'demo_meta_lead_gen',
       'Lead Gen Topo',         'meta',  'LEAD_GENERATION', 'ACTIVE',
       date '2026-04-26', date '2026-05-02', 'meta_lead_gen',
       1400, 24500, 45000, 800, 30),
      (v_meta_account,   v_meta_account,   'demo_meta_remarketing',
       'Remarketing',           'meta',  'CONVERSIONS',     'ACTIVE',
       date '2026-04-26', date '2026-05-02', 'meta_remarketing',
        910, 12800, 28000, 560, 14),
      (v_google_account, v_google_account, 'demo_google_brand',
       'Search Brand',          'google','LEAD_GENERATION', 'ACTIVE',
       date '2026-04-26', date '2026-05-02', 'google_brand',
        700, 18500, 17500, 380, 21),
      (v_google_account, v_google_account, 'demo_google_pmax',
       'Performance Max',       'google','CONVERSIONS',     'ACTIVE',
       date '2026-04-26', date '2026-05-02', 'google_pmax',
       1190, 22300, 35000, 660, 24);

    -- Recapturar IDs após o multi-row INSERT (RETURNING não comporta multi-row em PL/pgSQL clássico):
    SELECT id INTO v_camp_lead_gen    FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_meta_lead_gen' LIMIT 1;
    SELECT id INTO v_camp_remarketing FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_meta_remarketing' LIMIT 1;
    SELECT id INTO v_camp_brand       FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_google_brand' LIMIT 1;
    SELECT id INTO v_camp_pmax        FROM public.bi_ad_campaigns WHERE campaign_id = 'demo_google_pmax' LIMIT 1;
  END IF;

  -- 3) bi_ad_spend (7 dias × 4 campanhas = 28 rows) — idempotente via ON CONFLICT (campaign_id, date)
  SELECT count(*) INTO v_existing_spd
  FROM public.bi_ad_spend
  WHERE campaign_id IN (v_camp_lead_gen, v_camp_remarketing, v_camp_brand, v_camp_pmax)
    AND date BETWEEN '2026-04-26' AND '2026-05-02';

  IF v_existing_spd >= 28 THEN
    RAISE NOTICE '06_campaigns_bi: % rows de spend já existem na janela — pulando', v_existing_spd;
  ELSE
    FOR v_d IN 0..6 LOOP
      v_day := date '2026-04-26' + v_d;

      -- meta_lead_gen: spend ~R$200/dia, impressions 5000-8000, clicks 80-150, leads 3-6
      INSERT INTO public.bi_ad_spend
        (ad_account_id, campaign_id, platform, date, currency, source,
         spend, impressions, clicks, leads, raw_data)
      VALUES
        (v_meta_account, v_camp_lead_gen, 'meta', v_day, 'BRL', 'api',
         195 + (v_d * 4),                  -- 195..219
         5000 + (v_d * 500),               -- 5000..8000
         80 + (v_d * 12),                  -- 80..152
         3 + (v_d % 4),                    -- 3..6
         jsonb_build_object('demo_seed','2026-05-02','campaign','meta_lead_gen'))
      ON CONFLICT (campaign_id, date) DO NOTHING;

      -- meta_remarketing: spend ~R$130/dia, impressions 3000-5000, clicks 60-100, leads 1-3
      INSERT INTO public.bi_ad_spend
        (ad_account_id, campaign_id, platform, date, currency, source,
         spend, impressions, clicks, leads, raw_data)
      VALUES
        (v_meta_account, v_camp_remarketing, 'meta', v_day, 'BRL', 'api',
         128 + (v_d * 3),                  -- 128..146
         3000 + (v_d * 330),               -- 3000..4980
         60 + (v_d * 7),                   -- 60..102
         1 + (v_d % 3),                    -- 1..3
         jsonb_build_object('demo_seed','2026-05-02','campaign','meta_remarketing'))
      ON CONFLICT (campaign_id, date) DO NOTHING;

      -- google_brand: spend ~R$100/dia, impressions 2000-3000, clicks 40-70, leads 2-4
      INSERT INTO public.bi_ad_spend
        (ad_account_id, campaign_id, platform, date, currency, source,
         spend, impressions, clicks, leads, raw_data)
      VALUES
        (v_google_account, v_camp_brand, 'google', v_day, 'BRL', 'api',
         98 + (v_d * 2),                   -- 98..110
         2000 + (v_d * 165),               -- 2000..2990
         40 + (v_d * 5),                   -- 40..70
         2 + (v_d % 3),                    -- 2..4
         jsonb_build_object('demo_seed','2026-05-02','campaign','google_brand'))
      ON CONFLICT (campaign_id, date) DO NOTHING;

      -- google_pmax: spend ~R$170/dia, impressions 4000-6000, clicks 70-120, leads 2-5
      INSERT INTO public.bi_ad_spend
        (ad_account_id, campaign_id, platform, date, currency, source,
         spend, impressions, clicks, leads, raw_data)
      VALUES
        (v_google_account, v_camp_pmax, 'google', v_day, 'BRL', 'api',
         168 + (v_d * 3),                  -- 168..186
         4000 + (v_d * 340),               -- 4000..6040
         70 + (v_d * 8),                   -- 70..118
         2 + (v_d % 4),                    -- 2..5
         jsonb_build_object('demo_seed','2026-05-02','campaign','google_pmax'))
      ON CONFLICT (campaign_id, date) DO NOTHING;
    END LOOP;
  END IF;

  RAISE NOTICE '06_campaigns_bi: 2 contas + 4 campanhas + 28 rows spend prontos';
END $$;
