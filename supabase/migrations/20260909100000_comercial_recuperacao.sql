-- ═══════════════════════════════════════════════════════════════════
-- 20260909100000_comercial_recuperacao.sql
-- COMERCIAL — perfil de recuperação manual (spec 2026-09-09-comercial-recuperacao-design.md)
-- Pool compartilhado de carrinhos com 15d+ · posse = stage "Em negociação" · cupom com autor ·
-- atribuição humana com comissão · RLS: comercial só vê o pool e o que é dele.
--
-- §2.5 da spec: para o comercial, tudo que não for explicitamente liberado é "nada".
-- Por isso a §5a NÃO tem lista de tabelas: ela embrulha TODA política permissiva de
-- `public` com `AND NOT (select public.is_commercial())`, e o acesso do comercial volta
-- só pelas políticas `comercial_*` da §5b + a allowlist de tabelas sem segredo.
-- ═══════════════════════════════════════════════════════════════════
-- @lint-skip MIG008 reason: is_app_user() usa CREATE FUNCTION (sem OR REPLACE) de propósito,
--   dentro de um IF NOT EXISTS — a definição de produção (20260908170000) não pode ser sobrescrita.
-- @no-rollback reason: a etapa 5a reescreve políticas RLS existentes lendo o
--   texto atual de pg_policies; um rollback fiel dependeria do estado do banco
--   no momento da aplicação, não de um script estático. Reverter = reaplicar o
--   baseline de RLS (20260908170000_security_rls_hardening) + DROP das comercial_*.

BEGIN;

-- pg_get_expr (pg_policies.qual) desqualifica nomes visíveis no search_path atual;
-- fixá-lo garante que o texto lido seja reparseável no mesmo lugar ao recriar a política.
SET LOCAL search_path = public, pg_temp;

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

-- is_app_user() já existe em produção (20260908170000_security_rls_hardening, aplicada
-- pela Management API e não versionada aqui). NÃO sobrescrever: só criar se faltar.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_app_user' AND p.pronargs = 0
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.is_app_user() RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.settings_users su
           WHERE su.auth_user_id = auth.uid() AND su.active AND su.deleted_at IS NULL);
      $body$;
    $fn$;
  END IF;
END $$;

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

-- Tabelas que o comercial PODE ler como qualquer usuário do app: catálogos/UI sem
-- segredo e sem dado de cliente de terceiro. Ficam intocadas pela 5a.
CREATE TEMP TABLE _comercial_rls_allowlist (tablename text PRIMARY KEY) ON COMMIT DROP;
-- `notifications` e `leads_tags` NÃO entram: carregam dado de terceiro (título/preview de
-- conversa e a marcação de leads que o comercial não enxerga). Ambas ganham comercial_select
-- escopada logo abaixo. `lead_tags` (catálogo de tags) fica, é definição pura.
INSERT INTO _comercial_rls_allowlist (tablename) VALUES
  ('email_templates'), ('whatsapp_templates'), ('settings_system_modules'),
  ('canned_responses'), ('yampi_sku_images'), ('settings_business_hours'),
  ('leads_stages_followups'), ('lead_tags');

-- 5a. TODA política permissiva de `public` (roles {authenticated}/{public}) ganha
--     AND NOT (select public.is_commercial()) — exceto comercial_*, service_role-only
--     e as tabelas da allowlist. A lista é materializada ANTES de mexer em pg_policy:
--     dropar/criar dentro do próprio cursor faria o loop enxergar o que ele acabou de criar.
CREATE TEMP TABLE _comercial_rls_targets ON COMMIT DROP AS
  SELECT p.tablename, p.policyname, p.cmd, p.permissive, p.qual, p.with_check
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.roles::text IN ('{authenticated}','{public}')
     AND p.permissive = 'PERMISSIVE'
     AND p.policyname NOT LIKE 'comercial\_%'
     -- (b) service_role-only: confere o QUAL, não só o nome
     AND NOT (p.policyname ILIKE '%service_role%'
              AND coalesce(p.qual, '') ~ 'auth\.role\(\)\s*=\s*''service_role''')
     -- (c) allowlist de tabelas que o comercial precisa e que não guardam segredo
     AND p.tablename NOT IN (SELECT tablename FROM _comercial_rls_allowlist)
     -- idempotência: não reembrulhar o que já foi embrulhado numa aplicação anterior
     AND coalesce(p.qual, '') NOT LIKE '%is_commercial()%'
     AND coalesce(p.with_check, '') NOT LIKE '%is_commercial()%';

DO $$
DECLARE r record; v_qual text; v_check text;
BEGIN
  FOR r IN SELECT * FROM _comercial_rls_targets LOOP
    v_qual  := CASE WHEN r.qual IS NULL THEN NULL ELSE format('(%s) AND NOT (select public.is_commercial())', r.qual) END;
    v_check := CASE WHEN r.with_check IS NULL THEN NULL ELSE format('(%s) AND NOT (select public.is_commercial())', r.with_check) END;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR INSERT TO authenticated WITH CHECK (%s)',
        r.policyname, r.tablename, r.permissive, coalesce(v_check, 'NOT (select public.is_commercial())'));
    ELSIF r.cmd IN ('UPDATE','ALL') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
        r.policyname, r.tablename, r.permissive, r.cmd,
        coalesce(v_qual, 'NOT (select public.is_commercial())'),
        coalesce(v_check, v_qual, 'NOT (select public.is_commercial())'));
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO authenticated USING (%s)',
        r.policyname, r.tablename, r.permissive, r.cmd,
        coalesce(v_qual, 'NOT (select public.is_commercial())'));
    END IF;
  END LOOP;
END $$;

-- 5a-bis. Política RESTRITIVA numa tabela que o comercial precisa enxergar mataria a
-- feature em silêncio (restritiva é AND, as comercial_* são permissivas). Não dá pra
-- embrulhar: `AND NOT is_commercial()` numa restritiva NEGA o comercial. Aborta e avisa.
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND permissive = 'RESTRICTIVE'
     AND roles::text IN ('{authenticated}','{public}')
     AND tablename IN ('leads','clients_people','messages','followup_queue','tracked_links',
                       'tracked_link_clicks','esteira_reconversions','crm_coupons','leads_pipelines',
                       'leads_stages','settings_users','yampi_webhook_events','zoppy_abandoned_carts',
                       'leads_updates','clients_people_updates','notifications','leads_tags');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'política RESTRITIVA em tabela do comercial bloquearia as comercial_*: %', v_bad;
  END IF;
END $$;

-- 5b. políticas do comercial
DROP POLICY IF EXISTS comercial_select ON public.leads;
CREATE POLICY comercial_select ON public.leads FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND public.lead_visible_to_commercial(leads));
DROP POLICY IF EXISTS comercial_update_own ON public.leads;
CREATE POLICY comercial_update_own ON public.leads FOR UPDATE TO authenticated
  USING ((select public.is_commercial()) AND user_id = (select public.get_current_settings_user_id()))
  WITH CHECK ((select public.is_commercial()) AND user_id = (select public.get_current_settings_user_id()));

DROP POLICY IF EXISTS comercial_select ON public.clients_people;
CREATE POLICY comercial_select ON public.clients_people FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND public.person_visible_to_commercial(id));
DROP POLICY IF EXISTS comercial_update ON public.clients_people;
CREATE POLICY comercial_update ON public.clients_people FOR UPDATE TO authenticated
  USING ((select public.is_commercial()) AND public.person_visible_to_commercial(id))
  WITH CHECK ((select public.is_commercial()) AND public.person_visible_to_commercial(id));

DROP POLICY IF EXISTS comercial_select ON public.messages;
CREATE POLICY comercial_select ON public.messages FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND public.person_visible_to_commercial(people_id));
DROP POLICY IF EXISTS comercial_insert ON public.messages;
CREATE POLICY comercial_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK ((select public.is_commercial()) AND user_id = (select public.get_current_settings_user_id()) AND public.person_visible_to_commercial(people_id));
DROP POLICY IF EXISTS comercial_update_own ON public.messages;
CREATE POLICY comercial_update_own ON public.messages FOR UPDATE TO authenticated
  USING ((select public.is_commercial()) AND user_id = (select public.get_current_settings_user_id()))
  WITH CHECK ((select public.is_commercial()) AND user_id = (select public.get_current_settings_user_id()));

DROP POLICY IF EXISTS comercial_select ON public.followup_queue;
CREATE POLICY comercial_select ON public.followup_queue FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = followup_queue.lead_id AND public.lead_visible_to_commercial(l)));

DROP POLICY IF EXISTS comercial_select ON public.tracked_links;
CREATE POLICY comercial_select ON public.tracked_links FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = tracked_links.lead_id AND public.lead_visible_to_commercial(l)));

DO $$ BEGIN
  IF to_regclass('public.tracked_link_clicks') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS comercial_select ON public.tracked_link_clicks';
    -- coluna real é tracked_link_id (20260904100000_tracked_links_v2), não link_id
    EXECUTE 'CREATE POLICY comercial_select ON public.tracked_link_clicks FOR SELECT TO authenticated
      USING ((select public.is_commercial()) AND EXISTS (SELECT 1 FROM public.tracked_links tl JOIN public.leads l ON l.id = tl.lead_id
             WHERE tl.id = tracked_link_clicks.tracked_link_id AND public.lead_visible_to_commercial(l)))';
  END IF;
END $$;

DROP POLICY IF EXISTS comercial_select ON public.esteira_reconversions;
CREATE POLICY comercial_select ON public.esteira_reconversions FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND recovered_by = (select public.get_current_settings_user_id()));

DROP POLICY IF EXISTS comercial_select ON public.crm_coupons;
CREATE POLICY comercial_select ON public.crm_coupons FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND created_by = (select public.get_current_settings_user_id()));
DROP POLICY IF EXISTS comercial_insert ON public.crm_coupons;
CREATE POLICY comercial_insert ON public.crm_coupons FOR INSERT TO authenticated
  WITH CHECK ((select public.is_commercial()) AND created_by = (select public.get_current_settings_user_id()));

DROP POLICY IF EXISTS comercial_select ON public.leads_pipelines;
CREATE POLICY comercial_select ON public.leads_pipelines FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND name = 'Esteira Minimal — Loja');
DROP POLICY IF EXISTS comercial_select ON public.leads_stages;
CREATE POLICY comercial_select ON public.leads_stages FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND EXISTS (SELECT 1 FROM public.leads_pipelines p WHERE p.id = leads_stages.leads_pipelines_id AND p.name = 'Esteira Minimal — Loja'));

DROP POLICY IF EXISTS comercial_select_self ON public.settings_users;
CREATE POLICY comercial_select_self ON public.settings_users FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND auth_user_id = (select auth.uid()));

-- Contexto do carrinho e histórico — só das pessoas/leads que o comercial já enxerga.
ALTER TABLE public.yampi_webhook_events   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comercial_select ON public.yampi_webhook_events;
CREATE POLICY comercial_select ON public.yampi_webhook_events FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND public.person_visible_to_commercial(people_id));

DO $$ BEGIN
  IF to_regclass('public.zoppy_abandoned_carts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.zoppy_abandoned_carts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS comercial_select ON public.zoppy_abandoned_carts';
    EXECUTE 'CREATE POLICY comercial_select ON public.zoppy_abandoned_carts FOR SELECT TO authenticated
      USING ((select public.is_commercial()) AND public.person_visible_to_commercial(people_id))';
  END IF;
END $$;

ALTER TABLE public.leads_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comercial_select ON public.leads_updates;
CREATE POLICY comercial_select ON public.leads_updates FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = leads_updates.lead_id AND public.lead_visible_to_commercial(l)));

ALTER TABLE public.clients_people_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comercial_select ON public.clients_people_updates;
CREATE POLICY comercial_select ON public.clients_people_updates FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND public.person_visible_to_commercial(people_id));

-- Sino: notificação pessoal do próprio comercial, ou de pessoa que ele já enxerga.
-- SEM política de UPDATE de propósito: 20260730210000_mark_all_notifications_read dropou
-- notifications_mark_read porque toda escrita passa por RPC SECURITY DEFINER
-- (mark_conversation_read / mark_all_notifications_read / mark_notification_read);
-- recriar o UPDATE direto reabriria a superfície que aquela migration fechou.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comercial_select ON public.notifications;
CREATE POLICY comercial_select ON public.notifications FOR SELECT TO authenticated
  USING ((select public.is_commercial())
         AND (target_user_id = (select public.get_current_settings_user_id())
              OR (people_id IS NOT NULL AND public.person_visible_to_commercial(people_id))));

-- Tags aplicadas: só as dos leads que o comercial enxerga (lead_tags, o catálogo, é allowlist).
ALTER TABLE public.leads_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comercial_select ON public.leads_tags;
CREATE POLICY comercial_select ON public.leads_tags FOR SELECT TO authenticated
  USING ((select public.is_commercial()) AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = leads_tags.lead_id AND public.lead_visible_to_commercial(l)));

-- foto da capa: cache de URL pública (CDN) — leitura por qualquer usuário ativo
-- (yampi_sku_images está na allowlist: a 5a não mexe nela).
DROP POLICY IF EXISTS yampi_sku_images_select_app ON public.yampi_sku_images;
CREATE POLICY yampi_sku_images_select_app ON public.yampi_sku_images FOR SELECT TO authenticated
  USING ((select public.is_app_user()));

-- 5c. Trava: nenhuma política permissiva de `public` pode ter sobrado sem o
--     AND NOT is_commercial() fora da allowlist. Se sobrou, é vazamento (§2.5).
DO $$
DECLARE v_leak text;
BEGIN
  SELECT string_agg(format('%s.%s(%s)', p.tablename, p.policyname, p.cmd), ', ' ORDER BY p.tablename, p.policyname)
    INTO v_leak
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.permissive = 'PERMISSIVE'
     AND p.roles::text IN ('{authenticated}','{public}')
     AND p.policyname NOT LIKE 'comercial\_%'
     AND NOT (p.policyname ILIKE '%service_role%'
              AND coalesce(p.qual, '') ~ 'auth\.role\(\)\s*=\s*''service_role''')
     AND p.tablename NOT IN (SELECT tablename FROM _comercial_rls_allowlist)
     AND ( (p.qual       IS NOT NULL AND p.qual       NOT LIKE '%is_commercial()%')
        OR (p.with_check IS NOT NULL AND p.with_check NOT LIKE '%is_commercial()%') );
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'políticas permissivas sem NOT is_commercial() (comercial veria estes dados): %', v_leak;
  END IF;
END $$;

-- ── 6. Backfill leads.sku_id a partir do último evento de carrinho da pessoa ──
-- Casa por people_id, então preenche o sku_id dos leads da pessoa em qualquer
-- pipeline — inofensivo: quem lê sku_id é a esteira/Loja e o campo era NULL.
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
