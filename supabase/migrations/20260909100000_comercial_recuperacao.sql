-- ═══════════════════════════════════════════════════════════════════
-- 20260909100000_comercial_recuperacao.sql
-- COMERCIAL — perfil de recuperação manual (spec 2026-09-09-comercial-recuperacao-design.md)
-- Pool compartilhado de carrinhos com 15d+ · posse = stage "Em negociação" · cupom com autor ·
-- atribuição humana com comissão · RLS: comercial só vê o pool e o que é dele.
-- ═══════════════════════════════════════════════════════════════════
-- @no-rollback reason: a etapa 5a reescreve políticas RLS existentes lendo o
--   texto atual de pg_policies; um rollback fiel dependeria do estado do banco
--   no momento da aplicação, não de um script estático. Reverter = reaplicar o
--   baseline de RLS (fwup17) + DROP das políticas comercial_*.

BEGIN;

-- ── 1. Colunas ───────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sku_id integer;
COMMENT ON COLUMN public.leads.claimed_at IS 'Quando um comercial assumiu o carrinho (janela de 7d da atribuição por janela).';
COMMENT ON COLUMN public.leads.sku_id IS 'SKU Yampi do 1º item do carrinho — foto da capa via yampi_sku_images sem ler o payload.';
CREATE INDEX IF NOT EXISTS idx_leads_comercial_pool
  ON public.leads (leads_pipelines_id, leads_stages_id, created_at) WHERE user_id IS NULL;

ALTER TABLE public.settings_users ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_users_commission_pct_check') THEN
    ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_commission_pct_check
      CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));
  END IF;
END $$;

ALTER TABLE public.crm_coupons
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id    uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS percent    integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_coupons_percent_check') THEN
    ALTER TABLE public.crm_coupons ADD CONSTRAINT crm_coupons_percent_check
      CHECK (percent IS NULL OR percent BETWEEN 1 AND 100);
  END IF;
END $$;
-- O cupom pessoal criado pelo comercial (Task 2/3) grava source='comercial'; o
-- CHECK de 20260902130000 só aceitava esteira/agente/instagram/manual.
ALTER TABLE public.crm_coupons DROP CONSTRAINT IF EXISTS crm_coupons_source_check;
ALTER TABLE public.crm_coupons ADD CONSTRAINT crm_coupons_source_check
  CHECK (source = ANY (ARRAY['esteira', 'agente', 'instagram', 'manual', 'comercial']));
CREATE INDEX IF NOT EXISTS idx_crm_coupons_created_by ON public.crm_coupons (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_coupons_lead_active ON public.crm_coupons (lead_id, expires_at) WHERE lead_id IS NOT NULL;

ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS recovered_by     uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recovery_basis   text,
  ADD COLUMN IF NOT EXISTS commission_pct   numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_value numeric(12,2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_reconversions_recovery_basis_check') THEN
    ALTER TABLE public.esteira_reconversions ADD CONSTRAINT esteira_reconversions_recovery_basis_check
      CHECK (recovery_basis IS NULL OR recovery_basis IN ('cupom','janela'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_esteira_rec_recovered_by
  ON public.esteira_reconversions (recovered_by, paid_at) WHERE recovered_by IS NOT NULL;

ALTER TABLE public.tracked_links
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL;

-- ── 2. Stage "Em negociação" só no pipeline Loja, entre Engajou (2) e Pagamento pendente (3) ──
DO $$
DECLARE v_pipeline uuid;
BEGIN
  SELECT id INTO v_pipeline FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja' LIMIT 1;
  IF v_pipeline IS NULL THEN RAISE EXCEPTION 'pipeline "Esteira Minimal — Loja" não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Em negociação') THEN
    UPDATE public.leads_stages SET order_index = order_index + 1
     WHERE leads_pipelines_id = v_pipeline AND order_index >= 3;
    INSERT INTO public.leads_stages (name, leads_pipelines_id, order_index, color, active)
    VALUES ('Em negociação', v_pipeline, 3, '#8B5CF6', true);
  END IF;
END $$;

-- ── 3. Funções de papel e de pool ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_type() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT su.user_type FROM public.settings_users su
   WHERE su.auth_user_id = auth.uid() AND su.active AND su.deleted_at IS NULL
   LIMIT 1;
$$;

-- Usuário do app = linha ativa e não deletada em settings_users (mesmo predicado
-- que as policies "_select_active_users" já usam inline).
CREATE OR REPLACE FUNCTION public.is_app_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.settings_users su
     WHERE su.auth_user_id = auth.uid() AND su.active AND su.deleted_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.is_commercial() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(public.current_user_type() = 'comercial', false);
$$;

CREATE OR REPLACE FUNCTION public.commercial_pool_lead(p_lead public.leads) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_lead.user_id IS NULL
     AND p_lead.created_at <= now() - interval '15 days'
     AND coalesce(p_lead.status, '') NOT IN ('lost','archived','won')
     AND EXISTS (
       SELECT 1 FROM public.leads_stages s
         JOIN public.leads_pipelines p ON p.id = s.leads_pipelines_id
        WHERE s.id = p_lead.leads_stages_id
          AND p.name = 'Esteira Minimal — Loja'
          AND s.name IN ('Carrinho abandonado','Em recuperação','Engajou'));
$$;

CREATE OR REPLACE FUNCTION public.lead_visible_to_commercial(p_lead public.leads) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (p_lead.user_id IS NOT NULL AND p_lead.user_id = public.get_current_settings_user_id())
      OR public.commercial_pool_lead(p_lead);
$$;

-- pessoa visível = tem lead visível
CREATE OR REPLACE FUNCTION public.person_visible_to_commercial(p_people_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads l WHERE l.people_id = p_people_id AND public.lead_visible_to_commercial(l));
$$;

-- ── 4. RPC: assumir carrinho (atômica) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := public.get_current_settings_user_id();
  v_stage uuid;
  v_updated integer;
  v_lead public.leads;
BEGIN
  IF v_me IS NULL OR NOT public.is_commercial() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nao_comercial');
  END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF v_lead.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'fora_do_pool'); END IF;
  SELECT s.id INTO v_stage FROM public.leads_stages s
   WHERE s.leads_pipelines_id = v_lead.leads_pipelines_id AND s.name = 'Em negociação' LIMIT 1;
  IF v_stage IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'fora_do_pool'); END IF;

  UPDATE public.leads l
     SET user_id = v_me, claimed_at = now(), leads_stages_id = v_stage
   WHERE l.id = p_lead_id AND l.user_id IS NULL AND public.commercial_pool_lead(l);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN RETURN jsonb_build_object('ok', true); END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF v_lead.user_id IS NOT NULL AND v_lead.user_id <> v_me THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ja_assumido');
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'fora_do_pool');
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.current_user_type()', 'public.is_app_user()', 'public.is_commercial()',
    'public.commercial_pool_lead(public.leads)', 'public.lead_visible_to_commercial(public.leads)',
    'public.person_visible_to_commercial(uuid)', 'public.claim_lead(uuid)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ── 5. RLS: comercial cai SÓ nas políticas comercial_* ──────────────────────
-- 5a. políticas atuais "qualquer usuário ativo" ganham AND NOT is_commercial()
--     A lista é materializada ANTES de mexer em pg_policy: dropar/criar dentro
--     do próprio cursor faria o loop enxergar as políticas recém-criadas.
CREATE TEMP TABLE _comercial_rls_targets ON COMMIT DROP AS
  SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('leads','clients_people','messages','followup_queue','tracked_links',
                       'tracked_link_clicks','esteira_reconversions','crm_coupons',
                       'leads_pipelines','leads_stages','settings_users')
     AND roles::text IN ('{authenticated}','{public}')
     AND policyname NOT LIKE 'comercial_%'
     AND policyname NOT ILIKE '%service_role%'
     -- idempotência: não reembrulhar o que já foi embrulhado numa aplicação anterior
     AND coalesce(qual, '') NOT LIKE '%is_commercial()%'
     AND coalesce(with_check, '') NOT LIKE '%is_commercial()%';

DO $$
DECLARE r record; v_qual text; v_check text;
BEGIN
  FOR r IN SELECT * FROM _comercial_rls_targets LOOP
    v_qual  := CASE WHEN r.qual IS NULL THEN NULL ELSE format('(%s) AND NOT public.is_commercial()', r.qual) END;
    v_check := CASE WHEN r.with_check IS NULL THEN NULL ELSE format('(%s) AND NOT public.is_commercial()', r.with_check) END;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', r.policyname, r.tablename, coalesce(v_check, 'NOT public.is_commercial()'));
    ELSIF r.cmd IN ('UPDATE','ALL') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, r.cmd, coalesce(v_qual, 'NOT public.is_commercial()'), coalesce(v_check, v_qual, 'NOT public.is_commercial()'));
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)', r.policyname, r.tablename, r.cmd, coalesce(v_qual, 'NOT public.is_commercial()'));
    END IF;
  END LOOP;
END $$;

-- 5b. políticas do comercial
DROP POLICY IF EXISTS comercial_select ON public.leads;
CREATE POLICY comercial_select ON public.leads FOR SELECT TO authenticated
  USING (public.is_commercial() AND public.lead_visible_to_commercial(leads));
DROP POLICY IF EXISTS comercial_update_own ON public.leads;
CREATE POLICY comercial_update_own ON public.leads FOR UPDATE TO authenticated
  USING (public.is_commercial() AND user_id = public.get_current_settings_user_id())
  WITH CHECK (public.is_commercial() AND user_id = public.get_current_settings_user_id());

DROP POLICY IF EXISTS comercial_select ON public.clients_people;
CREATE POLICY comercial_select ON public.clients_people FOR SELECT TO authenticated
  USING (public.is_commercial() AND public.person_visible_to_commercial(id));
DROP POLICY IF EXISTS comercial_update ON public.clients_people;
CREATE POLICY comercial_update ON public.clients_people FOR UPDATE TO authenticated
  USING (public.is_commercial() AND public.person_visible_to_commercial(id))
  WITH CHECK (public.is_commercial() AND public.person_visible_to_commercial(id));

DROP POLICY IF EXISTS comercial_select ON public.messages;
CREATE POLICY comercial_select ON public.messages FOR SELECT TO authenticated
  USING (public.is_commercial() AND public.person_visible_to_commercial(people_id));
DROP POLICY IF EXISTS comercial_insert ON public.messages;
CREATE POLICY comercial_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial() AND user_id = public.get_current_settings_user_id() AND public.person_visible_to_commercial(people_id));
DROP POLICY IF EXISTS comercial_update_own ON public.messages;
CREATE POLICY comercial_update_own ON public.messages FOR UPDATE TO authenticated
  USING (public.is_commercial() AND user_id = public.get_current_settings_user_id())
  WITH CHECK (public.is_commercial() AND user_id = public.get_current_settings_user_id());

DROP POLICY IF EXISTS comercial_select ON public.followup_queue;
CREATE POLICY comercial_select ON public.followup_queue FOR SELECT TO authenticated
  USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = followup_queue.lead_id AND public.lead_visible_to_commercial(l)));

DROP POLICY IF EXISTS comercial_select ON public.tracked_links;
CREATE POLICY comercial_select ON public.tracked_links FOR SELECT TO authenticated
  USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = tracked_links.lead_id AND public.lead_visible_to_commercial(l)));

DO $$ BEGIN
  IF to_regclass('public.tracked_link_clicks') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS comercial_select ON public.tracked_link_clicks';
    -- coluna real é tracked_link_id (20260904100000_tracked_links_v2), não link_id
    EXECUTE 'CREATE POLICY comercial_select ON public.tracked_link_clicks FOR SELECT TO authenticated
      USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.tracked_links tl JOIN public.leads l ON l.id = tl.lead_id
             WHERE tl.id = tracked_link_clicks.tracked_link_id AND public.lead_visible_to_commercial(l)))';
  END IF;
END $$;

DROP POLICY IF EXISTS comercial_select ON public.esteira_reconversions;
CREATE POLICY comercial_select ON public.esteira_reconversions FOR SELECT TO authenticated
  USING (public.is_commercial() AND recovered_by = public.get_current_settings_user_id());

DROP POLICY IF EXISTS comercial_select ON public.crm_coupons;
CREATE POLICY comercial_select ON public.crm_coupons FOR SELECT TO authenticated
  USING (public.is_commercial() AND created_by = public.get_current_settings_user_id());
DROP POLICY IF EXISTS comercial_insert ON public.crm_coupons;
CREATE POLICY comercial_insert ON public.crm_coupons FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial() AND created_by = public.get_current_settings_user_id());

DROP POLICY IF EXISTS comercial_select ON public.leads_pipelines;
CREATE POLICY comercial_select ON public.leads_pipelines FOR SELECT TO authenticated
  USING (public.is_commercial() AND name = 'Esteira Minimal — Loja');
DROP POLICY IF EXISTS comercial_select ON public.leads_stages;
CREATE POLICY comercial_select ON public.leads_stages FOR SELECT TO authenticated
  USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.leads_pipelines p WHERE p.id = leads_stages.leads_pipelines_id AND p.name = 'Esteira Minimal — Loja'));

DROP POLICY IF EXISTS comercial_select_self ON public.settings_users;
CREATE POLICY comercial_select_self ON public.settings_users FOR SELECT TO authenticated
  USING (public.is_commercial() AND auth_user_id = auth.uid());

-- foto da capa: cache de URL pública (Shopify CDN) — leitura por qualquer usuário ativo
DROP POLICY IF EXISTS yampi_sku_images_select_app ON public.yampi_sku_images;
CREATE POLICY yampi_sku_images_select_app ON public.yampi_sku_images FOR SELECT TO authenticated
  USING ((select public.is_app_user()));

-- ── 6. Backfill leads.sku_id no pipeline Loja a partir do último evento de carrinho da pessoa ──
WITH last_ev AS (
  SELECT DISTINCT ON (e.people_id) e.people_id,
         (e.raw_payload->'resource'->'items'->'data'->0->'sku'->'data'->>'id')::integer AS sku_id
    FROM public.yampi_webhook_events e
   WHERE e.trigger IN ('carrinho_abandonado','checkout_iniciado')
     AND e.people_id IS NOT NULL
     AND e.raw_payload->'resource'->'items'->'data'->0->'sku'->'data'->>'id' ~ '^[0-9]{1,9}$'
   ORDER BY e.people_id, e.created_at DESC
)
UPDATE public.leads l SET sku_id = last_ev.sku_id
  FROM last_ev
 WHERE l.people_id = last_ev.people_id AND l.sku_id IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
